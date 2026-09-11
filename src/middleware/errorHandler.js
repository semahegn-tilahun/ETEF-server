export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
}

export function errorHandler(error, req, res, next) {
  console.error(error);

  res.status(error.status || 500).json({
    success: false,
    message: error.expose ? error.message : "Internal server error",
  });
}
