import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./requireAuth.js";

export function requireAdmin(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  if (request.auth?.role !== "admin") {
    response.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
}
