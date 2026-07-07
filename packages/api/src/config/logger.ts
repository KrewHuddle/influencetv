import pino from "pino";
import { env } from "./env";

/**
 * Structured JSON logger (replaces scattered console.*). One line per event,
 * machine-parseable for log aggregation. In dev, pipe through `pino-pretty`
 * (`pnpm dev | pino-pretty`) for human-readable output — kept out of the
 * runtime to avoid a transport dependency in production.
 *
 * LOG_LEVEL env overrides the default (info in prod, debug otherwise).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug"),
  base: { service: "apex-api", env: env.NODE_ENV },
  // Never log credentials, even if a middleware attaches the raw request.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
});
