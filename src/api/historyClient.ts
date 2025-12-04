// src/api/historyClient.ts
//
// Tiny client to talk to the Imotara backend history API.
// - fetchRemoteHistory → read-only (used by Settings → “Test Remote History Fetch”)
// - pushRemoteHistory  → best-effort batch push of local history to backend

import { buildApiUrl } from "../config/api";
import type { HistoryItem } from "../state/HistoryContext";

// Shape that can represent either:
//   • Mobile payloads: { id, text, from, timestamp, source? }
//   • Web records:     { id, message, createdAt, updatedAt, source? }
type RemoteHistoryItem = {
    id: string;
    text?: string;
    message?: string;
    from?: "user" | "bot";
    source?: string;
    timestamp?: number;
    createdAt?: number;
    updatedAt?: number;
};

export type PushRemoteHistoryResult = {
    ok: boolean;
    pushed: number;
    status?: number;
    errorMessage?: string;
};

/**
 * Normalize any remote history record (mobile or web) into the
 * simple HistoryItem shape used by the mobile UI.
 */
function normalizeRemoteItem(raw: RemoteHistoryItem): HistoryItem {
    const id = raw.id;

    // Prefer "text" (mobile), then "message" (web)
    let text = "";
    if (typeof raw.text === "string" && raw.text.length > 0) {
        text = raw.text;
    } else if (typeof raw.message === "string") {
        text = raw.message;
    }

    // Try to infer speaker; default to "user" for debug.
    let from: "user" | "bot" = "user";
    if (raw.from === "user" || raw.from === "bot") {
        from = raw.from;
    } else if (raw.source === "user" || raw.source === "bot") {
        from = raw.source;
    }

    // Prefer timestamp (mobile), then updatedAt, then createdAt.
    let timestamp = Date.now();
    const candidates = [raw.timestamp, raw.updatedAt, raw.createdAt];
    for (const v of candidates) {
        if (typeof v === "number" && Number.isFinite(v)) {
            timestamp = v;
            break;
        }
    }

    return { id, text, from, timestamp };
}

/**
 * Build the outgoing payload for a batch of local items.
 * Minimal + tolerant, so backend can treat these as generic records.
 */
function toRemoteOutgoing(items: HistoryItem[]) {
    return items.map((item) => ({
        id: item.id,
        text: item.text,
        from: item.from,
        timestamp: item.timestamp,
        // 🔹 Preserve the speaker so we can color bubbles correctly on fetch.
        source: item.from, // "user" or "bot"
    }));
}

/**
 * Read-only fetch from the backend history API.
 * Used today only for connectivity/debug in Settings & History screen.
 */
export async function fetchRemoteHistory(): Promise<HistoryItem[]> {
    try {
        // Ask the backend for the simple array mode.
        const url = buildApiUrl("/api/history?mode=array");
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

        return data.map((item) => normalizeRemoteItem(item));
    } catch (err) {
        console.warn("fetchRemoteHistory: error talking to backend", err);
        return [];
    }
}

/**
 * Best-effort batch push of local history items to the backend.
 *
 * - Never throws (returns a small status object instead).
 * - Safe to call even with an empty list.
 */
export async function pushRemoteHistory(
    items: HistoryItem[]
): Promise<PushRemoteHistoryResult> {
    if (!items || items.length === 0) {
        // Nothing to push, but that's still a "success".
        return { ok: true, pushed: 0 };
    }

    try {
        const url = buildApiUrl("/api/history");
        const payload = toRemoteOutgoing(items);

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            let bodyText = "";
            try {
                bodyText = await res.text();
            } catch {
                // ignore
            }

            console.warn(
                "pushRemoteHistory: non-OK response",
                res.status,
                bodyText
            );

            return {
                ok: false,
                pushed: 0,
                status: res.status,
                errorMessage: bodyText || undefined,
            };
        }

        let pushed = payload.length;
        const status = res.status;

        try {
            const data = await res.json();
            if (Array.isArray(data)) {
                pushed = data.length;
            } else if (
                data &&
                typeof data === "object" &&
                typeof (data as any).pushed === "number"
            ) {
                pushed = (data as any).pushed;
            }
        } catch {
            // Response had no JSON body – that's okay.
        }

        return { ok: true, pushed, status };
    } catch (err: any) {
        console.warn("pushRemoteHistory: error talking to backend", err);
        return {
            ok: false,
            pushed: 0,
            errorMessage:
                err instanceof Error ? err.message : typeof err === "string" ? err : String(err),
        };
    }
}
