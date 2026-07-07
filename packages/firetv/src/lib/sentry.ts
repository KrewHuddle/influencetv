import * as Sentry from "@sentry/react-native";

/**
 * Error tracking for the Fire TV app. No-op unless SENTRY_DSN is provided at
 * build time via react-native-config / env, so dev builds run untouched.
 * Called once from App.tsx before the navigator mounts.
 */
let started = false;

export function initSentry(): void {
  if (started) return;
  // Injected at build (e.g. babel-plugin-transform-inline-environment-variables
  // or react-native-config). Falls back to undefined → Sentry stays inert.
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  started = true;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
