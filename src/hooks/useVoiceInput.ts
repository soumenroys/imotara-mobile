// src/hooks/useVoiceInput.ts
// Records audio via expo-av and returns the URI for STT transcription.
// Uses expo-file-system for file upload — required for reliable FormData
// serialisation in production Hermes builds (RN 0.76 new architecture).

import { useState, useRef, useCallback, useEffect } from "react";
import { Alert, Linking, Platform } from "react-native";
import { Audio, InterruptionModeAndroid } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { looksLikeSpeech, MAX_METERING_SAMPLES } from "../lib/voiceActivity";

export type VoiceInputState = "idle" | "recording" | "transcribing";

export type UseVoiceInputResult = {
    state: VoiceInputState;
    startRecording: () => Promise<boolean>;
    /** `userInitiated: true` means a PERSON tapped stop. Hands-free uses it to
     *  tell "the turn ended by itself, reopen the mic" apart from "they asked
     *  it to stop" — see onNoSpeech. Defaults to false, so every automatic
     *  caller (silence detector, duration cap) keeps today's behaviour. */
    stopRecording: (opts?: { userInitiated?: boolean }) => Promise<void>;
    cancelRecording: () => Promise<void>;
    durationMs: number;
    /** Throw away whatever this recording turn produces.
     *
     *  Stopping a recording is not enough to stop it being SENT. By the time
     *  the transcription upload is in flight the recording is already over, and
     *  cancelRecording has nothing left to cancel — the upload lands, onTranscript
     *  fires, and in hands-free that means a message goes out from wherever the
     *  person now is. Call this whenever the turn stops being wanted: leaving the
     *  screen, backgrounding, unmounting.
     *
     *  It discards the RESULT; it does not abort the request. expo-file-system's
     *  uploadAsync has no cancellation in this version (createUploadTask is
     *  legacy-only), so the transcription still completes and still costs. What
     *  it guarantees is that nothing is inserted or sent. */
    abandonTurn: () => void;
    /** Whether the mic is already permitted, WITHOUT prompting for it.
     *  startRecording() calls requestPermissionsAsync(), which raises the OS
     *  dialog — fine when a person tapped the mic, wrong when something starts
     *  recording on its own (hands-free auto-start). Callers that open the mic
     *  without a tap must gate on this first. */
    hasPermission: () => Promise<boolean>;
};

const DEFAULT_MAX_DURATION_MS = 60_000;

function openAppSettings() {
    if (Platform.OS === "ios") {
        Linking.openURL("app-settings:").catch(() => {});
    } else {
        Linking.openSettings().catch(() => {});
    }
}

export type VoiceInputOptions = {
    maxDurationMs?: number;
    quality?: "high" | "low";
    cloudTranscription?: boolean;
    lang?: string;
    /** The companion's chosen name, if any. Whisper is given it as a spelling
     *  hint (see /api/voice/transcribe); without it the hint is the default
     *  "Imotara", which actively mis-hears a renamed companion's own name. */
    companionName?: string;
    /** Real accessToken if signed in, else the anonymous identity's token —
     *  /api/voice/transcribe requires some identity (no longer open/unauthenticated). */
    accessToken?: string;
    // When true, recording auto-stops after a period of silence following
    // some actual speech — used by hands-free mode so each turn ends on its
    // own instead of requiring a manual mic tap. Off by default: regular
    // (non-hands-free) recording keeps today's tap-to-stop-only behavior,
    // since a user composing a longer message by voice may intentionally
    // pause mid-thought and shouldn't get cut off.
    autoStopOnSilence?: boolean;
    // Called when the recording produced no usable transcript. Return true to
    // say "handled" and suppress the "Couldn't transcribe" alert.
    //
    // Hands-free needs this: a blocking alert ends the conversation until
    // someone taps the mic again, which is the one thing hands-free is meant to
    // avoid. It can instead reopen the mic and let the person simply speak
    // again. Everyone else keeps the alert — outside hands-free there is no
    // loop to resume, so silence with no explanation would just look broken.
    // `info.userInitiated` is true when a person tapped stop. Reopening the
    // mic in that case is the bug the owner hit: "once i press the stop
    // recording button, it is again resuming recording".
    onNoSpeech?: (info: { userInitiated: boolean }) => boolean;
};

