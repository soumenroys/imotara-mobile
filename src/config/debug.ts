// src/config/debug.ts
// Some TS setups don't include Node typings, so `global` may be unknown.
// We declare it here to avoid build/type errors without changing runtime behavior.
declare const global: any;

/**
 * Global switch to show / hide debug-only UI across the app.
 *
 * Defaults:
 * - Dev builds      → ON
 * - Production      → OFF
 *
 * Override (Expo / RN):
 * - EXPO_PUBLIC_IMOTARA_DEBUG_UI=true|false|1|0|yes|no
 *
 * IMPORTANT:
 * - This file must NEVER throw
 * - This file must NEVER depend on app state or AsyncStorage
 */

/**
 * Parse a boolean-like value safely.
 * Accepts: boolean | number | string | undefined
 */
function parseBool(v: unknown): boolean | undefined {
  if (v === null || v === undefined) return undefined;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;

  const s = String(v).trim().toLowerCase();

  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;

  return undefined;
}

/**
 * Detect dev mode safely across Expo / Metro / RN.
 * (Multiple guards to avoid crashes in unusual runtimes.)
 */
export const __DEV__ =
  typeof global !== "undefined" && typeof (global as any).__DEV__ === "boolean"
    ? (global as any).__DEV__
    : process?.env?.NODE_ENV !== "production";

/**
 * Convenience flag (read-only)
 */
export const IS_PROD = !__DEV__;

/**
 * Read explicit debug override from env (if provided).
 */
const envOverride = parseBool(
  // Expo public env (preferred)
  process?.env?.EXPO_PUBLIC_IMOTARA_DEBUG_UI ??
    // Fallback for older setups
    process?.env?.IMOTARA_DEBUG_UI,
);

/**
 * Final debug UI enablement flag.
 *
 * Resolution order:
 * 1. Explicit env override (if defined)  ✅ can enable even in prod
 * 2. Dev mode default
 */
export const DEBUG_UI_ENABLED: boolean =
  typeof envOverride === "boolean" ? envOverride : __DEV__;

/**
 * Read the separate logging override.
 *
 * 🔴 WHY THIS IS NOT THE SAME FLAG. On 2026-10-10 a failure was reported from
 * a real iPhone — the reply fell back to on-device mode and the app claimed it
 * had gone offline — and there was NOTHING to diagnose it with. debugLog and
 * debugWarn are no-ops in a production build unless
 * EXPO_PUBLIC_IMOTARA_DEBUG_UI is set, and no EAS profile sets it, so
 * `remoteStatus` (the one number that would have named the failure) was
 * computed and discarded on every device build ever shipped.
 *
 * ⚠️ But EXPO_PUBLIC_IMOTARA_DEBUG_UI cannot simply be switched on: it also
 * renders debug-only UI — a panel in HistoryScreen, compatibility metadata on
 * chat bubbles. Turning that on for test builds would change what the person
 * testing actually sees, which makes the test less like the real thing.
 *
 * 🔑 So logging is its own switch. When it is unset, behaviour is EXACTLY what
 * it was: DEBUG_UI_ENABLED alone decided whether logs appeared (in production
 * that flag is only true when the override is true, which made the old
 * IS_PROD check redundant).
 *
 * ⛔ Never enable this for the production or TestFlight profiles. These logs
 * include reply text, which is the person's own conversation. It stays on the
 * device — nothing is uploaded — but there is no reason for a store build to
 * write it to the system log at all.
 */
const logsOverride = parseBool(
  process?.env?.EXPO_PUBLIC_IMOTARA_DEBUG_LOGS ??
    process?.env?.IMOTARA_DEBUG_LOGS,
);

/**
 * Whether debugLog / debugWarn write anything.
 *
 * Resolution order:
 * 1. EXPO_PUBLIC_IMOTARA_DEBUG_LOGS, when set   ✅ logs WITHOUT debug UI
 * 2. DEBUG_UI_ENABLED — the previous behaviour, unchanged
 */
export const DEBUG_LOGS_ENABLED: boolean =
  typeof logsOverride === "boolean" ? logsOverride : DEBUG_UI_ENABLED;

export function debugLog(...args: any[]) {
  if (DEBUG_LOGS_ENABLED) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

/**
 * Optional helper for gated warnings.
 */
export function debugWarn(...args: any[]) {
  if (DEBUG_LOGS_ENABLED) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}
