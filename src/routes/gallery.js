import { Router } from "express";
import multer from "multer";
import env from "../config/env.js";
import { requireAuth, requireCsrf } from "../auth.js";
import { listAlbumItems, uploadAlbumItems, deleteAlbumItem, setAlbumCover, updateAlbumItem, deleteAlbum } from "../controllers/galleryController.js";

const router = Router();
const upload = multer({
  dest: env.uploadDir + "/.tmp",
  limits: { files: 10, fileSize: env.maxUploadBytes },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    cb(null, allowed.has(file.mimetype));
  },
});

const admin = [requireAuth, requireCsrf];
router.get("/admin/gallery/albums/:albumId/items", requireAuth, listAlbumItems);
router.delete("/admin/gallery/albums/:id", ...admin, deleteAlbum);
router.post("/admin/gallery/albums/:albumId/items", ...admin, (req, res, next) => upload.array("photos", 10)(req, res, (error) => {
  if (error) {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ success: false, message: `Each image must be ${Math.round(env.maxUploadBytes / 1048576)} MB or smaller.` });
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") return res.status(413).json({ success: false, message: "You can upload a maximum of 10 images at once." });
    return res.status(400).json({ success: false, message: error.message || "Invalid image upload." });
  }
  next();
}), uploadAlbumItems);
router.patch("/admin/gallery/albums/:albumId/items/:itemId", ...admin, updateAlbumItem);
router.delete("/admin/gallery/albums/:albumId/items/:itemId", ...admin, deleteAlbumItem);
router.post("/admin/gallery/albums/:albumId/items/:itemId/cover", ...admin, setAlbumCover);
export default router;
