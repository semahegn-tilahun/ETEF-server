import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query } from "../config/db.js";
import env from "../config/env.js";
import { cleanString, isValidUrl, isUuid } from "../utils.js";

const root = path.resolve(process.cwd(), env.uploadDir);
const tmpRoot = path.join(root, ".tmp");
const partnerRoot = path.join(root, "partners");

async function removeIfExists(filePath) { try { await fs.unlink(filePath); } catch (e) { if (e.code !== "ENOENT") throw e; } }
async function detectLogoKind(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const b = Buffer.alloc(16); await handle.read(b, 0, b.length, 0);
    if (b[0]===0xff && b[1]===0xd8 && b[2]===0xff) return "jpg";
    if (b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
    if (b.subarray(0,4).toString("ascii")==="RIFF" && b.subarray(8,12).toString("ascii")==="WEBP") return "webp";
    return null;
  } finally { await handle.close(); }
}
function logoExtension(kind) { return `.${kind}`; }
function validateCategory(value) { return ["PARTNER","SPONSOR","BOTH"].includes(String(value||"").toUpperCase()) ? String(value).toUpperCase() : "PARTNER"; }
function parseSort(value) { const n=Number(value); return Number.isInteger(n) && n>=0 ? n : 0; }
function validateBody(body) {
  const nameEn=cleanString(body?.nameEn,255);
  if(!nameEn) return {error:"English organization name is required."};
  const website=cleanString(body?.websiteUrl,1000);
  if(website && !isValidUrl(website)) return {error:"Invalid partner website URL."};
  return {nameEn, nameAm:cleanString(body?.nameAm,255)||null, descriptionEn:cleanString(body?.descriptionEn,5000)||null, descriptionAm:cleanString(body?.descriptionAm,5000)||null, category:validateCategory(body?.category), website, isPublished:typeof body?.isPublished==='boolean'?body.isPublished:true, sortOrder:parseSort(body?.sortOrder)};
}

export async function publicPartners(req,res,next){
  try {
    const category=["PARTNER","SPONSOR","BOTH"].includes(String(req.query.category||"").toUpperCase()) ? String(req.query.category).toUpperCase() : null;
    const r=await query(`SELECT id,name_en,name_am,description_en,description_am,category,website_url,logo_url,sort_order FROM partners WHERE is_published=TRUE ${category?"AND category=$1":""} ORDER BY sort_order,name_en`, category?[category]:[]);
    res.json({success:true,items:r.rows});
  } catch(e){next(e)}
}
export async function adminPartners(req,res,next){
  try { const r=await query(`SELECT * FROM partners ORDER BY sort_order,name_en`); res.json({success:true,items:r.rows}); } catch(e){next(e)}
}
export async function createPartner(req,res,next){
  let movedPath=null;
  try {
    const v=validateBody(req.body); if(v.error){ if(req.file) await removeIfExists(req.file.path); return res.status(400).json({success:false,message:v.error}); }
    let logoUrl=null;
    if(req.file){ const kind=await detectLogoKind(req.file.path); if(!kind){await removeIfExists(req.file.path); return res.status(400).json({success:false,message:"Logo must be a valid JPEG, PNG or WebP image."});} const dir=path.join(partnerRoot); await fs.mkdir(dir,{recursive:true}); const filename=`${Date.now()}-${crypto.randomBytes(8).toString("hex")}${logoExtension(kind)}`; movedPath=path.join(dir,filename); await fs.rename(req.file.path,movedPath); logoUrl=`/uploads/partners/${filename}`; }
    const r=await query(`INSERT INTO partners(name_en,name_am,description_en,description_am,category,website_url,logo_url,is_published,sort_order,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[v.nameEn,v.nameAm,v.descriptionEn,v.descriptionAm,v.category,v.website||null,logoUrl,v.isPublished,v.sortOrder,req.admin.id]);
    res.status(201).json({success:true,item:r.rows[0]});
  } catch(e){ if(req.file) await removeIfExists(req.file.path); if(movedPath) await removeIfExists(movedPath); next(e); }
}
export async function updatePartner(req,res,next){
  let movedPath=null;
  try {
    if(!isUuid(req.params.id)) return res.status(400).json({success:false,message:"Invalid partner id."});
    const existing=await query(`SELECT * FROM partners WHERE id=$1`,[req.params.id]); if(!existing.rowCount){if(req.file) await removeIfExists(req.file.path); return res.status(404).json({success:false,message:"Partner not found."});}
    const old=existing.rows[0]; const v=validateBody({...old,nameEn:req.body?.nameEn ?? old.name_en,nameAm:req.body?.nameAm ?? old.name_am,descriptionEn:req.body?.descriptionEn ?? old.description_en,descriptionAm:req.body?.descriptionAm ?? old.description_am,category:req.body?.category ?? old.category,websiteUrl:req.body?.websiteUrl ?? old.website_url,isPublished:req.body?.isPublished===undefined?old.is_published:req.body.isPublished,sortOrder:req.body?.sortOrder===undefined?old.sort_order:req.body.sortOrder});
    if(v.error){if(req.file) await removeIfExists(req.file.path); return res.status(400).json({success:false,message:v.error});}
    let logoUrl=old.logo_url;
    if(req.file){ const kind=await detectLogoKind(req.file.path); if(!kind){await removeIfExists(req.file.path); return res.status(400).json({success:false,message:"Logo must be a valid JPEG, PNG or WebP image."});} await fs.mkdir(partnerRoot,{recursive:true}); const filename=`${Date.now()}-${crypto.randomBytes(8).toString("hex")}${logoExtension(kind)}`; movedPath=path.join(partnerRoot,filename); await fs.rename(req.file.path,movedPath); logoUrl=`/uploads/partners/${filename}`; }
    const r=await query(`UPDATE partners SET name_en=$1,name_am=$2,description_en=$3,description_am=$4,category=$5,website_url=$6,logo_url=$7,is_published=$8,sort_order=$9,updated_at=NOW(),updated_by=$10 WHERE id=$11 RETURNING *`,[v.nameEn,v.nameAm,v.descriptionEn,v.descriptionAm,v.category,v.website||null,logoUrl,v.isPublished,v.sortOrder,req.admin.id,req.params.id]);
    if(old.logo_url && logoUrl!==old.logo_url){const oldPath=path.resolve(process.cwd(),old.logo_url.replace(/^\//,"")); if(oldPath.startsWith(root+path.sep)) await removeIfExists(oldPath);}
    res.json({success:true,item:r.rows[0]});
  } catch(e){if(req.file) await removeIfExists(req.file.path); if(movedPath) await removeIfExists(movedPath); next(e);}
}
export async function deletePartner(req,res,next){
  try { if(!isUuid(req.params.id)) return res.status(400).json({success:false,message:"Invalid partner id."}); const r=await query(`DELETE FROM partners WHERE id=$1 RETURNING id,logo_url`,[req.params.id]); if(!r.rowCount)return res.status(404).json({success:false,message:"Partner not found."}); const logo=r.rows[0].logo_url; if(logo){const p=path.resolve(process.cwd(),logo.replace(/^\//,""));if(p.startsWith(root+path.sep))await removeIfExists(p);} res.json({success:true}); } catch(e){next(e)}
}
export async function ensurePartnerUploadDirectory(){await fs.mkdir(tmpRoot,{recursive:true});await fs.mkdir(partnerRoot,{recursive:true});}