// Lightweight amplitude-based silence detection (not a real VAD model) via
// expo-av's built-in metering — good enough to end a hands-free turn without
// pulling in a speech-detection library. Metering is dBFS, roughly -160
// (silence) to 0 (max); thresholds below are deliberately conservative
// (require real speech first, then a full 1.5s of continuous quiet) to avoid
// cutting someone off during a normal mid-sentence breath.
const SILENCE_DB_THRESHOLD = -35;
const SILENCE_STOP_MS = 1500;
const MIN_SPEECH_MS_BEFORE_AUTOSTOP = 600;
// How long a hands-free turn waits for the person to START speaking before it
// gives up. The silence-stop above can only end a turn it has already heard
// speech in, so before this existed a turn where nothing was ever heard — a
// microphone that opened but captured nothing, the fault the owner reported —
// ran to the full 60s cap and then paid Whisper to transcribe the silence.
// Ten seconds is comfortably longer than a person pausing to gather a thought
// after a reply finishes, and six times shorter than the cap it replaces.
// Hands-free only: manual recording is still tap-to-stop, deliberately.
const NO_SPEECH_GIVE_UP_MS = 10_000;
// The same give-up, for a turn where the microphone IS picking something up but
// it never gets loud enough to arm silence-stop. Measured on the Android
// emulator 2026-09-16: four hands-free turns, one ended at 10.34s and two ran
// 60.5s, because a steady level in the -50..-35 band satisfies AUDIBLE_DB_FLOOR
// (so the give-up below stood down) but never reaches SILENCE_DB_THRESHOLD (so
// silence-stop never armed). Between the two thresholds sat a band where
// NOTHING could end the turn and hands-free fell back to the full manual cap —
// the very "a mic that captures nothing useful cannot end its own turn" fault
// this was meant to close. Longer than the silent case because this one may be
// a real person who is simply softly spoken, and they should not be cut off at
// ten seconds; far shorter than the 60s they used to wait.
const NO_CLEAR_SPEECH_GIVE_UP_MS = 20_000;
// "Was there ANY audio at all this turn", which is a different and much lower
// bar than SILENCE_DB_THRESHOLD's "is this person speaking right now".
//
// The two must not share a number. -35 dBFS is deliberately conservative for
// ENDING a turn — it errs towards staying open through a soft passage so
// nobody is cut off mid-sentence. Reusing it to decide whether to give up and
// bin the audio inverts that caution: a softly-spoken person, a phone held at
// arm's length or a low-gain mic can sit below -35 while speaking perfectly
// audibly, and we would have discarded their words unheard at 10 seconds.
// Conversational speech lands around -20 to -35 dBFS and even soft speech
// stays above -45; room tone in a quiet room sits near -55 or below. -50
// separates "someone is there" from "nothing reached this microphone" with
// room to spare on the side that matters.
const AUDIBLE_DB_FLOOR = -50;

/**
 * Upload an audio file to /api/voice/transcribe.
 *
 * In production Hermes builds, passing { uri, name, type } directly to
 * FormData.append silently fails — the file blob is empty or corrupt.
 * The fix: read the file via expo-file-system first, then use
 * FileSystem.uploadAsync which handles the native multipart encoding
 * correctly in both debug and production builds.
 */
/**
 * 🔴 Is this worth trying again, or will a second attempt fail the same way?
 *
 * The caller DELETES the recording in a `finally`, so a failure here is
 * permanent: the person spoke, and we lost it. Before this, ANY failure —
 * a 502, a rate limit, a dropped packet — cost them their words and made them
 * say it all again. (U3 of the 2026-10-09 audit.)
 *
 * ⚠️ Retry only what a retry can fix. A 400 means the audio or language was
 * rejected and will be rejected again; a 401 means the token is wrong. Those
 * burn a second upload to reach the same answer, and the person waits twice as
 * long for it.
 *
 * 🔑 A thrown error with NO status is a network failure — the single most
 * likely transient case on the connections this product actually runs on.
 */
function isRetryableTranscriptionError(err: unknown): boolean {
    const msg = String((err as { message?: string } | null)?.message ?? err ?? "");
    if (msg === "quota_exceeded") return false;          // a second call cannot create quota
    const m = msg.match(/returned (\d{3})/);
    if (!m) return true;                                  // network / upload threw — worth one retry
    const status = Number(m[1]);
    // 408 timeout · 429 rate limit · 5xx server. Everything else is a refusal.
    return status === 408 || status === 429 || status >= 500;
}

