import crypto from "node:crypto";
import { pool, query } from "../config/db.js";
import { passwordHash } from "../auth.js";
import { isValidEmail } from "../utils.js";
import env from "../config/env.js";
import { sendPasswordResetEmail } from "../services/email.js";

const TOKEN_MINUTES = 30;
const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");

export async function requestPasswordReset(req, res, next) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const generic = { success: true, message: "If that email is registered, a password-reset link will be sent shortly." };
  try {
    if (!isValidEmail(email)) return res.json(generic);
    const result = await query("SELECT id, email, is_active FROM admin_users WHERE LOWER(email) = $1 LIMIT 1", [email]);
    if (!result.rowCount || !result.rows[0].is_active) return res.json(generic);
    const admin = result.rows[0];
    await query("DELETE FROM admin_password_reset_tokens WHERE admin_user_id = $1 OR expires_at <= NOW()", [admin.id]);
    const rawToken = crypto.randomBytes(32).toString("hex");
    await query(`INSERT INTO admin_password_reset_tokens (admin_user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '${TOKEN_MINUTES} minutes')`, [admin.id, hashToken(rawToken)]);
    const resetUrl = `${env.clientResetUrl}?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendPasswordResetEmail({ to: admin.email, resetUrl });
    } catch (mailError) {
      await query("DELETE FROM admin_password_reset_tokens WHERE token_hash = $1", [hashToken(rawToken)]);
      throw mailError;
    }
    res.json(generic);
  } catch (error) { next(error); }
}

export async function resetPassword(req, res, next) {
  try {
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");
    if (!/^[a-f0-9]{64}$/i.test(token) || password.length < 12) {
      return res.status(400).json({ success: false, message: "A valid reset token and password of at least 12 characters are required." });
    }
    const tokenHash = hashToken(token);
    const result = await query(`SELECT t.id, t.admin_user_id FROM admin_password_reset_tokens t JOIN admin_users u ON u.id = t.admin_user_id WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > NOW() AND u.is_active = TRUE LIMIT 1`, [tokenHash]);
    if (!result.rowCount) return res.status(400).json({ success: false, message: "This reset link is invalid or expired." });
    const adminUserId = result.rows[0].admin_user_id;
    const newHash = await passwordHash(password);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, adminUserId]);
      await client.query("UPDATE admin_password_reset_tokens SET used_at = NOW() WHERE id = $1", [result.rows[0].id]);
      await client.query("DELETE FROM admin_sessions WHERE admin_user_id = $1", [adminUserId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({ success: true, message: "Password reset successfully. You can now sign in." });
  } catch (error) { next(error); }
}
