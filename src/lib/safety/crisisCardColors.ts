// src/lib/safety/crisisCardColors.ts
// Colours for the crisis card, per theme, kept pure so their contrast can be
// measured in a test.
//
// The card was written dark-only: pale violet on a violet tint for tier 1,
// pale amber on an amber tint for tier 2. Measured against the light
// background those come out at 1.52-2.36:1 and 1.19:1 respectively, where
// WCAG AA wants 4.5:1 — and that includes the helpline PHONE NUMBER.
//
// It never mattered while light mode was a setting almost nobody found. UX-19
// made the app follow the phone, so this is now the ordinary case for anyone
// whose device is light, and the screen it breaks is the one shown to someone
// who has just said they do not want to be alive. The light values below
// measure 4.7-9.5:1.

export type CrisisTierColors = {
  border: string;
  bg: string;
  title: string;
  body: string;
  bodyOpacity: number;
  label: string;
  labelOpacity: number;
  contact: string;
  dismiss: string;
  dismissOpacity: number;
  footerOpacity: number;
};

export const CRISIS_CARD_COLORS: Record<"dark" | "light", { tier1: CrisisTierColors; tier2: CrisisTierColors }> = {
  dark: {
    tier1: {
      border: "rgba(99,102,241,0.30)", bg: "rgba(99,102,241,0.08)",
      title: "rgba(167,139,250,1)",
      body: "rgba(196,181,253,0.9)", bodyOpacity: 1,
      label: "rgba(196,181,253,0.85)", labelOpacity: 1,
      contact: "rgba(196,181,253,1)",
      dismiss: "rgba(167,139,250,0.7)", dismissOpacity: 1,
      footerOpacity: 1,
    },
    tier2: {
      border: "rgba(251, 191, 36, 0.35)", bg: "rgba(251, 191, 36, 0.10)",
      title: "#fde68a",
      body: "#fde68a", bodyOpacity: 0.85,
      label: "#fde68a", labelOpacity: 0.85,
      contact: "#fde68a",
      dismiss: "#fde68a", dismissOpacity: 0.7,
      footerOpacity: 0.7,
    },
  },
  light: {
    tier1: {
      border: "rgba(99,102,241,0.45)", bg: "rgba(99,102,241,0.08)",
      title: "#5b21b6",
      body: "#4c1d95", bodyOpacity: 0.95,
      label: "#5b21b6", labelOpacity: 0.9,
      contact: "#4c1d95",
      dismiss: "#5b21b6", dismissOpacity: 0.8,
      footerOpacity: 0.9,
    },
    tier2: {
      border: "rgba(217,119,6,0.50)", bg: "rgba(251, 191, 36, 0.10)",
      title: "#92400e",
      body: "#78350f", bodyOpacity: 0.95,
      label: "#92400e", labelOpacity: 0.85,
      contact: "#78350f",
      dismiss: "#92400e", dismissOpacity: 0.8,
      footerOpacity: 0.9,
    },
  },
};

/** Measured background of each theme in the running app, for contrast checks. */
export const SCREEN_BG = { dark: [19, 14, 23], light: [248, 250, 252] } as const;