/**
 * 🔴 DID WE ACTUALLY LISTEN, OR DID WE JUST FAIL TO MEASURE?
 *
 * `heardSpeechThisTurnRef` is `false` in two completely different situations:
 *
 *   a) we metered the whole turn and never crossed the speech floor
 *      -> there is genuinely nothing in this recording
 *   b) the device never reported `metering` at ALL, so the status callback
 *      returned on its first line every time and the ref was never raised
 *      -> we know NOTHING about whether anyone spoke
 *
 * Treating (b) as (a) is what made hands-free discard real speech on devices
 * that do not meter: the audio was never uploaded, the turn reported empty,
 * the mic reopened, and the person talked into a void. (U8, 2026-10-09.)
 *
 * 🔑 A zero-length sample buffer separates them: samples are pushed ONLY when
 * `metering` really is a number.
 *
 * ⚠️ EXPORTED AND PURE ON PURPOSE. Inline in a 600-line hook this could only
 * ever be checked by reading it, or by owning a phone that does not meter.
 * Now it can be tested exhaustively on any machine, which is the difference
 * between "believed correct" and "known correct".
 */
export type TurnAudioVerdict = "nothing-to-send" | "unknown" | "heard-speech";

export function classifyTurnAudio(
    heardSpeech: boolean | null,
    meteringSampleCount: number,
): TurnAudioVerdict {
    // null = we were not metering at all (a manual recording). Always upload.
    if (heardSpeech === null) return "unknown";
    if (heardSpeech) return "heard-speech";
    // false, but we never got a single reading — that is (b), not (a).
    if (meteringSampleCount === 0) return "unknown";
    return "nothing-to-send";
}

/**
 * Undo a half-started recording.
 *
 * 🔴 WHY THIS IS A FUNCTION. Found on a real iPhone 2026-09-16: an alert
 * reading "Could not start recording" while the composer showed "Recording…
 * 6s" in red and the iOS orange microphone dot was lit — the device syslog
 * confirmed the mic was genuinely live. `createAsync` resolves, recordingRef
 * is set, setState("recording") runs and the timer starts, and THEN any of
 * setProgressUpdateInterval / setOnRecordingStatusUpdate / setInterval can
 * throw. The recovery used to undo none of it.
 *
 * That recovery only runs when a native call fails mid-setup, which cannot be
 * provoked by using the app — so it was shipped on the strength of reading it.
 * As an injectable function its every step is assertable on any machine.
 *
 * ⛔ THE ORDER IS LOAD-BEARING, not stylistic:
 *   1. clear the timer   — or it fires against a recorder that is being torn
 *                          down and calls stop again
 *   2. unload the recorder, THEN restore the audio mode. Setting
 *      allowsRecordingIOS:false while a recording is still running is itself
 *      suspected of producing the original Android report: a red indicator
 *      over a microphone that captures nothing.
 *   3. delete the partial file — stopAndUnloadAsync releases the recorder but
 *      leaves the .m4a on disk, so without this every failed start would
 *      leave a voice recording in the cache forever.
 *
 * Returns which alert the caller should raise; it raises none itself, so the
 * decision is testable without a UI.
 */
export type FailedStartRecovery = "permission-blocked" | "generic-error";

export interface FailedStartIO {
    clearTimer: () => void;
    /** Detaches the recorder from the hook and hands it over, or null. */
    takeRecording: () => {
        /** Resolves a RecordingStatus we deliberately ignore. */
        stopAndUnload: () => Promise<unknown>;
        /** Safe after an unload error: returns the cached path, no native call. */
        getUri: () => string | null;
    } | null;
    /** setState("idle") + setDurationMs(0), so the button stays tappable. */
    toIdle: () => void;
    restoreAudioMode: () => void;
    deleteFile: (uri: string) => void;
    isPermissionGranted: () => Promise<boolean>;
}

export async function recoverFromFailedStart(
    io: FailedStartIO,
): Promise<FailedStartRecovery> {
    io.clearTimer();

    const partial = io.takeRecording();
    if (partial) {
        try {
            await partial.stopAndUnload();
        } catch {
            /* already gone — carry on with the rest of the cleanup */
        }
        const partialUri = partial.getUri();
        if (partialUri) io.deleteFile(partialUri);
    }

    io.toIdle();

    // M-2: setAudioModeAsync may have succeeded before createAsync threw,
    // leaving Android in DoNotMix mode. Restore it unconditionally.
    io.restoreAudioMode();

    return (await io.isPermissionGranted()) ? "generic-error" : "permission-blocked";
}

/**
 * Which script the transcript came back in — the one thing that says whether
 * the language hint worked, without logging the person's whole sentence.
 */
