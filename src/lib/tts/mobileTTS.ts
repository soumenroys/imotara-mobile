// src/lib/tts/mobileTTS.ts
// Mobile TTS — native-first, Azure Neural fallback for missing languages.
//
// Strategy:
//   1. Check Speech.getAvailableVoicesAsync() for the selected language.
//   2. If a native voice exists → use expo-speech (free, offline-capable).
//   3. If not → fetch the pre-generated Azure MP3 from Imotara's CDN and play via expo-av.
//
// English is always available natively on iOS and Android — Azure is never called for English.

import * as Speech        from "expo-speech";
import { Audio }          from "expo-av";
import { File, Paths }    from "expo-file-system";
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

// ── Script detection ──────────────────────────────────────────────────────────
// The chat AI replies in whatever script the user typed in, independent of the
// static `preferredLang` app setting (which most users never touch after
// onboarding) — so a Bengali reply sent to Azure with lang="en" gets an
// English voice that can only pronounce the odd Latin-script word/name and
// goes silent on the rest. Detect the reply's actual script directly instead
// of trusting the stale preference; `fallbackLang` (preferredLang) only
// breaks ties within a shared script (Devanagari → hi vs mr, Arabic → ar vs ur)
// and covers pure-Latin-script languages (es/fr/de/pt/id) that look identical
// to English at the codepoint level.
const SCRIPT_RANGES: Array<{ lang: string; re: RegExp }> = [
    { lang: "bn", re: /[ঀ-৿]/g },
    { lang: "hi", re: /[ऀ-ॿ]/g }, // Devanagari — hi or mr
    { lang: "ta", re: /[஀-௿]/g },
    { lang: "te", re: /[ఀ-౿]/g },
    { lang: "gu", re: /[઀-૿]/g },
    { lang: "pa", re: /[਀-੿]/g },
    { lang: "kn", re: /[ಀ-೿]/g },
    { lang: "ml", re: /[ഀ-ൿ]/g },
    { lang: "or", re: /[଀-୿]/g },
    { lang: "ar", re: /[؀-ۿ]/g }, // Arabic script — ar or ur
    { lang: "ja", re: /[぀-ヿ]/g }, // Hiragana/Katakana — checked before CJK
    { lang: "zh", re: /[一-鿿]/g },
    { lang: "he", re: /[֐-׿]/g },
    { lang: "ru", re: /[Ѐ-ӿ]/g },
];

// Urdu shares the Arabic block but adds a handful of extension letters Arabic
// doesn't use. Marathi has no character exclusive to it at all (identical
// Devanagari alphabet to Hindi) — only common function words distinguish it,
// and matching must NOT use \b word boundaries: JS's default \w is ASCII-only,
// so \b never fires around Devanagari/Bengali/etc. text and silently fails to
// match anything, which is why an earlier version of this fix passed all
// tests except Marathi until switching to plain substring matching.
const URDU_HINT    = /[ٹڈڑںے]/;
const MARATHI_HINT = /आहे|नाही|माझ[ेा]|तुझ[ेा]|होत[ेी]|मी |तुम्ही/;

/** Detect the dominant non-Latin script in `text`; falls back to `fallbackLang` when the text is pure Latin script or empty. */
export function detectMessageLang(text: string, fallbackLang: string): string {
    let best: { lang: string; count: number } | null = null;
    for (const { lang, re } of SCRIPT_RANGES) {
        const count = text.match(re)?.length ?? 0;
        if (count > 0 && (!best || count > best.count)) best = { lang, count };
    }
    if (!best) return fallbackLang; // pure Latin script — trust the app setting

    if (best.lang === "hi") {
        if (MARATHI_HINT.test(text)) return "mr";
        return fallbackLang === "mr" ? "mr" : "hi";
    }
    if (best.lang === "ar") {
        if (URDU_HINT.test(text)) return "ur";
        return fallbackLang === "ur" ? "ur" : "ar";
    }
    return best.lang;
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
let _fetchAbort:  AbortController | null = null; // cancels in-flight TTS API fetch(es)
let _generation                          = 0;    // bumped on stop/supersede — chunk loops check this to bail out
let _resolveCurrentChunk: (() => void) | null = null; // lets stopAll() unstick an in-flight chunk-playback await

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
    _generation++; // invalidates any in-flight speakMessage chunk loop
    _fetchAbort?.abort();
    _fetchAbort = null;
    Speech.stop();
    if (_soundObject) {
        await _soundObject.unloadAsync().catch(() => {});
        _soundObject = null;
    }
    if (_resolveCurrentChunk) {
        const resolve = _resolveCurrentChunk;
        _resolveCurrentChunk = null;
        resolve(); // wake up a chunk loop that's mid-`await playChunkAndWait(...)`
    }
    _speakingId = null;
}

