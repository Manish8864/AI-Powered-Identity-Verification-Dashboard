import cors from "cors";
import express from "express";
// import helmet from "helmet"; // Temporarily disabled — helmet ESM import issue
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { adminRouter } from "./routes/admin.routes.js";
import { applicationRouter } from "./routes/application.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { documentRouter } from "./routes/document.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { riskRouter } from "./routes/risk.routes.js";

export const app = express();

app.disable("x-powered-by");
// app.use(helmet()); // Temporarily disabled — helmet ESM import issue
const allowedOrigins = [env.CLIENT_URL, "http://localhost:5173"].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    demoOnly: true,
  });
});

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  authRouter,
);
app.use("/api/applications", requireAuth, applicationRouter);
app.use("/api/documents", requireAuth, documentRouter);
app.use("/api/risk", requireAuth, riskRouter);
app.use("/api/notifications", requireAuth, notificationRouter);
app.use("/api/profile", requireAuth, profileRouter);
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found" });
});
app.use(errorHandler);

export default app;
