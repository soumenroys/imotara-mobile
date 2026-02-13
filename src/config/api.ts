// src/config/api.ts
import { NativeModules, Platform } from "react-native";
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


function inferDevHostFromMetro(): string | null {
    try {
        const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
        if (!scriptURL) return null;

        // examples:
        // - http://192.168.0.111:8081/index.bundle?...
        // - http://10.0.2.2:8081/index.bundle?...
        const match = scriptURL.match(/^https?:\/\/([^/:]+)(?::\d+)?\//i);
        const host = match?.[1]?.trim();
        if (!host) return null;

        // If metro host is localhost on Android, switch to emulator host.
        if (Platform.OS === "android" && (host === "localhost" || host === "127.0.0.1")) {
            return "10.0.2.2";
        }

        return host;
    } catch {
        return null;
    }
}

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
        const host = inferDevHostFromMetro();

        // Prefer metro host IP so the phone/emulator can reach your laptop server.
        if (host) return `http://${host}:3000`;

        // Last resort (DEV-only):
        // - iOS simulator can use localhost
        // - Android emulator needs 10.0.2.2
        return Platform.OS === "android"
            ? "http://10.0.2.2:3000"
            : "http://localhost:3000";

    }


    throw new Error(
        "Missing EXPO_PUBLIC_IMOTARA_API_BASE_URL (or IMOTARA_API_BASE_URL). Set it in EAS/Expo env for production builds."
    );
})();

export const IMOTARA_API_BASE_URL = normalizeBaseUrl(resolvedBase);

// ✅ Warn in production only when base looks unreachable or unsafe for store builds
// (keeps logs clean while still catching the real "localhost/TestFlight can't reach" failures)
const isLocalHost =
    /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/i.test(IMOTARA_API_BASE_URL);

const isPrivateIp =
    /^(https?:\/\/)?(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(
        IMOTARA_API_BASE_URL
    );

// In dev, keep the gated logs
debugLog("IMOTARA_API_BASE_URL =", IMOTARA_API_BASE_URL);

// In production builds, print ONE visible line only when something is likely wrong
if (!__DEV__ && (isLocalHost || isPrivateIp)) {
    console.warn("[imotara] Suspicious IMOTARA_API_BASE_URL:", IMOTARA_API_BASE_URL);
}

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
