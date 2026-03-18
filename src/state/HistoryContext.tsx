// src/state/HistoryContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useCallback,
    type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    pushRemoteHistory,
    fetchRemoteHistorySince,
    type PushRemoteHistoryResult,
    type FetchRemoteHistoryResult,
} from "../api/historyClient";

import { fetchRemoteChatMessages } from "../api/aiClient";

/** Merge two timestamp-sorted arrays in O(n+m) instead of O((n+m) log(n+m)). */
function mergeSorted<T extends { timestamp?: number }>(a: T[], b: T[]): T[] {
    const result: T[] = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
        if ((a[i].timestamp ?? 0) <= (b[j].timestamp ?? 0)) result.push(a[i++]);
        else result.push(b[j++]);
    }
    while (i < a.length) result.push(a[i++]);
    while (j < b.length) result.push(b[j++]);
    return result;
}


import { useSettings } from "./SettingsContext";
import { DEBUG_UI_ENABLED } from "../config/debug";

// ✅ Licensing gates (foundation)
import type { LicenseTier } from "../licensing/featureGates";
import { gate } from "../licensing/featureGates";

export type HistoryItem = {
    id: string;
    text: string;
    from: "user" | "bot";
    timestamp: number;

    // ✅ Additive: persist emotion for UI chips/history parity
    emotion?: string;
    intensity?: number;

    /**
     * Lite sync metadata:
     * - undefined or false → only known locally
     * - true → this record is known to exist in the cloud as well
     */
    isSynced?: boolean;
};


type MergeRemoteResult = {
    /** How many raw items were passed in (if array). */
    totalRemote: number;
    /** How many of those were valid after normalization. */
    normalized: number;
    /** How many new records were actually added (non-duplicates). */
    added: number;
};

type HistoryContextValue = {
    history: HistoryItem[];
    addToHistory: (item: HistoryItem) => void;
    clearHistory: () => void;
    deleteFromHistory: (id: string) => void;

    /**
     * Best-effort sync of current history to the backend.
     * Only pushes unsynced records; on success, marks them as synced.
     * Never throws; returns a small status object instead.
     */
    pushHistoryToRemote: () => Promise<PushRemoteHistoryResult>;

    /**
     * Additive helper for lifecycle/manual triggers:
     * - Deduped and timer-safe
     * - Clears pending autosync timer before running
     */
    runSync: (opts?: { reason?: string }) => Promise<PushRemoteHistoryResult>;

    /**
     * Alias for runSync (for flexible callers).
     */
    syncNow: (opts?: { reason?: string }) => Promise<PushRemoteHistoryResult>;

    /**
     * Merge raw remote history items into the local store.
     * - Normalizes arbitrary backend shapes into HistoryItem
     * - Skips invalid / empty entries
     * - Avoids duplicates by id
     * - Marks merged records as isSynced: true
     */
    mergeRemoteHistory: (rawItems: unknown[]) => MergeRemoteResult;

    /**
     * Lite sync status for Mobile Sync Phase 2:
     * - isSyncing: true while a push is in flight
     * - lastSyncResult: last push result (ok/error)
     * - lastSyncAt: timestamp of last completed push (success or failure)
     * - hasUnsyncedChanges: derived flag (any !isSynced items)
     */
    isSyncing: boolean;
    lastSyncResult: PushRemoteHistoryResult | null;
    lastSyncAt: number | null;
    hasUnsyncedChanges: boolean;

    /**
     * Pairs of items that look like duplicates (same sender, same text fingerprint,
     * timestamps within 60 s, different IDs). Typically arise when the same message
     * arrives from both a local write and a remote pull.
     */
    potentialDuplicates: Array<[HistoryItem, HistoryItem]>;

    /**
     * Licensing state (foundation):
     * Default: FREE
     * Persisted in AsyncStorage so it survives app restarts.
     */
    licenseTier: LicenseTier;
    setLicenseTier: (tier: LicenseTier) => void;
};

// Base keys (scoped per chatLinkKey when present)
const STORAGE_KEY_BASE = "imotara_history_v1";

// ✅ Cursor for remote history incremental sync (also should be scoped)
const HISTORY_REMOTE_SINCE_KEY_BASE = "imotara_history_remote_since_v1";

/**
 * Storage keys must be scoped so different identities don't see each other's history.
 * - If chatLinkKey exists: use per-scope key
 * - Else: fall back to local-only bucket
 */
/**
 * Storage keys must be scoped so different identities don't see each other's history.
 * - If chatLinkKey exists: use per-scope key (cross-device)
 * - Else: use device-local scope id (prevents cross-user leakage on same device)
 *
 * We keep a legacy local key for safe migration from older builds.
 */
