// src/api/historyClient.ts
//
// Tiny client to talk to the Imotara backend history API.
// - fetchRemoteHistory → read-only (used by Settings → “Test Remote History Fetch”
//   and by HistoryScreen → “Load Remote History (debug)”)
// - pushRemoteHistory  → best-effort batch push of local history to backend

import { buildApiUrl } from "../config/api";
import type { HistoryItem } from "../state/HistoryContext";

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
 *   - source: "user" | "assistant" | "local" | "openai"
 *   - from: "user" | "assistant" | "bot"
 *   - role: "user" | "assistant"
 *   - isUser: true/false
 */
function coerceFrom(raw: RemoteHistoryItem): "user" | "bot" {
    // Prefer explicit "user" vs "bot" first.
    const token =
        (raw.from ??
            raw.source ??
            raw.role ??
            raw.author ??
            raw.speaker ??
            "") + "";

    const lower = token.toLowerCase().trim();

    if (
        lower === "user" ||
        lower === "human" ||
        lower === "you" ||
        (raw as any).isUser === true
    ) {
        return "user";
    }

    // Common assistant / AI markers → treat as bot
    if (
        lower === "assistant" ||
        lower === "bot" ||
        lower === "imotara" ||
        lower === "ai" ||
        lower === "system" ||
        lower === "assistant-local" ||
        lower === "assistant-remote" ||
        lower === "openai"
    ) {
        return "bot";
    }

    // If we at least know it's not "user", treat it as bot;
    // this helps for values like "local", "cloud", etc.
    if (lower && lower !== "user") {
        return "bot";
    }

    // Default: user (safe assumption for early debug)
    return "user";
}

/**
 * Normalize any remote history record (mobile or web) into the
 * simple HistoryItem shape used by the mobile UI.
 */
function normalizeRemoteItem(raw: RemoteHistoryItem): HistoryItem {
    const id = String(raw.id);

    // Prefer "text" (mobile), then "message" (web), then "content".
    let text = "";
    if (typeof raw.text === "string" && raw.text.length > 0) {
        text = raw.text;
    } else if (typeof raw.message === "string" && raw.message.length > 0) {
        text = raw.message;
    } else if (typeof raw.content === "string" && raw.content.length > 0) {
        text = raw.content;
    }

    const from = coerceFrom(raw);

    // Prefer timestamp (mobile), then updatedAt, then createdAt.
    let timestamp = Date.now();
    const candidates = [raw.timestamp, raw.updatedAt, raw.createdAt];
    for (const v of candidates) {
        if (typeof v === "number" && Number.isFinite(v)) {
            timestamp = v;
            break;
        }
    }

    return {
        id,
        text,
        from,
        timestamp,
        // isSynced is handled by the merging layer (HistoryContext) or SettingsScreen;
        // we keep this minimal here.
    };
}

/**
 * Build the outgoing payload for a batch of local items.
 * Minimal + tolerant, so backend can treat these as generic records.
 *
 * The web backend's /api/history POST normalizer understands:
 *   - { id, text, from, timestamp, source? }
 *   - { id, message, createdAt, updatedAt, source? }
 */
function toRemoteOutgoing(items: HistoryItem[]) {
    return items.map((item) => ({
        id: item.id,
        text: item.text,
        from: item.from,
        timestamp: item.timestamp,
        // 🔹 Preserve the speaker so web can color bubbles correctly on fetch.
        source: item.from, // "user" or "bot"
    }));
}

/**
 * Read-only fetch from the backend history API.
 *
 * Today this is used for:
 *   - SettingsScreen → “Test Remote History Fetch” (just to see count)
 *   - HistoryScreen → “Load Remote History (debug)” (which then delegates
 *     to HistoryContext.mergeRemoteHistory for proper merging)
 *
 * It returns **already-normalized HistoryItem[]**.
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

        const data = raw as RemoteHistoryItem[];

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
            // Backend accepts both:
            //   - raw array: EmotionRecord[]
            //   - { records: EmotionRecord[] }
            // We send the raw array for simplicity.
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
            const data: any = await res.json();

            // Web /api/history returns an envelope like:
            //   { attempted, acceptedIds, rejected?, serverTs }
            if (data && Array.isArray(data.acceptedIds)) {
                pushed = data.acceptedIds.length;
            } else if (typeof data.pushed === "number") {
                pushed = data.pushed;
            } else if (Array.isArray(data)) {
                // Older / simpler shapes
                pushed = data.length;
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
                err instanceof Error
                    ? err.message
                    : typeof err === "string"
                        ? err
                        : String(err),
        };
    }
}
