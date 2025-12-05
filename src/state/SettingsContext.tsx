// src/state/SettingsContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";

type SettingsContextValue = {
    emotionInsightsEnabled: boolean;
    setEmotionInsightsEnabled: (value: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
    undefined
);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [emotionInsightsEnabled, setEmotionInsightsEnabled] =
        useState(true);

    return (
        <SettingsContext.Provider
            value={{ emotionInsightsEnabled, setEmotionInsightsEnabled }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return ctx;
}
