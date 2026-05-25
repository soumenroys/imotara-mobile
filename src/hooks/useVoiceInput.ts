// src/hooks/useVoiceInput.ts
// Records audio via expo-av and returns the URI for STT transcription.

import { useState, useRef, useCallback, useEffect } from "react";
import { Alert, Linking, Platform } from "react-native";
import { Audio } from "expo-av";

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
        try {
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            const uri = recording.getURI();
            recordingRef.current = null;

            if (!uri) throw new Error("No recording URI");

            let transcript = "";
            if (apiBaseUrl && cloudTranscription) {
                try {
                    const form = new FormData();
                    form.append("file", {
                        uri,
                        name: "voice.m4a",
                        type: "audio/m4a",
                    } as any);
                    form.append("lang", langRef.current);
                    const res = await fetch(`${apiBaseUrl}/api/voice/transcribe`, {
                        method: "POST",
                        body: form,
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const json = await res.json().catch(() => null);
                    transcript = json?.text ?? "";
                } catch {
                    // transcription unavailable — fall through
                }
            }

            if (transcript.trim()) {
                onTranscript(transcript.trim());
            } else {
                Alert.alert(
                    "Voice recorded",
                    "Cloud transcription is not set up yet. Your recording was captured but cannot be converted to text automatically right now.",
                    [{ text: "OK" }],
                );
            }
        } catch {
            Alert.alert("Voice input error", "Could not process the recording. Please try again.");
        } finally {
            setState("idle");
            setDurationMs(0);
        }
    }, [apiBaseUrl, onTranscript]);

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
        } catch {
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
    }, [stopRecording]);

    const cancelRecording = useCallback(async (): Promise<void> => {
        clearTimer();
        const recording = recordingRef.current;
        recordingRef.current = null;
        if (recording) {
            try {
                await recording.stopAndUnloadAsync();
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
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
