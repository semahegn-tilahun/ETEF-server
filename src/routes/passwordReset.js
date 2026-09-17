import { Router } from "express";
import { requestPasswordReset, resetPassword } from "../controllers/passwordResetController.js";

const router = Router();
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
export default router;
