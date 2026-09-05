// src/theme/themeMode.ts
// The two judgement calls behind the appearance setting (UX-19), kept apart
// from ThemeContext so they can be tested without a React Native runtime.

export type ThemePref = "system" | "light" | "dark";
export type ThemeMode = "dark" | "light";

/**
 * What a preference resolves to right now.
 *
 * "unknown" from the OS (null) counts as dark, which is what the app has
 * always shown. Guessing light on no information would be a visible change
 * made on no evidence — the same asymmetry the network layer uses for its
 * third state.
 */
export function resolveThemeMode(
  pref: ThemePref,
  systemScheme: "light" | "dark" | null | undefined,
): ThemeMode {
  if (pref === "system") return systemScheme === "light" ? "light" : "dark";
  return pref;
}

/**
 * Which preference an install with nothing stored should start from.
 *
 * "system" is right for a NEW install. But flipping an existing user's app to
 * light because their phone happens to be light is a change they never asked
 * for — they have been using a dark app and none of their preferences moved.
 * So an install that has used Imotara before keeps the dark it already had.
 */
export function initialThemePref(existingKeys: readonly string[]): ThemePref {
  return existingKeys.some((k) => k.startsWith("imotara.")) ? "dark" : "system";
}
