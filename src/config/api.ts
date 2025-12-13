// src/config/api.ts
import { DEBUG_UI_ENABLED } from "./debug";

/**
 * Imotara Mobile API base URL resolution
 *
 * Priority:
 * 1) EXPO_PUBLIC_IMOTARA_API_BASE_URL (recommended)
 * 2) IMOTARA_API_BASE_URL (legacy)
 * 3) http://localhost:3000 (fallback)
 *
 * NOTE:
 * - No dependency on expo-constants (avoids TS/build errors)
 * - Safe for QA / production
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

// Final resolved base URL
const resolvedBase =
    typeof envBase === "string" && envBase.trim().length > 0
        ? envBase
        : "http://localhost:3000";

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
