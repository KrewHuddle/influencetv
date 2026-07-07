import pinoHttp from "pino-http";
import { logger } from "../config/logger";

/**
 * Structured HTTP request logger (pino-http). Emits one JSON line per request
 * with method/url/status/latency. Skips /health and /metrics probes. Log level
 * scales with the response: 5xx→error, 4xx→warn, else info.
 */
export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === "/health" || req.url === "/metrics",
  },
  customLogLevel(_req, res, err) {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
