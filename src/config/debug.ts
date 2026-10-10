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
  //
  // 🔴 PLAIN MEMBER ACCESS, NOT `process?.env?.`. Measured 2026-10-10 against
  // a Release simulator build: Expo's babel plugin replaces the member
  // expression `process.env.EXPO_PUBLIC_*` with a literal at BUILD time, and
  // it does not transform the OptionalMemberExpression that `?.` produces. So
  // the optional-chained form survives into the bundle as a runtime property
  // lookup — and `process.env` is not populated at runtime in a release
  // Hermes bundle, so it read `undefined` every time.
  //
  // ⚠️ That means this flag has NEVER worked in a release build. It was
  // written defensively and the defensiveness is what broke it.
  //
  // 🔑 The A/B that showed it, inside one bundle: config/api.ts reads
  // `process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL` plainly, and the URL really
  // did change when the build env changed; these two read with `?.` and
  // produced no logs at all under the same build.
  //
  // ⛔ Do not "harden" this back to `process?.env?.` — that is the bug.
  // After inlining there is no runtime lookup left to be unsafe.
  process.env.EXPO_PUBLIC_IMOTARA_DEBUG_UI ??
    // Fallback for older setups. This one is NOT inlined (Expo only inlines
    // the EXPO_PUBLIC_ prefix), so it stays a runtime lookup and keeps `?.`.
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
  // ⛔ Plain member access — see the note on envOverride above. Written with
  // `?.` first, which silently made this entire flag inert: the eas.json
  // change that sets it for the `internal` profile had no effect at all, and
  // the "device builds are now diagnosable" claim was false.
  process.env.EXPO_PUBLIC_IMOTARA_DEBUG_LOGS ??
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

/**
 * An extra destination for debug output.
 *
 * 🔴 WHY THIS EXISTS. Measured 2026-10-10: `console.log` output does NOT reach
 * the iOS device log in a Release React Native build — verified with the flag
 * provably on (inlined at the bytecode level). So enabling logging was
 * necessary but not sufficient: the helpers ran and nothing was readable
 * anywhere. A device failure still left no app-level trace.
 *
 * ⚠️ Registered from outside rather than imported here, because this file is
 * imported by almost everything and must stay dependency-free and incapable
 * of throwing. The sink itself owns the file I/O.
 */
export type DebugSink = (level: "log" | "warn", args: unknown[]) => void;

let sink: DebugSink | null = null;

/**
 * Lines logged BEFORE a sink was installed.
 *
 * 🔑 These are the valuable ones. Module-level logs run as the bundle
 * evaluates — long before App's effects — and they are the facts that
 * identify the build: which API base URL it was compiled against, which flags
 * are on. A wrong base URL was a real misdiagnosis on 2026-10-10, and this is
 * the line that names it. Without a replay they were all dropped and the file
 * began mid-session.
 *
 * Bounded, and released as soon as it is handed over.
 */
const early: Array<{ level: "log" | "warn"; args: unknown[] }> = [];
const MAX_EARLY = 50;

/** Install (or with null, remove) the extra destination. */
export function setDebugSink(next: DebugSink | null): void {
  sink = next;
  if (!next) return;
  // Hand over whatever was logged before this point, in order, then let it go.
  const pending = early.splice(0, early.length);
  for (const e of pending) {
    try {
      next(e.level, e.args);
    } catch {
      /* a broken sink must not stop the replay, or the app */
    }
  }
}

function emit(level: "log" | "warn", args: any[]): void {
  if (!DEBUG_LOGS_ENABLED) return;
  // eslint-disable-next-line no-console
  if (level === "warn") console.warn(...args); else console.log(...args);
  // ⛔ A broken sink must never take the app down, and must never stop the
  // console call above from having happened.
  try {
    if (sink) {
      sink(level, args);
    } else if (early.length < MAX_EARLY) {
      // No sink yet — hold it for the replay in setDebugSink.
      early.push({ level, args });
    }
  } catch {
    /* a diagnostics channel is not worth an app crash */
  }
}

export function debugLog(...args: any[]) {
  emit("log", args);
}

/**
 * Optional helper for gated warnings.
 */
export function debugWarn(...args: any[]) {
  emit("warn", args);
}
