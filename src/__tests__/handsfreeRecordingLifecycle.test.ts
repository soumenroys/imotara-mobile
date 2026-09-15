/**
 * The recording lifecycle — three defects found on real hardware, 2026-09-16.
 *
 * The owner reported on Android (09-15) that hands-free "shows red but records
 * nothing". It then REPRODUCED on a real iPhone 14 Pro (iOS 26.6.2, build
 * 1.4.0/140) while reading the device syslog, which is what turned one vague
 * report into three specific defects — all in SHARED React Native code, so
 * both platforms have all three. None of these paths has a Platform.OS branch.
 *
 *   1. An alert said "Could not start recording" while the composer showed
 *      "Recording… 6s" in red and the iOS orange mic dot was lit. The system
 *      log confirmed the microphone was genuinely live
 *      (setMicrophoneMonitorState, sensor: microphone, attributed to
 *      com.imotara.imotara). The catch in startRecording undid nothing.
 *
 *   2. "once i press the stop recording button, it is again resuming
 *      recording" — stopRecording() took no argument, so a deliberate stop was
 *      indistinguishable from a turn that merely ended, and handleNoSpeech
 *      reopened the mic 400ms later.
 *
 *   3. Silence-stop only armed AFTER it first heard speech, so a microphone
 *      that captures nothing can never end its own turn.
 *
 * The first describe runs the lifecycle as real logic; the rest pin the wiring.
 */

import fs from "fs";
import path from "path";

const HOOK = fs.readFileSync(
    path.join(__dirname, "..", "hooks", "useVoiceInput.ts"),
    "utf8"
);
const CHAT = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"),
    "utf8"
);

/** Comments stripped — assertions must not match the prose that describes them. */
const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const HOOK_CODE = strip(HOOK);
const CHAT_CODE = strip(CHAT);

// ── Defect 1, as runnable logic ────────────────────────────────────────────

interface Rig {
    state: "idle" | "recording" | "transcribing";
    micLive: boolean;
    timerRunning: boolean;
    alerted: string | null;
}

/**
 * startRecording, with a throw injected after the microphone is already live.
 * `cleanUpOnError` is the fix under test.
 */
function startWithLateThrow(cleanUpOnError: boolean): Rig {
    const rig: Rig = { state: "idle", micLive: false, timerRunning: false, alerted: null };
    try {
        rig.micLive = true;          // createAsync resolved — the mic is OPEN
        rig.state = "recording";     // the UI goes red
        rig.timerRunning = true;     // the 6s / 7s counter starts
        throw new Error("setOnRecordingStatusUpdate failed");  // anything after can throw
    } catch {
        if (cleanUpOnError) {
            // Stop and unload BEFORE touching the audio mode, then reset.
            rig.micLive = false;
            rig.timerRunning = false;
            rig.state = "idle";
        }
        rig.alerted = "Could not start recording. Please try again.";
    }
    return rig;
}

describe("defect 1: an error must not leave a live recording behind", () => {
    it("reproduces what the owner photographed: red UI, live mic, error alert", () => {
        const before = startWithLateThrow(false);
        expect(before.alerted).toMatch(/Could not start recording/);
        expect(before.state).toBe("recording");   // UI says Recording…
        expect(before.micLive).toBe(true);        // orange dot lit
        expect(before.timerRunning).toBe(true);   // the counter that reached 6s
    });

    it("after the fix, the error leaves nothing running", () => {
        const after = startWithLateThrow(true);
        expect(after.alerted).toMatch(/Could not start recording/);
        expect(after.state).toBe("idle");
        expect(after.micLive).toBe(false);
        expect(after.timerRunning).toBe(false);
    });
});

