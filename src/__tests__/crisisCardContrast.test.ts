// The crisis card was written dark-only. On a light screen its text measured
// 1.19-2.36:1 against the card background, where WCAG AA wants 4.5:1 — and
// that includes the helpline PHONE NUMBER.
//
// It did not matter while light mode was a setting almost nobody found. UX-19
// made the app follow the phone, so it is now the ordinary case for anyone
// whose device is light, and the screen it breaks is the one shown to someone
// who has just said they do not want to be alive.
//
// This reads the real palette rather than restating it.

import { CRISIS_CARD_COLORS, SCREEN_BG } from "../lib/safety/crisisCardColors";

function parse(c: string): { rgb: [number, number, number]; a: number } {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    return { rgb: [p[0], p[1], p[2]], a: Number.isFinite(p[3]) ? p[3] : 1 };
  }
  const h = c.replace("#", "");
  return { rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)], a: 1 };
}
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = (rgb: readonly number[]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const over = (fg: readonly number[], a: number, bg: readonly number[]) =>
  fg.map((c, i) => a * c + (1 - a) * bg[i]);
function contrast(fg: readonly number[], bg: readonly number[]) {
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("the crisis card is readable in both themes", () => {
  for (const theme of ["dark", "light"] as const) {
    for (const tier of ["tier1", "tier2"] as const) {
      const t = CRISIS_CARD_COLORS[theme][tier];
      const screen = SCREEN_BG[theme];
      const tint = parse(t.bg);
      const card = over(tint.rgb, tint.a, screen);

      const parts: Array<[string, string, number]> = [
        ["title", t.title, 1],
        ["body", t.body, t.bodyOpacity],
        ["helpline label", t.label, t.labelOpacity],
        ["helpline NUMBER", t.contact, 1],
        ["footer", t.title, t.footerOpacity],
      ];
      for (const [name, colour, opacity] of parts) {
        it(`${theme} ${tier} ${name}`, () => {
          const p = parse(colour);
          const eff = over(p.rgb, p.a * opacity, card);
          expect(contrast(eff, card)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }

  it("the check can actually fail — the shipped dark colours on a light card", () => {
    // Without this, a check that silently measured nothing would "pass".
    const screen = SCREEN_BG.light;
    const tint = parse(CRISIS_CARD_COLORS.light.tier1.bg);
    const card = over(tint.rgb, tint.a, screen);
    // what tier 1 actually used before this fix
    expect(contrast(parse("rgba(196,181,253,1)").rgb, card)).toBeLessThan(4.5);
    // and tier 2
    const tint2 = parse(CRISIS_CARD_COLORS.light.tier2.bg);
    const card2 = over(tint2.rgb, tint2.a, screen);
    expect(contrast(parse("#fde68a").rgb, card2)).toBeLessThan(4.5);
  });
});
