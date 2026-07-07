import * as Sentry from "@sentry/node";
import { env } from "./env";

/**
 * Error tracking. No-op unless SENTRY_DSN is set, so local/dev and any env
 * without a DSN run untouched. Imported FIRST in index.ts so Sentry's HTTP
 * auto-instrumentation is in place before Express loads.
 *
 * Env: SENTRY_DSN (enables), SENTRY_TRACES_SAMPLE_RATE (default 0.1).
 */
const dsn = process.env.SENTRY_DSN;

export const sentryEnabled = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}

export { Sentry };
