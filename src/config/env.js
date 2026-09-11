import "dotenv/config";

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  dbPoolMax: Number(process.env.DB_POOL_MAX || 5),
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 5242880),
};

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

export default env;
