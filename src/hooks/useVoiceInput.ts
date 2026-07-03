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
    stopRecording: () => Promise<void>;
    cancelRecording: () => Promise<void>;
    durationMs: number;
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
};

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
    const langRef = useRef(opts?.lang ?? "en");
    const optsLang = opts?.lang;
    useEffect(() => { langRef.current = optsLang ?? "en"; }, [optsLang]);
    const [state, setState] = useState<VoiceInputState>("idle");
    const [durationMs, setDurationMs] = useState(0);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTsRef = useRef<number>(0);
    // BUG-12B: synchronous in-flight flag for startRecording. recordingRef is only
    // set after createAsync resolves, so the BUG-11A guard (recordingRef.current)
    // does not protect against a second call arriving during the permission dialog
    // (which can be open for several seconds). isStartingRef is set synchronously
    // before the first await, closing that window.
    const isStartingRef = useRef(false);

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Ref so the setInterval auto-stop callback always calls the latest
    // stopRecording even if cloudTranscription changes mid-session.
    const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

    const stopRecording = useCallback(async (): Promise<void> => {
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
            const transcriptionAttempted = !!(apiBaseUrl && cloudTranscription);

            if (transcriptionAttempted) {
                try {
                    // All presets produce MPEG_4/AAC/.m4a on both platforms.
                    // (Android LOW_QUALITY is overridden at record time to avoid
                    // THREE_GPP/3gp which Whisper v1 does not accept.)
                    transcript = await transcribeAudio(uri, apiBaseUrl!, langRef.current, "audio/m4a");
                } catch (err: any) {
                    console.warn("[useVoiceInput] Transcription failed:", err);
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

            if (transcript.trim()) {
                onTranscript(transcript.trim());
            } else if (transcriptionAttempted) {
                // M-4: only show this alert when transcription was actually attempted.
                // When cloudTranscription=false the recording is intentionally discarded
                // without any complaint — the user knows cloud STT is off.
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
            const { recording } = await Audio.Recording.createAsync(preset);
            recordingRef.current = recording;
            startTsRef.current = Date.now();
            setDurationMs(0);
            setState("recording");

            timerRef.current = setInterval(() => {
                const elapsed = Date.now() - startTsRef.current;
                setDurationMs(elapsed);
                if (elapsed >= maxDurationMs) {
                    void stopRecordingRef.current();
                }
            }, 500);

            return true;
        } catch (err) {
            console.warn("[useVoiceInput] startRecording error:", err);
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
                // Keep state as "idle" so the button remains tappable after the error.
                Alert.alert("Voice input error", "Could not start recording. Please try again.");
            }
            return false;
        } finally {
            isStartingRef.current = false;
        }
    }, [maxDurationMs, quality]); // stopRecording accessed via stopRecordingRef — no dep needed

    const cancelRecording = useCallback(async (): Promise<void> => {
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

    return { state, startRecording, stopRecording, cancelRecording, durationMs };
}
