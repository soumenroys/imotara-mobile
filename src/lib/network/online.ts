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
 * than NetInfo's default Google URL, so that "reachable" means "can reach
 * Imotara" — the only question the app actually needs answered.
 *
 * ⚠️ The test accepts ANY http response, and that is deliberate.
 *
 * What this signal DOES is pick on-device replies over cloud ones and show the
 * offline banner, so the two ways of being wrong cost wildly different things:
 *
 *   a false "offline"  -> the person silently gets a degraded on-device reply
 *                         when the real one was available. Reply quality is a
 *                         protected surface, so this is the expensive error.
 *   a false "online"   -> one request fails and falls back. Seconds lost.
 *
 * Everything here follows from that asymmetry, and so does the "unknown counts
 * as online" rule below. Two earlier versions got it backwards:
 *
 *   `response.status === 200`  -> /api/health answers 500 when any env var is
 *                                 missing, so one renamed Vercel variable put
 *                                 EVERY iOS client into on-device mode while
 *                                 the network was perfectly fine.
 *   requiring our own json     -> better, but still stricter than web: a Vercel
 *                                 502 html error page, or a CDN challenge, read
 *                                 as offline when the person could have tried.
 *
 * 🔑 So the rule is web's rule: reaching Imotara at all is enough. One endpoint's
 * health must never decide whether the product works — the honest test of "can
 * we reach the cloud" is the actual request, which already falls back on its own.
 * A captive portal is still caught, because over https it breaks TLS and the
 * fetch THROWS rather than returning a login page.
 *
 * ℹ️ Verified in the library source: NetInfo calls reachabilityTest for any
 * resolved fetch, with no status short-circuit
 * (internal/internetReachability.ts — `.then(response => reachabilityTest(response))`),
 * so a non-2xx really does reach this function.
 *
 * 🔴 BUT IT DOES NOT RUN EVERYWHERE. Measured on a 1.4.6 release build,
 * 2026-10-05: the probe below is NEVER FETCHED ON ANDROID.
 *
 *   update(state) {
 *     if (typeof state.isInternetReachable === 'boolean' && useNativeReachability)
 *       setIsInternetReachable(state.isInternetReachable);   // native, no fetch
 *     else
 *       setExpectsConnection(state.isConnected);             // only this path probes
 *   }
 *
 * `useNativeReachability` defaults to TRUE and we do not override it, and
 * Android's ConnectivityReceiver.java really does send a boolean, so Android
 * always takes the first branch:
 *
 *   Android  native boolean sent  -> NO probe. reachabilityUrl and
 *                                    reachabilityTest are BOTH DEAD CODE here.
 *   iOS      ios/ has no such key -> probe RUNS. This test is live, and it is
 *                                    what stops a 500 from /api/health putting
 *                                    every iOS client into on-device mode.
 *   web      shim sets it to null -> probe RUNS (null is not a boolean).
 *
 * ⛔ So do not describe anything below as an Android defence. The emulator ran
 * this build for two minutes against a local mock and the mock logged ZERO
 * requests, while a raw `nc` from the same emulator reached it instantly.
 *
 * ✅ DECIDED 2026-10-05 — LEAVE ANDROID ON THE NATIVE SIGNAL. Flipping
 * `useNativeReachability` to false would make Android probe too, but it would
 * replace a free, accurate OS answer with "did one endpoint reply in 8s", so a
 * Vercel blip, a DNS hiccup or an expired cert would declare every Android user
 * offline while their network was fine. That is a single point of failure
 * between the person and the product. The OS signal has no such coupling.
 */
let started = false;
let unsubscribe: (() => void) | null = null;

/** How often to re-probe while things are working. The settings screen owns it. */
let longTimeoutMs = 60 * 1000;

function applyConfig() {
  NetInfo.configure({
    reachabilityUrl: "https://www.imotara.com/api/health",
    // ANY http response means we reached Imotara. Only a thrown request — DNS
    // failure, refused connection, broken TLS, timeout — means offline, and
    // NetInfo's own catch handles those. Deliberately identical to web's
    // useOnlineStatus.ts. See the note above on why this must not be stricter.
    reachabilityTest: async () => true,
    // Re-probe soon after a failure, lazily while things are working.
    reachabilityShortTimeout: 5 * 1000,
    reachabilityLongTimeout: longTimeoutMs,
    // ⚠️ 15s, not 8s. A timeout here is read as OFFLINE, so on a genuinely slow
    // connection a short timeout means EVERY probe fails and the person is
    // pinned to on-device replies for as long as the network stays poor —
    // silently, and worst for the people on the worst networks, which on this
    // product is a large part of India. That is the expensive error named at
    // the top of this file.
    // Raising it only affects BLACK-HOLE networks, where packets are dropped
    // and the request hangs. A refused connection, a DNS failure or broken TLS
    // still throws immediately and is unaffected, so genuinely dead networks
    // are still detected at once. The only cost is that a black hole takes 15s
    // instead of 8s to register, and "unknown counts as online" already means
    // we lean that way on purpose.
    reachabilityRequestTimeout: 15 * 1000,
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
