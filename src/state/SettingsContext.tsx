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

    lastSyncAt: number | null;
    lastSyncStatus: string | null;
    setLastSyncAt: (ts: number | null) => void;
    setLastSyncStatus: (status: string | null) => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
    undefined
);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [emotionInsightsEnabled, setEmotionInsightsEnabled] =
        useState(true);

    const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
    const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(
        null
    );

    return (
        <SettingsContext.Provider
            value={{
                emotionInsightsEnabled,
                setEmotionInsightsEnabled,
                lastSyncAt,
                lastSyncStatus,
                setLastSyncAt,
                setLastSyncStatus,
            }}
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
