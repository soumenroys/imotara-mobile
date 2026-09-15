// src/lib/network/fetchWithTimeout.ts

import { Platform } from "react-native";
import { isDefinitelyOffline } from "./online";

// Was 20000. Twenty seconds is a very long time to watch a typing indicator,
// and it was spent twice — /api/chat-reply then /api/respond — before the
// on-device engine got a turn. Ten still tolerates a slow train connection
// while halving the worst case (UX-11).
export const DEFAULT_REMOTE_TIMEOUT_MS = 10000;

/** Thrown instead of waiting out the timeout when the device is offline. */
export class OfflineError extends Error {
  constructor() {
    super("Device is offline");
    this.name = "OfflineError";
  }
}

/** The first remote call failed for a reason a second call cannot fix. */
export class NetworkUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "NetworkUnavailableError";
  }
}

/**
 * Did this fail because the network is unavailable, rather than because a
 * server answered and said no?
 *
 * An aborted request is our own timeout firing; a TypeError from fetch is
 * React Native's way of saying the request never left. Neither is worth
 * repeating against a second endpoint. An HTTP error is — that server was
 * reachable and simply refused.
 */
export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof OfflineError || err instanceof NetworkUnavailableError) return true;
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = String((err as { message?: string } | null)?.message ?? "");
  return name === "AbortError"
      || name === "TypeError"
      || /network request failed|timeout|aborted/i.test(message);
}


// Every request from this app says so, in one header, so the server can tell
// app traffic from website traffic without guessing at User-Agent strings.
// It names the SOFTWARE ("ios" / "android"), never the device or the person —
// there is no identifier here, and there must not be one: Imotara's store
// declarations and its own in-app copy both promise no usage tracking, and
// this is only allowed to stay true because the header carries nothing that
// could identify anybody.
//
// Set here rather than at each call site because there are ~18 of those across
// screens, Connect, Trends and the AI clients, and a header added in only some
// of them produces a split that is silently wrong rather than obviously wrong.
function withPlatformHeader(init: RequestInit = {}): RequestInit {
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown";
    return {
        ...init,
        headers: { ...(init.headers ?? {}), "X-Imotara-Platform": platform },
    };
}

export async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number = DEFAULT_REMOTE_TIMEOUT_MS
): Promise<Response> {
    // Fail immediately rather than burning the timeout on a request that
    // cannot leave the device. Every caller of this function benefits — the
    // two AI calls, Connect, Trends, licence seeding — instead of each one
    // needing its own offline check (UX-10).
    if (isDefinitelyOffline()) throw new OfflineError();

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

    // If a signal was passed in, abort our controller when it fires too
    if (init?.signal) {
        (init.signal as AbortSignal).addEventListener("abort", () => controller.abort());
    }

    try {
        return await fetch(url, { ...withPlatformHeader(init), signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}
