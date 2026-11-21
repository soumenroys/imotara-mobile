// src/lib/age/ageSignals.ts
//
// #159 — the OS age signal (Google Play Age Signals on Android, Apple's
// Declared Age Range on iOS). Brazil's Digital ECA and California's AB 1043
// make app stores share an age band; the app is expected to act on it.
//
// What we do with it — owner decision 21 Nov 2026:
//   under 13  → a gentle stop screen with crisis help. No chat.
//   13–17     → the profile's age is set to "13_17" (teen tone; Connect stays shut).
//   18+ / unknown → nothing changes.
//
// 🔒 The band stays ON THE DEVICE. It is never sent to our server, analytics or
// ads. The only thing that leaves is what the person's own Settings age already
// sends today ("13_17" for the reply tone).
//
// ⛔ iOS before 26 answers requestAgeRangeAsync with lowerBound 18 for EVERYONE.
// That is "not supported", not "verified adult" — so on iOS we only ask when the
// OS itself says the age range is required (iOS 26.4+). Never read that 18 as proof.
//
// ⛔ Any error, timeout or missing answer is "unknown" — which changes nothing.
// A broken signal must never lock an adult out, and never be the reason a teen
// loses the crisis card (the card is on every path).

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AgeVerdict = "under13" | "teen" | "adult" | "unknown";

/** Last verdict, so a known under-13 sees the stop screen at once on the next open. */
export const AGE_VERDICT_KEY = "imotara.age.verdict.v1";
/** When the Android sharing prompt was last answered "not shared" — we don't nag. */
export const AGE_ASKED_KEY = "imotara.age.asked.v1";
/** Ask again at most this often after a "not shared". */
export const REASK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Pure: turns the OS's band into our verdict.
 * The bounds are inclusive ages; either may be null.
 */
export function verdictFromRange(
    lowerBound: number | null | undefined,
    upperBound: number | null | undefined,
): AgeVerdict {
    const lo = typeof lowerBound === "number" && Number.isFinite(lowerBound) ? lowerBound : null;
    const hi = typeof upperBound === "number" && Number.isFinite(upperBound) ? upperBound : null;
    // Under 13 only when the WHOLE band is below 13. A band of "0–15" is not proof.
    if (hi !== null && hi < 13) return "under13";
    if (lo !== null && lo >= 18) return "adult";
    // Teen only when the whole band sits inside 13–17. "13 and up" (no upper
    // bound) could be an adult, so it is not a teen verdict.
    if (lo !== null && lo >= 13 && hi !== null && hi < 18) return "teen";
    return "unknown";
}

export function parseVerdict(raw: string | null | undefined): AgeVerdict | null {
    return raw === "under13" || raw === "teen" || raw === "adult" || raw === "unknown" ? raw : null;
}

/** The slice of expo-age-range we use — injected so tests can drive every branch. */
export type AgeRangeApi = {
    requestAgeRangeAsync(o: { threshold1: number; threshold2?: number }): Promise<{
        lowerBound: number | null;
        upperBound: number | null;
    }>;
    getRequiredRegulatoryFeaturesAsync(): Promise<string[] | null>;
    requestAgeSignalsAccessAsync(): Promise<"SHARED" | "NOT_SHARED" | "VERIFICATION_REQUIRED" | null>;
};

type Store = Pick<typeof AsyncStorage, "getItem" | "setItem">;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | "timeout"> {
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve("timeout"), ms);
        p.then(
            (v) => { clearTimeout(t); resolve(v); },
            () => { clearTimeout(t); resolve("timeout"); },
        );
    });
}

/**
 * Asks the OS. Never throws; anything unexpected is "unknown".
 * `os` is injectable for tests; defaults to Platform.OS.
 */
export async function readAgeVerdict(
    api: AgeRangeApi,
    opts: { os?: string; store?: Store; now?: number; timeoutMs?: number } = {},
): Promise<AgeVerdict> {
    const os = opts.os ?? Platform.OS;
    const store = opts.store ?? AsyncStorage;
    const now = opts.now ?? Date.now();
    // The Android prompt is a person reading a screen — give it time. The
    // background reads are quick or not coming.
    const timeoutMs = opts.timeoutMs ?? 60_000;

    try {
        if (os === "android") {
            // Don't put the sharing prompt in front of someone every launch.
            const asked = Number(await store.getItem(AGE_ASKED_KEY));
            if (Number.isFinite(asked) && asked > 0 && now - asked < REASK_AFTER_MS) return "unknown";

            const status = await withTimeout(api.requestAgeSignalsAccessAsync(), timeoutMs);
            if (status !== "SHARED") {
                if (status === "NOT_SHARED") await store.setItem(AGE_ASKED_KEY, String(now));
                return "unknown";
            }
            const r = await withTimeout(api.requestAgeRangeAsync({ threshold1: 13, threshold2: 18 }), 15_000);
            if (r === "timeout") return "unknown";
            return verdictFromRange(r.lowerBound, r.upperBound);
        }

        if (os === "ios") {
            const feats = await withTimeout(api.getRequiredRegulatoryFeaturesAsync(), 15_000);
            // null = older than iOS 26.4 ⇒ the answer would be the fake "18". Don't ask.
            if (feats === "timeout" || !Array.isArray(feats) || !feats.includes("declaredAgeRangeRequired")) {
                return "unknown";
            }
            const r = await withTimeout(api.requestAgeRangeAsync({ threshold1: 13, threshold2: 18 }), timeoutMs);
            if (r === "timeout") return "unknown";
            return verdictFromRange(r.lowerBound, r.upperBound);
        }
    } catch {
        return "unknown";
    }
    return "unknown";
}

/**
 * Pure: what the stored verdict should become after a fresh read.
 * "unknown" this launch does NOT erase a known answer — the OS may simply be
 * offline — but a fresh known answer always replaces the old one (a guardian
 * may have corrected the age).
 */
export function nextStoredVerdict(prev: AgeVerdict | null, fresh: AgeVerdict): AgeVerdict | null {
    return fresh === "unknown" ? prev : fresh;
}
