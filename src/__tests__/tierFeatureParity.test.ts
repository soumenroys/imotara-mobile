/**
 * What each tier grants is the SAME on mobile and web.
 *
 * 🔴 WHY THIS EXISTS. `ALL` here and `TIER_FEATURES` in imotaraapp's
 * `src/lib/imotara/featureGates.ts` are two hand-maintained copies of the same
 * table. They were verified identical on 2026-09-25 — and NOTHING held them
 * that way. `licensingTermsMatchMobile` pins the tier LABELS; the feature sets
 * had no guard at all. Mobile could drop EXPORT_DATA from PLUS and every test
 * in both repos would still pass.
 *
 * 🔑 That is precisely the drift that made FAMILY LICENCES UNISSUABLE (L1):
 * "two lists that happen to agree". Prices got a cross-repo pin
 * (pricingCatalog.test.ts); features never did.
 *
 * ⚠️ AGREED_FEATURES below is duplicated in imotaraapp's copy of this test ON
 * PURPOSE. Two repos cannot import each other, so that duplicated literal is
 * the only thing that catches a change applied to one side alone. Edit both, in
 * the same pass, in the same release.
 *
 * 🔑 IT ASSERTS AGAINST `featuresForTier`, NOT `gate()`. `gate()` bypasses to
 * PREMIUM while SOFT_LAUNCH_BYPASS_ALL_GATES is true, which makes every tier
 * look identical — a test written against it would pass no matter how wrong the
 * table was.
 *
 * ⏰ Latent while nothing is enforced. The day enforcement flips, any drift
 * becomes a user-visible difference between platforms — someone paying the same
 * money getting different features on their phone and their laptop.
 */
import { TIER_ORDER, featuresForTier, historyDaysForTier } from "../licensing/featureGates";

/**
 * ⚠️ DUPLICATED IN imotaraapp/src/__tests__/tierFeatureParity.test.ts.
 * That copy keys by the WEB spellings (lowercase); these are the mobile ones.
 */
const AGREED_FEATURES: Record<string, readonly string[]> = {
    FREE: ["CLOUD_SYNC"],
    PLUS: [
        "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "EXPORT_DATA",
        "TTS_ADVANCED", "SEARCH_MODE", "REPLY_CADENCE",
        "COMPANION_LETTER", "GROWTH_ARC",
    ],
    FAMILY: [
        "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS",
        "MULTI_PROFILE", "CHILD_SAFE_MODE", "TTS_ADVANCED", "SEARCH_MODE",
        "REPLY_CADENCE", "COMPANION_LETTER", "GROWTH_ARC",
    ],
    EDU: [
        "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "ADMIN_DASHBOARD",
        "CHILD_SAFE_MODE", "TTS_ADVANCED", "SEARCH_MODE", "REPLY_CADENCE",
    ],
    ENTERPRISE: [
        "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "EXPORT_DATA",
        "ADMIN_DASHBOARD", "CHILD_SAFE_MODE", "MULTI_PROFILE", "TTS_ADVANCED",
        "SEARCH_MODE", "REPLY_CADENCE", "COMPANION_LETTER", "GROWTH_ARC",
    ],
};

/** ⚠️ Also duplicated in web's copy. */
const AGREED_HISTORY_DAYS: Record<string, number> = {
    FREE: 7, PLUS: Infinity, FAMILY: Infinity, EDU: Infinity, ENTERPRISE: Infinity,
};

describe("🔴 tier → features matches web", () => {
    it.each(TIER_ORDER.map((t) => [t] as const))("%s grants exactly the agreed set", (tier) => {
        expect([...featuresForTier(tier)].sort()).toEqual([...AGREED_FEATURES[tier]].sort());
    });

    it("every tier in TIER_ORDER is covered — a new tier cannot slip through unpinned", () => {
        expect(Object.keys(AGREED_FEATURES).sort()).toEqual([...TIER_ORDER].sort());
    });
});

describe("🔴 history retention matches web", () => {
    it.each(TIER_ORDER.map((t) => [t] as const))("%s", (tier) => {
        expect(historyDaysForTier(tier)).toBe(AGREED_HISTORY_DAYS[tier]);
    });
});

describe("the invariants behind the table", () => {
    it("FREE grants CLOUD_SYNC and nothing else", () => {
        expect([...featuresForTier("FREE")]).toEqual(["CLOUD_SYNC"]);
    });

    it("every paid tier is a strict superset of FREE", () => {
        const free = featuresForTier("FREE");
        for (const tier of TIER_ORDER.filter((t) => t !== "FREE")) {
            for (const f of free) {
                expect([...featuresForTier(tier)]).toContain(f);
            }
        }
    });

    it("🔑 ADMIN_DASHBOARD belongs to institutions only", () => {
        for (const tier of ["FREE", "PLUS", "FAMILY"] as const) {
            expect([...featuresForTier(tier)]).not.toContain("ADMIN_DASHBOARD");
        }
        for (const tier of ["EDU", "ENTERPRISE"] as const) {
            expect([...featuresForTier(tier)]).toContain("ADMIN_DASHBOARD");
        }
    });

    it("🔑 EXPORT_DATA is off for FAMILY and EDU, on purpose", () => {
        expect([...featuresForTier("FAMILY")]).not.toContain("EXPORT_DATA");
        expect([...featuresForTier("EDU")]).not.toContain("EXPORT_DATA");
    });

    it("🔑 the assertion is bypass-free — gate() would hide every difference", () => {
        const { gate, SOFT_LAUNCH_BYPASS_ALL_GATES } = require("../licensing/featureGates");
        if (SOFT_LAUNCH_BYPASS_ALL_GATES) {
            // Proof the bypass is real: FREE "has" a paid feature through gate()
            // but not through featuresForTier(). This test asserts on the latter.
            expect(gate("EXPORT_DATA", "FREE").enabled).toBe(true);
            expect([...featuresForTier("FREE")]).not.toContain("EXPORT_DATA");
        }
    });
});
