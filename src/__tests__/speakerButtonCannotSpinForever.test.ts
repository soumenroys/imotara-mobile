/**
 * The speaker button must never spin forever.
 *
 * 🔴 REPORTED BY THE OWNER, confirmed in the source 2026-10-09: "the speaker
 * button was continually spinning". Two independent defects, both live, and
 * BOTH are mobile-only — web's equivalent is correct (its abort signal is
 * fired only by the user's own stop handler, which resets its state, and it
 * arms no fetch timeout).
 *
 * ── D1. THE SPINNER IS ONLY EVER CLEARED BY onStart ─────────────────────
 *
 * ChatScreen set `preparingSpeechId` before calling speakMessage and cleared
 * it in `onStart`. `onDone` cleared only `speakingMessageId`. So ANY terminal
 * path that ends without audio ever starting left the spinner running.
 *
 * ⚠️ That path is reachable on the FREE TIER with one tap: TTS_ADVANCED is
 * gated off, so speakMessage goes straight to playNativeFallback; if the
 * device has no voice for that language it fires onUnavailable + onDone and
 * never onStart. The person gets a toast AND a spinner that never stops.
 * All three call sites had it, including the hands-free auto-read.
 *
 * ── D2. A FETCH TIMEOUT WAS MISREAD AS "THE USER PRESSED STOP" ──────────
 *
 *     if (err instanceof Error && err.name === "AbortError") {
 *         _speakingId = null;
 *         return;                      // no onDone, no onStart, no fallback
 *     }
 *
 * …labelled "User-initiated stop". But a user stop never reaches it: stopAll()
 * and stopSpeaking() both bump `_generation` BEFORE aborting, and the line
 * above returns on `myGen !== _generation`. The only thing that could reach
 * that branch was armedFetch's own 20s CHUNK_FETCH_TIMEOUT_MS, which aborts
 * the same controller.
 *
 * So a slow chunk fetch produced 20 seconds of spinner and then nothing at
 * all — no sound, no fallback, no error, no terminal callback — forever.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const code = (f: string) =>
    raw(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TTS = "src/lib/tts/mobileTTS.ts";
const CHAT = "src/screens/ChatScreen.tsx";

describe("🔴 D1 — every terminal path clears the spinner", () => {
    it("⛔ no onDone callback clears ONLY speakingMessageId", () => {
        // The exact shape of the bug, at all three call sites.
        const s = code(CHAT);
        expect(s).not.toMatch(/\(\) => \{ setSpeakingMessageId\(null\); \},/);
        expect(s).not.toMatch(/\(\) => \{ setSpeakingMessageId\(null\); reopenMicIfHandsfree\(\); \},/);
    });

    it("all three speakMessage call sites clear preparingSpeechId on done", () => {
        const s = code(CHAT);
        const sites = [...s.matchAll(/speakMessage\(/g)].length;
        expect(sites).toBe(3);
        const onDones = [...s.matchAll(/setPreparingSpeechId\(null\); setSpeakingMessageId\(null\)/g)].length;
        expect(onDones).toBe(3);
    });

    it("🔑 the 'voice not available' path stops the spinner before it toasts", () => {
        // Free tier + a language the device lacks = a toast and, before this
        // fix, a spinner that outlived it. onUnavailable fires WITHOUT onStart.
        const s = code(CHAT);
        const toasts = [...s.matchAll(
            /setPreparingSpeechId\(null\); toastRef\.current\?\.show\("Voice not available/g,
        )].length;
        expect(toasts).toBe(3);
    });

    it("⚠️ onStart still clears it too — this is belt AND braces, not a swap", () => {
        // Clearing only on done would show the spinner for the whole reply.
        const s = code(CHAT);
        expect([...s.matchAll(/setPreparingSpeechId\(null\); setSpeakingMessageId\(/g)].length)
            .toBeGreaterThanOrEqual(3);
    });
});

describe("🔴 D2 — a timeout is a failure, not a user stop", () => {
    it("the timeout marks itself before aborting", () => {
        const s = code(TTS);
        expect(s).toMatch(/let timedOut = false;/);
        expect(s).toMatch(/setTimeout\(\(\) => \{ timedOut = true; controller\.abort\(\); \}, CHUNK_FETCH_TIMEOUT_MS\)/);
    });

    it("🔑 …and the silent-return branch now excludes it", () => {
        // Without `&& !timedOut` the fix is inert.
        const s = code(TTS);
        expect(s).toMatch(/err\.name === "AbortError" && !timedOut/);
    });

    it("⚠️ a genuine user stop STILL returns silently", () => {
        // It must not fall back and start talking after someone pressed stop.
        const s = code(TTS);
        expect(s).toMatch(/if \(err instanceof Error && err\.name === "AbortError" && !timedOut\) \{\s*_speakingId = null;\s*return;/);
    });

    it("the premise holds: both stop paths bump _generation BEFORE aborting", () => {
        // This is WHY a user stop never reaches the AbortError branch, and so
        // why the branch was only ever catching timeouts. If this stops being
        // true, the reasoning above collapses.
        const s = code(TTS);
        for (const fn of ["async function stopAll", "export function stopSpeaking"]) {
            const body = s.slice(s.indexOf(fn), s.indexOf(fn) + 320);
            expect(body.indexOf("_generation++")).toBeGreaterThan(-1);
            expect(body.indexOf("_generation++")).toBeLessThan(body.indexOf("abort()"));
        }
    });

    it("a timed-out fetch reaches the native fallback, which always ends", () => {
        const s = code(TTS);
        // the catch falls through to playNativeFallback
        expect(s).toMatch(/await playNativeFallback\(remainingText, lang, rate, pitch, onDone, onStart, onUnavailable\);/);
        // and playNativeFallback's no-voice path fires BOTH callbacks
        expect(s).toMatch(/onUnavailable\?\.\(\);\s*_speakingId = null;\s*onDone\?\.\(\);/);
        // …as do its speech callbacks
        expect(s).toMatch(/onDone:\s*\(\) => \{ _speakingId = null; onDone\?\.\(\); \}/);
        expect(s).toMatch(/onError:\s*\(\) => \{ _speakingId = null; onDone\?\.\(\); \}/);
    });
});

describe("✅ web is already correct — recorded so nobody 'fixes' it", () => {
    it("web clears preparing in onDone, and arms no fetch timeout", () => {
        const web = "/Users/soumenroy/Projects/imotaraapp/src/app/chat/page.tsx";
        if (!fs.existsSync(web)) {
            console.warn("[speakerButton] ⚠️ SKIPPED the web half — sibling repo not checked out.");
            return;
        }
        const s = fs.readFileSync(web, "utf8");
        expect(s).toMatch(/onDone: \(\) => \{\s*setPreparing\(false\);\s*setSpeaking\(false\);/);
        // Its only abort comes from toggleSpeak, which resets state itself.
        expect(s).toMatch(/if \(preparing \|\| speaking\) \{[\s\S]{0,200}setPreparing\(false\);/);
    });
});

describe("🔴 D3 — an unsettled promise is not caught by try/catch", () => {
    // ⚠️ THIS is the one that actually hung on a device. D1 and D2 are real and
    // fixed, but neither was what the owner saw: with the TTS engine disabled
    // (`pm disable-user com.google.android.tts`) the FIXED build still span,
    // and logcat showed execution simply stopping:
    //
    //     W TextToSpeech: isSpeaking failed: not bound to TTS engine
    //     I ReactNativeJS: [mobileTTS] TTS_ADVANCED gate closed …
    //     ← and then nothing, ever.
    //
    // `Speech.getAvailableVoicesAsync()` never settled, so `await` parked and
    // every terminal callback became unreachable. A try/catch cannot help: it
    // fires on rejection, not on a promise that never answers.

    it("the voice list cannot hang", () => {
        const s = code(TTS);
        expect(s).toMatch(/const VOICE_LIST_TIMEOUT_MS = 3_000;/);
        expect(s).toMatch(/withTimeout\(\s*Speech\.getAvailableVoicesAsync\(\), VOICE_LIST_TIMEOUT_MS/);
    });

    it("…nor can isSpeakingAsync, which was not even in a try/catch", () => {
        const s = code(TTS);
        expect(s).toMatch(/withTimeout\(Speech\.isSpeakingAsync\(\), VOICE_LIST_TIMEOUT_MS, false\)/);
        expect(s).not.toMatch(/const isSpeaking = await Speech\.isSpeakingAsync\(\);/);
    });

    it("🔑 a TIMEOUT is never cached — only a real empty list is", () => {
        // The cache lives for the whole session. Caching [] because the engine
        // was briefly unbound would silently kill every voice until restart —
        // trading a stuck spinner for silent, permanent degradation.
        const s = code(TTS);
        expect(s).toMatch(/if \(timedOut\) \{[\s\S]{0,220}return \[\];/);
        const idx = s.indexOf("if (timedOut)");
        expect(s.slice(0, idx)).not.toMatch(/_voiceCache = value;/);
    });

    it("withTimeout resolves exactly once, whichever side wins", () => {
        const s = code(TTS);
        const fn = s.slice(s.indexOf("function withTimeout"), s.indexOf("function withTimeout") + 700);
        expect(fn).toMatch(/let done = false;/);
        // both the timer and BOTH promise outcomes must check the latch
        expect([...fn.matchAll(/if \(done\) return;/g)].length).toBe(3);
        expect(fn).toMatch(/p\.then\(/);
    });

    it("🔑 and every call site catches, so NO throw can strand the spinner", () => {
        const s = code(CHAT);
        const catches = [...s.matchAll(
            /\)\.catch\(\(e: unknown\) => \{[\s\S]{0,160}?setPreparingSpeechId\(null\);/g,
        )].length;
        expect(catches).toBe(3);
    });
});
