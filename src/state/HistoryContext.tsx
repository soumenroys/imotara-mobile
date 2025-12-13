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
    type PushRemoteHistoryResult,
} from "../api/historyClient";
import { useSettings } from "./SettingsContext";
import { DEBUG_UI_ENABLED } from "../config/debug";

export type HistoryItem = {
    id: string;
    text: string;
    from: "user" | "bot";
    timestamp: number;
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
};

const STORAGE_KEY = "imotara_history_v1";

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

    return {
        id,
        text,
        from,
        timestamp,
        // Anything coming from the backend is, by definition, synced.
        isSynced: true,
    };
}

export default function HistoryProvider({ children }: { children: ReactNode }) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [hydrated, setHydrated] = useState(false);

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
    } = useSettings();

    // ✅ Keep a ref to latest history to avoid function identity churn
    const historyRef = useRef<HistoryItem[]>([]);
    useEffect(() => {
        historyRef.current = history;
    }, [history]);

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

    // Hydrate from AsyncStorage on mount
    useEffect(() => {
        const load = async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (!raw) {
                    setHydrated(true);
                    return;
                }

                const parsed = JSON.parse(raw);

                if (Array.isArray(parsed)) {
                    const cleaned: HistoryItem[] = parsed
                        .filter((item) => item && typeof item === "object")
                        .map((item) => ({
                            id: String(item.id ?? `${item.timestamp ?? Date.now()}`),
                            text: String(item.text ?? ""),
                            from:
                                item.from === "user" || item.from === "bot"
                                    ? item.from
                                    : ("bot" as const),
                            timestamp:
                                typeof item.timestamp === "number"
                                    ? item.timestamp
                                    : Date.now(),
                            isSynced:
                                typeof item.isSynced === "boolean"
                                    ? item.isSynced
                                    : false,
                        }));

                    setHistory(cleaned);
                }
            } catch (error) {
                debugWarn("Failed to load history from storage:", error);
            } finally {
                setHydrated(true);
            }
        };

        load();
    }, []);

    // Persist to AsyncStorage whenever history changes (after hydration)
    useEffect(() => {
        if (!hydrated) return;

        const save = async () => {
            try {
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
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

        AsyncStorage.removeItem(STORAGE_KEY).catch((err) =>
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
    }, [clearAutoSyncTimer, setSettingsLastSyncAt, setSettingsLastSyncStatus]);

    /**
     * Additive “safe sync trigger” for lifecycle/manual calls.
     * - Dedupes rapid re-entry (foreground events can fire quickly)
     * - Clears any pending autosync timer
     * - Delegates to pushHistoryToRemote (which already has overlap protection)
     */
    const runSync = useCallback(
        async (opts?: { reason?: string }): Promise<PushRemoteHistoryResult> => {
            const now = Date.now();

            if (DEBUG_UI_ENABLED && opts?.reason) {
                debugLog("runSync triggered:", opts.reason);
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
                return await pushHistoryToRemote();
            } finally {
                runSyncInFlightRef.current = false;
            }
        },
        [clearAutoSyncTimer, pushHistoryToRemote]
    );

    // Alias for flexibility
    const syncNow = runSync;

    /**
     * Merge raw remote items into local history.
     * - Normalizes shapes
     * - Skips invalid/empty
     * - Avoids duplicates by id
     * - Marks merged items as isSynced: true
     */
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

        // ✅ Compute "added" deterministically before setHistory (avoids async mismatch)
        const existingIds = new Set((historyRef.current || []).map((h) => h.id));
        const toAdd: HistoryItem[] = [];

        for (const item of normalizedItems) {
            if (!existingIds.has(item.id)) {
                existingIds.add(item.id);
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

    // Derived flag: any local changes not yet synced
    const hasUnsyncedChanges = history.some((h) => !h.isSynced);

    // 🔁 Background auto-sync based on user-configured delay
    useEffect(() => {
        // Keep existing behavior but ensure we don't leave stale timers around
        clearAutoSyncTimer();

        if (!hydrated) return;
        if (!hasUnsyncedChanges) return;
        if (isSyncing) return;

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
