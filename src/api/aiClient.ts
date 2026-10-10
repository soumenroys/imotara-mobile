// src/api/aiClient.ts
//
// Small helper to call the Imotara AI backend from the mobile app.
// Returns a plain replyText + basic error info so ChatScreen can decide
// whether to fallback to local version.

import { IMOTARA_API_BASE_URL } from "../config/api";
import { debugLog, debugWarn } from "../config/debug";
import {
  BN_SAD_REGEX, BN_ANGER_REGEX, BN_FEAR_REGEX,
  HI_SAD_REGEX, HI_ANGER_REGEX, HI_FEAR_REGEX,
  TA_SAD_REGEX, TA_ANGER_REGEX, TA_FEAR_REGEX,
  GU_SAD_REGEX, GU_ANGER_REGEX, GU_FEAR_REGEX,
  KN_SAD_REGEX, KN_ANGER_REGEX, KN_FEAR_REGEX,
  ML_SAD_REGEX, ML_ANGER_REGEX, ML_FEAR_REGEX,
  PA_SAD_REGEX, PA_ANGER_REGEX, PA_FEAR_REGEX,
  OR_SAD_REGEX, OR_ANGER_REGEX, OR_FEAR_REGEX,
  MR_SAD_REGEX, MR_ANGER_REGEX, MR_FEAR_REGEX,
  GRATITUDE_REGEX,
  isConfusedText,
  ROMAN_HI_LANG_HINT_REGEX,
  ROMAN_BN_LANG_HINT_REGEX,
  ROMAN_TA_LANG_HINT_REGEX,
  ROMAN_TE_LANG_HINT_REGEX,
  ROMAN_GU_LANG_HINT_REGEX,
  ROMAN_KN_LANG_HINT_REGEX,
  ROMAN_ML_LANG_HINT_REGEX,
  ROMAN_PA_LANG_HINT_REGEX,
  ROMAN_MR_LANG_HINT_REGEX,
  ROMAN_OR_LANG_HINT_REGEX,
  isStressText,
} from "../lib/emotion/keywordMaps";
import {
  fetchWithTimeout,
  DEFAULT_REMOTE_TIMEOUT_MS,
  isNetworkFailure,
  classifyNetworkFailure,
  NetworkUnavailableError,
} from "../lib/network/fetchWithTimeout";

// Mobile safety: avoid UI freezes if server returns an unexpectedly huge string.
const MAX_REMOTE_REPLY_CHARS = 5000;

export type AnalyzeResponse = {
  ok: boolean;
  replyText: string;
  reflectionSeed?: any;
  followUp?: string | null;
  errorMessage?: string;

  // ✅ optional diagnostics / parity fields (additive)
  analysisSource?: "cloud" | "local";
  meta?: unknown;

  // ✅ NEW: transport diagnostics (additive)
  remoteUrl?: string;
  remoteStatus?: number;
  remoteError?: string;

  // ✅ carry emotion through so UI doesn't default to neutral
  emotion?: string;
  intensity?: number;
};

// Keep this local to mobile; mirrors server payload structure (tone only)
export type ToneAgeRange =
  | "prefer_not"
  | "under_13"
  | "13_17"
  | "18_24"
  | "25_34"
  | "35_44"
  | "45_54"
  | "55_64"
  | "65_plus";

export type ToneGender =
  | "prefer_not"
  | "female"
  | "male"
  | "nonbinary"
  | "other";

// Mirrors web "Relationship vibe"
export type ToneRelationship =
  | "prefer_not"
  | "mentor"
  | "elder"
  | "friend"
  | "coach"
  | "sibling"
  | "junior_buddy"
  | "parent_like"
  | "partner_like";

export type SupportedLang =
  | "en" | "hi" | "mr" | "bn" | "ta" | "te" | "gu" | "pa" | "kn" | "ml" | "or"
  | "ur" | "zh" | "es" | "ar" | "fr" | "pt" | "ru" | "id" | "he" | "de" | "ja";

/**
 * What may be STORED as the user's language setting: any real language, or
 * "auto" meaning "work it out from what I write".
 *
 * Deliberately a wider type than SupportedLang, so "auto" can never be passed
 * somewhere that needs an actual language — statedPreference() is the only
 * way across, and it returns undefined for "auto".
 */
export type PreferredLangSetting = SupportedLang | typeof AUTO_LANG;

export type ResponseStyle = "comfort" | "reflect" | "motivate" | "advise";

export type ToneContextPayload = {
  user?: {
    name?: string;

    // ✅ parity with web: ageTone preferred, ageRange legacy fallback
    ageTone?: ToneAgeRange;
    ageRange?: ToneAgeRange;

    gender?: ToneGender;
    relationship?: ToneRelationship;

    // ✅ parity with web: preferred language + response style
    preferredLang?: PreferredLangSetting;
    responseStyle?: ResponseStyle;
    avatarAge?: number;
  };
  companion?: {
    enabled?: boolean;
    name?: string;

    // ✅ parity with web: ageTone preferred, ageRange legacy fallback
    ageTone?: ToneAgeRange;
    ageRange?: ToneAgeRange;

    gender?: ToneGender;
    relationship?: ToneRelationship;
    avatarAge?: number;
  };
  // per-turn seed offset for local reply variety; mirrors web ToneContext.sessionTurn
  sessionTurn?: number;
};

type CallAIOptions = {
  // Optional tone guidance for the remote AI (server supports this)
  toneContext?: ToneContextPayload;

  // ✅ NEW: allow mobile settings + light history to reach /api/respond
  analysisMode?: "auto" | "cloud" | "local";
  emotionInsightsEnabled?: boolean;

  // ✅ Non-breaking: network timeout override (ms)
  timeoutMs?: number;

  settings?: {
    relationshipTone?: ToneRelationship;
    ageTone?: ToneAgeRange;
    genderTone?: ToneGender;
  };

  // lightweight last-N messages
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;

  // ISO 3166-1 alpha-2 country code for crisis resource localisation
  countryCode?: string | null;

  // ✅ Web parity: emotional history summary sent as context.emotionMemory
  // Mirrors web's buildEmotionMemorySummary() → runRespondWithConsent → /api/respond
  emotionMemory?: string;

  // ✅ Web parity: explicit language preference sent as context.preferredLanguage
  // Mirrors web's profile.user.preferredLang → context.preferredLanguage
  preferredLanguage?: string;

  // ✅ Web parity: stable user/conversation scope for server-side seed + memory lookup
  // Web sends context.threadId; mobile sends localUserScopeId as both threadId and userId.
  // Server uses userId as fallback when no Supabase session exists (route.ts:936).
  threadId?: string;
  userId?: string;

  // ✅ Mobile auth: Supabase JWT from AuthContext.
  // When present, sent as "Authorization: Bearer <token>" so the server can
  // resolve the real Supabase user and unlock pinnedRecall quality.
  accessToken?: string;
};

