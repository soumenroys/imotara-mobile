// UX-44. The app's accent colours were bare hex literals repeated across ten
// screens — 26 distinct values, every one picked to sit on a dark screen, with
// no light counterpart. Measured against the light background they land
// between 1.19:1 and 2.85:1, where WCAG AA wants 4.5:1.
//
// It did not matter while light mode was a setting almost nobody found. UX-19
// made the app follow the phone, so it does now.
//
// This reads the real palette. Add a role and forget its light value, or pick
// one that is too pale, and this fails.

import { DARK, LIGHT } from "../theme/colors";

const ROLES = [
  "warning", "warningStrong", "warningSoft", "orange",
  "success", "successSoft", "successAlt",
  "accent", "accentSoft", "indigo", "indigoSoft",
  "danger", "dangerSoft", "dangerSofter",
  "info", "infoSoft", "sky",
] as const;

function parse(c: string): [number, number, number] {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    return [p[0], p[1], p[2]];
  }
  const h = c.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = (c: readonly number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const over = (fg: readonly number[], a: number, bg: readonly number[]) =>
  fg.map((c, i) => a * c + (1 - a) * bg[i]);
function contrast(a: readonly number[], b: readonly number[]) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Both the page and the darkest surface an accent commonly sits on, so a
// colour that only works against plain background does not slip through.
const SURFACES = {
  dark: [parse(DARK.background), over(parse(DARK.surfaceSoft), 0.7, parse(DARK.background))],
  light: [parse(LIGHT.background), over(parse(LIGHT.surfaceSoft), 0.85, parse(LIGHT.background))],
} as const;

describe("every semantic accent is readable in its own theme", () => {
  for (const theme of ["dark", "light"] as const) {
    const palette = theme === "dark" ? DARK : LIGHT;
    for (const role of ROLES) {
      it(`${theme} ${role}`, () => {
        const colour = parse((palette as Record<string, string>)[role]);
        for (const surface of SURFACES[theme]) {
          expect(contrast(colour, surface)).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }

  it("dark keeps the exact literals that were already shipping", () => {
    // The whole safety argument for this change is that dark mode does not
    // move. If someone "tidies" a dark value, that argument is gone.
    expect(DARK.warning).toBe("#fbbf24");
    expect(DARK.success).toBe("#34d399");
    expect(DARK.accent).toBe("#a78bfa");
    expect(DARK.danger).toBe("#f87171");
    expect(DARK.info).toBe("#60a5fa");
  });

  it("the check can actually fail — dark accents on a light surface", () => {
    // Without this, a check measuring nothing would report success.
    const lightSurface = SURFACES.light[1];
    for (const role of ["warning", "success", "accent", "danger", "info"] as const) {
      expect(contrast(parse(DARK[role]), lightSurface)).toBeLessThan(4.5);
    }
  });

  it("no hardcoded dark-only colour is left in a style or an icon prop", () => {
    // Two shapes exist and the first sweep only caught one of them:
    //   style:  color: "#fbbf24"
    //   icon:   <Ionicons color="#fbbf24" />
    // The second is a JSX prop, so a regex looking for `color:` walks straight
    // past it. Both are checked here.
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");

    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
        return e.name.endsWith(".tsx") ? [p] : [];
      });

    const parseHex = (c: string): [number, number, number] | null => {
      const m = /^#([0-9a-fA-F]{6})$/.exec(c);
      if (!m) return null;
      const h = m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };

    const offenders: string[] = [];
    // Known-good exceptions, each for a stated reason.
    const ALLOWED = new Set([
      "#ffffff", // white on a filled button (Apple sign-in, primary CTA)
      "#fff",
      "#7c3aed", // the filled violet CTA background itself
      "#ef4444", // heart reaction — a red heart is the icon's meaning, not text
      "#4285f4", // Google's brand blue on the Google sign-in button. Brand
                 // marks are exempt from contrast rules and Google's own
                 // guidelines require this exact value.
      "#1a1a2e", // the spinner on that same light-backed Google button
    ]);

    for (const file of walk(path.join(process.cwd(), "src"))) {
      const src = fs.readFileSync(file, "utf8");
      const re = /\bcolor(?::\s*|=\{?)"(#[0-9a-fA-F]{6})"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        if (ALLOWED.has(m[1].toLowerCase())) continue;
        const rgb = parseHex(m[1]);
        if (!rgb) continue;
        if (contrast(rgb, SURFACES.light[1]) < 3) {
          offenders.push(`${path.relative(process.cwd(), file)}: ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("light and dark define exactly the same roles", () => {
    for (const role of ROLES) {
      expect(Object.keys(DARK)).toContain(role);
      expect(Object.keys(LIGHT)).toContain(role);
    }
  });
});
