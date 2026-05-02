// src/lib/tts/mobileTTS.ts
// Mobile TTS — native-first, Azure Neural fallback for missing languages.
//
// Strategy:
//   1. Check Speech.getAvailableVoicesAsync() for the selected language.
//   2. If a native voice exists → use expo-speech (free, offline-capable).
//   3. If not → fetch the pre-generated Azure MP3 from Imotara's CDN and play via expo-av.
//
// English is always available natively on iOS and Android — Azure is never called for English.

import * as Speech from "expo-speech";
import { Audio }   from "expo-av";

// ── BCP-47 map ────────────────────────────────────────────────────────────────

const LANG_TO_BCP47: Record<string, string> = {
    en: "en-US", hi: "hi-IN", mr: "mr-IN", bn: "bn-IN",
    ta: "ta-IN", te: "te-IN", gu: "gu-IN", pa: "pa-IN",
    kn: "kn-IN", ml: "ml-IN", or: "or-IN", ur: "ur-PK",
    ar: "ar-SA", zh: "zh-CN", fr: "fr-FR", de: "de-DE",
    he: "he-IL", id: "id-ID", ja: "ja-JP", pt: "pt-BR",
    ru: "ru-RU", es: "es-ES",
};

export function toBCP47(lang: string): string {
    return LANG_TO_BCP47[lang] ?? "en-US";
}

// ── Preview text ──────────────────────────────────────────────────────────────

const PREVIEW_TEXT_BY_LANG: Record<string, string> = {
    en: "Hi, I'm Imotara. I'm here with you.",
    hi: "नमस्ते, मैं इमोतारा हूँ. मैं आपके साथ हूँ।",
    mr: "नमस्कार, मी इमोतारा आहे. मी तुमच्यासोबत आहे।",
    bn: "হ্যালো, আমি ইমোতারা. আমি তোমার সাথে আছি।",
    ta: "வணக்கம், நான் இமோதாரா. நான் உங்களுடன் இருக்கிறேன்.",
    te: "నమస్కారం, నేను ఇమోతారా. నేను మీతో ఉన్నాను.",
    gu: "નમસ્તે, હું ઇમોતારા છું. હું તમારી સાથે છું.",
    pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਇਮੋਤਾਰਾ ਹਾਂ. ਮੈਂ ਤੁਹਾਡੇ ਨਾਲ ਹਾਂ।",
    kn: "ನಮಸ್ಕಾರ, ನಾನು ಇಮೋತಾರ. ನಾನು ನಿಮ್ಮೊಂದಿಗೆ ಇದ್ದೇನೆ.",
    ml: "ഹലോ, ഞാൻ ഇമോതാര. ഞാൻ നിങ്ങളോടൊപ്പം ഉണ്ട്.",
    or: "ନମସ୍କାର, ମୁଁ ଇମୋତାରା. ମୁଁ ଆପଣଙ୍କ ସହ ଅଛି।",
    ur: "ہیلو، میں امتارا ہوں. میں آپ کے ساتھ ہوں۔",
    zh: "你好，我是 Imotara。我在你身边。",
    es: "Hola, soy Imotara. Estoy aqui contigo.",
    ar: "مرحباً، أنا إيموتارا. أنا هنا معك.",
    fr: "Bonjour, je suis Imotara. Je suis la pour vous.",
    pt: "Ola, sou o Imotara. Estou aqui com voce.",
    ru: "Привет, я Имотара. Я здесь рядом с тобой.",
    id: "Halo, saya Imotara. Saya di sini bersamamu.",
    he: "שלום, אני אימוטרה. אני כאן איתך.",
    de: "Hallo, ich bin Imotara. Ich bin fuer dich da.",
    ja: "こんにちは、私はイモタラです。ここにいますよ。",
};

// ── State ─────────────────────────────────────────────────────────────────────

let _speakingId:  string | null      = null;
let _soundObject: Audio.Sound | null = null;

// ── Native voice availability ─────────────────────────────────────────────────

let _voiceCache: Speech.Voice[] | null = null;

