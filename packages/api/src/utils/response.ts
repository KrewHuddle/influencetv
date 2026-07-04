import type { Response } from "express";

/** Success envelope: { data, error: null }. */
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data, error: null });
}