function scriptOf(text: string): string {
    if (/[\u0980-\u09FF]/.test(text)) return "bengali";
    if (/[\u0900-\u0963\u0966-\u097F]/.test(text)) return "devanagari";
    if (/[\u0B80-\u0BFF]/.test(text)) return "tamil";
    if (/[\u0C00-\u0C7F]/.test(text)) return "telugu";
    if (/[\u0A80-\u0AFF]/.test(text)) return "gujarati";
    if (/[\u0A00-\u0A7F]/.test(text)) return "gurmukhi";
    if (/[\u0C80-\u0CFF]/.test(text)) return "kannada";
    if (/[\u0D00-\u0D7F]/.test(text)) return "malayalam";
    if (/[\u0B00-\u0B7F]/.test(text)) return "odia";
    if (/[\u0600-\u06FF]/.test(text)) return "arabic";
    if (/[\u0590-\u05FF]/.test(text)) return "hebrew";
    if (/[\u3040-\u30FF]/.test(text)) return "kana";
    if (/[\u4E00-\u9FFF]/.test(text)) return "cjk";
    if (/[\u0400-\u04FF]/.test(text)) return "cyrillic";
    return "latin";
}

async function transcribeAudio(
    uri: string,
    apiBaseUrl: string,
    lang: string,
    mimeType: string,
    accessToken?: string,
    companionName?: string,
): Promise<string> {
    try {
        return await transcribeOnce(uri, apiBaseUrl, lang, mimeType, accessToken, companionName);
    } catch (err) {
        if (!isRetryableTranscriptionError(err)) throw err;
        console.warn("[useVoiceInput] transcription failed, retrying once:", String(err));
        // A short pause: long enough to clear a momentary blip, short enough
        // that the person does not notice it on top of the wait they already
        // have. ⚠️ ONE retry — a loop here would hold the mic spinner for as
        // long as the outage lasts, which is worse than telling them plainly.
        await new Promise((r) => setTimeout(r, 700));
        return await transcribeOnce(uri, apiBaseUrl, lang, mimeType, accessToken, companionName);
    }
}

