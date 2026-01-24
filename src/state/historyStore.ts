// src/state/historyStore.ts
// Simple local history store (temporary).
// Later we'll replace this with persistent storage + sync.

export type HistoryItem = {
    id: string;
    text: string;
    from: "user" | "bot";
    timestamp: number;
    isSynced?: boolean;
    source?: string;

    // ✅ Baby Step 10.4.2 — persist/rehydrate emotion field
    moodHint?: string;
};

let history: HistoryItem[] = [];

export function addToHistory(item: HistoryItem) {
    history.push(item);
}

export function getHistory(): HistoryItem[] {
    return history;
}

export function clearHistory() {
    history = [];
}
