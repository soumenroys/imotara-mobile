// src/config/debug.ts

/**
 * Global switch to show/hide debug-only UI across the app.
 *
 * Defaults:
 * - Dev builds: ON
 * - Prod builds: OFF
 *
 * Override (Expo): set `EXPO_PUBLIC_IMOTARA_DEBUG_UI=true|false|1|0`
 */
function parseBool(v: unknown): boolean | undefined {
    if (v == null) return undefined;
    const s = String(v).trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(s)) return true;
    if (["0", "false", "no", "n", "off"].includes(s)) return false;
    return undefined;
}

// Expo supports EXPO_PUBLIC_* env vars (bundled at build time)
const envOverride = parseBool(process.env.EXPO_PUBLIC_IMOTARA_DEBUG_UI);

export const DEBUG_UI_ENABLED: boolean =
    typeof envOverride === "boolean" ? envOverride : !!__DEV__;

/**
 * Helper for readable gating:
 *   if (isDebugUI()) { ... }
 */
export function isDebugUI(): boolean {
    return DEBUG_UI_ENABLED;
}
