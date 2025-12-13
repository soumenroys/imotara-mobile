// src/state/SettingsContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const STORAGE_KEY = "imotara_settings_v1";

// Keep this tiny + safe (no dependency on other files)
function clampDelaySeconds(v: unknown, fallback: number): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    // Keep within the range the rest of the app expects
    return Math.min(Math.max(Math.round(n), 3), 60);
}

function safeBool(v: unknown, fallback: boolean): boolean {
    if (typeof v === "boolean") return v;
    if (v == null) return fallback;
    const s = String(v).trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(s)) return true;
    if (["0", "false", "no", "n", "off"].includes(s)) return false;
    return fallback;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
    // Keep your original defaults (non-breaking)
    const [emotionInsightsEnabled, _setEmotionInsightsEnabled] = useState(true);

    const [lastSyncAt, _setLastSyncAt] = useState<number | null>(null);
    const [lastSyncStatus, _setLastSyncStatus] = useState<string | null>(null);

    // Default auto-sync delay: 8 seconds
    const [autoSyncDelaySeconds, _setAutoSyncDelaySeconds] = useState<number>(8);

    const [hydrated, setHydrated] = useState(false);

    // ---- Hydrate once ----
    useEffect(() => {
        let alive = true;

        const hydrate = async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (!raw) {
                    if (alive) setHydrated(true);
                    return;
                }

                const parsed = JSON.parse(raw);

                if (alive && parsed && typeof parsed === "object") {
                    if ("emotionInsightsEnabled" in parsed) {
                        _setEmotionInsightsEnabled(
                            safeBool(parsed.emotionInsightsEnabled, true)
                        );
                    }

                    if ("autoSyncDelaySeconds" in parsed) {
                        _setAutoSyncDelaySeconds(
                            clampDelaySeconds(parsed.autoSyncDelaySeconds, 8)
                        );
                    }

                    if ("lastSyncAt" in parsed) {
                        const v = parsed.lastSyncAt;
                        _setLastSyncAt(typeof v === "number" ? v : null);
                    }

                    if ("lastSyncStatus" in parsed) {
                        const v = parsed.lastSyncStatus;
                        _setLastSyncStatus(typeof v === "string" ? v : null);
                    }
                }
            } catch (e) {
                // Non-fatal; keep defaults
                if (DEBUG_UI_ENABLED) console.warn("Settings hydrate failed:", e);
            } finally {
                if (alive) setHydrated(true);
            }
        };

        hydrate();

        return () => {
            alive = false;
        };
    }, []);

    // ---- Persist on change (after hydration) ----
    useEffect(() => {
        if (!hydrated) return;

        const payload = {
            emotionInsightsEnabled,
            autoSyncDelaySeconds,
            lastSyncAt,
            lastSyncStatus,
        };

        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch((e) => {
            if (DEBUG_UI_ENABLED) console.warn("Settings save failed:", e);
        });
    }, [hydrated, emotionInsightsEnabled, autoSyncDelaySeconds, lastSyncAt, lastSyncStatus]);

    // ---- Wrapped setters (non-breaking; same signatures) ----
    const setEmotionInsightsEnabled = (value: boolean) => {
        _setEmotionInsightsEnabled(!!value);
    };

    const setAutoSyncDelaySeconds = (value: number) => {
        _setAutoSyncDelaySeconds(clampDelaySeconds(value, 8));
    };

    const setLastSyncAt = (ts: number | null) => {
        _setLastSyncAt(typeof ts === "number" ? ts : null);
    };

    const setLastSyncStatus = (status: string | null) => {
        _setLastSyncStatus(typeof status === "string" ? status : null);
    };

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
