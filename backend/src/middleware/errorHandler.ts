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

  const status = getErrorStatus(error);
  const message = getErrorMessage(error);
  console.error("Unhandled API error", { status, message, error });
  response.status(status).json({ error: message });
};

function getErrorStatus(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: number }).status;
    if (typeof status === "number" && status >= 400 && status < 600) return status;
  }
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) return statusCode;
  }
  return 500;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}
