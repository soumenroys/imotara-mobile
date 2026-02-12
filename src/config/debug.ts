// src/config/debug.ts

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
    typeof global !== "undefined" &&
        typeof (global as any).__DEV__ === "boolean"
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
    process?.env?.IMOTARA_DEBUG_UI
);

/**
 * Final debug UI enablement flag.
 *
 * Resolution order:
 * 1. Explicit env override (if defined)
 * 2. Dev mode default
 */
export const DEBUG_UI_ENABLED: boolean =
    IS_PROD ? false : (typeof envOverride === "boolean" ? envOverride : __DEV__);


/**
 * Optional helper for gated logging.
 * (Use instead of console.log in new code; existing code untouched.)
 */
export function debugLog(...args: any[]) {
    if (DEBUG_UI_ENABLED) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
}

/**
 * Optional helper for gated warnings.
 */
export function debugWarn(...args: any[]) {
    if (DEBUG_UI_ENABLED) {
        // eslint-disable-next-line no-console
        console.warn(...args);
    }
}
