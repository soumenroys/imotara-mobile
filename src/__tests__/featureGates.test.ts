// Tests for the central feature-gate resolver.
//
// IMPORTANT: these tests are written to stay valid on BOTH sides of the
// SOFT_LAUNCH_BYPASS_ALL_GATES flag flip. Consumer-feature expectations branch
// on the exported flag; institutional-feature expectations are unconditional
// because the bypass must never affect them (that was a real bug: evaluating
// MULTI_PROFILE / CHILD_SAFE_MODE / ADMIN_DASHBOARD at the bypass tier PREMIUM
// silently revoked them from real FAMILY/EDU/ENTERPRISE users).

import {
    gate,
    isEnabled,
    getParam,
    SOFT_LAUNCH_BYPASS_ALL_GATES,
    INSTITUTIONAL_FEATURES,
    type LicenseTier,
    type FeatureKey,
} from "../licensing/featureGates";

const TIERS: LicenseTier[] = ["FREE", "PLUS", "PREMIUM", "FAMILY", "EDU", "ENTERPRISE"];

describe("institutional gates always follow the REAL tier (soft-launch-proof)", () => {
    test("MULTI_PROFILE: only FAMILY and ENTERPRISE", () => {
        expect(isEnabled("MULTI_PROFILE", "FAMILY")).toBe(true);
        expect(isEnabled("MULTI_PROFILE", "ENTERPRISE")).toBe(true);
        expect(isEnabled("MULTI_PROFILE", "FREE")).toBe(false);
        expect(isEnabled("MULTI_PROFILE", "PLUS")).toBe(false);
        expect(isEnabled("MULTI_PROFILE", "PREMIUM")).toBe(false);
        expect(isEnabled("MULTI_PROFILE", "EDU")).toBe(false);
    });

    test("CHILD_SAFE_MODE: only FAMILY, EDU, ENTERPRISE", () => {
        expect(isEnabled("CHILD_SAFE_MODE", "FAMILY")).toBe(true);
        expect(isEnabled("CHILD_SAFE_MODE", "EDU")).toBe(true);
        expect(isEnabled("CHILD_SAFE_MODE", "ENTERPRISE")).toBe(true);
        expect(isEnabled("CHILD_SAFE_MODE", "FREE")).toBe(false);
        expect(isEnabled("CHILD_SAFE_MODE", "PLUS")).toBe(false);
        expect(isEnabled("CHILD_SAFE_MODE", "PREMIUM")).toBe(false);
    });

    test("ADMIN_DASHBOARD: only EDU and ENTERPRISE", () => {
        expect(isEnabled("ADMIN_DASHBOARD", "EDU")).toBe(true);
        expect(isEnabled("ADMIN_DASHBOARD", "ENTERPRISE")).toBe(true);
        expect(isEnabled("ADMIN_DASHBOARD", "FAMILY")).toBe(false);
        expect(isEnabled("ADMIN_DASHBOARD", "FREE")).toBe(false);
        expect(isEnabled("ADMIN_DASHBOARD", "PREMIUM")).toBe(false);
    });

    test("undefined/null tier is treated as FREE for institutional gates", () => {
        for (const f of INSTITUTIONAL_FEATURES) {
            expect(isEnabled(f, undefined)).toBe(false);
            expect(isEnabled(f, null)).toBe(false);
        }
    });

    test("disabled institutional gates carry a human-readable reason", () => {
        const g = gate("ADMIN_DASHBOARD", "FREE");
        expect(g.enabled).toBe(false);
        if (!g.enabled) {
            expect(typeof g.reason).toBe("string");
            expect(g.reason!.length).toBeGreaterThan(0);
        }
    });
});

