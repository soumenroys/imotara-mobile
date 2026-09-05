// src/theme/colors.ts
// Theme-aware color palette. Import `useColors()` in components.
// For backward compat, the default export remains the dark theme.

export type ColorPalette = typeof DARK;

export const DARK = {
    background: "rgba(19, 14, 23, 1)",
    surfaceSoft: "rgba(24, 15, 30, 0.7)",
    surface: "rgba(24, 15, 30, 0.9)",
    border: "rgba(148, 163, 184, 0.25)",
    textPrimary: "rgba(241, 245, 249, 1)",
    textSecondary: "rgba(148, 163, 184, 0.9)",
    primary: "rgba(56, 189, 248, 1)",
    primaryTint: "rgba(56, 189, 248, 0.15)",
    primaryBorder: "rgba(56, 189, 248, 0.27)",

    emotionSad: "rgba(37, 99, 235, 0.20)",
    emotionAnxious: "rgba(234, 179, 8, 0.22)",
    emotionAngry: "rgba(239, 68, 68, 0.20)",
    emotionConfused: "rgba(147, 51, 234, 0.22)",
    emotionHopeful: "rgba(16, 185, 129, 0.22)",
    emotionNeutral: "rgba(148, 163, 184, 0.18)",

    // Semantic accents (UX-44).
    //
    // These roles were written as bare hex literals in ~105 places across ten
    // screens, with no light-mode counterpart — 26 distinct colours, all of
    // them chosen to sit on a dark screen. Measured against the light
    // background they land between 1.19:1 and 2.85:1, where WCAG AA wants
    // 4.5:1. It did not matter while light mode was a setting almost nobody
    // found; UX-19 made the app follow the phone.
    //
    // The DARK values below are the exact literals that were already in use,
    // so dark mode cannot change. Only light gets new values, and every one of
    // them is checked in semanticColors.test.ts against both the page
    // background and the darkest common light surface.
    warning:       "#fbbf24",
    warningStrong: "#f59e0b",
    warningSoft:   "#fde68a",
    orange:        "#fb923c",
    success:       "#34d399",
    successSoft:   "#6ee7b7",
    successAlt:    "#4ade80",
    accent:        "#a78bfa",
    accentSoft:    "#c4b5fd",
    indigo:        "#818cf8",
    indigoSoft:    "#a5b4fc",
    danger:        "#f87171",
    dangerSoft:    "#fca5a5",
    dangerSofter:  "#fecaca",
    info:          "#60a5fa",
    infoSoft:      "#93c5fd",
    sky:           "#7dd3fc",
};

export const LIGHT: ColorPalette = {
    background: "rgba(248, 250, 252, 1)",
    surfaceSoft: "rgba(226, 232, 240, 0.85)",
    surface: "rgba(241, 245, 249, 0.95)",
    border: "rgba(100, 116, 139, 0.20)",
    textPrimary: "rgba(15, 23, 42, 1)",
    textSecondary: "rgba(71, 85, 105, 0.9)",
    primary: "rgba(14, 165, 233, 1)",
    primaryTint: "rgba(14, 165, 233, 0.12)",
    primaryBorder: "rgba(14, 165, 233, 0.25)",

    emotionSad: "rgba(37, 99, 235, 0.14)",
    emotionAnxious: "rgba(202, 138, 4, 0.16)",
    emotionAngry: "rgba(220, 38, 38, 0.14)",
    emotionConfused: "rgba(124, 58, 237, 0.14)",
    emotionHopeful: "rgba(5, 150, 105, 0.14)",
    emotionNeutral: "rgba(100, 116, 139, 0.12)",

    // Darkened counterparts of the dark-mode accents above. Every one measures
    // at least 4.5:1 against both the page background and surfaceSoft.
    warning:       "#92400e",
    warningStrong: "#92400e",
    warningSoft:   "#78350f",
    orange:        "#9a3412",
    success:       "#047857",
    successSoft:   "#065f46",
    successAlt:    "#166534",
    accent:        "#6d28d9",
    accentSoft:    "#5b21b6",
    indigo:        "#4338ca",
    indigoSoft:    "#3730a3",
    danger:        "#b91c1c",
    dangerSoft:    "#991b1b",
    dangerSofter:  "#7f1d1d",
    info:          "#1d4ed8",
    infoSoft:      "#1e40af",
    sky:           "#0369a1",
};

// Default export stays DARK for all existing direct imports (backward compat).
export default DARK;
