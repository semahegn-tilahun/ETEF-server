import crypto from "node:crypto";
import { query } from "./config/db.js";

const COOKIE_NAME = "etef_session";
const SESSION_DAYS = 8;

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => {
    const i = part.indexOf("=");
    if (i < 0) return [part.trim(), ""];
    return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(([k]) => k));
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function passwordHash(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt.toString("hex")}$${derived.toString("hex")}`);
    });
  });
}

export function passwordVerify(password, stored) {
  return new Promise((resolve, reject) => {
    const [algorithm, saltHex, hashHex] = String(stored).split("$");
    if (algorithm !== "scrypt" || !saltHex || !hashHex) return resolve(false);
    crypto.scrypt(password, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      const a = Buffer.from(hashHex, "hex");
      const b = Buffer.from(derived);
      resolve(a.length === b.length && crypto.timingSafeEqual(a, b));
    });
  });
}

export async function createSession(adminUserId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hash(rawToken);
  await query(
    `DELETE FROM admin_sessions WHERE expires_at <= NOW() OR admin_user_id = $1`,
    [adminUserId]
  );
  const result = await query(
    `INSERT INTO admin_sessions (admin_user_id, token_hash, csrf_token, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '${SESSION_DAYS} days')
     RETURNING expires_at`,
    [adminUserId, tokenHash, csrfToken]
  );
  return { rawToken, csrfToken, expiresAt: result.rows[0].expires_at };
}

export function setSessionCookie(res, token, secure) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_DAYS * 86400}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res, secure) {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export async function getSession(req) {
  const rawToken = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  if (!rawToken) return null;
  const result = await query(
    `SELECT s.id AS session_id, s.csrf_token, s.expires_at,
            u.id, u.full_name, u.email, u.role, u.is_active
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = TRUE`,
    [hash(rawToken)]
  );
  if (!result.rowCount) return null;
  await query(`UPDATE admin_sessions SET last_seen_at = NOW() WHERE id = $1`, [result.rows[0].session_id]);
  return { ...result.rows[0], rawToken };
}

export async function requireAuth(req, res, next) {
  try {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ success: false, message: "Authentication required." });
    req.admin = session;
    next();
  } catch (error) { next(error); }
}

export function requireCsrf(req, res, next) {
  const supplied = req.get("X-CSRF-Token");
  if (!supplied || !req.admin) return res.status(403).json({ success: false, message: "Invalid CSRF token." });
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(req.admin.csrf_token));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ success: false, message: "Invalid CSRF token." });
  }
  next();
}
