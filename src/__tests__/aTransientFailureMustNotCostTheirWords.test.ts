/**
 * U2 and U3: two ways mobile voice threw away work it already had.
 *
 * ── U3: ANY transcription failure cost the person their words ───────────
 * The caller deletes the recording in a `finally`, so a failure is permanent.
 * Before this, a 502, a rate limit or a dropped packet discarded what they
 * had already said and made them say it all again — on the connections this
 * product actually runs on, that is not a rare path.
 *
 * 🔑 This is the CLIENT-SIDE TWIN of 37aab10, "our plumbing failing must not
 * cost the user their input" — the same principle, one layer up, found by a
 * different route six weeks later. The server half was fixed; the client half
 * was not.
 *
 * ⚠️ Retry only what a retry can fix. A 400 means the audio or language was
 * refused and will be refused again; a 401 means the token is wrong. Those
 * burn a second upload to reach the same answer while the person waits twice
 * as long for it.
 *
 * ── U2: one slow chunk killed the rest of the reply ─────────────────────
 * The chunk timer was already per-fetch — the file says why — but every chunk
 * shared ONE AbortController. So the timer firing for chunk 1 aborted chunk 2
 * (which PREFETCH_DEPTH=2 guarantees is in flight) and left the signal
 * permanently aborted, so chunks 3, 4, 5… failed instantly.
 *
 * 🔑 Web was given the correct pattern the same night SPECIFICALLY so it would
 * not inherit this. Now mobile matches it.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const VOICE = "src/hooks/useVoiceInput.ts";
const TTS = "src/lib/tts/mobileTTS.ts";

/** Mirror of isRetryableTranscriptionError, so the DECISIONS are asserted. */
function retryable(msg: string): boolean {
  if (msg === "quota_exceeded") return false;
  const m = msg.match(/returned (\d{3})/);
  if (!m) return true;
  const status = Number(m[1]);
  return status === 408 || status === 429 || status >= 500;
}

describe("🔴 U3 — a transient failure must not cost them their words", () => {
  it.each([
    ["Transcription API returned 502", true,  "bad gateway — the classic blip"],
    ["Transcription API returned 503", true,  "service unavailable"],
    ["Transcription API returned 504", true,  "gateway timeout"],
    ["Transcription API returned 429", true,  "rate limited — a pause may clear it"],
    ["Transcription API returned 408", true,  "request timeout"],
    ["Network request failed",         true,  "no status at all = network"],
  ])("retries %s", (msg, want) => expect(retryable(msg)).toBe(want));

  it.each([
    ["Transcription API returned 400", "the audio/language was refused and will be again"],
    ["Transcription API returned 401", "the token is wrong; a retry cannot fix it"],
    ["Transcription API returned 403", "forbidden"],
    ["Transcription API returned 404", "wrong endpoint"],
    ["quota_exceeded",                 "a second call cannot create quota"],
  ])("⛔ does NOT retry %s", (msg) => expect(retryable(msg)).toBe(false));

  it("🔑 the SOURCE classifies them the same way, not just this mirror", () => {
    const s = raw(VOICE);
    expect(s).toMatch(/if \(msg === "quota_exceeded"\) return false;/);
    expect(s).toMatch(/if \(!m\) return true;/);
    expect(s).toMatch(/return status === 408 \|\| status === 429 \|\| status >= 500;/);
  });

  it("⚠️ exactly ONE retry — a loop would hold the mic for the whole outage", () => {
    const s = raw(VOICE);
    const fn = s.slice(s.indexOf("async function transcribeAudio"), s.indexOf("async function transcribeOnce"));
    expect([...fn.matchAll(/transcribeOnce\(/g)].length).toBe(2);
    expect(fn).not.toMatch(/for \(|while \(/);
  });

  it("…and it pauses before retrying rather than hammering", () => {
    expect(raw(VOICE)).toMatch(/await new Promise\(\(r\) => setTimeout\(r, 700\)\);/);
  });

  it("⛔ a non-retryable error is still rethrown, not swallowed", () => {
    expect(raw(VOICE)).toMatch(/if \(!isRetryableTranscriptionError\(err\)\) throw err;/);
  });
});

describe("🔴 U2 — one slow chunk no longer kills the rest of the reply", () => {
  const s = raw(TTS);

  it("each chunk fetch gets its OWN controller", () => {
    expect(s).toMatch(/const child = new AbortController\(\);/);
    // ⚠️ RE-POINTED: the call grew a `chunkIndex` argument so the quota can
    // count replies instead of chunks. The guarantee here is unchanged —
    // the fetch is handed the CHILD signal, not the shared one.
    expect(s).toMatch(/fetchChunkAudio\(chunkText, lang, gender, accessToken, child\.signal, emotion, chunkIndex\)/);
  });

  it("⛔ the timer aborts the CHILD, not the shared controller", () => {
    expect(s).toMatch(/setTimeout\(\(\) => \{ timedOut = true; child\.abort\(\); \}, CHUNK_FETCH_TIMEOUT_MS\)/);
    expect(s).not.toMatch(/setTimeout\(\(\) => \{ timedOut = true; controller\.abort\(\); \}/);
  });

  it("🔑 …but a real stop STILL cancels in flight requests", () => {
    // Without this, stopAll()/stopSpeaking() would stop cancelling uploads —
    // trading a wedged reply for a mic recording while the app still talks.
    expect(s).toMatch(/controller\.signal\.addEventListener\("abort", onParentAbort\)/);
    expect(s).toMatch(/if \(controller\.signal\.aborted\) child\.abort\(\);/);
  });

  it("⚠️ and the listener is removed, so a long reply does not accumulate them", () => {
    expect(s).toMatch(/controller\.signal\.removeEventListener\("abort", onParentAbort\);/);
  });

  it("✅ web already has the same shape — the platforms must not drift again", () => {
    const w = "/Users/soumenroy/Projects/imotaraapp/src/app/chat/page.tsx";
    if (!fs.existsSync(w)) {
      console.warn("[aTransientFailure] ⚠️ SKIPPED the web half — sibling repo not checked out.");
      return;
    }
    expect(fs.readFileSync(w, "utf8")).toMatch(/function armedSignal\(parent: AbortSignal, ms: number\)/);
  });
});