/**
 * Splits text into sentence-sized chunks so speakMessage can pipeline
 * fetch+playback: the first chunk is capped small so speech starts as soon
 * as Azure returns the first sentence, instead of waiting for the whole
 * reply to synthesize. Later chunks are capped larger to limit round trips
 * on long replies. A short reply naturally produces just one chunk.
 */
function splitIntoSpeechChunks(text: string, firstMax = 110, restMax = 240): string[] {
    // Terminators: Latin . ! ? — Devanagari (hi/mr/bn etc.) । — Urdu ۔ —
    // Arabic ؟ — CJK ideographic 。 and fullwidth ！？ (zh/ja).
    const sentences = text.match(/[^.!?।۔؟。！？]+[.!?।۔؟。！？]*\s*/g) ?? [text];
    const chunks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
        const limit = chunks.length === 0 ? firstMax : restMax;
        if (current && current.length + sentence.length > limit) {
            chunks.push(current.trim());
            current = sentence;
        } else {
            current += sentence;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
}

async function fetchChunkAudio(
    text: string,
    lang: string,
    gender: string | undefined,
    accessToken: string | undefined,
    signal: AbortSignal,
): Promise<ArrayBuffer> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const res = await fetch(
        `${apiBase()}/api/tts`,
        { method: "POST", headers, body: JSON.stringify({ text, lang, gender: gender ?? "neutral" }), signal },
    );
    if (!res.ok) throw new Error(`TTS API ${res.status}`);
    return res.arrayBuffer();
}

/**
 * Plays one chunk's audio file and resolves when it finishes naturally, or
 * when stopAll() unsticks it. Deletes the file once playback is done with it
 * — the two alternating filenames already bound total storage, but the file
 * should still be removed rather than left for the next overwrite.
 */
function playChunkAndWait(file: File, rate: number, onStart?: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        _resolveCurrentChunk = resolve;
        (async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS:         false,
                    playsInSilentModeIOS:       true,
                    playThroughEarpieceAndroid: false,
                    staysActiveInBackground:    true,
                });
                const { sound } = await Audio.Sound.createAsync(
                    { uri: file.uri },
                    { shouldPlay: true, rate: isFinite(rate) ? rate : 0.95, volume: 1.0 },
                );
                _soundObject = sound;
                onStart?.();
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (!status.isLoaded) return;
                    if (status.didJustFinish) {
                        sound.unloadAsync()
                            .catch(() => {})
                            .finally(() => {
                                try { file.delete(); } catch {}
                                if (_soundObject === sound) _soundObject = null;
                                if (_resolveCurrentChunk === resolve) _resolveCurrentChunk = null;
                                resolve();
                            });
                    }
                });
            } catch (err) {
                try { file.delete(); } catch {}
                if (_resolveCurrentChunk === resolve) _resolveCurrentChunk = null;
                reject(err);
            }
        })();
    });
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
    const file     = new File(Paths.cache, "imotara_tts_preview.mp3");
    file.write(new Uint8Array(arrayBuf));
    await playSound(file.uri, () => { try { file.delete(); } catch {} onDone?.(); }, rate);
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

