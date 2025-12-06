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
};

const STORAGE_KEY = "imotara_history_v1";

const HistoryContext = createContext<HistoryContextValue | undefined>(
    undefined
);

export default function HistoryProvider({ children }: { children: ReactNode }) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [hydrated, setHydrated] = useState(false);

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
        try {
            // Only push items that are not yet marked as synced
            const unsynced = history.filter((h) => !h.isSynced);

            if (unsynced.length === 0) {
                // Nothing to push – still return a successful result
                return {
                    ok: true,
                    pushed: 0,
                    // Numeric status code to satisfy PushRemoteHistoryResult
                    // 0 → nothing to push
                    status: 0,
                };
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

            return result;
        } catch (error) {
            console.warn("pushHistoryToRemote error:", error);
            return {
                ok: false,
                pushed: 0,
                // -1 → generic sync error
                status: -1,
                errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
            };
        }
    };

    return (
        <HistoryContext.Provider
            value={{
                history,
                addToHistory,
                clearHistory,
                deleteFromHistory,
                pushHistoryToRemote,
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
