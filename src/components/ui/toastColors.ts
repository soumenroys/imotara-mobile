// src/components/ui/toastColors.ts
// The toast palette, kept apart from the component so its contrast can be
// tested without a React Native runtime.
//
// It used to be dark-only: light-red text over a translucent red tint measured
// 1.22-1.52:1 against the light background, where WCAG AA wants 4.5:1, so a
// toast on a light screen was very nearly invisible. That was survivable while
// light mode was a setting almost nobody found. UX-19 made the app follow the
// phone, so light mode became the common case for anyone with a light device.

export type ToastKind = "error" | "info" | "success";

export type ToastSwatch = { bg: string; border: string; text: string };

/** Measured background of each theme in the running app, for contrast checks. */
export const TOAST_SCREEN = { dark: [19, 14, 23], light: [248, 250, 252] } as const;

export const TOAST_COLORS: Record<"dark" | "light", Record<ToastKind, ToastSwatch>> = {
  dark: {
    error:   { bg: "rgba(239,68,68,0.14)",  border: "rgba(239,68,68,0.55)",   text: "#fca5a5" },
    info:    { bg: "rgba(56,189,248,0.12)",  border: "rgba(56,189,248,0.45)",  text: "#7dd3fc" },
    success: { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.45)",   text: "#86efac" },
  },
  light: {
    error:   { bg: "rgba(239,68,68,0.10)",  border: "rgba(185,28,28,0.45)",   text: "#991b1b" },
    info:    { bg: "rgba(56,189,248,0.12)",  border: "rgba(7,89,133,0.40)",    text: "#075985" },
    success: { bg: "rgba(34,197,94,0.12)",   border: "rgba(22,101,52,0.40)",   text: "#166534" },
  },
};