async function transcribeOnce(
    uri: string,
    apiBaseUrl: string,
    lang: string,
    mimeType: string,
    accessToken?: string,
    companionName?: string,
): Promise<string> {
    const endpoint = `${apiBaseUrl}/api/voice/transcribe`;

    // FileSystem.uploadAsync is the reliable path for production Hermes builds.
    // It directly reads the file on the native side, bypassing the JS-side
    // FormData serialisation that breaks in release/Hermes mode.
    const uploadResult = await FileSystem.uploadAsync(endpoint, uri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType,
        parameters: { lang, ...(companionName ? { companionName } : {}) },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });

    if (uploadResult.status === 503) {
        let body: { error?: string } | null = null;
        try { body = JSON.parse(uploadResult.body); } catch { /* ignore */ }
        if (body?.error === "quota_exceeded") {
            throw new Error("quota_exceeded");
        }
    }

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Transcription API returned ${uploadResult.status}`);
    }

    let json: { text?: string } | null = null;
    try {
        json = JSON.parse(uploadResult.body);
    } catch {
        throw new Error("Invalid response from transcription API");
    }

    return (json?.text ?? "").trim();
}

export function useVoiceInput(
    onTranscript: (text: string) => void,
    apiBaseUrl?: string,
    opts?: VoiceInputOptions,
): UseVoiceInputResult {
    const maxDurationMs = opts?.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    const quality = opts?.quality ?? "high";
    const cloudTranscription = opts?.cloudTranscription ?? true;
    // startRecording has [] deps, so it needs the live value rather than the
    // one captured when it was created.
    const cloudTranscriptionRef = useRef(cloudTranscription);
    useEffect(() => { cloudTranscriptionRef.current = cloudTranscription; }, [cloudTranscription]);
    const langRef = useRef(opts?.lang ?? "en");
    const companionNameRef = useRef(opts?.companionName);
    useEffect(() => { companionNameRef.current = opts?.companionName; }, [opts?.companionName]);
    const optsLang = opts?.lang;
    useEffect(() => { langRef.current = optsLang ?? "en"; }, [optsLang]);
    const accessTokenRef = useRef(opts?.accessToken);
    const optsAccessToken = opts?.accessToken;
    useEffect(() => { accessTokenRef.current = optsAccessToken; }, [optsAccessToken]);
    const autoStopOnSilenceRef = useRef(opts?.autoStopOnSilence ?? false);
    const optsAutoStopOnSilence = opts?.autoStopOnSilence;
    useEffect(() => { autoStopOnSilenceRef.current = optsAutoStopOnSilence ?? false; }, [optsAutoStopOnSilence]);
    // No dep array — stopRecording holds this callback for the whole life of a
    // recording, so it must always be the latest one, not the one that existed
    // when recording began.
    const onNoSpeechRef = useRef(opts?.onNoSpeech);
    useEffect(() => { onNoSpeechRef.current = opts?.onNoSpeech; });
    const [state, setState] = useState<VoiceInputState>("idle");
    const [durationMs, setDurationMs] = useState(0);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Silence-detection state (only touched when autoStopOnSilence is on) —
    // reset at the start of each recording in startRecording.
    const hasSpokenRef = useRef(false);
    // Survives into stopRecording, unlike hasSpokenRef which the autostop logic
    // owns. null means "we were not listening for speech at all" (manual
    // recording does not meter), and must NOT be read as "heard nothing".
    const heardSpeechThisTurnRef = useRef<boolean | null>(null);
    // Every metering reading of the current turn, for the voice-activity gate.
    // Loudness alone cannot tell a person from a fan; the SHAPE of the level
    // over time can. See src/lib/voiceActivity.ts.
    const meteringSamplesRef = useRef<number[]>([]);
    const firstSpeechAtRef = useRef(0);
    const silenceStartRef = useRef<number | null>(null);
    const startTsRef = useRef<number>(0);
    // BUG-12B: synchronous in-flight flag for startRecording. recordingRef is only
    // set after createAsync resolves, so the BUG-11A guard (recordingRef.current)
    // does not protect against a second call arriving during the permission dialog
    // (which can be open for several seconds). isStartingRef is set synchronously
    // before the first await, closing that window.
    const isStartingRef = useRef(false);
    // Turn counter, same idea as mobileTTS's _generation. stopRecording captures
    // the value at the top; if it has moved by the time the upload resolves, the
    // turn was abandoned and the transcript is dropped on the floor.
    const turnRef = useRef(0);

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Ref so the setInterval auto-stop callback always calls the latest
    // stopRecording even if cloudTranscription changes mid-session.
    const stopRecordingRef = useRef<(opts?: { userInitiated?: boolean }) => Promise<void>>(async () => {});

    const stopRecording = useCallback(async (opts?: { userInitiated?: boolean }): Promise<void> => {
        const userInitiated = opts?.userInitiated === true;
        clearTimer();
        const recording = recordingRef.current;
        if (!recording) { setState("idle"); return; }
        // M-3: claim ownership immediately — prevents a concurrent auto-stop timer
        // tick from passing this guard and calling stopAndUnloadAsync a second time.
        recordingRef.current = null;

        setState("transcribing");
        let uri: string | null = null;
        try {
            // M-1: use nested try/finally so the audio mode is ALWAYS restored even
            // if stopAndUnloadAsync throws (e.g. hardware error, already unloaded).
            try {
                await recording.stopAndUnloadAsync();
            } finally {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                    shouldDuckAndroid: true,
                }).catch(() => {});
            }

            uri = recording.getURI() ?? null;
            if (!uri) throw new Error("No recording URI");

            let transcript = "";
            // null = we were not metering (manual recording), so we know
            // nothing about whether anyone spoke and must upload as before.
            // false = we metered the whole turn and never once crossed the
            // speech threshold, so there is nothing in this file to transcribe.
            // 🔴 "WE HEARD NOTHING" AND "WE NEVER LISTENED" ARE NOT THE SAME.
            //
            // In hands-free this ref starts as `false` and is only ever raised
            // by the status callback — which bails on its first line when the
            // device does not supply `status.metering`. Plenty of Android
            // builds do not. On those devices it stayed `false` for every turn,
            // so the audio was NEVER UPLOADED, the turn reported empty,
            // hands-free reopened the mic, and the person talked into a void —
            // repeatedly, with nothing on screen explaining why.
            // (U8 of the 2026-10-09 audit.)
            //
            // 🔑 A zero-length sample buffer is the tell: samples are pushed
            // only when `metering` really is a number, so an empty buffer means
            // we never got a single reading and therefore know NOTHING about
            // whether anyone spoke. That is the `null` case — upload it.
            //
            // ⚠️ This does not reopen the "a minute of silence cost real money"
            // hole it was written to close. A genuinely silent long recording
            // DOES produce metering samples on a device that meters, so
            // heardNothing still fires there exactly as before. The only turns
            // that change are the ones we could never judge in the first place.
            //
            // ✅ The sibling gate already got this right: looksLikeSpeech([])
            // returns true, so `steadyNoise` fails open on an empty buffer.
            // This makes the two gates agree.
            const audioVerdict = classifyTurnAudio(
                heardSpeechThisTurnRef.current,
                meteringSamplesRef.current.length,
            );
            const heardNothing = audioVerdict === "nothing-to-send";
            // A room making noise, rather than a person talking. Only ever
            // applied to hands-free, which is the mode that opens the mic on
            // its own and so is the only one that records rooms; a manual
            // recording is something a person deliberately started and is
            // never gated. Fails open on every uncertain case.
            const steadyNoise = autoStopOnSilenceRef.current
                && !looksLikeSpeech(meteringSamplesRef.current);
            const transcriptionAttempted = !!(apiBaseUrl && cloudTranscription);
            const myTurn = turnRef.current;

            // Skipping the upload does NOT skip reporting the empty turn below:
            // transcriptionAttempted stays true, so hands-free still learns the
            // turn produced nothing and can reopen. Only the pointless upload
            // goes — transcribing a minute of silence cost real money and could
            // only ever come back as a Whisper hallucination.
            if (transcriptionAttempted && !heardNothing && !steadyNoise) {
                try {
                    // All presets produce MPEG_4/AAC/.m4a on both platforms.
                    // (Android LOW_QUALITY is overridden at record time to avoid
                    // THREE_GPP/3gp which Whisper v1 does not accept.)
                    // 🔴 LOG THE HINT AND THE RESULT. Reported 2026-10-10 from
                    // a physical iPhone: spoke Bengali, got Hindi text and a
                    // Hindi reply. The device log could not say whether we had
                    // TOLD Whisper "hi", or sent "auto" and Whisper guessed
                    // wrong — and those need opposite fixes. One line makes the
                    // next report answerable instead of inferred.
                    console.log(`[useVoiceInput] transcribe hint=${langRef.current}`);
                    transcript = await transcribeAudio(uri, apiBaseUrl!, langRef.current, "audio/m4a", accessTokenRef.current, companionNameRef.current);
                    console.log(
                        `[useVoiceInput] transcript script=${scriptOf(transcript)} ` +
                        `len=${transcript.length} head=${JSON.stringify(transcript.slice(0, 40))}`,
                    );
                } catch (err: any) {
                    console.warn("[useVoiceInput] Transcription failed:", err);
                    // Same abandonment check as below — without it this alert
                    // pops on whatever screen the person moved to.
                    if (turnRef.current !== myTurn) return;
                    if (err?.message === "quota_exceeded") {
                        Alert.alert(
                            "Voice unavailable",
                            "Voice transcription is temporarily unavailable. Please type your message instead.",
                            [{ text: "OK" }],
                        );
                        return; // skip the generic "Couldn't transcribe" alert below
                    }
                }
            }

            // Abandoned while the upload was in flight — the person left the
            // screen, backgrounded the app, or the screen unmounted. Say nothing
            // and send nothing.
            if (turnRef.current !== myTurn) return;

            if (transcript.trim()) {
                onTranscript(transcript.trim());
            } else if (transcriptionAttempted && !onNoSpeechRef.current?.({ userInitiated })) {
                // M-4: only show this alert when transcription was actually attempted.
                // The cloudTranscription=false case never reaches here any more —
                // startRecording refuses before the microphone opens, rather than
                // recording and discarding. The old comment here claimed "the user
                // knows cloud STT is off", which was an assumption, not something
                // the app had ever told them.
                Alert.alert(
                    "Couldn't transcribe",
                    "We couldn't convert your voice to text. Please try again, or type your message instead.",
                    [{ text: "OK" }],
                );
            }
        } catch (err) {
            console.warn("[useVoiceInput] stopRecording error:", err);
            Alert.alert(
                "Voice input error",
                "Could not process the recording. Please try again.",
            );
        } finally {
            if (uri) {
                FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            }
            setState("idle");
            setDurationMs(0);
        }
    }, [apiBaseUrl, cloudTranscription, onTranscript]);

    // Keep ref current so the setInterval callback always calls the latest version.
    useEffect(() => { stopRecordingRef.current = stopRecording; });

    const startRecording = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === "web") {
            Alert.alert("Voice input", "Voice input is not supported in the web browser.");
            return false;
        }
        // With "Online transcription" off there is nothing that can turn a
        // recording into text — the app has no on-device speech recognition
        // (expo-speech is text-to-SPEECH; nothing in package.json does the
        // reverse). Recording anyway and discarding the audio afterwards is
        // what used to happen, and it was worse than useless: the microphone
        // ran, captured someone's voice, and the app said nothing at all.
        //
        // The toggle is worth keeping — it is a real consent control over
        // whether a recording leaves the device — but it has to be honest that
        // switching it off turns voice input off with it.
        if (!cloudTranscriptionRef.current) {
            Alert.alert(
                "Online transcription is off",
                "Voice input needs it: Imotara has no on-device speech recognition, so there is nothing to turn your recording into text.\n\nTurn it back on in Settings → Experience → Voice input, or type your message instead.",
                [{ text: "OK" }],
            );
            return false;
        }
        // BUG-11A / BUG-12B: guard against concurrent invocations.
        // recordingRef.current is only set after createAsync resolves, so it does
        // not protect calls that arrive during the async permission dialog. The
        // isStartingRef flag is set synchronously before the first await, closing
        // that window. Both guards are needed.
        if (recordingRef.current || isStartingRef.current) return false;
        isStartingRef.current = true;
        try {
            const { granted, canAskAgain } = await Audio.requestPermissionsAsync();
            if (!granted) {
                if (canAskAgain === false) {
                    Alert.alert(
                        "Microphone access blocked",
                        "Imotara needs microphone access to use voice input. Please enable it in your device Settings.",
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Open Settings", onPress: openAppSettings },
                        ],
                    );
                } else {
                    Alert.alert(
                        "Microphone access needed",
                        "Please allow microphone access to use voice input.",
                    );
                }
                return false;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                // Android: take exclusive audio focus so other audio (e.g. TTS) stops
                // during recording instead of being ducked and bleeding into the mic.
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                shouldDuckAndroid: false,
            });

            // Android LOW_QUALITY uses THREE_GPP/3gp which Whisper v1 does not accept.
            // Override Android low-quality to use MPEG_4/AAC at a lower bitrate so
            // the output is always .m4a regardless of platform.
            const preset = quality === "low" && Platform.OS !== "android"
                ? Audio.RecordingOptionsPresets.LOW_QUALITY
                : quality === "low"
                ? {
                    ...Audio.RecordingOptionsPresets.LOW_QUALITY,
                    android: {
                        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
                        bitRate: 32000,
                    },
                }
                : Audio.RecordingOptionsPresets.HIGH_QUALITY;
            // isMeteringEnabled: only actually consumed when autoStopOnSilence is
            // on (below), but harmless to always request — expo-av just adds a
            // metering field to status updates the app already isn't using
            // otherwise.
            const { recording } = await Audio.Recording.createAsync({ ...preset, isMeteringEnabled: true });
            recordingRef.current = recording;
            startTsRef.current = Date.now();
            setDurationMs(0);
            setState("recording");

            heardSpeechThisTurnRef.current = autoStopOnSilenceRef.current ? false : null;
            meteringSamplesRef.current = [];
            if (autoStopOnSilenceRef.current) {
                hasSpokenRef.current = false;
                firstSpeechAtRef.current = 0;
                silenceStartRef.current = null;
                recording.setProgressUpdateInterval(200);
                recording.setOnRecordingStatusUpdate((status) => {
                    if (!status.isRecording || typeof status.metering !== "number") return;
                    const now = Date.now();
                    // Anything at all above the noise floor means the mic is
                    // working and someone may be talking — enough to keep the
                    // turn alive and to make the audio worth transcribing,
                    // even when it never gets loud enough to arm silence-stop.
                    if (status.metering > AUDIBLE_DB_FLOOR) heardSpeechThisTurnRef.current = true;
                    if (meteringSamplesRef.current.length < MAX_METERING_SAMPLES) {
                        meteringSamplesRef.current.push(status.metering);
                    }
                    const isLoud = status.metering > SILENCE_DB_THRESHOLD;
                    if (isLoud) {
                        if (!hasSpokenRef.current) {
                            hasSpokenRef.current = true;
                            firstSpeechAtRef.current = now;
                        }
                        silenceStartRef.current = null;
                        return;
                    }
                    if (!hasSpokenRef.current) return; // still waiting for the user to start
                    if (silenceStartRef.current === null) silenceStartRef.current = now;
                    const sinceFirstSpeech = now - firstSpeechAtRef.current;
                    const sinceSilenceStart = now - silenceStartRef.current;
                    if (sinceFirstSpeech >= MIN_SPEECH_MS_BEFORE_AUTOSTOP && sinceSilenceStart >= SILENCE_STOP_MS) {
                        void stopRecordingRef.current();
                    }
                });
            }

            timerRef.current = setInterval(() => {
                const elapsed = Date.now() - startTsRef.current;
                setDurationMs(elapsed);
                // Hands-free gives up early when it has heard nothing at all;
                // everyone else keeps the full manual cap.
                // One deadline per physical situation, hands-free only. Once
                // speech has actually been heard the turn belongs to
                // silence-stop and keeps the full manual cap, so that a pause
                // mid-sentence never cuts anybody off.
                let deadline = maxDurationMs;
                if (autoStopOnSilenceRef.current && !hasSpokenRef.current) {
                    // ⚠️ THE SAME CONFLATION LIVED HERE TOO, and the first U8
                    // fix missed it: a device that never meters was given the
                    // SHORT "nothing reached the mic" deadline and cut off
                    // mid-sentence after 10s. It belongs in the "we cannot
                    // tell" bucket, which is the longer one.
                    //
                    // ⛔ On a device that DOES meter nothing changes at all:
                    // the sample buffer is non-empty, so the verdict is
                    // "nothing-to-send" exactly as before.
                    deadline = classifyTurnAudio(
                        heardSpeechThisTurnRef.current,
                        meteringSamplesRef.current.length,
                    ) === "nothing-to-send"
                        ? NO_SPEECH_GIVE_UP_MS          // metered, and nothing reached the mic
                        : NO_CLEAR_SPEECH_GIVE_UP_MS;   // noise, someone very quiet, or no metering
                }
                if (elapsed >= deadline || elapsed >= maxDurationMs) {
                    void stopRecordingRef.current();
                }
            }, 500);

            return true;
        } catch (err) {
            console.warn("[useVoiceInput] startRecording error:", err);

            // Undo anything that DID succeed before the throw. The sequence
            // and its load-bearing ordering live in recoverFromFailedStart,
            // where they are tested; this supplies the real collaborators.
            const outcome = await recoverFromFailedStart({
                clearTimer,
                takeRecording: () => {
                    const partial = recordingRef.current;
                    recordingRef.current = null;
                    if (!partial) return null;
                    return {
                        stopAndUnload: () => partial.stopAndUnloadAsync(),
                        getUri: () => partial.getURI(),
                    };
                },
                toIdle: () => {
                    setState("idle");
                    setDurationMs(0);
                },
                restoreAudioMode: () => {
                    Audio.setAudioModeAsync({
                        allowsRecordingIOS: false,
                        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                        shouldDuckAndroid: true,
                    }).catch(() => {});
                },
                deleteFile: (uri) => {
                    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                },
                isPermissionGranted: async () => {
                    const { granted } = await Audio.getPermissionsAsync()
                        .catch(() => ({ granted: false, canAskAgain: false }));
                    return granted;
                },
            });

            if (outcome === "permission-blocked") {
                Alert.alert(
                    "Microphone access blocked",
                    "Imotara needs microphone access to use voice input. Please enable it in Settings.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: openAppSettings },
                    ],
                );
            } else {
                // State was reset to idle above, so the button stays tappable.
                Alert.alert("Voice input error", "Could not start recording. Please try again.");
            }
            return false;
        } finally {
            isStartingRef.current = false;
        }
    }, [maxDurationMs, quality]); // stopRecording accessed via stopRecordingRef — no dep needed

    const cancelRecording = useCallback(async (): Promise<void> => {
        turnRef.current += 1; // whatever this turn produces is no longer wanted
        clearTimer();
        const recording = recordingRef.current;
        recordingRef.current = null;
        if (recording) {
            try {
                // Mirror M-1: nested try/finally guarantees audio mode restore AND
                // file cleanup even if stopAndUnloadAsync throws — getURI() is safe
                // after an unload error (returns the cached URI string, no native call).
                try {
                    await recording.stopAndUnloadAsync();
                } finally {
                    await Audio.setAudioModeAsync({
                        allowsRecordingIOS: false,
                        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                        shouldDuckAndroid: true,
                    }).catch(() => {});
                    const uri = recording.getURI();
                    if (uri) {
                        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                    }
                }
            } catch { /* ignore */ }
        }
        setState("idle");
        setDurationMs(0);
    }, []);

    // Cleanup on unmount — release audio session if recording was in progress
    useEffect(() => {
        return () => {
            // An upload can still be in flight here. Without this, it resolves
            // against an unmounted screen and calls onTranscript anyway.
            turnRef.current += 1;
            clearTimer();
            const recording = recordingRef.current;
            if (recording) {
                recordingRef.current = null;
                recording.stopAndUnloadAsync().catch(() => {});
                Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                    shouldDuckAndroid: true,
                }).catch(() => {});
                // Delete the orphaned file — every other exit path (stopRecording,
                // cancelRecording) does this; the unmount path must too.
                const uri = recording.getURI();
                if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const abandonTurn = useCallback(() => { turnRef.current += 1; }, []);

    const hasPermission = useCallback(async () => {
        try {
            const { granted } = await Audio.getPermissionsAsync();
            return !!granted;
        } catch {
            return false;
        }
    }, []);

    return { state, startRecording, stopRecording, cancelRecording, durationMs, hasPermission, abandonTurn };
}
