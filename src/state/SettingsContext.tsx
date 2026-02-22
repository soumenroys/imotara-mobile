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
import type { ToneContextPayload } from "../api/aiClient";

type SettingsContextValue = {
    // Emotion insight toggle for Imotara replies
    emotionInsightsEnabled: boolean;
    setEmotionInsightsEnabled: (value: boolean) => void;

    // Phase 2.4: History list preference (UI-only)
    showAssistantRepliesInHistory: boolean;
    setShowAssistantRepliesInHistory: (value: boolean) => void;

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

    /**
     * Analysis mode for chat replies:
     * - auto: try cloud, fallback local
     * - cloud: call /api/respond (user-facing parity endpoint)
     * - local: never call cloud (device-only)
     */
    analysisMode: "auto" | "cloud" | "local";
    setAnalysisMode: (value: "auto" | "cloud" | "local") => void;

    /**
     * Optional tone guidance sent to /api/respond for more humanized replies (tone only).
     * Mirrors server contract: toneContext?: ToneContextPayload
     */
    toneContext: ToneContextPayload;
    setToneContext: (value: ToneContextPayload) => void;

    /**
     * Local device-only identity scope.
     * Used to prevent different “users” on the same device from seeing each other's local history
     * when chatLinkKey is empty.
     */
    localUserScopeId: string;

    /**
     * Rotate the local scope id (acts like “switch user / new local profile”).
     * Does NOT touch cloud history unless chatLinkKey is also changed elsewhere.
     */
    resetLocalUserScopeId: () => void;

    /**
     * Optional: Cross-device chat link key.
     * If the same key is set on Web + Mobile, remote chat history can match.
     */
    chatLinkKey: string;
    setChatLinkKey: (value: string) => void;

    /**
     * Device-only reply language preference (override).
     * Used by ChatScreen for local hints and for consistent UX.
     */
    preferredLanguage: "en" | "hi" | "bn";
    setPreferredLanguage: (value: "en" | "hi" | "bn") => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
    undefined
);

const STORAGE_KEY = "imotara_settings_v1";

// ✅ Keep compatibility with SettingsScreen’s existing storage key
const PREFERRED_LANGUAGE_KEY = "imotara_preferredLanguage";

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

