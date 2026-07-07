import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { httpErrorsTotal } from "../config/metrics";
import { Sentry, sentryEnabled } from "../config/sentry";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "ERROR",
    public readonly extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (message = "Not found") =>
  new AppError(404, message, "NOT_FOUND");
export const unauthorized = (message = "Unauthorized") =>
  new AppError(401, message, "UNAUTHORIZED");
export const forbidden = (message = "Forbidden", extra?: Record<string, unknown>) =>
  new AppError(403, message, "FORBIDDEN", extra);
export const badRequest = (message = "Bad request", code = "BAD_REQUEST") =>
  new AppError(400, message, code);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      data: null,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      data: null,
      error: { message: err.message, code: err.code, ...(err.extra ?? {}) },
    });
    return;
  }

  httpErrorsTotal.inc();
  if (sentryEnabled) Sentry.captureException(err);
  logger.error({ err, path: _req.path, method: _req.method }, "Unhandled error");
  res.status(500).json({
    data: null,
    error: { message: "Something went wrong", code: "INTERNAL_ERROR" },
  });
}
