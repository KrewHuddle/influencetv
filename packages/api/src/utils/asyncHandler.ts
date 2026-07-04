import type { NextFunction, Request, Response } from "express";

type Handler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

/** Wrap an async route handler so thrown/rejected errors reach the error middleware. */
export function asyncHandler(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
