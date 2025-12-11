// src/state/HistoryContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    pushRemoteHistory,
    type PushRemoteHistoryResult,
} from "../api/historyClient";

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

/**
 * Normalize any incoming remote object to a strict HistoryItem shape.
 * This is intentionally permissive so it can handle:
 * - Direct chat records from /api/history
 * - Analysis-like objects with `summary` / `reflections`
 * - Older shapes that used `message`, `content`, etc.
 */
function normalizeRemoteItem(raw: any): HistoryItem | null {
    if (!raw || typeof raw !== "object") return null;

    const pickStr = (v: any): string =>
        typeof v === "string" ? v : "";

    // ----- 1) Extract text (many fallbacks) -----
    let text: string =
        pickStr(raw.text) ||
        pickStr(raw.message) || // <-- your backend uses this
        pickStr(raw.content) ||
        pickStr(raw.body) ||
        pickStr(raw.prompt) ||
        "";

    // Try reflections[0].text if still empty
    if (!text.trim() && Array.isArray(raw.reflections) && raw.reflections.length > 0) {
        const first = raw.reflections[0];
        text = pickStr(first?.text) || text;
    }

    // Try summary.headline/details
    if (!text.trim() && raw.summary && typeof raw.summary === "object") {
        const headline = pickStr(raw.summary.headline);
        const details = pickStr(raw.summary.details);
        const combined = [headline, details].filter(Boolean).join(" — ");
        if (combined.trim()) {
            text = combined;
        }
    }

    // Additional generic fallbacks
    if (!text.trim()) {
        text =
            pickStr(raw.description) ||
            pickStr(raw.title) ||
            text;
    }

    if (!text || !text.trim()) {
        // Ignore empty rows
        return null;
    }

    // ----- 2) Determine "from" (user vs bot) -----
    const roleLike: string =
        pickStr(raw.from) ||
        pickStr(raw.role) ||
        pickStr(raw.author) ||
        pickStr(raw.speaker) ||
        pickStr(raw.source); // <-- your backend uses this

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
        // Fallback flag
        from = "user";
    } else if (!roleLike && !raw.isUser) {
        // Heuristic: if it looks like an AI analysis record (has summary/snapshot/reflections),
        // treat it as a bot entry.
        if (raw.summary || raw.snapshot || raw.reflections) {
            from = "bot";
        }
    }

    // ----- 3) Determine timestamp (number, ms) -----
    let timestamp: number;

    if (typeof raw.timestamp === "number") {
        timestamp = raw.timestamp;
    } else if (typeof raw.computedAt === "number") {
        // Analysis-like objects
        timestamp = raw.computedAt;
    } else if (
        Array.isArray(raw.reflections) &&
        raw.reflections.length > 0 &&
        typeof raw.reflections[0]?.createdAt === "number"
    ) {
        timestamp = raw.reflections[0].createdAt;
    } else if (typeof raw.createdAt === "number") {
        timestamp = raw.createdAt; // <-- your backend uses this
    } else if (typeof raw.createdAt === "string") {
        const parsed = Date.parse(raw.createdAt);
        timestamp = Number.isNaN(parsed) ? Date.now() : parsed;
    } else {
        timestamp = Date.now();
    }

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
                    // Basic validation / normalization
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
                console.warn("Failed to load history from storage:", error);
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
                console.warn("Failed to save history to storage:", error);
            }
        };

        save();
    }, [history, hydrated]);

    const addToHistory = (item: HistoryItem) => {
        setHistory((prev) => [...prev, item]);
    };

    const clearHistory = () => {
        setHistory([]);
        // We also clear storage, but we don’t block on it
        AsyncStorage.removeItem(STORAGE_KEY).catch((err) =>
            console.warn("Failed to clear history storage:", err)
        );
    };

    const deleteFromHistory = (id: string) => {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        // AsyncStorage will be updated by the persistence effect
    };

    const pushHistoryToRemote = async (): Promise<PushRemoteHistoryResult> => {
        // Mark that a sync attempt is underway and clear previous result
        setIsSyncing(true);
        setLastSyncResult(null);

        try {
            // Only push items that are not yet marked as synced
            const unsynced = history.filter((h) => !h.isSynced);

            if (unsynced.length === 0) {
                // Nothing to push – still return a successful result
                const result: PushRemoteHistoryResult = {
                    ok: true,
                    pushed: 0,
                    status: 0, // 0 → nothing to push
                };
                setLastSyncResult(result);
                setLastSyncAt(Date.now());
                return result;
            }

            const result = await pushRemoteHistory(unsynced);

            if (result.ok) {
                // Mark all successfully pushed items as synced
                const pushedIds = new Set(unsynced.map((h) => h.id));

                setHistory((prev) =>
                    prev.map((item) =>
                        pushedIds.has(item.id)
                            ? { ...item, isSynced: true }
                            : item
                    )
                );
            }

            setLastSyncResult(result);
            setLastSyncAt(Date.now());
            return result;
        } catch (error) {
            console.warn("pushHistoryToRemote error:", error);

            const fallback: PushRemoteHistoryResult = {
                ok: false,
                pushed: 0,
                status: -1, // -1 → generic sync error
                errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
            };

            setLastSyncResult(fallback);
            setLastSyncAt(Date.now());
            return fallback;
        } finally {
            setIsSyncing(false);
        }
    };

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
            if (normalized) {
                normalizedItems.push(normalized);
            }
        }

        const normalizedCount = normalizedItems.length;
        if (normalizedCount === 0) {
            return { totalRemote, normalized: 0, added: 0 };
        }

        let addedCount = 0;

        setHistory((prev) => {
            const existingIds = new Set(prev.map((h) => h.id));
            const toAdd: HistoryItem[] = [];

            for (const item of normalizedItems) {
                if (!existingIds.has(item.id)) {
                    existingIds.add(item.id);
                    toAdd.push(item);
                }
            }

            addedCount = toAdd.length;
            if (addedCount === 0) return prev;

            const merged = [...prev, ...toAdd].sort(
                (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
            );
            return merged;
        });

        return {
            totalRemote,
            normalized: normalizedCount,
            added: addedCount,
        };
    };

    // Derived flag: any local changes not yet synced
    const hasUnsyncedChanges = history.some((h) => !h.isSynced);

    return (
        <HistoryContext.Provider
            value={{
                history,
                addToHistory,
                clearHistory,
                deleteFromHistory,
                pushHistoryToRemote,
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
