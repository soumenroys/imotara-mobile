// src/lib/tts/mobileTTS.ts
// Mobile TTS — native-first, Azure Neural fallback for missing languages.
//
// Strategy:
//   1. Check Speech.getAvailableVoicesAsync() for the selected language.
//   2. If a native voice exists → use expo-speech (free, offline-capable).
//   3. If not → fetch the pre-generated Azure MP3 from Imotara's CDN and play via expo-av.
//
// English is always available natively on iOS and Android — Azure is never called for English.

import * as Speech     from "expo-speech";
import { Audio }       from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { fetchWithTimeout } from "../fetchWithTimeout";

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

// ── Gender / novelty voice matching (native TTS fallback only) ────────────────
// Mirrors imotaraapp/src/app/settings/page.tsx's speakPreview() patterns so the
// Male/Female preview setting isn't silently ignored when native TTS is used,
// and no OEM "novelty" voice is picked ahead of a normal-sounding one.

const FEMALE_PAT = /\b(female|woman|girl|samantha|victoria|karen|moira|tessa|fiona|zira|aria|jenny|emily|nancy|lisa|kate|susan|natasha|anna|ava|allison|noelle|zoe|olivia|heather|monica|serena|vicki|hazel|lekha|veena|damayanti|kanya)\b/i;
const MALE_PAT   = /\b(male|man|alex|tom|daniel|liam|david|james|mark|richard|aaron|evan|bruce|gordon|lee|rishi|aarav|hemant|kabir)\b/i;
// Voice names must never appear in both MALE_PAT/FEMALE_PAT and this list —
// the novelty filter has to win, always (see web's fix for why).
const NOVELTY_VOICE_PAT = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|eddy|flo|fred|good news|grandma|grandpa|hysterical|jester|junior|kathy|organ|pipe organ|princess|ralph|reed|rocko|sandy|shelley|superstar|trinoids|whisper|wobble|zarvox)\b/i;

// ── State ─────────────────────────────────────────────────────────────────────

let _speakingId:  string | null          = null;
let _soundObject: Audio.Sound | null     = null;
let _fetchAbort:  AbortController | null = null; // cancels in-flight TTS API fetch

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

/**
 * Picks a native voice identifier matching the requested gender for the given
 * language, excluding novelty voices from the fallback pool. `confident` is
 * true only when a voice is explicitly tagged with the requested gender —
 * callers should apply a pitch correction when it's false, because the
 * fallback voice (whatever the engine lists first) may not actually match
 * the requested gender by ear even though nothing marks it as the opposite.
 */
async function pickNativeVoice(gender: string | undefined, lang: string): Promise<{ id?: string; confident: boolean }> {
    const voices = await getNativeVoices();
    if (voices.length === 0) return { id: undefined, confident: false };

    const bcp47    = toBCP47(lang);
    const langBase = bcp47.split("-")[0];
    const nm       = (v: Speech.Voice) => v.name.toLowerCase();
    // Some Android TTS engines (e.g. Samsung's) encode gender directly in the
    // voice identifier instead of a human name — "en-IN-SMTf00" (female),
    // no "SMTm" counterpart may even be installed. MALE_PAT/FEMALE_PAT alone
    // never match these, silently making gender-matching a no-op and always
    // falling back to pool[0] (whatever that engine happens to list first).
    const isMaleV  = (v: Speech.Voice) => MALE_PAT.test(nm(v)) || /smt_?m\d*$/i.test(v.identifier ?? "");
    const isFemV   = (v: Speech.Voice) => FEMALE_PAT.test(nm(v)) || /smt_?f\d*$/i.test(v.identifier ?? "");
    const isNovelty = (v: Speech.Voice) => NOVELTY_VOICE_PAT.test(nm(v));

    const langPool = voices.filter(
        v => v.language === bcp47 || v.language.startsWith(langBase + "-") || v.language === langBase,
    );
    const langSrc    = langPool.length > 0 ? langPool : voices;
    const nonNovelty = langSrc.filter(v => !isNovelty(v));
    const pool       = nonNovelty.length > 0 ? nonNovelty : langSrc;

    if (gender === "male") {
        const matched = pool.find(isMaleV);
        if (matched) return { id: matched.identifier, confident: true };
        return { id: (pool.find(v => !isFemV(v)) ?? pool[0])?.identifier, confident: false };
    }
    const matched = pool.find(isFemV);
    if (matched) return { id: matched.identifier, confident: true };
    return { id: (pool.find(v => !isMaleV(v)) ?? pool[0])?.identifier, confident: false };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip markdown formatting so Azure TTS reads clean prose, not asterisks and dashes. */
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/gs, "$1")   // **bold**
        .replace(/\*(.+?)\*/gs,     "$1")   // *italic*
        .replace(/^#{1,6}\s+/gm,    "")     // # headings
        .replace(/^[-*+]\s+/gm,     "")     // - list items
        .replace(/`(.+?)`/gs,       "$1")   // `code`
        .replace(/\[(.+?)\]\(.+?\)/g, "$1") // [link](url)
        .replace(/\n{3,}/g,         "\n\n") // collapse excess blank lines
        .trim();
}

