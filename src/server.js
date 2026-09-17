import express from "express";
import cors from "cors";
import helmet from "helmet";
import env from "./config/env.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import passwordResetRouter from "./routes/passwordReset.js";
import cmsRouter from "./routes/cms.js";
import { ensureUploadDirectories } from "./controllers/galleryController.js";
import { ensurePartnerUploadDirectory } from "./controllers/partnerController.js";
import galleryRouter from "./routes/gallery.js";
import partnersRouter from "./routes/partners.js";
import heroRouter from "./routes/hero.js";
import { ensureHeroUploadDirectory } from "./controllers/heroController.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { requestId, requestRateLimit, sameOriginForStateChanges } from "./middleware/security.js";
import { auditMutation } from "./services/audit.js";
import { query } from "./config/db.js";

const app = express();

async function cleanupExpiredSessions() {
  try { await query("DELETE FROM admin_sessions WHERE expires_at <= NOW()"); }
  catch (error) { console.error("Session cleanup failed:", error.message); }
}

app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);
app.use(requestId);
app.use(requestRateLimit);
app.use(sameOriginForStateChanges);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin.replace(/\/$/, ""))) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin is not allowed."));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-ID"],
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use("/uploads", express.static(env.uploadDir, {
  fallthrough: false,
  index: false,
  dotfiles: "deny",
  setHeaders(res) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
  },
}));

app.get("/", (req, res) => {
  res.json({
    name: "Ethiopian Transport Employers Federation API",
    status: "running",
    version: "1.0.0",
  });
});

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/auth", passwordResetRouter);
app.use("/api/v1", cmsRouter);
app.use("/api/v1", galleryRouter);
app.use("/api/v1", partnersRouter);
app.use("/api/v1", heroRouter);
app.use(auditMutation);

app.use(notFoundHandler);
app.use(errorHandler);

Promise.all([ensureUploadDirectories(), ensurePartnerUploadDirectory(), ensureHeroUploadDirectory(), cleanupExpiredSessions()]).then(() => {
  setInterval(cleanupExpiredSessions, 6 * 60 * 60 * 1000).unref();
  app.listen(env.port, () => {
    console.log(`ETEF API running on port ${env.port}`);
  });
}).catch((error) => {
  console.error("Unable to initialize upload directories:", error);
  process.exit(1);
});