/** Plays `text` with the on-device voice engine — shared by the Free-tier gate and the Azure-failure fallback below. */
async function playNativeFallback(
    text: string,
    lang: string,
    rate: number,
    pitch: number,
    onDone?: () => void,
    onStart?: () => void,
    // Fires instead of speaking when the device has no installed voice for
    // `lang` — some Android TTS engines (notably Samsung's) silently produce
    // no sound at all in this case rather than erroring or falling back to a
    // different language, so callers need an explicit signal to tell the
    // user rather than leaving them staring at a silently-reset UI.
    onUnavailable?: () => void,
): Promise<void> {
    if (!(await hasNativeVoice(lang))) {
        onUnavailable?.();
        _speakingId = null;
        onDone?.();
        return;
    }
    // Ensure audio plays even in silent mode before using native TTS
    await Audio.setAudioModeAsync({
        allowsRecordingIOS:         false,
        playsInSilentModeIOS:       true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground:    false,
    }).catch(() => {});
    onStart?.();
    Speech.speak(text, {
        language: toBCP47(lang),
        pitch:    isFinite(pitch) ? pitch : 1.0,
        rate:     isFinite(rate) ? rate : 0.95,
        onDone:  () => { _speakingId = null; onDone?.(); },
        onError: () => { _speakingId = null; onDone?.(); },
    });
}

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
    // Fires the moment audio actually starts (first chunk playing, or native
    // fallback engaged) — distinct from onDone, so callers can show a
    // "preparing voice…" state during the network+synthesis wait instead of
    // a misleading "now speaking" state that shows before any sound plays.
    onStart?: () => void,
    // Gate for Azure Neural TTS (the TTS_ADVANCED feature — Plus and above).
    // Defaults to true so existing callers that don't pass it keep today's
    // behavior; ChatScreen passes the real gate result for the chat speaker
    // button specifically.
    useNeuralVoice: boolean = true,
    // Fires when playback falls back to the on-device voice AND the device
    // has no installed voice for the message's language — see
    // playNativeFallback's doc comment for why this needs to be explicit
    // rather than inferred from silence.
    onUnavailable?: () => void,
): Promise<void> {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking || _soundObject) {
        const wasThis = _speakingId === messageId;
        await stopAll();
        if (wasThis) { onDone?.(); return; }
    }

    _speakingId = messageId;

    // The reply's actual script may not match the passed-in `lang` (the app's
    // static preferredLang setting) — see detectMessageLang's doc comment.
    lang = detectMessageLang(text, lang);

    if (!useNeuralVoice) {
        // Free tier — device voice only, matching the TTS_ADVANCED gate.
        console.log("[mobileTTS] TTS_ADVANCED gate closed — using native device voice");
        await playNativeFallback(text, lang, rate, pitch, onDone, onStart, onUnavailable);
        return;
    }

    const myGen      = ++_generation;
    const controller = new AbortController();
    _fetchAbort      = controller;
    // Per-chunk-fetch ceiling, armed fresh before each individual chunk fetch
    // and disarmed as soon as that fetch resolves — NOT a ceiling on the
    // whole sequence. A long reply legitimately takes longer in total
    // (many chunks, each played in full before the next starts), but any
    // single chunk's own fetch — a few hundred characters over the network —
    // should still complete quickly; only that is worth aborting on.
    const CHUNK_FETCH_TIMEOUT_MS = 20_000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const armTimer    = () => { timer = setTimeout(() => controller.abort(), CHUNK_FETCH_TIMEOUT_MS); };
    const disarmTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };

    const chunks = splitIntoSpeechChunks(stripMarkdown(text));
    console.log(`[mobileTTS] speakMessage start lang=${lang} textLen=${text.length} chunks=${chunks.length}`);

    // Always use Azure Neural TTS — native Speech.speak() ignores gender,
    // so the companion voice setting would be silently overridden by the device default.
    try {
        // Pipeline: fetch chunk N+1 while chunk N plays, so speech starts as
        // soon as the first (small) chunk is ready instead of waiting for the
        // entire reply to synthesize.
        armTimer();
        let nextFetch: Promise<ArrayBuffer> | null =
            fetchChunkAudio(chunks[0], lang, gender, accessToken, controller.signal);

        for (let i = 0; i < chunks.length; i++) {
            if (myGen !== _generation) return; // stopped/superseded

            const t0  = Date.now();
            const buf = await nextFetch!;
            disarmTimer(); // this chunk's fetch completed within budget
            console.log(`[mobileTTS] chunk ${i + 1}/${chunks.length} fetched in ${Date.now() - t0}ms bytes=${buf.byteLength}`);

            if (myGen !== _generation) return;

            nextFetch = null;
            if (i + 1 < chunks.length) {
                armTimer();
                nextFetch = fetchChunkAudio(chunks[i + 1], lang, gender, accessToken, controller.signal);
            }

            // Alternate filenames so writing the prefetched next chunk never
            // clobbers the file the previous chunk might still be playing.
            const file = new File(Paths.cache, `imotara_tts_${i % 2}.mp3`);
            file.write(new Uint8Array(buf));
            await playChunkAndWait(file, rate, i === 0 ? onStart : undefined);

            if (myGen !== _generation) return;
        }

        disarmTimer();
        if (_fetchAbort === controller) _fetchAbort = null;
        _speakingId = null;
        onDone?.();
    } catch (err: unknown) {
        disarmTimer();
        if (myGen !== _generation) return; // stopped/superseded — no fallback needed

        // User-initiated stop: abort throws DOMException "AbortError" — don't fall back.
        if (err instanceof Error && err.name === "AbortError") {
            _speakingId = null;
            return;
        }
        console.warn("[mobileTTS] Azure TTS failed, falling back to native:", err);
        await playNativeFallback(text, lang, rate, pitch, onDone, onStart, onUnavailable);
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
    // Mirrors stopAll()'s cancellation (bump generation, abort in-flight
    // fetch, wake a hung chunk-playback await) — this is a separate public
    // entry point the UI calls directly, so without the same bookkeeping a
    // chunked speakMessage() loop would hang forever mid-await and its
    // prefetch would keep running after the user thought playback stopped.
    _generation++;
    _fetchAbort?.abort();
    _fetchAbort = null;
    Speech.stop();
    _soundObject?.unloadAsync().catch(() => {});
    _soundObject = null;
    if (_resolveCurrentChunk) {
        const resolve = _resolveCurrentChunk;
        _resolveCurrentChunk = null;
        resolve();
    }
    _speakingId = null;
}

export function currentSpeakingId(): string | null {
    return _speakingId;
}