function normalizeToneContext(
  input?: ToneContextPayload,
): ToneContextPayload | undefined {
  if (!input || typeof input !== "object") return undefined;

  const next: ToneContextPayload = {
    user: input.user ? { ...input.user } : undefined,
    companion: input.companion ? { ...input.companion } : undefined,
  };

  // ✅ Parity bridge (minimal + non-redundant):
  // Treat ageTone as canonical. Only derive ageTone from ageRange (legacy input),
  // but do NOT auto-fill ageRange from ageTone (avoids redundant payload).
  if (next.user) {
    if (!next.user.ageTone && next.user.ageRange)
      next.user.ageTone = next.user.ageRange;
  }

  if (next.companion) {
    if (!next.companion.ageTone && next.companion.ageRange) {
      next.companion.ageTone = next.companion.ageRange;
    }

    // ✅ Critical: if companion tone is enabled, require a stable name
    const enabled = !!next.companion.enabled;
    const name =
      typeof next.companion.name === "string" ? next.companion.name.trim() : "";

    if (enabled && !name) {
      next.companion.name = "Imotara";
    }
  }

  return next;
}

// Maps mobile toneContext to /api/chat-reply's tone parameter.
// Mirrors the server's deriveFormatterTone() in route.ts.
export function deriveToneForChatReply(
  toneContext?: ToneContextPayload,
  settings?: { relationshipTone?: string },
): "close_friend" | "calm_companion" | "coach" | "mentor" {
  const companionEnabled = toneContext?.companion?.enabled === true;

  if (!companionEnabled) {
    const rs = String(toneContext?.user?.responseStyle ?? "").toLowerCase();
    if (rs === "comfort") return "close_friend";
    if (rs === "reflect") return "calm_companion";
    if (rs === "motivate") return "coach";
    if (rs === "advise") return "mentor";
    return "close_friend";
  }

  const rel = String(
    toneContext?.companion?.relationship ?? settings?.relationshipTone ?? "",
  ).toLowerCase();
  if (rel === "coach") return "coach";
  if (rel === "mentor" || rel === "elder" || rel === "parent_like") return "mentor";
  // friend / sibling / junior_buddy / partner_like / prefer_not → close_friend
  return "close_friend";
}

