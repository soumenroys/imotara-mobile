// "New messages ↓" must actually land on the new message.
//
// The owner reported (2026-09-13) that the capsule "doesn't always go to last
// message". It scrolled to the bottom and then, after a FIXED 350 ms, jumped
// to the bottom a second time. The comment explained the second jump as
// landing "at the true bottom even when content size changed during the first
// scroll" — which is the right worry and the wrong instrument: 350 ms is a
// guess about how long the content keeps growing, and the things that grow
// after the tap do not respect it. A long reply's bubble reflows, the
// companion-insight and open-loop cards mount, the emotion strip lays out.
// Growth that lands at 360 ms leaves the list short with no further attempt.
//
// The fix stops guessing and lets the LIST say when it grew, via
// onContentSizeChange, for a bounded window after the tap.
//
// The first describe runs both strategies as real logic against the same
// growth timeline, so the defect is demonstrated rather than asserted about.

import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"),
    "utf8"
);

/** Code with comments stripped — assertions must not match prose. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

function fnBody(marker: string, end: string): string {
    const i = CODE.indexOf(marker);
    expect(i).toBeGreaterThan(-1);
    return CODE.slice(i, CODE.indexOf(end, i));
}

// ── The race, run as real logic ────────────────────────────────────────────

/** A content-height growth event: the height becomes `height` at time `at`. */
interface Growth { at: number; height: number }

/** Where the viewport ends up, and what the content height finished at. */
interface Outcome { landedAt: number; finalHeight: number; short: number }

/**
 * The OLD strategy: scroll now, and once more at a fixed delay.
 *
 * The animated scroll lands on whatever the height is when it completes; the
 * second, non-animated jump lands on whatever it is at `delay`. Nothing looks
 * at the content again after that.
 */
function fixedDelayStrategy(growths: Growth[], delay = 350, animationMs = 300): Outcome {
    const heightAt = (t: number) =>
        growths.filter((g) => g.at <= t).reduce((h, g) => g.height, 0);
    let landedAt = heightAt(animationMs);
    landedAt = heightAt(delay);
    const finalHeight = heightAt(Infinity);
    return { landedAt, finalHeight, short: finalHeight - landedAt };
}

/**
 * The NEW strategy: scroll now, then re-pin on every real content change
 * inside a bounded window.
 */
function pinWindowStrategy(growths: Growth[], windowMs = 1200, animationMs = 300): Outcome {
    const heightAt = (t: number) =>
        growths.filter((g) => g.at <= t).reduce((h, g) => g.height, 0);
    let landedAt = heightAt(animationMs);
    for (const g of growths) {
        if (g.at <= windowMs) landedAt = g.height; // onContentSizeChange -> scrollToEnd
    }
    const finalHeight = heightAt(Infinity);
    return { landedAt, finalHeight, short: finalHeight - landedAt };
}

describe("the race the capsule used to lose", () => {
    // A reply bubble reflows, then a card mounts just after the old deadline.
    const TIMELINE: Growth[] = [
        { at: 0, height: 4000 },
        { at: 120, height: 4400 },   // bubble reflow, inside 350ms
        { at: 360, height: 5200 },   // card mounts — 10ms past the old deadline
        { at: 500, height: 5600 },   // emotion strip lays out
    ];

    it("the fixed 350ms delay lands short of the bottom", () => {
        const out = fixedDelayStrategy(TIMELINE);
        expect(out.landedAt).toBe(4400);
        expect(out.short).toBe(1200); // 1200px of message the person never sees
    });

    it("the content-driven pin lands exactly at the bottom", () => {
        const out = pinWindowStrategy(TIMELINE);
        expect(out.landedAt).toBe(5600);
        expect(out.short).toBe(0);
    });

    it("when growth happens to finish early, BOTH land — this was never always broken", () => {
        // Which is why it is "doesn't ALWAYS go to last message" and not
        // "never". A fix that only ever helps must not be sold as one that
        // repairs something totally broken.
        const early: Growth[] = [
            { at: 0, height: 4000 },
            { at: 120, height: 4400 },
        ];
        expect(fixedDelayStrategy(early).short).toBe(0);
        expect(pinWindowStrategy(early).short).toBe(0);
    });

    it("growth beyond the window is released rather than pinned forever", () => {
        // Deliberate. Holding the list captive indefinitely would take
        // scrolling away from the person, which is worse than landing short.
        const late: Growth[] = [
            { at: 0, height: 4000 },
            { at: 9000, height: 9000 }, // a new message a long time later
        ];
        expect(pinWindowStrategy(late).landedAt).toBe(4000);
    });

    it("the pin is never worse than the fixed delay on any of these timelines", () => {
        const timelines: Growth[][] = [
            TIMELINE,
            [{ at: 0, height: 100 }],
            [{ at: 0, height: 100 }, { at: 349, height: 200 }],
            [{ at: 0, height: 100 }, { at: 351, height: 200 }],
            [{ at: 0, height: 100 }, { at: 1199, height: 900 }],
        ];
        for (const t of timelines) {
            expect(pinWindowStrategy(t).short).toBeLessThanOrEqual(fixedDelayStrategy(t).short);
        }
    });
});

// ── The wiring in ChatScreen ───────────────────────────────────────────────

describe("scrollToBottom no longer guesses", () => {
    it("it schedules no timer at all", () => {
        // The whole defect was a timer standing in for knowledge of when the
        // content stopped growing.
        const body = fnBody("const scrollToBottom = () => {", "\n  };");
        expect(body).not.toMatch(/setTimeout/);
    });

    it("it declares an intent the list can act on", () => {
        const body = fnBody("const scrollToBottom = () => {", "\n  };");
        expect(body).toMatch(/pinToBottomUntilRef\.current =/);
    });

    it("it still does the things it always did", () => {
        // Clearing the scrolled-up intent and hiding the capsule are not part
        // of the bug and must survive.
        const body = fnBody("const scrollToBottom = () => {", "\n  };");
        expect(body).toMatch(/userScrolledUpRef\.current = false/);
        expect(body).toMatch(/setShowScrollButton\(false\)/);
        expect(body).toMatch(/scrollToEnd\(\{ animated: true \}\)/);
    });
});

describe("the list drives the re-pin", () => {
    it("the message list has an onContentSizeChange handler", () => {
        // Distinct from the composer's own handleContentSizeChange, which
        // measures the input box height and has nothing to do with this.
        expect(CODE).toMatch(/onContentSizeChange=\{handleListContentSizeChange\}/);
        expect(CODE).toMatch(/const handleListContentSizeChange = /);
    });

    it("it re-pins only while the intent stands", () => {
        // Ungated, this would yank the list to the bottom on EVERY content
        // change — including while someone is reading back through history.
        const body = fnBody("const handleListContentSizeChange = ", "\n  };");
        expect(body).toMatch(/pinToBottomUntilRef\.current/);
        expect(body).toMatch(/return;/);
        expect(body).toMatch(/scrollToEnd\(\{ animated: false \}\)/);
    });

    it("the window is bounded", () => {
        expect(CODE).toMatch(/const PIN_TO_BOTTOM_MS = \d+/);
    });
});

describe("the person can always take the list back", () => {
    it("dragging cancels the pin", () => {
        // Otherwise a content change mid-drag would fight the finger.
        const drag = fnBody("onScrollBeginDrag={() => {", "}}");
        expect(drag).toMatch(/userScrolledUpRef\.current = true/);
        expect(drag).toMatch(/pinToBottomUntilRef\.current = 0/);
    });
});
