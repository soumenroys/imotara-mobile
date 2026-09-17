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
import { featuresForTier, historyDaysForTier, type FeatureKey } from "../licensing/featureGates";

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
    it("🔴 PLUS and PREMIUM grant exactly the same features", () => {
        const onPlus = ALL_KEYS.filter((k) => featuresForTier("PLUS").has(k));
        const onPrem = ALL_KEYS.filter((k) => featuresForTier("PREMIUM").has(k));
        expect(onPlus).toEqual(onPrem);
    });

    it("🔴 the four keys PREMIUM used to hold alone are on PLUS now", () => {
        for (const k of ["HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "COMPANION_LETTER", "GROWTH_ARC"] as const) {
            expect(featuresForTier("PLUS").has(k)).toBe(true);
        }
    });

    it("the merged tier grants every key it should, and no institutional ones", () => {
        for (const k of MERGED) expect(featuresForTier("PREMIUM").has(k)).toBe(true);
        for (const k of ["MULTI_PROFILE", "CHILD_SAFE_MODE", "ADMIN_DASHBOARD"] as const) {
            expect(featuresForTier("PREMIUM").has(k)).toBe(false);
        }
    });

    it("🔴 history is unlimited on PLUS, still capped on FREE", () => {
        expect(historyDaysForTier("FREE")).toBe(7);
        expect(historyDaysForTier("PLUS")).toBe(Infinity);
        expect(historyDaysForTier("PREMIUM")).toBe(Infinity);
    });

    it("FREE is untouched by the merge", () => {
        // HISTORY_DAYS_LIMIT is a parameterized gate, never a member of a set.
        const onFree = ALL_KEYS.filter((k) => featuresForTier("FREE").has(k));
        expect(onFree).toEqual(["CLOUD_SYNC"]);
    });
});
