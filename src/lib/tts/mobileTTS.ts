// src/lib/tts/mobileTTS.ts
// Mobile TTS helper — gender-aware speech options via expo-speech
import * as Speech from "expo-speech";

// Map app language codes to BCP-47
const LANG_TO_BCP47: Record<string, string> = {
    en: "en-US",
    bn: "bn-IN",
    gu: "gu-IN",
    hi: "hi-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    mr: "mr-IN",
    or: "or-IN",
    pa: "pa-IN",
    ta: "ta-IN",
    te: "te-IN",
    ur: "ur-PK",
    ar: "ar-SA",
    zh: "zh-CN",
    fr: "fr-FR",
    de: "de-DE",
    he: "he-IL",
    id: "id-ID",
    ja: "ja-JP",
    pt: "pt-BR",
    ru: "ru-RU",
    es: "es-ES",
};

export function toBCP47(lang: string): string {
    return LANG_TO_BCP47[lang] ?? "en-US";
}

// Map gender preference to pitch approximation
// iOS/Android don't expose easy named voice selection via expo-speech,
// so we use pitch to approximate gendered voice quality.
function pitchForGender(gender: string | undefined): number {
    if (gender === "female") return 1.25;
    if (gender === "male") return 0.75;
    return 1.0; // nonbinary / other / undefined
}

let _speakingId: string | null = null;

/**
 * Speak a message aloud. If the same message is already speaking, stops it.
 * If a different message is speaking, stops that first then starts the new one.
 *
 * @param messageId  Unique id for the message (used to track stop/start)
 * @param text       Text to speak
 * @param gender     Companion gender preference ("female" | "male" | "nonbinary" | "other" | undefined)
 * @param lang       App language code (e.g. "en", "hi") — defaults to "en"
 * @param onDone     Called when speech ends or is stopped
 */
export async function speakMessage(
    messageId: string,
    text: string,
    gender: string | undefined,
    lang: string = "en",
    onDone?: () => void,
): Promise<void> {
    const isSpeaking = await Speech.isSpeakingAsync();

    if (isSpeaking) {
        Speech.stop();
        const wasThisMessage = _speakingId === messageId;
        _speakingId = null;
        if (wasThisMessage) {
            onDone?.();
            return; // toggle off
        }
    }

    _speakingId = messageId;
    Speech.speak(text, {
        language: toBCP47(lang),
        pitch: pitchForGender(gender),
        rate: 0.95,
        onDone: () => {
            _speakingId = null;
            onDone?.();
        },
        onError: () => {
            _speakingId = null;
            onDone?.();
        },
    });
}

export function stopSpeaking(): void {
    Speech.stop();
    _speakingId = null;
}

export function currentSpeakingId(): string | null {
    return _speakingId;
}
