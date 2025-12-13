// src/api/historyClient.ts
//
// Tiny client to talk to the Imotara backend history API.
// - fetchRemoteHistory → read-only (used by Settings → “Test Remote History Fetch”
//   and by HistoryScreen → “Load Remote History (debug)”)
// - pushRemoteHistory  → best-effort batch push of local history to backend

import { buildApiUrl } from "../config/api";
import { DEBUG_UI_ENABLED } from "../config/debug";
import type { HistoryItem } from "../state/HistoryContext";

function debugWarn(...args: any[]) {
    if (DEBUG_UI_ENABLED) console.warn(...args);
}

// Shape that can represent either:
//   • Mobile payloads: { id, text, from, timestamp, source? }
//   • Web records:     { id, message, createdAt, updatedAt, source?, emotion? }
type RemoteHistoryItem = {
    id: string;
    text?: string;
    message?: string;
    content?: string;
    from?: string; // web may use "assistant", "user", etc.
    source?: string;
    timestamp?: number;
    createdAt?: number;
    updatedAt?: number;
    // Extra fields we simply ignore but allow structurally:
    role?: string;
    author?: string;
    speaker?: string;
    isUser?: boolean;
    emotion?: string;
    intensity?: number;
};

/**
 * Result type for pushRemoteHistory; used by SettingsScreen & HistoryContext.
 */
export type PushRemoteHistoryResult = {
    ok: boolean;
    pushed: number;
    status?: number;
    errorMessage?: string;
};

/**
 * Coerce "from"/"source"/flags into our simple "user" | "bot".
 *
 * The backend may use:
 *   - source: "user" | "assistant" | "bot"
 *   - role: "user" | "assistant"
 *   - from: "user" | "bot"
 *   - isUser: boolean
 */
function normalizeFrom(item: RemoteHistoryItem): "user" | "bot" {
    const src = (item.source || "").toLowerCase();
    const role = (item.role || "").toLowerCase();
    const from = (item.from || "").toLowerCase();

    if (typeof item.isUser === "boolean") return item.isUser ? "user" : "bot";

    if (role === "user") return "user";
    if (role === "assistant") return "bot";

    if (from === "user") return "user";
    if (from === "bot") return "bot";
    if (from === "assistant") return "bot";

    if (src === "user") return "user";
    if (src === "assistant") return "bot";
    if (src === "bot") return "bot";

    // best-effort fallback: treat unknown as bot so it doesn't break chat pairing
    return "bot";
}

/**
 * Normalize timestamp. Backend may store:
 * - timestamp (ms)
 * - createdAt (ms)
 * - updatedAt (ms)
 */
function normalizeTimestamp(item: RemoteHistoryItem): number {
    const ts =
        typeof item.timestamp === "number"
            ? item.timestamp
            : typeof item.createdAt === "number"
                ? item.createdAt
                : typeof item.updatedAt === "number"
                    ? item.updatedAt
                    : Date.now();

    // If it's seconds, convert to ms (basic heuristic)
    if (ts < 1e12) return ts * 1000;

    return ts;
}

/**
 * Normalize text content. Backend may store:
 * - text
 * - message
 * - content
 */
function normalizeText(item: RemoteHistoryItem): string {
    const t =
        typeof item.text === "string"
            ? item.text
            : typeof item.message === "string"
                ? item.message
                : typeof item.content === "string"
                    ? item.content
                    : "";

    return String(t ?? "");
}

/**
 * Convert remote record → local HistoryItem
 * Always returns a structurally valid HistoryItem (id/text/from/timestamp),
 * but some may still be filtered by your merge normalizer if you choose.
 */
function normalizeRemoteItem(item: RemoteHistoryItem): HistoryItem {
    return {
        id: String(item.id),
        text: normalizeText(item),
        from: normalizeFrom(item),
        timestamp: normalizeTimestamp(item),
        // backend does not always carry per-item sync marker; locally we treat remote as synced
        isSynced: true,
    };
}

/**
 * Read remote history as an array from /api/history?mode=array.
 * Always returns an array (empty on error).
 */
export async function fetchRemoteHistory(): Promise<HistoryItem[]> {
    try {
        const url = buildApiUrl("/api/history?mode=array");
        const res = await fetch(url);

        if (!res.ok) {
            debugWarn("fetchRemoteHistory: non-OK response", res.status);
            return [];
        }

        const raw = await res.json();

        if (!Array.isArray(raw)) {
            debugWarn("fetchRemoteHistory: expected array, got", typeof raw, raw);
            return [];
        }

        const data = raw as RemoteHistoryItem[];

        return data.map((item) => normalizeRemoteItem(item));
    } catch (err) {
        debugWarn("fetchRemoteHistory: error talking to backend", err);
        return [];
    }
}

/**
 * Best-effort batch push of local history items to
 * /api/history via POST.
 *
 * Uses a compact payload the backend normalizer already supports:
 *   { items: [{ id, text, from, timestamp }] }
 *
 * Returns ok=false on any non-OK response.
 */
export async function pushRemoteHistory(
    items: HistoryItem[]
): Promise<PushRemoteHistoryResult> {
    try {
        const url = buildApiUrl("/api/history");

        // Only push valid items that have basic fields
        const payloadItems = (items || [])
            .filter((i) => i && i.id && typeof i.text === "string" && i.from && i.timestamp)
            .map((i) => ({
                id: i.id,
                text: i.text,
                from: i.from,
                timestamp: i.timestamp,
            }));

        const pushed = payloadItems.length;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: payloadItems }),
        });

        const status = res.status;

        if (!res.ok) {
            let bodyText = "";
            try {
                bodyText = await res.text();
            } catch {
                // ignore
            }

            debugWarn("pushRemoteHistory: non-OK response", res.status, bodyText);

            return {
                ok: false,
                pushed: 0,
                status: res.status,
                errorMessage: bodyText || `HTTP ${res.status}`,
            };
        }

        // Try to parse response (optional)
        try {
            await res.json();
        } catch {
            // Backend may return 204 or non-JSON body – that's okay.
        }

        return { ok: true, pushed, status };
    } catch (err: any) {
        debugWarn("pushRemoteHistory: error talking to backend", err);
        return {
            ok: false,
            pushed: 0,
            errorMessage:
                err instanceof Error
                    ? err.message
                    : typeof err === "string"
                        ? err
                        : String(err),
        };
    }
}
