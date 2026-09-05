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

/** Start listening. Safe to call more than once. */
let started = false;
export function startConnectivityWatch(): () => void {
  if (started) return () => {};
  started = true;
  return NetInfo.addEventListener((state) => {
    const next = classify(state);
    if (next === current) return;
    current = next;
    for (const l of listeners) { try { l(next); } catch { /* a listener must not stop the others */ } }
  });
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
