// src/api/aiClient.ts
//
// Small helper to call the Imotara AI backend from the mobile app.
// Returns a plain replyText + basic error info so ChatScreen can decide
// whether to fallback to local version.

import { IMOTARA_API_BASE_URL } from "../config/api";
import { debugLog, debugWarn } from "../config/debug";
import {
  BN_SAD_REGEX, BN_STRESS_REGEX, BN_ANGER_REGEX, BN_FEAR_REGEX,
  HI_SAD_REGEX, HI_STRESS_REGEX, HI_ANGER_REGEX, HI_FEAR_REGEX,
  TA_SAD_REGEX, TA_STRESS_REGEX, TA_ANGER_REGEX, TA_FEAR_REGEX,
  GU_SAD_REGEX, GU_STRESS_REGEX, GU_ANGER_REGEX, GU_FEAR_REGEX,
  KN_SAD_REGEX, KN_STRESS_REGEX, KN_ANGER_REGEX, KN_FEAR_REGEX,
  ML_SAD_REGEX, ML_STRESS_REGEX, ML_ANGER_REGEX, ML_FEAR_REGEX,
  PA_SAD_REGEX, PA_STRESS_REGEX, PA_ANGER_REGEX, PA_FEAR_REGEX,
  OR_SAD_REGEX, OR_STRESS_REGEX, OR_ANGER_REGEX, OR_FEAR_REGEX,
  MR_SAD_REGEX, MR_STRESS_REGEX, MR_ANGER_REGEX, MR_FEAR_REGEX,
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
} from "../lib/emotion/keywordMaps";
import {
  fetchWithTimeout,
  DEFAULT_REMOTE_TIMEOUT_MS,
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
    preferredLang?: SupportedLang;
    responseStyle?: ResponseStyle;
  };
  companion?: {
    enabled?: boolean;
    name?: string;

    // ✅ parity with web: ageTone preferred, ageRange legacy fallback
    ageTone?: ToneAgeRange;
    ageRange?: ToneAgeRange;

    gender?: ToneGender;
    relationship?: ToneRelationship;
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
function deriveToneForChatReply(
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
function detectLangFromScript(message: string): string {
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
  if (/[\u4E00-\u9FFF]/.test(message)) return "zh";        // Chinese
  if (/[\u3040-\u30FF]/.test(message)) return "ja";        // Japanese
  return "en";
}

/** Secondary language detection for Roman-script (transliterated) Indian languages.
 *  Called only when detectLangFromScript() returns "en" to avoid overriding native-script hits.
 *  Uses global flag to count all matches per regex, picks the highest-scoring language. */
function detectLangFromRomanHints(message: string): string {
  if (!message) return "en";
  const scores: Record<string, number> = {};
  const tally = (lang: string, regex: RegExp) => {
    const global = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
    const m = message.match(global);
    if (m) scores[lang] = (scores[lang] || 0) + m.length;
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
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  // Require at least 2 hits to avoid single-word English false positives triggering
  // a non-English language (e.g. one coincidental Gujarati/Hindi word match in an English message).
  return best && best[1] >= 2 ? best[0] : "en";
}

/** Detects explicit language-switch intent in a message.
 *  Only fires when a clear switch verb is present alongside a language name —
 *  bare language mentions ("I love Arabic poetry") will NOT match.
 *  Returns ISO code if found, otherwise null. Identical logic to web respondRemote.ts. */
function detectExplicitLangRequest(text: string): string | null {
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
    HI_STRESS_REGEX.test(raw) || BN_STRESS_REGEX.test(raw) ||
    TA_STRESS_REGEX.test(raw) || GU_STRESS_REGEX.test(raw) ||
    KN_STRESS_REGEX.test(raw) || ML_STRESS_REGEX.test(raw) ||
    PA_STRESS_REGEX.test(raw) || OR_STRESS_REGEX.test(raw) ||
    MR_STRESS_REGEX.test(raw)
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
      // Resolve language: explicit switch request > script/Roman detection > profile preference > "en"
      // Explicit wins so user can override a locked profile language mid-conversation.
      const _explicitLang = detectExplicitLangRequest(message);
      const _scriptLang = detectLangFromScript(message);
      const _detectedLang = _scriptLang !== "en" ? _scriptLang : detectLangFromRomanHints(message);
      const _profileLang =
        opts?.preferredLanguage ||
        (toneContext?.user?.preferredLang as string | undefined);
      const chatReplyLang =
        _explicitLang || (_detectedLang !== "en" ? _detectedLang : (_profileLang || "en"));

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
      };

      const chatRes = await fetchWithTimeout(
        chatReplyUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chatReplyPayload),
        },
        opts?.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS,
      );

      if (chatRes.ok) {
        const chatRawText = await chatRes.text().catch(() => "");
        let chatData: any = null;
        try { chatData = chatRawText ? JSON.parse(chatRawText) : {}; } catch { /* fall through */ }

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
        HI_STRESS_REGEX.test(raw) || BN_STRESS_REGEX.test(raw) ||
        TA_STRESS_REGEX.test(raw) || GU_STRESS_REGEX.test(raw) ||
        KN_STRESS_REGEX.test(raw) || ML_STRESS_REGEX.test(raw) ||
        PA_STRESS_REGEX.test(raw) || OR_STRESS_REGEX.test(raw) ||
        MR_STRESS_REGEX.test(raw)
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
    const res = await fetch(remoteUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(args.accessToken ? { Authorization: `Bearer ${args.accessToken}` } : { "x-imotara-user": args.userScope }),
      },
    });

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
    const res = await fetch(remoteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(args.accessToken ? { Authorization: `Bearer ${args.accessToken}` } : { "x-imotara-user": args.userScope }),
      },
      body: JSON.stringify({ messages: args.messages }),
    });

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
