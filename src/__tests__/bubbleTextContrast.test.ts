// The timestamp and the "part of your Emotion History" note sit INSIDE a chat
// bubble, and chat bubbles here are barely opaque — the user bubble is sky at
// 35%, bot bubbles are a mood tint at 12-26%. So this text is read against
// whatever is behind the bubble, not against a solid surface.
//
// They used colors.textSecondary, which already carries alpha 0.9, and then
// applied a further opacity of 0.85 / 0.9 on top. Measured worst case: 2.68:1
// in dark and 3.08:1 in light, against a WCAG AA requirement of 4.5:1 for body
// text. Nobody reported it; it was found while measuring something else.
//
// This reads the real palette and the real bubble alphas, so it fails if either
// moves — including if a relationship backdrop is ever made bolder.

import { DARK, LIGHT } from "../theme/colors";
import { chatBackdrop, RELATIONSHIP_HUES, luminance } from "../theme/chatBackdrop";
import fs from "fs";
import path from "path";

const chat = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");

const parse = (c: string): number[] => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) return m[1].split(",").map((x) => parseFloat(x.trim())).slice(0, 3);
    const h = c.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const over = (fg: readonly number[], a: number, bg: readonly number[]) =>
    fg.map((c, i) => a * c + (1 - a) * bg[i]);
const contrast = (a: readonly number[], b: readonly number[]) => {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Real bubble surfaces, over every backdrop the chat can have. */
function everySurface(theme: "dark" | "light") {
    const p = theme === "dark" ? DARK : LIGHT;
    const rels = ["__plain__", ...Object.keys(RELATIONSHIP_HUES)
        .filter((r) => RELATIONSHIP_HUES[r as keyof typeof RELATIONSHIP_HUES] != null)];
    const out: number[][] = [];
    for (const rel of rels) {
        const bd = parse(chatBackdrop(rel === "__plain__" ? null : rel, theme, rel !== "__plain__"));
        out.push(over([56, 189, 248], 0.35, bd));                    // user bubble
        for (const t of [p.emotionNeutral, p.emotionSad, p.emotionAngry].map(parse)) {
            for (const a of [0.12, 0.26]) out.push(over(t, a, bd));  // bot bubble gradient
        }
    }
    return out;
}

const MUTED_OPACITY = 0.7;

describe("muted text inside a bubble meets AA", () => {
    for (const theme of ["dark", "light"] as const) {
        it(`${theme}: on every bubble surface, over every backdrop`, () => {
            const fg = parse((theme === "dark" ? DARK : LIGHT).textPrimary);
            let worst = Infinity;
            for (const surface of everySurface(theme)) {
                worst = Math.min(worst, contrast(over(fg, MUTED_OPACITY, surface), surface));
            }
            expect({ theme, worst: +worst.toFixed(2) })
                .toEqual(expect.objectContaining({ worst: expect.any(Number) }));
            expect(worst).toBeGreaterThanOrEqual(4.5);
        });
    }

    it("textSecondary would still fail, which is why it is not used here", () => {
        // Guards against someone "tidying" this back to the semantic-looking token.
        for (const theme of ["dark", "light"] as const) {
            const p = theme === "dark" ? DARK : LIGHT;
            const sec = parse(p.textSecondary);
            let worst = Infinity;
            for (const surface of everySurface(theme)) {
                // textSecondary's own alpha 0.9, times the old 0.85 opacity
                worst = Math.min(worst, contrast(over(sec, 0.9 * 0.85, surface), surface));
            }
            expect(worst).toBeLessThan(4.5);
        }
    });
});

describe("the screen actually uses it", () => {
    it("the timestamp uses textPrimary at 0.7, not textSecondary", () => {
        expect(chat).toMatch(
            /fontSize: 11, color: colors\.textPrimary, marginTop: 4, opacity: 0\.7 \}\}>\s*\n\s*\{new Date\(message\.timestamp\)/);
    });

    it("the continuity note does too", () => {
        const note = chat.slice(chat.indexOf("showContinuityNote && ("));
        expect(note.slice(0, 260)).toMatch(/color: colors\.textPrimary, marginTop: 6, opacity: 0\.7/);
        expect(note.slice(0, 260)).toContain("Emotion History");
    });

    it("0.65 is not quietly substituted — it measures 4.50 in dark", () => {
        const fg = parse(DARK.textPrimary);
        let worst = Infinity;
        for (const surface of everySurface("dark")) {
            worst = Math.min(worst, contrast(over(fg, 0.65, surface), surface));
        }
        expect(worst).toBeLessThan(4.6); // too close to the line to rely on
    });
});