describe("defect 1: the wiring", () => {
    // Exactly the catch block — a fixed-size slice ran past it into
    // cancelRecording, where stopAndUnloadAsync and clearTimer already lived,
    // and two of these assertions passed against the UNFIXED file.
    const body = () => {
        const i = HOOK_CODE.indexOf("} catch (err) {", HOOK_CODE.indexOf("const startRecording"));
        const end = HOOK_CODE.indexOf("} finally {", i);
        expect(i).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(i);
        return HOOK_CODE.slice(i, end);
    };

    it("the catch unloads a recorder that did get created", () => {
        expect(body()).toMatch(/recordingRef\.current/);
        expect(body()).toMatch(/stopAndUnloadAsync/);
    });

    it("the catch takes the half-written recording FILE with it", () => {
        // stopAndUnloadAsync releases the recorder but leaves the .m4a on
        // disk. Without this, every failed start left a voice recording in the
        // cache forever — found while auditing storage cleanup, 2026-09-16.
        const b = body();
        expect(b).toMatch(/partial\.getURI\(\)/);
        expect(b).toMatch(/FileSystem\.deleteAsync\(partialUri, \{ idempotent: true \}\)/);
    });

    it("the catch clears the duration timer", () => {
        expect(body()).toMatch(/clearTimer\(\)/);
    });

    it("the catch puts the state back to idle", () => {
        // The old comment claimed the state was "kept idle" — true only when
        // the throw beat setState("recording"). After it, nothing reset it.
        expect(body()).toMatch(/setState\("idle"\)/);
    });

    it("the audio mode is restored AFTER the recorder is unloaded, not before", () => {
        // Setting allowsRecordingIOS:false while a recording is still running
        // is itself suspected of breaking capture — the original "red but
        // records nothing".
        const b = body();
        expect(b.indexOf("stopAndUnloadAsync")).toBeLessThan(b.indexOf("allowsRecordingIOS: false"));
    });
});

// ── Defect 2 ───────────────────────────────────────────────────────────────

/** handleNoSpeech's decision, as ChatScreen now makes it. */
type Outcome = "alert" | "reopen" | "give up";
const noSpeech = (handsfree: boolean, userInitiated: boolean, emptyTurns: number): Outcome => {
    if (!handsfree) return "alert";
    if (userInitiated) return "give up";
    return emptyTurns + 1 >= 3 ? "give up" : "reopen";
};