// Detects the script/language from the message so /api/chat-reply can:
// (a) use the right language in formatImotaraReply (server-side post-processing)
// (b) include the right mythology/quote cultural instructions in the system prompt
export function detectLangFromScript(message: string): string {
  if (!message) return "en";
  if (/[\u0980-\u09FF]/.test(message)) return "bn";        // Bengali
  if (/[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(message)) return "hi"; // Hindi/Devanagari
  if (/[\u0B80-\u0BFF]/.test(message)) return "ta";        // Tamil
  if (/[\u0C00-\u0C7F]/.test(message)) return "te";        // Telugu
  if (/[\u0A80-\u0AFF]/.test(message)) return "gu";        // Gujarati
  if (/[\u0C80-\u0CFF]/.test(message)) return "kn";        // Kannada
  if (/[\u0D00-\u0D7F]/.test(message)) return "ml";        // Malayalam
  if (/[\u0A00-\u0A7F]/.test(message)) return "pa";        // Punjabi/Gurmukhi
  if (/[\u0B00-\u0B7F]/.test(message)) return "or";        // Odia
  if (/[\u0590-\u05FF]/.test(message)) return "he";        // Hebrew
  // Check Urdu-specific chars (ں پ چ ڈ ٹ گ ک ے ۓ) before generic Arabic block
  if (/[\u067E\u0686\u0688\u0691\u0679\u06AF\u06A9\u06BA\u06D2\u06D3]/.test(message)) return "ur";
  if (/[\u0600-\u06FF]/.test(message)) return "ar";        // Arabic
  if (/[\u0400-\u04FF]/.test(message)) return "ru";        // Russian/Cyrillic
  // 🔴 KANA BEFORE KANJI. Kana (\u3040-\u30FF) is unique to Japanese; the CJK
  // ideographs below are SHARED between the two languages. Testing Chinese
  // first meant any ordinary Japanese sentence — which nearly always mixes
  // kanji with kana — was classified as Chinese.
  //
  // ⚠️ "今日は気分が悪い" returned "zh". This feeds resolveReplyLang, so a
  // Japanese speaker with no stated language was answered IN CHINESE.
  // Found 2026-10-10 while testing the script detector on the web side,
  // which had the identical ordering.
  if (/[\u3040-\u30FF]/.test(message)) return "ja";        // Japanese (kana — unambiguous)
  if (/[\u4E00-\u9FFF]/.test(message)) return "zh";        // Chinese (CJK ideographs — shared)
  return "en";
}

/** Secondary language detection for Roman-script (transliterated) Indian languages.
 *  Called only when detectLangFromScript() returns "en" to avoid overriding native-script hits.
 *  Uses global flag to count all matches per regex, picks the highest-scoring language. */
/**
 * How strongly a message reads as plain ENGLISH, plus an absolute veto.
 *
 * 🔴 Ported from the web `scriptDetection.englishSignal` on 2026-10-09 so the
 * two platforms stop disagreeing. Measured divergence before the port, on 35
 * real sentences: **13 disagreed, and in 11 of them MOBILE answered "en"** for
 * a complete Indic sentence the web got right — `kem cho`, `ami valo nei`,
 * `mera dil bhari hai`, `enakku kashtama irukku`, `njan sukhamalla`.
 *
 * ⚠️ Those are the SHORTEST, most common messages this product receives: a
 * bare statement of distress. Mobile sent `lang:"en"`, and the server trusts
 * body.lang verbatim and injects "reply in English only — do not mirror their
 * non-English script". So the user was answered in a language they had not
 * written in, by design, on the most vulnerable message they could send.
 *
 * The cause was a flat `best[1] >= 2` threshold standing in for this guard.
 * A threshold cannot tell "kem cho" (a whole Gujarati greeting, 1 hit) from a
 * coincidental English hit, so it rejected both.
 */
export function englishSignal(message: string): { score: number; vetoed: boolean } {
  const englishStructural =
    /\b(I'm|I've|I'll|I'd|don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't|the|because|although|however|therefore|everything|something|nothing|anything)\b/gi;
  const commonEnglish =
    /\b(have|been|know|talk|about|anyone|lately|still|need|would|could|should|when|what|where|into|from|there|their|they|them|this|that|these|those|then|your|very|more|some|only|here|work|life|going|doing|trying|getting|being|having|making|taking|coming|thinking|looking|seeing|finding|wondering|feeling|worried|understand|myself|yourself|sometimes|always|never|already|together|another|without|through|before|after|every|other|might|really|quite|which|while|again|cannot|though|maybe)\b/gi;
  // Grammar markers that NEVER occur in a plain English sentence. An absolute
  // veto, because code-mixing — English nouns inside Indic grammar — is the
  // NORMAL register for these speakers, and it must never read as English.
  const indicGrammar =
    /\b(hai|hain|hoon|hoga|hogi|tha|thi|raha|rahi|rahe|mein|toh|bhi|aur|nahi|nahin|ami|tumi|amar|tomar|ache|achhi|achhe|karo|bolo|kothay|kotha|jao|esho)\b/i;
  const score =
    (message.match(englishStructural) ?? []).length +
    (message.match(commonEnglish) ?? []).length;
  return { score, vetoed: indicGrammar.test(message) };
}

export function detectLangFromRomanHints(message: string): string {
  if (!message) return "en";
  const scores: Record<string, number> = {};
  // 🔑 A one- or two-letter token is NOT evidence of a language.
  //
  // The rows carry real short words — `mi`/`mu`/`hu` ("I" in Marathi, Odia,
  // Gujarati), `Na`, `Ho`, `Tu` — but two letters collide with English and with
  // each other, so alone they prove nothing. Measured: "Ho ho ho" matched
  // hi=[Ho,ho,ho] and nothing else, and "Na, it is fine" matched only bn=[Na].
  // Both were answered in an Indian language.
  //
  // ⚠️ Deleting those tokens would be wrong — they are genuine first-person
  // pronouns and they carry the real cases. So they still COUNT; they just
  // cannot make a language win on their own. Verified against the cases that
  // depend on them: "mu bhala nahin" matched or=[mu,bhala] and
  // "mi theek nahi aahe" matched mr=[mi,theek nahi,aahe] — each has a
  // substantive match alongside the pronoun, so both stay correct.
  const substantive: Record<string, boolean> = {};
  const tally = (lang: string, regex: RegExp) => {
    const global = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
    const m = message.match(global);
    if (!m) return;
    scores[lang] = (scores[lang] || 0) + m.length;
    if (m.some((hit) => hit.trim().length >= 3)) substantive[lang] = true;
  };
  tally("mr", ROMAN_MR_LANG_HINT_REGEX);
  tally("bn", ROMAN_BN_LANG_HINT_REGEX);
  tally("hi", ROMAN_HI_LANG_HINT_REGEX);
  tally("ta", ROMAN_TA_LANG_HINT_REGEX);
  tally("te", ROMAN_TE_LANG_HINT_REGEX);
  tally("gu", ROMAN_GU_LANG_HINT_REGEX);
  tally("kn", ROMAN_KN_LANG_HINT_REGEX);
  tally("ml", ROMAN_ML_LANG_HINT_REGEX);
  tally("pa", ROMAN_PA_LANG_HINT_REGEX);
  tally("or", ROMAN_OR_LANG_HINT_REGEX);
  const best = Object.entries(scores)
    .filter(([lang]) => substantive[lang])
    .sort((a, b) => b[1] - a[1])[0];
  if (!best) return "en";
  // ⛔ NOT a hit threshold. See englishSignal above for why `>= 2` was wrong:
  // it cannot distinguish a complete short Indic sentence from a coincidental
  // English match, so it rejected both and answered in English.
  //
  // Instead, COMPARE the two signals. English wins only when it is unvetoed,
  // carries real weight (>= 2 markers), and is STRICTLY stronger than the
  // winning hint. ⚠️ Strictly — a TIE must go to the Indic hint. On web I first
  // wrote `>=` here and it stole code-mixed Gujarati, which is the normal
  // register for these speakers; see `englishIsNotGujarati.test.ts`.
  const english = englishSignal(message);
  if (!english.vetoed && english.score >= 2 && english.score > best[1]) return "en";
  return best[0];
}

/** The value meaning "work it out from what I write" rather than a chosen language. */
export const AUTO_LANG = "auto";

/**
 * Returns the profile language only when the user actually stated one.
 *
 * `undefined`, `""` and `"auto"` all mean "not stated" and must fall through
 * to detection. Anything else — including an explicit "en" — is a real choice
 * and outranks detection, so someone who deliberately wants English replies
 * while writing Bengali still gets them.
 */
export function statedPreference(value: string | undefined | null): string | undefined {
    const v = (value ?? "").trim().toLowerCase();
    if (!v || v === AUTO_LANG) return undefined;
    return v;
}

/**
 * A CONCRETE language for things that cannot accept "auto" — picking a TTS
 * voice, a BCP-47 locale, a canned string table, an RTL check.
 *
 * "auto" is meaningful only when resolving what language to REPLY in, where
 * detection fills the gap. Everywhere else it would be a bogus language code,
 * so it resolves to "en" — exactly what these call sites got from the old
 * `?? "en"` default, leaving their behaviour unchanged.
 */
/**
 * 🔴 THE LANGUAGE TO REPLY IN. Both request paths MUST use this.
 *
 * Found 2026-10-09. `callImotaraAI` (the JSON path) did this resolution
 * inline, while ChatScreen's STREAMING payload sent
 * `concreteLang(preferredLang)` — which turns "auto" into "en". The server
 * does not re-detect (chat-reply/route.ts:833 reads body.lang verbatim) and
 * on "en" it injects "Always respond in English. Even if the user's messages
 * contain text in another script or language, reply in English only."
 *
 * ⚠️ That did not bite for one reason only: `res.body` does not exist on React
 * Native, so streaming ALWAYS failed and every message fell through to the
 * JSON path. The device verification behind commit 8a1577e — "ami khub valo
 * nei" answered in Bengali — passed through that fallback.
 *
 * 🔑 The moment streaming actually works, the streaming payload becomes live
 * and a Bengali message gets an English reply again — re-introducing the exact
 * bug 8a1577e was written to fix. So this is not a refactor: two copies of one
 * decision, one of which was wrong, is what caused it. There is now one.
 *
 * `concreteLang` remains correct for things that cannot accept "auto" — a TTS
 * voice, a BCP-47 locale, a canned string table. It is wrong here, because
 * "auto" means "work it out from what I wrote", and this is where that work
 * happens.
 */
export function resolveReplyLang(
    message: string,
    preferredLang: string | undefined | null,
): string {
    const explicit = detectExplicitLangRequest(message);
    const script = detectLangFromScript(message);
    const detected = script !== "en" ? script : detectLangFromRomanHints(message);
    const profile = statedPreference(preferredLang);
    // explicit switch request > stated preference > detection > English
    return explicit || profile || (detected !== "en" ? detected : "en");
}

/**
 * Which language to tell Whisper the microphone audio is in.
 *
 * 🔴 Reported 2026-10-10, physical iPhone: spoke Bengali, got ENGLISH text in
 * the composer. The cause was `concreteLang(preferredLang)` — it maps "auto"
 * AND an unset preference to "en" (see statedPreference), and
 * /api/voice/transcribe forwards a recognised code to Whisper verbatim as
 * `language=en`. Whisper then renders Bengali speech as English words. It was
 * not mis-detecting anything; it had been told the audio was English.
 *
 * ⚠️ "auto" alone is not a good enough answer either. The transcribe route
 * notes, from its own history, that bare auto-detection "mislabels short Indic
 * utterances as Hindi/Arabic" — which is why explicit codes were added there in
 * the first place. A one-second "haan" is exactly the case hands-free produces.
 *
 * 🔑 So when the person has stated no preference, the CONVERSATION is the best
 * evidence available: someone whose last messages are in Bengali script is
 * overwhelmingly likely to be speaking Bengali. That costs nothing and needs no
 * detection of its own.
 *
 * Order: a stated preference wins (they chose it) > the script of the recent
 * conversation > "auto", which the route turns into Whisper's own detection.
 *
 * ⚖️ Deliberately NOT using romanized hints. A history of romanized Bengali
 * ("ami valo nei") would resolve to `bn`, and Whisper with language=bn returns
 * NATIVE script — silently switching someone from the script they have been
 * typing in. Latin-script history therefore stays on "auto".
 */
export function transcriptionLangHint(
    preferredLang: string | undefined | null,
    recentTexts: string[],
): string {
    const stated = statedPreference(preferredLang);
    if (stated) return stated;
    // Most recent first — the current language matters more than an old one.
    for (let i = recentTexts.length - 1; i >= 0; i--) {
        const fromScript = detectLangFromScript(recentTexts[i] ?? "");
        if (fromScript !== "en") return fromScript;
    }
    // ⛔ "auto", never "en". An English-looking history is not evidence that
    // the next spoken sentence is English — it is the absence of evidence,
    // and "en" would reintroduce the exact bug this function exists for.
    return "auto";
}

export function concreteLang(value: string | undefined | null): string {
    return statedPreference(value) ?? "en";
}

/** Detects explicit language-switch intent in a message.
 *  Only fires when a clear switch verb is present alongside a language name —
 *  bare language mentions ("I love Arabic poetry") will NOT match.
 *  Returns ISO code if found, otherwise null. Identical logic to web respondRemote.ts. */
export function detectExplicitLangRequest(text: string): string | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  // Intent verbs that signal the user wants to switch language
  const intentVerb = /\b(speak|talk|reply|write|respond|use|switch|change|try|chat|communicate|answer|converse)\b/;
  // Preposition patterns: "in X", "to X", "using X", "with X"
  const prep = /\b(in|to|using|with|into)\b/;
  const hasIntent = intentVerb.test(t) || prep.test(t);

  // Language name → ISO code. Word boundaries prevent partial matches.
  const langPatterns: [RegExp, string][] = [
    [/\benglish\b/,    "en"],
    [/\bhindi\b/,      "hi"],
    [/\bbengali\b|\bbangla\b/, "bn"],
    [/\bmarathi\b/,    "mr"],
    [/\btamil\b/,      "ta"],
    [/\btelugu\b/,     "te"],
    [/\bgujarati\b/,   "gu"],
    [/\bkannada\b/,    "kn"],
    [/\bmalayalam\b/,  "ml"],
    [/\bpunjabi\b/,    "pa"],
    [/\bodia\b|\boriya\b/, "or"],
    [/\barabic\b/,     "ar"],
    [/\burdu\b/,       "ur"],
    [/\brussian\b/,    "ru"],
    [/\bchinese\b|\bmandarin\b/, "zh"],
    [/\bjapanese\b/,   "ja"],
    [/\bspanish\b/,    "es"],
    [/\bfrench\b/,     "fr"],
    [/\bgerman\b/,     "de"],
    [/\bportuguese\b/, "pt"],
    [/\bindonesian\b/, "id"],
    [/\bhebrew\b/,     "he"],
  ];

  if (!hasIntent) return null;

  for (const [pattern, code] of langPatterns) {
    if (pattern.test(t)) return code;
  }
  return null;
}

function deriveEmotionHintFromMessage(message: string): string | undefined {
  const raw = String(message || "").trim();
  if (!raw) return undefined;

  const t = raw.toLowerCase().replace(/\s+/g, " ");

  // Emoji-only inputs (QA cases)
  const emojiOnly =
    raw.length > 0 && !/[a-z0-9\u0900-\u097F\u0980-\u09FF]/i.test(raw);

  if (emojiOnly) {
    // 😂 😄 😆 🤣
    if (/[\u{1F602}\u{1F604}\u{1F606}\u{1F923}]/u.test(raw)) return "joy";
    // 👍 ✅
    if (/[\u{1F44D}\u{2705}]/u.test(raw)) return "neutral";
  }

  // Multilingual emotion detection
  if (isConfusedText(raw)) return "confused";
  if (
    HI_SAD_REGEX.test(raw) || BN_SAD_REGEX.test(raw) ||
    TA_SAD_REGEX.test(raw) || GU_SAD_REGEX.test(raw) ||
    KN_SAD_REGEX.test(raw) || ML_SAD_REGEX.test(raw) ||
    PA_SAD_REGEX.test(raw) || OR_SAD_REGEX.test(raw) ||
    MR_SAD_REGEX.test(raw)
  ) return "sad";
  if (
    isStressText(raw)
  ) return "stressed";
  if (
    HI_ANGER_REGEX.test(raw) || BN_ANGER_REGEX.test(raw) ||
    TA_ANGER_REGEX.test(raw) || GU_ANGER_REGEX.test(raw) ||
    KN_ANGER_REGEX.test(raw) || ML_ANGER_REGEX.test(raw) ||
    PA_ANGER_REGEX.test(raw) || OR_ANGER_REGEX.test(raw) ||
    MR_ANGER_REGEX.test(raw)
  ) return "angry";
  if (
    HI_FEAR_REGEX.test(raw) || BN_FEAR_REGEX.test(raw) ||
    TA_FEAR_REGEX.test(raw) || GU_FEAR_REGEX.test(raw) ||
    KN_FEAR_REGEX.test(raw) || ML_FEAR_REGEX.test(raw) ||
    PA_FEAR_REGEX.test(raw) || OR_FEAR_REGEX.test(raw) ||
    MR_FEAR_REGEX.test(raw)
  ) return "anxious";
  if (GRATITUDE_REGEX.test(raw)) return "hopeful";

  // English lightweight fallbacks
  if (/\b(lonely|down|depressed|sad)\b/.test(t)) return "sad";
  if (/\b(stressed|stress|worried|anxious|panic)\b/.test(t)) return "stressed";
  if (/\b(frustrated|angry|mad|furious|irritated)\b/.test(t)) return "angry";
  if (/\b(hopeful|optimistic|grateful|thankful)\b/.test(t) || /✨/.test(raw)) return "hopeful";

  return undefined;
}

/**
 * Streams a chat-reply response via SSE (?stream=1).
 * Calls onToken(accumulated) as each token arrives — batched per animation frame.
 * Returns { ok, text } when [DONE] is received or on error.
 * Falls back gracefully: caller should try callImotaraAI() if this returns ok:false.
 */
/**
 * ⚠️ `accumulated.length > 10` WAS REJECTING VALID REPLIES.
 *
 * Ten characters is an ordinary COMPLETE reply in this product's languages:
 *   "Take care."   10   → was rejected (strictly greater than)
 *   "Theek hai."   10   → was rejected
 *   "ठीक है।"       8   → was rejected
 *   "ঠিক আছে।"      8   → was rejected
 *
 * A rejection here is not cosmetic: ChatScreen deletes the rendered bubble
 * and issues a second full paid reply. So the shortest, warmest, most human
 * answers were exactly the ones that cost double and arrived twice as slowly.
 *
 * The real question is "did we receive anything at all", and the `[DONE]`
 * sentinel plus the server's own placeholder guards already cover the rest.
 */
function isUsableReply(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // 🔴 …and it must not be one of the known placeholder strings.
  //
  // The JSON path has always rejected these server-side; the STREAMING path —
  // which is the one both clients try FIRST — had no client-side equivalent at
  // all, so a placeholder that reached mobile was accepted as a real reply and
  // stored in history. (The remaining half of U15 in the 2026-10-09 audit.)
  //
  // ⚠️ Kept deliberately identical to web's badPlaceholderText.ts. These two
  // lists existing separately is the usual drift risk, so a test asserts they
  // still match; RN cannot import from the web package, which is the only
  // reason this is a copy at all.
  return !(
    t.includes("soft, placeholder reply") ||
    t.includes("I tried to connect to Imotara's AI engine") ||
    t.includes("but something went wrong")
  );
}

/**
 * Parse a complete SSE payload that arrived in one piece (the React Native
 * path — see the note in streamChatReply). Same wire format the incremental
 * reader handles: `data: {"t":"..."}` lines terminated by `data: [DONE]`.
 */
function parseSseText(raw: string): string {
  let accumulated = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") break;
    try {
      const token = String(JSON.parse(data).t ?? "");
      if (token) accumulated += token;
    } catch { /* malformed SSE chunk — skip, same as the reader path */ }
  }
  return accumulated;
}

