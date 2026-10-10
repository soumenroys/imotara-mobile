/**
 * The first sound of a reply must come out of the SPEAKER, not the earpiece.
 *
 * 🔴 Reported from a physical iPhone 2026-10-10, two symptoms with one cause:
 *   "only first time pressing the speaker is always very faint to hear"
 *   "during the reading of the whole text, the voice is getting changed in
 *    the midway of reading the whole text"
 *
 * The person had SPOKEN first. Voice input leaves the iOS audio session in
 * playAndRecord, and iOS routes playback in that category to the RECEIVER —
 * which is exactly "very faint" with the volume at maximum.
 *
 * playChunkAndWait does set allowsRecordingIOS:false, but immediately before
 * createAsync, giving iOS no time to move the route. Chunk 1 plays through
 * the earpiece; by a later chunk the switch has landed and the speaker takes
 * over — heard as the voice CHANGING mid-message.
 *
 * ⚖️ Reply quality is the protected surface, and a reply the person cannot
 * hear is the most complete degradation of it there is.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
  path.join(process.cwd(), "src/lib/tts/mobileTTS.ts"), "utf8");

/** speakMessage's body, so the ordering below is about the right function. */
const speak = (() => {
  const i = SRC.indexOf("const tSpeakStart = Date.now();");
  expect(i).toBeGreaterThan(-1);
  return SRC.slice(i, SRC.indexOf("playNativeFallback", i));
})();

describe("🔴 the route is left BEFORE the first sound is fetched", () => {
  it("speakMessage sets the audio mode before it strips or chunks anything", () => {
    const mode = speak.indexOf("Audio.setAudioModeAsync");
    const strip = speak.indexOf("stripMarkdown(text)");
    expect(mode).toBeGreaterThan(-1);
    expect(mode).toBeLessThan(strip);
  });

  it("…and therefore before the first chunk is requested", () => {
    // The fetch is what gives iOS time to move the route — roughly 2.8s on
    // the device this was reported from.
    const mode = speak.indexOf("Audio.setAudioModeAsync");
    const fetchAt = speak.indexOf("armedFetch");
    expect(fetchAt).toBeGreaterThan(-1);
    expect(mode).toBeLessThan(fetchAt);
  });

  it("⛔ it leaves recording mode and refuses the earpiece", () => {
    const block = speak.slice(speak.indexOf("Audio.setAudioModeAsync"));
    expect(block.slice(0, 400)).toMatch(/allowsRecordingIOS:\s*false/);
    expect(block.slice(0, 400)).toMatch(/playThroughEarpieceAndroid:\s*false/);
    expect(block.slice(0, 400)).toMatch(/playsInSilentModeIOS:\s*true/);
  });

  it("⛔ a failure to set the mode cannot cost the person their reply", () => {
    const block = speak.slice(speak.indexOf("Audio.setAudioModeAsync"));
    expect(block.slice(0, 460)).toMatch(/\.catch\(\(\) => \{\}\)/);
  });

  it("the per-chunk call REMAINS, as a guard for re-entering record mode", () => {
    // Removing it would be the obvious "we already did this" simplification,
    // and it is what protects a reply that spans a hands-free turn.
    const chunk = SRC.slice(SRC.indexOf("function playChunkAndWait"));
    expect(chunk.slice(0, 900)).toMatch(/Audio\.setAudioModeAsync/);
    expect(chunk.slice(0, 900)).toMatch(/allowsRecordingIOS:\s*false/);
  });

  it("playback is still requested at full volume", () => {
    expect(SRC).toMatch(/volume:\s*1\.0/);
  });
});
