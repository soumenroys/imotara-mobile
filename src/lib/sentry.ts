// src/lib/sentry.ts
// Mobile Sentry init (P2-10, code_review_audit_2026_08_14 finding F2 — "zero
// real error/crash reporting on either platform"). Env-gated exactly like
// EXPO_PUBLIC_IMOTARA_API_BASE_URL and every other optional integration in
// this app: with no EXPO_PUBLIC_SENTRY_DSN set, Sentry.init() is never
// called — zero behavior change, zero network calls, safe to ship right now
// and wire up a real DSN whenever a Sentry project exists for this app.
//
// Must be called as early as possible (before App.tsx's own imports run) so
// early startup crashes are still captured — see index.ts.

import * as Sentry from "@sentry/react-native";

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Session/screen replay is off by default — a wellness/companion app's
    // chat content is sensitive; enabling replay would need explicit masking
    // review first, not a default-on decision made here.
    environment: __DEV__ ? "development" : "production",
  });
}
