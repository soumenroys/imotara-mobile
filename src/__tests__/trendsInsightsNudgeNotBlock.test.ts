/**
 * On mobile too, emotion insights are a PREVIEW with an upsell — never a block.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-09-27, `TrendsScreen.tsx` referenced
 * `TRENDS_INSIGHTS` NOWHERE. The key existed only inside `featureGates.ts`, so
 * mobile rendered the radar and heatmap to everyone with **no upsell at all**.
 * A free mobile user got a paid feature and was never told it was one — and
 * with enforcement now live on mobile, that was the last surface still silent.
 *
 * Web had shown a nudge since the decision; mobile had not. This is the other
 * half, and this test is what stops the two drifting again.
 *
 * 🔑 IT PINS BOTH DIRECTIONS, and both matter:
 *
 *   1. The nudge must EXIST — otherwise we are back to a silent paid feature.
 *   2. The charts must NOT be blocked — free plans are meant to SEE them
 *      (owner decision, 2026-09-26). The preview IS the upsell; withholding
 *      the data removes the only way a free user discovers the feature. The
 *      tutorial agrees: those cards read `free: "Preview"`, not `free: false`.
 *
 * Direction 2 is the one at risk. Every OTHER gate in the product blocks, so
 * this asymmetry reads like an oversight and invites a well-meaning "fix" —
 * which is exactly what nearly happened on the web side on 2026-09-26.
 *
 * ⚠️ Deliberately a SOURCE test. Rendering TrendsScreen needs charts, navigation
 * and a settings provider; what must hold is a property of the code, and a
 * source assertion states it without a fragile render harness.
 */
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "screens", "TrendsScreen.tsx"), "utf8",
);

describe("mobile Trends — TRENDS_INSIGHTS is nudged, not blocked", () => {
    it("asks the gate about TRENDS_INSIGHTS at all", () => {
        // The original bug was the total absence of this.
        expect(SRC).toContain('gate("TRENDS_INSIGHTS"');
    });

    it("shows an upgrade nudge to plans that lack it", () => {
        expect(SRC).toMatch(/!gate\("TRENDS_INSIGHTS",\s*licenseTier\)\.enabled/);
        expect(SRC).toMatch(/Imotara Plus/);
        expect(SRC).toMatch(/preview/i);
    });

    it("🔴 does NOT hide the charts behind the gate", () => {
        // The radar must render on its own data condition, NOT on the gate.
        // If someone wraps it in `gate(...).enabled &&`, this fails — which is
        // the point: that change would look like a fix and be a regression.
        const radar = SRC.slice(SRC.indexOf("{/* Emotion radar chart */}"));
        const guard = radar.slice(0, 200);
        expect(guard).toContain("sorted.length > 0");
        expect(guard).not.toMatch(/gate\("TRENDS_INSIGHTS"[^)]*\)\.enabled\s*&&/);
    });

    it("the nudge leads somewhere a user can actually upgrade", () => {
        // A prompt that goes nowhere is worse than no prompt.
        const idx = SRC.indexOf('gate("TRENDS_INSIGHTS"');
        expect(idx).toBeGreaterThan(-1);
        expect(SRC.slice(idx, idx + 900)).toMatch(/navigation\.navigate\(\s*["']Settings["']/);
    });
});
