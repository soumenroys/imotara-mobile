// src/theme/ThemeContext.tsx
// Provides theme (dark/light), accent colour, and font-scale state app-wide.
// All three values are persisted to AsyncStorage.
//
// UX-19. This was a binary toggle that defaulted to dark and never once asked
// the phone what it preferred, so someone whose device is in light mode opened
// a dark app and had to go find the setting to fix it.
//
// Two levels now. `themePref` is what the person chose — "system", "light" or
// "dark" — and `themeMode` is what that resolves to right now. Components keep
// reading `themeMode`/`isDark` and are unaffected.
//
// The pref only means anything because app.json's `userInterfaceStyle` moved
// from "light" to "automatic". While it was pinned, useColorScheme() returned
// "light" no matter what the phone was set to — verified on the Android
// emulator by flipping the system to dark and watching the app not notice. A
// three-way switch built on top of that pin would have been a switch wired to
// nothing, which is the same bug UX-07 found in the haptics.

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DARK, LIGHT, type ColorPalette } from "./colors";
import { resolveThemeMode, initialThemePref, type ThemePref } from "./themeMode";

type ThemeMode = "dark" | "light";
export type { ThemePref };
export { resolveThemeMode, initialThemePref };
export type Accent = "twilight" | "indigo" | "teal" | "rose" | "amber" | "emerald";
export type FontSize = "sm" | "md" | "lg";

// Maps accent key → primary colour hex used for `colors.primary`
export const ACCENT_COLORS: Record<Accent, string> = {
    twilight: "rgba(56, 189, 248, 1)",   // default sky-blue
    indigo:   "rgba(99, 102, 241, 1)",
    teal:     "rgba(20, 184, 166, 1)",
    rose:     "rgba(244, 63, 94, 1)",
    amber:    "rgba(245, 158, 11, 1)",
    emerald:  "rgba(16, 185, 129, 1)",
};

// fontScale multiplier applied wherever components respect it
export const FONT_SCALE: Record<FontSize, number> = {
    sm: 0.88,
    md: 1.0,
    lg: 1.14,
};

type ThemeContextValue = {
    /** What the person chose. Persisted. */
    themePref: ThemePref;
    setThemePref: (p: ThemePref) => void;
    /** What that resolves to right now. This is what components should read. */
    themeMode: ThemeMode;
    colors: ColorPalette;
    toggleTheme: () => void;
    isDark: boolean;
    accent: Accent;
    setAccent: (a: Accent) => void;
    fontSize: FontSize;
    setFontSize: (s: FontSize) => void;
    fontScale: number;
};

const THEME_KEY   = "imotara.theme.mode.v1";   // now holds a ThemePref
const ACCENT_KEY  = "imotara.accent.v1";
const FSCALE_KEY  = "imotara.fontscale.v1";

const ThemeContext = createContext<ThemeContextValue>({
    themePref: "system",
    setThemePref: () => {},
    themeMode: "dark",
    colors: DARK,
    toggleTheme: () => {},
    isDark: true,
    accent: "twilight",
    setAccent: () => {},
    fontSize: "md",
    setFontSize: () => {},
    fontScale: 1.0,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Starts at "dark" — today's behaviour — so nothing flashes before the
    // stored preference has been read back.
    const [themePref, _setThemePref] = useState<ThemePref>("dark");
    const [accent, _setAccent]       = useState<Accent>("twilight");
    const [fontSize, _setFontSize]   = useState<FontSize>("md");

    // Subscribes to Appearance, so the app follows the phone live rather than
    // only at launch.
    const systemScheme = useColorScheme();

    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem(THEME_KEY),
            AsyncStorage.getItem(ACCENT_KEY),
            AsyncStorage.getItem(FSCALE_KEY),
        ]).then(async ([theme, acc, fs]) => {
            if (acc && acc in ACCENT_COLORS) _setAccent(acc as Accent);
            if (fs && fs in FONT_SCALE)      _setFontSize(fs as FontSize);

            if (theme === "light" || theme === "dark" || theme === "system") {
                _setThemePref(theme);
                return;
            }

            // Nothing stored — decide once, and write it down so this never
            // re-runs and cannot change under the person later.
            let initial: ThemePref;
            try {
                initial = initialThemePref(await AsyncStorage.getAllKeys());
            } catch {
                initial = "dark"; // can't tell — choose the no-change answer
            }
            _setThemePref(initial);
            AsyncStorage.setItem(THEME_KEY, initial).catch(() => {});
        });
    }, []);

    // "unknown" from the OS counts as dark, which is what the app has always
    // shown. Guessing light on no information would be a visible change made
    // on no evidence.
    const themeMode: ThemeMode = resolveThemeMode(themePref, systemScheme);

    const setThemePref = (p: ThemePref) => {
        _setThemePref(p);
        AsyncStorage.setItem(THEME_KEY, p).catch(() => {});
    };

    // Unchanged for callers: still flips between light and dark. It now lands
    // on an explicit choice rather than toggling a hidden system default, which
    // is what someone pressing "Switch to Light" is asking for.
    const toggleTheme = () => {
        setThemePref(themeMode === "dark" ? "light" : "dark");
    };

    const setAccent = (a: Accent) => {
        _setAccent(a);
        AsyncStorage.setItem(ACCENT_KEY, a).catch(() => {});
    };

    const setFontSize = (s: FontSize) => {
        _setFontSize(s);
        AsyncStorage.setItem(FSCALE_KEY, s).catch(() => {});
    };

    // Build the effective palette with the accent's primary colour overriding the default
    const colors = useMemo<ColorPalette>(() => {
        const base = themeMode === "dark" ? DARK : LIGHT;
        const primary = ACCENT_COLORS[accent];
        const primaryTint = primary.replace(", 1)", ", 0.15)");
        const primaryBorder = primary.replace(", 1)", ", 0.27)");
        return { ...base, primary, primaryTint, primaryBorder };
    }, [themeMode, accent]);

    return (
        <ThemeContext.Provider
            value={{
                themePref,
                setThemePref,
                themeMode,
                colors,
                toggleTheme,
                isDark: themeMode === "dark",
                accent,
                setAccent,
                fontSize,
                setFontSize,
                fontScale: FONT_SCALE[fontSize],
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

/** Convenience hook — returns the active palette with accent override applied. */
export function useColors() {
    return useContext(ThemeContext).colors;
}
