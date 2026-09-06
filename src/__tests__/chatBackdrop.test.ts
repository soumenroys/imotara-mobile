// The relationship backdrop sits behind the message list — and because bubbles
// here are only 12–35% opaque, it is what message text is actually read
// against, not decoration underneath it. A tint that looks pleasant in a
// mockup can quietly take the timestamp on a bot bubble below AA, the same way
// the hardcoded dark search bar did to the search field in light mode.
//
// So this measures rather than trusts. The gate is deliberately not "every
// pair reaches 4.5" — several pairs are ALREADY below that with no backdrop at
// all (textSecondary on a user bubble is 3.02:1 in dark today, and that is a
// pre-existing problem this feature has no business either causing or hiding).
// The gate is: nothing that passes AA today may fail with a backdrop on.
//
// That is what the luminance-matching in chatBackdrop.ts buys, and this is the
// test that decides whether LUMINANCE_FACTOR is still safe.

import { DARK, LIGHT } from "../theme/colors";
import {
    chatBackdrop, hasBackdrop, luminance,
    RELATIONSHIP_HUES, LUMINANCE_FACTOR, CHANNEL_SPREAD, type ChatRelationship,
} from "../theme/chatBackdrop";

// Real values from ChatScreen: USER_BUBBLE_BG, and getMoodGradient()'s
// start/end alphas (toRgba REPLACES the tint's own alpha, so these are the
// effective ones). If those change, these should change with them.
const USER_BUBBLE = { rgb: [56, 189, 248] as const, alpha: 0.35 };
const BOT_BUBBLE_ALPHAS = [0.12, 0.26];

function parse(c: string): [number, number, number] {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) {
        const p = m[1].split(",").map((x) => parseFloat(x.trim()));
        return [p[0], p[1], p[2]];
    }
    const h = c.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const over = (fg: readonly number[], a: number, bg: readonly number[]) =>
    fg.map((c, i) => a * c + (1 - a) * bg[i]);
