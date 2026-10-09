/**
 * "We heard nothing" and "we never listened" are not the same thing.
 *
 * 🔴 U8 of the 2026-10-09 audit, VERIFIED 2026-10-10.
 *
 * In hands-free, `heardSpeechThisTurnRef` starts as `false` and is only ever
 * raised by the recording-status callback — whose FIRST LINE is:
 *
 *     if (!status.isRecording || typeof status.metering !== "number") return;
 *
 * Plenty of Android builds never supply `status.metering`. On those devices
 * the ref stayed `false` for every turn, so:
 *
 *     heardNothing === true  ⇒  the audio was NEVER UPLOADED
 *                           ⇒  the turn reported empty
 *                           ⇒  hands-free reopened the mic
 *                           ⇒  the person spoke again … and again
 *
 * ⚠️ A loop where someone talks into a void, with nothing on screen to explain
 * it, on a feature whose entire promise is that they can just speak.
 *
 * 🔑 THE TELL is a zero-length metering buffer: samples are pushed only when
 * `metering` really is a number, so an empty buffer means we got no readings
 * at all and therefore know NOTHING — which is the `null` ("upload it") case,
 * not the `false` ("there is nothing in this file") case.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { looksLikeSpeech } from "../lib/voiceActivity";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const V = "src/hooks/useVoiceInput.ts";

/** Mirror of the gate, so the DECISION is asserted and not just its shape. */
const heardNothing = (ref: boolean | null, sampleCount: number) => ref === false && sampleCount > 0;

describe("🔴 a device that never meters must still be transcribed", () => {
  it("⛔ metered, and genuinely quiet ⇒ skip the upload (unchanged)", () => {
    // The money-saving behaviour this gate exists for must survive.
    expect(heardNothing(false, 40)).toBe(true);
  });

  it("🔑 NEVER metered ⇒ we know nothing ⇒ upload it", () => {
    // The bug: this used to be `true`, and the person's words were binned.
    expect(heardNothing(false, 0)).toBe(false);
  });

  it("metered and heard speech ⇒ upload (unchanged)", () => {
    expect(heardNothing(true, 40)).toBe(false);
  });

  it("manual recording (null = not metering) ⇒ upload (unchanged)", () => {
    expect(heardNothing(null, 0)).toBe(false);
    expect(heardNothing(null, 40)).toBe(false);
  });

  it("🔑 the SOURCE makes the same decision, not just this mirror", () => {
    const s = raw(V);
    expect(s).toMatch(/const everMetered = meteringSamplesRef\.current\.length > 0;/);
    expect(s).toMatch(/const heardNothing = heardSpeechThisTurnRef\.current === false && everMetered;/);
  });
});

describe("⚠️ the premise, pinned — if these change, the bug can return", () => {
  it("the status callback really does bail when metering is absent", () => {
    expect(raw(V)).toMatch(/if \(!status\.isRecording \|\| typeof status\.metering !== "number"\) return;/);
  });

  it("samples are pushed ONLY when metering is a real number", () => {
    // This is what makes an empty buffer a trustworthy signal.
    const s = raw(V);
    const i = s.indexOf('typeof status.metering !== "number"');
    expect(s.slice(i, i + 900)).toMatch(/meteringSamplesRef\.current\.push\(status\.metering\)/);
  });

  it("hands-free starts the ref at false — which is why it could stick", () => {
    expect(raw(V)).toMatch(/heardSpeechThisTurnRef\.current = autoStopOnSilenceRef\.current \? false : null;/);
  });

  it("✅ the sibling gate already failed open, and now the two agree", () => {
    // looksLikeSpeech([]) === true, so steadyNoise was never the blocker.
    // If this regressed, an unmetered device would be blocked by the OTHER
    // gate instead and the loop would come back wearing a different hat.
    expect(looksLikeSpeech([])).toBe(true);
    expect(raw(V)).toMatch(/&& !looksLikeSpeech\(meteringSamplesRef\.current\);/);
  });
});
