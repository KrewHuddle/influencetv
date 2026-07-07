import * as Sentry from "@sentry/react";

/**
 * Client-side error tracking. No-op unless NEXT_PUBLIC_SENTRY_DSN is set, so
 * builds and envs without a DSN are untouched. Initialised once from the
 * Providers component. Uses @sentry/react (browser) rather than @sentry/nextjs
 * to avoid the webpack plugin / instrumentation build coupling — captures
 * client errors; server-side Next errors are not covered by this baseline.
 */
let started = false;

export function initSentry(): void {
  if (started) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  started = true;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
