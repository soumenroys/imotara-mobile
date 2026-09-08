// Intern feedback item A: "TTS takes 30-40 seconds, sometimes never plays."
//
// speakMessage awaits transliterateIfNeeded BEFORE chunking, so until it
// returns nothing has been requested from /api/tts at all. That call runs a
// gpt-4.1-mini request server-side and the route is deployed with
// maxDuration = 30 — and it used to have no client timeout, because the 20s
// per-chunk ceiling is armed later, inside armedFetch. A slow model call
// therefore meant ~30s of silence before the first chunk was even asked for.
//
// Timing out here costs pronunciation only: the catch returns the romanized
// text, which is what callers got before this function existed. That is why a
// timeout is safe, and it is the property most worth pinning.

import fs from "fs";
import path from "path";

const src = fs.readFileSync(
    path.join(__dirname, "..", "lib", "tts", "mobileTTS.ts"), "utf8");

const fn = (() => {
    const i = src.indexOf("async function transliterateIfNeeded(");
    expect(i).toBeGreaterThan(-1);
    const j = src.indexOf("\n}", i);
    return src.slice(i, j);
})();

describe("the transliterate step cannot stall the whole reply", () => {
    it("has a timeout of its own", () => {
        expect(fn).toMatch(/const TRANSLITERATE_TIMEOUT_MS = [\d_]+;/);
        expect(fn).toMatch(/setTimeout\(\(\) => own\.abort\(\), TRANSLITERATE_TIMEOUT_MS\)/);
    });

    it("is bounded well below the route's own 30s ceiling", () => {
        const m = /const TRANSLITERATE_TIMEOUT_MS = ([\d_]+);/.exec(fn);
        expect(m).not.toBeNull();
        const ms = parseInt(m![1].replace(/_/g, ""), 10);
        // Above the ~2.3s measured warm, with headroom for mobile data...
        expect(ms).toBeGreaterThanOrEqual(4000);
        // ...but nowhere near the 30s that produced the complaint.
        expect(ms).toBeLessThanOrEqual(10000);
    });

    it("aborts its OWN controller, never the caller's", () => {
        // Aborting the shared controller would kill the chunk fetches that
        // come next — turning a slow pronunciation lookup into no audio at all.
        expect(fn).toMatch(/const own = new AbortController\(\);/);
        expect(fn).toMatch(/signal: own\.signal/);
        expect(fn).not.toMatch(/controller\.abort\(\)/);
    });

    it("still honours an abort from the caller", () => {
        expect(fn).toMatch(/if \(signal\.aborted\) return text;/);
        expect(fn).toMatch(/signal\.addEventListener\("abort", onOuterAbort\)/);
        expect(fn).toMatch(/signal\.removeEventListener\("abort", onOuterAbort\)/);
    });

    it("clears its timer and listener on every exit", () => {
        const fin = fn.slice(fn.indexOf("} finally {"));
        expect(fin).toMatch(/clearTimeout\(timer\)/);
        expect(fin).toMatch(/removeEventListener/);
    });

    it("still fails open — a timeout yields the original text, never an error", () => {
        // The catch must return text, not rethrow: an abort lands here.
        expect(fn).toMatch(/\} catch \{\s*\n\s*return text;\s*\n\s*\} finally \{/);
    });

    it("languages outside the seven never make the call at all", () => {
        // English and Hindi must not pay a network round trip for this.
        const guard = fn.indexOf('if (!TTS_TRANSLITERATION_LANGS.has(lang)) return text;');
        expect(guard).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(fn.indexOf("fetch("));
        expect(src).toMatch(/TTS_TRANSLITERATION_LANGS = new Set\(\["bn", "gu", "te", "kn", "ml", "ur", "or"\]\)/);
    });

    it("text already in native script skips it too", () => {
        const skip = fn.indexOf("scriptRe?.test(text)");
        expect(skip).toBeGreaterThan(-1);
        expect(skip).toBeLessThan(fn.indexOf("fetch("));
    });
});

describe("the stage timings needed for the on-device session", () => {
    it("reports how long transliteration took", () => {
        expect(src).toMatch(/transliterate=\$\{translitMs\}ms/);
    });

    it("reports time to first sound, measured from the start of speakMessage", () => {
        expect(src).toMatch(/const tSpeakStart = Date\.now\(\);/);
        expect(src).toMatch(/TIME TO FIRST SOUND \$\{Date\.now\(\) - tSpeakStart\}ms/);
    });

    it("logs it once, on the first chunk only", () => {
        const block = src.slice(src.indexOf("TIME TO FIRST SOUND") - 300, src.indexOf("TIME TO FIRST SOUND"));
        expect(block).toMatch(/if \(i === 0\) \{/);
    });
});
