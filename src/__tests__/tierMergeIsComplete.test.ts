/**
 * PLUS and PREMIUM are ONE tier. Nothing may quietly un-merge them.
 *
 * 🔴 WHY THIS EXISTS. Before L10, PLUS was missing four keys PREMIUM had:
 * HISTORY_UNLIMITED, TRENDS_INSIGHTS, COMPANION_LETTER, GROWTH_ARC. Both now
 * read one array — two lists that happen to agree is the pattern that made
 * Family licences unissuable on web.
 *
 * ⚠️ The nine keys below are duplicated in imotaraapp's tierMergeIsComplete
 * test ON PURPOSE. Two repos cannot import each other; this pair is the seam.
 * A merge applied on one side only fails on the other.
 *
 * ⚠️ PLUS is kept as the LEGACY id, not deleted — one ₹99 subscriber is on it,
 * and "PLUS" is written into AsyncStorage on devices. They get the merged
 * tier's features at their old price.
 */
import {
    featuresForTier, historyDaysForTier, isLicenseTier, fromWebTier,
    normaliseTier, prettyTier, gate, TIER_ORDER, type FeatureKey,
} from "../licensing/featureGates";

const MERGED = [
    "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "EXPORT_DATA",
    "TTS_ADVANCED", "SEARCH_MODE", "REPLY_CADENCE", "COMPANION_LETTER", "GROWTH_ARC",
] as const;

const ALL_KEYS: FeatureKey[] = [
    "CLOUD_SYNC", "HISTORY_UNLIMITED", "HISTORY_DAYS_LIMIT", "TRENDS_INSIGHTS",
    "EXPORT_DATA", "MULTI_PROFILE", "CHILD_SAFE_MODE", "ADMIN_DASHBOARD",
    "TTS_ADVANCED", "SEARCH_MODE", "REPLY_CADENCE", "COMPANION_LETTER", "GROWTH_ARC",
];

// 🔴 featuresForTier, NOT gate(). gate() bypasses to PREMIUM during soft
// launch, so a test written against it would pass no matter how wrong the sets
// were — every tier would look identical.
describe("the PLUS/PREMIUM merge", () => {
    it("🔴 the legacy ids still resolve to the paid tier", () => {
        // PREMIUM is not a tier any more — it is an alias. It is also written
        // into AsyncStorage on every device installed before 2026-09-17, so if
        // it ever stopped resolving, every existing paid user would drop to
        // FREE and only a store release could fix it.
        expect(normaliseTier("PREMIUM")).toBe("PLUS");
        expect(normaliseTier("premium")).toBe("PLUS");
        expect(normaliseTier("pro")).toBe("PLUS");   // the web spelling
        expect(normaliseTier("plus")).toBe("PLUS");
        expect(prettyTier("PREMIUM")).toBe("Plus");
        // Unknown input must never land on a paid tier.
        for (const bad of ["", "gold", null, undefined, 7]) expect(normaliseTier(bad)).toBe("FREE");
    });

    it("🔴 the four keys PREMIUM used to hold alone are on PLUS now", () => {
        for (const k of ["HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "COMPANION_LETTER", "GROWTH_ARC"] as const) {
            expect(featuresForTier("PLUS").has(k)).toBe(true);
        }
    });

    it("the merged tier grants every key it should, and no institutional ones", () => {
        for (const k of MERGED) expect(featuresForTier("PLUS").has(k)).toBe(true);
        for (const k of ["MULTI_PROFILE", "CHILD_SAFE_MODE", "ADMIN_DASHBOARD"] as const) {
            expect(featuresForTier("PLUS").has(k)).toBe(false);
        }
    });

    it("🔴 gate() itself accepts a legacy stored value", () => {
        // The call sites read AsyncStorage. If gate() did not normalise, a
        // device holding "PREMIUM" would index ALL[] as undefined and be
        // granted nothing — the exact silent failure this rename risked.
        expect(gate("HISTORY_UNLIMITED", "PREMIUM").enabled).toBe(true);
        expect(gate("TRENDS_INSIGHTS", "pro").enabled).toBe(true);
    });

    it("🔴 history is unlimited on PLUS, still capped on FREE", () => {
        expect(historyDaysForTier("FREE")).toBe(7);
        expect(historyDaysForTier("PLUS")).toBe(Infinity);
        expect(historyDaysForTier("PLUS")).toBe(Infinity);
    });

    it("FREE is untouched by the merge", () => {
        // HISTORY_DAYS_LIMIT is a parameterized gate, never a member of a set.
        const onFree = ALL_KEYS.filter((k) => featuresForTier("FREE").has(k));
        expect(onFree).toEqual(["CLOUD_SYNC"]);
    });

    it("🔴 PLUS is canonical, and PREMIUM is no longer a tier", () => {
        // The temptation after a merge is to delete the redundant tier. On
        // mobile it is the worst possible one to delete:
        //   · "PLUS" is written into AsyncStorage on installed devices
        //   · isLicenseTier() would reject it, so those devices fall to FREE
        //   · the fix would need a store release, and users who never update
        //     would stay broken permanently
        expect([...TIER_ORDER]).toEqual(["FREE", "PLUS", "FAMILY", "EDU", "ENTERPRISE"]);
        expect([...TIER_ORDER]).not.toContain("PREMIUM");
        expect(featuresForTier("PLUS").has("HISTORY_UNLIMITED")).toBe(true);
        expect(isLicenseTier("PLUS")).toBe(true);
        expect(fromWebTier("plus")).toBe("PLUS");
    });
});
