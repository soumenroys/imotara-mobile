// src/hooks/useVoiceInput.ts
// Records audio via expo-av and returns the URI for STT transcription.
// Uses expo-file-system for file upload — required for reliable FormData
// serialisation in production Hermes builds (RN 0.76 new architecture).

import { useState, useRef, useCallback, useEffect } from "react";
import { Alert, Linking, Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

export type VoiceInputState = "idle" | "recording" | "transcribing" | "error";

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
): Promise<string> {
    const endpoint = `${apiBaseUrl}/api/voice/transcribe`;

    // FileSystem.uploadAsync is the reliable path for production Hermes builds.
    // It directly reads the file on the native side, bypassing the JS-side
    // FormData serialisation that breaks in release/Hermes mode.
    const uploadResult = await FileSystem.uploadAsync(endpoint, uri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType: "audio/m4a",
        parameters: { lang },
    });

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
    useEffect(() => { langRef.current = opts?.lang ?? "en"; }, [opts?.lang]);
    const [state, setState] = useState<VoiceInputState>("idle");
    const [durationMs, setDurationMs] = useState(0);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTsRef = useRef<number>(0);

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const stopRecording = useCallback(async (): Promise<void> => {
        clearTimer();
        const recording = recordingRef.current;
        if (!recording) { setState("idle"); return; }

        setState("transcribing");
        let uri: string | null = null;
        try {
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            uri = recording.getURI() ?? null;
            recordingRef.current = null;

            if (!uri) throw new Error("No recording URI");

            let transcript = "";

            if (apiBaseUrl && cloudTranscription) {
                try {
                    transcript = await transcribeAudio(uri, apiBaseUrl, langRef.current);
                } catch (err) {
                    // Transcription failed — log but don't crash
                    console.warn("[useVoiceInput] Transcription failed:", err);
                }
            }

            if (transcript.trim()) {
                onTranscript(transcript.trim());
            } else {
                // Transcription returned nothing — could be silence, very short
                // recording, or a temporary API issue.
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
            // Clean up temp file to avoid filling device storage
            if (uri) {
                FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            }
            setState("idle");
            setDurationMs(0);
        }
    }, [apiBaseUrl, cloudTranscription, onTranscript]);

    const startRecording = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === "web") {
            Alert.alert("Voice input", "Voice input is not supported in the web browser.");
            return false;
        }
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
            });

            const preset = quality === "low"
                ? Audio.RecordingOptionsPresets.LOW_QUALITY
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
                    void stopRecording();
                }
            }, 500);

            return true;
        } catch (err) {
            console.warn("[useVoiceInput] startRecording error:", err);
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
                setState("error");
                Alert.alert("Voice input error", "Could not start recording. Please try again.");
            }
            return false;
        }
    }, [maxDurationMs, quality, stopRecording]);

    const cancelRecording = useCallback(async (): Promise<void> => {
        clearTimer();
        const recording = recordingRef.current;
        recordingRef.current = null;
        if (recording) {
            try {
                await recording.stopAndUnloadAsync();
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
                const uri = recording.getURI();
                if (uri) {
                    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
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
                Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { state, startRecording, stopRecording, cancelRecording, durationMs };
}
