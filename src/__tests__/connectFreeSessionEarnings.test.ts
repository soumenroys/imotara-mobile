// Regression test for a 2026-08-16 bug: the companion session-history row in
// ConnectScreen.tsx (DashboardView, ~line 4059) computed the displayed
// "earned" amount as:
//   const rate = h.rate_per_min || earnings?.rate_per_min;
//   const earned = rate ? rate * h.minutes_used * 0.80 : null;
// The `||` treats a genuinely free session's rate_per_min = 0 as falsy,
// silently substituting a DIFFERENT (possibly nonzero) fallback rate instead
// of correctly showing 0 earned for a free session. Fixed to an explicit
// null/undefined check. This test locks in the fixed expression's behavior
// against the same inputs the real component branch handles — it isn't a
// full component test (ConnectScreen.tsx isn't structured for that), but it
// pins the exact boundary condition that broke.

import { describe, it, expect } from "@jest/globals";

// Mirrors the fixed expression at ConnectScreen.tsx:4058-4060 exactly.
function computeEarned(
    historyRate: number | null | undefined,
    fallbackRate: number | null | undefined,
    minutesUsed: number | null | undefined,
): number | null {
    const rate = historyRate != null ? historyRate : fallbackRate;
    return rate != null ? rate * (minutesUsed ?? 0) * 0.80 : null;
}

describe("Connect session-history earnings — free (rate=0) session display", () => {
    it("a free session (rate=0) shows 0 earned, not the fallback rate's earnings", () => {
        expect(computeEarned(0, 25, 10)).toBe(0);
    });

    it("a paid session uses its own recorded rate, not the fallback", () => {
        expect(computeEarned(15, 25, 10)).toBe(15 * 10 * 0.80);
    });

    it("a legacy row with no recorded rate falls back to the aggregate rate", () => {
        expect(computeEarned(null, 25, 10)).toBe(25 * 10 * 0.80);
        expect(computeEarned(undefined, 25, 10)).toBe(25 * 10 * 0.80);
    });

    it("no rate available anywhere yields null (hidden), not a false 0", () => {
        expect(computeEarned(null, null, 10)).toBeNull();
        expect(computeEarned(undefined, undefined, 10)).toBeNull();
    });
});
