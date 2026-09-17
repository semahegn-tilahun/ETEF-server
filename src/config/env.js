import "dotenv/config";

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const configuredOrigins = parseOrigins(
  process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN,
);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL,
  allowedOrigins: configuredOrigins.length ? configuredOrigins : ["http://localhost:5173"],
  clientOrigin: configuredOrigins[0] || "http://localhost:5173",
  dbPoolMax: Math.min(Math.max(Number(process.env.DB_POOL_MAX || 5), 1), 10),
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 5242880),
  trustProxy: process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true",
};

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

export default env;
