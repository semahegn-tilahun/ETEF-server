import { query } from "../config/db.js";

export async function health(req, res, next) {
  try {
    await query("SELECT 1");
    res.json({
      success: true,
      status: "healthy",
      database: "connected",
    });
  } catch (error) {
    next(error);
  }
}
