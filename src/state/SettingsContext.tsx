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

// ✅ Licensing gate (read-only awareness for settings layer)
import type { LicenseTier } from "../licensing/featureGates";
import { gate } from "../licensing/featureGates";

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
     * Licensing-aware convenience flag:
     * - FREE → false
     * - Premium tiers → true
     *
     * Read-only. This does NOT trigger billing. It only helps the app respect
     * feature gating (e.g., disabling background cloud sync scheduling).
     */
    cloudSyncAllowed: boolean;

    /**
     * Optional helper to re-check the current license tier from AsyncStorage
     * and recompute cloudSyncAllowed. Safe to call after setLicenseTier(...) in debug.
     */
    refreshCloudSyncAllowed: () => Promise<void>;

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

// ✅ Same key used by HistoryContext (we are only reading it here)
const LICENSE_TIER_KEY = "imotara_license_tier_v1";

function isValidTier(v: unknown): v is LicenseTier {
    return (
        v === "FREE" ||
        v === "PREMIUM" ||
        v === "FAMILY" ||
        v === "EDU" ||
        v === "ENTERPRISE"
    );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
    // Keep your original defaults (non-breaking)
    const [emotionInsightsEnabled, _setEmotionInsightsEnabled] = useState(true);

    const [lastSyncAt, _setLastSyncAt] = useState<number | null>(null);
    const [lastSyncStatus, _setLastSyncStatus] = useState<string | null>(null);

    // Default auto-sync delay: 8 seconds
    const [autoSyncDelaySeconds, _setAutoSyncDelaySeconds] =
        useState<number>(8);

    const [hydrated, setHydrated] = useState(false);

    // ✅ Licensing-derived flag (default FREE behavior: device-only)
    const [cloudSyncAllowed, setCloudSyncAllowed] = useState<boolean>(false);

    const refreshCloudSyncAllowed = async () => {
        try {
            const rawTier = await AsyncStorage.getItem(LICENSE_TIER_KEY);
            const tier: LicenseTier = isValidTier(rawTier) ? rawTier : "FREE";
            const g = gate("CLOUD_SYNC", tier);
            setCloudSyncAllowed(g.enabled);
        } catch (e) {
            // Safe fallback: treat as FREE
            setCloudSyncAllowed(false);
            if (DEBUG_UI_ENABLED)
                console.warn("License gate refresh failed:", e);
        }
    };

    // ---- Hydrate once ----
    useEffect(() => {
        let alive = true;

        const hydrate = async () => {
            try {
                // ✅ hydrate settings + compute license gate in parallel
                const [raw, rawTier] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEY),
                    AsyncStorage.getItem(LICENSE_TIER_KEY),
                ]);

                // 1) Settings payload
                if (raw) {
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
                }

                // 2) License tier → cloud sync gate
                const tier: LicenseTier = isValidTier(rawTier) ? rawTier : "FREE";
                const g = gate("CLOUD_SYNC", tier);
                if (alive) setCloudSyncAllowed(g.enabled);
            } catch (e) {
                // Non-fatal; keep defaults
                if (DEBUG_UI_ENABLED) console.warn("Settings hydrate failed:", e);
                if (alive) setCloudSyncAllowed(false);
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
    }, [
        hydrated,
        emotionInsightsEnabled,
        autoSyncDelaySeconds,
        lastSyncAt,
        lastSyncStatus,
    ]);

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
                cloudSyncAllowed,
                refreshCloudSyncAllowed,
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
