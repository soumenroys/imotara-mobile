/**
 * Hands-free must not stop dead after a reply.
 *
 * 🔴 SYMPTOM 3, reported by testers and DEFERRED since 2026-09-26
 * (bug_handsfree_android_loop): "after the reply, the mic does not switch back
 * on automatically". It was never diagnosed — only deferred.
 *
 * 🔑 THE CAUSE, found 2026-10-09 while auditing the TTS fixes: the hands-free
 * loop has exactly ONE re-arm, and it hangs off `speakMessage`'s onDone. The
 * code says so itself:
 *
 *     "Waiting is right: onDone reopens the mic the moment speech ends."
 *     "No speech to wait for … so onDone will never fire — reopen the mic
 *      here or the conversation stops dead."
 *
 * So EVERY path where onDone fails to fire kills hands-free. Three such paths
 * were found and fixed the same night, all originally reported as a *speaker
 * button* bug:
 *
 *   D2  a 20s chunk-fetch timeout returned silently           (4379be4)
 *   D3  getAvailableVoicesAsync() never settling              (1b653f7)
 *   —   any throw, since every call site is fire-and-forget   (1b653f7)
 *
 * ⚠️ AND THE THIRD FIX WAS HALF-DONE. The terminal .catch() added in 1b653f7
 * cleared the spinner but did NOT re-arm the mic — so a throw left the
 * conversation dead: no voice, no mic, nothing to tap. Fixed here.
 *
 * ⛔ The user pressing STOP is deliberately NOT a re-arm. They stopped it.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const CHAT = "src/screens/ChatScreen.tsx";
const TTS = "src/lib/tts/mobileTTS.ts";

/** The auto-read call — the only speakMessage hands-free depends on. */
function autoReadBlock(): string {
  const s = raw(CHAT);
  const i = s.indexOf("setPreparingSpeechId(botMessage.id);");
  expect(i).toBeGreaterThan(-1);
  return s.slice(i, i + 2600);
}

describe("🔴 every way a reply can END must re-arm the mic", () => {
  it("onDone re-arms", () => {
    expect(autoReadBlock()).toMatch(/setSpeakingMessageId\(null\); reopenMicIfHandsfree\(\)/);
  });

  it("🔑 …and so does a THROW — this was the half-done fix", () => {
    const b = autoReadBlock();
    const i = b.indexOf('console.warn("[chat] speakMessage threw", e);');
    expect(i).toBeGreaterThan(-1);
    expect(b.slice(i, i + 700)).toMatch(/reopenMicIfHandsfree\(\);/);
  });

  it("the empty-reply path re-arms (there is no speech to wait on)", () => {
    expect(raw(CHAT)).toMatch(/else if \(handsfreeRef\.current\) \{[\s\S]{0,260}?reopenMicIfHandsfree\(\);/);
  });

  it("⛔ a deliberate user STOP does NOT re-arm", () => {
    // They stopped it on purpose. Reopening the mic would be the app arguing.
    expect(raw(CHAT)).toMatch(
      /onStopSpeak=\{\(\) => \{ stopSpeaking\(\); setSpeakingMessageId\(null\); setPreparingSpeechId\(null\); \}\}/,
    );
  });
});

describe("🔑 the TTS side keeps its half of the contract", () => {
  it("every exit of playNativeFallback fires onDone", () => {
    const s = raw(TTS);
    const pnf = s.slice(s.indexOf("async function playNativeFallback"), s.indexOf("export async function speakMessage"));
    // no device voice for this language
    expect(pnf).toMatch(/onUnavailable\?\.\(\);\s*_speakingId = null;\s*onDone\?\.\(\);/);
    // spoke, and finished or errored
    expect(pnf).toMatch(/onDone:\s*\(\) => \{ _speakingId = null; onDone\?\.\(\); \}/);
    expect(pnf).toMatch(/onError:\s*\(\) => \{ _speakingId = null; onDone\?\.\(\); \}/);
  });

  it("toggling the SAME message off still fires onDone", () => {
    expect(raw(TTS)).toMatch(/if \(wasThis\) \{ onDone\?\.\(\); return; \}/);
  });

  it("⚠️ the ONLY silent exit left is the genuine user abort", () => {
    // If this stops being the only one, hands-free can stop dead again.
    const s = raw(TTS);
    const sm = s.slice(s.indexOf("export async function speakMessage"), s.indexOf("export async function speakPreview"));
    expect(sm).toMatch(/err\.name === "AbortError" && !timedOut\) \{\s*_speakingId = null;\s*return;/);
    // …and a TIMEOUT is not that: it must reach the fallback, which fires onDone.
    expect(sm).toMatch(/await playNativeFallback\(remainingText, lang, rate, pitch, onDone, onStart, onUnavailable\);/);
  });

  it("🔑 the unbounded bridge calls stay bounded — an unsettled promise fires nothing", () => {
    // D3. `await` on a promise that never settles reaches no callback at all,
    // so hands-free waits forever for an onDone that cannot come.
    const s = raw(TTS);
    expect(s).toMatch(/withTimeout\(\s*Speech\.getAvailableVoicesAsync\(\), VOICE_LIST_TIMEOUT_MS/);
    expect(s).toMatch(/withTimeout\(Speech\.isSpeakingAsync\(\), VOICE_LIST_TIMEOUT_MS, false\)/);
  });
});

describe("⚠️ the re-arm still refuses when it should", () => {
  it("it will not open a mic onto a screen the person has left", () => {
    const s = raw(CHAT);
    const fn = s.slice(s.indexOf("const reopenMicIfHandsfree = useCallback"));
    const body = fn.slice(0, fn.indexOf("}, []"));
    expect(body).toMatch(/if \(!handsfreeRef\.current\) return;/);
    expect(body).toMatch(/if \(!mountedRef\.current\) return;/);
    expect(body).toMatch(/if \(!isFocusedRef\.current\) return;/);
    expect(body).toMatch(/if \(chatObscuredRef\.current\) return;/);
    expect(body).toMatch(/if \(voiceStateRef\.current !== "idle"\) return;/);
  });
});