async function getNativeVoices(): Promise<Speech.Voice[]> {
    if (_voiceCache) return _voiceCache;
    try {
        _voiceCache = await Speech.getAvailableVoicesAsync();
    } catch {
        _voiceCache = [];
    }
    return _voiceCache;
}

async function hasNativeVoice(lang: string): Promise<boolean> {
    const bcp47    = toBCP47(lang);
    const langBase = bcp47.split("-")[0];
    const voices   = await getNativeVoices();
    return voices.some(
        v => v.language === bcp47
          || v.language.startsWith(langBase + "-")
          || v.language === langBase,
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiBase(): string {
    const url = process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL ?? "https://imotaraapp.vercel.app";
    return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function stopAll(): Promise<void> {
    Speech.stop();
    if (_soundObject) {
        await _soundObject.unloadAsync().catch(() => {});
        _soundObject = null;
    }
    _speakingId = null;
}

async function playSound(uri: string, onDone?: () => void): Promise<void> {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, rate: 0.95, volume: 1.0 },
    );
    _soundObject = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
            sound.unloadAsync().catch(() => {});
            _soundObject = null;
            _speakingId  = null;
            onDone?.();
        }
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Speak a chat message aloud.
 * Uses native TTS when available, calls /api/tts for languages not on the device.
 * Toggling the same messageId stops playback.
 */
export async function speakMessage(
    messageId: string,
    text: string,
    gender: string | undefined,
    lang: string = "en",
    onDone?: () => void,
): Promise<void> {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking || _soundObject) {
        const wasThis = _speakingId === messageId;
        await stopAll();
        if (wasThis) { onDone?.(); return; }
    }

    _speakingId = messageId;

    if (await hasNativeVoice(lang)) {
        Speech.speak(text, {
            language: toBCP47(lang),
            pitch:    1.0,
            rate:     0.95,
            onDone:  () => { _speakingId = null; onDone?.(); },
            onError: () => { _speakingId = null; onDone?.(); },
        });
        return;
    }

    // Language not on device — call Azure via /api/tts
    try {
        const res = await fetch(`${apiBase()}/api/tts`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ text, lang, gender: gender ?? "neutral" }),
        });
        if (!res.ok) throw new Error(`TTS API ${res.status}`);
        // expo-av requires a URI, not a blob — write to a temp cache path
        const arrayBuf = await res.arrayBuffer();
        const base64   = Buffer.from(arrayBuf).toString("base64");
        await playSound(`data:audio/mpeg;base64,${base64}`, onDone);
    } catch (err) {
        console.warn("[mobileTTS] chat TTS failed:", err);
        _speakingId = null;
        onDone?.();
    }
}

/**
 * Voice preview in settings.
 * Uses static pre-generated Azure MP3s for languages not on the device.
 */
export async function speakPreview(
    gender: string | undefined,
    lang: string = "en",
    onDone?: () => void,
): Promise<void> {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking || _soundObject) {
        await stopAll();
        onDone?.();
        return;
    }

    _speakingId = "preview";

    if (await hasNativeVoice(lang)) {
        const text = PREVIEW_TEXT_BY_LANG[lang] ?? PREVIEW_TEXT_BY_LANG["en"];
        Speech.speak(text, {
            language: toBCP47(lang),
            pitch:    1.0,
            rate:     0.95,
            onDone:  () => { _speakingId = null; onDone?.(); },
            onError: () => { _speakingId = null; onDone?.(); },
        });
        return;
    }

    // Use pre-generated static Azure MP3 (served via Vercel CDN — fast globally)
    const genderFile = gender === "male" ? "male" : "female";
    const uri = `${apiBase()}/tts-preview/${lang}-${genderFile}.mp3`;
    try {
        await playSound(uri, onDone);
    } catch (err) {
        console.warn("[mobileTTS] preview playback failed:", err);
        _speakingId = null;
        onDone?.();
    }
}

export function stopSpeaking(): void {
    Speech.stop();
    _soundObject?.unloadAsync().catch(() => {});
    _soundObject = null;
    _speakingId  = null;
}

export function currentSpeakingId(): string | null {
    return _speakingId;
}
