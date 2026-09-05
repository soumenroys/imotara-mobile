// The toast palette was dark-only. Its light-red text over a translucent red
// tint measured 1.22:1 against the light background — WCAG AA wants 4.5:1, so
// a toast on a light screen was effectively invisible. Nobody noticed because
// light mode was a setting almost nobody found; UX-19 made the app follow the
// phone, so light mode is now the common case for anyone with a light device.
//
// This reads the real palette rather than restating the colours, so changing a
// swatch to something unreadable fails here instead of shipping.

import { TOAST_COLORS, TOAST_SCREEN, type ToastKind } from "../components/ui/toastColors";

// Measured from the running app on both simulators.
const SCREEN = TOAST_SCREEN;

function parse(c: string): { rgb: [number, number, number]; a: number } {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    return { rgb: [p[0], p[1], p[2]], a: p[3] ?? 1 };
  }
  const h = c.replace("#", "");
  return { rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)], a: 1 };
}

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: readonly number[]) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

function contrast(fg: readonly number[], bg: readonly number[]) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const KINDS: ToastKind[] = ["error", "info", "success"];

describe("toast text is readable on the screen it sits on", () => {
  for (const theme of ["dark", "light"] as const) {
    for (const kind of KINDS) {
      it(`${kind} on ${theme}`, () => {
        const swatch = TOAST_COLORS[theme][kind];
        const tint = parse(swatch.bg);
        const screen = SCREEN[theme];
        // the tint is translucent, so composite it over the screen first
        const composited = tint.rgb.map((c, i) => tint.a * c + (1 - tint.a) * screen[i]);
        const ratio = contrast(parse(swatch.text).rgb, composited);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("the check can actually fail", () => {
    // A guard that cannot distinguish "readable" from "did not run" is worse
    // than no guard — this session has already been fooled by one that could not.
    const screen = SCREEN.light;
    const tint = parse(TOAST_COLORS.light.error.bg);
    const composited = tint.rgb.map((c, i) => tint.a * c + (1 - tint.a) * screen[i]);
    // the ORIGINAL dark-only text colour, which is what shipped
    expect(contrast(parse("#fca5a5").rgb, composited)).toBeLessThan(4.5);
  });
});
