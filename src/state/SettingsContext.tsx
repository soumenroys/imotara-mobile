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
import { supabase } from "../lib/supabase/client";
import { buildApiUrl } from "../config/api";

type SettingsContextValue = {
    // Emotion insight toggle for Imotara replies
    emotionInsightsEnabled: boolean;
    setEmotionInsightsEnabled: (value: boolean) => void;

    // Quick-panel swipe gestures in Chat screen
    companionPanelEnabled: boolean;
    setCompanionPanelEnabled: (value: boolean) => void;
    planPanelEnabled: boolean;
    setPlanPanelEnabled: (value: boolean) => void;

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
     * ISO string of when the current trial / subscription expires.
     * Null if not on a timed license.
     */
    licenseExpiresAt: string | null;

    /**
     * Optional helper to re-check the current license tier from AsyncStorage
     * and recompute cloudSyncAllowed. Safe to call after setLicenseTier(...) in debug.
     */
    refreshCloudSyncAllowed: () => Promise<void>;

    /**
     * Re-fetch the license row from Supabase and update all in-memory + AsyncStorage state.
     * Call this after a successful in-app purchase.
     */
    refreshLicense: () => Promise<void>;

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

    /** Shows age-appropriate reflections with peer-supportive language. */
    teenMode: boolean;
    setTeenMode: (value: boolean) => void;

    /** Applies strict content filters for child safety. Requires Family/EDU/Enterprise tier. */
    childSafeMode: boolean;
    setChildSafeMode: (value: boolean) => void;

    /** Show "Synced to cloud" / "On this device only" badges on messages. Default false. */
    showSyncBadge: boolean;
    setShowSyncBadge: (value: boolean) => void;

    /** Companion reacts to user messages with mood-relevant emoji. Default true. */
    companionReactionsEnabled: boolean;
    setCompanionReactionsEnabled: (value: boolean) => void;

    /** Show hourly feature discovery tips in chat. Default true. */
    featureTipsEnabled: boolean;
    setFeatureTipsEnabled: (value: boolean) => void;

    // ── Phase 5: Org membership awareness ──────────────────────────────────────
    /** Org UUID if user belongs to an organisation, null otherwise. */
    orgId:   string | null;
    /** Display name of the organisation. */
    orgName: string | null;
    /** User's role in the org: owner | admin | member | null */
    orgRole: string | null;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
    undefined
);

const STORAGE_KEY = "imotara_settings_v1";
const ORG_CONTEXT_KEY = "imotara_org_context_v1";

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
const LICENSE_EXPIRES_AT_KEY = "imotara_license_expires_at_v1";

function isValidTier(v: unknown): v is LicenseTier {
    return (
        v === "FREE" ||
        v === "PLUS" ||
        v === "PREMIUM" ||
        v === "FAMILY" ||
        v === "EDU" ||
        v === "ENTERPRISE"
    );
}

