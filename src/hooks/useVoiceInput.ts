// src/hooks/useVoiceInput.ts
// Records audio via expo-av and returns the URI for STT transcription.
// Transcription uses the Web Speech API shim via fetch to the cloud,
// or falls back to a placeholder so local mode still works gracefully.

import { useState, useRef, useCallback } from "react";
import { Alert, Platform } from "react-native";
import { Audio } from "expo-av";

export type VoiceInputState = "idle" | "recording" | "transcribing" | "error";

export type UseVoiceInputResult = {
    state: VoiceInputState;
    /** Start recording. Returns false if permission was denied. */
    startRecording: () => Promise<boolean>;
    /** Stop recording and transcribe. Calls onTranscript with the result. */
    stopRecording: () => Promise<void>;
    /** Cancel without transcribing. */
    cancelRecording: () => Promise<void>;
    durationMs: number;
};

const MAX_DURATION_MS = 60_000; // 1 minute cap

export function useVoiceInput(
    onTranscript: (text: string) => void,
    apiBaseUrl?: string,
): UseVoiceInputResult {
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

    const startRecording = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === "web") {
            Alert.alert("Voice input", "Voice input is not supported in the web browser.");
            return false;
        }
        try {
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                Alert.alert(
                    "Microphone access needed",
                    "Please allow microphone access in Settings to use voice input.",
                );
                return false;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
            );
            recordingRef.current = recording;
            startTsRef.current = Date.now();
            setDurationMs(0);
            setState("recording");

            // Tick duration counter
            timerRef.current = setInterval(() => {
                const elapsed = Date.now() - startTsRef.current;
                setDurationMs(elapsed);
                if (elapsed >= MAX_DURATION_MS) {
                    void stopRecording();
                }
            }, 500);

            return true;
        } catch {
            setState("error");
            Alert.alert("Voice input error", "Could not start recording. Please try again.");
            return false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

            // Attempt cloud transcription if API base is configured
            let transcript = "";
            if (apiBaseUrl) {
                try {
                    const form = new FormData();
                    form.append("file", {
                        uri,
                        name: "voice.m4a",
                        type: "audio/m4a",
                    } as any);
                    const res = await fetch(`${apiBaseUrl}/api/voice/transcribe`, {
                        method: "POST",
                        body: form,
                    });
                    const json = await res.json().catch(() => null);
                    transcript = json?.text ?? "";
                } catch {
                    // transcription unavailable — fall through to prompt
                }
            }

            if (transcript.trim()) {
                onTranscript(transcript.trim());
            } else {
                // Graceful fallback: let user know transcription isn't available
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

    return { state, startRecording, stopRecording, cancelRecording, durationMs };
}
