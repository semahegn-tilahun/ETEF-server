import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query } from "../config/db.js";
import env from "../config/env.js";
import { cleanString, isUuid } from "../utils.js";

const root = path.resolve(process.cwd(), env.uploadDir);
const heroRoot = path.join(root, "hero");
const tmpRoot = path.join(root, ".tmp");

async function removeIfExists(filePath) { try { await fs.unlink(filePath); } catch (e) { if (e.code !== "ENOENT") throw e; } }
async function detectImageKind(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const b = Buffer.alloc(16); await handle.read(b, 0, b.length, 0);
    if (b[0]===0xff && b[1]===0xd8 && b[2]===0xff) return "jpg";
    if (b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
    if (b.subarray(0,4).toString("ascii")==="RIFF" && b.subarray(8,12).toString("ascii")==="WEBP") return "webp";
    return null;
  } finally { await handle.close(); }
}

function safeOrder(value) { const n=Number(value); return Number.isInteger(n) && n>=0 ? n : 0; }

export async function publicHeroSlides(req,res,next) {
  try {
    const r=await query(`SELECT id,image_url,alt_en,alt_am,sort_order FROM hero_slides WHERE is_published=TRUE ORDER BY sort_order,id`);
    res.json({success:true,items:r.rows});
  } catch(e){next(e)}
}
export async function adminHeroSlides(req,res,next) {
  try { const r=await query(`SELECT * FROM hero_slides ORDER BY sort_order,id`); res.json({success:true,items:r.rows}); } catch(e){next(e)}
}
export async function createHeroSlide(req,res,next) {
  let moved=null;
  try {
    if(!req.file) return res.status(400).json({success:false,message:"Select a hero background image."});
    const kind=await detectImageKind(req.file.path);
    if(!kind){await removeIfExists(req.file.path);return res.status(400).json({success:false,message:"Hero image must be a valid JPEG, PNG or WebP image."});}
    await fs.mkdir(heroRoot,{recursive:true});
    const filename=`${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${kind}`;
    moved=path.join(heroRoot,filename); await fs.rename(req.file.path,moved);
    const isPublished=req.body?.isPublished===undefined?true:String(req.body.isPublished)==="true";
    const r=await query(`INSERT INTO hero_slides(image_url,alt_en,alt_am,is_published,sort_order,updated_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[`/uploads/hero/${filename}`,cleanString(req.body?.altEn,255)||null,cleanString(req.body?.altAm,255)||null,isPublished,safeOrder(req.body?.sortOrder),req.admin.id]);
    res.status(201).json({success:true,item:r.rows[0]});
  } catch(e){if(req.file)await removeIfExists(req.file.path);if(moved)await removeIfExists(moved);next(e)}
}
export async function updateHeroSlide(req,res,next) {
  let moved=null;
  try {
    if(!isUuid(req.params.id)) return res.status(400).json({success:false,message:"Invalid hero slide id."});
    const oldR=await query("SELECT * FROM hero_slides WHERE id=$1",[req.params.id]);
    if(!oldR.rowCount){if(req.file)await removeIfExists(req.file.path);return res.status(404).json({success:false,message:"Hero slide not found."});}
    const old=oldR.rows[0]; let imageUrl=old.image_url;
    if(req.file){const kind=await detectImageKind(req.file.path);if(!kind){await removeIfExists(req.file.path);return res.status(400).json({success:false,message:"Hero image must be a valid JPEG, PNG or WebP image."});}await fs.mkdir(heroRoot,{recursive:true});const filename=`${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${kind}`;moved=path.join(heroRoot,filename);await fs.rename(req.file.path,moved);imageUrl=`/uploads/hero/${filename}`;}
    const published=req.body?.isPublished===undefined?old.is_published:String(req.body.isPublished)==="true";
    const r=await query(`UPDATE hero_slides SET image_url=$1,alt_en=$2,alt_am=$3,is_published=$4,sort_order=$5,updated_at=NOW(),updated_by=$6 WHERE id=$7 RETURNING *`,[imageUrl,cleanString(req.body?.altEn,255)||null,cleanString(req.body?.altAm,255)||null,published,safeOrder(req.body?.sortOrder===undefined?old.sort_order:req.body.sortOrder),req.admin.id,req.params.id]);
    if(old.image_url!==imageUrl){const oldPath=path.resolve(process.cwd(),old.image_url.replace(/^\//,""));if(oldPath.startsWith(root+path.sep))await removeIfExists(oldPath);}
    res.json({success:true,item:r.rows[0]});
  } catch(e){if(req.file)await removeIfExists(req.file.path);if(moved)await removeIfExists(moved);next(e)}
}
export async function deleteHeroSlide(req,res,next){
  try {if(!isUuid(req.params.id))return res.status(400).json({success:false,message:"Invalid hero slide id."});const r=await query("DELETE FROM hero_slides WHERE id=$1 RETURNING id,image_url",[req.params.id]);if(!r.rowCount)return res.status(404).json({success:false,message:"Hero slide not found."});const p=path.resolve(process.cwd(),r.rows[0].image_url.replace(/^\//,""));if(p.startsWith(root+path.sep))await removeIfExists(p);res.json({success:true});}catch(e){next(e)}
}
export async function ensureHeroUploadDirectory(){await fs.mkdir(tmpRoot,{recursive:true});await fs.mkdir(heroRoot,{recursive:true});}