function normalizeToneContext(value: ToneContextPayload): ToneContextPayload {
    const base: ToneContextPayload = {
        user: { name: "", preferredLang: "en" },
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
    const [companionPanelEnabled, _setCompanionPanelEnabled] = useState(true);
    const [planPanelEnabled, _setPlanPanelEnabled] = useState(true);
    const [teenMode, _setTeenMode] = useState(false);
    const [childSafeMode, _setChildSafeMode] = useState(false);
    const [showSyncBadge, _setShowSyncBadge] = useState(false); // default: hidden
    const [companionReactionsEnabled, _setCompanionReactionsEnabled] = useState(true); // default: on
    const [featureTipsEnabled, _setFeatureTipsEnabled] = useState(true); // default: visible

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
        "cloud"
    );

    // ✅ New: tone context guidance (tone only; safe defaults)
    const [toneContext, _setToneContext] = useState<ToneContextPayload>({
        user: { name: "", preferredLang: "en" },
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

    const [hydrated, setHydrated] = useState(false);


    // ✅ Licensing-derived flag (default FREE behavior: device-only)
    const [cloudSyncAllowed, setCloudSyncAllowed] = useState<boolean>(false);
    const [licenseExpiresAt, setLicenseExpiresAt] = useState<string | null>(null);
    const [orgId,   setOrgId]   = useState<string | null>(null);
    const [orgName, setOrgName] = useState<string | null>(null);
    const [orgRole, setOrgRole] = useState<string | null>(null);

    const refreshCloudSyncAllowed = async () => {
        try {
            const rawTier = await AsyncStorage.getItem(LICENSE_TIER_KEY);
            const tier: LicenseTier = isValidTier(rawTier) ? rawTier : "FREE";
            const g = gate("CLOUD_SYNC", tier);
            setCloudSyncAllowed(g.enabled);
        } catch (e) {
            setCloudSyncAllowed(false);
            if (DEBUG_UI_ENABLED) console.warn("License gate refresh failed:", e);
        }
    };

    const refreshLicense = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id || !session.access_token) return;

            // Use /api/license/status which calls resolveUserTier() — correctly handles
            // pool_assignment > org_override > org_tier > personal > free priority chain.
            // Direct DB reads miss pool assignments and tier overrides.
            const statusRes = await fetch(buildApiUrl("/api/license/status"), {
                method: "GET",
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (!statusRes.ok) return;
            const statusData = await statusRes.json();
            const lic = statusData?.license;
            if (!lic) return;

            const t = String(lic.tier || "free").toLowerCase();
            const mobileTier: LicenseTier =
                t === "pro" ? "PREMIUM" :
                t === "plus" ? "PLUS" :
                t === "family" ? "FAMILY" :
                t === "edu" ? "EDU" :
                t === "enterprise" ? "ENTERPRISE" : "FREE";
            const expiresAt: string | null = lic.expiresAt ?? null;

            // Fake licRow for org context lookup below
            const licOrgId = statusData?.org?.orgId ?? null;

            await AsyncStorage.setItem(LICENSE_TIER_KEY, mobileTier);
            if (expiresAt) {
                await AsyncStorage.setItem(LICENSE_EXPIRES_AT_KEY, expiresAt);
            } else {
                await AsyncStorage.removeItem(LICENSE_EXPIRES_AT_KEY);
            }

            setCloudSyncAllowed(gate("CLOUD_SYNC", mobileTier).enabled);
            setLicenseExpiresAt(expiresAt);

            // ── Phase 5: org membership awareness (from /api/license/status response) ──
            if (licOrgId) {
                try {
                    const orgCtx = statusData?.org;
                    const orgName = orgCtx?.orgName ?? null;
                    const orgRole = orgCtx?.orgRole ?? null;
                    setOrgId(licOrgId);
                    setOrgName(orgName);
                    setOrgRole(orgRole);
                    await AsyncStorage.setItem(ORG_CONTEXT_KEY, JSON.stringify({ orgId: licOrgId, orgName, orgRole }));
                } catch { /* fail open */ }
            } else {
                setOrgId(null); setOrgName(null); setOrgRole(null);
                await AsyncStorage.removeItem(ORG_CONTEXT_KEY);
            }
        } catch {
            // fail-open
        }
    };


    // ---- LIC-6 + LIC-7: sync real license tier + expiry from Supabase on sign-in ----
    // Fires on: SIGNED_IN, INITIAL_SESSION (app startup with existing session),
    // TOKEN_REFRESHED — all restore the real tier from Supabase including after reinstall.
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!session?.user?.id) return;

                // Auto-populate chatLinkKey with the user's auth ID on first sign-in
                // so cloud history pull works cross-device without manual setup.
                // Read from AsyncStorage directly to avoid stale closure state.
                try {
                    const raw = await AsyncStorage.getItem(STORAGE_KEY);
                    const existingKey = raw ? (JSON.parse(raw) as any)?.chatLinkKey : null;
                    if (!existingKey?.trim()) {
                        _setChatLinkKey(session.user.id.slice(0, 80));
                    }
                } catch {
                    // Non-fatal — chatLinkKey will remain empty and pull will be skipped this session
                }

                try {
                    const { data: licRow } = await supabase
                        .from("licenses")
                        .select("tier, expires_at")
                        .eq("user_id", session.user.id)
                        .maybeSingle();

                    if (!licRow) return;

                    const t = String(licRow.tier || "free").toLowerCase();
                    const mobileTier: LicenseTier =
                        t === "pro" ? "PREMIUM" :
                        t === "plus" ? "PLUS" :
                        t === "family" ? "FAMILY" :
                        t === "edu" ? "EDU" :
                        t === "enterprise" ? "ENTERPRISE" : "FREE";

                    const expiresAt: string | null = licRow.expires_at ?? null;

                    await AsyncStorage.setItem(LICENSE_TIER_KEY, mobileTier);
                    if (expiresAt) {
                        await AsyncStorage.setItem(LICENSE_EXPIRES_AT_KEY, expiresAt);
                    } else {
                        await AsyncStorage.removeItem(LICENSE_EXPIRES_AT_KEY);
                    }

                    const g = gate("CLOUD_SYNC", mobileTier);
                    setCloudSyncAllowed(g.enabled);
                    setLicenseExpiresAt(expiresAt);
                } catch {
                    // Fail-open: keep current tier if Supabase is unreachable
                }
            }
        );
        return () => subscription.unsubscribe();
    }, []);

    // ---- Hydrate once ----
    useEffect(() => {
        let alive = true;

        const hydrate = async () => {
            try {
                // ✅ hydrate settings + compute license gate in parallel
                const [raw, rawTier, rawExpiresAt, rawOrg] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEY),
                    AsyncStorage.getItem(LICENSE_TIER_KEY),
                    AsyncStorage.getItem(LICENSE_EXPIRES_AT_KEY),
                    AsyncStorage.getItem(ORG_CONTEXT_KEY),
                ]);

                // ── Phase 5: restore org context from cache ───────────────────
                if (alive && rawOrg) {
                    try {
                        const orgCtx = JSON.parse(rawOrg);
                        if (orgCtx?.orgId)   setOrgId(orgCtx.orgId);
                        if (orgCtx?.orgName) setOrgName(orgCtx.orgName);
                        if (orgCtx?.orgRole) setOrgRole(orgCtx.orgRole);
                    } catch { /* ignore */ }
                }

                // 1) Settings payload
                if (raw) {
                    const parsed = JSON.parse(raw);

                    if (alive && parsed && typeof parsed === "object") {
                        if ("emotionInsightsEnabled" in parsed) {
                            _setEmotionInsightsEnabled(
                                safeBool(parsed.emotionInsightsEnabled, true)
                            );
                        }

                        if ("companionPanelEnabled" in parsed) {
                            _setCompanionPanelEnabled(safeBool((parsed as any).companionPanelEnabled, true));
                        }

                        if ("planPanelEnabled" in parsed) {
                            _setPlanPanelEnabled(safeBool((parsed as any).planPanelEnabled, true));
                        }

                        if ("teenMode" in parsed) {
                            _setTeenMode(safeBool((parsed as any).teenMode, false));
                        }

                        if ("childSafeMode" in parsed) {
                            _setChildSafeMode(safeBool((parsed as any).childSafeMode, false));
                        }

                        if ("showSyncBadge" in parsed) {
                            _setShowSyncBadge(safeBool((parsed as any).showSyncBadge, false));
                        }

                        if ("companionReactionsEnabled" in parsed) {
                            _setCompanionReactionsEnabled(safeBool((parsed as any).companionReactionsEnabled, true));
                        }

                        if ("featureTipsEnabled" in parsed) {
                            _setFeatureTipsEnabled(safeBool((parsed as any).featureTipsEnabled, true));
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

                // 2) License tier — read from AsyncStorage first (fast path)
                const localTier: LicenseTier = isValidTier(rawTier) ? rawTier : "FREE";
                if (alive) {
                    setCloudSyncAllowed(gate("CLOUD_SYNC", localTier).enabled);
                    setLicenseExpiresAt(rawExpiresAt ?? null);
                }

                // 3) Always sync real license from Supabase on startup if signed in.
                //    Handles reinstall (AsyncStorage cleared) and cases where
                //    onAuthStateChange INITIAL_SESSION fires before this hydration.
                //    Fire-and-forget — doesn't block hydration completing.
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session?.user?.id && alive) {
                        refreshLicense().catch(() => {});
                    }
                }).catch(() => {});

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
            companionPanelEnabled,
            planPanelEnabled,
            teenMode,
            childSafeMode,
            showSyncBadge,
            companionReactionsEnabled,
            featureTipsEnabled,
            showAssistantRepliesInHistory,
            autoSyncDelaySeconds,
            lastSyncAt,
            lastSyncStatus,

            // ✅ New
            analysisMode,
            toneContext,

            // ✅ Local device-only scope (prevents cross-user leakage when chatLinkKey is empty)
            localUserScopeId,

            // ✅ Optional: cross-device chat link key
            chatLinkKey,
        };

        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch((e) => {
            if (DEBUG_UI_ENABLED) console.warn("Settings save failed:", e);
        });
    }, [
        hydrated,
        emotionInsightsEnabled,
        companionPanelEnabled,
        planPanelEnabled,
        teenMode,
        showSyncBadge,
        companionReactionsEnabled,
        featureTipsEnabled,
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

    const setCompanionPanelEnabled = (value: boolean) => {
        _setCompanionPanelEnabled(!!value);
    };

    const setPlanPanelEnabled = (value: boolean) => {
        _setPlanPanelEnabled(!!value);
    };

    const setTeenMode = (value: boolean) => {
        _setTeenMode(!!value);
    };

    const setChildSafeMode = (value: boolean) => {
        _setChildSafeMode(!!value);
    };

    const setShowSyncBadge = (value: boolean) => {
        _setShowSyncBadge(!!value);
    };

    const setCompanionReactionsEnabled = (value: boolean) => {
        _setCompanionReactionsEnabled(!!value);
    };

    const setFeatureTipsEnabled = (value: boolean) => {
        _setFeatureTipsEnabled(!!value);
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
                companionPanelEnabled,
                setCompanionPanelEnabled,
                planPanelEnabled,
                setPlanPanelEnabled,
                showAssistantRepliesInHistory,
                setShowAssistantRepliesInHistory,
                lastSyncAt,
                lastSyncStatus,
                setLastSyncAt,
                setLastSyncStatus,
                autoSyncDelaySeconds,
                setAutoSyncDelaySeconds,
                cloudSyncAllowed,
                licenseExpiresAt,
                refreshCloudSyncAllowed,
                refreshLicense,
                debugUIEnabled: DEBUG_UI_ENABLED,
                analysisMode,
                setAnalysisMode,
                toneContext,
                setToneContext,
                localUserScopeId,
                resetLocalUserScopeId,
                chatLinkKey,
                setChatLinkKey,
                teenMode,
                setTeenMode,
                childSafeMode,
                setChildSafeMode,
                showSyncBadge,
                setShowSyncBadge,
                companionReactionsEnabled,
                setCompanionReactionsEnabled,
                featureTipsEnabled,
                setFeatureTipsEnabled,
                orgId,
                orgName,
                orgRole,
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