function apiBase(): string {
    const url = process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL ?? "https://imotaraapp.vercel.app";
    return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function stopAll(): Promise<void> {
    _fetchAbort?.abort();
    _fetchAbort = null;
    Speech.stop();
    if (_soundObject) {
        await _soundObject.unloadAsync().catch(() => {});
        _soundObject = null;
    }
    _speakingId = null;
}

/**
 * Synthesizes arbitrary text via the same dynamic Azure Neural TTS endpoint
 * `speakMessage()` uses for chat, instead of a fixed pre-generated MP3. Used
 * by the preview when native TTS can't confidently produce the requested
 * gender AND a custom name needs to be spoken — Azure's neural voices are
 * reliably gendered where some OEM native TTS voices are not (see
 * pickNativeVoice's `confident` flag), so this gets both a correct gender
 * and the actual custom name, unlike the static "Imotara"-only preview MP3.
 */
async function synthesizeViaAzure(text: string, lang: string, gender: string | undefined, onDone?: () => void, rate = 0.95, accessToken?: string): Promise<void> {
    _fetchAbort?.abort();
    const abort = new AbortController();
    _fetchAbort = abort;
    const timer = setTimeout(() => abort.abort(), 20_000);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    let res: Response;
    try {
        res = await fetch(
            `${apiBase()}/api/tts`,
            { method: "POST", headers, body: JSON.stringify({ text: stripMarkdown(text), lang, gender: gender ?? "neutral" }), signal: abort.signal },
        );
    } finally {
        clearTimeout(timer);
    }

    if (_fetchAbort !== abort) throw new Error("aborted");
    _fetchAbort = null;

    if (!res.ok) throw new Error(`TTS API ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    const base64   = Buffer.from(arrayBuf).toString("base64");
    const tmpPath  = (FileSystem.cacheDirectory ?? "") + "imotara_tts_preview.mp3";
    await FileSystem.writeAsStringAsync(tmpPath, base64, { encoding: FileSystem.EncodingType.Base64 });
    await playSound(tmpPath, onDone, rate);
}

async function playSound(uri: string, onDone?: () => void, rate = 0.95): Promise<void> {
    await Audio.setAudioModeAsync({
        allowsRecordingIOS:         false,
        playsInSilentModeIOS:       true,
        playThroughEarpieceAndroid: false, // loudspeaker, not earpiece
        staysActiveInBackground:    true,  // keep session alive between plays
    });
    const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, rate: isFinite(rate) ? rate : 0.95, volume: 1.0 },
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
    rate = 0.95,
    pitch = 1.0,
    accessToken?: string,
): Promise<void> {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking || _soundObject) {
        const wasThis = _speakingId === messageId;
        await stopAll();
        if (wasThis) { onDone?.(); return; }
    }

    _speakingId = messageId;

    // Always use Azure Neural TTS — native Speech.speak() ignores gender,
    // so the companion voice setting would be silently overridden by the device default.
    try {
        // Create a combined abort controller: stops on user-cancel OR 20s timeout.
        _fetchAbort?.abort();
        const abort   = new AbortController();
        _fetchAbort   = abort;
        const timer   = setTimeout(() => abort.abort(), 20_000);

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

        let res: Response;
        try {
            res = await fetch(
                `${apiBase()}/api/tts`,
                { method: "POST", headers, body: JSON.stringify({ text: stripMarkdown(text), lang, gender: gender ?? "neutral" }), signal: abort.signal },
            );
        } finally {
            clearTimeout(timer);
        }

        // If stop was called while fetching, bail out now.
        if (_fetchAbort !== abort) return;
        _fetchAbort = null;

        if (!res.ok) throw new Error(`TTS API ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        const base64   = Buffer.from(arrayBuf).toString("base64");
        // Write to a real temp file — data URIs are unreliable on Android MediaPlayer
        const tmpPath  = (FileSystem.cacheDirectory ?? "") + "imotara_tts.mp3";
        await FileSystem.writeAsStringAsync(tmpPath, base64, {
            encoding: FileSystem.EncodingType.Base64,
        });
        await playSound(tmpPath, onDone, rate);
    } catch (err: unknown) {
        // User-initiated stop: abort throws DOMException "AbortError" — don't fall back.
        if (err instanceof Error && err.name === "AbortError") {
            _speakingId = null;
            return;
        }
        console.warn("[mobileTTS] Azure TTS failed, falling back to native:", err);
        // Ensure audio plays even in silent mode before using native TTS
        await Audio.setAudioModeAsync({
            allowsRecordingIOS:         false,
            playsInSilentModeIOS:       true,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground:    false,
        }).catch(() => {});
        Speech.speak(text, {
            language: toBCP47(lang),
            pitch:    isFinite(pitch) ? pitch : 1.0,
            rate:     isFinite(rate) ? rate : 0.95,
            onDone:  () => { _speakingId = null; onDone?.(); },
            onError: () => { _speakingId = null; onDone?.(); },
        });
    }
}

/**
 * Voice preview in settings.
 * Uses static pre-generated Azure MP3s for languages not on the device.
 */
export async function speakPreview(
    gender: string | undefined,
    lang: string = "en",
    name?: string,
    onDone?: () => void,
    accessToken?: string,
): Promise<void> {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking || _soundObject) {
        await stopAll();
        onDone?.();
        return;
    }

    _speakingId = "preview";

    const effectiveName = name?.trim() || "Imotara";
    const hasCustomName = effectiveName !== "Imotara";
    const wantsCustomSpeech = hasCustomName && lang === "en";

    // English + a custom name is the only case that needs to speak arbitrary
    // text instead of a fixed Azure recording. Check native voice confidence
    // up front: some Android TTS engines (e.g. Samsung's) ship no true male
    // voice at all for English — only female-tagged voices plus "default"
    // voices that are themselves female under the hood — so pitch-shifting
    // can't make them sound male (pitch changes fundamental frequency, not
    // vocal formants).
    const nativeMatch = wantsCustomSpeech ? await pickNativeVoice(gender, lang) : undefined;

    const text = wantsCustomSpeech
        ? `Hi, I'm ${effectiveName}. I'm here with you.`
        : (PREVIEW_TEXT_BY_LANG[lang] ?? PREVIEW_TEXT_BY_LANG["en"]);

    // Native TTS can't confidently produce the requested gender here — try
    // dynamic Azure Neural synthesis first, so the preview gets both the
    // correct gender AND the actual custom name (Azure's neural voices are
    // reliably gendered where native OEM TTS voices are not). This requires
    // sign-in (the endpoint is auth-gated for Azure cost/quota control) —
    // when it's unavailable (signed out, network error), fall back to the
    // static "Imotara"-only Azure MP3 rather than native TTS, because a
    // correct-gender preview that says the wrong name beats a correct-name
    // preview that fails the one thing this whole fix is about (gender).
    if (wantsCustomSpeech && nativeMatch?.confident === false) {
        try {
            await synthesizeViaAzure(text, lang, gender, onDone, 0.95, accessToken);
            return;
        } catch {
            // fall through to the static Azure MP3 below
        }
    }

    // Azure MP3s are fixed recordings that always say "Imotara" — they can't
    // speak a custom name. Used for non-English, when no custom name is set,
    // or when dynamic synthesis above wasn't available: for any non-English
    // language, playing the correct-language MP3 is still far better than
    // only ever speaking an English name-tail, and for English + custom name
    // it still guarantees the requested gender even without dynamic synthesis.
    if (!wantsCustomSpeech || nativeMatch?.confident === false) {
        const genderFile = gender === "male" ? "male" : "female";
        const uri = `${apiBase()}/tts-preview/${lang}-${genderFile}.mp3`;
        try {
            await playSound(uri, onDone);
            return;
        } catch {
            // fall through to native TTS
        }
    }

    // Ensure audio plays even in silent mode before using native TTS
    await Audio.setAudioModeAsync({
        allowsRecordingIOS:         false,
        playsInSilentModeIOS:       true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground:    false,
    }).catch(() => {});

    const { id: voiceId, confident } = nativeMatch ?? await pickNativeVoice(gender, lang);
    // When no voice is explicitly tagged for the requested gender, the
    // fallback voice (whatever the engine lists first) isn't guaranteed to
    // sound like the requested gender at all — some engines (e.g. Samsung's)
    // ship only a female voice per language with no neutral/male option, so
    // "not tagged female" is not proof of sounding male. Shift pitch so
    // Male vs Female are always audibly distinct even on such engines.
    const pitch = confident ? 1.0 : (gender === "male" ? 0.78 : 1.18);

    Speech.speak(text, {
        language: toBCP47(lang),
        voice:    voiceId,
        pitch,
        rate:     0.95,
        onDone:  () => { _speakingId = null; onDone?.(); },
        onError: () => { _speakingId = null; onDone?.(); },
    });
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
