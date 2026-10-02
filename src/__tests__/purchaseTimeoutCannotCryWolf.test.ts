/**
 * The purchase safety-net timer must never tell a paying user it failed.
 *
 * 🔴 WHY THIS EXISTS — observed on a device, on the FIRST real Play purchase this
 * app has ever had, 2026-10-02:
 *
 *     ~16:29:45  user taps the pack        → 60 s timer starts
 *      16:30:45  timer fires → "Your purchase may have been received…"
 *      16:30:51  purchase actually returns          ← 6 s LATER
 *      16:30:54  server verified, consumed, "Credits added!"
 *
 * The user was told their purchase might have failed **six seconds before it
 * succeeded**, and then congratulated moments later. iOS was worse: 40 s.
 *
 * ⚠️ THE WINDOW IS NOT OURS. Between `requestPurchase()` and the callback the
 * user is inside Google's or Apple's sheet — reading it, typing a card, clearing
 * 3-D Secure, waiting on a bank OTP, doing Face ID. Minutes are ordinary.
 *
 * 🔴 AND A SECOND, WORSE FAULT: `onPurchaseSuccess` sets
 * `purchaseOutcomeHandledRef` immediately, then awaits server verification (up
 * to 30 s), and only clears the timer in its `finally`. So the timer could fire
 * **during a successful verification**. The gate check is what stops that, and
 * it matters independently of how long the bound is.
 *
 * 🔑 Same family as `c7e8a58` and `df5547a`: telling someone who just paid, or
 * just signed in, that something went wrong. On a payments screen a false alarm
 * is a refund request.
 *
 * ⚠️ SOURCE TEST ON PURPOSE. Driving this for real needs expo-iap, a live Play
 * sheet and a 5-minute wall clock. What must hold is a property of the code.
 */
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "components", "imotara", "UpgradeSheet.tsx"), "utf8",
);
/** Comments here quote the very patterns being pinned — strip them first. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("🔴 the timer never fires on a purchase already in flight", () => {
    it("both platforms check the outcome gate before alerting", () => {
        // Two call sites: Android (requestPurchase) and iOS (handleIosPurchase).
        const guards = CODE.match(/if \(purchaseOutcomeHandledRef\.current\) return;\s*\n\s*setPurchasing\(null\);/g) ?? [];
        expect(guards.length).toBe(2);
    });

    it("🔴 the guard sits BEFORE the alert, not after it", () => {
        // After the alert it would be useless — the user has already seen it.
        // ⚠️ Anchor on `purchaseTimeoutRef.current = setTimeout(`, NOT on a bare
        // `setTimeout(`. A loose pattern matched from an unrelated timer earlier
        // in the file and spanned hundreds of lines — the first version of this
        // test failed for that reason, not because the code was wrong.
        const sites = CODE.matchAll(
            /purchaseTimeoutRef\.current = setTimeout\(\(\) => \{([\s\S]*?)\}, PURCHASE_TIMEOUT_MS\)/g,
        );
        let n = 0;
        for (const m of sites) {
            n += 1;
            const body = m[1];
            const gate = body.indexOf("purchaseOutcomeHandledRef.current");
            const alert = body.indexOf("Alert.alert");
            expect(gate).toBeGreaterThan(-1);
            expect(alert).toBeGreaterThan(-1);
            expect(gate).toBeLessThan(alert);
        }
        expect(n).toBe(2);   // both platforms, not one
    });
});

describe("⚠️ the bound is generous, and shared", () => {
    it("one constant, used by both platforms — they cannot drift apart", () => {
        expect(CODE).toMatch(/const PURCHASE_TIMEOUT_MS = 300_000;/);
        const uses = CODE.match(/\}, PURCHASE_TIMEOUT_MS\)/g) ?? [];
        expect(uses.length).toBe(2);
    });

    it("🔴 the old hard-coded 60 s / 40 s bounds are gone", () => {
        // iOS was 40 s — shorter than Android — on a flow that includes Face ID
        // and an App Store password prompt.
        expect(CODE).not.toMatch(/\}, 60_000\)/);
        expect(CODE).not.toMatch(/\}, 40_000\)/);
    });

    it("🔑 it is at least 3 minutes — a bank OTP alone can take that", () => {
        const m = CODE.match(/const PURCHASE_TIMEOUT_MS = ([\d_]+);/);
        expect(m).not.toBeNull();
        expect(Number(m![1].replace(/_/g, ""))).toBeGreaterThanOrEqual(180_000);
    });

    it("⚠️ but it still EXISTS — a missing callback must not spin forever", () => {
        // Deleting the net would be the opposite bug: GMS absent, or the sheet
        // dismissed with no event, and the spinner never stops.
        expect(CODE).toMatch(/purchaseTimeoutRef\.current = setTimeout\(/);
        expect(CODE).toMatch(/Taking longer than expected/);
    });
});
