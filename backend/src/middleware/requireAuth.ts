import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; role: "user" | "admin" };
}

export function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;

  if (!token) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      (payload.role !== "user" && payload.role !== "admin")
    ) {
      response.status(401).json({ error: "Invalid authentication token" });
      return;
    }

    request.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    response.status(401).json({ error: "Invalid or expired authentication token" });
  }
}
