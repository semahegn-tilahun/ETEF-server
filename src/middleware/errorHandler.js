export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: "Route not found", requestId: req.requestId });
}

export function errorHandler(error, req, res, next) {
  console.error(`[${req.requestId || "no-request-id"}]`, error);
  if (res.headersSent) return next(error);
  const status = Number(error.status) || (error.type === "entity.too.large" ? 413 : 500);
  const message = error.type === "entity.too.large" ? "Request body is too large." : (error.expose ? error.message : "Internal server error");
  res.status(status).json({ success: false, message, requestId: req.requestId });
}
