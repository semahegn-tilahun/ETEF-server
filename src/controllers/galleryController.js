import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query, pool } from "../config/db.js";
import env from "../config/env.js";

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
const tempRoot = path.join(uploadRoot, ".tmp");
const galleryRoot = path.join(uploadRoot, "gallery");

export async function ensureUploadDirectories() {
  await fs.mkdir(tempRoot, { recursive: true });
  await fs.mkdir(galleryRoot, { recursive: true });
}

function safeAlbumPath(albumId) {
  if (!/^[0-9a-f-]{36}$/i.test(albumId)) throw Object.assign(new Error("Invalid album id."), { status: 400 });
  return path.join(galleryRoot, albumId);
}

function extensionFor(kind) {
  return kind === "jpeg" ? ".jpg" : kind === "png" ? ".png" : ".webp";
}

async function detectImageKind(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    await handle.read(buffer, 0, buffer.length, 0);
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
    if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
    return null;
  } finally { await handle.close(); }
}

async function removeIfExists(filePath) { try { await fs.unlink(filePath); } catch (e) { if (e.code !== "ENOENT") throw e; } }

export async function listAlbumItems(req, res, next) {
  try {
    const album = await query("SELECT id,title_en,title_am,cover_image_url FROM gallery_albums WHERE id=$1", [req.params.albumId]);
    if (!album.rowCount) return res.status(404).json({ success: false, message: "Album not found." });
    const items = await query("SELECT id,album_id,title_en,title_am,image_url,sort_order,created_at FROM gallery_items WHERE album_id=$1 ORDER BY sort_order,id", [req.params.albumId]);
    res.json({ success: true, album: album.rows[0], items: items.rows });
  } catch (e) { next(e); }
}

export async function uploadAlbumItems(req, res, next) {
  const files = req.files || [];
  const albumId = req.params.albumId;
  const accepted = [];
  try {
    const album = await query("SELECT id FROM gallery_albums WHERE id=$1", [albumId]);
    if (!album.rowCount) {
      await Promise.all(files.map(f => removeIfExists(f.path)));
      return res.status(404).json({ success: false, message: "Album not found." });
    }
    if (!files.length) return res.status(400).json({ success: false, message: "Select at least one image." });
    const destination = safeAlbumPath(albumId);
    await fs.mkdir(destination, { recursive: true });
    const maxOrder = await query("SELECT COALESCE(MAX(sort_order), -1)::int AS max FROM gallery_items WHERE album_id=$1", [albumId]);
    let sortOrder = maxOrder.rows[0].max + 1;

    for (const file of files) {
      const kind = await detectImageKind(file.path);
      if (!kind) {
        await removeIfExists(file.path);
        continue;
      }
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extensionFor(kind)}`;
      const target = path.join(destination, filename);
      await fs.rename(file.path, target);
      accepted.push({ target, imageUrl: `/uploads/gallery/${albumId}/${filename}`, sortOrder: sortOrder++ });
    }

    if (!accepted.length) return res.status(400).json({ success: false, message: "No valid JPEG, PNG or WebP images were uploaded." });

    const client = await pool.connect();
    const inserted = [];
    try {
      await client.query("BEGIN");
      for (const item of accepted) {
        const result = await client.query(
          `INSERT INTO gallery_items(album_id,image_url,sort_order) VALUES($1,$2,$3) RETURNING id,album_id,title_en,title_am,image_url,sort_order,created_at`,
          [albumId, item.imageUrl, item.sortOrder]
        );
        inserted.push(result.rows[0]);
      }
      const cover = await client.query("SELECT cover_image_url FROM gallery_albums WHERE id=$1", [albumId]);
      if (!cover.rows[0].cover_image_url) {
        await client.query("UPDATE gallery_albums SET cover_image_url=$1,updated_at=NOW() WHERE id=$2", [inserted[0].image_url, albumId]);
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally { client.release(); }

    res.status(201).json({ success: true, items: inserted, skipped: files.length - accepted.length });
  } catch (e) {
    await Promise.all(accepted.map(x => removeIfExists(x.target)));
    await Promise.all(files.map(f => removeIfExists(f.path)));
    next(e);
  }
}

export async function deleteAlbumItem(req, res, next) {
  try {
    const result = await query("DELETE FROM gallery_items WHERE id=$1 RETURNING id,album_id,image_url", [req.params.itemId]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Photo not found." });
    const item = result.rows[0];
    const relative = item.image_url.replace(/^\//, "");
    const filePath = path.resolve(process.cwd(), relative);
    if (!filePath.startsWith(path.resolve(uploadRoot) + path.sep)) return res.status(500).json({ success: false, message: "Stored image path is invalid." });
    await removeIfExists(filePath);
    const cover = await query("SELECT cover_image_url FROM gallery_albums WHERE id=$1", [item.album_id]);
    if (cover.rows[0]?.cover_image_url === item.image_url) {
      const next = await query("SELECT image_url FROM gallery_items WHERE album_id=$1 ORDER BY sort_order,id LIMIT 1", [item.album_id]);
      await query("UPDATE gallery_albums SET cover_image_url=$1,updated_at=NOW() WHERE id=$2", [next.rows[0]?.image_url || null, item.album_id]);
    }
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function setAlbumCover(req, res, next) {
  try {
    const result = await query(
      `SELECT i.id,i.album_id,i.image_url FROM gallery_items i WHERE i.id=$1 AND i.album_id=$2`,
      [req.params.itemId, req.params.albumId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Photo not found in this album." });
    await query("UPDATE gallery_albums SET cover_image_url=$1,updated_at=NOW() WHERE id=$2", [result.rows[0].image_url, req.params.albumId]);
    res.json({ success: true, coverImageUrl: result.rows[0].image_url });
  } catch (e) { next(e); }
}

export async function updateAlbumItem(req, res, next) {
  try {
    const sortOrder = Number.isInteger(req.body?.sortOrder) ? Math.max(0, req.body.sortOrder) : null;
    const titleEn = typeof req.body?.titleEn === "string" ? req.body.titleEn.trim().slice(0,255) : null;
    const titleAm = typeof req.body?.titleAm === "string" ? req.body.titleAm.trim().slice(0,255) : null;
    const result = await query(
      `UPDATE gallery_items SET title_en=COALESCE($1,title_en),title_am=COALESCE($2,title_am),sort_order=COALESCE($3,sort_order) WHERE id=$4 AND album_id=$5 RETURNING id,album_id,title_en,title_am,image_url,sort_order,created_at`,
      [titleEn, titleAm, sortOrder, req.params.itemId, req.params.albumId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Photo not found in this album." });
    res.json({ success: true, item: result.rows[0] });
  } catch (e) { next(e); }
}

export async function deleteAlbum(req, res, next) {
  try {
    const result = await query("DELETE FROM gallery_albums WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Album not found." });
    await fs.rm(path.join(galleryRoot, req.params.id), { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) { next(e); }
}
