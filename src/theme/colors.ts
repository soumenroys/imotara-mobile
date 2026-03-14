// src/theme/colors.ts
// Theme-aware color palette. Import `useColors()` in components.
// For backward compat, the default export remains the dark theme.

export type ColorPalette = typeof DARK;

export const DARK = {
    background: "rgba(3, 6, 23, 1)",
    surfaceSoft: "rgba(30, 41, 59, 0.7)",
    surface: "rgba(15, 23, 42, 0.9)",
    border: "rgba(148, 163, 184, 0.25)",
    textPrimary: "rgba(241, 245, 249, 1)",
    textSecondary: "rgba(148, 163, 184, 0.9)",
    primary: "rgba(56, 189, 248, 1)",

    emotionSad: "rgba(37, 99, 235, 0.20)",
    emotionAnxious: "rgba(234, 179, 8, 0.22)",
    emotionAngry: "rgba(239, 68, 68, 0.20)",
    emotionConfused: "rgba(147, 51, 234, 0.22)",
    emotionHopeful: "rgba(16, 185, 129, 0.22)",
    emotionNeutral: "rgba(148, 163, 184, 0.18)",
};

export const LIGHT: ColorPalette = {
    background: "rgba(248, 250, 252, 1)",
    surfaceSoft: "rgba(226, 232, 240, 0.85)",
    surface: "rgba(241, 245, 249, 0.95)",
    border: "rgba(100, 116, 139, 0.20)",
    textPrimary: "rgba(15, 23, 42, 1)",
    textSecondary: "rgba(71, 85, 105, 0.9)",
    primary: "rgba(14, 165, 233, 1)",

    emotionSad: "rgba(37, 99, 235, 0.14)",
    emotionAnxious: "rgba(202, 138, 4, 0.16)",
    emotionAngry: "rgba(220, 38, 38, 0.14)",
    emotionConfused: "rgba(124, 58, 237, 0.14)",
    emotionHopeful: "rgba(5, 150, 105, 0.14)",
    emotionNeutral: "rgba(100, 116, 139, 0.12)",
};

// Default export stays DARK for all existing direct imports (backward compat).
export default DARK;