function legacyLocalKey(base: string) {
    return `${base}:local`;
}

function scopedKey(base: string, chatLinkKey: unknown, localUserScopeId: unknown) {
    const scope = String(chatLinkKey ?? "").trim();
    if (scope) return `${base}:${scope}`;

    const local = String(localUserScopeId ?? "").trim();
    return local ? `${base}:local:${local}` : legacyLocalKey(base);
}

// ✅ Separate storage key for licensing
const LICENSE_TIER_KEY = "imotara_license_tier_v1";

// 🚀 Launch Phase Override (temporary: free cloud sync for all users)
// This is tied to the same launch offer logic used by the web app.
// Set EXPO_PUBLIC_IMOTARA_LAUNCH_DATE to an ISO date and optionally
// EXPO_PUBLIC_IMOTARA_FREE_DAYS to the duration (default 90).
const LAUNCH_CLOUD_SYNC_FREE_FOR_ALL = (() => {
    const raw = process.env.EXPO_PUBLIC_IMOTARA_LAUNCH_DATE;
    if (!raw) return true; // default to true for backwards compatibility

    const launchMs = Date.parse(raw);
    if (Number.isNaN(launchMs)) return true;

    const freeDays = parseInt(process.env.EXPO_PUBLIC_IMOTARA_FREE_DAYS ?? "90", 10) || 90;
    const endsAt = launchMs + freeDays * 24 * 60 * 60 * 1000;
    return Date.now() < endsAt;
})();

// ✅ Validation helper (keeps stored values safe)
function isValidTier(v: unknown): v is LicenseTier {
    return (
        v === "FREE" ||
        v === "PREMIUM" ||
        v === "FAMILY" ||
        v === "EDU" ||
        v === "ENTERPRISE"
    );
}

const HistoryContext = createContext<HistoryContextValue | undefined>(
    undefined
);

function debugWarn(...args: any[]) {
    if (DEBUG_UI_ENABLED) console.warn(...args);
}
function debugLog(...args: any[]) {
    if (DEBUG_UI_ENABLED) console.log(...args);
}

/**
 * Normalize any incoming remote object to a strict HistoryItem shape.
 * This is intentionally permissive so it can handle:
 * - Direct chat records from /api/history
 * - Analysis-like objects with `summary` / `reflections`
 * - Older shapes that used `message`, `content`, etc.
 */
