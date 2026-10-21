import { query } from '../config/db.js';

// Keep a strict schema: text-only fields and cards; do not accept arbitrary HTML or scripts.
const types = {hero:['eyebrow','title','description','image','buttonText','buttonUrl'],intro:['eyebrow','title','description','image','buttonText','buttonUrl'],services:['eyebrow','title','description'],partners:['eyebrow','title','description'],faq:['eyebrow','title','description'],cta:['eyebrow','title','description','buttonText','buttonUrl'],footer:['copyright']};
const cards = {services:['title','description','icon'],partners:['title','description','image'],faq:['question','answer']};
function validate(data) {
 if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Homepage must be an object');
 const out = {};
 for (const [key, fields] of Object.entries(types)) {
   const value = data[key];
   if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Missing section: ' + key);
   const section = {};
   for (const field of fields) {
     if (typeof value[field] !== 'string' || value[field].length > 4000) throw Error('Invalid ' + key + '.' + field);
     section[field] = value[field].trim();
     if (field.endsWith('Url') && !/^\/(?!\/)[\w/#?&=.%+-]*$/.test(section[field])) throw Error('Only local links are allowed');
     if (field === 'image' && !/^\/(?!\/)[\w/ .%()+-]*$/.test(section[field])) throw Error('Image must be a local asset path');
   }
   if (cards[key]) {
     if (!Array.isArray(value.items) || value.items.length > 30) throw Error('Invalid cards in '+key);
     section.items = value.items.map(item => {
       const clean = {};
       for (const field of cards[key]) {
         if (typeof item?.[field] !== 'string' || item[field].length > 4000) throw Error('Invalid card field');
         clean[field] = item[field].trim();
         if (field === 'image' && !/^\/(?!\/)[\w/ .%()+-]*$/.test(clean[field])) throw Error('Only local image paths are allowed');
         if (field === 'icon' && !/^[a-z0-9-]{1,60}$/.test(clean[field])) throw Error('Invalid icon');
       }
       return clean;
     });
   }
   out[key] = section;
 }
 return out;
}
export async function publicHomepage(req,res,next) { try { const r=await query('SELECT published,published_at FROM homepage_cms WHERE id=1');res.set('Cache-Control','no-store');res.json({success:true,content:r.rows[0]?.published||null,publishedAt:r.rows[0]?.published_at||null});} catch(e){next(e)} }
export async function adminHomepage(req,res,next) { try { const r=await query('SELECT draft,published,updated_at,published_at FROM homepage_cms WHERE id=1');res.json({success:true,...r.rows[0]}); } catch(e){next(e)} }
export async function saveHomepage(req,res,next) { try { let content;try {content=validate(req.body?.content)}catch(e){return res.status(400).json({success:false,message:e.message})}await query('UPDATE homepage_cms SET draft=$1::jsonb,updated_at=NOW(),updated_by=$2 WHERE id=1',[JSON.stringify(content),req.admin.id]);res.json({success:true});}catch(e){next(e)} }
export async function publishHomepage(req,res,next) { try {const r=await query("UPDATE homepage_cms SET published=draft,published_at=NOW(),updated_at=NOW(),updated_by=$1 WHERE id=1 AND draft <> '{}'::jsonb RETURNING published_at",[req.admin.id]);if(!r.rowCount)return res.status(400).json({success:false,message:'Save draft before publishing'});res.json({success:true,publishedAt:r.rows[0].published_at});}catch(e){next(e)} }
