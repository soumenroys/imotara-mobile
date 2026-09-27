// src/config/appVersion.ts
//
// The app's own version, for the X-Imotara-Version request header.
//
// 🔴 WHY THIS EXISTS. Retiring `pro_*` and repricing to ₹149/₹1,299 left a fleet
// of installed clients rendering prices we could no longer correct — 1.4.1 and
// 1.3.2 both hardcode `plus_monthly ₹99` and `plus_annual ₹699` while Play bills
// ₹149/₹1,299, and 1.3.2 additionally shows two `pro_*` cards for products that
// no longer exist in the catalog.
//
// Nothing could be done about it, because **no client told the server which
// version it was**. `fetchWithTimeout` sent `X-Imotara-Platform` and nothing
// else, so the server could not distinguish 1.3.2 from 1.4.3 and therefore could
// not warn, gate or even measure.
//
// ⚠️ This does NOT fix that fleet — code shipped now never reaches someone on
// 1.3.2. It buys the lever for the NEXT price or SKU change, which is the one
// that has not happened yet.
//
// 🔑 IT MUST NEVER THROW. This is read on the path of every request, including
// /api/chat-reply. A reply must never fail because a version string could not be
// resolved, so every access is guarded and the fallback is a harmless literal.

import Constants from "expo-constants";

/** Returned when the version genuinely cannot be read. Never an exception. */
export const UNKNOWN_VERSION = "unknown";

function read(): string {
    try {
        const c = Constants as unknown as {
            expoConfig?: {
                version?: string;
                ios?: { buildNumber?: string };
                android?: { versionCode?: number };
            };
        };
        const version = c?.expoConfig?.version;
        if (typeof version !== "string" || version.length === 0) return UNKNOWN_VERSION;

        // The build number disambiguates two builds of the same version — which
        // is exactly the case during a staged rollout. iOS carries a string,
        // Android a number; either is fine, and neither is required.
        const build =
            c?.expoConfig?.ios?.buildNumber ??
            (c?.expoConfig?.android?.versionCode != null
                ? String(c.expoConfig.android.versionCode)
                : undefined);

        return build ? `${version}+${build}` : version;
    } catch {
        // expo-constants unavailable, or a shape we did not expect. Either way
        // a request must still go out.
        return UNKNOWN_VERSION;
    }
}

// Resolved once. The value cannot change while the process is alive, and doing
// this per-request would put a try/catch on the hot path for no benefit.
export const APP_VERSION: string = read();
