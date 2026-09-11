import express from "express";
import cors from "cors";
import helmet from "helmet";
import env from "./config/env.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import cmsRouter from "./routes/cms.js";
import { ensureUploadDirectories } from "./controllers/galleryController.js";
import galleryRouter from "./routes/gallery.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use("/uploads", express.static(env.uploadDir, {
  fallthrough: false,
  index: false,
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
app.use("/api/v1", cmsRouter);
app.use("/api/v1", galleryRouter);

app.use(notFoundHandler);
app.use(errorHandler);

ensureUploadDirectories().then(() => {
  app.listen(env.port, () => {
    console.log(`ETEF API running on port ${env.port}`);
  });
}).catch((error) => {
  console.error("Unable to initialize upload directories:", error);
  process.exit(1);
});
