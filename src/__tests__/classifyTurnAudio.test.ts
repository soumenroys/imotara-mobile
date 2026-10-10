/**
 * The U8 decision, finally testable on any machine.
 *
 * 🔴 WHY THIS FILE EXISTS. The question "did we actually listen, or did we
 * just fail to measure?" was answered by an inline expression in a 600-line
 * hook. It could only be checked two ways: by reading it, or by owning a
 * phone that does not report audio metering. That is why U8 sat "fixed but
 * unverified" — the verification depended on which hardware happened to be
 * plugged in.
 *
 * 🔑 `heardSpeechThisTurnRef === false` means TWO different things:
 *   a) we metered all turn and never crossed the speech floor
 *      -> genuinely nothing in this recording
 *   b) the device never reported `metering` at all, so the status callback
 *      returned on its first line every time
 *      -> we know NOTHING
 *
 * Treating (b) as (a) made hands-free discard real speech: never uploaded,
 * turn reported empty, mic reopened, person talked into a void.
 *
 * ⚠️ AND THE FIRST FIX ONLY PATCHED ONE OF THE TWO CALLERS. The turn DEADLINE
 * made the identical mistake and was missed, so a no-metering device was still
 * cut off after the short 10s "nothing reached the mic" timeout, mid-sentence.
 * Both callers now share this one function, which is the real reason to
 * extract it.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { classifyTurnAudio } from "../hooks/useVoiceInput";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const V = "src/hooks/useVoiceInput.ts";

describe("🔴 the three situations, told apart", () => {
  it("metered all turn, heard nothing ⇒ nothing-to-send", () => {
    // The money-saving case this gate exists for. Must survive.
    expect(classifyTurnAudio(false, 40)).toBe("nothing-to-send");
    expect(classifyTurnAudio(false, 1)).toBe("nothing-to-send");
  });

  it("🔑 NEVER metered ⇒ unknown (the bug: this used to be nothing-to-send)", () => {
    expect(classifyTurnAudio(false, 0)).toBe("unknown");
  });

  it("heard speech ⇒ heard-speech, however many samples", () => {
    expect(classifyTurnAudio(true, 40)).toBe("heard-speech");
    expect(classifyTurnAudio(true, 0)).toBe("heard-speech");
  });

  it("manual recording (null = not metering) ⇒ unknown, always", () => {
    expect(classifyTurnAudio(null, 0)).toBe("unknown");
    expect(classifyTurnAudio(null, 300)).toBe("unknown");
  });

  it("⛔ only ONE input maps to discarding the audio", () => {
    // If any other combination ever returns nothing-to-send, somebody's
    // speech is being thrown away. Exhaustive over the real domain.
    const discards: string[] = [];
    for (const heard of [true, false, null] as const) {
      for (const n of [0, 1, 10, 299, 300]) {
        if (classifyTurnAudio(heard, n) === "nothing-to-send") discards.push(`${heard}/${n}`);
      }
    }
    expect(discards).toEqual(["false/1", "false/10", "false/299", "false/300"]);
  });
});

describe("🔑 BOTH callers use it — the half-fix is what made this necessary", () => {
  const s = raw(V);

  it("the upload decision", () => {
    expect(s).toMatch(/const audioVerdict = classifyTurnAudio\(/);
    expect(s).toMatch(/const heardNothing = audioVerdict === "nothing-to-send";/);
  });

  it("…and the turn DEADLINE, which the first fix missed", () => {
    const i = s.indexOf("let deadline = maxDurationMs;");
    expect(i).toBeGreaterThan(-1);
    const block = s.slice(i, i + 1200);
    expect(block).toMatch(/classifyTurnAudio\(/);
    expect(block).toMatch(/=== "nothing-to-send"/);
  });

  it("⛔ no raw `=== false` comparison survives anywhere", () => {
    // That expression IS the bug. If it reappears, the conflation is back.
    expect(s).not.toMatch(/heardSpeechThisTurnRef\.current === false/);
  });

  it("⚠️ a metering device is UNCHANGED — this must not alter shipped behaviour", () => {
    // 1.4.3 is live and stable. On hardware that meters, every verdict here is
    // identical to the old expression, so nothing observable changes.
    expect(classifyTurnAudio(false, 40)).toBe("nothing-to-send"); // old: heardNothing=true
    expect(classifyTurnAudio(true, 40)).toBe("heard-speech");     // old: heardNothing=false
    expect(classifyTurnAudio(null, 40)).toBe("unknown");          // old: heardNothing=false
  });
});