export async function streamChatReply(
  payload: Record<string, unknown>,
  accessToken: string | undefined,
  onToken: (accumulated: string) => void,
  timeoutMs: number = 25_000,
  abortSignal?: AbortSignal,
): Promise<{ ok: boolean; text: string }> {
  const url = `${IMOTARA_API_BASE_URL}/api/chat-reply?stream=1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  abortSignal?.addEventListener("abort", () => ctrl.abort(), { once: true });

  // Batching — flush deferred via setTimeout(0) so it works whether or not the
  // app is foregrounded (requestAnimationFrame doesn't fire when backgrounded in Hermes).
  let pendingAccumulated = "";
  let rafHandle: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (rafHandle) clearTimeout(rafHandle);
    const snap = pendingAccumulated;
    rafHandle = setTimeout(() => onToken(snap), 0);
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        // Tell the server how long we will actually wait, so it can size its
        // own budget to fit. See planBudget() in the web repo's aiClient.ts —
        // the server used to ASSUME this ("mobile 20-25s") and the assumption
        // went stale the day DEFAULT_REMOTE_TIMEOUT_MS became 10s.
        "x-imotara-client-timeout-ms": String(timeoutMs),
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    if (!res.ok) return { ok: false, text: "" };

    /**
     * 🔴 REACT NATIVE HAS NO `res.body`. THIS PATH IS THE ONLY ONE THAT RUNS
     * ON A DEVICE.
     *
     * Verified 2026-10-09 by reading node_modules, not by inference:
     *   react-native/Libraries/Network/fetch.js
     *     -> require('whatwg-fetch'); export const fetch = global.fetch;
     *   whatwg-fetch 3.6.20 Response exposes `_bodyInit` / `_bodyText` and
     *   has NO `body` getter. No expo/fetch, no react-native-fetch-api, no
     *   ReadableStream polyfill, no global.fetch override anywhere in the app.
     *
     * So the old guard `if (!res.ok || !res.body)` returned `{ok:false}` on
     * EVERY message ever sent from a phone, and ChatScreen's failure branch
     * then deleted the rendered bubble and issued a SECOND complete
     * /api/chat-reply. Every reply cost two full LLM generations in series:
     * ~2x the wait and ~2x the OpenAI spend, Android and iOS alike. The
     * "word-by-word within ~500ms" this file promises has never once happened
     * on a device.
     *
     * 🔑 AND THE WHOLE REPLY WAS ALREADY HERE. whatwg-fetch is XHR-based, so
     * `await fetch()` does not resolve until the entire SSE response has
     * downloaded — the server had already run OpenAI to completion and billed
     * for it. The text was sitting in `_bodyInit`, reachable with res.text().
     *
     * ⚠️ So this is NOT "streaming for React Native". Progressive typing is
     * genuinely impossible without a stream polyfill. It is: stop throwing
     * away a reply we already have and paying to generate it again. The user
     * sees the reply appear at once instead of twice as slowly.
     */
    if (!res.body) {
      const accumulated = parseSseText(await res.text());
      if (rafHandle) clearTimeout(rafHandle);
      clearTimeout(timer);
      onToken(accumulated);
      return { ok: isUsableReply(accumulated), text: accumulated };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          if (rafHandle) clearTimeout(rafHandle);
          onToken(accumulated);
          clearTimeout(timer);
          return { ok: isUsableReply(accumulated), text: accumulated };
        }
        try {
          const parsed = JSON.parse(data);
          const token = String(parsed.t ?? "");
          if (token) {
            accumulated += token;
            pendingAccumulated = accumulated;
            flush();
          }
        } catch { /* malformed SSE chunk — skip */ }
      }
    }

    if (rafHandle) clearTimeout(rafHandle);
    clearTimeout(timer);
    return { ok: isUsableReply(accumulated), text: accumulated };
  } catch {
    if (rafHandle) clearTimeout(rafHandle);
    return { ok: false, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

export async function callImotaraAI(
  message: string,
  opts?: CallAIOptions,
): Promise<AnalyzeResponse> {
  try {
    const toneContext = normalizeToneContext(opts?.toneContext);

    // ✅ Mobile parity with web:
    // If the caller provided `settings` (from Settings screen) but did not include
    // matching fields in toneContext, fill them in (additive only).
    //
    // Cleanup: prefer ageTone as the canonical field.
    // Only set ageRange if the field already exists on the object (back-compat).
    if (toneContext?.companion?.enabled && opts?.settings) {
      if (!toneContext.companion.ageTone && opts.settings.ageTone) {
        toneContext.companion.ageTone = opts.settings.ageTone;
      }

      // Back-compat bridge: only populate ageRange when it is already present
      // on the companion object (so we don't redundantly mirror by default).
      if (
        !toneContext.companion.ageRange &&
        opts.settings.ageTone &&
        "ageRange" in toneContext.companion
      ) {
        toneContext.companion.ageRange = opts.settings.ageTone;
      }

      if (
        !toneContext.companion.relationship &&
        opts.settings.relationshipTone
      ) {
        toneContext.companion.relationship = opts.settings.relationshipTone;
      }
      if (!toneContext.companion.gender && opts.settings.genderTone) {
        toneContext.companion.gender = opts.settings.genderTone;
      }
    }

    // ✅ Unique per-call requestId (helps the server avoid accidental dedupe / repeats)
    const requestId = `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    debugLog("[imotara] outbound request", {
      requestId,
      analysisMode: opts?.analysisMode,
      messageLen: typeof message === "string" ? message.length : -1,
      messagePreview:
        typeof message === "string" ? message.slice(0, 120) : String(message),
      companion: {
        enabled: toneContext?.companion?.enabled,
        name: toneContext?.companion?.name,
        relationship: toneContext?.companion?.relationship,
        ageTone: toneContext?.companion?.ageTone,
        ageRange: toneContext?.companion?.ageRange,
        gender: toneContext?.companion?.gender,
      },
    });

    const emotionHint = deriveEmotionHintFromMessage(message);

    // ── Try /api/chat-reply first (OpenAI-powered, same path as web app) ────────
    // The web app calls /api/chat-reply (GPT) and only falls back to /api/respond
    // (rule-based templates) when GPT fails. Mobile was only calling /api/respond,
    // which caused short robotic replies like "I'm here with you." for all questions.
    const chatReplyUrl = `${IMOTARA_API_BASE_URL}/api/chat-reply`;
    try {
      // Resolve language:
      //   explicit switch request > profile preference > detection > "en"
      //
      // A REAL preference still outranks detection: someone who deliberately
      // set Bengali gets Bengali even when they write a line of English. What
      // must NOT outrank detection is the DEFAULT, and that is the bug this
      // guards against — preferredLang defaulted to "en" and was persisted for
      // everybody, so for any user who never opened the picker the profile
      // said "en", detection never ran, and writing in Bengali got an English
      // reply. Verified on a device 2026-09-11.
      //
      // "auto" (and a missing value) mean "no preference stated" and fall
      // through to detection. See isStatedPreference.
      // Shared with ChatScreen's streaming payload — see resolveReplyLang.
      const chatReplyLang = resolveReplyLang(
        message,
        opts?.preferredLanguage ??
        (toneContext?.user?.preferredLang as string | undefined),
      );

      // Inject user's name (from Settings) as a system message so GPT can
      // personalize naturally without waiting for Supabase memory lookup.
      // /api/chat-reply accepts system messages in the messages array.
      const userName = typeof toneContext?.user?.name === "string"
        ? toneContext.user.name.trim()
        : "";
      const nameSystemMsg = userName
        ? [{ role: "system" as const, content: `The user's preferred name is: ${userName}. Use it naturally — not every line.` }]
        : [];

      const chatReplyMessages = [
        ...nameSystemMsg,
        ...(opts?.recentMessages ?? []),
        { role: "user" as const, content: message },
      ];
      const chatReplyTone = deriveToneForChatReply(toneContext, opts?.settings);
      const chatReplyPayload: Record<string, unknown> = {
        messages: chatReplyMessages,
        tone: chatReplyTone,
        lang: chatReplyLang,
        ...(emotionHint ? { emotion: emotionHint } : {}),
        ...(opts?.emotionMemory ? { emotionMemory: opts.emotionMemory } : {}),
        // age context for vocabulary/register calibration
        ...(toneContext?.user?.ageTone && toneContext.user.ageTone !== "prefer_not" ? { userAge: toneContext.user.ageTone } : opts?.settings?.ageTone && opts.settings.ageTone !== "prefer_not" ? { userAge: opts.settings.ageTone } : {}),
        ...(toneContext?.companion?.ageTone && toneContext.companion.ageTone !== "prefer_not" ? { companionAge: toneContext.companion.ageTone } : {}),
        // gender context for verb conjugation and grammatical agreement
        ...(toneContext?.user?.gender && toneContext.user.gender !== "prefer_not" ? { userGender: toneContext.user.gender } : {}),
        ...(toneContext?.companion?.gender && toneContext.companion.gender !== "prefer_not" ? { companionGender: toneContext.companion.gender } : {}),
        // companion name — sent whenever a custom name is configured so the AI uses it as its identity
        ...(toneContext?.companion?.name?.trim() ? { companionName: toneContext.companion.name.trim() } : {}),
        // response style — how the user wants Imotara to respond (comfort / reflect / motivate / advise)
        ...(toneContext?.user?.responseStyle ? { responseStyle: toneContext.user.responseStyle } : {}),
      };

      const chatRes = await fetchWithTimeout(
        chatReplyUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(opts?.accessToken ? { Authorization: `Bearer ${opts.accessToken}` } : {}),
            // Same contract as streamChatReply above.
            "x-imotara-client-timeout-ms": String(opts?.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS),
          },
          body: JSON.stringify(chatReplyPayload),
        },
        opts?.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS,
      );

      if (chatRes.ok) {
        let chatData: any = null;
        try { chatData = await chatRes.json(); } catch { /* fall through */ }

        const chatReplyText = String(chatData?.text ?? "").trim();

        // LIC-2: quota exceeded — skip /api/respond cloud fallback, let ChatScreen use local reply
        if (!chatReplyText && chatData?.meta?.from === "quota_exceeded") {
          return {
            ok: false,
            replyText: "",
            errorMessage: "quota_exceeded",
            analysisSource: "cloud",
            remoteUrl: chatReplyUrl,
          };
        }

        // Accept any non-empty reply from the server — including server-side fallbacks.
        // Previously required meta.from === "openai" which discarded valid cached/fallback
        // replies and caused a redundant second call to /api/respond.
        if (chatReplyText) {
          const safeReplyText = chatReplyText.length > MAX_REMOTE_REPLY_CHARS
            ? chatReplyText.slice(0, MAX_REMOTE_REPLY_CHARS).trimEnd() + "…"
            : chatReplyText;

          debugLog("[imotara] chat-reply succeeded", { len: safeReplyText.length });

          return {
            ok: true,
            replyText: safeReplyText,
            analysisSource: "cloud",
            remoteUrl: chatReplyUrl,
            emotion: emotionHint,
          };
        }
      }
    } catch (chatErr: any) {
      debugWarn("[imotara] chat-reply failed, falling back to /api/respond", chatErr?.message);

      // If the first call could not reach the network at all, the second one
      // will not either — it would just spend another full timeout proving the
      // same thing, which is how a message sent with no signal used to cost
      // twenty seconds and then twenty more. A server that answered and said
      // no is different: that is worth a second endpoint.
      const failureKind = classifyNetworkFailure(chatErr);
      if (failureKind) {
        // ⚠️ Carry the KIND. Wrapping only the message is what made a timeout
        // indistinguishable from being offline by the time ChatScreen saw it:
        // an AbortError's message is "Aborted", which matches no keyword.
        throw new NetworkUnavailableError(
          chatErr?.message ?? "network unavailable", failureKind);
      }
    }
    // ── /api/chat-reply failed or returned non-GPT response — fall through to /api/respond ──

    const remoteUrl = `${IMOTARA_API_BASE_URL}/api/respond`;

    const res = await fetchWithTimeout(
      remoteUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ✅ Mobile auth: include Supabase Bearer token when available.
          // Server's /api/respond will call supabase.auth.getUser(token) to
          // resolve the real user and enable pinnedRecall.
          ...(opts?.accessToken
            ? { Authorization: `Bearer ${opts.accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          requestId,
          message,

          ...(opts?.analysisMode ? { analysisMode: opts.analysisMode } : {}),

          // ✅ Additive: provide a soft hint (server may ignore; safe if unused)
          ...(emotionHint ? { emotionHint } : {}),

          ...(toneContext ? { toneContext } : {}),

          // ✅ Country code for server-side crisis resource localisation
          countryCode: opts?.countryCode ?? null,

          context: {
            source: "mobile",
            countryCode: opts?.countryCode ?? null,
            analysisMode: opts?.analysisMode,
            emotionInsightsEnabled: opts?.emotionInsightsEnabled,

            // ✅ Back-compat: include hint in context too (safe if ignored)
            ...(emotionHint ? { emotionHint } : {}),

            ...(toneContext ? { toneContext } : {}),

            // ✅ Web parity: emotional history summary (calibrates empathy depth)
            ...(opts?.emotionMemory ? { emotionMemory: opts.emotionMemory } : {}),

            // ✅ Web parity: explicit language preference for language-derivation pipeline
            ...(opts?.preferredLanguage ? { preferredLanguage: opts.preferredLanguage } : {}),

            // ✅ Web parity: stable scope for server seed stability + memory lookup
            // Server falls back to context.userId when no Supabase auth session exists
            ...(opts?.threadId ? { threadId: opts.threadId } : {}),
            ...(opts?.userId ? { userId: opts.userId, user: { id: opts.userId } } : {}),

            persona: opts?.settings
              ? {
                  relationshipTone: opts.settings.relationshipTone,
                  ageTone: opts.settings.ageTone,
                  genderTone: opts.settings.genderTone,
                }
              : undefined,

            recentMessages: opts?.recentMessages ?? undefined,
            recent: opts?.recentMessages ?? undefined,
          },
        }),
      },
      opts?.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS,
    );

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return {
        ok: false,
        replyText: "",
        errorMessage: `HTTP ${res.status}`,
        analysisSource: "cloud",
        remoteUrl,
        remoteStatus: res.status,
        remoteError: bodyText ? bodyText.slice(0, 200) : `HTTP ${res.status}`,
      };
    }

    const rawText = await res.text().catch(() => "");
    let data: any = null;

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      debugWarn("[imotara] cloud response was not valid JSON", {
        status: res.status,
        body: rawText.slice(0, 200),
      });

      return {
        ok: false,
        replyText: "",
        errorMessage: "Invalid server response",
        analysisSource: "cloud",
        remoteUrl,
        remoteStatus: res.status,
        remoteError: rawText ? rawText.slice(0, 200) : "Invalid JSON",
      };
    }

    // Debug log – see in Metro console (gated for QA/prod cleanliness)
    debugLog("Imotara mobile AI raw response:", JSON.stringify(data, null, 2));

    // ✅ Focused debug: confirm exactly what the server sent for emotion
    debugLog("[imotara] cloud emotion fields", {
      requestId: data?.requestId,
      emotion: data?.emotion,
      intensity: data?.intensity,
      metaEmotionLabel: data?.meta?.emotionLabel,
      metaEmotion: data?.meta?.emotion,
      metaIntensity: data?.meta?.intensity,
      metaKeys:
        data?.meta && typeof data.meta === "object"
          ? Object.keys(data.meta)
          : undefined,
    });

    // 1) Try common "direct reply" fields first
    // Backend contract (strict):
    // { message: string, reflectionSeed?: {...}, followUp?: string }
    let replyText = String(data?.message ?? "").trim();

    if (replyText.length > MAX_REMOTE_REPLY_CHARS) {
      debugWarn(
        "[imotara] cloud reply too long; truncating for mobile safety",
        {
          len: replyText.length,
          cap: MAX_REMOTE_REPLY_CHARS,
        },
      );
      replyText = replyText.slice(0, MAX_REMOTE_REPLY_CHARS).trimEnd() + "…";
    }

    if (!replyText) {
      return {
        ok: false,
        replyText: "",
        errorMessage: "Invalid /api/respond response: missing message",
      };
    }

    if (!replyText.trim()) {
      return {
        ok: false,
        replyText: "",
        errorMessage: "No reply text returned from server",
      };
    }

    // ✅ Preserve server emotion signal (cloud often nests it under meta)
    // Supports:
    // - data.emotion: string
    // - data.meta.emotionLabel: string
    // - data.meta.emotion: { primary: string, intensity: "low"|"medium"|"high", ... }
    const meta = data?.meta;

    const metaEmotionObj =
      meta &&
      typeof meta === "object" &&
      (meta as any).emotion &&
      typeof (meta as any).emotion === "object"
        ? (meta as any).emotion
        : undefined;

    const emotionRaw =
      data?.emotion ??
      (meta && typeof meta === "object"
        ? (meta as any).emotionLabel
        : undefined) ??
      metaEmotionObj?.primary;

    let emotion =
      typeof emotionRaw === "string" && emotionRaw.trim()
        ? emotionRaw.trim()
        : undefined;

    // ✅ Local fallback (computed always so we can override cloud "neutral" when it's clearly wrong)
    const localFallbackEmotion = (() => {
      const raw = String(message || "").trim();
      if (!raw) return undefined;

      const t = raw.toLowerCase().replace(/\s+/g, " ");

      // 1) Emoji-first shortcuts (QA cases)
      const emojiOnly =
        raw.length > 0 && !/[a-z0-9\u0900-\u097F\u0980-\u09FF]/i.test(raw);

      if (emojiOnly) {
        // Unicode-safe emoji detection (prevents surrogate-pair false matches)
        // 😂 (1F602), 😄 (1F604), 😆 (1F606), 🤣 (1F923)
        if (/[\u{1F602}\u{1F604}\u{1F606}\u{1F923}]/u.test(raw)) return "joy";
        // 👍 (1F44D) or ✅ (2705)
        if (/[\u{1F44D}\u{2705}]/u.test(raw)) return "neutral";
      } else if (/\b(lol|lmao|rofl)\b/.test(t)) {
        return "joy";
      }

      // 2) Multilingual emotion detection
      if (isConfusedText(raw)) return "confused";
      if (
        HI_SAD_REGEX.test(raw) || BN_SAD_REGEX.test(raw) ||
        TA_SAD_REGEX.test(raw) || GU_SAD_REGEX.test(raw) ||
        KN_SAD_REGEX.test(raw) || ML_SAD_REGEX.test(raw) ||
        PA_SAD_REGEX.test(raw) || OR_SAD_REGEX.test(raw) ||
        MR_SAD_REGEX.test(raw)
      ) return "sad";
      if (
        isStressText(raw)
      ) return "stressed";
      if (
        HI_ANGER_REGEX.test(raw) || BN_ANGER_REGEX.test(raw) ||
        GU_ANGER_REGEX.test(raw) || KN_ANGER_REGEX.test(raw) ||
        ML_ANGER_REGEX.test(raw) || PA_ANGER_REGEX.test(raw) ||
        OR_ANGER_REGEX.test(raw) || MR_ANGER_REGEX.test(raw)
      ) return "angry";
      if (
        HI_FEAR_REGEX.test(raw) || BN_FEAR_REGEX.test(raw) ||
        GU_FEAR_REGEX.test(raw) || KN_FEAR_REGEX.test(raw) ||
        ML_FEAR_REGEX.test(raw) || PA_FEAR_REGEX.test(raw) ||
        OR_FEAR_REGEX.test(raw) || MR_FEAR_REGEX.test(raw)
      ) return "anxious";
      if (GRATITUDE_REGEX.test(raw)) return "hopeful";

      // 3) English lightweight fallbacks
      if (/\b(lonely|down|depressed|sad)\b/.test(t)) return "sad";
      if (/\b(stressed|stress|worried|anxious|panic)\b/.test(t))
        return "stressed";
      if (/\b(frustrated|angry|mad|furious|irritated)\b/.test(t))
        return "angry";
      if (/\b(hopeful|optimistic|grateful|thankful)\b/.test(t) || /✨/.test(raw))
        return "hopeful";

      // 4) Romanized confusion (catch-all)
      if (
        /\bsamajh nahi aa raha\b/.test(t) ||
        /\bsamajh nahi aa rahi\b/.test(t) ||
        /\bkya karu\b/.test(t) ||
        /\bwhat should i do\b/.test(t)
      ) {
        return "confused";
      }

      return undefined;
    })();

    // If server doesn't send emotion at all, use local fallback.
    if (!emotion) {
      emotion = localFallbackEmotion;
    }
    // If server says "neutral" but local fallback is clearly non-neutral, override.
    else if (
      emotion === "neutral" &&
      localFallbackEmotion &&
      localFallbackEmotion !== "neutral"
    ) {
      emotion = localFallbackEmotion;
    }

    // intensity can be numeric or (in meta.emotion) a string level
    const intensityRaw =
      data?.intensity ??
      (meta && typeof meta === "object"
        ? (meta as any).intensity
        : undefined) ??
      metaEmotionObj?.intensity;

    const intensity =
      typeof intensityRaw === "number" && Number.isFinite(intensityRaw)
        ? intensityRaw
        : typeof intensityRaw === "string"
          ? intensityRaw === "high"
            ? 1
            : intensityRaw === "medium"
              ? 0.66
              : intensityRaw === "low"
                ? 0.33
                : undefined
          : undefined;

    return {
      ok: true,
      replyText,

      // ✅ carry through parity fields if server provides them
      reflectionSeed: data?.reflectionSeed,
      followUp: typeof data?.followUp === "string" ? data.followUp : undefined,

      // ✅ IMPORTANT: keep the server meta so QA/UI can read meta.emotionLabel, meta.emotion.primary, etc.
      meta: data?.meta,

      // ✅ used by ChatScreen to show correct mood chip
      emotion,
      intensity,

      // ✅ explicit source + diagnostics
      analysisSource: "cloud",
      remoteUrl,
    };
  } catch (error: any) {
    debugWarn("Imotara mobile AI fetch error:", error);

    const remoteUrl = `${IMOTARA_API_BASE_URL}/api/respond`;
    const isTimeout =
      error?.name === "AbortError" ||
      String(error?.message ?? "")
        .toLowerCase()
        .includes("aborted");

    return {
      ok: false,
      replyText: "",
      errorMessage: isTimeout
        ? "Request timed out"
        : (error?.message ?? "Network error"),
      analysisSource: "cloud",
      remoteUrl,
      remoteError: isTimeout ? "timeout" : (error?.message ?? String(error)),
    };
  }
}

// ---------------------------------------------------------------------------
// Chat persistence (mobile ↔ web parity)
// Server: /api/chat/messages
// Identity: x-imotara-user (Option 1: server-side scoped user id)
// ---------------------------------------------------------------------------

export type RemoteChatMessage = {
  id: string;
  userScope: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type GetChatMessagesResponse = {
  messages: RemoteChatMessage[];
  serverTs?: number;
};

function buildChatMessagesUrl(params?: {
  threadId?: string;
  since?: number;
}): string {
  const base = `${IMOTARA_API_BASE_URL}/api/chat/messages`;
  const q = new URLSearchParams();

  if (params?.threadId) q.set("threadId", params.threadId);
  if (typeof params?.since === "number") q.set("since", String(params.since));

  // DEV-only cache-bypass to avoid stale CDN responses during deployments
  if (__DEV__) q.set("ts", String(Date.now()));

  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function fetchRemoteChatMessages(args: {
  userScope: string;
  threadId?: string;
  since?: number;
  accessToken?: string;
}): Promise<GetChatMessagesResponse> {
  const remoteUrl = buildChatMessagesUrl({
    threadId: args.threadId,
    since: args.since,
  });

  try {
    const res = await fetchWithTimeout(remoteUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(args.accessToken ? { Authorization: `Bearer ${args.accessToken}` } : { "x-imotara-user": args.userScope }),
      },
    }, 15_000);

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      debugWarn("[imotara] fetchRemoteChatMessages failed", {
        status: res.status,
        body: bodyText.slice(0, 200),
      });
      return { messages: [] };
    }

    const rawText = await res.text().catch(() => "");
    let data: any = null;

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      debugWarn("[imotara] fetchRemoteChatMessages: invalid JSON", {
        status: res.status,
        body: rawText.slice(0, 200),
      });
      return { messages: [] };
    }

    const messages = Array.isArray(data?.messages)
      ? (data.messages as RemoteChatMessage[])
      : [];
    return {
      messages,
      serverTs: typeof data?.serverTs === "number" ? data.serverTs : undefined,
    };
  } catch (err: any) {
    debugWarn("[imotara] fetchRemoteChatMessages error", err);
    return { messages: [] };
  }
}

export async function pushRemoteChatMessages(args: {
  userScope: string;
  accessToken?: string;
  messages: Array<{
    id: string;
    threadId: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
  }>;
}): Promise<{ ok: boolean; errorMessage?: string }> {
  const remoteUrl = `${IMOTARA_API_BASE_URL}/api/chat/messages`;

  try {
    const res = await fetchWithTimeout(remoteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(args.accessToken ? { Authorization: `Bearer ${args.accessToken}` } : { "x-imotara-user": args.userScope }),
      },
      body: JSON.stringify({ messages: args.messages }),
    }, 15_000);

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      debugWarn("[imotara] pushRemoteChatMessages failed", {
        status: res.status,
        body: bodyText.slice(0, 200),
      });
      return { ok: false, errorMessage: `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err: any) {
    debugWarn("[imotara] pushRemoteChatMessages error", err);
    return { ok: false, errorMessage: err?.message ?? "Network error" };
  }
}
