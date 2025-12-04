// src/api/historyClient.ts
//
// Tiny client to fetch history from the Imotara backend (read-only for now).
// Currently used by Settings → “Test Remote History Fetch” for connectivity debug.

import { buildApiUrl } from "../config/api";
import type { HistoryItem } from "../state/HistoryContext";

// Shape of what the backend returns (adjust later to match real API)
type RemoteHistoryItem = {
    id: string;
    text: string;
    from: "user" | "bot";
    timestamp: number;
};

export async function fetchRemoteHistory(): Promise<HistoryItem[]> {
    try {
        const url = buildApiUrl("/api/history"); // TODO: adjust path if needed
        const res = await fetch(url);

        if (!res.ok) {
            console.warn("fetchRemoteHistory: non-OK response", res.status);
            return [];
        }

        const raw = await res.json();

        if (!Array.isArray(raw)) {
            console.warn(
                "fetchRemoteHistory: expected array, got",
                typeof raw,
                raw
            );
            return [];
        }

        const data: RemoteHistoryItem[] = raw;

        // Basic normalization in case backend differs slightly
        return data.map((item) => ({
            id: item.id,
            text: item.text,
            from: item.from,
            timestamp: item.timestamp,
        }));
    } catch (err) {
        console.warn("fetchRemoteHistory: error talking to backend", err);
        return [];
    }
}
