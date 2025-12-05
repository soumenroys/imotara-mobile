// src/state/HistoryContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";
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

    /**
     * Best-effort sync of current in-memory history to the backend.
     * Never throws; returns a small status object instead.
     */
    pushHistoryToRemote: () => Promise<PushRemoteHistoryResult>;
};

const HistoryContext = createContext<HistoryContextValue | undefined>(
    undefined
);

export default function HistoryProvider({ children }: { children: ReactNode }) {
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const addToHistory = (item: HistoryItem) => {
        setHistory((prev) => [...prev, item]);
    };

    const clearHistory = () => {
        setHistory([]);
    };

    const pushHistoryToRemote = async (): Promise<PushRemoteHistoryResult> => {
        // For now, we simply push the entire current in-memory history.
        return pushRemoteHistory(history);
    };

    return (
        <HistoryContext.Provider
            value={{ history, addToHistory, clearHistory, pushHistoryToRemote }}
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