describe("defect 2: tapping stop must actually stop", () => {
    it("a deliberate stop never reopens the mic", () => {
        // "once i press the stop recording button, it is again resuming
        // recording" — the whole of this defect, in one assertion.
        expect(noSpeech(true, true, 0)).toBe("give up");
        expect(noSpeech(true, true, 1)).toBe("give up");
    });

    it("a turn that merely ran out of speech still reopens", () => {
        // Removing the reopen would 'fix' the bug by deleting hands-free.
        expect(noSpeech(true, false, 0)).toBe("reopen");
        expect(noSpeech(true, false, 1)).toBe("reopen");
    });

    it("three empty turns in a row still stops on its own", () => {
        expect(noSpeech(true, false, 2)).toBe("give up");
    });

    it("outside hands-free the alert is unchanged, tap or not", () => {
        expect(noSpeech(false, true, 0)).toBe("alert");
        expect(noSpeech(false, false, 0)).toBe("alert");
    });

    it("stopRecording is told WHY it is stopping", () => {
        expect(HOOK_CODE).toMatch(/stopRecording = useCallback\(\s*async \(opts\?: \{ userInitiated\?: boolean \}\)/);
    });

    it("onNoSpeech is told too, so it can refuse to reopen", () => {
        expect(HOOK_CODE).toMatch(/onNoSpeech\?: \(info: \{ userInitiated: boolean \}\) => boolean/);
        expect(HOOK_CODE).toMatch(/onNoSpeechRef\.current\?\.\(\{ userInitiated/);
    });

    it("the mic-button stop says it was the person's doing", () => {
        expect(CHAT_CODE).toMatch(/stopRecording\(\{ userInitiated: true \}\)/);
    });

    it("handleNoSpeech really carries that guard, and returns before the reopen", () => {
        // ⚠️ Mutation-tested: an earlier version of this matched /userInitiated/
        // anywhere in the body, which the function's own SIGNATURE satisfies —
        // deleting the entire guard kept the suite green. Match the branch.
        const i = CHAT_CODE.indexOf("const handleNoSpeech");
        const body = CHAT_CODE.slice(i, CHAT_CODE.indexOf("\n  }, []", i));
        const guard = body.indexOf("if (info.userInitiated) {");
        const reopen = body.indexOf("reopenMicIfHandsfreeRef");
        expect(guard).toBeGreaterThan(-1);
        expect(reopen).toBeGreaterThan(guard);
        // ...and that branch must LEAVE, not fall through into the reopen.
        // ⚠️ Also mutation-tested: slicing guard→reopen was not enough, because
        // the three-strikes branch in between has a `return true` of its own,
        // so deleting THIS one still matched. Bound it to its own block.
        const branch = body.slice(guard, body.indexOf("emptyTurnsRef.current += 1", guard));
        expect(branch).toMatch(/return true;/);
    });

    it("an auto-ended turn still reopens, or hands-free stops being hands-free", () => {
        const i = CHAT_CODE.indexOf("const handleNoSpeech");
        const body = CHAT_CODE.slice(i, CHAT_CODE.indexOf("\n  }, []", i));
        expect(body).toMatch(/reopenMicIfHandsfreeRef\.current\(\)/);
    });
});

// ── Defect 3 ───────────────────────────────────────────────────────────────

/** The upload decision, as the hook now makes it. */
const willUpload = (heardSpeech: boolean | null, canTranscribe = true) =>
    canTranscribe && !(heardSpeech === false);

/**
 * The 500ms tick's stop decision, as the hook now makes it.
 * `heardAudible` is null when not metering at all (manual recording).
 * `heardSpeech` means the level reached the silence-stop threshold.
 */
const tickStops = (
    handsfree: boolean,
    heardAudible: boolean | null,
    elapsed: number,
    heardSpeech = false,
) => {
    let deadline = 60_000;
    if (handsfree && !heardSpeech) {
        deadline = heardAudible === false ? 10_000 : 20_000;
    }
    return elapsed >= deadline || elapsed >= 60_000;
};

/** The status callback's two INDEPENDENT thresholds, given a metering value. */
const classify = (db: number) => ({
    audible: db > -50,   // AUDIBLE_DB_FLOOR — "the mic is picking something up"
    speech: db > -35,    // SILENCE_DB_THRESHOLD — "loud enough to arm silence-stop"
});

describe("defect 3: a microphone that hears nothing must give up quickly", () => {
    it("a turn where no speech was EVER heard is not uploaded", () => {
        // Paying Whisper to transcribe a minute of silence, three times, is
        // what the old behaviour did.
        expect(willUpload(false)).toBe(false);
        expect(willUpload(true)).toBe(true);
    });

    it("manual recording, which never meters, is ALWAYS uploaded", () => {
        // The dangerous misreading: null is "we were not listening", not
        // "nobody spoke". Treating it as the latter would silently break
        // ordinary tap-to-record voice input for every user.
        expect(willUpload(null)).toBe(true);
    });

    it("hands-free gives up at 10s when it has heard nothing", () => {
        expect(tickStops(true, false, 9_500)).toBe(false);
        expect(tickStops(true, false, 10_000)).toBe(true);
    });

    it("a hands-free turn that heard real SPEECH keeps the full cap", () => {
        // Silence-stop ends these turns; the give-up must not cut short
        // someone who is still mid-sentence at 11s, or at 55s.
        expect(tickStops(true, true, 11_000, true)).toBe(false);
        expect(tickStops(true, true, 55_000, true)).toBe(false);
        expect(tickStops(true, true, 60_000, true)).toBe(true);
    });

    it("noise that is audible but never speech-loud cannot run for a minute", () => {
        // ⚠️ MEASURED, Android emulator 2026-09-16, four hands-free turns:
        // one ended at 10.34s and two ran 60.5s. A steady level between the two
        // thresholds is "audible" (so the 10s give-up stands down) but never
        // reaches the speech bar (so silence-stop never arms) — a band in which
        // NOTHING could end the turn. This is that band.
        expect(tickStops(true, true, 19_500, false)).toBe(false);
        expect(tickStops(true, true, 20_000, false)).toBe(true);
    });

    it("the silent case is still the FASTEST to give up", () => {
        // A dead mic should not have to wait out the noise deadline.
        const silentEndsAt = [...Array(60).keys()].find((s) => tickStops(true, false, s * 1000));
        const noisyEndsAt = [...Array(60).keys()].find((s) => tickStops(true, true, s * 1000, false));
        const speakingEndsAt = [...Array(61).keys()].find((s) => tickStops(true, true, s * 1000, true));
        expect(silentEndsAt).toBe(10);
        expect(noisyEndsAt).toBe(20);
        expect(speakingEndsAt).toBe(60);
    });

    it("manual recording never gives up early, however quiet", () => {
        expect(tickStops(false, null, 59_500)).toBe(false);
        expect(tickStops(false, null, 60_000)).toBe(true);
    });

    it("a QUIET speaker is neither cut off nor thrown away", () => {
        // The regression this pair of thresholds exists to prevent. Someone
        // softly spoken, or holding the phone at arm's length, can sit below
        // the silence-stop threshold while speaking perfectly audibly. Reusing
        // one number for both decisions would bin their words at 10 seconds.
        const soft = classify(-42);
        expect(soft.speech).toBe(false);    // too quiet to arm silence-stop...
        expect(soft.audible).toBe(true);    // ...but plainly someone talking
        expect(tickStops(true, soft.audible, 10_000)).toBe(false);  // not cut off
        expect(willUpload(soft.audible)).toBe(true);                // not discarded
    });

    it("a dead microphone is still recognised as dead", () => {
        const dead = classify(-120);
        expect(dead.audible).toBe(false);
        expect(tickStops(true, dead.audible, 10_000)).toBe(true);
        expect(willUpload(dead.audible)).toBe(false);
    });

    it("the two thresholds are genuinely different numbers in the hook", () => {
        expect(HOOK_CODE).toMatch(/SILENCE_DB_THRESHOLD = -35/);
        expect(HOOK_CODE).toMatch(/AUDIBLE_DB_FLOOR = -50/);
        // The give-up must consult the LOW bar, not the silence-stop one.
        expect(HOOK_CODE).toMatch(/if \(autoStopOnSilenceRef\.current && !hasSpokenRef\.current\) \{/);
        expect(HOOK_CODE).toMatch(/status\.metering > AUDIBLE_DB_FLOOR\) heardSpeechThisTurnRef\.current = true/);
    });

    it("the hook's real constants match the numbers asserted above", () => {
        expect(HOOK_CODE).toMatch(/NO_SPEECH_GIVE_UP_MS = 10_000/);
        expect(HOOK_CODE).toMatch(/NO_CLEAR_SPEECH_GIVE_UP_MS = 20_000/);
        expect(HOOK_CODE).toMatch(
            /deadline = heardSpeechThisTurnRef\.current === false\s*\? NO_SPEECH_GIVE_UP_MS[\s\S]{0,80}: NO_CLEAR_SPEECH_GIVE_UP_MS/);
        expect(HOOK_CODE).toMatch(/heardSpeechThisTurnRef\.current = autoStopOnSilenceRef\.current \? false : null/);
        expect(HOOK_CODE).toMatch(/const heardNothing = heardSpeechThisTurnRef\.current === false/);
    });

    it("the manual 60s cap is untouched — a pause mid-thought must not cut you off", () => {
        // physical_device_test_findings_2026_09_12 records why silence-stop is
        // hands-free-only: "a user composing a longer message by voice may
        // intentionally pause mid-thought and shouldn't get cut off."
        expect(HOOK_CODE).toMatch(/DEFAULT_MAX_DURATION_MS = 60_000/);
        expect(CHAT_CODE).toMatch(/autoStopOnSilence: handsfree/);
    });
});

// ── The voice-activity gate, where it meets the hook ───────────────────────

describe("noise rejection is wired in, and only to hands-free", () => {
    it("the upload is gated on the turn looking like speech", () => {
        // Owner, 2026-09-16: "lots of noises are getting recorded with wrong
        // interpretation as a human language".
        expect(HOOK_CODE).toMatch(/import \{ looksLikeSpeech, MAX_METERING_SAMPLES \} from "\.\.\/lib\/voiceActivity"/);
        expect(HOOK_CODE).toMatch(/if \(transcriptionAttempted && !heardNothing && !steadyNoise\) \{/);
    });

    it("it can NEVER gate a manual recording", () => {
        // ⚠️ Mutation-tested. A manual recording is something a person
        // deliberately started; silently binning it because it sounded steady
        // would be the worst failure this gate could produce. The
        // autoStopOnSilenceRef guard is what makes that impossible.
        expect(HOOK_CODE).toMatch(
            /const steadyNoise = autoStopOnSilenceRef\.current\s*&& !looksLikeSpeech\(meteringSamplesRef\.current\)/);
    });

    it("metering is collected per turn, reset per turn, and bounded", () => {
        expect(HOOK_CODE).toMatch(/meteringSamplesRef\.current = \[\];/);
        expect(HOOK_CODE).toMatch(/meteringSamplesRef\.current\.length < MAX_METERING_SAMPLES/);
        expect(HOOK_CODE).toMatch(/meteringSamplesRef\.current\.push\(status\.metering\)/);
    });
});