function normalizeRemoteItem(raw: any): HistoryItem | null {
    if (!raw || typeof raw !== "object") return null;

    const pickStr = (v: any): string => (typeof v === "string" ? v : "");

    // ----- 1) Extract text (many fallbacks) -----
    let text: string =
        pickStr(raw.text) ||
        pickStr(raw.message) || // backend commonly uses this
        pickStr(raw.content) ||
        pickStr(raw.body) ||
        pickStr(raw.prompt) ||
        "";

    // Try reflections[0].text if still empty
    if (
        !text.trim() &&
        Array.isArray(raw.reflections) &&
        raw.reflections.length > 0
    ) {
        const first = raw.reflections[0];
        text = pickStr(first?.text) || text;
    }

    // Try summary.headline/details
    if (!text.trim() && raw.summary && typeof raw.summary === "object") {
        const headline = pickStr(raw.summary.headline);
        const details = pickStr(raw.summary.details);
        const combined = [headline, details].filter(Boolean).join(" — ");
        if (combined.trim()) text = combined;
    }

    // Additional generic fallbacks
    if (!text.trim()) {
        text = pickStr(raw.description) || pickStr(raw.title) || text;
    }

    if (!text || !text.trim()) return null;

    // ----- 2) Determine "from" (user vs bot) -----
    const roleLike: string =
        pickStr(raw.from) ||
        pickStr(raw.role) ||
        pickStr(raw.author) ||
        pickStr(raw.speaker) ||
        pickStr(raw.source);

    let from: "user" | "bot" = "bot";
    const roleLower = roleLike.toLowerCase();

    if (roleLower === "user" || roleLower === "human" || roleLower === "you") {
        from = "user";
    } else if (
        roleLower === "assistant" ||
        roleLower === "bot" ||
        roleLower === "imotara" ||
        roleLower === "ai"
    ) {
        from = "bot";
    } else if (raw.isUser === true) {
        from = "user";
    } else if (!roleLike && !raw.isUser) {
        if (raw.summary || raw.snapshot || raw.reflections) {
            from = "bot";
        }
    }

    // ----- 3) Determine timestamp (number, ms) -----
    let timestamp: number;

    if (typeof raw.timestamp === "number") {
        timestamp = raw.timestamp;
    } else if (typeof raw.computedAt === "number") {
        timestamp = raw.computedAt;
    } else if (
        Array.isArray(raw.reflections) &&
        raw.reflections.length > 0 &&
        typeof raw.reflections[0]?.createdAt === "number"
    ) {
        timestamp = raw.reflections[0].createdAt;
    } else if (typeof raw.createdAt === "number") {
        timestamp = raw.createdAt;
    } else if (typeof raw.createdAt === "string") {
        const parsed = Date.parse(raw.createdAt);
        timestamp = Number.isNaN(parsed) ? Date.now() : parsed;
    } else {
        timestamp = Date.now();
    }

    // If backend gives seconds instead of ms, convert (simple heuristic)
    if (timestamp < 1e12) timestamp = timestamp * 1000;

    // ----- 4) Determine id (string) -----
    const baseId =
        (raw.id as string) ||
        (raw._id as string) ||
        `remote-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;

    const id = String(baseId);

    // ----- 5) Optional emotion (permissive) -----
    const meta = raw?.meta;

    const metaEmotionObj =
        meta && typeof meta === "object" && (meta as any).emotion && typeof (meta as any).emotion === "object"
            ? (meta as any).emotion
            : undefined;

    const emotionRaw =
        pickStr(raw.emotion) ||
        pickStr(raw.emotionLabel) ||
        (meta && typeof meta === "object" ? pickStr((meta as any).emotionLabel) : "") ||
        (metaEmotionObj ? pickStr(metaEmotionObj.primary) : "");

    const emotion = emotionRaw.trim() ? emotionRaw.trim() : undefined;

    const intensityRaw =
        raw?.intensity ??
        (meta && typeof meta === "object" ? (meta as any).intensity : undefined) ??
        (metaEmotionObj ? metaEmotionObj.intensity : undefined);

    const intensity =
        typeof intensityRaw === "number" && Number.isFinite(intensityRaw)
            ? intensityRaw
            : typeof intensityRaw === "string"
                ? intensityRaw === "high"
                    ? 1
                    : intensityRaw === "medium"
                        ? 0.66
                        : intensityRaw === "low"
                            ? 0.33
                            : undefined
                : undefined;

    return {
        id,
        text,
        from,
        timestamp,

        // ✅ Additive: store emotion if present
        emotion,
        intensity,

        // Anything coming from the backend is, by definition, synced.
        isSynced: true,
    };

}

export default function HistoryProvider({ children }: { children: ReactNode }) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [hydrated, setHydrated] = useState(false);

    // ✅ Licensing state (default FREE; hydrated from AsyncStorage)
    const [licenseTier, _setLicenseTier] = useState<LicenseTier>("FREE");

    // Lite sync status state for Mobile Sync Phase 2
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncResult, setLastSyncResult] =
        useState<PushRemoteHistoryResult | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

    // Auto-sync delay (seconds) AND global “last sync” setters from Settings
    const {
        autoSyncDelaySeconds,
        setLastSyncAt: setSettingsLastSyncAt,
        setLastSyncStatus: setSettingsLastSyncStatus,

        // ✅ Privacy: if local-only, do not touch cloud
        analysisMode,

        // ✅ Local device-only scope (prevents cross-user leakage when chatLinkKey is empty)
        localUserScopeId,

        // ✅ Cross-device identity scope
        chatLinkKey,

        // ✅ NEW: license-aware flag from SettingsContext
        cloudSyncAllowed,
    } = useSettings();

    // ✅ Keep latest history ref to avoid function identity churn
    const historyRef = useRef<HistoryItem[]>([]);
    useEffect(() => {
        historyRef.current = history;
    }, [history]);

    // ✅ Keep latest Chat Link Key (scope) to prevent in-flight remote pulls from older scopes
    const chatLinkKeyRef = useRef<string>("");
    useEffect(() => {
        chatLinkKeyRef.current = String(chatLinkKey ?? "").trim();
    }, [chatLinkKey]);

    // ✅ Final guard: dedupe-by-id + stable timestamp sort (prevents rare overlap duplicates)
    const dedupeAndSortHistory = useCallback(() => {
        setHistory((prev) => {
            const byId = new Map<string, HistoryItem>();
            for (const it of prev) {
                if (it?.id) byId.set(it.id, it);
            }
            return Array.from(byId.values()).sort(
                (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
            );
        });
    }, []);


    // ✅ Cursor for incremental remote pulls
    const remoteSinceRef = useRef<number>(0);

    // ✅ Prevent overlapping pushes (manual + background + lifecycle)
    const isPushInFlightRef = useRef(false);

    // Timer holder for background auto-sync (RN-safe type)
    const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Foreground/manual dedupe guard (prevents sync bursts)
    const lastRunSyncAtRef = useRef<number>(0);
    const runSyncInFlightRef = useRef(false);

    const clearAutoSyncTimer = useCallback(() => {
        if (autoSyncTimerRef.current) {
            clearTimeout(autoSyncTimerRef.current);
            autoSyncTimerRef.current = null;
        }
    }, []);

    // ✅ Public setter with persistence (safe; does not affect existing logic)
    const setLicenseTier = useCallback((tier: LicenseTier) => {
        _setLicenseTier(tier);
        AsyncStorage.setItem(LICENSE_TIER_KEY, tier).catch((err) =>
            debugWarn("Failed to persist license tier:", err)
        );
    }, []);

    // ✅ Hydrate from AsyncStorage whenever Chat Link Key changes (prevents cross-scope leakage)
    useEffect(() => {
        const load = async () => {
            // IMPORTANT: switching scope must clear in-memory history immediately
            setHydrated(false);
            setHistory([]);
            historyRef.current = [];
            remoteSinceRef.current = 0;

            try {
                const historyKey = scopedKey(STORAGE_KEY_BASE, chatLinkKey, localUserScopeId);
                const remoteSinceKey = scopedKey(
                    HISTORY_REMOTE_SINCE_KEY_BASE,
                    chatLinkKey,
                    localUserScopeId
                );

                // Legacy migration for older installs that stored local history in `${base}:local`
                const chatLinkKeyVal = String(chatLinkKey ?? "").trim();
                const shouldTryLegacyLocal = !chatLinkKeyVal;
                const legacyHistoryKey = shouldTryLegacyLocal
                    ? legacyLocalKey(STORAGE_KEY_BASE)
                    : null;
                const legacyRemoteSinceKey = shouldTryLegacyLocal
                    ? legacyLocalKey(HISTORY_REMOTE_SINCE_KEY_BASE)
                    : null;

                // Account-link migration: when chatLinkKey was just set for the first time,
                // carry over history that was written under the local-scope key (no chatLinkKey)
                const preLinkHistoryKey = chatLinkKeyVal && localUserScopeId
                    ? scopedKey(STORAGE_KEY_BASE, null, localUserScopeId)
                    : null;
                const preLinkRemoteSinceKey = chatLinkKeyVal && localUserScopeId
                    ? scopedKey(HISTORY_REMOTE_SINCE_KEY_BASE, null, localUserScopeId)
                    : null;

                const [
                    rawHistoryNew,
                    rawTier,
                    rawRemoteSinceNew,
                    rawHistoryLegacy,
                    rawRemoteSinceLegacy,
                    rawHistoryPreLink,
                    rawRemoteSincePreLink,
                ] = await Promise.all([
                    AsyncStorage.getItem(historyKey),
                    AsyncStorage.getItem(LICENSE_TIER_KEY),
                    AsyncStorage.getItem(remoteSinceKey),
                    legacyHistoryKey ? AsyncStorage.getItem(legacyHistoryKey) : Promise.resolve(null),
                    legacyRemoteSinceKey
                        ? AsyncStorage.getItem(legacyRemoteSinceKey)
                        : Promise.resolve(null),
                    preLinkHistoryKey ? AsyncStorage.getItem(preLinkHistoryKey) : Promise.resolve(null),
                    preLinkRemoteSinceKey ? AsyncStorage.getItem(preLinkRemoteSinceKey) : Promise.resolve(null),
                ]);

                // Prefer primary key, fall back to pre-link local scope, then legacy local key
                const rawHistory = rawHistoryNew ?? rawHistoryPreLink ?? rawHistoryLegacy;
                const rawRemoteSince = rawRemoteSinceNew ?? rawRemoteSincePreLink ?? rawRemoteSinceLegacy;

                // 0) Remote cursor (since)
                if (rawRemoteSince) {
                    const n = Number(rawRemoteSince);
                    if (Number.isFinite(n) && n >= 0) {
                        remoteSinceRef.current = n;
                    }
                }

                if (!rawRemoteSinceNew && rawRemoteSincePreLink && preLinkRemoteSinceKey) {
                    AsyncStorage.setItem(remoteSinceKey, rawRemoteSincePreLink).catch(() => { });
                } else if (!rawRemoteSinceNew && rawRemoteSinceLegacy && legacyRemoteSinceKey) {
                    AsyncStorage.setItem(remoteSinceKey, rawRemoteSinceLegacy).catch(() => { });
                }

                // 1) History
                if (rawHistory) {
                    const parsed = JSON.parse(rawHistory);

                    if (Array.isArray(parsed)) {
                        const cleaned: HistoryItem[] = parsed
                            .filter((item) => item && typeof item === "object")
                            .map((item) => {
                                const id = String((item as any).id ?? "").trim();

                                // HistoryItem in this project uses: text, from, timestamp
                                const text = String((item as any).text ?? (item as any).content ?? "");

                                // Correctly map "user" → "user", everything else ("bot"/"assistant") → "bot"
                                const fromRaw = String((item as any).from ?? (item as any).role ?? "user");
                                const from: "user" | "bot" = fromRaw === "user" ? "user" : "bot";

                                const timestampRaw = (item as any).timestamp ?? (item as any).createdAt;
                                const timestamp =
                                    typeof timestampRaw === "number" ? timestampRaw : Date.now();

                                if (!id || !text) return null;

                                // Preserve optional metadata so moodSummary and sync state survive restarts
                                const emotionRaw = (item as any).emotion;
                                const intensityRaw = (item as any).intensity;
                                const isSyncedRaw = (item as any).isSynced;

                                return {
                                    id,
                                    text,
                                    from,
                                    timestamp,
                                    ...(typeof emotionRaw === "string" && emotionRaw.trim()
                                        ? { emotion: emotionRaw.trim() }
                                        : {}),
                                    ...(typeof intensityRaw === "number" && Number.isFinite(intensityRaw)
                                        ? { intensity: intensityRaw }
                                        : {}),
                                    ...(typeof isSyncedRaw === "boolean"
                                        ? { isSynced: isSyncedRaw }
                                        : {}),
                                } as HistoryItem;
                            })
                            .filter(Boolean) as HistoryItem[];

                        setHistory(cleaned);
                        // Migrate pre-link local history into the new chatLinkKey-scoped key
                        if (!rawHistoryNew && rawHistoryPreLink && preLinkHistoryKey) {
                            AsyncStorage.setItem(historyKey, rawHistoryPreLink).catch(() => { });
                        } else if (!rawHistoryNew && rawHistoryLegacy && legacyHistoryKey) {
                            // Migrate legacy local key (older installs)
                            AsyncStorage.setItem(historyKey, rawHistoryLegacy).catch(() => { });
                        }
                    }
                }

                // 2) License tier
                // Only set if it matches this app's LicenseTier union
                if (rawTier && isValidTier(rawTier)) {
                    _setLicenseTier(rawTier);
                }
            } catch (error) {
                debugWarn("Failed to load history/license from storage:", error);
            } finally {
                setHydrated(true);
            }
        };

        load();
    }, [chatLinkKey, localUserScopeId]);

    // ✅ Apply local history retention on FREE (but never delete unsynced items)
    useEffect(() => {
        if (!hydrated) return;

        const g = gate("HISTORY_DAYS_LIMIT", licenseTier);
        const daysRaw =
            g.enabled && typeof (g as any).params?.days !== "undefined"
                ? (g as any).params?.days
                : undefined;

        const days =
            typeof daysRaw === "number" && Number.isFinite(daysRaw)
                ? daysRaw
                : Infinity;

        // Unlimited → no pruning
        if (!Number.isFinite(days) || days === Infinity) return;

        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

        const current = historyRef.current || [];
        const pruned = current.filter((item) => {
            // Never delete unsynced items (prevents data loss on FREE)
            if (!item.isSynced) return true;

            const ts =
                typeof item.timestamp === "number" ? item.timestamp : Date.now();
            return ts >= cutoff;
        });

        if (pruned.length !== current.length) {
            setHistory(pruned);
        }
    }, [hydrated, licenseTier]);

    // Persist to AsyncStorage whenever history changes (after hydration)
    useEffect(() => {
        if (!hydrated) return;

        const save = async () => {
            try {
                const historyKey = scopedKey(STORAGE_KEY_BASE, chatLinkKey, localUserScopeId);
                await AsyncStorage.setItem(historyKey, JSON.stringify(history));
            } catch (error) {
                debugWarn("Failed to save history to storage:", error);
            }
        };

        save();
    }, [history, hydrated]);

    const addToHistory = (item: HistoryItem) => {
        // Preserve existing behavior, but make it consistent:
        // any new local item should be unsynced unless explicitly marked.
        const normalized: HistoryItem = {
            ...item,
            isSynced: typeof item.isSynced === "boolean" ? item.isSynced : false,
        };
        setHistory((prev) => [...prev, normalized]);
    };

    const clearHistory = () => {
        setHistory([]);
        // Reset sync UI state too (avoids stale “synced just now” after clearing)
        setIsSyncing(false);
        setLastSyncResult(null);
        setLastSyncAt(null);

        const historyKey = scopedKey(STORAGE_KEY_BASE, chatLinkKey, localUserScopeId);
        AsyncStorage.removeItem(historyKey).catch((err) =>
            debugWarn("Failed to clear history storage:", err)
        );
    };

    const deleteFromHistory = (id: string) => {
        setHistory((prev) => prev.filter((item) => item.id !== id));
    };

    const pushHistoryToRemote = useCallback(async (): Promise<PushRemoteHistoryResult> => {
        // Avoid overlap (especially with background auto-sync / foreground resume)
        if (isPushInFlightRef.current) {
            return {
                ok: false,
                pushed: 0,
                status: -2,
                errorMessage: "Sync already in progress",
            };
        }

        // ✅ Hardening: FREE / gated users must not attempt cloud push (manual or background)
        if (!cloudSyncAllowed && !LAUNCH_CLOUD_SYNC_FREE_FOR_ALL) {
            const now = Date.now();
            const result: PushRemoteHistoryResult = {
                ok: false,
                pushed: 0,
                status: -4,
                errorMessage: "Cloud sync not available on this plan",
            };

            setLastSyncResult(result);
            setLastSyncAt(now);
            setSettingsLastSyncAt(now);
            setSettingsLastSyncStatus(
                "Cloud sync is not available on your plan."
            );

            return result;
        }

        // If a push starts, cancel any pending autosync timer (prevents double-fire)
        clearAutoSyncTimer();

        isPushInFlightRef.current = true;

        setIsSyncing(true);
        setLastSyncResult(null);


        try {
            const currentHistory = historyRef.current || [];
            const unsynced = currentHistory.filter((h) => !h.isSynced);

            if (unsynced.length === 0) {
                const result: PushRemoteHistoryResult = {
                    ok: true,
                    pushed: 0,
                    status: 0,
                };
                const now = Date.now();

                setLastSyncResult(result);
                setLastSyncAt(now);

                setSettingsLastSyncAt(now);
                setSettingsLastSyncStatus(
                    "Sync checked · nothing new to push from this device."
                );

                return result;
            }

            const result = await pushRemoteHistory(unsynced);
            const now = Date.now();

            if (result.ok) {
                const pushedIds = new Set(unsynced.map((h) => h.id));

                setHistory((prev) =>
                    prev.map((item) =>
                        pushedIds.has(item.id)
                            ? { ...item, isSynced: true }
                            : item
                    )
                );

                setLastSyncResult(result);
                setLastSyncAt(now);

                const pushedCount =
                    typeof result.pushed === "number" ? result.pushed : 0;

                setSettingsLastSyncAt(now);
                setSettingsLastSyncStatus(
                    pushedCount > 0
                        ? `Synced ${pushedCount} item(s) from this device to Imotara cloud.`
                        : "Sync checked · nothing new to push from this device."
                );
            } else {
                setLastSyncResult(result);
                setLastSyncAt(now);

                setSettingsLastSyncAt(now);
                setSettingsLastSyncStatus(
                    `Sync failed: ${result.errorMessage || "Network / backend error."}`
                );
            }

            return result;
        } catch (error) {
            debugWarn("pushHistoryToRemote error:", error);

            const now = Date.now();
            const fallback: PushRemoteHistoryResult = {
                ok: false,
                pushed: 0,
                status: -1,
                errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
            };

            setLastSyncResult(fallback);
            setLastSyncAt(now);

            setSettingsLastSyncAt(now);
            setSettingsLastSyncStatus(
                `Sync error: ${fallback.errorMessage || "Unknown error."}`
            );

            return fallback;
        } finally {
            setIsSyncing(false);
            isPushInFlightRef.current = false;
        }
    }, [
        clearAutoSyncTimer,
        setSettingsLastSyncAt,
        setSettingsLastSyncStatus,
        cloudSyncAllowed,
    ]);


    const runSync = useCallback(
        async (opts?: { reason?: string }): Promise<PushRemoteHistoryResult> => {
            const now = Date.now();

            if (DEBUG_UI_ENABLED && opts?.reason) {
                debugLog("runSync triggered:", opts.reason);
            }

            // Guard: don't sync before local storage has been loaded (prevents clobbering local data)
            if (!hydrated) {
                return {
                    ok: false,
                    pushed: 0,
                    status: -4,
                    errorMessage: "Not yet hydrated",
                };
            }

            // Throttle foreground-trigger bursts (does not affect autosync scheduling)
            if (now - lastRunSyncAtRef.current < 900) {
                return {
                    ok: false,
                    pushed: 0,
                    status: -3,
                    errorMessage: "Sync trigger throttled",
                };
            }

            // Avoid overlap of runSync callers (separate from push overlap)
            if (runSyncInFlightRef.current) {
                return {
                    ok: false,
                    pushed: 0,
                    status: -2,
                    errorMessage: "Sync already in progress",
                };
            }

            lastRunSyncAtRef.current = now;
            runSyncInFlightRef.current = true;

            try {
                clearAutoSyncTimer();

                // 1) Push local unsynced → backend (existing behavior)
                const pushRes = await pushHistoryToRemote();

                // ✅ Hardening: if cloud is gated off, do not attempt remote pull either
                // 🚀 Launch Phase Override: allow cloud sync for everyone temporarily
                if (!cloudSyncAllowed && !LAUNCH_CLOUD_SYNC_FREE_FOR_ALL) {
                    return pushRes;
                }

                // 2) Pull incremental remote → merge into local store (additive, hardened)
                // 🔒 scope guard: skip remote pull if no identity is set (prevents cross-user data merge)
                const historyScope = String(chatLinkKey ?? "").trim();
                if (!historyScope) {
                    return pushRes;
                }

                try {
                    const since = remoteSinceRef.current || 0;
                    const pulled: FetchRemoteHistoryResult = await fetchRemoteHistorySince(since, {
                        userScope: historyScope,
                    });



                    const items = Array.isArray((pulled as any)?.items) ? pulled.items : [];

                    if (items.length > 0) {
                        const existingIds = new Set((historyRef.current || []).map((h) => h.id));
                        const toAdd = items.filter((it) => it?.id && !existingIds.has(it.id));

                        if (toAdd.length > 0) {
                            const sortedToAdd = [...toAdd].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
                            setHistory((prev) => mergeSorted(prev, sortedToAdd));
                        }

                        setSettingsLastSyncStatus(
                            `Synced. Pulled ${toAdd.length} new item(s) from cloud.`
                        );
                    } else {
                        // ✅ Important: still update status on empty pulls (fresh install / already up-to-date)
                        setSettingsLastSyncStatus("Synced. No new cloud items.");
                    }

                    // Persist nextSince cursor (even when items is empty)
                    const nextSince = (pulled as any)?.nextSince;
                    if (
                        typeof nextSince === "number" &&
                        Number.isFinite(nextSince) &&
                        nextSince >= 0
                    ) {
                        remoteSinceRef.current = nextSince;
                        const historyKey = scopedKey(STORAGE_KEY_BASE, chatLinkKey, localUserScopeId);
                        AsyncStorage.removeItem(historyKey).catch((err) =>
                            debugWarn("Failed to clear history storage:", err)
                        );
                    }
                } catch (err) {
                    debugWarn("runSync: remote pull failed (non-fatal):", err);
                }

                // 3) Pull remote chat messages → merge into local History (additive, deduped)
                // This centralizes chat pull in one place (HistoryContext) so ChatScreen can stop pulling directly.
                try {
                    // Respect privacy/consent: local-only means never call cloud.
                    if (analysisMode !== "local") {
                        const userScope = String(chatLinkKey ?? "").trim();

                        if (userScope) {
                            // Capture the scope used for this request
                            const requestedScope = userScope;

                            const res = await fetchRemoteChatMessages({ userScope: requestedScope });

                            // ✅ If scope changed while request was in-flight, ignore these results
                            if (chatLinkKeyRef.current !== requestedScope) {
                                return {
                                    ok: false,
                                    skipped: true,
                                    reason: "scope-changed",
                                } as any;
                            }

                            const remote = Array.isArray((res as any)?.messages) ? (res as any).messages : [];

                            if (remote.length > 0) {
                                const existingIds = new Set((historyRef.current || []).map((h) => h.id));

                                const toAdd: HistoryItem[] = remote
                                    .map((r: any) => {
                                        const id = String(r?.id ?? "").trim();
                                        if (!id) return null;

                                        const ts =
                                            typeof r?.createdAt === "number"
                                                ? r.createdAt
                                                : (() => {
                                                    const d = new Date(
                                                        r?.created_at ?? r?.createdAt ?? Date.now()
                                                    );
                                                    const ms = d.getTime();
                                                    return Number.isFinite(ms) ? ms : Date.now();
                                                })();

                                        const text = String(r?.content ?? "").trim();
                                        if (!text) return null;

                                        return {
                                            id,
                                            text,
                                            from: r?.role === "assistant" ? "bot" : "user",
                                            timestamp: ts,
                                            isSynced: true,
                                            // emotion/intensity may not exist in chat payload; keep optional
                                        } as HistoryItem;
                                    })
                                    .filter(Boolean) as HistoryItem[];

                                const newOnes = toAdd.filter((it) => it?.id && !existingIds.has(it.id));

                                if (newOnes.length > 0) {
                                    const sortedNew = [...newOnes].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
                                    setHistory((prev) => mergeSorted(prev, sortedNew));
                                }
                            }
                        }
                    }
                } catch (err) {
                    debugWarn("runSync: remote chat pull failed (non-fatal):", err);
                }

                // ✅ One final pass after both remote pulls (history + chat)
                dedupeAndSortHistory();

                return pushRes;
            } finally {
                runSyncInFlightRef.current = false;
            }
        },
        [
            clearAutoSyncTimer,
            pushHistoryToRemote,
            setSettingsLastSyncStatus,
            cloudSyncAllowed,
            hydrated,

            // ✅ Critical: ensures remote chat pull uses latest scope + mode
            chatLinkKey,
            analysisMode,
        ]

    );

    const syncNow = runSync;

    const mergeRemoteHistory = (rawItems: unknown[]): MergeRemoteResult => {
        const totalRemote = Array.isArray(rawItems) ? rawItems.length : 0;
        if (!Array.isArray(rawItems) || rawItems.length === 0) {
            return { totalRemote, normalized: 0, added: 0 };
        }

        const normalizedItems: HistoryItem[] = [];
        for (const raw of rawItems) {
            const normalized = normalizeRemoteItem(raw);
            if (normalized) normalizedItems.push(normalized);
        }

        const normalizedCount = normalizedItems.length;
        if (normalizedCount === 0) {
            return { totalRemote, normalized: 0, added: 0 };
        }

        const existingIds = new Set((historyRef.current || []).map((h) => h.id));
        // Fingerprint: sender + first 80 chars of text + 1-minute time bucket
        // Catches cross-device duplicates that share content but have different IDs
        const existingFingerprints = new Set(
            (historyRef.current || []).map((h) =>
                `${h.from}:${h.text.trim().slice(0, 80).toLowerCase()}:${Math.floor((h.timestamp ?? 0) / 60_000)}`
            )
        );
        const toAdd: HistoryItem[] = [];

        for (const item of normalizedItems) {
            const fp = `${item.from}:${item.text.trim().slice(0, 80).toLowerCase()}:${Math.floor((item.timestamp ?? 0) / 60_000)}`;
            if (!existingIds.has(item.id) && !existingFingerprints.has(fp)) {
                existingIds.add(item.id);
                existingFingerprints.add(fp);
                toAdd.push(item);
            }
        }

        const addedCount = toAdd.length;

        if (addedCount > 0) {
            setHistory((prev) => {
                const merged = [...prev, ...toAdd].sort(
                    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
                );
                return merged;
            });
        }

        return {
            totalRemote,
            normalized: normalizedCount,
            added: addedCount,
        };
    };

    const hasUnsyncedChanges = history.some((h) => !h.isSynced);

    // Detect potential duplicates: same sender + text fingerprint + timestamps within 60s, different IDs
    const potentialDuplicates: Array<[HistoryItem, HistoryItem]> = (() => {
        const dupes: Array<[HistoryItem, HistoryItem]> = [];
        const sorted = [...history].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
        for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i];
            const b = sorted[i + 1];
            if (
                a.from === b.from &&
                a.id !== b.id &&
                Math.abs((a.timestamp ?? 0) - (b.timestamp ?? 0)) < 60_000 &&
                a.text.trim().slice(0, 80).toLowerCase() === b.text.trim().slice(0, 80).toLowerCase()
            ) {
                dupes.push([a, b]);
            }
        }
        return dupes;
    })();

    useEffect(() => {
        clearAutoSyncTimer();

        if (!hydrated) return;
        if (!hasUnsyncedChanges) return;
        if (isSyncing) return;

        // ✅ NEW: Respect plan. FREE should not schedule background cloud pushes.
        if (!cloudSyncAllowed && !LAUNCH_CLOUD_SYNC_FREE_FOR_ALL) return;

        const delayMs = Math.min(Math.max(autoSyncDelaySeconds, 3), 60) * 1000;

        autoSyncTimerRef.current = setTimeout(() => {
            pushHistoryToRemote().catch((err) =>
                debugWarn("Background auto-sync error:", err)
            );
        }, delayMs);

        return () => {
            clearAutoSyncTimer();
        };
    }, [
        hydrated,
        hasUnsyncedChanges,
        isSyncing,
        autoSyncDelaySeconds,
        pushHistoryToRemote,
        clearAutoSyncTimer,
        cloudSyncAllowed,
    ]);

    return (
        <HistoryContext.Provider
            value={{
                history,
                addToHistory,
                clearHistory,
                deleteFromHistory,
                pushHistoryToRemote,
                runSync,
                syncNow,
                mergeRemoteHistory,
                isSyncing,
                lastSyncResult,
                lastSyncAt,
                hasUnsyncedChanges,
                potentialDuplicates,
                licenseTier,
                setLicenseTier,
            }}
        >
            {children}
        </HistoryContext.Provider>
    );
}

export function useHistoryStore() {
    const ctx = useContext(HistoryContext);
    if (!ctx) {
        throw new Error("useHistoryStore must be used inside HistoryProvider");
    }
    return ctx;
}
