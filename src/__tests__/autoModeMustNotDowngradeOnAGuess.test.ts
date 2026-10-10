/**
 * "Auto" mode must not hand someone an on-device reply because a PROBE failed.
 *
 * 🔴 FOUND 2026-10-10 by end-to-end testing on the iOS simulator, which
 * displayed "You're offline — will reply using on-device mode" while the same
 * machine was serving cloud replies to curl.
 *
 *     if (wantsCloud && isOnline) { …cloud… }
 *
 * That single `&&` was the difference between a real reply and an on-device
 * one. `isOnline` comes from NetInfo, and ON iOS THAT IS A PROBE — a fetch of
 * /api/health with a timeout. A slow network, a Vercel blip or a cold start
 * makes it time out, NetInfo says "offline", and EVERY reply silently became
 * a degraded on-device answer while the network was fine.
 *
 * 🔑 online.ts already argued exactly this, about itself:
 *   "a false 'offline' -> the person silently gets a degraded on-device reply
 *    when the real one was available. Reply quality is a protected surface."
 *   "the honest test of 'can we reach the cloud' is the actual request, which
 *    already falls back on its own."
 * The gate contradicted the reasoning in its own dependency.
 *
 * ⚖️ AND IT COSTS NOTHING WHEN TRULY OFFLINE. fetchWithTimeout calls
 * isDefinitelyOffline() on its FIRST line and throws OfflineError immediately
 * — no socket, no timeout, no wait. That is the whole reason this is safe.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const CHAT = "src/screens/ChatScreen.tsx";
const FETCH = "src/lib/network/fetchWithTimeout.ts";
const ONLINE = "src/lib/network/online.ts";

describe("🔴 the cloud attempt does not depend on the probe", () => {
  it("⛔ the `&& isOnline` gate is gone from the cloud branch", () => {
    const s = raw(CHAT);
    expect(s).not.toMatch(/if \(wantsCloud && isOnline\) \{/);
    expect(s).toMatch(/if \(wantsCloud\) \{/);
  });

  it("🔑 the safety that makes this free still exists", () => {
    // If fetchWithTimeout stopped short-circuiting, removing the gate WOULD
    // cost a genuinely offline user a full timeout before their local reply.
    // That is the one thing that would turn this fix into a regression.
    const f = raw(FETCH);
    expect(f).toMatch(/if \(isDefinitelyOffline\(\)\) throw new OfflineError\(\);/);
    const body = f.slice(f.indexOf("isDefinitelyOffline()"), f.indexOf("isDefinitelyOffline()") + 300);
    // it must be BEFORE the controller/timeout is even set up
    expect(body).toMatch(/new AbortController\(\)/);
  });

  it("⚠️ the offline BANNER is untouched — telling them is still right", () => {
    // Showing "you're offline" is informative. Using it to withhold the cloud
    // attempt is what was wrong.
    expect(raw(CHAT)).toMatch(/\{!isOnline \?/);
  });

  it("⚠️ and the 'Couldn't connect' toast stays suppressed when offline", () => {
    // Nagging someone who knows they are offline is noise.
    expect(raw(CHAT)).toMatch(/if \(cloudFailed && isOnline && !cloudQuotaHit\)/);
  });

  it("⛔ an explicit LOCAL choice is still honoured — this is not 'always cloud'", () => {
    // analysisMode === "local" is the user's own decision and must survive.
    expect(raw(CHAT)).toMatch(/const wantsCloud = analysisMode !== "local";/);
  });
});

describe("🔑 the reasoning this relies on, pinned", () => {
  it("online.ts still documents the false-offline asymmetry", () => {
    // If someone ever 'simplifies' that comment away, the next person will not
    // know why the gate must not come back.
    const o = raw(ONLINE);
    expect(o).toMatch(/a false "offline"/);
    // ⚠️ the phrase wraps across comment lines — match the distinctive tail
    expect(o).toMatch(/protected surface, so this is the expensive error/);
  });

  it("…and that iOS really does probe, which is why iOS was hit", () => {
    const o = raw(ONLINE);
    // ⚠️ matched loosely — the comment is column-aligned with runs of spaces
    expect(o).toMatch(/ios\/ has no such key -> probe RUNS/);
  });
});
