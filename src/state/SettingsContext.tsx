// src/state/SettingsContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";
import { DEBUG_UI_ENABLED } from "../config/debug";

type SettingsContextValue = {
    // Emotion insight toggle for Imotara replies
    emotionInsightsEnabled: boolean;
    setEmotionInsightsEnabled: (value: boolean) => void;

    // Last known sync info (used for UI hints)
    lastSyncAt: number | null;
    lastSyncStatus: string | null;
    setLastSyncAt: (ts: number | null) => void;
    setLastSyncStatus: (status: string | null) => void;

    /**
     * Mobile Sync Phase 2 — configurable background auto-sync delay.
     *
     * - Value in seconds
     * - Example: 8 → ~8 seconds after new unsynced changes,
     *   HistoryContext may trigger an automatic push to the cloud.
     */
    autoSyncDelaySeconds: number;
    setAutoSyncDelaySeconds: (value: number) => void;

    /**
     * Global debug-only UI enablement.
     * Read-only. Sourced from src/config/debug.ts
     */
    debugUIEnabled: boolean;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
    undefined
);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [emotionInsightsEnabled, setEmotionInsightsEnabled] = useState(true);

    const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
    const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);

    // Default auto-sync delay: 8 seconds
    const [autoSyncDelaySeconds, setAutoSyncDelaySeconds] = useState<number>(8);

    return (
        <SettingsContext.Provider
            value={{
                emotionInsightsEnabled,
                setEmotionInsightsEnabled,
                lastSyncAt,
                lastSyncStatus,
                setLastSyncAt,
                setLastSyncStatus,
                autoSyncDelaySeconds,
                setAutoSyncDelaySeconds,
                debugUIEnabled: DEBUG_UI_ENABLED,
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
