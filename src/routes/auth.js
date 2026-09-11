import { Router } from "express";
import { login, logout, me } from "../controllers/authController.js";
import { requireAuth, requireCsrf } from "../auth.js";

const router = Router();
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, requireCsrf, logout);
export default router;
