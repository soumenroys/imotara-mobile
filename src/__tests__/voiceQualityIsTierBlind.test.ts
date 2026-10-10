/**
 * How good the voice sounds is not a paid feature.
 *
 * 🔴 Owner decision, recorded verbatim and reaffirmed 2026-10-10:
 *   "chat reply quality should be exactly same for any licensing tier.
 *    whatever the license type is, may be free, maybe plus"
 *   "Free and Paid version will get same quality of reply"
 *
 * The standing reply-quality rule names /api/tts and the mobile voice hooks
 * as part of the protected reply path, so the voice is covered by it.
 *
 * ⚠️ WHAT WENT WRONG. ChatScreen passed
 * `isFeatureEnabled("TTS_ADVANCED", licenseTier)` as speakMessage's
 * `useNeuralVoice` argument, so a FREE account never reached Azure and spoke
 * through the plain device voice. Reported as "speaking quality is totally
 * messed up ... much less emotion and expression."
 *
 * 🔑 It was NOT a regression in the speech code — nothing there had changed.
 * Gate enforcement arrived in 1.4.3 (SOFT_LAUNCH_BYPASS_ALL_GATES true ->
 * false); before that every gate bypassed to PREMIUM, so free accounts had
 * been getting Azure all along and lost it the moment enforcement landed.
 * Confirmed from production: ZERO /api/tts requests while speech played, and
 * the device's stored tier read FREE.
 *
 * ⚖️ Tier may gate QUANTITY, never QUALITY. This is the mobile counterpart of
 * the web repo's replyQualityIsTierBlind.test.ts.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { gate } from "../licensing/featureGates";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const CHAT = "src/screens/ChatScreen.tsx";
const TTS = "src/lib/tts/mobileTTS.ts";
/** Source with comments stripped — the ban below is about CODE. */
const code = (f: string) =>
  read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("🔴 the neural voice must not depend on what someone pays", () => {
  it("⛔ no tier gate is passed as the neural-voice argument", () => {
    // The exact expression that caused it.
    expect(code(CHAT)).not.toMatch(/isFeatureEnabled\("TTS_ADVANCED",\s*licenseTier\)/);
  });

  it("every speakMessage call gets a tier-blind value", () => {
    const src = code(CHAT);
    const calls = src.match(/VOICE_QUALITY_IS_TIER_BLIND/g) ?? [];
    // Three speaker paths in this screen: the reply, and two history renders.
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(src).toMatch(/const VOICE_QUALITY_IS_TIER_BLIND = true;/);
  });

  it("…and speakMessage itself still defaults to the good voice", () => {
    // Callers that pass nothing — e.g. the companion letter — must not be
    // quietly downgraded either.
    expect(code(TTS)).toMatch(/useNeuralVoice:\s*boolean\s*=\s*true/);
  });

  it("⛔ a FREE account reaches Azure, exactly like a paid one", () => {
    // The behavioural statement of the decision. If this ever fails, free
    // users are hearing the device voice again.
    const src = code(CHAT);
    const gatedArg = /speakMessage\([\s\S]{0,1200}?isFeatureEnabled\(/;
    expect(src).not.toMatch(gatedArg);
  });
});

describe("⚖️ what deliberately STAYS gated — quantity and customisation", () => {
  it("TTS_ADVANCED still exists and is still a paid feature", () => {
    // The decision was about how good the voice sounds, not about giving
    // away the rate/pitch controls it was named for.
    expect(gate("TTS_ADVANCED", "FREE").enabled).toBe(false);
    expect(gate("TTS_ADVANCED", "PLUS").enabled).toBe(true);
  });

  it("the Settings rate/pitch controls remain the gated thing", () => {
    expect(code("src/screens/SettingsScreen.tsx"))
      .toMatch(/gate\("TTS_ADVANCED",\s*licenseTier\)/);
  });

  it("FREE keeps exactly the entitlements it had — nothing else opened", () => {
    // ⛔ Guard against "fixing" this by handing free users the paid set.
    expect(gate("CLOUD_SYNC", "FREE").enabled).toBe(true);
    for (const f of ["HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "EXPORT_DATA",
                     "SEARCH_MODE", "REPLY_CADENCE"] as const) {
      expect(gate(f, "FREE").enabled).toBe(false);
    }
  });
});
