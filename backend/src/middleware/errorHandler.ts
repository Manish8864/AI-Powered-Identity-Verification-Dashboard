import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Request validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "MulterError"
  ) {
    response.status(400).json({ error: "Upload rejected. Check file size and form fields." });
    return;
  }

  console.error("Unhandled API error", error);
  response.status(500).json({ error: "An unexpected server error occurred" });
};
