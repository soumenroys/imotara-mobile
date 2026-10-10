/**
 * 🔴 "very frequently it is showing either offline or using local instead of
 *     good wifi connectivity ... why the hell is it showing offline though
 *     the tower is full or wifi is strongly available"  — owner, 2026-10-10
 *
 * Two reasons it could say that on a healthy network:
 *
 *   1. ONE failed probe was enough. The reachability check is a real HTTP
 *      request to /api/health — a serverless function — so a cold start, a
 *      blip or a QUIC stall makes it miss its window while the connection is
 *      fine. A single miss flipped the app to offline, which shows the banner
 *      AND routes the next reply to the on-device engine.
 *
 *   2. Nothing ever said otherwise. Real requests were succeeding —
 *      replies arriving, speech playing — and none of that fed back. The app
 *      could insist it was offline while answering from the cloud.
 *
 * ⚖️ The asymmetry at the top of online.ts decides both: a false "offline"
 * silently degrades reply quality; a false "online" costs seconds.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  __setConnectivityForTest, getConnectivity, isDefinitelyOffline,
  noteReachedTheInternet, subscribeConnectivity,
} from "../lib/network/online";
import fs from "fs";
import path from "path";

const SRC = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const ONLINE = "src/lib/network/online.ts";
const FETCH = "src/lib/network/fetchWithTimeout.ts";

describe("🔑 a successful request proves we are online", () => {
  beforeEach(() => { __setConnectivityForTest("offline"); });

  it("marks online even when the probe had said offline", () => {
    expect(isDefinitelyOffline()).toBe(true);
    noteReachedTheInternet();
    expect(getConnectivity()).toBe("online");
    expect(isDefinitelyOffline()).toBe(false);
  });

  it("tells subscribers, so the banner clears", () => {
    const seen: string[] = [];
    const un = subscribeConnectivity((c) => seen.push(c));
    noteReachedTheInternet();
    un();
    expect(seen).toContain("online");
  });

  it("⛔ it can never claim OFFLINE — it is evidence in one direction only", () => {
    const fn = SRC(ONLINE).slice(SRC(ONLINE).indexOf("export function noteReachedTheInternet"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toMatch(/publish\("online"\)/);
    expect(body).not.toMatch(/"offline"/);
  });

  it("says nothing when it is already online — no pointless churn", () => {
    __setConnectivityForTest("online");
    const seen: string[] = [];
    const un = subscribeConnectivity((c) => seen.push(c));
    noteReachedTheInternet();
    un();
    expect(seen).toEqual([]);
  });
});

describe("🔴 one failed probe is not evidence of a dead network", () => {
  it("offline is only published after repeated failures", () => {
    const s = SRC(ONLINE);
    expect(s).toMatch(/const OFFLINE_CONFIRMATIONS = 2;/);
    expect(s).toMatch(/if \(consecutiveOfflineProbes < OFFLINE_CONFIRMATIONS\) return;/);
  });

  it("…and any non-offline result resets the count", () => {
    // Otherwise two failures an hour apart would eventually add up to a
    // false offline.
    expect(SRC(ONLINE)).toMatch(/\} else \{\s*\n\s*consecutiveOfflineProbes = 0;/);
  });

  it("a successful request also resets it", () => {
    const fn = SRC(ONLINE).slice(SRC(ONLINE).indexOf("export function noteReachedTheInternet"));
    expect(fn.slice(0, 260)).toMatch(/consecutiveOfflineProbes = 0;/);
  });

  it("⚖️ 'unknown' still counts as online, as it always did", () => {
    __setConnectivityForTest("unknown");
    expect(isDefinitelyOffline()).toBe(false);
  });
});

describe("⛔ the wiring — a response must actually report back", () => {
  it("fetchWithTimeout marks online on a response", () => {
    const f = SRC(FETCH);
    expect(f).toMatch(/noteReachedTheInternet\(\);\s*\n\s*return res;/);
  });

  it("…and does NOT mark anything on a failure", () => {
    // A server can be down while the network is healthy. Only success is
    // evidence; failure says nothing either way.
    const f = SRC(FETCH);
    const after = f.slice(f.indexOf("export async function fetchWithTimeout"));
    expect(after.match(/noteReachedTheInternet\(\)/g)?.length).toBe(1);
  });

  it("the offline short-circuit before the request is untouched", () => {
    // This is what stops a genuinely offline device burning a full timeout.
    expect(SRC(FETCH)).toMatch(/if \(isDefinitelyOffline\(\)\) throw new OfflineError\(\);/);
  });
});
