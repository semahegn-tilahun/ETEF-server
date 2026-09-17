import crypto from "node:crypto";

const buckets = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 240;
const MAX_MUTATIONS = 80;
const MAX_LOGIN = 10;

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

function allow(key, limit, windowMs = WINDOW_MS) {
  const now = Date.now();
  const item = buckets.get(key);
  if (!item || now >= item.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  item.count += 1;
  return item.count <= limit;
}

export function requestId(req, res, next) {
  const incoming = String(req.get("X-Request-ID") || "");
  const id = /^[A-Za-z0-9._:-]{8,100}$/.test(incoming) ? incoming : crypto.randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
}

export function requestRateLimit(req, res, next) {
  if (!allow(`all:${clientIp(req)}`, MAX_REQUESTS)) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later.", requestId: req.requestId });
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    if (!allow(`mut:${clientIp(req)}`, MAX_MUTATIONS)) {
      return res.status(429).json({ success: false, message: "Too many changes requested. Please try again later.", requestId: req.requestId });
    }
  }
  next();
}

export function loginRateLimit(req, res, next) {
  const ip = clientIp(req);
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 320);
  const key = `${ip}:${email}`;
  if (!allow(`login:${key}`, MAX_LOGIN)) {
    return res.status(429).json({ success: false, message: "Too many login attempts. Try again later.", requestId: req.requestId });
  }
  next();
}

export function sameOriginForStateChanges(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("Origin");
  if (!origin) return next();
  const expected = String(process.env.CLIENT_ORIGIN || "").replace(/\/$/, "");
  if (expected && origin.replace(/\/$/, "") !== expected) {
    return res.status(403).json({ success: false, message: "Origin not allowed.", requestId: req.requestId });
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, item] of buckets) if (now >= item.resetAt) buckets.delete(key);
}, 10 * 60 * 1000).unref();
