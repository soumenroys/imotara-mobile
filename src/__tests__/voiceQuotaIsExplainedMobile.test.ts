/**
 * Mobile's half: a rationed voice must say so, and which account you are on.
 *
 * 🔴 Owner, 2026-10-10, after the "speech got worse" investigation:
 *   "imotara should request to login for better voice assistance"
 *   "imotara should show the emil address in which the user is logged in
 *    somewhere. otherwise user will get confused."
 *
 * An ANONYMOUS identity has a daily allowance for the neural voice. Past it
 * /api/tts answers 429 and speakMessage silently drops to the device voice —
 * faint, flatter, no emotion styles, and not even the companion's gender.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const TTS = "src/lib/tts/mobileTTS.ts";
const CHAT = "src/screens/ChatScreen.tsx";
const SETTINGS = "src/screens/SettingsScreen.tsx";

describe("🔴 the quota is explained, not silently absorbed", () => {
  it("a 429 raises the signal before the fallback speaks", () => {
    const s = read(TTS);
    expect(s).toMatch(/\/\\bTTS API 429\\b\/\.test\(err\.message\)/);
    const at = s.indexOf("onVoiceQuotaReached?.()");
    const fallbackAt = s.indexOf("await playNativeFallback(remainingText", at - 2000);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(fallbackAt);
  });

  it("⛔ a broken handler cannot stop the reply being spoken", () => {
    expect(read(TTS)).toMatch(/try \{ onVoiceQuotaReached\?\.\(\); \} catch/);
  });

  it("⚠️ the parameter is LAST — callers pass `emotion` positionally", () => {
    // Inserting it earlier silently retyped every existing call. That is not
    // hypothetical: it happened on the first attempt and tsc caught it.
    const s = read(TTS);
    expect(s.indexOf("emotion?: string,")).toBeLessThan(s.indexOf("onVoiceQuotaReached?: () => void,"));
  });

  it("every speaker path reports it, not just the newest reply", () => {
    // Three: the auto-read after a reply, and two history re-reads.
    const c = read(CHAT);
    expect((c.match(/toastRef\.current\?\.show\(VOICE_QUOTA_NUDGE, "info"\)/g) ?? []).length)
      .toBeGreaterThanOrEqual(3);
  });

  it("the message names what happened AND what fixes it", () => {
    // ⚠️ Jest's expect() takes ONE argument — the message form is vitest's,
    // and this repo is Jest. Third time today; throw instead.
    const m = /VOICE_QUOTA_NUDGE =\s*\n?\s*"([^"]+)"/.exec(read(CHAT));
    if (!m) throw new Error("VOICE_QUOTA_NUDGE text not found in ChatScreen");
    expect(m[1]).toMatch(/limit/i);
    expect(m[1]).toMatch(/device voice/i);
    expect(m[1]).toMatch(/[Ss]ign in/);
  });

  it("⛔ it is a toast, not an Alert", () => {
    // The reply is already playing in the device voice; a modal would
    // interrupt something the person is listening to.
    const c = read(CHAT);
    expect(c).not.toMatch(/Alert\.alert\([^)]*VOICE_QUOTA_NUDGE/);
  });
});

describe("🔴 which account am I on?", () => {
  it("Settings shows the signed-in email", () => {
    const s = read(SETTINGS);
    expect(s).toMatch(/Signed in as/);
    expect(s).toMatch(/\{user\.email\}/);
  });

  it("…and says so plainly when NOT signed in", () => {
    // The state that caused the confusion. Silence is what made it hard.
    expect(read(SETTINGS)).toMatch(/Not signed in — this device only/);
  });

  it("it reads `user` from the auth context", () => {
    expect(read(SETTINGS)).toMatch(/const \{ accessToken, signOut, signInWithGoogle, user \} = useAuth\(\);/);
  });
});
