// src/config/api.ts
import { DEBUG_UI_ENABLED } from "./debug";

/**
 * Imotara Mobile API base URL resolution
 *
 * Priority:
 * 1) EXPO_PUBLIC_IMOTARA_API_BASE_URL (recommended)
 * 2) IMOTARA_API_BASE_URL (legacy)
 * 3) Dev-only fallback (localhost) — NEVER used in production
 *
 * NOTE:
 * - No dependency on expo-constants (avoids TS/build errors)
 * - Safe for QA / production (fails fast if misconfigured)
 */

function debugLog(...args: any[]) {
    if (DEBUG_UI_ENABLED) console.log(...args);
}

function normalizeBaseUrl(url: string): string {
    return (url || "").trim().replace(/\/+$/, "");
}

function looksLikeFullUrl(path: string): boolean {
    return /^https?:\/\//i.test(path);
}

// Prefer explicit env vars (Expo supports EXPO_PUBLIC_*)
const envBase =
    (process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL as string | undefined) ||
    (process.env.IMOTARA_API_BASE_URL as string | undefined);

/**
 * Resolve base URL.
 * - If env is present → use it
 * - If dev build and env missing → allow localhost fallback for local testing
 * - If production build and env missing → fail fast with a clear error
 */
const resolvedBase = (() => {
    const v = typeof envBase === "string" ? envBase.trim() : "";

    if (v.length > 0) return v;

    if (__DEV__) {
        return "http://localhost:3000";
    }

    throw new Error(
        "Missing EXPO_PUBLIC_IMOTARA_API_BASE_URL (or IMOTARA_API_BASE_URL). Set it in EAS/Expo env for production builds."
    );
})();

export const IMOTARA_API_BASE_URL = normalizeBaseUrl(resolvedBase);

// Optional gated debug log
debugLog("IMOTARA_API_BASE_URL =", IMOTARA_API_BASE_URL);

/**
 * Build a full API URL for fetch().
 * - If passed a full URL → returned as-is
 * - Otherwise prefixes with IMOTARA_API_BASE_URL
 */
export function buildApiUrl(path: string): string {
    const p = String(path || "");

    if (looksLikeFullUrl(p)) return p;

    const cleanPath = p.startsWith("/") ? p : `/${p}`;
    return `${IMOTARA_API_BASE_URL}${cleanPath}`;
}