const contrast = (a: readonly number[], b: readonly number[]) => {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const ALL = Object.keys(RELATIONSHIP_HUES) as ChatRelationship[];
const TINTED = ALL.filter((r) => RELATIONSHIP_HUES[r] != null);
const THEMES = ["dark", "light"] as const;

/** Every surface message text is read against, for a given backdrop. */
function surfaces(backdrop: string, themeMode: "dark" | "light") {
    const bd = parse(backdrop);
    const palette = themeMode === "dark" ? DARK : LIGHT;
    const moodTints = [palette.emotionNeutral, palette.emotionSad, palette.emotionAngry].map(parse);
    const out: { name: string; rgb: number[] }[] = [
        { name: "bare backdrop", rgb: bd },
        { name: "user bubble", rgb: over(USER_BUBBLE.rgb, USER_BUBBLE.alpha, bd) },
    ];
    moodTints.forEach((t, i) => {
        for (const a of BOT_BUBBLE_ALPHAS) out.push({ name: `bot bubble ${i} a=${a}`, rgb: over(t, a, bd) });
    });
    return out;
}

/** The text roles that actually render inside a bubble, with their opacities. */
function roles(themeMode: "dark" | "light") {
    const p = themeMode === "dark" ? DARK : LIGHT;
    const bg = parse(p.background);
    return {
        body: parse(p.textPrimary),                            // message text
        speaker: over(parse(p.textPrimary), 0.75, bg),         // "You" / companion name
        timestamp: over(parse(p.textSecondary), 0.9, bg),      // time + sync note
    };
}

describe("no backdrop takes readable text below AA", () => {
    for (const themeMode of THEMES) {
        it(`${themeMode}: nothing that passes today fails with a backdrop`, () => {
            const plain = surfaces(chatBackdrop(null, themeMode, false), themeMode);
            const r = roles(themeMode);
            const regressions: string[] = [];

            for (const rel of TINTED) {
                const tinted = surfaces(chatBackdrop(rel, themeMode, true), themeMode);
                plain.forEach((p, i) => {
                    for (const [role, fg] of Object.entries(r)) {
                        const before = contrast(fg, p.rgb);
                        const after = contrast(fg, tinted[i].rgb);
                        if (before >= 4.5 && after < 4.5) {
                            regressions.push(
                                `${rel} / ${p.name} / ${role}: ${before.toFixed(2)} -> ${after.toFixed(2)}`);
                        }
                    }
                });
            }
            expect(regressions).toEqual([]);
        });

        // Measured in relative terms on purpose. An absolute bound is
        // meaningless at the top of the range — body text on a light backdrop
        // is 17:1, and moving it to 16.5:1 changes nothing anyone can see —
        // while at the bottom, where AA lives, a 5% move is the whole margin.
        it(`${themeMode}: no pair's contrast moves by more than 6%`, () => {
            const plain = surfaces(chatBackdrop(null, themeMode, false), themeMode);
            const r = roles(themeMode);
            let worst = 1, where = "";
            for (const rel of TINTED) {
                const tinted = surfaces(chatBackdrop(rel, themeMode, true), themeMode);
                plain.forEach((p, i) => {
                    for (const [role, fg] of Object.entries(r)) {
                        const before = contrast(fg, p.rgb);
                        const after = contrast(fg, tinted[i].rgb);
                        const change = Math.min(after / before, before / after);
                        if (change < worst) { worst = change; where = `${rel}/${p.name}/${role} ${before.toFixed(2)}->${after.toFixed(2)}`; }
                    }
                });
            }
            expect({ movedBy: `${((1 - worst) * 100).toFixed(2)}%`, where })
                .toEqual(expect.objectContaining({ where: expect.any(String) }));
            expect(1 - worst).toBeLessThan(0.06);
        });

        it(`${themeMode}: every backdrop is built to the same brightness`, () => {
            const base = luminance(parse(themeMode === "dark" ? DARK.background : LIGHT.background));
            for (const rel of TINTED) {
                const l = luminance(parse(chatBackdrop(rel, themeMode, true)));
                // Loose on purpose. In dark mode the backdrops land on values
                // like rgb(0, 20, 17), where rounding to whole channels is a
                // big fraction of the value, so the ratio wobbles either side
                // of the target. The real guarantee is the AA test above; this
                // only catches a relationship escaping the construction
                // entirely and coming out visibly brighter or darker.
                expect(Math.abs(l / base - LUMINANCE_FACTOR[themeMode])).toBeLessThan(0.2);
            }
        });

        it(`${themeMode}: every backdrop is built to the same colourfulness`, () => {
            for (const rel of TINTED) {
                const bd = parse(chatBackdrop(rel, themeMode, true));
                const spread = Math.max(...bd) - Math.min(...bd);
                expect(Math.abs(spread - CHANNEL_SPREAD[themeMode])).toBeLessThanOrEqual(2);
            }
        });
    }
});

describe("the backdrops are actually visible and actually different", () => {
    for (const themeMode of THEMES) {
        it(`${themeMode}: each backdrop differs from the plain background`, () => {
            const base = parse(themeMode === "dark" ? DARK.background : LIGHT.background);
            for (const rel of TINTED) {
                const bd = parse(chatBackdrop(rel, themeMode, true));
                const shift = Math.max(...bd.map((v, i) => Math.abs(v - base[i])));
                // Under ~5 and it is indistinguishable from the plain screen —
                // a feature nobody can see is a feature that does not exist.
                expect(shift).toBeGreaterThanOrEqual(5);
            }
        });

        // Nobody ever sees two of these at once — you have one relationship at
        // a time — so the bar that matters is "differs from the plain screen",
        // above. This only catches two relationships collapsing onto the same
        // colour, which would mean a hue was duplicated by mistake.
        it(`${themeMode}: no two relationships resolve to the same backdrop`, () => {
            const all = TINTED.map((r) => chatBackdrop(r, themeMode, true));
            expect(new Set(all).size).toBe(all.length);
        });
    }
});

describe("nothing changes unless it was asked for", () => {
    for (const themeMode of THEMES) {
        const base = themeMode === "dark" ? DARK.background : LIGHT.background;

        it(`${themeMode}: setting off returns today's background, unchanged`, () => {
            for (const rel of ALL) expect(chatBackdrop(rel, themeMode, false)).toBe(base);
        });
        it(`${themeMode}: no relationship, or "prefer not", returns today's background`, () => {
            for (const rel of [null, undefined, "", "prefer_not"]) {
                expect(chatBackdrop(rel, themeMode, true)).toBe(base);
            }
        });
        it(`${themeMode}: an unrecognised relationship falls back rather than throwing`, () => {
            expect(chatBackdrop("something_added_later", themeMode, true)).toBe(base);
        });
    }

    it("hasBackdrop agrees with what chatBackdrop actually does", () => {
        for (const rel of [...ALL, "unknown", null, ""]) {
            const changes = chatBackdrop(rel, "dark", true) !== DARK.background;
            expect(hasBackdrop(rel)).toBe(changes);
        }
    });

    it("every relationship offered in Settings has an entry here", () => {
        const fs = require("fs") as typeof import("fs");
        const path = require("path") as typeof import("path");
        const src = fs.readFileSync(
            path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8");
        const start = src.indexOf('{ id: "prefer_not", label: "Prefer not to specify" }');
        expect(start).toBeGreaterThan(-1);
        const ids = [...src.slice(start, start + 900).matchAll(/\{ id: "([a-z_]+)", label:/g)].map((m) => m[1]);
        expect(ids.length).toBeGreaterThanOrEqual(9);
        for (const id of ids) expect(ALL).toContain(id);
    });
});
