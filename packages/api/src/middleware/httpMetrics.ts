import type { NextFunction, Request, Response } from "express";
import { httpRequestDuration, httpRequestsTotal } from "../config/metrics";

/**
 * Records request duration + count per method/route/status. Uses the matched
 * route template (e.g. /api/videos/:id) not the raw path, to keep label
 * cardinality bounded. Skips /health and /metrics.
 */
export function httpMetrics(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.path === "/metrics" || req.path === "/health") {
    next();
    return;
  }
  const stop = httpRequestDuration.startTimer();
  res.on("finish", () => {
    // req.route.path is only set once a route matches; fall back to baseUrl/path.
    const template =
      (req.route?.path && `${req.baseUrl}${req.route.path}`) ||
      req.baseUrl ||
      req.path;
    const labels = {
      method: req.method,
      route: template,
      status: String(res.statusCode),
    };
    stop(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
}