function makeLocalScopeId(): string {
    // Small, dependency-free unique id (good enough for local scoping)
    return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function normalizeToneContext(value: ToneContextPayload): ToneContextPayload {
    const base: ToneContextPayload = {
        user: { name: "" },
        companion: {
            enabled: false,
            name: "Imotara",
            relationship: "friend",
            ageTone: undefined,
            gender: undefined,
        },
    };

    const v: any = value && typeof value === "object" ? value : {};

    // Soft-merge into defaults (keeps API-safe shape)
    const merged: any = {
        ...base,
        ...v,
        user: { ...(base as any).user, ...(v.user || {}) },
        companion: { ...(base as any).companion, ...(v.companion || {}) },
    };

    const c: any = merged.companion;

    if (c && typeof c === "object") {
        // ✅ Accept legacy keys from older builds (backward compatible)
        if (c.gender == null && c.genderTone != null) c.gender = c.genderTone;
        if (c.relationship == null && c.relationshipTone != null)
            c.relationship = c.relationshipTone;

        // ✅ Keep parity if one of them exists (server may log/use both)
        if (c.ageTone == null && c.ageRange != null) c.ageTone = c.ageRange;
        if (c.ageRange == null && c.ageTone != null) c.ageRange = c.ageTone;

        // ✅ Normalize companion name when enabled
        const enabled = !!c.enabled;
        const name = typeof c.name === "string" ? c.name.trim() : "";
        if (enabled && !name) c.name = "Imotara";
    }

    return merged as ToneContextPayload;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
    // Keep your original defaults (non-breaking)
    const [emotionInsightsEnabled, _setEmotionInsightsEnabled] = useState(true);

    // Phase 2.4: History list preference (default: hide assistant replies)
    const [showAssistantRepliesInHistory, _setShowAssistantRepliesInHistory] =
        useState(false);
    const [lastSyncAt, _setLastSyncAt] = useState<number | null>(null);
    const [lastSyncStatus, _setLastSyncStatus] = useState<string | null>(null);

    // Default auto-sync delay: 8 seconds
    const [autoSyncDelaySeconds, _setAutoSyncDelaySeconds] =
        useState<number>(8);

    // ✅ New: explicit analysis mode control
    const [analysisMode, _setAnalysisMode] = useState<"auto" | "cloud" | "local">(
        "auto"
    );

    // ✅ New: tone context guidance (tone only; safe defaults)
    const [toneContext, _setToneContext] = useState<ToneContextPayload>({
        user: { name: "" },
        companion: {
            enabled: false,
            name: "Imotara",
            relationship: "friend",
            // ✅ undefined means “prefer not to say” (TS-safe, API-safe)
            ageTone: undefined,
            // ✅ payload uses `gender`, not `genderTone`
            gender: undefined,
        },
    });

    // ✅ Local device-only scope (prevents cross-user leakage when chatLinkKey is empty)
    const [localUserScopeId, _setLocalUserScopeId] = useState<string>(makeLocalScopeId());

    // ✅ Cross-device chat link key (optional)
    const [chatLinkKey, _setChatLinkKey] = useState<string>("");
    // ✅ Device-only reply language
    const [preferredLanguage, _setPreferredLanguage] = useState<"en" | "hi" | "bn">(
        "en"
    );

    const setPreferredLanguage = (value: "en" | "hi" | "bn") => {
        const v = String(value || "").trim().toLowerCase();
        if (v === "en" || v === "hi" || v === "bn") {
            _setPreferredLanguage(v as "en" | "hi" | "bn");
        }
    };
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
                const [raw, rawTier, rawLang] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEY),
                    AsyncStorage.getItem(LICENSE_TIER_KEY),
                    AsyncStorage.getItem(PREFERRED_LANGUAGE_KEY),
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

                        // ✅ Restore preferred language (new)
                        if ("preferredLanguage" in parsed) {
                            const v = String((parsed as any).preferredLanguage || "")
                                .trim()
                                .toLowerCase()
                                .split(/[-_]/)[0];
                            if (v === "en" || v === "hi" || v === "bn") {
                                _setPreferredLanguage(v as "en" | "hi" | "bn");
                            }
                        }

                        if ("showAssistantRepliesInHistory" in parsed) {
                            _setShowAssistantRepliesInHistory(
                                safeBool((parsed as any).showAssistantRepliesInHistory, false)
                            );
                        }

                        if ("autoSyncDelaySeconds" in parsed) {
                            _setAutoSyncDelaySeconds(
                                clampDelaySeconds(parsed.autoSyncDelaySeconds, 8)
                            );
                        }

                        // Restore analysis mode (backward compatible)
                        if ("analysisMode" in parsed) {
                            const v = String((parsed as any).analysisMode || "").toLowerCase();
                            if (v === "auto" || v === "cloud" || v === "local") {
                                _setAnalysisMode(v);
                            }
                        }

                        // Restore tone context (soft-merge into defaults + normalize)
                        if ("toneContext" in parsed) {
                            const v = (parsed as any).toneContext;
                            if (v && typeof v === "object") {
                                _setToneContext((prev) => {
                                    const merged: ToneContextPayload = {
                                        ...prev,
                                        ...v,
                                        user: { ...(prev.user || {}), ...(v.user || {}) },
                                        companion: {
                                            ...(prev.companion || {}),
                                            ...(v.companion || {}),
                                        },
                                    };

                                    // ✅ Normalize companion name when enabled (prevents empty name from old storage)
                                    if (
                                        merged.companion &&
                                        typeof merged.companion === "object" &&
                                        merged.companion.enabled
                                    ) {
                                        const name =
                                            typeof merged.companion.name === "string"
                                                ? merged.companion.name.trim()
                                                : "";

                                        if (!name) {
                                            merged.companion = {
                                                ...merged.companion,
                                                name: "Imotara",
                                            };
                                        }
                                    }

                                    return merged;
                                });
                            }
                        }

                        // Restore chat link key (optional)
                        if ("chatLinkKey" in parsed) {
                            const v = (parsed as any).chatLinkKey;
                            if (typeof v === "string") {
                                _setChatLinkKey(v.trim().slice(0, 80));
                            }
                        }

                        // Restore local user scope id (optional; added later)
                        if ("localUserScopeId" in parsed) {
                            const v = (parsed as any).localUserScopeId;
                            if (typeof v === "string" && v.trim()) {
                                _setLocalUserScopeId(v.trim().slice(0, 80));
                            }
                        }

                        // Restore local user scope id (optional; added later)
                        if ("localUserScopeId" in parsed) {
                            const v = (parsed as any).localUserScopeId;
                            if (typeof v === "string" && v.trim()) {
                                _setLocalUserScopeId(v.trim().slice(0, 80));
                            }
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

                // Ensure localUserScopeId is always present even for older installs
                if (alive) {
                    _setLocalUserScopeId((prev) => (prev && prev.trim() ? prev : makeLocalScopeId()));
                }

                // ✅ Back-compat: if payload didn't include it, read legacy key
                if (alive) {
                    _setPreferredLanguage((prev) => {
                        if (prev === "en" || prev === "hi" || prev === "bn") return prev;

                        const v = String(rawLang || "")
                            .trim()
                            .toLowerCase()
                            .split(/[-_]/)[0];

                        return v === "en" || v === "hi" || v === "bn"
                            ? (v as "en" | "hi" | "bn")
                            : "en";
                    });
                }

                // 2) License tier → cloud sync gate
                const tier: LicenseTier = isValidTier(rawTier) ? rawTier : "FREE";
                const g = gate("CLOUD_SYNC", tier);
                if (alive) {
                    setCloudSyncAllowed(g.enabled);

                }

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
            showAssistantRepliesInHistory,
            autoSyncDelaySeconds,
            lastSyncAt,
            lastSyncStatus,

            // ✅ New
            analysisMode,
            toneContext,

            // ✅ Device-only language
            preferredLanguage,

            // ✅ Local device-only scope (prevents cross-user leakage when chatLinkKey is empty)
            localUserScopeId,

            // ✅ Optional: cross-device chat link key
            chatLinkKey,
        };

        Promise.all([
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)),
            // ✅ Keep legacy key for compatibility
            AsyncStorage.setItem(PREFERRED_LANGUAGE_KEY, preferredLanguage),
        ]).catch((e) => {
            if (DEBUG_UI_ENABLED) console.warn("Settings save failed:", e);
        });
    }, [
        hydrated,
        emotionInsightsEnabled,
        showAssistantRepliesInHistory,
        autoSyncDelaySeconds,
        lastSyncAt,
        lastSyncStatus,
        analysisMode,
        toneContext,
        localUserScopeId,
        chatLinkKey,
    ]);

    // ---- Wrapped setters (non-breaking; same signatures) ----
    const setEmotionInsightsEnabled = (value: boolean) => {
        _setEmotionInsightsEnabled(!!value);
    };

    const setShowAssistantRepliesInHistory = (value: boolean) => {
        _setShowAssistantRepliesInHistory(!!value);
    };

    const setAutoSyncDelaySeconds = (value: number) => {
        _setAutoSyncDelaySeconds(clampDelaySeconds(value, 8));
    };

    const setLastSyncAt = (ts: number | null) => {
        _setLastSyncAt(typeof ts === "number" ? ts : null);
    };

    const setLastSyncStatus = (status: string | null) => {
        const next = typeof status === "string" ? status : null;

        // ✅ Only update when changed (prevents repeated renders / status spam)
        _setLastSyncStatus((prev) => (prev === next ? prev : next));
    };


    const setAnalysisMode = (value: "auto" | "cloud" | "local") => {
        const v = String(value).toLowerCase();
        if (v === "auto" || v === "cloud" || v === "local") {
            _setAnalysisMode(v as "auto" | "cloud" | "local");
        }
    };

    // ✅ Normalize toneContext into the shape our cloud API expects
    // - keeps backward compatibility with older stored keys (genderTone/ageTone)
    // - prevents enabled companion with empty name
    // - keeps both ageRange + ageTone in sync
    const normalizeToneContext = (value: ToneContextPayload): ToneContextPayload => {
        if (!value || typeof value !== "object") return value;

        const next: ToneContextPayload = { ...value };

        if (next.companion && typeof next.companion === "object") {
            const c: any = { ...(next.companion as any) };

            c.enabled = !!c.enabled;

            const rawName = typeof c.name === "string" ? c.name.trim() : "";
            if (c.enabled && !rawName) c.name = "Imotara";

            // Back-compat: genderTone -> gender
            if (!c.gender && c.genderTone) c.gender = c.genderTone;
            if (c.gender && !c.genderTone) c.genderTone = c.gender;
            // Cleanup junk key (we keep only `gender` in the outbound payload elsewhere)
            if ("genderTone" in c) delete c.genderTone;

            // Back-compat: ageTone <-> ageRange
            if (!c.ageRange && c.ageTone) c.ageRange = c.ageTone;
            if (!c.ageTone && c.ageRange) c.ageTone = c.ageRange;

            next.companion = c;
        }

        return next;
    };

    const setToneContext = (value: ToneContextPayload) => {
        if (!value || typeof value !== "object") return;
        _setToneContext(normalizeToneContext(value));
    };

    const setChatLinkKey = (value: string) => {
        const v = typeof value === "string" ? value.trim() : "";
        _setChatLinkKey(v.slice(0, 80));
    };

    const resetLocalUserScopeId = () => {
        _setLocalUserScopeId(makeLocalScopeId());
    };

    return (
        <SettingsContext.Provider
            value={{
                emotionInsightsEnabled,
                setEmotionInsightsEnabled,
                showAssistantRepliesInHistory,
                setShowAssistantRepliesInHistory,
                lastSyncAt,
                lastSyncStatus,
                setLastSyncAt,
                setLastSyncStatus,
                autoSyncDelaySeconds,
                setAutoSyncDelaySeconds,
                cloudSyncAllowed,
                refreshCloudSyncAllowed,
                debugUIEnabled: DEBUG_UI_ENABLED,
                analysisMode,
                setAnalysisMode,
                toneContext,
                setToneContext,
                localUserScopeId,
                resetLocalUserScopeId,
                chatLinkKey,
                setChatLinkKey,
                preferredLanguage,
                setPreferredLanguage,
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
