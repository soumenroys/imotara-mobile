// src/lib/network/online.ts
// Does this device currently have a network? (UX-10)
//
// Mobile had no network awareness at all — no NetInfo, no listener, nothing.
// It discovered it was offline the way a person does when nobody answers the
// phone: by waiting. A message sent on the underground went to /api/chat-reply
// for 20 seconds, failed, then to /api/respond for another 20, and only then
// reached the on-device reply engine, which would have answered instantly.
//
// Three states, not two. "unknown" is its own answer and is treated as online,
// because the cost of the two mistakes is not symmetrical: waiting a few
// seconds for a request that was going to work is a small annoyance, while
// refusing to try when we could have is a broken app.

import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export type Connectivity = "online" | "offline" | "unknown";

let current: Connectivity = "unknown";
const listeners = new Set<(c: Connectivity) => void>();

function classify(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): Connectivity {
  // isInternetReachable stays null until NetInfo has actually probed, so it
  // cannot be trusted on its own at startup. isConnected === false is the only
  // signal firm enough to skip a request on.
  if (state.isConnected === false) return "offline";
  if (state.isConnected === true && state.isInternetReachable === false) return "offline";
  if (state.isConnected === true) return "online";
  return "unknown";
}

/**
 * Start listening. Safe to call more than once.
 *
 * The reachability probe is pointed at Imotara's own health endpoint rather
 * than NetInfo's default Google URL, which is what makes a captive portal
 * detectable: hotel and airport wifi answers every request with its own login
 * page, so the device is "connected" and nothing works. A probe that expects
 * HTTP 200 from OUR api sees that HTML for what it is, and — more usefully —
 * "reachable" then means "can reach Imotara", which is the only question the
 * app actually needs answered.
 */
let started = false;
let unsubscribe: (() => void) | null = null;

/** How often to re-probe while things are working. The settings screen owns it. */
let longTimeoutMs = 60 * 1000;

function applyConfig() {
  NetInfo.configure({
    reachabilityUrl: "https://www.imotara.com/api/health",
    reachabilityTest: async (response) => response.status === 200,
    // Re-probe soon after a failure, lazily while things are working.
    reachabilityShortTimeout: 5 * 1000,
    reachabilityLongTimeout: longTimeoutMs,
    reachabilityRequestTimeout: 8 * 1000,
  });
}

function attach() {
  unsubscribe = NetInfo.addEventListener((state) => {
    const next = classify(state);
    if (next === current) return;
    current = next;
    for (const l of listeners) { try { l(next); } catch { /* a listener must not stop the others */ } }
  });
}

/**
 * Honour the "Connectivity check interval" setting, which promises the person
 * "lower = faster detection, higher = less battery use". That is exactly what
 * NetInfo's long timeout controls, so the setting drives the ONE probe this
 * app makes rather than a second poller of its own.
 *
 * ⚠️ The listener is dropped and re-attached around the reconfigure, and that
 * is not ceremony. Found on the real A27, 2026-09-16: calling
 * NetInfo.configure() while a listener is attached silently orphans the
 * subscription — the app sat 75 seconds with the network genuinely down
 * (ping failing, "Active default network: none") and never noticed, because
 * ChatScreen applied this setting moments after the watch started.
 */
export function setConnectivityCheckInterval(ms: number): void {
  if (!isFinite(ms) || ms <= 0 || ms === longTimeoutMs) return;
  longTimeoutMs = ms;
  if (!started) return;
  unsubscribe?.();
  unsubscribe = null;
  applyConfig();
  attach();
}

export function startConnectivityWatch(): () => void {
  if (started) return () => {};
  started = true;
  applyConfig();
  attach();
  return () => { unsubscribe?.(); unsubscribe = null; started = false; };
}

export function getConnectivity(): Connectivity {
  return current;
}

/**
 * True only when we are sure. Callers use this to skip work, so an unknown
 * state must never look like "definitely offline".
 */
export function isDefinitelyOffline(): boolean {
  return current === "offline";
}

export function subscribeConnectivity(fn: (c: Connectivity) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Test seam. Not for app code. */
export function __setConnectivityForTest(c: Connectivity): void {
  current = c;
}

/**
 * React binding for the single source of truth above.
 *
 * ⚠️ "unknown" maps to ONLINE, deliberately, matching isDefinitelyOffline and
 * the reasoning at the top of this file: refusing to try when we could have is
 * a broken app, while waiting a few seconds for a request that was going to
 * work is a small annoyance. The hook this replaced defaulted to `true` for
 * the same reason, so the bias is unchanged.
 */
export function useIsOnline(): boolean {
  const [state, setState] = useState<Connectivity>(current);
  useEffect(() => subscribeConnectivity(setState), []);
  return state !== "offline";
}
