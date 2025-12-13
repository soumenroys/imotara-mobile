// src/api/historyClient.ts
//
// Tiny client to talk to the Imotara backend history API.
// - fetchRemoteHistory → read-only (used by Settings → “Test Remote History Fetch”
//   and by HistoryScreen → “Load Remote History (debug)”)
// - pushRemoteHistory  → best-effort batch push of local history to backend
//
// Design notes:
// - Be liberal in what we accept from the backend (web + mobile payloads).
// - Be conservative in what we send (compact, normalized payload).
// - Never throw outward; callers expect safe fallbacks ([], ok=false).

import { buildApiUrl } from "../config/api";
import { DEBUG_UI_ENABLED } from "../config/debug";
import type { HistoryItem } from "../state/HistoryContext";

const DEFAULT_TIMEOUT_MS = 15_000;

function debugWarn(...args: any[]) {
    if (DEBUG_UI_ENABLED) console.warn(...args);
}
function debugLog(...args: any[]) {
    if (DEBUG_UI_ENABLED) console.log(...args);
}

/**
 * Fetch wrapper with a simple timeout.
 * Keeps behavior identical for callers (still returns Response or throws),
 * but avoids hanging requests during flaky network / offline transitions.
 */
async function fetchWithTimeout(
    url: string,
    init: RequestInit | undefined,
    label: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
    // AbortController is supported in modern RN/Expo, but guard just in case.
    const AC: any = (globalThis as any).AbortController;
    if (!AC) return fetch(url, init);

    const controller = new AC();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // If caller already provided a signal, we respect it (best effort) by
    // aborting both when either aborts.
    const providedSignal: any = (init as any)?.signal;
    if (providedSignal?.aborted) controller.abort();
    else if (providedSignal && typeof providedSignal.addEventListener === "function") {
        providedSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
        const res = await fetch(url, { ...(init || {}), signal: controller.signal });
        return res;
    } catch (err) {
        // Add a tiny bit of context (debug-only) without changing outward error shape.
        debugWarn(`${label}: fetch failed`, err);
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Safely read a JSON body if available; returns undefined on parse failure.
 * Does not throw.
 */
async function tryReadJson(res: Response): Promise<any | undefined> {
    try {
        // Some environments may not expose headers cleanly; be defensive.
        const ct = (res.headers?.get?.("content-type") || "").toLowerCase();
        if (ct.includes("application/json") || ct.includes("+json")) {
            return await res.json();
        }
        // If server didn't send content-type but body is JSON, res.json() may still work.
        // Try once, but if it fails we swallow.
        return await res.json();
    } catch {
        return undefined;
    }
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
 * Extract the message text from possible fields.
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
 * Always returns a structurally valid HistoryItem (id/text/from/timestamp).
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
        const res = await fetchWithTimeout(
            url,
            { method: "GET", headers: { Accept: "application/json" } },
            "fetchRemoteHistory"
        );

        if (!res.ok) {
            debugWarn("fetchRemoteHistory: non-OK response", res.status);
            return [];
        }

        const raw = await tryReadJson(res);

        if (!Array.isArray(raw)) {
            debugWarn("fetchRemoteHistory: expected array, got", typeof raw, raw);
            return [];
        }

        const data = raw as RemoteHistoryItem[];
        const normalized = data.map((item) => normalizeRemoteItem(item));

        debugLog("fetchRemoteHistory: fetched", normalized.length, "item(s)");
        return normalized;
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

        const res = await fetchWithTimeout(
            url,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({ items: payloadItems }),
            },
            "pushRemoteHistory"
        );

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

        // Some backends return 204 No Content or non-JSON payload – that's okay.
        // We still return ok=true and the number of items we attempted to push.
        try {
            const body = await tryReadJson(res);
            if (body && typeof body === "object") {
                // If backend provides a more accurate pushed count, honor it.
                const maybePushed = (body as any).pushed;
                if (typeof maybePushed === "number" && Number.isFinite(maybePushed)) {
                    debugLog("pushRemoteHistory: backend pushed", maybePushed, "item(s)");
                    return { ok: true, pushed: maybePushed, status };
                }
            }
        } catch {
            // ignore
        }

        debugLog("pushRemoteHistory: pushed", pushed, "item(s)");
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
