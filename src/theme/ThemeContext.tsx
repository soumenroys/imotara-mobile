// src/theme/ThemeContext.tsx
// Provides theme (dark/light) state app-wide. Persisted to AsyncStorage.

import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DARK, LIGHT, type ColorPalette } from "./colors";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
    themeMode: ThemeMode;
    colors: ColorPalette;
    toggleTheme: () => void;
    isDark: boolean;
};

const THEME_KEY = "imotara.theme.mode.v1";

const ThemeContext = createContext<ThemeContextValue>({
    themeMode: "dark",
    colors: DARK,
    toggleTheme: () => {},
    isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [themeMode, setThemeMode] = useState<ThemeMode>("dark");

    useEffect(() => {
        AsyncStorage.getItem(THEME_KEY).then((val) => {
            if (val === "light") setThemeMode("light");
        });
    }, []);

    const toggleTheme = () => {
        setThemeMode((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
            return next;
        });
    };

    return (
        <ThemeContext.Provider
            value={{
                themeMode,
                colors: themeMode === "dark" ? DARK : LIGHT,
                toggleTheme,
                isDark: themeMode === "dark",
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

/** Convenience hook — returns the active palette (DARK or LIGHT). */
export function useColors() {
    return useContext(ThemeContext).colors;
}
