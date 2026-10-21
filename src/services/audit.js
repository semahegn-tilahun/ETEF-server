import { query } from "../config/db.js";

export function auditMutation(req, res, next) {
  if (!req.admin) return next();
  res.on("finish", () => {
    const method = req.method;
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
    const path = String(req.originalUrl || req.path).split("?")[0].slice(0, 500);
    const action = `${method} ${path}`.slice(0, 120);
    const entityId = req.params?.id || req.params?.itemId || null;
    query(
      `INSERT INTO audit_logs(admin_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        req.admin.id,
        action,
        path.split("/")[3] || "api",
        entityId,
        JSON.stringify({ statusCode: res.statusCode, requestId: req.requestId }),
        String(req.ip || req.socket?.remoteAddress || "").slice(0, 100),
        String(req.get("User-Agent") || "").slice(0, 500),
      ]
    ).catch((error) => console.error("Audit log failed:", error.message));
  });
  next();
}
