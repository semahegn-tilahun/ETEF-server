import { query } from "../config/db.js";
import { clearSessionCookie, createSession, passwordVerify, setSessionCookie } from "../auth.js";
import { isValidEmail } from "../utils.js";

const attempts = new Map();
function allowed(email) {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = attempts.get(key) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 15 * 60 * 1000; }
  entry.count += 1; attempts.set(key, entry);
  return entry.count <= 10;
}
function success(email) { attempts.delete(email.toLowerCase()); }

export async function login(req, res, next) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!isValidEmail(email) || password.length < 1) return res.status(400).json({ success: false, message: "Enter a valid email and password." });
    if (!allowed(email)) return res.status(429).json({ success: false, message: "Too many login attempts. Try again later." });
    const result = await query(
      `SELECT id, full_name, email, password_hash, role, is_active FROM admin_users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );
    if (!result.rowCount || !result.rows[0].is_active || !(await passwordVerify(password, result.rows[0].password_hash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    const user = result.rows[0];
    const session = await createSession(user.id);
    setSessionCookie(res, session.rawToken, process.env.NODE_ENV === "production");
    success(email);
    res.json({ success: true, user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role }, csrfToken: session.csrfToken });
  } catch (error) { next(error); }
}

export async function me(req, res, next) {
  try {
    if (!req.admin) return res.status(401).json({ success: false, message: "Authentication required." });
    res.json({ success: true, user: { id: req.admin.id, fullName: req.admin.full_name, email: req.admin.email, role: req.admin.role }, csrfToken: req.admin.csrf_token });
  } catch (error) { next(error); }
}

export async function logout(req, res, next) {
  try {
    if (req.admin) await query("DELETE FROM admin_sessions WHERE id = $1", [req.admin.session_id]);
    clearSessionCookie(res, process.env.NODE_ENV === "production");
    res.json({ success: true });
  } catch (error) { next(error); }
}
