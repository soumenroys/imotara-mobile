// src/theme/ThemeContext.tsx
// Provides theme (dark/light), accent colour, and font-scale state app-wide.
// All three values are persisted to AsyncStorage.

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DARK, LIGHT, type ColorPalette } from "./colors";

type ThemeMode = "dark" | "light";
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

const THEME_KEY   = "imotara.theme.mode.v1";
const ACCENT_KEY  = "imotara.accent.v1";
const FSCALE_KEY  = "imotara.fontscale.v1";

const ThemeContext = createContext<ThemeContextValue>({
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
    const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
    const [accent, _setAccent]      = useState<Accent>("twilight");
    const [fontSize, _setFontSize]  = useState<FontSize>("md");

    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem(THEME_KEY),
            AsyncStorage.getItem(ACCENT_KEY),
            AsyncStorage.getItem(FSCALE_KEY),
        ]).then(([theme, acc, fs]) => {
            if (theme === "light") setThemeMode("light");
            if (acc && acc in ACCENT_COLORS) _setAccent(acc as Accent);
            if (fs && fs in FONT_SCALE)      _setFontSize(fs as FontSize);
        });
    }, []);

    const toggleTheme = () => {
        setThemeMode((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
            return next;
        });
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
        return { ...base, primary };
    }, [themeMode, accent]);

    return (
        <ThemeContext.Provider
            value={{
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
