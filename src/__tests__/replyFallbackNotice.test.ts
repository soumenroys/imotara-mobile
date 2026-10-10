/**
 * 🔴 "after send sudeenly the app went offline" — reported 2026-10-10, on a
 * physical iPhone whose connection had just finished uploading a voice
 * recording. The phone had not gone offline. Two defects said it had.
 *
 * 1. The cause was recovered by substring-matching the error MESSAGE. Our own
 *    deadline arrives as an AbortError whose message is exactly "Aborted" —
 *    containing none of "Network", "fetch", "connect" or "timeout" — so a slow
 *    server fell past every branch into a catch-all announcing the device had
 *    gone offline.
 *
 * 2. ⚠️ And the first branch could never be FALSE. Its last clause was
 *    `typeof navigator !== "undefined" && !navigator.onLine`. React Native
 *    sets `global.navigator = {product: 'ReactNative'}` with no `onLine`
 *    property, so `!undefined === true` made the whole test true for every
 *    error. Every failure said "No internet"; the other branches were dead.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { replyFallbackNotice } from "../lib/network/failureNotice";
import {
  OfflineError,
  NetworkUnavailableError,
  classifyNetworkFailure,
  isNetworkFailure,
} from "../lib/network/fetchWithTimeout";

/** Exactly what an AbortController produces through whatwg-fetch in RN. */
const abortError = () => {
  const e = new Error("Aborted");
  e.name = "AbortError";
  return e;
};
/** RN's "the request never left the device". */
const rnTypeError = () => new TypeError("Network request failed");

describe("🔴 the reported sentence must not be producible", () => {
  it("⛔ a TIMEOUT is never described as being offline", () => {
    // The bug, in one assertion.
    const notice = replyFallbackNotice(abortError());
    expect(notice).not.toMatch(/offline/i);
    expect(notice).not.toMatch(/no internet/i);
    expect(notice).toBe("Server took too long — replied on device");
  });

  it("⛔ an ORDINARY error is never described as being offline either", () => {
    // This is what the old catch-all branch said, and it is the worst case:
    // a server answered, and we told the person their phone had lost signal.
    for (const err of [new Error("boom"), new Error("500"), "a string", null, undefined, {}]) {
      expect(replyFallbackNotice(err)).not.toMatch(/offline|no internet/i);
    }
    expect(replyFallbackNotice(new Error("boom")))
      .toBe("Something went wrong — replied on device");
  });

  it("✅ a genuinely offline device IS told it is offline", () => {
    // The claim must still be available when it is true, or this "fix" would
    // just be a different lie.
    expect(replyFallbackNotice(new OfflineError())).toBe("No internet — replied on device");
  });

  it("an unreachable server is described honestly, without blaming the phone", () => {
    expect(replyFallbackNotice(rnTypeError()))
      .toBe("Couldn't reach the server — replied on device");
  });

  it("every notice says the reply came from the device, so nothing looks lost", () => {
    for (const err of [new OfflineError(), abortError(), rnTypeError(), new Error("x")]) {
      expect(replyFallbackNotice(err)).toMatch(/replied on device$/);
    }
  });

  it("the four outcomes are four DIFFERENT sentences", () => {
    const all = [new OfflineError(), abortError(), rnTypeError(), new Error("x")]
      .map(replyFallbackNotice);
    expect(new Set(all).size).toBe(4);
  });
});

describe("🔑 the kind survives the rethrow", () => {
  it("a wrapped timeout is still a timeout", () => {
    // aiClient rethrows as NetworkUnavailableError so a second endpoint is not
    // attempted. That wrapper used to carry only the message, which is where
    // the cause was lost — "Aborted" matched no keyword downstream.
    const wrapped = new NetworkUnavailableError("Aborted", "timeout");
    expect(classifyNetworkFailure(wrapped)).toBe("timeout");
    expect(replyFallbackNotice(wrapped)).toBe("Server took too long — replied on device");
  });

  it("a wrapped offline failure is still offline", () => {
    const wrapped = new NetworkUnavailableError("Device is offline", "offline");
    expect(replyFallbackNotice(wrapped)).toBe("No internet — replied on device");
  });

  it("the wrapper defaults to 'unreachable', never to 'offline'", () => {
    expect(new NetworkUnavailableError("x").kind).toBe("unreachable");
  });
});

describe("⚠️ what must NOT have changed — the second-endpoint decision", () => {
  it("isNetworkFailure still recognises exactly the same failures", () => {
    // aiClient uses this to decide whether trying /api/respond is worth it.
    // Widening it would silently stop that fallback from ever running;
    // narrowing it would resurrect the double-timeout it exists to prevent.
    for (const err of [new OfflineError(), new NetworkUnavailableError("x"), abortError(),
                       rnTypeError(), new Error("request timeout"), new Error("Aborted"),
                       new Error("Network request failed")]) {
      expect(isNetworkFailure(err)).toBe(true);
    }
  });

  it("…and still treats a server that answered as NOT a network failure", () => {
    for (const err of [new Error("HTTP 500"), new Error("quota_exceeded"), new Error("bad json")]) {
      expect(isNetworkFailure(err)).toBe(false);
      expect(classifyNetworkFailure(err)).toBeNull();
    }
  });
});

describe("⛔ navigator.onLine must never come back", () => {
  it("ChatScreen no longer consults it", () => {
    // It does not exist in React Native. Reading it silently forced the
    // "No internet" branch for every error.
    const src = fs.readFileSync(path.join(process.cwd(), "src/screens/ChatScreen.tsx"), "utf8");
    // ⚠️ CODE only. The fix left a comment explaining the defect, which names
    // `navigator.onLine` — and a naive match hit that comment. Keeping the
    // explanation is worth more than the simpler assertion.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/navigator\.onLine/);
    expect(src).toMatch(/toastRef\.current\?\.show\(replyFallbackNotice\(error\), "info"\)/);
  });

  it("…and React Native really does not define it", () => {
    // The premise. If RN ever ships navigator.onLine this reasoning changes.
    const rn = path.join(process.cwd(), "node_modules/react-native/Libraries/Core/setUpNavigator.js");
    if (fs.existsSync(rn)) {
      expect(fs.readFileSync(rn, "utf8")).not.toMatch(/onLine/);
    }
  });
});
