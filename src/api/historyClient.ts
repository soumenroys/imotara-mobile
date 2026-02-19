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

        // ✅ Additive: preserve emotion metadata when present (used by History UI)
        ...(typeof item.emotion === "string" && item.emotion.trim()
            ? { emotion: item.emotion.trim() }
            : {}),
        ...(typeof item.intensity === "number" && Number.isFinite(item.intensity)
            ? { intensity: item.intensity }
            : {}),

        // backend does not always carry per-item sync marker; locally we treat remote as synced
        isSynced: true,
    };
}


/**
 * Fetch remote history WITH cursor support.
 * - Calls: /api/history?since=<ms> (envelope mode)
 * - Returns: { items, nextSince }
 *
 * Safe + additive: does not break existing callers.
 */
export type FetchRemoteHistoryResult = {
    items: HistoryItem[];
    nextSince: number;
};

export type FetchRemoteHistoryOptions = {
    // Identity scope header used by backend to partition data per user/device
    userScope?: string;
};

export async function fetchRemoteHistorySince(
    since: number = 0,
    options?: FetchRemoteHistoryOptions
): Promise<FetchRemoteHistoryResult> {

    try {
        const safeSince = Number.isFinite(since) && since > 0 ? since : 0;

        // IMPORTANT: do NOT use mode=array in production (backend blocks it without QA/admin)
        const path =
            safeSince > 0 ? `/api/history?since=${encodeURIComponent(String(safeSince))}` : "/api/history";

        const url = buildApiUrl(path);

        const headers: Record<string, string> = { Accept: "application/json" };

        // Correlation id (non-breaking): helps trace client↔server issues in logs
        const requestId = `hist_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
        headers["x-request-id"] = requestId; // common convention
        headers["x-imotara-request-id"] = requestId; // app-specific (optional)

        const scope = (options?.userScope ?? "").trim();
        if (scope) {
            // Match ChatScreen behavior (cross-device continuity)
            headers["x-imotara-user"] = scope.slice(0, 80);
        }

        const res = await fetchWithTimeout(
            url,
            { method: "GET", headers },
            "fetchRemoteHistorySince"
        );


        if (!res.ok) {
            debugWarn("fetchRemoteHistorySince: non-OK response", res.status);
            return { items: [], nextSince: safeSince };
        }

        const raw = await tryReadJson(res);

        // Accept array OR envelope. Envelope may contain `records` (preferred) or `items` (back-compat).
        const records: any[] = Array.isArray(raw)
            ? raw
            : raw && typeof raw === "object"
                ? Array.isArray((raw as any).records)
                    ? (raw as any).records
                    : Array.isArray((raw as any).items)
                        ? (raw as any).items
                        : []
                : [];

        if (!Array.isArray(records)) {
            debugWarn("fetchRemoteHistorySince: expected records array, got", typeof raw, raw);
            return { items: [], nextSince: safeSince };
        }

        const data = records as RemoteHistoryItem[];
        const items = data.map((item) => normalizeRemoteItem(item));

        // Prefer backend-provided nextSince (new in imotaraapp), else compute.
        const backendNextSince =
            raw && typeof raw === "object" && typeof (raw as any).nextSince === "number"
                ? (raw as any).nextSince
                : undefined;

        const computedNextSince =
            items.length > 0 ? Math.max(...items.map((i) => i.timestamp || 0)) : safeSince;

        const nextSince =
            typeof backendNextSince === "number" && Number.isFinite(backendNextSince) && backendNextSince >= 0
                ? backendNextSince
                : computedNextSince;

        debugLog("fetchRemoteHistorySince: fetched", items.length, "item(s), nextSince=", nextSince);
        return { items, nextSince };
    } catch (err: any) {
        const isTimeout =
            err?.name === "AbortError" ||
            String(err?.message ?? "").toLowerCase().includes("aborted");

        debugWarn(
            isTimeout
                ? "fetchRemoteHistorySince: timeout talking to backend"
                : "fetchRemoteHistorySince: error talking to backend",
            err
        );

        return { items: [], nextSince: Number.isFinite(since) && since > 0 ? since : 0 };
    }
}

/**
 * Backward-compatible wrapper used by existing callers.
 * (Keeps the original behavior: fetch all, return array.)
 */
export async function fetchRemoteHistory(): Promise<HistoryItem[]> {
    const res = await fetchRemoteHistorySince(0);
    return res.items;
}

/**
 * Best-effort batch push of local history items to
 * /api/history via POST.
 *
 * Backend expects:
 *   { records: [{ id, text, from, timestamp }] }
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

        const limited = payloadItems.slice(0, 50);
        const attempted = limited.length;

        // Push can take longer than fetch (larger payload). Scale timeout by payload size.
        const pushTimeoutMs =
            payloadItems.length <= 25 ? 15_000 :
                payloadItems.length <= 100 ? 30_000 :
                    60_000;

        const res = await fetchWithTimeout(
            url,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                // ✅ CRITICAL FIX: use `records`, not `items`
                body: JSON.stringify({ records: limited }),
            },
            "pushRemoteHistory",
            pushTimeoutMs
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

        // If backend provides acceptedIds, honor it.
        try {
            const body = await tryReadJson(res);
            if (body && typeof body === "object") {
                const acceptedIds = Array.isArray((body as any).acceptedIds)
                    ? (body as any).acceptedIds
                    : null;

                if (acceptedIds) {
                    debugLog("pushRemoteHistory: backend accepted", acceptedIds.length, "item(s)");
                    return { ok: true, pushed: acceptedIds.length, status };
                }
            }
        } catch {
            // ignore
        }

        debugLog("pushRemoteHistory: pushed", attempted, "item(s)");
        return { ok: true, pushed: attempted, status };
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