// src/lib/network/fetchWithTimeout.ts

import { Platform } from "react-native";
import { APP_VERSION } from "../../config/appVersion";
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

/**
 * Why a request failed, when it failed before any server answered.
 *
 * 🔴 This exists because the distinction was being recovered from the error
 * MESSAGE downstream, and could not be. See classifyNetworkFailure.
 */
export type NetworkFailureKind =
  /** The device told us it has no connectivity. We never tried. */
  | "offline"
  /** Our own deadline fired. The server may be fine, just slow. */
  | "timeout"
  /** The request could not leave the device, or nothing answered. */
  | "unreachable";

/** The first remote call failed for a reason a second call cannot fix. */
export class NetworkUnavailableError extends Error {
  /**
   * ⚠️ Carried, not re-derived. This error used to wrap the original's
   * message and nothing else, so everything downstream had to guess the cause
   * by matching text — and an AbortError's message is "Aborted", which matches
   * no keyword anyone thought to look for.
   */
  readonly kind: NetworkFailureKind;

  constructor(detail: string, kind: NetworkFailureKind = "unreachable") {
    super(detail);
    this.name = "NetworkUnavailableError";
    this.kind = kind;
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
  return classifyNetworkFailure(err) !== null;
}

/**
 * WHY a request failed — or null when a server answered and said no.
 *
 * 🔴 Reported 2026-10-10: after sending, the app "suddenly went offline" on a
 * phone whose connection was demonstrably fine (it had just uploaded a voice
 * recording). The cause was downstream of here: ChatScreen classified the
 * failure by substring-matching the error's MESSAGE, and our own timeout
 * arrives as an AbortError whose message is "Aborted" — which contains
 * neither "Network", "fetch", "connect" nor "timeout". It therefore fell past
 * every branch into a catch-all that said the device had gone offline.
 *
 * 🔑 The kind is knowable exactly here, from the error's TYPE, and nowhere
 * else. Returning it means no caller has to guess from prose.
 *
 * ⚠️ The membership of this set must stay identical to what isNetworkFailure
 * returned before it was expressed in terms of this function: aiClient uses it
 * to decide whether a SECOND endpoint is worth trying, and widening it would
 * silently stop that fallback from ever running.
 */
export function classifyNetworkFailure(err: unknown): NetworkFailureKind | null {
  if (err instanceof OfflineError) return "offline";
  if (err instanceof NetworkUnavailableError) return err.kind;

  const name = (err as { name?: string } | null)?.name ?? "";
  const message = String((err as { message?: string } | null)?.message ?? "");

  // Our own AbortController firing. "Aborted" is the whole message.
  if (name === "AbortError") return "timeout";
  // React Native's way of saying the request never left the device.
  if (name === "TypeError") return "unreachable";

  if (/timeout|aborted/i.test(message)) return "timeout";
  if (/network request failed/i.test(message)) return "unreachable";

  // A server answered. That is worth a second endpoint — and it is NOT
  // something to describe to the person as being offline.
  return null;
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
        headers: {
            ...(init.headers ?? {}),
            "X-Imotara-Platform": platform,
            // Additive only. The server uses this to warn stale clients about
            // prices/SKUs they cannot render correctly; it never rejects on it.
            "X-Imotara-Version": APP_VERSION,
        },
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
