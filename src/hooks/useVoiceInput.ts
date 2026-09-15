// src/hooks/useVoiceInput.ts
// Records audio via expo-av and returns the URI for STT transcription.
// Uses expo-file-system for file upload — required for reliable FormData
// serialisation in production Hermes builds (RN 0.76 new architecture).

import { useState, useRef, useCallback, useEffect } from "react";
import { Alert, Linking, Platform } from "react-native";
import { Audio, InterruptionModeAndroid } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

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
async function transcribeAudio(
    uri: string,
    apiBaseUrl: string,
    lang: string,
    mimeType: string,
    accessToken?: string,
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
        parameters: { lang },
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
            const heardNothing = heardSpeechThisTurnRef.current === false;
            const transcriptionAttempted = !!(apiBaseUrl && cloudTranscription);
            const myTurn = turnRef.current;

            // Skipping the upload does NOT skip reporting the empty turn below:
            // transcriptionAttempted stays true, so hands-free still learns the
            // turn produced nothing and can reopen. Only the pointless upload
            // goes — transcribing a minute of silence cost real money and could
            // only ever come back as a Whisper hallucination.
            if (transcriptionAttempted && !heardNothing) {
                try {
                    // All presets produce MPEG_4/AAC/.m4a on both platforms.
                    // (Android LOW_QUALITY is overridden at record time to avoid
                    // THREE_GPP/3gp which Whisper v1 does not accept.)
                    transcript = await transcribeAudio(uri, apiBaseUrl!, langRef.current, "audio/m4a", accessTokenRef.current);
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
                    deadline = heardSpeechThisTurnRef.current === false
                        ? NO_SPEECH_GIVE_UP_MS          // nothing reached the mic at all
                        : NO_CLEAR_SPEECH_GIVE_UP_MS;   // noise, or someone very quiet
                }
                if (elapsed >= deadline || elapsed >= maxDurationMs) {
                    void stopRecordingRef.current();
                }
            }, 500);

            return true;
        } catch (err) {
            console.warn("[useVoiceInput] startRecording error:", err);

            // Undo anything that DID succeed before the throw.
            //
            // Found on a real iPhone 2026-09-16: an alert reading "Could not
            // start recording" appeared while the composer showed "Recording…
            // 6s" in red and the iOS orange microphone dot was lit — the device
            // syslog confirmed the mic was genuinely live. The cause was here:
            // createAsync resolves, recordingRef is set, setState("recording")
            // runs and the timer starts — and then ANY of the calls after that
            // (setProgressUpdateInterval, setOnRecordingStatusUpdate,
            // setInterval) can throw and land in this catch, which used to undo
            // none of it. The old comment below claimed the state was "kept
            // idle", which was only ever true when the throw beat
            // setState("recording").
            //
            // Order matters: unload the recorder FIRST, then restore the audio
            // mode. Setting allowsRecordingIOS:false while a recording is still
            // running is itself suspected of producing the original Android
            // report — a red indicator over a microphone that captures nothing.
            clearTimer();
            const partial = recordingRef.current;
            recordingRef.current = null;
            if (partial) {
                try { await partial.stopAndUnloadAsync(); } catch { /* already gone */ }
            }
            setState("idle");
            setDurationMs(0);

            // M-2: setAudioModeAsync may have succeeded before createAsync threw,
            // leaving Android in DoNotMix mode. Restore it unconditionally.
            Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                shouldDuckAndroid: true,
            }).catch(() => {});
            const { granted } = await Audio.getPermissionsAsync().catch(() => ({ granted: false, canAskAgain: false }));
            if (!granted) {
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