describe("consumer gates", () => {
    if (SOFT_LAUNCH_BYPASS_ALL_GATES) {
        // ── Soft launch is ON: everyone gets the PREMIUM consumer experience ──
        test("soft launch: every tier (and no tier) gets Pro consumer features", () => {
            const consumerProFeatures: FeatureKey[] = [
                "CLOUD_SYNC",
                "HISTORY_UNLIMITED",
                "TRENDS_INSIGHTS",
                "EXPORT_DATA",
                "TTS_ADVANCED",
                "SEARCH_MODE",
                "REPLY_CADENCE",
                "COMPANION_LETTER",
                "GROWTH_ARC",
            ];
            for (const f of consumerProFeatures) {
                for (const t of TIERS) expect(isEnabled(f, t)).toBe(true);
                expect(isEnabled(f, undefined)).toBe(true);
                expect(isEnabled(f, null)).toBe(true);
            }
        });

        test("soft launch: history is unlimited for everyone", () => {
            expect(getParam<number>("HISTORY_DAYS_LIMIT", "FREE", "days")).toBe(Infinity);
            expect(getParam<number>("HISTORY_DAYS_LIMIT", undefined, "days")).toBe(Infinity);
        });
    } else {
        // ── Real enforcement (flag flipped off) ──
        test("FREE: cloud sync only, 7-day history", () => {
            expect(isEnabled("CLOUD_SYNC", "FREE")).toBe(true);
            expect(isEnabled("TTS_ADVANCED", "FREE")).toBe(false);
            expect(isEnabled("COMPANION_LETTER", "FREE")).toBe(false);
            expect(isEnabled("HISTORY_UNLIMITED", "FREE")).toBe(false);
            expect(getParam<number>("HISTORY_DAYS_LIMIT", "FREE", "days")).toBe(7);
        });

        test("PLUS: Plus features but not Pro narrative features, 90-day history", () => {
            expect(isEnabled("TTS_ADVANCED", "PLUS")).toBe(true);
            expect(isEnabled("SEARCH_MODE", "PLUS")).toBe(true);
            expect(isEnabled("EXPORT_DATA", "PLUS")).toBe(true);
            expect(isEnabled("COMPANION_LETTER", "PLUS")).toBe(false);
            expect(isEnabled("GROWTH_ARC", "PLUS")).toBe(false);
            expect(isEnabled("TRENDS_INSIGHTS", "PLUS")).toBe(false);
            expect(getParam<number>("HISTORY_DAYS_LIMIT", "PLUS", "days")).toBe(90);
        });

        test("PREMIUM: full consumer set, unlimited history", () => {
            expect(isEnabled("COMPANION_LETTER", "PREMIUM")).toBe(true);
            expect(isEnabled("GROWTH_ARC", "PREMIUM")).toBe(true);
            expect(getParam<number>("HISTORY_DAYS_LIMIT", "PREMIUM", "days")).toBe(Infinity);
        });

        test("FAMILY: no data export (shared-device privacy boundary)", () => {
            expect(isEnabled("EXPORT_DATA", "FAMILY")).toBe(false);
        });

        test("EDU: no individual narrative features or individual export", () => {
            expect(isEnabled("COMPANION_LETTER", "EDU")).toBe(false);
            expect(isEnabled("GROWTH_ARC", "EDU")).toBe(false);
            expect(isEnabled("EXPORT_DATA", "EDU")).toBe(false);
        });

        test("undefined tier falls back to FREE", () => {
            expect(isEnabled("TTS_ADVANCED", undefined)).toBe(false);
            expect(getParam<number>("HISTORY_DAYS_LIMIT", undefined, "days")).toBe(7);
        });
    }
});

describe("gate() result shape", () => {
    test("HISTORY_DAYS_LIMIT is always an enabled parameterized gate", () => {
        for (const t of TIERS) {
            const g = gate("HISTORY_DAYS_LIMIT", t);
            expect(g.enabled).toBe(true);
            if (g.enabled) {
                expect(typeof g.params?.days).toBe("number");
            }
        }
    });

    test("getParam returns undefined for a disabled gate", () => {
        // ADMIN_DASHBOARD is disabled on FREE regardless of soft launch.
        expect(getParam("ADMIN_DASHBOARD", "FREE", "anything")).toBeUndefined();
    });
});
