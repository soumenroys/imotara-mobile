// src/theme/chatBackdrop.ts
//
// A chat background coloured by the companion relationship (item D from the
// intern feedback: "different chat background depending on the relationship,
// like the theme pickers other chat apps offer").
//
// ── Why this file does maths instead of listing eight hex codes ──────────────
//
// Chat bubbles here are barely opaque: the user bubble is sky at 35%, and bot
// bubbles are a mood tint at 12–26%. So whatever sits behind them is what
// message text is genuinely read against. This is not decoration underneath
// the conversation — it IS the conversation's background. Tint it naively and
// every message pays, which is exactly what the hardcoded dark search bar did
// to the search field in light mode.
//
// Measured on the real palette: an 8% wash in dark mode takes the timestamp on
// a bot bubble from 5.22:1 to 4.50:1, and anything heavier pushes a couple of
// dozen text/surface pairs below AA.
//
// The way out is that WCAG contrast depends only on relative luminance, never
// on hue. So each relationship gets a backdrop built to a fixed brightness and
// a fixed colourfulness:
//
//   • luminance  = the theme background's own luminance x LUMINANCE_FACTOR
//   • colourfulness = a fixed channel spread (max - min), the same for all
//
// Holding luminance still is what keeps contrast still. Holding the spread
// still is what stops the palette being lopsided — matched only on luminance,
// lime shifted 55 units from the background while violet shifted 5, because
// pale hues sit near white and saturated ones do not.
//
// ── Where the numbers come from ─────────────────────────────────────────────
//
// LUMINANCE_FACTOR and CHANNEL_SPREAD were found by measurement, not taste.
// They are the strongest values at which zero text/surface pairs that pass AA
// today fall below it with a backdrop on, in either theme. One step further
// (dark spread 24, light spread 13) and the timestamp on a bot bubble starts
// crossing. chatBackdrop.test.ts is what decides that, and it will fail if
// these are raised or if the bubble alphas in ChatScreen change underneath.
//
// Light mode is necessarily gentler than dark: its background is already near
// white, so there is far less room to move before luminance has to drop.

import { DARK, LIGHT } from "./colors";

export type ChatRelationship =
    | "prefer_not" | "mentor" | "elder" | "friend" | "coach"
    | "sibling" | "junior_buddy" | "parent_like" | "partner_like";

/**
 * Hue angle per relationship, in degrees — warm and energetic for the close,
 * informal ones, cool and steady for the advisory ones, spread around the
 * wheel so no two land on top of each other.
 *
 * `prefer_not` is null on purpose: someone who never chose a relationship
 * should see no change at all, even with the setting switched on.
 */
export const RELATIONSHIP_HUES: Record<ChatRelationship, number | null> = {
    prefer_not:    null,
    coach:          15, // red-orange — drive
    friend:         50, // amber — warm, familiar
    sibling:        95, // green — playful peer
    mentor:        170, // teal — steady, advisory
    junior_buddy:  205, // azure — bright, younger
    elder:         265, // violet — calm, senior
    partner_like:  315, // magenta — closest
    parent_like:   350, // rose — protective warmth
};

/** Backdrop luminance as a fraction of the theme background's own. */
export const LUMINANCE_FACTOR = { dark: 0.9, light: 0.97 } as const;

/** Colourfulness: the backdrop's max-minus-min channel distance, 0–255. */
export const CHANNEL_SPREAD = { dark: 20, light: 10 } as const;

type RGB = [number, number, number];

function parse(c: string): RGB {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) {
        const p = m[1].split(",").map((x) => parseFloat(x.trim()));
        return [p[0], p[1], p[2]];
    }
    const h = c.replace("#", "");
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ];
}

const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance. */
export function luminance(rgb: readonly number[]): number {
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** Fully saturated colour at a hue angle — HSL(h, 100%, 50%). */
function hueToRgb(deg: number): RGB {
    const h = ((deg % 360) + 360) % 360;
    const x = (1 - Math.abs(((h / 60) % 2) - 1)) * 255;
    if (h < 60) return [255, x, 0];
    if (h < 120) return [x, 255, 0];
    if (h < 180) return [0, 255, x];
    if (h < 240) return [0, x, 255];
    if (h < 300) return [x, 0, 255];
    return [255, 0, x];
}

/**
 * Build the backdrop for one hue: mix the pure hue with a grey at `spread/255`,
 * which fixes the channel spread, then binary-search the grey level until the
 * result lands on the target luminance. Luminance rises monotonically with the
 * grey level, so the search converges.
 */
function build(hue: number, spread: number, target: number): RGB {
    const t = spread / 255;
    const pure = hueToRgb(hue);
    const at = (grey: number): RGB =>
        [0, 1, 2].map((i) => grey * (1 - t) + pure[i] * t) as RGB;

    let lo = 0, hi = 255;
    for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        if (luminance(at(mid)) < target) lo = mid; else hi = mid;
    }
    return at((lo + hi) / 2).map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))) as RGB;
}

function buildAll(themeMode: "dark" | "light"): Record<string, string> {
    const base = parse(themeMode === "dark" ? DARK.background : LIGHT.background);
    const target = luminance(base) * LUMINANCE_FACTOR[themeMode];
    const spread = CHANNEL_SPREAD[themeMode];
    const out: Record<string, string> = {};
    for (const [rel, hue] of Object.entries(RELATIONSHIP_HUES)) {
        if (hue == null) continue;
        const [r, g, b] = build(hue, spread, target);
        out[rel] = `rgb(${r}, ${g}, ${b})`;
    }
    return out;
}

/** Precomputed once at import — sixteen small binary searches, not per render. */
const BACKDROPS = { dark: buildAll("dark"), light: buildAll("light") } as const;

/**
 * The colour to paint behind the message list.
 *
 * Returns the plain theme background — byte-identical to today's value — when
 * the setting is off, when no relationship is set, when it is `prefer_not`, or
 * when it is one this file does not recognise. Every path that was not
 * explicitly opted into renders exactly what it rendered before.
 */
export function chatBackdrop(
    relationship: string | null | undefined,
    themeMode: "dark" | "light",
    enabled: boolean,
): string {
    const base = themeMode === "dark" ? DARK.background : LIGHT.background;
    if (!enabled || !relationship) return base;
    return BACKDROPS[themeMode][relationship] ?? base;
}

/** True when this relationship produces a backdrop of its own. */
export function hasBackdrop(relationship: string | null | undefined): boolean {
    return !!relationship && RELATIONSHIP_HUES[relationship as ChatRelationship] != null;
}
