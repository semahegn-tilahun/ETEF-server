import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireCsrf } from '../auth.js';
const router = Router();
const allowed = new Set(['hero', 'coverage', 'services', 'partners', 'faq']);
const clean = (value) => String(value ?? '').trim().slice(0, 2000);
function validate(section, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const result = { title: clean(data.title), intro: clean(data.intro), subtitle: clean(data.subtitle) };
  if (!result.title || result.title.length > 500) return null;
  if (['services','partners','faq'].includes(section)) {
    if (!Array.isArray(data.items) || data.items.length > 40) return null;
    result.items = data.items.map(item => ({title: clean(item?.title), description: clean(item?.description), logo: clean(item?.logo)}));
    if (result.items.some(item => !item.title || (item.logo && !/^\/(?:images|uploads)\/[\w.\-/%]+$/.test(item.logo)))) return null;
  }
  return result;
}
router.get('/homepage', async (req,res,next) => {try {
  const r = await query('SELECT section_key,published,published_at FROM homepage_sections');
  res.set('Cache-Control','public, max-age=60');
  res.json({success:true,sections:Object.fromEntries(r.rows.map(x => [x.section_key,x.published]))});
} catch(e){next(e)}});
router.get('/admin/homepage',requireAuth,async(req,res,next)=>{try{
  const r=await query('SELECT * FROM homepage_sections ORDER BY section_key');res.json({success:true,items:r.rows});
}catch(e){next(e)}});
router.put('/admin/homepage/:key',requireAuth,requireCsrf,async(req,res,next)=>{try{
  const key=req.params.key; if(!allowed.has(key))return res.status(404).json({success:false,message:'Unknown section'});
  const data=validate(key,req.body); if(!data)return res.status(400).json({success:false,message:'Invalid section data'});
  const publish=req.query.publish==='true';
  const r=await query(`UPDATE homepage_sections SET draft=$1::jsonb, published=CASE WHEN $2 THEN $1::jsonb ELSE published END, published_at=CASE WHEN $2 THEN NOW() ELSE published_at END,updated_by=$3,updated_at=NOW() WHERE section_key=$4 RETURNING *`,[JSON.stringify(data),publish,req.admin.id,key]);
  if(!r.rowCount)return res.status(404).json({success:false,message:'Section not configured'});
  res.json({success:true,item:r.rows[0]});
}catch(e){next(e)}});
router.post('/admin/homepage/:key/publish',requireAuth,requireCsrf,async(req,res,next)=>{try{
  if(!allowed.has(req.params.key))return res.status(404).json({success:false});
  const r=await query('UPDATE homepage_sections SET published=draft,published_at=NOW(),updated_at=NOW(),updated_by=$1 WHERE section_key=$2 RETURNING *',[req.admin.id,req.params.key]);
  if(!r.rowCount)return res.status(404).json({success:false});res.json({success:true,item:r.rows[0]});
}catch(e){next(e)}});
export default router;
