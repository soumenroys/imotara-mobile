// src/screens/ChatScreen.tsx
import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Pressable,
  Animated,
  Vibration,
  Share,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  PanResponder,
} from "react-native";

// Haptic helpers (Vibration API — intensity read from AsyncStorage at runtime)
let _hapticIntensity: "off" | "light" | "strong" = "light";
const haptic = {
  tap: () => {
    if (_hapticIntensity === "off") return;
    try { Vibration.vibrate(_hapticIntensity === "strong" ? 20 : 10); } catch {}
  },
  receive: () => {
    if (_hapticIntensity === "off") return;
    try { Vibration.vibrate(_hapticIntensity === "strong" ? [0, 15, 60, 15] : [0, 8, 40, 8]); } catch {}
  },
  error: () => {
    if (_hapticIntensity === "off") return;
    try { Vibration.vibrate(_hapticIntensity === "strong" ? [0, 50, 80, 50] : [0, 30, 60, 30]); } catch {}
  },
};
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Image } from "react-native";
import { resolveAvatarImage } from "../assets/avatarImages";

import { useHistoryStore } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import { useColors, useTheme } from "../theme/ThemeContext";
import type { ColorPalette } from "../theme/colors";
import { callImotaraAI, streamChatReply } from "../api/aiClient";
import { useAuth } from "../auth/AuthContext";
import { SignInPrompt } from "../auth/SignInPrompt";
import { useVoiceInput } from "../hooks/useVoiceInput";
import {
    detectMemories,
    addMemory,
    loadMemories,
    buildMemoryContext,
    buildEmotionMemorySummary,
    type MemoryItem,
} from "../state/companionMemory";

import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { DEBUG_UI_ENABLED, debugLog, debugWarn } from "../config/debug";

// NEW: lifecycle hook (additive)
import { useAppLifecycle } from "../hooks/useAppLifecycle";
import { getConversationDepth } from "../lib/imotara/companionLetter";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getReflectionSeedCard } from "../lib/reflectionSeedContract";
import { BreathingModal } from "../components/imotara/BreathingModal";
import { ChatInputBar } from "../components/chat/ChatInputBar";
import { DiscoveryCard, DISCOVERY_CARDS_KEY, CARD_ORDER, getNextCard, type DiscoveryCardId } from "../components/chat/DiscoveryCard";
import { OpenLoopCard } from "../components/chat/OpenLoopCard";
import { CompanionInsightCard } from "../components/imotara/CompanionInsightCard";
import { UnsentLetterModal, buildUnsentLetterSystemPrompt, type UnsentLetterSetup } from "../components/imotara/UnsentLetterModal";
import UpgradeSheet from "../components/imotara/UpgradeSheet";
import {
  detectAndUpdateOpenLoops,
  dismissLoop,
  deferLoop,
  loadOpenLoops,
  getActiveLoop,
  getLoopPrompt,
  type OpenLoop,
} from "../lib/imotara/openLoops";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { savePendingInsight } from "../lib/pendingInsights";
import { ImotaraTypingIndicator } from "../components/imotara/ImotaraTypingIndicator";
import { Toast, type ToastHandle } from "../components/ui/Toast";
import { CompanionQuickPanel } from "../components/imotara/CompanionQuickPanel";
import { PlanSupportQuickPanel } from "../components/imotara/PlanSupportQuickPanel";
import { scheduleInactivityReminder } from "../notifications/checkInReminder";
import type { ReflectionSeed } from "../lib/reflectionSeedContract";
import {
  buildLocalReply,
  LOCAL_DEV_TEST_PROMPTS,
  type LocalRecentContext,
} from "../lib/ai/local/localReplyEngine";
import {
  BN_SAD_REGEX, BN_STRESS_REGEX, BN_ANGER_REGEX,
  HI_STRESS_REGEX,
  TA_SAD_REGEX, TA_STRESS_REGEX,
  GU_SAD_REGEX, GU_STRESS_REGEX,
  KN_SAD_REGEX, KN_STRESS_REGEX,
  ML_SAD_REGEX, ML_STRESS_REGEX,
  PA_SAD_REGEX, PA_STRESS_REGEX,
  OR_SAD_REGEX, OR_STRESS_REGEX, MR_SAD_REGEX, MR_STRESS_REGEX,
  GRATITUDE_REGEX,
  CONFUSED_EN_REGEX,
  CRISIS_HINT_REGEX,
  isConfusedText,
} from "../lib/emotion/keywordMaps";
import { getCrisisResourcesForCountry } from "../lib/safety/crisisResources";
import { detectCountryCode } from "../lib/safety/detectCountry";
import { detectAdultContent, buildAdultSafetyRefusal } from "../lib/safety/adultContentGuard";
import { speakMessage, stopSpeaking } from "../lib/tts/mobileTTS";
import { isEnabled as isFeatureEnabled } from "../licensing/featureGates";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Sentiment seed chips — quick-tap mood starters ────────────────────────────
const SENTIMENT_SEEDS_BY_LANG: Record<string, [string, string, string]> = {
  en: ["Feeling heavy", "Need to vent", "Just thinking out loud"],
  hi: ["मन भारी है", "मन की भड़ास निकालनी है", "बस सोच रहा/रही हूँ"],
  mr: ["मन जड आहे", "मन मोकळं करायचंय", "विचार करतोय/करतेय"],
  bn: ["মন ভারী", "মনের কথা বলতে চাই", "শুধু ভাবছি"],
  ta: ["மனம் கனமாக இருக்கிறது", "மனசு காலி செய்யணும்", "யோசிக்கிறேன்"],
  te: ["మనసు భారంగా ఉంది", "మనసు తేలిక చేసుకోవాలి", "ఆలోచిస్తున్నాను"],
  kn: ["ಮನಸ್ಸು ಭಾರ", "ಮನಸ್ಸು ಹಗುರ ಮಾಡಬೇಕು", "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ"],
  ml: ["മനസ്സ് ഭാരം", "മനസ്സ് ഒഴിക്കണം", "ആലോചിക്കുന്നു"],
  gu: ["મન ભારે છે", "મન ઠાળવવું છે", "વિચારી રહ્યો/રહી છું"],
  pa: ["ਮਨ ਭਾਰਾ ਹੈ", "ਮਨ ਹੌਲਾ ਕਰਨਾ ਹੈ", "ਸੋਚ ਰਿਹਾ/ਰਹੀ ਹਾਂ"],
  or: ["ମନ ଭାରୀ ଅଛି", "ମନ ହାଲୁକା କରିବାକୁ ଚାହୁଁଛି", "ଭାବୁଛି"],
  he: ["מרגיש כבד", "צריך להוציא את זה", "רק חושב בקול"],
  ar: ["أشعر بثقل", "أحتاج للتعبير", "أفكر بصوت عالٍ"],
  de: ["Fühle mich schwer", "Muss mal reden", "Denke laut nach"],
  ja: ["気持ちが重い", "話を聞いてほしい", "ただ考えを整理したい"],
};

// ── Weekly mood recap text ─────────────────────────────────────────────────────
function getWeeklyRecapText(topEmotion: string, count: number, lang: string): string {
  const RECAP: Record<string, (e: string, c: number) => string> = {
    en: (e, c) => `Last 7 days: "${e}" was your most frequent feeling (${c} times). Want to reflect on what's been driving it?`,
    hi: (e, c) => `पिछले 7 दिन: "${e}" सबसे ज़्यादा महसूस हुआ (${c} बार)। इसके पीछे क्या है, सोचना चाहेंगे?`,
    mr: (e, c) => `गेले 7 दिवस: "${e}" सर्वाधिक जाणवलं (${c} वेळा). यामागे काय आहे यावर विचार करायचा आहे का?`,
    bn: (e, c) => `গত ৭ দিন: "${e}" সবচেয়ে বেশি অনুভব হয়েছে (${c} বার)। এর পেছনে কী আছে ভাবতে চাও?`,
    ta: (e, c) => `கடந்த 7 நாட்கள்: "${e}" அதிகமாக உணர்ந்தீர்கள் (${c} முறை). இதற்கு பின்னால் என்ன என்று சிந்திக்க விரும்புகிறீர்களா?`,
    te: (e, c) => `గత 7 రోజులు: "${e}" అత్యధికంగా అనిపించింది (${c} సార్లు). దీని వెనక ఏముందో ఆలోచించాలనుకుంటున్నారా?`,
    kn: (e, c) => `ಕಳೆದ 7 ದಿನಗಳು: "${e}" ಅತ್ಯಧಿಕ ಅನಿಸಿತು (${c} ಬಾರಿ). ಇದರ ಹಿಂದೆ ಏನಿದೆ ಎಂದು ಯೋಚಿಸಬೇಕಾ?`,
    ml: (e, c) => `കഴിഞ്ഞ 7 ദിവസം: "${e}" ഏറ്റവും കൂടുതൽ (${c} തവണ). ഇതിന് പിന്നിൽ എന്തുണ്ടെന്ന് ചിന്തിക്കാൻ ആഗ്രഹിക്കുന്നോ?`,
    gu: (e, c) => `છેલ્લા 7 દિવસ: "${e}" સૌથી વધુ (${c} વખત). આ પાછળ શું છે, વિચારવું છે?`,
    pa: (e, c) => `ਪਿਛਲੇ 7 ਦਿਨ: "${e}" ਸਭ ਤੋਂ ਵੱਧ (${c} ਵਾਰ). ਇਸ ਪਿੱਛੇ ਕੀ ਹੈ, ਸੋਚਣਾ ਚਾਹੋਗੇ?`,
    or: (e, c) => `ଗତ 7 ଦିନ: "${e}" ସବୁଠୁ ଅଧିକ (${c} ଥର). ଏହା ପଛରେ କ'ଣ ଅଛି ଭାବିବାକୁ ଚାହୁଁଛନ୍ତି?`,
  };
  return (RECAP[lang] ?? RECAP.en)(topEmotion, count);
}

// ── 3-tier crisis detection ───────────────────────────────────────────────────
// Tier 2: direct suicidal ideation, self-harm, immediate danger
// Tier 1: hopelessness, worthlessness, trapped — distress without explicit ideation
// Tier 0: no crisis signal

const MOBILE_CRISIS_TIER2_RE = CRISIS_HINT_REGEX; // already covers EN + 13 languages

const MOBILE_CRISIS_TIER1_RE =
  /\b(hopeless|helpless|worthless|nothing matters|give up|can'?t take (it|this) anymore|breaking down|falling apart|no one cares|all alone|empty inside|numbing|disappear|feel like a burden|i'?m a burden|everyone (would be )?better off without me|trapped|feel(ing)? trapped|no way out|no escape|can'?t see a future|thinking about (death|ending|disappearing)|thoughts of (death|ending it)|pointless|life is pointless|don'?t deserve to (live|be here)|i\s+am\s+nothing)\b/i;

// Indic tier-1 distress (Unicode scripts)
const MOBILE_CRISIS_INDIC_TIER1_RE = new RegExp(
  ["उम्मीद नहीं","बेकार हूं","निराश हूं","थक गया","थक गई","सब बेकार है",
   "आशा नाही","निराश आहे","थकलोय",
   "আশা নেই","হতাশ","একা","কেউ নেই",
   "நம்பிக்கையில்லை","தனிமை","யாரும் இல்லை",
   "ఆశ లేదు","ఒంటరిగా","ఎవరూ లేరు",
   "ಆಶೆ ಇಲ್ಲ","ಒಂಟಿ","ಯಾರೂ ಇಲ್ಲ",
   "പ്രതീക്ഷ ഇല്ല","ഒറ്റയ്ക്ക്",
   "આશા નથી","એકલા",
   "ਉਮੀਦ ਨਹੀਂ","ਇਕੱਲਾ",
  ].join("|"),
);

// Romanised Indian distress tier-1
const MOBILE_CRISIS_ROMAN_INDIC_TIER1_RE =
  /umeed\s+nahi|bekaar\s+hoon|nirash\s+hoon|thak\s+gay[ao]|asha\s+nahi|akela\s+hoon|akeli\s+hoon/i;

type CrisisTier = 0 | 1 | 2;

function detectMobileCrisisTier(text: string): CrisisTier {
  if (MOBILE_CRISIS_TIER2_RE.test(text)) return 2;
  if (
    MOBILE_CRISIS_TIER1_RE.test(text) ||
    MOBILE_CRISIS_INDIC_TIER1_RE.test(text) ||
    MOBILE_CRISIS_ROMAN_INDIC_TIER1_RE.test(text)
  ) return 1;
  return 0;
}

type ChatMessageSource = "cloud" | "local";

// Typing animation states for Imotara mobile chat
type TypingStatus = "idle" | "thinking" | "responding";

type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
  timestamp: number;
  moodHint?: string;
  isSynced?: boolean;
  source?: ChatMessageSource;
  isPending?: boolean; // for "Syncing…" state

  // ✅ NEW: parity metadata (from /api/respond)
  reflectionSeed?: ReflectionSeed;
  followUp?: string;

  // ✅ NEW: cloud attempt diagnostics (additive)
  cloudAttempted?: boolean;
  remoteUrl?: string;
  remoteStatus?: number;
  remoteError?: string;

  // ✅ Debug/diagnostics metadata (optional; report-only)
  meta?: {
    compatibility?: any;
  };
  isQuotaNotice?: boolean;
};

// Phase 2.2.2 — local followUp de-dupe (best-effort, avoids immediate repeats)
const __lastLocalFollowUp = new Map<string, { text: string; ts: number }>();

function varyLocalFollowUpIfRepeated(params: {
  cacheKey: string;
  followUp: string;
  lowerUserMsg: string;
}): string {
  const { cacheKey, followUp, lowerUserMsg } = params;

  const normalize = (s: string) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const now = Date.now();
  const last = __lastLocalFollowUp.get(cacheKey);
  const isFresh = last && now - last.ts < 60_000; // 60s
  const isRepeat = Boolean(
    isFresh && normalize(last.text) === normalize(followUp),
  );

  if (!isRepeat) {
    __lastLocalFollowUp.set(cacheKey, { text: followUp, ts: now });
    return followUp;
  }

  // intent-aware alternates (one question only)
  const isLonely = /\b(lonely|alone|isolated|unseen|ignored)\b/.test(
    lowerUserMsg,
  );
  const isOverwhelm =
    /\b(overwhelm|overwhelmed|pressure|too much|piling up|burnt out|burned out|can['']t focus|distract)\b/.test(
      lowerUserMsg,
    );
  const isDecision =
    /\b(choose|choosing|decide|decision|torn|stuck( choosing)? between|options?)\b/.test(
      lowerUserMsg,
    );

  const alternates = isLonely
    ? [
        "When does it hit hardest — evenings, weekends, or even around people?",
        "Do you feel like you're missing someone specific, or more a general sense of disconnection?",
        "What would feel like a tiny bit of support today — a message, a call, or just being heard?",
      ]
    : isOverwhelm
      ? [
          "If we shrink it to one thing, what feels most urgent?",
          "What's heaviest right now — time, energy, or expectations?",
          "Do you want to vent first, or pick one tiny next step together?",
        ]
      : isDecision
        ? [
            "Which option gives you more peace a week from now?",
            "If you chose based on one value, what would it be?",
            "What's the cost of waiting vs choosing now?",
          ]
        : [
            "What would help most right now — comfort, clarity, or a practical next step?",
            "Where do you feel this most — thoughts, body, or situation?",
            "Do you want to talk it through, or choose one small action together?",
          ];

  const pick =
    alternates.find((a) => !last || normalize(a) !== normalize(last.text)) ??
    alternates[0];
  __lastLocalFollowUp.set(cacheKey, { text: pick, ts: now });
  return pick;
}

function stripReflectionSeedPromptFromMessage(
  message: string,
  prompt?: string,
) {
  const normalize = (s: string) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const pNorm = normalize(prompt ?? "");
  if (!pNorm) return message;

  // Matches "Want comfort, clarity, or a next step?" even if prefixed by bullets/emojis/dashes
  const wantLine =
    /^\s*(?:[-*•–—]|👉|➡️|→)?\s*want\s+(comfort|clarity|a\s+next\s+step)\b/i;

  let out = String(message ?? "");

  // 1) Remove standalone line if it equals the prompt OR matches the wantLine pattern
  out = out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      const lNorm = normalize(l);
      if (!lNorm) return false;
      if (lNorm === pNorm) return false;
      if (wantLine.test(l)) return false;
      return true;
    })
    .join("\n")
    .trim();

  // 2) Best-effort inline cleanup (if the prompt appears mid-paragraph)
  out = out
    .replace(/\bwant\s+comfort,\s*clarity,\s*or\s+a\s+next\s+step\??/gi, "")
    .replace(/\s+\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}

/** ---------- Color helpers (robust with hex/rgb/rgba) ---------- */
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace("#", "").trim();
  if (![3, 6].includes(cleaned.length)) return null;

  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;

  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function toRgba(color: string, alpha: number): string {
  const a = clamp01(alpha);
  const c = (color || "").trim();

  // rgba()
  if (c.startsWith("rgba(")) {
    const inside = c.slice(5, -1); // "r,g,b,a"
    const parts = inside.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const r = parts[0];
      const g = parts[1];
      const b = parts[2];
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return c;
  }

  // rgb()
  if (c.startsWith("rgb(")) {
    const inside = c.slice(4, -1); // "r,g,b"
    return `rgba(${inside}, ${a})`;
  }

  // hex
  if (c.startsWith("#")) {
    const rgb = hexToRgb(c);
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
    return `rgba(148, 163, 184, ${a})`;
  }

  if (c === "transparent") return "transparent";
  return `rgba(148, 163, 184, ${a})`;
}

// Create a very subtle gradient from the mood tint — a gentle wash, not a saturated fill
function getMoodGradient(baseColor: string) {
  return {
    start: toRgba(baseColor, 0.12),
    end: toRgba(baseColor, 0.26),
  };
}

function getMoodHintFromEmotionPrimary(primary?: string): string | undefined {
  const p = (primary ?? "").trim().toLowerCase();
  if (!p) return undefined;

  // These strings are intentionally aligned with:
  // - getMoodEmojiForHint()
  // - getMoodTintForHint()
  if (p === "confused") return "stuck/unsure";
  if (p === "stressed" || p === "anxious" || p === "anxiety")
    return "tense/worried";
  if (p === "sad" || p === "sadness") return "low";
  if (p === "angry" || p === "anger") return "upset/frustrated";
  if (p === "hope" || p === "hopeful") return "light/hope";

  return undefined;
}

// Local mood hint → emoji
function getMoodEmojiForHint(hint?: string): string {
  if (!hint) return "";
  const text = hint.toLowerCase();

  if (text.includes("low")) return " 💙";
  if (text.includes("tense") || text.includes("worried")) return " 💛";
  if (text.includes("upset") || text.includes("frustrated")) return " ❤️";
  if (text.includes("stuck") || text.includes("unsure")) return " 🟣";
  if (text.includes("light") || text.includes("hope")) return " 💚";

  return " ⚪️";
}

// moodHint → bubbleTint mapping
function getMoodTintForHint(hint: string | undefined, colors: ColorPalette): string {
  if (!hint) return colors.emotionNeutral;
  const text = hint.toLowerCase();

  if (text.includes("low")) return colors.emotionSad;
  if (text.includes("tense") || text.includes("worried"))
    return colors.emotionAnxious;
  if (text.includes("upset") || text.includes("frustrated"))
    return colors.emotionAngry;
  if (text.includes("stuck") || text.includes("unsure"))
    return colors.emotionConfused;

  // ✅ NEW: joy/happy/playful should tint green
  if (
    text.includes("joy") ||
    text.includes("playful") ||
    text.includes("playfulness") ||
    text.includes("happy")
  ) {
    return colors.emotionHopeful;
  }

  if (text.includes("light") || text.includes("hope"))
    return colors.emotionHopeful;

  return colors.emotionNeutral;
}

function getLocalMoodHint(text: string): string {
  const raw = String(text ?? "");
  const lower = raw.toLowerCase();

  // ✅ NEW: emoji-based mood inference (additive)
  // Keep the returned hint strings consistent with existing tint logic:
  // - "low" → sad tint
  // - "tense/worried" → anxious tint
  // - "upset/frustrated" → angry tint
  // - "stuck/unsure" → confused tint
  // - "light/hope" → hopeful tint
  const emojiHappy = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😊",
    "🙂",
    "☺️",
    "😍",
    "🥰",
    "😎",
    "🥳",
    "🎉",
    "✨",

    // ✅ laughter / joy (fixes prompt #6: 😂😂😂)
    "😂",
    "🤣",

    "💚",
    "💙",
    "💛",
    "❤️",
    "🙌",
    "👏",
  ];

  const emojiSad = ["😢", "😭", "😞", "😔", "😟", "🙁", "☹️", "💔", "🥺"];
  const emojiAnxious = ["😰", "😨", "😱", "😬", "😮‍💨", "🫠"];
  const emojiAngry = ["😡", "😠", "🤬", "👿"];
  const emojiStuck = ["🤔", "😕", "😵‍💫", "😶‍🌫️", "🫤"];

  const containsEmoji = (arr: string[]) => arr.some((e) => raw.includes(e));

  // If message is emoji-heavy / emoji-only, infer mood early.
  // (We still allow word-based rules below to override for mixed messages.)
  const emojiSignals = {
    sad: containsEmoji(emojiSad),
    anxious: containsEmoji(emojiAnxious),
    angry: containsEmoji(emojiAngry),
    stuck: containsEmoji(emojiStuck),
    happy: containsEmoji(emojiHappy),
  };

  // Multilingual mood inference via keywordMaps regexes
  if (isConfusedText(raw) || CONFUSED_EN_REGEX.test(lower) ||
      /\b(stuck|lost|confused|don't know|dont know|no idea|numb|not sure what to do)\b/.test(lower)) {
    return "You sound a bit stuck or unsure. It's okay to take time to untangle things.";
  }
  if (
    BN_SAD_REGEX.test(raw) || TA_SAD_REGEX.test(raw) ||
    GU_SAD_REGEX.test(raw) || KN_SAD_REGEX.test(raw) ||
    ML_SAD_REGEX.test(raw) || PA_SAD_REGEX.test(raw) ||
    OR_SAD_REGEX.test(raw) || MR_SAD_REGEX.test(raw) ||
    /\b(sad|down|lonely|tired|upset|hurt|empty|depressed|blue|cry|crying|hopeless)\b/.test(lower)
  ) {
    return "You seem a bit low. It's okay to feel this way — Imotara is here with you.";
  }
  if (
    HI_STRESS_REGEX.test(raw) || BN_STRESS_REGEX.test(raw) ||
    TA_STRESS_REGEX.test(raw) || GU_STRESS_REGEX.test(raw) ||
    KN_STRESS_REGEX.test(raw) || ML_STRESS_REGEX.test(raw) ||
    PA_STRESS_REGEX.test(raw) || MR_STRESS_REGEX.test(raw) ||
    /\b(worry|worried|anxious|scared|panic|nervous|stressed|overwhelmed|afraid|fear)\b/.test(lower)
  ) {
    return "It sounds like something is making you feel tense or worried.";
  }
  if (
    BN_ANGER_REGEX.test(raw) ||
    /\b(angry|mad|frustrated|annoyed|irritated|furious|rage|hate)\b/.test(lower)
  ) {
    return "It sounds like something has really upset or frustrated you.";
  }
  if (
    GRATITUDE_REGEX.test(raw) ||
    /\b(hope|hopeful|excited|looking forward|grateful|thankful|relieved|better|good mood|feeling good|happy|joyful|cheerful)\b/.test(lower)
  ) {
    return "I can sense a little bit of light or hope in what you're saying.";
  }

  // ✅ If no word match, fall back to emoji signals (NEW)
  if (emojiSignals.sad) {
    return "You seem a bit low. It's okay to feel this way — Imotara is here with you.";
  }
  if (emojiSignals.anxious) {
    return "It sounds like something is making you feel tense or worried.";
  }
  if (emojiSignals.angry) {
    return "It sounds like something has really upset or frustrated you.";
  }
  if (emojiSignals.stuck) {
    return "You sound a bit stuck or unsure. It's okay to take time to untangle things.";
  }
  if (emojiSignals.happy) {
    return "I can sense a little bit of light or hope in what you're saying.";
  }

  return "I'm listening closely. However you're feeling, it matters here.";
}

// ✅ Additive: same logic, but returns a stable primary label + hint.
// Does NOT replace getLocalMoodHint(); existing callers remain untouched.
function getLocalMoodHintWithPrimary(text: string): {
  primary?: string;
  hint: string;
} {
  const t = text.trim().toLowerCase();

  // ✅ NEW: emoji-only joy detection (so 😂😂😂 becomes "joy", not "hopeful"/neutral)
  const raw = String(text ?? "").trim();
  const emojiOnly =
    raw.length > 0 && !/[a-z0-9\u0900-\u097F\u0980-\u09FF]/i.test(raw);

  if (emojiOnly) {
    // 😂 😄 😆 🤣 😀 😃 😁 😊
    if (
      /[\u{1F602}\u{1F604}\u{1F606}\u{1F923}\u{1F600}\u{1F603}\u{1F601}\u{1F60A}]/u.test(
        raw,
      )
    ) {
      return {
        primary: "joy",
        hint: "I can sense some joy or playfulness in what you're sharing.",
      };
    }
  }

  // mirrored buckets from getLocalMoodHint (keep in sync; multilingual regex-based)
  // Confused first (overlaps with sad in some languages)
  if (
    isConfusedText(raw) ||
    CONFUSED_EN_REGEX.test(t) ||
    /\b(stuck|lost|confused|don't know|dont know|no idea|numb|not sure)\b/.test(t)
  ) {
    return {
      primary: "confused",
      hint: "You sound a bit stuck or unsure. It's okay to take time to untangle things.",
    };
  }

  // Sad — 10 Indian languages
  if (
    BN_SAD_REGEX.test(raw) ||
    TA_SAD_REGEX.test(raw) ||
    GU_SAD_REGEX.test(raw) ||
    KN_SAD_REGEX.test(raw) ||
    ML_SAD_REGEX.test(raw) ||
    PA_SAD_REGEX.test(raw) ||
    OR_SAD_REGEX.test(raw) ||
    MR_SAD_REGEX.test(raw) ||
    /\b(sad|lonely|hopeless|empty|down|depressed|cry|miserable)\b/.test(t)
  ) {
    return {
      primary: "sadness",
      hint: "You seem a bit low. It's okay to feel this way — Imotara is here with you.",
    };
  }

  // Stressed / anxious — 10 Indian languages
  if (
    HI_STRESS_REGEX.test(raw) ||
    BN_STRESS_REGEX.test(raw) ||
    TA_STRESS_REGEX.test(raw) ||
    GU_STRESS_REGEX.test(raw) ||
    KN_STRESS_REGEX.test(raw) ||
    ML_STRESS_REGEX.test(raw) ||
    PA_STRESS_REGEX.test(raw) ||
    OR_STRESS_REGEX.test(raw) ||
    MR_STRESS_REGEX.test(raw) ||
    /\b(anxious|anxiety|panic|panicking|scared|fear|worried|worry|nervous|tense|stress|stressed)\b/.test(t)
  ) {
    return {
      primary: "stressed",
      hint: "It sounds like something is making you feel tense or worried.",
    };
  }

  // Angry — multilingual
  if (
    BN_ANGER_REGEX.test(raw) ||
    /\b(angry|anger|furious|mad|irritated|annoyed|rage|frustrated)\b/.test(t)
  ) {
    return {
      primary: "anger",
      hint: "It sounds like something has really upset or frustrated you.",
    };
  }

  // Hopeful / grateful — multilingual
  if (
    GRATITUDE_REGEX.test(raw) ||
    /\b(hope|hopeful|better|improving|relieved|grateful|happy|joy|excited)\b/.test(t)
  ) {
    return {
      primary: "hopeful",
      hint: "I can sense a little bit of light or hope in what you're saying.",
    };
  }

  return {
    primary: undefined,
    hint: "I'm listening closely. However you're feeling, it matters here.",
  };
}

// ✅ Additive: local default intensity (used only for history persistence; no UI behavior change)
function getDefaultIntensityForPrimary(primary?: string): number | undefined {
  const p = typeof primary === "string" ? primary.trim().toLowerCase() : "";
  if (!p) return undefined;

  if (p === "confused") return 0.6;
  if (p === "stressed") return 0.75;
  if (p === "sadness") return 0.7;
  if (p === "anger") return 0.7;
  if (p === "hopeful") return 0.55;
  if (p === "joy") return 0.55;

  return undefined;
}

// ✅ DEV-ONLY QA helper (debug gated)
// Allows quick replay of prompts 1–10 and logs mismatches.
// This is DEV-only and does not change chat behavior.
type DevQaCase = { id: number; prompt: string; expected: string };

const DEV_QA_CASES: DevQaCase[] = [
  {
    id: 1,
    prompt: "I can't focus today. Work is piling up.",
    expected: "confused",
  },
  { id: 2, prompt: "😂😂😂", expected: "joy" },
  { id: 3, prompt: "👍", expected: "neutral" },
  { id: 4, prompt: "আমি খুব মন খারাপ করছি", expected: "sad" },
  { id: 5, prompt: "मैं बहुत परेशान हूँ", expected: "stressed" },
  { id: 6, prompt: "I feel lonely and down", expected: "sad" },
  { id: 7, prompt: "I'm stressed and worried", expected: "stressed" },
  { id: 8, prompt: "I'm so frustrated right now", expected: "angry" },
  { id: 9, prompt: "Not sure what to do…", expected: "confused" },
  { id: 10, prompt: "I feel hopeful today ✨", expected: "hopeful" },
  { id: 11, prompt: "I cannot focus today", expected: "confused" },
];

// ✅ DEV-only: last QA report buffer (for "Copy QA Report")
let DEV_QA_LAST_REPORT = "";

function devQaCategoryFromMoodHint(moodHint: string | undefined): string {
  const h = String(moodHint ?? "").toLowerCase();
  if (h.includes("low")) return "sad";
  if (h.includes("tense") || h.includes("worried")) return "stressed";
  if (h.includes("upset") || h.includes("frustrated")) return "angry";
  if (h.includes("stuck") || h.includes("unsure")) return "confused";
  if (h.includes("light") || h.includes("hope")) return "hopeful";
  return "neutral";
}

function devQaDetectEmotion(prompt: string): string {
  const raw = String(prompt ?? "");

  // Mirror agreed parity rules for emoji cases (DEV-only; no production impact)
  if (raw.includes("😂") || raw.includes("🤣")) return "joy";
  if (raw.includes("👍")) return "neutral";

  const hint = getLocalMoodHint(raw);
  return devQaCategoryFromMoodHint(hint);
}

type DevQaRunOptions = {
  cloudProbe?: (prompt: string) => Promise<string | undefined>;
  cancelRef?: { current: boolean };
};

async function runDevQaSuite(options: DevQaRunOptions = {}): Promise<void> {
  const lines: string[] = [];
  const logLine = (line: string) => {
    lines.push(line);
    debugLog(line);
  };

  logLine("— IMOTARA DEV QA SUITE (mobile) —");

  let localPass = 0;
  const localFailed: number[] = [];

  const localVsCloudMismatch: number[] = [];
  const cloudFailed: number[] = [];

  for (const tc of DEV_QA_CASES) {
    const localDetected = devQaDetectEmotion(tc.prompt);
    const localOk = localDetected === tc.expected;

    if (localOk) localPass += 1;
    else localFailed.push(tc.id);

    let cloudDetected: string | undefined;
    if (options.cloudProbe) {
      cloudDetected = await options.cloudProbe(tc.prompt);
      if (cloudDetected && cloudDetected !== localDetected) {
        localVsCloudMismatch.push(tc.id);
      }
      if (cloudDetected && cloudDetected !== tc.expected) {
        cloudFailed.push(tc.id);
      }
    }

    const cloudTag = options.cloudProbe
      ? ` cloud=${cloudDetected ?? "unknown"}`
      : "";
    const cloudMark =
      options.cloudProbe && cloudDetected
        ? cloudDetected === tc.expected
          ? " ☁️✅"
          : " ☁️❌"
        : options.cloudProbe
          ? " ☁️?"
          : "";

    logLine(
      `[QA][${tc.id}] ${localOk ? "✅" : "❌"} expected=${tc.expected} local=${localDetected}${cloudTag}${cloudMark} :: "${tc.prompt}"`,
    );
  }

  const total = DEV_QA_CASES.length;
  const localFail = total - localPass;

  logLine(
    `— IMOTARA DEV QA SUMMARY — total=${total} localPass=${localPass} localFail=${localFail}${
      localFail ? ` localFailedIds=[${localFailed.join(", ")}]` : ""
    }`,
  );

  if (options.cloudProbe) {
    logLine(
      `— IMOTARA DEV QA CLOUD SUMMARY — cloudCompared=${total} cloudFailed=${cloudFailed.length}${
        cloudFailed.length ? ` cloudFailedIds=[${cloudFailed.join(", ")}]` : ""
      }${localVsCloudMismatch.length ? ` localVsCloudMismatchIds=[${localVsCloudMismatch.join(", ")}]` : ""}`,
    );
  }

  // ✅ DEV-only: persist last report for clipboard copy
  DEV_QA_LAST_REPORT = lines.join("\n");
}

// ✅ DEV-only: cloud-only runner (compact summary)
// This does NOT change production behavior; it only helps quick parity checks.
async function runDevQaCloudOnly(options: DevQaRunOptions = {}): Promise<void> {
  const lines: string[] = [];
  const logLine = (line: string) => {
    lines.push(line);
    debugLog(line);
  };

  logLine("— IMOTARA DEV QA CLOUD-ONLY (mobile) —");

  if (!options.cloudProbe) {
    logLine("[QA][cloud-only] ❌ No cloudProbe provided.");
    DEV_QA_LAST_REPORT = lines.join("\n");
    return;
  }

  let pass = 0;
  const failed: number[] = [];

  for (const tc of DEV_QA_CASES) {
    if (options.cancelRef?.current) {
      logLine("— IMOTARA DEV QA CLOUD-ONLY CANCELLED —");
      DEV_QA_LAST_REPORT = lines.join("\n");
      return;
    }

    const cloudDetected = await options.cloudProbe(tc.prompt);
    const ok = cloudDetected === tc.expected;

    if (ok) pass += 1;
    else failed.push(tc.id);

    logLine(
      `[QA-CLOUD][${tc.id}] ${ok ? "✅" : "❌"} expected=${tc.expected} cloud=${cloudDetected ?? "unknown"} :: "${tc.prompt}"`,
    );
  }

  const total = DEV_QA_CASES.length;
  const fail = total - pass;

  logLine(
    `— IMOTARA DEV QA CLOUD-ONLY SUMMARY — total=${total} pass=${pass} fail=${fail}${fail ? ` failedIds=[${failed.join(", ")}]` : ""}`,
  );

  // ✅ DEV-only: persist last report for clipboard copy
  DEV_QA_LAST_REPORT = lines.join("\n");
}

// ✅ UI helper — if a reflection prompt is already shown in the Reflection seed card,
// remove the same prompt line from the message body to avoid duplication.
function stripReflectionPromptFromMessage(
  messageText: string,
  prompt?: string,
): string {
  const text = String(messageText ?? "");
  const pRaw = String(prompt ?? "").trim();
  if (!pRaw) return text;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, " ")
      .trim();

  const p = normalize(pRaw);
  const lines = text.split("\n"); // IMPORTANT: keep original blank lines

  const kept = lines.filter((line) => {
    const trimmed = String(line ?? "").trim();
    if (!trimmed) return true; // keep blank lines (preserve formatting)

    const n = normalize(trimmed);

    const isExactPrompt = n === p;

    // Covers: "Want comfort, clarity, or a next step?" and slight variants
    const isGenericPrompt = /^want\s+(comfort|clarity|a\s+next\s+step)\b/.test(
      n,
    );

    return !(isExactPrompt || isGenericPrompt);
  });

  // Re-join preserving blank lines, then do best-effort inline cleanup too
  let out = kept.join("\n");

  out = out
    .replace(/\bwant\s+comfort,\s*clarity,\s*or\s+a\s+next\s+step\??/gi, "")
    .replace(/\s+\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out || text;
}

const USER_BUBBLE_BG = "rgba(56, 189, 248, 0.35)";
const SESSION_GAP_MS = 45 * 60 * 1000;

function smoothScrollToBottom(ref: React.RefObject<FlatList | null>) {
  setTimeout(() => {
    ref.current?.scrollToEnd({ animated: true });
  }, 30);
}

/**
 * ✅ Hook-safe helper:
 * Return true if this bot message is the first bot reply of a session.
 */
function isFirstBotReplyOfSession(
  message: ChatMessage,
  prevMessage: ChatMessage | null,
  prevPrevMessage: ChatMessage | null,
  isFirstInList: boolean,
): boolean {
  if (message.from !== "bot") return false;

  if (!prevMessage || prevMessage.from !== "user") return false;

  if (isFirstInList) return true;

  if (!prevPrevMessage) return true;

  const gap = prevMessage.timestamp - (prevPrevMessage.timestamp ?? 0);
  return gap > SESSION_GAP_MS;
}

// ── MessageBubble component ─────────────────────────────────────────────────────
type MessageBubbleProps = {
  message: ChatMessage;
  prevMessage: ChatMessage | null;
  prevPrevMessage: ChatMessage | null;
  colors: ColorPalette;
  searchMatchIds: Set<string>;
  searchActiveMatchId: string | null;
  bookmarks: Set<string>;
  lastSyncStatus: string | null;
  dismissedCrisisCards: Set<string>;
  reactions: Map<string, string>;
  speakingMessageId: string | null;
  preparingSpeechId: string | null;
  companionAvatarSource?: any;
  companionName?: string;
  showTimestamps?: boolean;
  reactionsSet?: "default" | "minimal" | "extended";
  crisisThreshold?: "sensitive" | "standard" | "conservative";
  showSyncBadge?: boolean;
  onLongPress: (msg: ChatMessage) => void;
  onDismissCrisisCard: (id: string) => void;
  onRetry: (messageId: string, prevUserText: string) => void;
  onCopy: (text: string) => void;
  onSpeak: (id: string, text: string) => void;
  onStopSpeak: () => void;
  onBookmark: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
};

function MessageBubble({
  message,
  prevMessage,
  prevPrevMessage,
  colors,
  searchMatchIds,
  searchActiveMatchId,
  bookmarks,
  lastSyncStatus,
  dismissedCrisisCards,
  reactions,
  speakingMessageId,
  preparingSpeechId,
  companionAvatarSource,
  companionName,
  showTimestamps = false,
  showSyncBadge = false,
  reactionsSet = "default",
  crisisThreshold = "standard",
  onLongPress,
  onDismissCrisisCard,
  onRetry,
  onCopy,
  onSpeak,
  onStopSpeak,
  onBookmark,
  onReact,
}: MessageBubbleProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [reactionPickerOpen, setReactionPickerOpen] = React.useState(false);
  const isUser = message.from === "user";
  const isSearchMatch = searchMatchIds.has(message.id);
  const isActiveMatch = searchActiveMatchId === message.id;
  const isBookmarked = bookmarks.has(message.id);
  const showContinuityNote = isFirstBotReplyOfSession(message, prevMessage, prevPrevMessage, prevMessage === null);

  let bubbleBorderColor: string;
  let statusLabel: string;
  let statusBg: string;
  let statusTextColor: string;

  const bubbleBackground = USER_BUBBLE_BG;
  let gradientStart: string | null = null;
  let gradientEnd: string | null = null;

  if (!isUser) {
    // Only tint from explicit moodHint metadata — never from raw response text,
    // which triggers false positives (e.g. "stuck in a loop" → confused purple).
    const tint = getMoodTintForHint(message.moodHint, colors);
    const gradient = getMoodGradient(tint);
    gradientStart = gradient.start;
    gradientEnd = gradient.end;
  }

  const isGreeting = message.id.startsWith("greeting-");

  if (isGreeting) {
    bubbleBorderColor = "rgba(99, 102, 241, 0.25)";
    statusLabel = "";
    statusBg = "transparent";
    statusTextColor = "transparent";
  } else if (message.isPending) {
    bubbleBorderColor = "rgba(148, 163, 184, 0.55)";
    statusLabel = "Syncing…";
    statusBg = "rgba(148, 163, 184, 0.18)";
    statusTextColor = colors.textSecondary;
  } else if (message.isSynced) {
    bubbleBorderColor = colors.primary;
    statusLabel = "Saved to account";
    statusBg = "rgba(56, 189, 248, 0.18)";
    statusTextColor = colors.textPrimary;
  } else {
    const lower = (lastSyncStatus || "").toLowerCase();
    const hasSyncError = lower.includes("failed") || lower.includes("error");
    const isCloudGenerated = message.source === "cloud";

    if (hasSyncError) {
      bubbleBorderColor = "#f97373";
      statusLabel = isCloudGenerated
        ? "Connection issue · cloud reply"
        : "Connection issue · on this device only";
      statusBg = "rgba(248, 113, 113, 0.24)";
      statusTextColor = "#fecaca";
    } else {
      if (isCloudGenerated) {
        bubbleBorderColor = "rgba(56, 189, 248, 0.55)";
        statusLabel = "Online";
        statusBg = "rgba(56, 189, 248, 0.14)";
        statusTextColor = colors.textPrimary;
      } else if (!isUser && message.cloudAttempted) {
        bubbleBorderColor = "#fbbf24";
        statusLabel = "Offline mode";
        statusBg = "rgba(251, 191, 36, 0.18)";
        statusTextColor = "#fde68a";
      } else {
        bubbleBorderColor = "#fca5a5";
        statusLabel = "On this device only";
        statusBg = "rgba(248, 113, 113, 0.18)";
        statusTextColor = "#fecaca";
      }
    }
  }

  const prev = prevMessage;
  const extraTopSpace =
    isUser && prevMessage?.from === "user"
      ? { marginTop: 4 }
      : {};

  // Session divider
  const sessionDivider = (() => {
    if (!prev) return null;
    const gap = message.timestamp - (prev.timestamp ?? 0);
    if (gap <= SESSION_GAP_MS) return null;
    return (
      <View style={{ alignSelf: "center", marginVertical: 6, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.5, marginRight: 8 }} />
        <Text style={{ fontSize: 11, color: colors.textSecondary }}>New session</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.5, marginLeft: 8 }} />
      </View>
    );
  })();

  const bubbleContent = (
    <>
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textPrimary, opacity: 0.75, marginBottom: 2 }}>
        {isUser ? "You" : `${companionName || "Imotara"}${message.source === "local" ? " (offline)" : ""}`}
      </Text>

      {!isUser
        ? (() => {
            const seed = getReflectionSeedCard({
              message: message.text,
              reflectionSeed: message.reflectionSeed,
            } as any);
            if (!seed) return null;
            return (
              <View style={{ marginBottom: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>{seed.title}</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>{seed.label}</Text>
                  </View>
                </View>
                <Text style={{ marginTop: 4, fontSize: 12, color: colors.textPrimary, opacity: 0.92 }}>{seed.prompt}</Text>
              </View>
            );
          })()
        : null}

      <Text style={{ fontSize: 14, color: colors.textPrimary }} selectable>
        {(() => {
          if (isUser) return message.text;
          const seed = getReflectionSeedCard({ message: message.text, reflectionSeed: message.reflectionSeed } as any);
          if (!seed?.prompt) return message.text;
          return stripReflectionPromptFromMessage(message.text, seed.prompt);
        })()}
      </Text>

      {!isUser && typeof message.followUp === "string" && message.followUp.trim() ? (
        <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 8, opacity: 0.92 }}>
          {message.followUp.trim()}
        </Text>
      ) : null}

      {showTimestamps && (
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, opacity: 0.85 }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </Text>
      )}

      {DEBUG_UI_ENABLED && message.meta?.compatibility && (
        <View style={{
          alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1,
          borderColor: message.meta.compatibility.ok === true ? "rgba(34,197,94,0.6)" : "rgba(248,113,113,0.6)",
          backgroundColor: message.meta.compatibility.ok === true ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)",
        }}>
          <Text style={{ fontSize: 10, fontWeight: "500", color: colors.textPrimary }}>
            {typeof message.meta.compatibility.summary === "string"
              ? message.meta.compatibility.summary
              : message.meta.compatibility.ok === true ? "OK" : "Issues"}
          </Text>
        </View>
      )}

      {isUser && showSyncBadge && (
        <View style={{
          alignSelf: "flex-end",
          marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
          borderColor: bubbleBorderColor === "transparent" ? "rgba(148, 163, 184, 0.4)" : bubbleBorderColor,
          backgroundColor: statusBg,
        }}>
          <Text style={{ fontSize: 10, fontWeight: "500", color: statusTextColor }}>{statusLabel}</Text>
        </View>
      )}

      {!isUser && message.cloudAttempted && message.source === "local" && (
        <TouchableOpacity
          onPress={() => {
            if (prevMessage?.from !== "user") return;
            onRetry(message.id, prevMessage.text);
          }}
          style={{ alignSelf: "flex-start", marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.08)" }}
        >
          <Text style={{ fontSize: 10, color: "#fde68a", fontWeight: "600" }}>↺ Retry with cloud</Text>
        </TouchableOpacity>
      )}

      {!isUser && showContinuityNote && (
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 6, opacity: 0.9 }}>
          This conversation is now part of your Emotion History.
        </Text>
      )}
    </>
  );

  return (
    <View
      key={message.id}
      style={[
        extraTopSpace,
        isSearchMatch ? { borderRadius: 14, backgroundColor: isActiveMatch ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.05)" } : undefined,
        isBookmarked ? { borderRadius: 14, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)" } : undefined,
      ]}
    >
      {sessionDivider}
      {/* UX-2 — avatar row wrapper for bot messages */}
      <View style={!isUser ? { flexDirection: "row", alignItems: "flex-start", gap: 6 } : undefined}>
        {!isUser && (
          companionAvatarSource
            ? <Image source={companionAvatarSource} style={{ width: 26, height: 26, borderRadius: 13, marginTop: 4, flexShrink: 0 }} />
            : <View style={{ width: 26, height: 26, borderRadius: 13, marginTop: 4, flexShrink: 0, backgroundColor: "rgba(99,102,241,0.25)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 9, color: "#a5b4fc", fontWeight: "800" }}>I</Text>
              </View>
        )}
        <Pressable
          onLongPress={message.isPending ? undefined : () => onLongPress(message)}
          delayLongPress={250}
          accessibilityLabel={`${isUser ? "You" : (companionName || "Imotara")}: ${message.text}`}
          accessibilityRole="text"
          style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: Math.min(screenWidth * (isUser ? 0.76 : 0.75), 480), marginBottom: 10, paddingHorizontal: 1, marginRight: isUser ? 2 : 0 }}
        >
          {isUser ? (
            <View style={{ backgroundColor: bubbleBackground, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: (!showSyncBadge || bubbleBorderColor === "transparent") ? 0 : 1, borderColor: showSyncBadge ? bubbleBorderColor : "transparent" }}>
              {bubbleContent}
            </View>
          ) : (
            <LinearGradient
              colors={[gradientStart || "rgba(148, 163, 184, 0.25)", gradientEnd || "rgba(148, 163, 184, 0.45)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: bubbleBorderColor === "transparent" ? 0 : 1, borderColor: bubbleBorderColor === "transparent" ? "rgba(148, 163, 184, 0.4)" : bubbleBorderColor }}
            >
              {bubbleContent}
            </LinearGradient>
          )}
        </Pressable>
      </View>

      {/* Inline action row — bot messages only */}
      {!isUser && !message.isPending && (() => {
        const activeReaction = reactions.get(message.id);
        const isSpeaking = speakingMessageId === message.id;
        const isPreparingSpeech = preparingSpeechId === message.id;
        const isBookmarked = bookmarks.has(message.id);

        // Original Ionicons reaction set — reverted to match preferred UI
        const ALL_REACTION_OPTIONS: { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string }[] = [
          { icon: "heart",        color: "#ef4444" },
          { icon: "sad-outline",  color: "#60a5fa" },
          { icon: "happy-outline",color: "#fbbf24" },
          { icon: "thumbs-up",    color: "#4ade80" },
          { icon: "hand-left",    color: "#a78bfa" },
          { icon: "flame",        color: "#fb923c" },
          { icon: "star",         color: "#f59e0b" },
          { icon: "leaf",         color: "#34d399" },
        ];
        const REACTION_OPTIONS = reactionsSet === "minimal"
          ? ALL_REACTION_OPTIONS.slice(0, 3)
          : reactionsSet === "extended"
          ? ALL_REACTION_OPTIONS
          : ALL_REACTION_OPTIONS.slice(0, 6);
        const activeOption = REACTION_OPTIONS.find((r) => r.icon === activeReaction);
        return (
          <View style={{ marginLeft: 4, marginBottom: 6, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Source badge */}
              <View style={{
                paddingHorizontal: 6, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
                borderColor: message.source === "cloud" ? "rgba(56,189,248,0.45)" : "rgba(148,163,184,0.35)",
                backgroundColor: message.source === "cloud" ? "rgba(56,189,248,0.10)" : "rgba(148,163,184,0.10)",
              }}>
                <Ionicons
                  name={message.source === "cloud" ? "cloud-outline" : "phone-portrait-outline"}
                  size={11}
                  color={message.source === "cloud" ? "#7dd3fc" : colors.textSecondary}
                />
              </View>

              {/* Reaction toggle */}
              <TouchableOpacity
                onPress={() => setReactionPickerOpen((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="React to message"
              >
                <Ionicons
                  name={activeOption ? activeOption.icon : "happy-outline"}
                  size={18}
                  color={activeOption ? activeOption.color : (reactionPickerOpen ? colors.textPrimary : colors.textSecondary)}
                />
              </TouchableOpacity>

              {/* Copy */}
              <TouchableOpacity onPress={() => onCopy(message.text)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Copy message">
                <Ionicons name="copy-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* TTS */}
              <TouchableOpacity
                onPress={() => (isSpeaking || isPreparingSpeech) ? onStopSpeak() : onSpeak(message.id, message.text)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={isPreparingSpeech ? "Preparing voice…" : isSpeaking ? "Stop speaking" : "Read message aloud"}
              >
                {isPreparingSpeech ? (
                  <ActivityIndicator size="small" color="#7dd3fc" />
                ) : (
                  <Ionicons
                    name={isSpeaking ? "stop-circle-outline" : "volume-high-outline"}
                    size={18}
                    color={isSpeaking ? "#7dd3fc" : colors.textSecondary}
                  />
                )}
              </TouchableOpacity>

              {/* Bookmark */}
              <TouchableOpacity onPress={() => onBookmark(message.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={isBookmarked ? "Remove bookmark" : "Bookmark message"}>
                <Ionicons
                  name={isBookmarked ? "star" : "star-outline"}
                  size={18}
                  color={isBookmarked ? "#fbbf24" : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Expandable reaction picker */}
            {reactionPickerOpen && (
              <View style={{ flexDirection: "row", gap: 12, paddingVertical: 4, paddingLeft: 2 }}>
                {REACTION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.icon}
                    onPress={() => { onReact(message.id, opt.icon); setReactionPickerOpen(false); }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={22}
                      color={opt.color}
                      style={{ opacity: activeReaction === opt.icon ? 1 : 0.55 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      })()}

      {/* Companion reaction badge — shown below user message when Imotara reacted */}
      {isUser && reactions.get(message.id) && (
        <View style={{ alignItems: "flex-end", marginRight: 4, marginBottom: 4 }}>
          <View style={{
            backgroundColor: colors.surfaceSoft,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Text style={{ fontSize: 16 }}>{reactions.get(message.id)}</Text>
          </View>
        </View>
      )}

      {/* Crisis safety card */}
      {!isUser && (() => {
        const prevMsg = prevMessage;
        if (!prevMsg || prevMsg.from !== "user") return null;
        const tier = detectMobileCrisisTier(prevMsg.text);
        const minTier: CrisisTier = crisisThreshold === "sensitive" ? 1 : crisisThreshold === "conservative" ? 2 : 1;
        if (tier === 0 || tier < minTier) return null;
        if (dismissedCrisisCards.has(message.id)) return null;

        if (tier === 1) {
          return (
            <View style={{ marginTop: 2, marginBottom: 6, marginLeft: 4, maxWidth: Math.min(screenWidth * 0.88, 560), borderRadius: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.30)", backgroundColor: "rgba(99,102,241,0.08)", paddingHorizontal: 14, paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "rgba(167,139,250,1)", flex: 1 }}>💜 You don't have to carry this alone</Text>
                <TouchableOpacity onPress={() => onDismissCrisisCard(message.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 14, color: "rgba(167,139,250,0.7)", marginLeft: 8 }}>x</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ marginTop: 8, fontSize: 12, color: "rgba(196,181,253,0.9)", lineHeight: 18 }}>
                It sounds like things are feeling really heavy. I'm here. If it ever feels like too much, free crisis support is just a call away.
              </Text>
              {(() => {
                const resources = getCrisisResourcesForCountry(detectCountryCode());
                const primary = resources?.primary?.[0];
                if (!primary) return null;
                return (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${primary.contact.replace(/[^\d+]/g, "")}`)}
                    style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 4 }}
                    accessibilityRole="link"
                    accessibilityLabel={`Call ${primary.label}: ${primary.contact}`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 13, color: "rgba(196,181,253,0.85)" }}>{primary.label}:</Text>
                    <Text style={{ fontSize: 13, color: "rgba(196,181,253,1)", fontWeight: "700", textDecorationLine: "underline" }}>{primary.contact}</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          );
        }

        return (
          <View style={{ marginTop: 2, marginBottom: 6, marginLeft: 4, maxWidth: Math.min(screenWidth * 0.88, 560), borderRadius: 14, borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.35)", backgroundColor: "rgba(251, 191, 36, 0.10)", paddingHorizontal: 14, paddingVertical: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#fde68a", flex: 1 }}>{"\u{1F49B}"} If things feel urgent right now</Text>
              <TouchableOpacity onPress={() => onDismissCrisisCard(message.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 14, color: "#fde68a", opacity: 0.7, marginLeft: 8 }}>x</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 10, gap: 6 }}>
              {(() => {
                const countryCode = detectCountryCode();
                const resources = getCrisisResourcesForCountry(countryCode);
                const lines: { label: string; number: string }[] = [];
                if (resources?.emergency) lines.push({ label: resources.emergency.label, number: resources.emergency.contact });
                resources?.primary?.slice(0, 2).forEach((r) => lines.push({ label: r.label, number: r.contact }));
                return lines.map(({ label, number }) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => Linking.openURL(`tel:${number.replace(/[^\d+]/g, "")}`)}
                    style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 4 }}
                    accessibilityRole="link"
                    accessibilityLabel={`Call ${label}: ${number}`}
                    hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 13, color: "#fde68a", opacity: 0.85 }}>{label}</Text>
                    <Text style={{ fontSize: 13, color: "#fde68a", fontWeight: "700", textDecorationLine: "underline" }}>{number}</Text>
                  </TouchableOpacity>
                ));
              })()}
            </View>
            <Text style={{ marginTop: 10, fontSize: 11, color: "#fde68a", opacity: 0.7 }}>
              You don't have to face this alone.
            </Text>
          </View>
        );
      })()}
    </View>
  );
}

const MemoMessageBubble = React.memo(MessageBubble, (prev, next) => {
  if (prev.message !== next.message) return false;
  if (prev.prevMessage !== next.prevMessage) return false;
  if (prev.prevPrevMessage !== next.prevPrevMessage) return false;
  if (prev.colors !== next.colors) return false;
  if (prev.speakingMessageId !== next.speakingMessageId) {
    const wasPlaying = prev.speakingMessageId === prev.message.id;
    const isPlaying = next.speakingMessageId === next.message.id;
    if (wasPlaying !== isPlaying) return false;
  }
  if (prev.preparingSpeechId !== next.preparingSpeechId) {
    const wasPreparing = prev.preparingSpeechId === prev.message.id;
    const isPreparing = next.preparingSpeechId === next.message.id;
    if (wasPreparing !== isPreparing) return false;
  }
  if (prev.reactions.get(prev.message.id) !== next.reactions.get(next.message.id)) return false;
  if (prev.bookmarks.has(prev.message.id) !== next.bookmarks.has(next.message.id)) return false;
  if (prev.dismissedCrisisCards.has(prev.message.id) !== next.dismissedCrisisCards.has(next.message.id)) return false;
  const wasSearchMatch = prev.searchMatchIds.has(prev.message.id);
  const isSearchMatch = next.searchMatchIds.has(next.message.id);
  if (wasSearchMatch !== isSearchMatch) return false;
  if (prev.searchActiveMatchId !== next.searchActiveMatchId) {
    const wasActive = prev.searchActiveMatchId === prev.message.id;
    const isActive = next.searchActiveMatchId === next.message.id;
    if (wasActive !== isActive) return false;
  }
  if (prev.showTimestamps !== next.showTimestamps) return false;
  if (prev.showSyncBadge !== next.showSyncBadge) return false;
  if (prev.companionName !== next.companionName) return false;
  if (prev.companionAvatarSource !== next.companionAvatarSource) return false;
  if (prev.crisisThreshold !== next.crisisThreshold) return false;
  return true;
});

export default function ChatScreen() {
  const colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  // Companion quick panel — opened by swiping right from the left edge strip
  const [companionPanelVisible, setCompanionPanelVisible] = useState(false);
  const companionPanelVisibleRef = useRef(false);
  useEffect(() => { companionPanelVisibleRef.current = companionPanelVisible; }, [companionPanelVisible]);

  const [planPanelVisible, setPlanPanelVisible] = useState(false);
  const planPanelVisibleRef = useRef(false);
  useEffect(() => { planPanelVisibleRef.current = planPanelVisible; }, [planPanelVisible]);

  // Enabled-flag refs initialised here; synced to settings after useSettings() below
  const companionPanelEnabledRef = useRef(true);
  const planPanelEnabledRef = useRef(true);

  // Track which direction triggered the capture so onPanResponderGrant knows what to open
  const swipeDirectionRef = useRef<"left" | "right" | null>(null);

  // Capture-phase PanResponder — fires top-down before FlatList can claim any gesture.
  // Right swipe → Companion panel (if enabled). Left swipe → Plan & Support panel (if enabled).
  // No x0 guard needed: ChatScreen is a tab (no iOS back-swipe navigation stack).
  const edgeSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        if (companionPanelVisibleRef.current || planPanelVisibleRef.current) return false;
        const horiz = Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
        if (!horiz) return false;
        if (gs.dx > 15 && companionPanelEnabledRef.current) { swipeDirectionRef.current = "right"; return true; }
        if (gs.dx < -15 && planPanelEnabledRef.current)     { swipeDirectionRef.current = "left";  return true; }
        return false;
      },
      onPanResponderGrant: () => {
        if (swipeDirectionRef.current === "right" && !companionPanelVisibleRef.current) {
          setCompanionPanelVisible(true);
        } else if (swipeDirectionRef.current === "left" && !planPanelVisibleRef.current) {
          setPlanPanelVisible(true);
        }
        swipeDirectionRef.current = null;
      },
      onPanResponderMove: () => {},
      onPanResponderRelease: () => {},
    })
  ).current;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  // ✅ Ref always holds the latest input value synchronously.
  // Fixes iOS autocorrect race condition: tapping an autocomplete suggestion fires
  // onChangeText → setState (async), but if the user immediately taps Send, handleSend
  // reads stale state. The ref is updated first (sync) so handleSend always gets the full text.
  const latestInputRef = useRef("");
  const [inputHeight, setInputHeight] = useState(40);
  const [isTyping, setIsTyping] = useState(false);
  const [typingDots, setTypingDots] = useState(1);
  // Streaming reply state — tracks the in-progress streaming message
  const streamingMsgIdRef = React.useRef<string | null>(null);

  const [recentlySyncedAt, setRecentlySyncedAt] = useState<number | null>(null);

  // ✅ Action sheet state
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);

  // ✅ Bookmarks state — key computation + load/save effects defined after useSettings() below
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const displayMessages = useMemo(
    () => showBookmarksOnly ? messages.filter((m) => bookmarks.has(m.id)) : messages,
    [showBookmarksOnly, messages, bookmarks]
  );

  // ✅ TTS state
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  // Set the instant a speaker button is tapped, cleared once audio actually
  // starts (onStart) — shows a "preparing voice…" spinner during the
  // network+synthesis wait instead of the "now speaking" icon appearing
  // before any sound plays, which read as broken/unresponsive.
  const [preparingSpeechId, setPreparingSpeechId] = useState<string | null>(null);

  // ✅ Chat search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const searchInputRef = React.useRef<any>(null);

  // Pre-compute search matches once (O(n)) instead of per-bubble (O(n²))
  const searchMatchIds = useMemo<Set<string>>(() => {
    const q = showSearch ? searchQuery.trim().toLowerCase() : "";
    if (!q) return new Set();
    return new Set(messages.filter((m) => m.text?.toLowerCase().includes(q)).map((m) => m.id));
  }, [showSearch, searchQuery, messages]);

  const searchActiveMatchId = useMemo<string | null>(() => {
    const q = showSearch ? searchQuery.trim().toLowerCase() : "";
    if (!q || searchMatchIds.size === 0) return null;
    const matchArr = messages.filter((m) => searchMatchIds.has(m.id));
    return matchArr[searchMatchIndex]?.id ?? null;
  }, [showSearch, searchQuery, searchMatchIds, searchMatchIndex, messages]);

  // Crisis safety card — tracks which bot message IDs have been dismissed
  const [dismissedCrisisCards, setDismissedCrisisCards] = useState<Set<string>>(new Set());
  const dismissCrisisCard = (id: string) =>
    setDismissedCrisisCards((prev) => new Set([...prev, id]));

  // Breathing modal
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [breathingVisible, setBreathingVisible] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  // P4 — Unsent Letter mode
  const [unsentLetterVisible, setUnsentLetterVisible] = useState(false);
  const [unsentLetterSetup, setUnsentLetterSetup] = useState<UnsentLetterSetup | null>(null);

  // NF-2 — Grief & Loss dedicated space
  const [griefMode, setGriefMode] = useState(false);

  // UX-3 — contextual unsent-letter hint (relationship keywords detected)
  const UNSENT_TRIED_KEY = "imotara.unsent_letter.tried.v1";
  const [showUnsentHint, setShowUnsentHint] = useState(false);
  const unsentHintShownRef = useRef(false);

  // UX-1 — first-chat intake arc
  const INTAKE_KEY = "imotara.intake.done.v1";
  const [intakeStep, setIntakeStep] = useState<0 | 1 | 2 | 3>(0);
  const [intakeAnswers, setIntakeAnswers] = useState<[string, string, string]>(["", "", ""]);
  const intakeInitialisedRef = useRef(false);
  useEffect(() => {
    if (intakeInitialisedRef.current) return;
    intakeInitialisedRef.current = true;
    AsyncStorage.getItem(INTAKE_KEY).then((v) => {
      if (!v) setIntakeStep(1);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // P3/P5 state — effects wired after history is declared (below store destructure)
  const [companionInsight, setCompanionInsight] = useState<{
    variant: "letter" | "arc";
    title: string;
    body: string;
  } | null>(null);
  const insightCheckedRef = useRef(false);

  // Tier 3 settings loaded on mount
  const [voiceMaxDurationMs, setVoiceMaxDurationMs] = useState(60_000);
  const [voiceQuality, setVoiceQuality] = useState<"high" | "low">("high");
  const [voiceCloudTranscription, setVoiceCloudTranscription] = useState(true);
  const [apiTimeoutMs, setApiTimeoutMs] = useState(20_000);
  const [statusPollMs, setStatusPollMs] = useState(15_000);
  const [chatReactionsSet, setChatReactionsSet] = useState<"default" | "minimal" | "extended">("default");
  const [chatTypingSpeed, setChatTypingSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [contentGuardSensitivity, setContentGuardSensitivity] = useState<"strict" | "standard" | "relaxed">("standard");
  const [crisisThresholdSetting, setCrisisThresholdSetting] = useState<"sensitive" | "standard" | "conservative">("standard");
  const [ttsRate, setTtsRate] = useState(0.95);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [voiceConfirm, setVoiceConfirm] = useState(false);
  useEffect(() => {
    const load = async () => {
      try {
        const [dur, qual, cloud, timeout, poll, intensity, reactSet, typSpeed, guard, crisis, ttsR, ttsP, vConfirm] = await Promise.all([
          AsyncStorage.getItem("imotara.voice.maxDuration.v1"),
          AsyncStorage.getItem("imotara.voice.quality.v1"),
          AsyncStorage.getItem("imotara.voice.cloudTranscription.v1"),
          AsyncStorage.getItem("imotara.api.timeout.v1"),
          AsyncStorage.getItem("imotara.status.pollInterval.v1"),
          AsyncStorage.getItem("imotara.haptic.intensity.v1"),
          AsyncStorage.getItem("imotara.reactions.set.v1"),
          AsyncStorage.getItem("imotara.typing.speed.v1"),
          AsyncStorage.getItem("imotara.content.guard.v1"),
          AsyncStorage.getItem("imotara.crisis.threshold.v1"),
          AsyncStorage.getItem("imotara.tts.rate.v1"),
          AsyncStorage.getItem("imotara.tts.pitch.v1"),
          AsyncStorage.getItem("imotara.voice.confirmTranscription.v1"),
        ]);
        const durSecs = parseInt(dur ?? "60", 10);
        if (isFinite(durSecs) && durSecs > 0) setVoiceMaxDurationMs(durSecs * 1000);
        if (qual === "low" || qual === "high") setVoiceQuality(qual);
        setVoiceCloudTranscription(cloud !== "0");
        const timeoutSecs = parseInt(timeout ?? "20", 10);
        if (isFinite(timeoutSecs) && timeoutSecs > 0) setApiTimeoutMs(timeoutSecs * 1000);
        const pollSecs = parseInt(poll ?? "15", 10);
        if (isFinite(pollSecs) && pollSecs > 0) setStatusPollMs(pollSecs * 1000);
        if (intensity === "off" || intensity === "light" || intensity === "strong") _hapticIntensity = intensity;
        if (reactSet === "minimal" || reactSet === "default" || reactSet === "extended") setChatReactionsSet(reactSet as "default" | "minimal" | "extended");
        if (typSpeed === "slow" || typSpeed === "normal" || typSpeed === "fast") setChatTypingSpeed(typSpeed as "slow" | "normal" | "fast");
        if (guard === "strict" || guard === "standard" || guard === "relaxed") setContentGuardSensitivity(guard as "strict" | "standard" | "relaxed");
        if (crisis === "sensitive" || crisis === "standard" || crisis === "conservative") setCrisisThresholdSetting(crisis as "sensitive" | "standard" | "conservative");
        const r = parseFloat(ttsR ?? "0.95");
        const p = parseFloat(ttsP ?? "1.0");
        if (isFinite(r)) setTtsRate(r);
        if (isFinite(p)) setTtsPitch(p);
        setVoiceConfirm(vConfirm === "1");
        const hf = await AsyncStorage.getItem("imotara:handsfree.v1");
        setHandsfree(hf === "1");
        handsfreeRef.current = hf === "1";
      } catch { /* non-fatal */ }
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hands-free mode
  const [handsfree, setHandsfree] = useState(false);
  const handsfreeRef = React.useRef(false);
  useFocusEffect(React.useCallback(() => {
    AsyncStorage.getItem("imotara:handsfree.v1").then((v) => {
      const val = v === "1";
      setHandsfree(val);
      handsfreeRef.current = val;
    }).catch(() => {});
  }, []));

  // Voice input
  const voiceConfirmRef = React.useRef(voiceConfirm);
  React.useEffect(() => { voiceConfirmRef.current = voiceConfirm; }, [voiceConfirm]);

  // voiceLangRef is set to the user's preferredLang once toneContext loads (see effect below).
  // voiceLang (state) mirrors it so useVoiceInput re-renders when the language changes —
  // ref mutations alone don't trigger re-renders, so opts.lang was always stuck at "en".
  const voiceLangRef = React.useRef("en");
  const [voiceLang, setVoiceLang] = useState("en");

  // Stable ref so the onTranscript callback can always call the latest handleSend.
  // Without this, the auto-stop timer (set in startRecording's setInterval) holds the
  // handleSend closure from the moment recording started — stale isTyping state —
  // which could bypass the double-send guard on timer-triggered stops.
  const handleSendRef = useRef<(overrideText?: string) => void>(() => {});
  useEffect(() => { handleSendRef.current = handleSend; }); // no dep array — every render

  // Stable callback ([] deps) so stopRecording's useCallback doesn't re-create on
  // every timer tick (setDurationMs fires every 500 ms → re-render).
  const onTranscript = useCallback((text: string) => {
      if (handsfreeRef.current) {
        setTimeout(() => handleSendRef.current(text), 80);
        return;
      }
      const insertText = () => {
        const newText = latestInputRef.current
          ? `${latestInputRef.current} ${text}`
          : text;
        latestInputRef.current = newText;
        setInput(newText);
      };
      if (voiceConfirmRef.current) {
        Alert.alert(
          "Use this transcription?",
          text,
          [
            { text: "Discard", style: "destructive" },
            { text: "Use", onPress: insertText },
          ],
        );
      } else {
        insertText();
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional [] — all mutable values accessed via refs

  const voiceInput = useVoiceInput(
    onTranscript,
    process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL,
    { maxDurationMs: voiceMaxDurationMs, quality: voiceQuality, cloudTranscription: voiceCloudTranscription, lang: voiceLang },
  );

  // voiceStateRef keeps the live recording state accessible from callbacks that
  // must not re-create on every render (onBackground, handleMicPress).
  const voiceStateRef = useRef(voiceInput.state);
  useEffect(() => { voiceStateRef.current = voiceInput.state; });

  // voiceInputRef keeps the latest startRecording/stopRecording functions so
  // handleMicPress (deps:[]) always calls the version created after AsyncStorage
  // has loaded voiceMaxDurationMs and voiceQuality. Without this, the first-render
  // functions (built with default 60s/high) are used even when the user saved
  // different preferences — the settings would be silently ignored.
  const voiceInputRef = useRef(voiceInput);
  useEffect(() => { voiceInputRef.current = voiceInput; });

  // Stable handler (deps []) — all mutable values accessed via refs.
  // This prevents ChatInputBar re-rendering every 500ms during recording
  // (setDurationMs ticks would otherwise produce a new onMicPress each render).
  const handleMicPress = useCallback(async () => {
    if (voiceStateRef.current === "idle") {
      // Stop any active TTS before recording — on Android, TTS audio bleeds
      // into the mic if it's still playing when recording begins.
      stopSpeaking();
      setSpeakingMessageId(null);
      await voiceInputRef.current.startRecording();
    } else if (voiceStateRef.current === "recording") {
      await voiceInputRef.current.stopRecording();
    }
  }, []); // intentional [] — state via voiceStateRef; functions via voiceInputRef

  // Message reactions — messageId → emoji (persisted to AsyncStorage)
  const REACTIONS_KEY = "imotara.reactions.v1";
  const [reactions, setReactions] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    AsyncStorage.getItem(REACTIONS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const obj = JSON.parse(raw) as Record<string, string>;
        setReactions(new Map(Object.entries(obj)));
      } catch {}
    }).catch(() => {});
  }, []);

  const pendingConsentSendRef = useRef<string | null>(null);

  // First-time onboarding hint — shown until the user sends their first ever message
  const FIRST_MSG_SEEN_KEY = "imotara.onboarding.firstMsgSeen.v1";
  const [showFirstTimeTip, setShowFirstTimeTip] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(FIRST_MSG_SEEN_KEY).then((val) => {
      if (!val) setShowFirstTimeTip(true);
    }).catch(() => { });
  }, []);

  // EN-3 — Daily micro check-in (once per day on chat open)
  const DAILY_CHECKIN_KEY = "imotara.dailycheckin.lastDate.v1";
  const [showDailyCheckin, setShowDailyCheckin] = useState(false);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem(DAILY_CHECKIN_KEY).then((stored) => {
      if (stored !== today) setShowDailyCheckin(true);
    }).catch(() => {});
  }, []);

  // Weekly mood recap banner — state only; effect wired after history is declared below
  const [weeklyRecap, setWeeklyRecap] = useState<string | null>(null);
  const [weeklyRecapDismissed, setWeeklyRecapDismissed] = useState(false);

  // P1 state — effect wired after history is declared (below store destructure)
  const [activeOpenLoop, setActiveOpenLoop] = useState<OpenLoop | null>(null);
  const [milestoneLoop, setMilestoneLoop] = useState<{ themeName: string } | null>(null);

  // Grow nudge — shown when user has ≥3 messages and hasn't permanently dismissed
  const GROW_NUDGE_KEY = "imotara.grow.nudge.perm.v1";
  const [growNudgeDismissed, setGrowNudgeDismissed] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(GROW_NUDGE_KEY).then((v) => { if (v === "1") setGrowNudgeDismissed(true); }).catch(() => {});
  }, []);
  function handleGrowNudgeDismiss() {
    setGrowNudgeDismissed(true);
    AsyncStorage.setItem(GROW_NUDGE_KEY, "1").catch(() => {});
  }

  // Settings-controlled feature flags
  const [sentimentChipsEnabled, setSentimentChipsEnabled] = useState(true);
  const [sentimentChipsDismissedSession, setSentimentChipsDismissedSession] = useState(false);
  const [weeklyRecapSettingEnabled, setWeeklyRecapSettingEnabled] = useState(true);
  const [undoSettingEnabled, setUndoSettingEnabled] = useState(true);
  const [moodGlimpseDismissedSession, setMoodGlimpseDismissedSession] = useState(false);
  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem("imotara.sentiment.chips.enabled.v1"),
      AsyncStorage.getItem("imotara.weekly.recap.enabled.v1"),
      AsyncStorage.getItem("imotara.undo.enabled.v1"),
    ]).then(([v1, v2, v3]) => {
      setSentimentChipsEnabled(v1 !== "0");
      setWeeklyRecapSettingEnabled(v2 !== "0");
      setUndoSettingEnabled(v3 === "1");
    }).catch(() => {});
  }, []);

  // Permanent capsule visibility flags — written "0" by "Dismiss forever", re-enabled from Settings
  const DAILY_CHECKIN_ENABLED_KEY = "imotara.daily.checkin.show.v1";
  const [dailyCheckinEnabled, setDailyCheckinEnabled] = useState(true);
  const COLLECTIVE_PULSE_ENABLED_KEY = "imotara.collective.pulse.show.v1";
  const [collectivePulseEnabled, setCollectivePulseEnabled] = useState(true);
  const TONE_REFLECTION_ENABLED_KEY = "imotara.tone.reflection.show.v1";
  const [toneReflectionEnabled, setToneReflectionEnabled] = useState(true);
  const RETURN_GREETING_ENABLED_KEY = "imotara.return.greeting.show.v1";
  const [returnGreetingEnabled, setReturnGreetingEnabled] = useState(true);
  const MOOD_GLIMPSE_ENABLED_KEY = "imotara.mood.glimpse.show.v1";
  const [moodGlimpseEnabled, setMoodGlimpseEnabled] = useState(true);
  const MILESTONE_ENABLED_KEY = "imotara.milestone.show.v1";
  const [milestoneEnabled, setMilestoneEnabled] = useState(true);
  const UNSENT_HINT_ENABLED_KEY = "imotara.unsent.hint.show.v1";
  const [unsentHintEnabled, setUnsentHintEnabled] = useState(true);
  const TRIAL_BANNER_ENABLED_KEY = "imotara.trial.banner.show.v1";
  const [trialBannerEnabled, setTrialBannerEnabled] = useState(true);
  const SESSION_GREETING_KEY = "imotara.session.greeting.show.v1";
  const [sessionGreetingEnabled, setSessionGreetingEnabled] = useState(true);
  const [sessionGreeting, setSessionGreeting] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(DAILY_CHECKIN_ENABLED_KEY),
      AsyncStorage.getItem(COLLECTIVE_PULSE_ENABLED_KEY),
      AsyncStorage.getItem(TONE_REFLECTION_ENABLED_KEY),
      AsyncStorage.getItem(RETURN_GREETING_ENABLED_KEY),
      AsyncStorage.getItem(MOOD_GLIMPSE_ENABLED_KEY),
      AsyncStorage.getItem(MILESTONE_ENABLED_KEY),
      AsyncStorage.getItem(UNSENT_HINT_ENABLED_KEY),
      AsyncStorage.getItem(TRIAL_BANNER_ENABLED_KEY),
      AsyncStorage.getItem(SESSION_GREETING_KEY),
    ]).then(([v1, v2, v3, v4, v5, v6, v7, v8, v9]) => {
      setDailyCheckinEnabled(v1 !== "0");
      setCollectivePulseEnabled(v2 !== "0");
      setToneReflectionEnabled(v3 !== "0");
      setReturnGreetingEnabled(v4 !== "0");
      setMoodGlimpseEnabled(v5 !== "0");
      setMilestoneEnabled(v6 !== "0");
      setUnsentHintEnabled(v7 !== "0");
      setTrialBannerEnabled(v8 !== "0");
      setSessionGreetingEnabled(v9 !== "0");
    }).catch(() => {});
  }, []);

  // NF-5: Anonymous Collective Pulse
  const [collectivePulse, setCollectivePulse] = useState<{ heavyPercent: number } | null>(null);
  const [pulseDismissed, setPulseDismissed] = useState(false);
  useEffect(() => {
    const apiBase = (process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL ?? "").replace(/\/$/, "");
    if (!apiBase) return;
    fetchWithTimeout(`${apiBase}/api/pulse`, {}, 10_000)
      .then((r) => r.json())
      .then((data) => {
        if (data.available && data.heavyPercent >= 15) {
          setCollectivePulse({ heavyPercent: data.heavyPercent });
          savePendingInsight("collectivePulse", { heavyPercent: data.heavyPercent }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const openLoopCheckedRef = useRef(false);
  const greetingCheckedForRef = useRef<string | null>(null);

  // Feature discovery cards — one per session, after 3+ user messages
  const navigation = useNavigation<any>();

  // Long-press helper: show "Turn off / Go to Settings / Cancel" alert for any capsule
  function showCapsuleMenu(
    label: string,
    onDismissForever?: () => void,
    onDismiss?: () => void,
  ) {
    const buttons: { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }[] = [];
    if (onDismissForever) {
      buttons.push({ text: "Dismiss forever", style: "destructive", onPress: onDismissForever });
    }
    if (onDismiss) {
      buttons.push({ text: "Dismiss for now", onPress: onDismiss });
    }
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert(label, "What would you like to do?", buttons);
  }

  const [discoveryCard, setDiscoveryCard] = useState<DiscoveryCardId | null>(null);
  // L-2: post-session tone reflection card
  const [sessionToneCardDismissed, setSessionToneCardDismissed] = useState(false);
  const discoveryShownThisSession = useRef(false);
  useEffect(() => {
    const userCount = messages.filter((m) => m.from === "user").length;
    if (userCount < 3 || discoveryShownThisSession.current || discoveryCard) return;
    AsyncStorage.getItem(DISCOVERY_CARDS_KEY).then((raw) => {
      const dismissed: DiscoveryCardId[] = raw ? JSON.parse(raw) : [];
      const next = getNextCard(dismissed);
      if (next) {
        setDiscoveryCard(next);
        discoveryShownThisSession.current = true;
      }
    }).catch(() => { });
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismissDiscoveryCard() {
    if (!discoveryCard) return;
    const id = discoveryCard;
    setDiscoveryCard(null);
    AsyncStorage.getItem(DISCOVERY_CARDS_KEY).then((raw) => {
      const dismissed: DiscoveryCardId[] = raw ? JSON.parse(raw) : [];
      if (!dismissed.includes(id)) {
        AsyncStorage.setItem(DISCOVERY_CARDS_KEY, JSON.stringify([...dismissed, id])).catch(() => { });
      }
    }).catch(() => { });
  }

  function handleDiscoveryAction() {
    dismissDiscoveryCard();
    if (discoveryCard === "trends") navigation.navigate("Trends");
    else if (discoveryCard === "companion") navigation.navigate("Settings");
    else if (discoveryCard === "unsent_letter") setUnsentLetterVisible(true);
    // "offline" card just dismisses
  }

  // EN-3 — complete the daily check-in ritual
  function handleDailyCheckin(label: string) {
    const today = new Date().toISOString().slice(0, 10);
    AsyncStorage.setItem(DAILY_CHECKIN_KEY, today).catch(() => {});
    setShowDailyCheckin(false);
    const text = `Feeling ${label.toLowerCase()} today.`;
    latestInputRef.current = text;
    setInput(text);
    setTimeout(() => handleSend(text), 80);
  }

  // Return greeting — shown after >24h absence
  const [showReturnGreeting, setShowReturnGreeting] = useState(false);
  useEffect(() => {
    const LAST_SEEN_KEY = "imotara.chat.lastSeen.v1";
    const now = Date.now();
    AsyncStorage.getItem(LAST_SEEN_KEY).then((val) => {
      const last = val ? parseInt(val, 10) : 0;
      if (last > 0 && now - last > 24 * 60 * 60 * 1000) {
        setShowReturnGreeting(true);
        setTimeout(() => setShowReturnGreeting(false), 8000);
      }
      AsyncStorage.setItem(LAST_SEEN_KEY, String(now));
    }).catch(() => { });
  }, []);

  const addReaction = useCallback((messageId: string, emoji: string) => {
    // Batch both state updates in a single React render to prevent UI jitter on Android.
    React.startTransition(() => {
      setReactions((prev) => {
        const next = new Map(prev);
        if (next.get(messageId) === emoji) next.delete(messageId);
        else next.set(messageId, emoji);
        AsyncStorage.setItem(REACTIONS_KEY, JSON.stringify(Object.fromEntries(next))).catch(() => {});
        return next;
      });
      setActionMessage(null);
    });
  }, []);


  // ✅ Read store once, but allow optional newer helpers safely (no behavior loss)
  const store = useHistoryStore() as any;
  const {
    addToHistory,
    history,
    activeHistory,
    activeThreadId,
    threads,
    startNewThread,
    setActiveThreadId,
    renameThread,
    deleteThread,
    clearHistory,
    deleteFromHistory,
    isSyncing,
    pushHistoryToRemote,
    runSync,
    syncNow,
    pauseAutoSync,
    resumeAutoSync,
    licenseTier,
    setLicenseTier,
  } = store;

  const {
    emotionInsightsEnabled,
    setEmotionInsightsEnabled,
    companionPanelEnabled,
    planPanelEnabled,
    lastSyncAt,
    lastSyncStatus,
    analysisMode,
    toneContext,
    setToneContext,
    cloudSyncAllowed,
    licenseExpiresAt,

    // ✅ Cross-device chat link key (optional)
    chatLinkKey,

    // ✅ Web parity: stable user scope → sent as threadId + userId to /api/respond
    localUserScopeId,

    refreshLicense,

    showSyncBadge,
    companionReactionsEnabled,
  } = useSettings();


  // Keep panel-enabled refs in sync with settings (refs are read inside the PanResponder closure)
  useEffect(() => { companionPanelEnabledRef.current = companionPanelEnabled; }, [companionPanelEnabled]);
  useEffect(() => { planPanelEnabledRef.current = planPanelEnabled; }, [planPanelEnabled]);

  // ── Companion auto-reactions ──────────────────────────────────────────────
  // Tracks which bot message IDs have already been considered for a companion
  // reaction so we don't re-trigger on every re-render.
  const companionReactedBotIds = useRef<Set<string>>(new Set());

  // Maps moodHint → emoji that feel emotionally appropriate.
  // Large variety prevents repetition — each bucket has 6–10 options.
  const pickCompanionReaction = useCallback((moodHint?: string): string | null => {
    // ~50% chance to react — feels natural, not mechanical
    if (Math.random() > 0.50) return null;
    const hint = (moodHint ?? "neutral").toLowerCase();
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    if (hint.includes("joy") || hint.includes("happy") || hint.includes("excit") || hint.includes("delight"))
      return pick(["❤️", "🥰", "🌟", "🔥", "✨", "🎉", "💫", "🌈", "😊", "💛"]);
    if (hint.includes("hope") || hint.includes("hopeful") || hint.includes("optim"))
      return pick(["🌱", "✨", "🌟", "💫", "🌸", "🕊️", "🌈", "💚", "🌻"]);
    if (hint.includes("gratit") || hint.includes("thankful") || hint.includes("appreciat"))
      return pick(["🙏", "❤️", "💛", "🌻", "✨", "💜", "🌸"]);
    if (hint.includes("sad") || hint.includes("grief") || hint.includes("loss") || hint.includes("mourn"))
      return pick(["🫂", "💙", "💜", "🤍", "🕊️", "❤️", "🌷", "💐"]);
    if (hint.includes("anxi") || hint.includes("worry") || hint.includes("fear") || hint.includes("nervous"))
      return pick(["🫂", "💙", "🤍", "💜", "🌿", "🕊️", "💗"]);
    if (hint.includes("stress") || hint.includes("overwhelm") || hint.includes("burden"))
      return pick(["🫂", "💙", "💪", "🌿", "🤍", "🌊", "💜"]);
    if (hint.includes("ang") || hint.includes("frustrat") || hint.includes("irritat"))
      return pick(["🫂", "💙", "🌿", "🤍", "💜", "🕊️"]);
    if (hint.includes("lone") || hint.includes("isol") || hint.includes("miss") || hint.includes("empty"))
      return pick(["❤️", "🫂", "💜", "🌻", "🦋", "💗", "🌸", "💕"]);
    if (hint.includes("tired") || hint.includes("exhaust") || hint.includes("burn") || hint.includes("drain"))
      return pick(["❤️", "🫂", "🌙", "💫", "🌿", "💜", "🤍"]);
    if (hint.includes("proud") || hint.includes("achiev") || hint.includes("succe") || hint.includes("accomplish"))
      return pick(["🔥", "🌟", "💪", "🎉", "✨", "👑", "🥳", "⭐"]);
    if (hint.includes("love") || hint.includes("care") || hint.includes("affec"))
      return pick(["❤️", "💕", "🥰", "💜", "🌸", "💗", "🩷"]);
    if (hint.includes("calm") || hint.includes("peace") || hint.includes("serene") || hint.includes("relax"))
      return pick(["🌿", "🕊️", "✨", "🌸", "💫", "🌊", "🍃"]);
    if (hint.includes("confus") || hint.includes("unsure") || hint.includes("lost"))
      return pick(["💙", "🫂", "🤍", "💜", "🌟"]);
    if (hint.includes("excit") || hint.includes("thrill") || hint.includes("eager"))
      return pick(["🔥", "🌟", "🎉", "✨", "💫", "🥳"]);
    if (hint.includes("courage") || hint.includes("brave") || hint.includes("strong"))
      return pick(["💪", "🔥", "🌟", "⭐", "🦋"]);
    // Neutral / general — warm but varied
    return pick(["❤️", "🌟", "✨", "🫂", "💛", "🌸", "💫", "🌿", "💙", "🕊️"]);
  }, []);

  // Watch messages — when a new non-pending bot reply arrives, optionally react
  // to the user message that preceded it after a short natural delay.
  useEffect(() => {
    if (!companionReactionsEnabled) return;

    const lastBot = [...messages].reverse().find(
      (m) => m.from !== "user" && !m.isPending && !m.id.startsWith("greeting-"),
    );
    if (!lastBot || companionReactedBotIds.current.has(lastBot.id)) return;
    companionReactedBotIds.current.add(lastBot.id);

    const botIndex = messages.findIndex((m) => m.id === lastBot.id);
    const userMsg = botIndex > 0
      ? [...messages].slice(0, botIndex).reverse().find((m) => m.from === "user")
      : undefined;
    if (!userMsg) return;

    const reaction = pickCompanionReaction(lastBot.moodHint);
    if (!reaction) return;

    // 1.2–2.5 s delay feels like the companion "noticed" and reacted naturally
    const delay = 1200 + Math.random() * 1300;
    const timer = setTimeout(() => {
      setReactions((prev) => {
        if (prev.has(userMsg.id)) return prev; // don't overwrite user's own reaction
        const next = new Map(prev);
        next.set(userMsg.id, reaction);
        AsyncStorage.setItem(REACTIONS_KEY, JSON.stringify(Object.fromEntries(next))).catch(() => {});
        return next;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [messages, companionReactionsEnabled, pickCompanionReaction]);

  // UX-4 + EN-2 — emotion continuation / topic-specific session greeting
  useEffect(() => {
    if (!activeThreadId || greetingCheckedForRef.current === activeThreadId) return;
    setSessionGreeting(null);
    if (!sessionGreetingEnabled) return;
    if (activeHistory.length < 2) return; // wait for history to load — don't lock ref yet
    greetingCheckedForRef.current = activeThreadId;
    const sorted = [...activeHistory].sort((a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    const lastMsg = sorted[sorted.length - 1];
    const gapHours = (Date.now() - (lastMsg?.timestamp ?? Date.now())) / 3_600_000;
    if (gapHours < 2) return;

    const EN2_TOPICS: Array<{ pattern: RegExp; reOpener: string }> = [
      { pattern: /\b(work|job|boss|deadline|career|burnout|workload|promotion|fired|manager|office|salary)\b/i,
        reOpener: "Last time you were navigating some work stress. How has that been since we spoke?" },
      { pattern: /\b(lonely|loneliness|alone|isolated|no friends|disconnected|left out|no one cares)\b/i,
        reOpener: "Last time you were feeling a bit lonely. How are you doing today?" },
      { pattern: /\b(anxious|anxiety|worry|worried|nervous|panic|overwhelmed|overthinking|dread)\b/i,
        reOpener: "Last time you were carrying some anxiety. How is that sitting with you now?" },
      { pattern: /\b(grief|grieving|loss|lost someone|died|death|passed away|miss them|mourning)\b/i,
        reOpener: "Last time you were sitting with some grief. How have you been holding up?" },
      { pattern: /\b(relationship|partner|boyfriend|girlfriend|husband|wife|breakup|broke up|divorce|fight|conflict)\b/i,
        reOpener: "Last time there was some relationship tension on your mind. How have things been?" },
      { pattern: /\b(can'?t sleep|insomnia|sleepless|exhausted|no energy|fatigue|nightmares|awake all night)\b/i,
        reOpener: "Last time you were struggling with sleep. Has that improved at all?" },
      { pattern: /\b(worthless|not good enough|failure|shame|hate myself|self.hate|inadequate|imposter|don'?t deserve)\b/i,
        reOpener: "Last time some questions of self-worth were coming up for you. How are you feeling today?" },
      { pattern: /\b(family|parents?|toxic|controlling|expectations|family pressure|family conflict)\b/i,
        reOpener: "Last time there was some family tension weighing on you. How has that been?" },
    ];

    const recentUserText = sorted.filter((m: any) => m.from === "user").slice(-4).map((m: any) => m.text ?? "").join(" ");
    const matched = EN2_TOPICS.find((t) => t.pattern.test(recentUserText));
    if (matched) { setSessionGreeting(matched.reOpener); return; }

    const heavyPattern = /low|tense|worried|upset|frustrated|stuck|sad|anxious|overwhelmed|hurt|difficult|hard time|heavy/i;
    const lastBotMsgs = sorted.filter((m: any) => m.from === "bot").slice(-3);
    const isHeavy = lastBotMsgs.some((m: any) => heavyPattern.test(m.text ?? ""));
    if (isHeavy) {
      const h = new Date().getHours();
      const timeGreet = h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.";
      setSessionGreeting(`${timeGreet} Last time you were carrying something heavy. How are you feeling now?`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId, activeHistory.length, sessionGreetingEnabled]);

  const effectiveCompanionName = toneContext?.companion?.name?.trim() || "Imotara";

  // UX-2 — companion avatar for chat bubbles
  const companionAvatarSource = resolveAvatarImage(
    toneContext?.companion?.gender ?? toneContext?.user?.gender,
    toneContext?.companion?.avatarAge ?? toneContext?.user?.avatarAge,
  );

  // Trial countdown banner — shown once per day when ≤14 days remain
  const TRIAL_BANNER_DISMISSED_KEY = "imotara.trial.bannerDismissed.v1";
  const [showTrialBanner, setShowTrialBanner] = useState(false);
  const [quotaCardShown, setQuotaCardShown] = useState(false);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  useEffect(() => {
    if (!licenseExpiresAt || cloudSyncAllowed) return;
    const msLeft = new Date(licenseExpiresAt).getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / 86_400_000);
    if (daysLeft <= 0 || daysLeft > 14) return;
    AsyncStorage.getItem(TRIAL_BANNER_DISMISSED_KEY).then((dismissed) => {
      const today = new Date().toISOString().slice(0, 10);
      if (dismissed !== "never" && dismissed !== today) setShowTrialBanner(true);
    }).catch(() => { });
  }, [licenseExpiresAt, cloudSyncAllowed]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismissTrialBanner() {
    setShowTrialBanner(false);
    AsyncStorage.setItem(TRIAL_BANNER_DISMISSED_KEY, "never").catch(() => { });
  }

  // C-3: Show timestamps — default ON; user can hide via Settings
  const [showMsgTimestamps, setShowMsgTimestamps] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem("imotara.chat.showTimestamps.v1")
      .then((v) => setShowMsgTimestamps(v === null ? true : v === "1"))
      .catch(() => {});
  }, []);

  // ── Auth: get Supabase session token for mobile API calls ──────────────────
  const { accessToken } = useAuth();

  // Weekly mood recap — compute from history once it's loaded
  useEffect(() => {
    if (history.length === 0) return;
    const now = Date.now();
    const weekMs = 7 * 86_400_000;
    const thisWeek = history.filter(
      (r: any) => !r.deleted && r.from === "user" && (r.timestamp ?? 0) >= now - weekMs && r.emotion && r.emotion !== "neutral",
    );
    if (thisWeek.length < 5) return;
    const freq: Record<string, number> = {};
    for (const r of thisWeek as any[]) freq[r.emotion] = (freq[r.emotion] ?? 0) + 1;
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (!top) return;
    const lang = toneContext?.user?.preferredLang ?? "en";
    const recapText = getWeeklyRecapText(top[0], top[1], lang);
    setWeeklyRecap(recapText);
    savePendingInsight("weeklyRecap", recapText).catch(() => {});
  }, [history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // P1 — Emotional Open Loops + NF-1 milestone celebration
  useEffect(() => {
    if (openLoopCheckedRef.current || history.length < 10) return;
    openLoopCheckedRef.current = true;
    (async () => {
      try {
        const prevLoops = await loadOpenLoops();
        const loops = await detectAndUpdateOpenLoops(history);
        // NF-1: detect any loop that just transitioned to "closed"
        const newlyClosed = loops.find(
          (l) => l.status === "closed" &&
            prevLoops.some((p) => p.id === l.id && p.status !== "closed")
        );
        if (newlyClosed) {
          setMilestoneLoop({ themeName: newlyClosed.themeName });
          savePendingInsight("milestone", { id: newlyClosed.id ?? "milestone", themeName: newlyClosed.themeName }).catch(() => {});
        }
        setActiveOpenLoop(getActiveLoop(loops));
      } catch {}
    })();
  }, [history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep voiceLangRef and voiceLang state in sync with toneContext so transcription
  // uses the correct language. Both must be updated: ref for instant access in callbacks,
  // state to trigger a re-render so useVoiceInput receives the updated opts.lang.
  React.useEffect(() => {
    const lang = toneContext?.user?.preferredLang ?? "en";
    voiceLangRef.current = lang;
    setVoiceLang(lang);
  }, [toneContext?.user?.preferredLang]);

  // P3/P5 — Companion insight effect (needs history, toneContext, accessToken)
  useEffect(() => {
    if (insightCheckedRef.current || history.length < 15) return;
    insightCheckedRef.current = true;
    (async () => {
      const { isLetterDue, loadStoredLetter, generateCompanionLetter } = await import("../lib/imotara/companionLetter");
      const { isArcDue, loadStoredArc, generateEmotionalArc } = await import("../lib/imotara/emotionalArc");

      if (await isLetterDue()) {
        const stored = await loadStoredLetter();
        if (stored) {
          setCompanionInsight({ variant: "letter", title: `A letter from ${stored.companionName}`, body: stored.body });
          savePendingInsight("companionInsight", { variant: "letter", title: `A letter from ${stored.companionName}`, body: stored.body }).catch(() => {});
          return;
        }
        const companionName = (toneContext as any)?.companion?.name ?? "Imotara";
        const userName = (toneContext as any)?.user?.name ?? "you";
        const letter = await generateCompanionLetter(history, companionName, userName, localUserScopeId, accessToken ?? undefined).catch(() => null);
        if (letter) {
          setCompanionInsight({ variant: "letter", title: `A letter from ${letter.companionName}`, body: letter.body });
          savePendingInsight("companionInsight", { variant: "letter", title: `A letter from ${letter.companionName}`, body: letter.body }).catch(() => {});
          return;
        }
      }

      if (await isArcDue()) {
        const stored = await loadStoredArc();
        if (stored) {
          setCompanionInsight({ variant: "arc", title: `Your ${stored.periodLabel}`, body: stored.narrative });
          savePendingInsight("companionInsight", { variant: "arc", title: `Your ${stored.periodLabel}`, body: stored.narrative }).catch(() => {});
          return;
        }
        const userName = (toneContext as any)?.user?.name ?? "you";
        const arc = await generateEmotionalArc(history, userName, localUserScopeId, accessToken ?? undefined).catch(() => null);
        if (arc) {
          setCompanionInsight({ variant: "arc", title: `Your ${arc.periodLabel}`, body: arc.narrative });
          savePendingInsight("companionInsight", { variant: "arc", title: `Your ${arc.periodLabel}`, body: arc.narrative }).catch(() => {});
        }
      }
    })();
  }, [history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Scoped bookmarks key — isolates bookmarks per user/session to prevent cross-user leakage
  const bookmarksKey = chatLinkKey
    ? `imotara.chat.bookmarks.v1:${chatLinkKey}`
    : localUserScopeId
      ? `imotara.chat.bookmarks.v1:local:${localUserScopeId}`
      : "imotara.chat.bookmarks.v1";

  useEffect(() => {
    setBookmarks(new Set());
    AsyncStorage.getItem(bookmarksKey).then((raw) => {
      if (raw) { try { setBookmarks(new Set(JSON.parse(raw))); } catch {} }
    });
  }, [bookmarksKey]);

  const handleToggleBookmark = async (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      AsyncStorage.setItem(bookmarksKey, JSON.stringify([...next])).catch(() => {});
      return next;
    });
    setActionMessage(null);
  };

  // ---------------------------------------------------------------------------
  // Account backup trigger (centralized in HistoryContext)
  // ChatScreen does NOT pull cloud chat directly anymore.
  // It simply triggers runSync(); HistoryContext handles remote pull + merge into History.
  // The existing "hydrate from history" effect will populate the chat UI.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        // Respect privacy/consent: local-only means never touch cloud.
        if (analysisMode === "local") return;

        // Respect license gate
        if (!cloudSyncAllowed) return;

        // Centralized sync (pull+merge lives in HistoryContext)
        if (typeof runSync === "function") {
          await runSync();
        } else if (typeof syncNow === "function") {
          await syncNow();
        }
      } catch (e) {
        debugWarn("[imotara] ChatScreen runSync trigger failed:", e);
      }
    })();
    // Re-trigger when identity scope changes (cross-device continuity)
  }, [analysisMode, cloudSyncAllowed, chatLinkKey, runSync, syncNow]);

  // ✅ Web parity: load companion memories once on mount into a ref (zero per-send I/O)
  useEffect(() => {
    loadMemories().then((items) => { memoriesRef.current = items; }).catch(() => {});
  }, []);

  const scrollViewRef = useRef<FlatList | null>(null);
  // Tracks whether the user has manually scrolled up away from the bottom.
  // "New messages" button only shows when this is true — never on initial load
  // or programmatic scrolls.
  const userScrolledUpRef = useRef(false);
  const toastRef = useRef<ToastHandle>(null);

  // ✅ RN-safe typing (fixes TS issues in many RN setups)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Message undo — undo button shows immediately, abort cancels in-flight request
  const [pendingUndo, setPendingUndo] = useState<{ messageId: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoAbortRef = useRef<AbortController | null>(null);

  // ✅ 80/20: prevent double-send / overlapping async flows
  const isSendingRef = useRef(false);

  // ✅ 80/20: avoid setState on unmounted
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  // ITEM 2: track initial mount so we can show a spinner instead of starters
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  useEffect(() => {
    // After one render cycle, mark load as done (messages are hydrated from storage by then)
    const t = setTimeout(() => {
      if (mountedRef.current) setInitialLoadDone(true);
    }, 300);
    return () => clearTimeout(t);
  }, []);

  // NEW: lifecycle safety refs (additive)
  const typingStartedAtRef = useRef<number>(0);
  const sendStartedAtRef = useRef<number>(0);
  const lastLifecycleResetAtRef = useRef<number>(0);

  // ✅ Web parity: cached companion memories (loaded once on mount, refreshed after new facts)
  // Avoids per-send AsyncStorage I/O while keeping memories available for emotionMemory context.
  const memoriesRef = useRef<MemoryItem[]>([]);

  const resetTypingState = (reason: string) => {
    // Avoid repeated rapid resets on noisy AppState transitions
    const now = Date.now();
    if (now - lastLifecycleResetAtRef.current < 250) return;
    lastLifecycleResetAtRef.current = now;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
      setPendingUndo(null);
    }

    // Release send lock as well (prevents stuck send disabled)
    isSendingRef.current = false;

    if (!mountedRef.current) return;

    // Only update state if needed
    setIsTyping(false);
    setTypingStatus("idle");
    setTypingDots(1);

    // (kept for future debugging; no UI impact)
    void reason;
  };

  const isOnline = useOnlineStatus(statusPollMs);

  // NEW: app lifecycle handling (prevents stuck typing on background/foreground)
  useAppLifecycle({
    debounceMs: 350,
    onBackground: () => {
      // Cancel any active recording — the OS reclaims the audio session on background,
      // leaving expo-av's native recorder stopped while JS state shows "recording".
      if (voiceStateRef.current === "recording") {
        void voiceInput.cancelRecording();
      }
      // If the app goes background mid "typing", clear timers and unlock
      if (isTyping || isSendingRef.current) {
        resetTypingState("background");
      }
      // Schedule inactivity nudge in the user's preferred language
      const lastUserMsg = [...messages].reverse().find((m) => m.from === "user");
      const lastActivityTs = lastUserMsg?.timestamp ?? Date.now();
      const lastContext = lastUserMsg?.text?.trim() || undefined;
      const notifLang = toneContext?.user?.preferredLang || undefined;
      scheduleInactivityReminder(lastActivityTs, lastContext, notifLang).catch(() => {});
    },
    onForeground: () => {
      // If we come back and a typing cycle has been hanging too long, reset.
      const now = Date.now();
      const typingAge = typingStartedAtRef.current
        ? now - typingStartedAtRef.current
        : 0;
      const sendAge = sendStartedAtRef.current
        ? now - sendStartedAtRef.current
        : 0;

      // Conservative: only reset if it looks stuck (e.g., OS paused timers)
      if (isTyping && typingAge > 20_000) {
        resetTypingState("foreground-stale-typing");
        return;
      }
      if (isSendingRef.current && sendAge > 25_000) {
        resetTypingState("foreground-stale-sendlock");
      }
      // Scroll to latest message when user returns to the app
      userScrolledUpRef.current = false;
      setShowScrollButton(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
    },
  });

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Android-only: RN's KeyboardAvoidingView wires both keyboardDidShow AND
  // keyboardDidHide to the same internal handler instead of resetting height
  // to 0 on hide (an upstream RN bug), which left a stale gap the size of
  // keyboardVerticalOffset after every dismiss. Tracking height ourselves via
  // the correct show/hide events sidesteps that broken internal state.
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      setKeyboardVisible(true);
      if (Platform.OS === "android") setAndroidKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      setKeyboardVisible(false);
      if (Platform.OS === "android") setAndroidKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const [typingStatus, setTypingStatus] = useState<TypingStatus>("idle");
  const [typingGlow] = useState(new Animated.Value(0));

  const hasUnsynced = useMemo(
    () => history.some((h: any) => !h.isSynced),
    [history],
  );

  const showRecentlySyncedPulse = useMemo(() => {
    if (recentlySyncedAt == null) return false;
    const diff = Date.now() - recentlySyncedAt;
    return diff < 8000;
  }, [recentlySyncedAt]);

  // Align message isSynced with history store
  useEffect(() => {
    if (history.length === 0) return;

    let anyNewlySynced = false;

    setMessages((prev) => {
      const updated = prev.map((m) => {
        const h = history.find((hh: any) => hh.id === m.id);
        if (!h) return m;
        if (m.isSynced === h.isSynced) return m;
        if (h.isSynced) anyNewlySynced = true;
        return {
          ...m,
          isSynced: h.isSynced,
          isPending: h.isSynced ? false : m.isPending,
        };
      });

      if (anyNewlySynced) setRecentlySyncedAt(Date.now());
      return updated;
    });
  }, [history]);

  const syncHint = useMemo(() => {
    if (!lastSyncAt)
      return "Some messages are stored locally until account backup is enabled.";

    if (hasUnsynced && isSyncing)
      return "Saving your messages\u2026";

    const lower = (lastSyncStatus || "").toLowerCase();
    if (lower.includes("failed") || lower.includes("error")) {
      return "Connection issue \u00b7 your latest messages are only on this device.";
    }

    if (
      lower.includes("pushed") ||
      lower.includes("merged") ||
      lower.includes("synced")
    ) {
      return "Recent messages are safely saved to your account.";
    }

    return "Messages synced \u00b7 safely stored in your account.";
  }, [lastSyncAt, lastSyncStatus, hasUnsynced, isSyncing]);

  const syncHintAccent = useMemo(() => {
    if (!lastSyncAt) return "#9ca3af";

    const lower = (lastSyncStatus || "").toLowerCase();
    if (lower.includes("failed") || lower.includes("error")) {
      return "#fca5a5";
    }

    if (
      lower.includes("pushed") ||
      lower.includes("merged") ||
      lower.includes("synced")
    ) {
      return colors.primary;
    }

    return colors.primary;
  }, [lastSyncAt, lastSyncStatus]);

  // Banner priority queue — max 1 Tier-2 banner visible at once
  const activeTier2Banner = useMemo((): "returnGreeting" | "sessionGreeting" | "dailyCheckin" | "trialCountdown" | "milestoneLoop" | "weeklyRecap" | "collectivePulse" | "growNudge" | null => {
    if (showReturnGreeting && returnGreetingEnabled) return "returnGreeting";
    if (sessionGreeting && sessionGreetingEnabled) return "sessionGreeting";
    if (showDailyCheckin && intakeStep === 0 && dailyCheckinEnabled) return "dailyCheckin";
    if (showTrialBanner && licenseExpiresAt && trialBannerEnabled) return "trialCountdown";
    if (milestoneLoop && milestoneEnabled) return "milestoneLoop";
    if (weeklyRecap && !weeklyRecapDismissed && weeklyRecapSettingEnabled) return "weeklyRecap";
    if (collectivePulse && !pulseDismissed && collectivePulseEnabled) return "collectivePulse";
    if (!growNudgeDismissed && messages.filter((m) => m.from === "user").length >= 3) return "growNudge";
    return null;
  }, [showReturnGreeting, returnGreetingEnabled, sessionGreeting, sessionGreetingEnabled, showDailyCheckin, dailyCheckinEnabled, intakeStep, showTrialBanner, trialBannerEnabled, licenseExpiresAt, milestoneLoop, milestoneEnabled, weeklyRecap, weeklyRecapDismissed, weeklyRecapSettingEnabled, collectivePulse, pulseDismissed, collectivePulseEnabled, growNudgeDismissed, messages]);

  useEffect(() => {
    if (!isTyping) {
      setTypingDots(1);
      return;
    }

    const interval = setInterval(() => {
      setTypingDots((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(interval);
  }, [isTyping]);

  useEffect(() => {
    if (!isTyping) {
      typingGlow.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(typingGlow, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(typingGlow, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isTyping, typingGlow]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Stop TTS on unmount — prevents audio continuing after navigating away
  useEffect(() => {
    return () => { stopSpeaking(); };
  }, []);

  useEffect(() => {
    if (recentlySyncedAt == null) return;
    const t = setTimeout(() => setRecentlySyncedAt(null), 900);
    return () => clearTimeout(t);
  }, [recentlySyncedAt]);

  const slideAnim = useRef<Animated.Value>(new Animated.Value(20)).current;
  const fadeAnim = useRef<Animated.Value>(new Animated.Value(0)).current;

  useEffect(() => {
    if (showScrollButton) {
      slideAnim.setValue(20);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showScrollButton, slideAnim, fadeAnim]);

  // NOTE: Hooks remain (hook-safe), but debug-only UI/trigger is gated via DEBUG_UI_ENABLED
  const [refreshing, setRefreshing] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const [pullAnim] = useState(new Animated.Value(0));

  // ✅ DEV-only: QA run state (prevents concurrent runs; no prod impact)
  const [devQaRunning, setDevQaRunning] = useState(false);
  const devQaRunningRef = useRef(false);

  // ✅ DEV-only: cancel flag for QA runs (used by Stop QA)
  const devQaCancelRef = useRef(false);

  useEffect(() => {
    if (!refreshing) return;

    Animated.sequence([
      Animated.timing(pullAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(pullAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [refreshing, pullAnim]);

  // ✅ DEV-only: probe cloud emotion label if returned by the API
  // Safe: if API doesn't provide an emotion label, returns undefined ("unknown" in logs).
  const devQaCloudProbe = async (
    prompt: string,
  ): Promise<string | undefined> => {
    try {
      const remote: any = await callImotaraAI(prompt, {
        toneContext: toneContext
          ? {
              ...toneContext,
              user: toneContext.user
                ? {
                    ...toneContext.user,
                    ageTone:
                      toneContext.user.ageTone ?? toneContext.user.ageRange,
                  }
                : undefined,
              companion: toneContext.companion
                ? {
                    ...toneContext.companion,
                    ageTone:
                      toneContext.companion.ageTone ??
                      toneContext.companion.ageRange,
                  }
                : undefined,
            }
          : undefined,

        countryCode: detectCountryCode(),

        analysisMode: analysisMode,
        emotionInsightsEnabled: true,

        settings: {
          // Always forward companion tone preferences as persona hints.
          // companion.enabled controls the named persona; tone prefs apply regardless.
          relationshipTone:
            (toneContext?.companion?.relationship !== "prefer_not"
              ? toneContext?.companion?.relationship
              : undefined) ?? toneContext?.user?.relationship,

          ageTone:
            (toneContext?.companion?.ageTone !== "prefer_not"
              ? (toneContext?.companion?.ageTone ?? toneContext?.companion?.ageRange)
              : undefined) ??
            toneContext?.user?.ageTone ??
            toneContext?.user?.ageRange,

          genderTone:
            (toneContext?.companion?.gender !== "prefer_not"
              ? toneContext?.companion?.gender
              : undefined) ?? toneContext?.user?.gender,
        },
      });

      // ✅ DEV-only: normalize labels into UI buckets (parity with web)
      const normalizeCloudEmotionLabel = (v: string): string => {
        const x = v.trim().toLowerCase();
        if (
          x === "anxious" ||
          x === "anxiety" ||
          x === "fear" ||
          x === "stress"
        )
          return "stressed";
        return x;
      };

      // Prefer the same canonical field the mobile UI uses first (aiClient.ts returns `emotion`).
      // This keeps QA-CLOUD aligned with what the app would actually show.
      const directLabel =
        remote?.emotion ??
        remote?.meta?.emotionLabel ??
        remote?.response?.meta?.emotionLabel ??
        remote?.emotionLabel;

      if (typeof directLabel === "string") {
        const v = normalizeCloudEmotionLabel(directLabel);
        return v || undefined;
      }

      // Some responses may only include meta.emotion (object) without emotionLabel.
      const primary =
        (typeof remote?.meta?.emotion?.primary === "string"
          ? remote.meta.emotion.primary
          : typeof remote?.response?.meta?.emotion?.primary === "string"
            ? remote.response.meta.emotion.primary
            : undefined) ?? undefined;

      if (typeof primary === "string") {
        const p = primary.trim().toLowerCase();
        const derived =
          p === "sadness"
            ? "sad"
            : p === "fear" || p === "anxiety"
              ? "stressed"
              : p === "anger"
                ? "angry"
                : p === "joy"
                  ? "joy"
                  : p === "neutral"
                    ? "neutral"
                    : p;
        return derived || undefined;
      }

      // Legacy tolerant fallbacks (keep, but normalize)
      const candidate =
        remote?.meta?.emotion ??
        remote?.response?.meta?.emotion ??
        remote?.emotion;

      if (typeof candidate === "string") {
        const v = normalizeCloudEmotionLabel(candidate);
        return v || undefined;
      }

      if (
        candidate &&
        typeof candidate === "object" &&
        typeof candidate.label === "string"
      ) {
        const v = normalizeCloudEmotionLabel(String(candidate.label));
        return v || undefined;
      }

      return undefined;
    } catch {
      return undefined;
    }
  };

  const startDevQaRun = async (
    options: { cloud?: boolean } = {},
  ): Promise<void> => {
    // DEV-only concurrency guard
    if (!DEBUG_UI_ENABLED) return;
    if (devQaRunningRef.current) return;

    devQaCancelRef.current = false; // reset cancel at the start of a run
    devQaRunningRef.current = true;
    setDevQaRunning(true);

    try {
      await runDevQaSuite({
        cancelRef: devQaCancelRef,
        cloudProbe: options.cloud ? devQaCloudProbe : undefined,
      });
    } finally {
      devQaRunningRef.current = false;
      if (mountedRef.current) setDevQaRunning(false);
    }
  };

  const handleRefresh = () => {
    if (!DEBUG_UI_ENABLED) return; // gated (no behavior change in prod)
    if (refreshing) return;

    // ✅ Prevent overlapping QA runs
    if (devQaRunningRef.current) return;

    setRefreshing(true);

    // ✅ DEV-only: quick QA replay logger (no UI changes)
    void startDevQaRun({ cloud: false });

    setTimeout(() => {
      if (!mountedRef.current) return;
      setRefreshing(false);
    }, 800);
  };

  const scrollToBottom = () => {
    userScrolledUpRef.current = false;
    setShowScrollButton(false);
    scrollViewRef.current?.scrollToEnd({ animated: true });
    // Second call (non-animated) after animation settles ensures we land at the
    // true bottom even when content size changed during the first scroll.
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 350);
  };

  const closeActionSheet = () => {
    setActionMessage(null);
  };

  const handleClearLocalChat = () => {
    Alert.alert(
      "Clear local chat?",
      "This will remove the chat history stored on this device. Your account backup (if any) will remain.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            // Clear persisted local history (scoped key) + reset sync UI state
            if (typeof clearHistory === "function") clearHistory();

            // Clear in-memory UI immediately (extra-safe UX)
            greetingInjectedRef.current = false;
            setMessages([]);
            latestInputRef.current = "";
            setInput("");
            setInputHeight(40);
            setActionMessage(null);
            setUnsentLetterSetup(null);
          },
        },
      ],
    );
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx === -1) return prev;

      const msg = prev[idx];

      // If deleting a user message, delete paired next bot reply (existing behavior)
      if (msg.from === "user") {
        const next = prev[idx + 1];
        const idsToDelete = [msg.id];
        if (next && next.from === "bot") idsToDelete.push(next.id);

        idsToDelete.forEach((deleteId) => deleteFromHistory(deleteId));
        return prev.filter((m) => !idsToDelete.includes(m.id));
      }

      deleteFromHistory(msg.id);
      return prev.filter((m) => m.id !== msg.id);
    });

    setActionMessage(null);
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", "Message text copied to clipboard.");
    } catch {
      Alert.alert("Copy failed", "Could not copy message text.");
    } finally {
      setActionMessage(null);
    }
  };

  const handleShowTimestamp = (msg: ChatMessage) => {
    Alert.alert("Message timestamp", new Date(msg.timestamp).toLocaleString());
    setActionMessage(null);
  };

  const handleExportChat = async () => {
    if (messages.length === 0) {
      Alert.alert("Nothing to export", "Start a conversation first.");
      return;
    }
    const lines = messages.map((m) => {
      const who = m.from === "user" ? "You" : effectiveCompanionName;
      const time = new Date(m.timestamp).toLocaleString();
      return `[${time}] ${who}: ${m.text}`;
    });
    const transcript = `Imotara Chat Export\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
    try {
      await Share.share({ message: transcript, title: "Imotara Chat" });
    } catch {
      Alert.alert("Export failed", "Could not open the share sheet.");
    }
  };

  // ✅ Explicit "sync now" action (uses deduped sync trigger when available)
  const handleSyncNowForMessage = async (msg: ChatMessage) => {
    try {
      // ✅ Hardening: don't start a sync attempt when cloud is gated off
      if (!cloudSyncAllowed) {
        Alert.alert(
          "Account backup unavailable",
          lastSyncStatus || "Account backup is not included in your current plan.",
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isPending: true } : m)),
      );

      const syncFn =
        typeof syncNow === "function"
          ? syncNow
          : typeof runSync === "function"
            ? runSync
            : pushHistoryToRemote;

      const result = await syncFn({ reason: "ChatScreen: message sync now" });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                isPending: false,
                // This UI flag mirrors what HistoryContext will mark after a successful push.
                isSynced: result.ok ? true : m.isSynced,
              }
            : m,
        ),
      );

      if (!result.ok) {
        Alert.alert(
          "Connection issue",
          result.errorMessage ||
            "Connection issue. Your message is safe on this device.",
        );
      }
    } catch (err) {
      debugWarn("Back up now failed:", err);

      Alert.alert(
        "Connection issue",
        "Connection issue. Your message is safe on this device.",
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isPending: false } : m)),
      );
    } finally {
      setActionMessage(null);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;

    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (distanceFromBottom < 24) {
      // Reached the bottom — clear the intent flag and hide button
      userScrolledUpRef.current = false;
      setShowScrollButton(false);
    } else if (distanceFromBottom > 150 && userScrolledUpRef.current) {
      // Only show when the user has deliberately scrolled up, not on initial render
      setShowScrollButton(true);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = e.nativeEvent;
    setPullOffset(contentOffset.y);
    onScroll(e);
  };

  const CHAR_LIMIT = 2000;

  const handleSend = (overrideText?: string) => {
    // Use ref value (always current) instead of state (may be stale due to async setState)
    const trimmed = (overrideText ?? latestInputRef.current).trim();
    if (!trimmed) return;
    if (trimmed.length > CHAR_LIMIT) {
      Alert.alert("Message too long", `Please shorten your message to under ${CHAR_LIMIT} characters.`);
      return;
    }

    // ✅ 80/20: block double taps / overlapping send cycles
    if (isTyping || isSendingRef.current) return;
    isSendingRef.current = true;
    pauseAutoSync();
    haptic.tap();
    sendStartedAtRef.current = Date.now();

    const timestamp = Date.now();

    // ✅ Phase 3.1 — persist user moodHint + emotion for history moodSummary
    const wantsInsights = emotionInsightsEnabled;
    const userMood = wantsInsights ? getLocalMoodHintWithPrimary(trimmed) : null;
    const userMoodHint = userMood?.hint;
    const userEmotion = userMood?.primary ?? undefined;

    const userMessage: ChatMessage = {
      id: `u-${timestamp}`,
      from: "user",
      text: trimmed,
      timestamp,
      isSynced: false,
      moodHint: userMoodHint,
    };

    addToHistory({
      id: userMessage.id,
      text: userMessage.text,
      from: "user",
      timestamp: userMessage.timestamp,
      isSynced: false,
      threadId: activeThreadId,

      // ✅ emotion required for moodSummary / session insight card in HistoryScreen
      ...(userEmotion ? { emotion: userEmotion } : {}),
    });

    setMessages((prev) => [...prev, userMessage]);
    latestInputRef.current = "";
    setInput("");
    setInputHeight(40);
    Keyboard.dismiss();

    // Dismiss first-time onboarding hint on first send
    if (showFirstTimeTip) {
      setShowFirstTimeTip(false);
      AsyncStorage.setItem(FIRST_MSG_SEEN_KEY, "1").catch(() => { });
    }

    // UX-3 — contextual unsent-letter hint
    if (!unsentHintShownRef.current && !unsentLetterSetup) {
      const relKeywords = /\b(can't say|never told|wish i could tell|unsent|dear |letter to|miss you|hurt me|forgive|goodbye|i love you|you left|you never|i need you to know|i wanted to say|never got to)\b/i;
      if (relKeywords.test(trimmed)) {
        AsyncStorage.getItem(UNSENT_TRIED_KEY).then((tried) => {
          if (!tried) { unsentHintShownRef.current = true; setShowUnsentHint(true); }
        }).catch(() => {});
      }
    }

    // Undo: show button immediately; 5s dismiss timer runs concurrently with API call
    undoAbortRef.current?.abort();
    const undoAbortCtrl = new AbortController();
    undoAbortRef.current = undoAbortCtrl;

    if (undoSettingEnabled) {
      setPendingUndo({ messageId: userMessage.id });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setPendingUndo(null);
        undoTimerRef.current = null;
        if (undoAbortRef.current === undoAbortCtrl) undoAbortRef.current = null;
      }, 5000);
    }

    // API call starts immediately — no undo delay
    if (!mountedRef.current) {
      isSendingRef.current = false;
      resumeAutoSync();
      return;
    }

    setIsTyping(true);
    typingStartedAtRef.current = Date.now();
    setTypingStatus("thinking");

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // networkNote removed — was intrusive in every offline bubble

    typingTimeoutRef.current = setTimeout(() => {
      (async () => {
        try {
          // ── Adult content safety gate ─────────────────────────
          // "relaxed" skips the check to reduce false positives on mature-but-safe topics
          if (contentGuardSensitivity !== "relaxed" && detectAdultContent(trimmed)) {
            const lang = toneContext?.user?.preferredLang ?? "en";
            const userAge = toneContext?.user?.ageRange ?? undefined;
            const safetyTs = Date.now();
            const safetyMsg: ChatMessage = {
              id: `b-${safetyTs}`,
              from: "bot",
              text: buildAdultSafetyRefusal(lang, userAge),
              timestamp: safetyTs,
              isSynced: false,
              source: "local",
            };
            if (mountedRef.current) {
              addToHistory({
                id: safetyMsg.id,
                text: safetyMsg.text,
                from: "bot",
                timestamp: safetyMsg.timestamp,
                isSynced: false,
                source: safetyMsg.source,
                threadId: activeThreadId,
              });
              setTypingStatus("responding");
              haptic.receive();
              setMessages((prev) => [...prev, safetyMsg]);
              smoothScrollToBottom(scrollViewRef);
            }
            return; // finally block handles cleanup
          }
          // ─────────────────────────────────────────────────────

          const wantsCloud = analysisMode !== "local";
          const wantsInsights = emotionInsightsEnabled;

          // ── Companion memory ──────────────────────────────────
          // Detect facts and persist (fire-and-forget; refresh cached ref after save)
          const memoryCaptureEnabled = await AsyncStorage.getItem("imotara.memory.capture.enabled.v1").catch(() => "1");
          if (memoryCaptureEnabled !== "0") {
              const newFacts = detectMemories(trimmed);
              for (const fact of newFacts) {
                  void addMemory({ text: fact, source: trimmed.slice(0, 80) }).then(() => {
                      loadMemories().then((items) => { memoriesRef.current = items; }).catch(() => {});
                  }).catch(() => {});
              }
          }
          // Use cached memories (zero AsyncStorage I/O on hot path)
          const memories = memoriesRef.current;
          const memoryContext = buildMemoryContext(memories);
          // Memory prefix used by local fallback only — cloud receives clean message + emotionMemory field
          const promptWithMemory = memoryContext
              ? `${memoryContext}\nUser message: ${trimmed}`
              : trimmed;

          // ── Build emotionMemory for cloud (mirrors web's runRespondWithConsent) ──
          // Combines factual memories + emotional history pattern into one context string
          const emotionalHistory = buildEmotionMemorySummary(history);

          // ── Cross-thread memory breadcrumb (mirrors web's buildCrossThreadContext) ──
          // Summarises recent past threads so the AI stays aware of long-term topics.
          const crossThreadContext = (() => {
              const allThreads: any[] = Array.isArray(threads) ? threads : [];
              const pastThreads = allThreads
                  .filter((t) => t.id !== activeThreadId)
                  .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
                  .slice(0, 5);
              if (pastThreads.length === 0) return "";
              const lines = pastThreads.map((t: any) => {
                  const daysAgo = Math.round((Date.now() - (t.createdAt ?? 0)) / 86_400_000);
                  const when = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
                  const threadMsgs = history.filter((h: any) => (h.threadId ?? "default") === t.id && h.from === "user");
                  const lastSnippets = [...threadMsgs]
                      .sort((a: any, b: any) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
                      .slice(0, 2)
                      .map((h: any) => String(h.text ?? "").slice(0, 100).trim())
                      .filter(Boolean)
                      .join(" / ");
                  const title = String(t.title ?? "").slice(0, 40);
                  return `• [${when}] ${title}${lastSnippets ? ` — ${lastSnippets}` : ""}`;
              });
              return lines.length > 0
                  ? `[Past conversations — brief context only]\n${lines.join("\n")}`
                  : "";
          })();

          const emotionMemory = [memoryContext, emotionalHistory, crossThreadContext]
              .map((s) => s.trim())
              .filter(Boolean)
              .join("\n\n") || undefined;

          // P4 — Unsent Letter: prepend role-play context so AI responds in recipient's voice
          // NF-2 — Grief & Loss: prepend grief-aware system context
          const griefSystemPrompt = `You are holding a dedicated Grief & Loss space. The user has chosen to open this space intentionally. Your role is to be fully present with their grief — not to fix, reframe, or rush toward healing. DO NOT say "they are in a better place", "time heals", "at least...", or any forward-looking reassurance unless the user explicitly asks for it. DO: sit in the weight of the loss with them. DO: name what was lost if they've shared it. DO: acknowledge the specific, irreplaceable nature of who or what they've lost. Speak slowly, softly, and with care. This is sacred ground.`;
          const aiMessage = unsentLetterSetup
            ? `${buildUnsentLetterSystemPrompt(unsentLetterSetup)}\n\nThe user's letter:\n${trimmed}`
            : griefMode
            ? `${griefSystemPrompt}\n\n${trimmed}`
            : trimmed;

          // 1) Try cloud if allowed by Analysis Mode AND device is online
          //    Uses streaming (?stream=1) for faster perceived response — text appears
          //    word-by-word within ~500ms instead of waiting 4-6s for the full reply.
          //    Falls back to non-streaming callImotaraAI() if stream fails.

          // Build shared payload for both streaming and non-streaming paths
          const cloudPayload: Record<string, unknown> = {
            messages: [
              ...(toneContext?.user?.name?.trim()
                ? [{ role: "system", content: `The user's preferred name is: ${toneContext.user.name.trim()}. Use it naturally — not every line.` }]
                : []),
              ...messages.slice(-10).map((m) => ({
                role: m.from === "user" ? "user" : "assistant",
                content: m.text,
              })),
              { role: "user", content: aiMessage },
            ],
            tone: (() => {
              const rel = String(toneContext?.companion?.relationship ?? "");
              if (rel === "close_friend") return "close_friend";
              if (rel === "coach") return "coach";
              if (rel === "mentor") return "mentor";
              return "calm_companion";
            })(),
            lang: toneContext?.user?.preferredLang || "en",
            ...(toneContext?.user?.gender && toneContext.user.gender !== "prefer_not" ? { userGender: toneContext.user.gender } : {}),
            ...(toneContext?.companion?.gender && toneContext.companion.gender !== "prefer_not" ? { companionGender: toneContext.companion.gender } : {}),
            ...(toneContext?.companion?.name?.trim() ? { companionName: toneContext.companion.name.trim() } : {}),
            ...(emotionMemory ? { emotionMemory } : {}),
            threadId: localUserScopeId || undefined,
            userId: localUserScopeId || undefined,
          };

          let remote: any = { ok: false, replyText: "" };

          if (wantsCloud && isOnline) {
            // ── Streaming path (fast perceived response) ──────────────────────
            streamingMsgIdRef.current = null;
            let streamedText = "";

            const streamResult = await streamChatReply(
              cloudPayload,
              accessToken || undefined,
              (accumulated) => {
                if (!mountedRef.current) return;
                if (!streamingMsgIdRef.current) {
                  // First token — dismiss undo window (too late to undo) and show reply
                  if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
                  if (undoAbortRef.current === undoAbortCtrl) { setPendingUndo(null); undoAbortRef.current = null; }
                  const newId = `b-stream-${Date.now()}`;
                  streamingMsgIdRef.current = newId;
                  const streamMsg: ChatMessage = {
                    id: newId, from: "bot", text: accumulated,
                    timestamp: Date.now(), isSynced: false, source: "cloud",
                  };
                  setIsTyping(false);
                  setMessages((prev) => [...prev, streamMsg]);
                  smoothScrollToBottom(scrollViewRef);
                } else {
                  // Update streaming message in place
                  streamedText = accumulated;
                  setMessages((prev) => prev.map((m) =>
                    m.id === streamingMsgIdRef.current ? { ...m, text: accumulated } : m,
                  ));
                }
              },
              Math.min(apiTimeoutMs, 25_000),
              undoAbortCtrl.signal,
            );

            // If user pressed Undo — discard everything silently
            if (undoAbortCtrl.signal.aborted) return;

            if (streamResult.ok && streamResult.text.trim().length > 0) {
              // Streaming succeeded — ensure final text is applied
              streamedText = streamResult.text;
              if (streamingMsgIdRef.current) {
                setMessages((prev) => prev.map((m) =>
                  m.id === streamingMsgIdRef.current ? { ...m, text: streamResult.text } : m,
                ));
              }
              remote = { ok: true, replyText: streamResult.text, analysisSource: "cloud" };
            } else {
              // Streaming failed — remove any partial message and fall back to non-streaming
              if (streamingMsgIdRef.current) {
                setMessages((prev) => prev.filter((m) => m.id !== streamingMsgIdRef.current));
                streamingMsgIdRef.current = null;
              }
              if (mountedRef.current) setIsTyping(true);

              // Fallback: full non-streaming call
              remote = await callImotaraAI(aiMessage, {
                toneContext: toneContext ? {
                  ...toneContext,
                  user: toneContext.user ? { ...toneContext.user, ageTone: toneContext.user.ageTone ?? toneContext.user.ageRange } : undefined,
                  companion: toneContext.companion ? { ...toneContext.companion, ageTone: toneContext.companion.ageTone ?? toneContext.companion.ageRange } : undefined,
                } : undefined,
                countryCode: detectCountryCode(),
                analysisMode,
                emotionInsightsEnabled: wantsInsights,
                settings: {
                  relationshipTone: (toneContext?.companion?.relationship !== "prefer_not" ? toneContext?.companion?.relationship : undefined) ?? toneContext?.user?.relationship,
                  ageTone: (toneContext?.companion?.ageTone !== "prefer_not" ? (toneContext?.companion?.ageTone ?? toneContext?.companion?.ageRange) : undefined) ?? toneContext?.user?.ageTone ?? toneContext?.user?.ageRange,
                  genderTone: (toneContext?.companion?.gender !== "prefer_not" ? toneContext?.companion?.gender : undefined) ?? toneContext?.user?.gender,
                },
                recentMessages: messages.slice(-10).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
                emotionMemory: emotionMemory || undefined,
                preferredLanguage: toneContext?.user?.preferredLang || undefined,
                threadId: localUserScopeId || undefined,
                userId: localUserScopeId || undefined,
                accessToken: accessToken || undefined,
                timeoutMs: apiTimeoutMs,
              });
            }
          }

          debugLog("[imotara] remote:", {
            ok: remote?.ok,
            errorMessage: remote?.errorMessage,

            // What user sees
            replyText: remote?.replyText,
            followUp: remote?.followUp,
            reflectionSeed: remote?.reflectionSeed,

            // What we need to debug "Cloud but same reply"
            analysisMode,
            meta: remote?.meta,
          });

          const cloudAttempted = wantsCloud;
          const cloudFailed =
            cloudAttempted &&
            !(remote?.ok && String(remote?.replyText || "").trim().length > 0);
          const cloudQuotaHit = cloudFailed && remote?.errorMessage === "quota_exceeded";

          if (cloudFailed && isOnline && !cloudQuotaHit) {
            toastRef.current?.show("Couldn't connect — used on-device mode.", "error");
          }

          const remoteUrl: string | undefined =
            typeof remote?.remoteUrl === "string"
              ? remote.remoteUrl
              : undefined;

          const remoteStatus: number | undefined =
            typeof remote?.remoteStatus === "number"
              ? remote.remoteStatus
              : undefined;

          const remoteError: string | undefined =
            typeof remote?.remoteError === "string" && remote.remoteError.trim()
              ? remote.remoteError.trim()
              : typeof remote?.errorMessage === "string" &&
                  remote.errorMessage.trim()
                ? remote.errorMessage.trim()
                : cloudFailed
                  ? "Unknown error"
                  : undefined;

          let replyText: string;
          let moodHint: string | undefined;
          let source: ChatMessageSource = "local";

          // ✅ NEW: parity metadata (optional; safe if aiClient doesn't return it yet)
          let reflectionSeed: ReflectionSeed | undefined;
          let followUp: string | undefined;
          let compatibility: any | undefined;

          // 2) If cloud succeeded, respect it
          const remoteReply = String(remote.replyText || "").trim()
              .replace(/\u2018|\u2019/g, "'")
              .replace(/\u201C|\u201D/g, '"')
              .replace(/\u2014/g, ' - ')
              .replace(/\u2013/g, '-');
          if (remote.ok && remoteReply.length > 0) {
            replyText = remoteReply;
            source = "cloud";

            reflectionSeed =
              (remote as any)?.reflectionSeed ??
              (remote as any)?.response?.reflectionSeed;

            followUp =
              typeof (remote as any)?.followUp === "string"
                ? (remote as any).followUp
                : typeof (remote as any)?.response?.followUp === "string"
                  ? (remote as any).response.followUp
                  : undefined;

            compatibility =
              remote?.meta?.compatibility ??
              remote?.response?.meta?.compatibility;

            // ✅ DEV-only QA contract gate (no UI impact):
            // Confirms server contract fields are present after cloud reply.
            if (DEBUG_UI_ENABLED) {
              const meta =
                (remote as any)?.meta ?? (remote as any)?.response?.meta ?? {};

              const analysisSource =
                typeof meta?.analysisSource === "string"
                  ? meta.analysisSource
                  : "MISSING";

              const emotionLabel =
                typeof meta?.emotionLabel === "string" &&
                meta.emotionLabel.trim()
                  ? meta.emotionLabel.trim().toLowerCase()
                  : "MISSING";

              const primary =
                typeof meta?.emotion?.primary === "string" &&
                meta.emotion.primary.trim()
                  ? meta.emotion.primary.trim().toLowerCase()
                  : "MISSING";

              debugLog(
                `[imotara][QA] respond contract (mobile): analysisSource=${analysisSource} emotionLabel=${emotionLabel} emotion.primary=${primary}`,
              );
            }

            const cloudMoodHint = getMoodHintFromEmotionPrimary(
              remote?.emotion,
            );

            // ✅ Local mood hint must also return a primary emotion bucket (for badge + history)
            const localMood = userMood ?? { primary: undefined, hint: "" };
            const localMoodHint = localMood.hint;
            const localPrimary = localMood.primary;

            moodHint = wantsInsights
              ? (cloudMoodHint ?? (localMood.primary ? localMoodHint : undefined))
              : undefined;

            // ✅ DEV-only visibility: confirm which source won
            if (wantsInsights) {
              debugLog("[imotara][moodHint]", {
                analysisMode,
                remoteEmotion: remote?.emotion,
                source: cloudMoodHint ? "cloud" : "local_fallback",
              });
            }
          } else if (unsentLetterSetup) {
            // P4 — Unsent Letter: cloud-only; show a gentle offline message
            replyText = `I wasn't able to reach ${unsentLetterSetup.recipientName} right now. Please check your connection and try again.`;
            source = "local";
          } else {
            // 3) Otherwise fallback to NEW local reply engine
            const localRecentCtx: LocalRecentContext = {
              recentUserTexts: messages.filter((m) => m.from === "user").slice(-5).map((m) => m.text),
              recentAssistantTexts: messages.filter((m) => m.from === "bot").slice(-3).map((m) => m.text),
              emotionMemory: memoryContext || undefined,
              preferredLang: toneContext?.user?.preferredLang ?? undefined,
            };
            const local = buildLocalReply(trimmed, toneContext, localRecentCtx);

            const localMoodForFallback = userMood ?? { primary: undefined, hint: "" };
            moodHint = wantsInsights && localMoodForFallback.primary
              ? localMoodForFallback.hint
              : undefined;
            source = "local";

            reflectionSeed = local.reflectionSeed
              ? {
                  ...local.reflectionSeed,
                  title: local.reflectionSeed.title ?? "",
                }
              : undefined;

            // ✅ Phase 2.2.1 — avoid duplicating reflectionSeed prompt inside the message body (local source of truth)
            const prompt = local.reflectionSeed?.prompt?.trim();
            const baseMessage = stripReflectionSeedPromptFromMessage(
              local.message,
              prompt,
            );

            replyText = baseMessage || local.message;

            // ✅ Phase 2.2.2 — local followUp parity + de-dupe (enhancement only)
            followUp =
              typeof prompt === "string" && prompt.trim()
                ? varyLocalFollowUpIfRepeated({
                    cacheKey: "local-followup",
                    followUp: prompt.trim(),
                    lowerUserMsg: trimmed.toLowerCase(),
                  })
                : undefined;
          }

          // ✅ Persist resolved emotion/intensity into history (cloud-preferred; additive only)
          const localPrimary = (userMood ?? { primary: undefined }).primary;

          const finalEmotion =
            source === "cloud"
              ? (() => {
                  const raw = trimmed || "";

                  // 1) Prefer backend-provided emotion if present
                  if (
                    typeof remote?.emotion === "string" &&
                    remote.emotion.trim()
                  ) {
                    const e = remote.emotion.trim().toLowerCase();
                    if (e === "sadness" || e === "sad") return "sad";
                    if (
                      e === "fear" ||
                      e === "anxiety" ||
                      e === "anxious" ||
                      e === "stressed"
                    )
                      return "stressed";
                    if (e === "anger" || e === "angry") return "angry";
                    if (e === "joy" || e === "happy") return "joy";
                    if (e === "confused" || e === "confusion")
                      return "confused";
                    if (e === "neutral") return "neutral";
                    return e;
                  }

                  // 2) If backend didn't send emotion, derive from input text (safe fallback)
                  const t = raw.toLowerCase().replace(/\s+/g, " ");
                  if (HI_STRESS_REGEX.test(raw)) return "stressed";
                  if (BN_SAD_REGEX.test(raw)) return "sad";
                  if (
                    isConfusedText(raw) ||
                    /\bsamajh nahi aa raha\b/.test(t) ||
                    /\bsamajh nahi aa rahi\b/.test(t) ||
                    /\bkya karu\b/.test(t) ||
                    /\bkya karoon\b/.test(t)
                  ) {
                    return "confused";
                  }

                  return undefined;
                })()
              : source === "local"
                ? (() => {
                    const raw = trimmed || "";

                    // ✅ Mixed Hindi/Bengali + romanized Bengali should never fall to neutral
                    if (HI_STRESS_REGEX.test(raw)) return "stressed";
                    if (BN_SAD_REGEX.test(raw) || /\bmood\s+off\b/i.test(raw))
                      return "sad";

                    // Use localPrimary if available (keeps existing behavior)
                    if (
                      typeof localPrimary === "string" &&
                      localPrimary.trim()
                    ) {
                      const p = localPrimary.trim().toLowerCase();
                      // normalize to UI buckets
                      if (p === "sadness") return "sad";
                      if (p === "fear" || p === "anxiety") return "stressed";
                      if (p === "anger") return "angry";
                      if (p === "joy") return "joy";
                      if (p === "neutral") return "neutral";
                      return p;
                    }
                    return undefined;
                  })()
                : undefined;

          const finalIntensity =
            source === "cloud" &&
            typeof remote?.intensity === "number" &&
            Number.isFinite(remote.intensity)
              ? remote.intensity
              : source === "local" && finalEmotion
                ? getDefaultIntensityForPrimary(finalEmotion)
                : undefined;

          const botTimestamp = Date.now();
          const botMessage: ChatMessage = {
            id: `b-${botTimestamp}`,
            from: "bot",
            text: replyText,
            timestamp: botTimestamp,
            moodHint,
            isSynced: false,
            source,

            // ✅ NEW parity metadata
            reflectionSeed,
            followUp,

            // ✅ cloud attempt diagnostics (additive)
            cloudAttempted,
            ...(cloudFailed
              ? {
                  remoteUrl,
                  remoteStatus,
                  remoteError,
                }
              : {
                  remoteUrl,
                }),

            // Debug-only: attach compatibility meta if present
            ...(compatibility ? { meta: { compatibility } } : {}),
          };

          if (!mountedRef.current) return;

          addToHistory({
            id: botMessage.id,
            text: botMessage.text,
            from: "bot",
            timestamp: botMessage.timestamp,
            isSynced: false,
            source: botMessage.source,
            threadId: activeThreadId,

            // ✅ Existing persisted hint
            moodHint: botMessage.moodHint,

            // ✅ NEW persisted emotion payload (HistoryContext now supports this)
            emotion: finalEmotion,
            intensity: finalIntensity,
          });

          // UX-5: pacing delay on heavy emotions — typing indicator stays visible during wait
          const HEAVY_EMOTIONS_MOBILE = new Set(["sad", "stressed", "anxious", "grief", "hopeless", "lonely", "frustrated", "hurt", "depressed", "empty"]);
          if (finalEmotion && HEAVY_EMOTIONS_MOBILE.has(finalEmotion)) {
            await new Promise<void>((resolve) => setTimeout(resolve, 1500));
            if (!mountedRef.current) return;
          }

          setTypingStatus("responding");
          haptic.receive();
          const extraMessages: ChatMessage[] = [];
          if (cloudQuotaHit && !quotaCardShown) {
            setQuotaCardShown(true);
            extraMessages.push({
              id: `quota-notice-${Date.now()}`,
              from: "bot",
              text: "",
              timestamp: botTimestamp - 1,
              isQuotaNotice: true,
            });
          }

          // If streaming was used, replace the streaming placeholder with the
          // finalised botMessage (which carries emotion, reflectionSeed, etc.).
          // Otherwise, add the botMessage as a new entry.
          const streamId = streamingMsgIdRef.current;
          streamingMsgIdRef.current = null;
          if (streamId && source === "cloud") {
            setMessages((prev) => [
              ...extraMessages,
              ...prev.map((m) => (m.id === streamId ? { ...botMessage, id: streamId } : m)),
            ]);
          } else {
            setMessages((prev) => [...prev, ...extraMessages, botMessage]);
          }
          smoothScrollToBottom(scrollViewRef);
          const autoReadEnabled1 = await AsyncStorage.getItem("imotara.tts.autoRead.v1").catch(() => "0");
          if ((handsfreeRef.current || autoReadEnabled1 === "1") && botMessage.text) {
            const g = toneContext?.companion?.enabled ? toneContext?.companion?.gender : toneContext?.user?.gender as string | undefined;
            const l = toneContext?.user?.preferredLang ?? "en";
            setPreparingSpeechId(botMessage.id);
            speakMessage(
              botMessage.id, botMessage.text, g, l,
              () => { setSpeakingMessageId(null); },
              ttsRate, ttsPitch, accessToken ?? undefined,
              () => { setPreparingSpeechId(null); setSpeakingMessageId(botMessage.id); },
              isFeatureEnabled("TTS_ADVANCED", licenseTier),
              () => toastRef.current?.show("Voice not available for this language on your device. Either install this language in your mobile or login into Imotara account from Settings", "info"),
            );
          }
        } catch (error) {
          // Undo abort — discard silently, no local fallback
          if (undoAbortCtrl.signal.aborted) return;

          debugWarn("Imotara mobile AI error:", error);

          // Surface a brief, actionable toast based on error type
          const errMsg = error instanceof Error ? error.message : String(error);
          const isNetwork =
            errMsg.includes("Network") ||
            errMsg.includes("fetch") ||
            errMsg.includes("connect") ||
            (typeof navigator !== "undefined" && !navigator.onLine);
          const isTimeout = errMsg.includes("timeout") || errMsg.includes("Timeout");
          if (isNetwork) {
            toastRef.current?.show("No internet — replied on device", "info");
          } else if (isTimeout) {
            toastRef.current?.show("Server took too long — replied on device", "info");
          } else {
            toastRef.current?.show("Went offline — replied on device", "info");
          }

          const wantsCloud = analysisMode !== "local" && cloudSyncAllowed;
          const wantsInsights = emotionInsightsEnabled;

          const localRecentCtxErr: LocalRecentContext = {
            recentUserTexts: messages.filter((m) => m.from === "user").slice(-5).map((m) => m.text),
            recentAssistantTexts: messages.filter((m) => m.from === "bot").slice(-3).map((m) => m.text),
            preferredLang: toneContext?.user?.preferredLang ?? undefined,
          };
          const local = buildLocalReply(trimmed, toneContext, localRecentCtxErr);

          const reflectionSeed = local.reflectionSeed
            ? {
                ...local.reflectionSeed,
                title: local.reflectionSeed.title ?? "",
              }
            : undefined;

          /// ✅ Phase 2.2.1 — avoid duplicating reflectionSeed prompt inside the message body (catch path too)
          const prompt = reflectionSeed?.prompt?.trim();
          const baseMessage = stripReflectionSeedPromptFromMessage(
            local.message,
            prompt,
          );

          const replyWithNote = baseMessage || local.message;

          const botTimestamp = Date.now();

          const followUp = reflectionSeed?.prompt;

          const botMessage: ChatMessage = {
            id: `b-${botTimestamp}`,
            from: "bot",
            text: replyWithNote,
            timestamp: botTimestamp,
            moodHint: wantsInsights && userMood?.primary ? userMood.hint : undefined,
            isSynced: false,
            source: "local",

            // ✅ parity metadata for local fallback
            reflectionSeed,
            followUp,
          };

          // ✅ Additive: persist user emotion for timelines/insights (stable primary label)
          const userPrimary = wantsInsights ? userMood?.primary : undefined;

          const userEmotion =
            typeof userPrimary === "string" && userPrimary.trim()
              ? userPrimary.trim()
              : undefined;

          const userIntensity = userEmotion
            ? getDefaultIntensityForPrimary(userEmotion)
            : undefined;

          if (!mountedRef.current) return;

          // User message already added to history at send time (line ~2182).
          // Do NOT call addToHistory again here — addToHistory always appends
          // and would create a duplicate entry in history on every cloud failure.

          // UX-5: pacing delay on heavy emotions (local fallback path)
          const HEAVY_EMOTIONS_FB = new Set(["sad", "stressed", "anxious", "grief", "hopeless", "lonely", "frustrated", "hurt", "depressed", "empty"]);
          if (userEmotion && HEAVY_EMOTIONS_FB.has(userEmotion)) {
            await new Promise<void>((resolve) => setTimeout(resolve, 1500));
            if (!mountedRef.current) return;
          }

          setTypingStatus("responding");
          haptic.receive();
          setMessages((prev) => [...prev, botMessage]);
          smoothScrollToBottom(scrollViewRef);
          const autoReadEnabled2 = await AsyncStorage.getItem("imotara.tts.autoRead.v1").catch(() => "0");
          if ((handsfreeRef.current || autoReadEnabled2 === "1") && botMessage.text) {
            const g = toneContext?.companion?.enabled ? toneContext?.companion?.gender : toneContext?.user?.gender as string | undefined;
            const l = toneContext?.user?.preferredLang ?? "en";
            setPreparingSpeechId(botMessage.id);
            speakMessage(
              botMessage.id, botMessage.text, g, l,
              () => { setSpeakingMessageId(null); },
              ttsRate, ttsPitch, accessToken ?? undefined,
              () => { setPreparingSpeechId(null); setSpeakingMessageId(botMessage.id); },
              isFeatureEnabled("TTS_ADVANCED", licenseTier),
              () => toastRef.current?.show("Voice not available for this language on your device. Either install this language in your mobile or login into Imotara account from Settings", "info"),
            );
          }
        } finally {
          // Always release send-lock regardless of mount state
          isSendingRef.current = false;
          resumeAutoSync();

          if (!mountedRef.current) return;

          setIsTyping(false);
          setTypingStatus("idle");
        }
      })();
    }, 800);
  };

  function handleUndo() {
    if (!pendingUndo) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    // Abort any in-flight request so the AI reply is cancelled immediately
    undoAbortRef.current?.abort();
    undoAbortRef.current = null;
    const { messageId } = pendingUndo;
    setPendingUndo(null);
    isSendingRef.current = false;
    resumeAutoSync();
    setIsTyping(false);
    setTypingStatus("idle");
    // Remove streaming placeholder if first token already arrived
    if (streamingMsgIdRef.current) {
      setMessages((prev) => prev.filter((m) => m.id !== streamingMsgIdRef.current));
      streamingMsgIdRef.current = null;
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    deleteFromHistory(messageId);
  }

  // ✅ DEV-only helper: fill input with a local test prompt (auto-send only in local mode)
  const runLocalDevPrompt = (prompt: string) => {
    setInput(prompt);

    // Auto-send only when explicitly in local mode (prevents surprise cloud sends)
    if (analysisMode === "local") {
      setTimeout(() => handleSend(), 0);
    }
  };

  // Hydrate from persisted history whenever active thread changes
  useEffect(() => {
    if (activeHistory.length === 0) {
      // Thread switched or cleared → reset local messages
      setMessages([]);
      return;
    }

    const sorted = [...activeHistory].sort(
      (a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
    );

    const hydrated: ChatMessage[] = sorted.map((h: any) => ({
      id: h.id,
      text: h.text,
      from: h.from,
      timestamp: h.timestamp,
      isSynced: !!h.isSynced,
      source: h.source,

      // ✅ Baby Step 10.4 — rehydrate emotion from persisted history
      moodHint: h.moodHint,
    }));

    setMessages(hydrated);
    smoothScrollToBottom(scrollViewRef);
  }, [activeHistory]);

  // ✅ NEW: when history updates (e.g., after Back up now), reflect isSynced/source changes in chat bubbles
  useEffect(() => {
    if (!history || history.length === 0) return;
    if (!messages || messages.length === 0) return;

    const byId = new Map<string, any>(history.map((h: any) => [h.id, h]));

    setMessages((prev) =>
      prev.map((m) => {
        const h = byId.get(m.id);
        if (!h) return m;

        const nextIsSynced = !!h.isSynced;
        const nextSource = (h as any).source ?? m.source;

        if (m.isSynced === nextIsSynced && m.source === nextSource) return m;

        return {
          ...m,
          isSynced: nextIsSynced,
          source: nextSource,
        };
      }),
    );
  }, [history]); // intentionally NOT depending on `messages` to avoid loops

  // Time-aware greeting + companion memory signal
  // Fires once per app session when messages hydrate.
  const greetingInjectedRef = useRef(false);
  useEffect(() => {
    if (greetingInjectedRef.current) return;
    // Wait until hydration settles (history loaded)
    const now = Date.now();
    const hour = new Date().getHours();
    const name = toneContext?.user?.name ?? "";

    const timeGreet =
      hour < 12
        ? name ? `Good morning, ${name}.` : "Good morning."
        : hour < 17
          ? name ? `Good afternoon, ${name}.` : "Good afternoon."
          : name ? `Good evening, ${name}.` : "Good evening.";

    let greetText = "";

    if (messages.length === 0) {
      // EN-1 — depth-aware welcome based on total conversation history
      const { level } = getConversationDepth(history);
      if (level === 3) {
        greetText = `${timeGreet} You know I'm always here. How are you carrying things today?`;
      } else if (level === 2) {
        greetText = `${timeGreet} It's been good walking alongside you lately. What's on your heart today?`;
      } else if (level === 1) {
        greetText = `${timeGreet} We've been talking for a while now — I'm glad you're here. How are you today?`;
      } else {
        greetText = `${timeGreet} I'm ${effectiveCompanionName}, and I'm here with you. How are you feeling right now?`;
      }
    } else {
      // Returning session — check time gap and last emotion
      const lastMsg = [...messages].sort((a, b) => b.timestamp - a.timestamp)[0];
      const gapHours = (now - (lastMsg?.timestamp ?? now)) / 3_600_000;

      if (gapHours >= 6) {
        // EN-2: topic-specific re-opener from last user messages
        const EN2_TOPICS: Array<{ pattern: RegExp; reOpener: string }> = [
          { pattern: /\b(work|job|boss|deadline|career|burnout|workload|promotion|fired|manager|office|salary)\b/i,
            reOpener: `${timeGreet} Last time you were navigating some work stress. How has that been since we spoke?` },
          { pattern: /\b(lonely|loneliness|alone|isolated|no friends|disconnected|left out|no one cares)\b/i,
            reOpener: `${timeGreet} Last time you were feeling a bit lonely. How are you doing today?` },
          { pattern: /\b(anxious|anxiety|worry|worried|nervous|panic|overwhelmed|overthinking|dread)\b/i,
            reOpener: `${timeGreet} Last time you were carrying some anxiety. How is that sitting with you now?` },
          { pattern: /\b(grief|grieving|loss|lost someone|died|death|passed away|miss them|mourning)\b/i,
            reOpener: `${timeGreet} Last time you were sitting with some grief. How have you been holding up?` },
          { pattern: /\b(relationship|partner|boyfriend|girlfriend|husband|wife|breakup|broke up|divorce|fight|conflict)\b/i,
            reOpener: `${timeGreet} Last time there was some relationship tension on your mind. How have things been?` },
          { pattern: /\b(can'?t sleep|insomnia|sleepless|exhausted|no energy|fatigue|nightmares|awake all night)\b/i,
            reOpener: `${timeGreet} Last time you were struggling with sleep. Has that improved at all?` },
          { pattern: /\b(worthless|not good enough|failure|shame|hate myself|inadequate|imposter|don'?t deserve)\b/i,
            reOpener: `${timeGreet} Last time some questions of self-worth were coming up for you. How are you feeling today?` },
          { pattern: /\b(family|parents?|toxic|controlling|expectations|family pressure|family conflict)\b/i,
            reOpener: `${timeGreet} Last time there was some family tension weighing on you. How has that been?` },
        ];
        const recentUserText = messages.filter((m) => m.from === "user").slice(-4).map((m) => m.text).join(" ");
        const matched = EN2_TOPICS.find((t) => t.pattern.test(recentUserText));
        if (matched) {
          greetText = matched.reOpener;
        } else {
          // UX-4 fallback: generic heavy-emotion greeting
          const lastBotMsgs = messages.filter((m) => m.from === "bot").slice(-3);
          const prevEmotion = lastBotMsgs
            .map((m) => m.moodHint ?? "")
            .find((h) => /low|tense|worried|upset|frustrated|stuck/i.test(h));
          if (prevEmotion) {
            greetText = `${timeGreet} Last time we talked, things seemed a little heavy. How are you doing now?`;
          } else {
            greetText = `${timeGreet} Good to have you back. How has your day been?`;
          }
        }
      }
    }

    if (!greetText) return;

    greetingInjectedRef.current = true;
    const greetMsg: ChatMessage = {
      id: `greeting-${now}`,
      from: "bot",
      text: greetText,
      timestamp: now,
      isSynced: false,
      source: "local",
    };
    setMessages((prev) => [greetMsg, ...prev.filter((m) => !m.id.startsWith("greeting-"))]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  const handleInputChange = (text: string) => {
    latestInputRef.current = text;
    setInput(text);
  };

  // ✅ Better multiline resize than onLayout (keeps your behavior, but actually works as text grows)
  const handleContentSizeChange = (e: any) => {
    const height = e?.nativeEvent?.contentSize?.height ?? 40;
    const minHeight = 40;
    const maxHeight = 120;
    const nextHeight = Math.min(Math.max(height + 14, minHeight), maxHeight);
    setInputHeight(nextHeight);
  };

  const renderActionSheet = () => {
    if (!actionMessage) return null;

    const canSyncNow =
      !actionMessage.isSynced && !actionMessage.isPending && !isSyncing;

    const deleteLabel =
      actionMessage.from === "user"
        ? "Delete (and delete paired reply)"
        : "Delete message";

    return (
      <>
        <Pressable
          onPress={closeActionSheet}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.25)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(24, 15, 30, 0.92)",
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 20,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 999,
                backgroundColor: "rgba(148, 163, 184, 0.9)",
              }}
            />
          </View>

          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: 10,
            }}
          >
            Message actions
          </Text>

          <View
            style={{
              backgroundColor: colors.surfaceSoft,
              borderRadius: 12,
              padding: 10,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textPrimary }}>
              {actionMessage.text}
            </Text>
          </View>

          {/* Emoji reactions */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 10, marginBottom: 4 }}>
            {["👍", "💙", "🙏", "✨", "🤔", "❤️"].map((emoji) => {
              const isActive = reactions.get(actionMessage.id) === emoji;
              return (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => addReaction(actionMessage.id, emoji)}
                  style={{
                    padding: 8,
                    borderRadius: 999,
                    backgroundColor: isActive ? "rgba(56,189,248,0.18)" : "transparent",
                    borderWidth: isActive ? 1 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => {
              const id = actionMessage.id;
              const text = actionMessage.text;
              const gender = toneContext?.companion?.enabled
                ? toneContext?.companion?.gender
                : toneContext?.user?.gender as string | undefined;
              const lang = toneContext?.user?.preferredLang ?? "en";
              const isCurrentlySpeaking = speakingMessageId === id || preparingSpeechId === id;
              if (isCurrentlySpeaking) {
                stopSpeaking();
                setSpeakingMessageId(null);
                setPreparingSpeechId(null);
              } else {
                setPreparingSpeechId(id);
                speakMessage(
                  id, text, gender, lang,
                  () => { setSpeakingMessageId(null); },
                  ttsRate, ttsPitch, accessToken ?? undefined,
                  () => { setPreparingSpeechId(null); setSpeakingMessageId(id); },
                  isFeatureEnabled("TTS_ADVANCED", licenseTier),
                  () => toastRef.current?.show("Voice not available for this language on your device. Either install this language in your mobile or login into Imotara account from Settings", "info"),
                );
              }
              setActionMessage(null);
            }}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>
              {(speakingMessageId === actionMessage.id || preparingSpeechId === actionMessage.id) ? "Stop speaking" : "Speak aloud 🔊"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleCopyMessage(actionMessage.text)}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>
              Copy text
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleToggleBookmark(actionMessage.id)}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: bookmarks.has(actionMessage.id) ? "#fde68a" : colors.textPrimary }}>
              {bookmarks.has(actionMessage.id) ? "★ Remove bookmark" : "☆ Bookmark message"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleShowTimestamp(actionMessage)}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>
              Show timestamp
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={
              canSyncNow
                ? () => handleSyncNowForMessage(actionMessage)
                : undefined
            }
            disabled={!canSyncNow}
            style={{
              paddingVertical: 10,
              opacity: canSyncNow ? 1 : 0.45,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>
              Back up now (try cloud)
            </Text>
            {!canSyncNow && (
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: colors.textSecondary,
                }}
              >
                {actionMessage.isPending
                  ? "Already syncing…"
                  : actionMessage.isSynced
                    ? "Already synced."
                    : isSyncing
                      ? "Saving…"
                      : "Not available right now."}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Delete message",
                actionMessage.from === "user"
                  ? "Delete this message and its paired reply?"
                  : "Delete this message?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => handleDeleteMessage(actionMessage.id),
                  },
                ],
              );
            }}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: "#fecaca" }}>
              {deleteLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setActionMessage(null); void handleExportChat(); }}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>
              Export chat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={closeActionSheet}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const formattedTypingDots = ".".repeat(typingDots);

  const latestUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].from === "user") return messages[i];
    }
    return null;
  }, [messages]);

  const latestMoodHint = useMemo(() => {
    if (!latestUserMessage) return null;
    if (!emotionInsightsEnabled) return null;
    return getLocalMoodHint(latestUserMessage.text);
  }, [emotionInsightsEnabled, latestUserMessage]);

  const typingStatusText = useMemo(() => {
    if (!isTyping) return "";
    if (typingStatus === "thinking") {
      return `${effectiveCompanionName} is thinking about your feelings${formattedTypingDots}`;
    }
    return `${effectiveCompanionName} is typing${formattedTypingDots}`;
  }, [isTyping, typingStatus, formattedTypingDots]);

  const typingBubbleBg = useMemo(() => {
    if (!isTyping) return "rgba(24, 15, 30, 0.9)";
    if (latestMoodHint) return getMoodTintForHint(latestMoodHint, colors);
    return "rgba(24, 15, 30, 0.9)";
  }, [isTyping, latestMoodHint]);

  // ✅ 80/20: disable Send while typing or in-flight
  const isSendDisabled =
    input.trim().length === 0 || isTyping || isSendingRef.current;

  const isPad = Platform.OS === "ios" && Platform.isPad;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      // Android: no offset — the tab bar fully hides while the keyboard is
      // open (it doesn't sit alongside it), so compensating for its height
      // here only left a gap between the input bar and the keyboard.
      keyboardVerticalOffset={0}
      // Android: gate on our own reliably-tracked keyboard height rather than
      // leaving this always-enabled. RN's KeyboardAvoidingView wires both
      // keyboardDidShow/Hide to the same internal handler on Android (an
      // upstream bug) and never resets its internal height offset back to 0
      // on dismiss, leaving a stale gap. Disabling it once we know the
      // keyboard is actually closed forces its height math back to the full
      // frame, sidestepping the stuck internal state.
      enabled={Platform.OS === "android" ? androidKeyboardHeight > 0 : !(Platform.OS === "ios" && Platform.isPad)}
    >
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }} {...edgeSwipeResponder.panHandlers}>
      {/* iPad: constrain content to a centered column so the UI doesn't span the full iPad width */}
      <View style={isPad ? { flex: 1, maxWidth: 700, width: "100%", alignSelf: "center" } : { flex: 1 }}>
      {/* Offline / unsynced indicator */}
      {!isOnline ? (
        <View style={{ backgroundColor: "rgba(202,138,4,0.92)", paddingVertical: 6, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Text style={{ fontSize: 12, color: "#fff", fontWeight: "600" }}>
            {hasUnsynced
              ? `📡 Offline — ${history.filter((h: any) => !h.isSynced).length} message${history.filter((h: any) => !h.isSynced).length !== 1 ? "s" : ""} queued`
              : "You're offline — Imotara will reply using on-device mode"}
          </Text>
        </View>
      ) : null}
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 2,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Title section — tappable to open companion panel; flex:1 yields space to buttons */}
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}
            onPress={() => setCompanionPanelVisible(true)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Open companion settings"
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                marginRight: 6,
                backgroundColor: hasUnsynced
                  ? "#fbbf24"
                  : (lastSyncStatus || "").toLowerCase().includes("failed")
                    ? "#f87171"
                    : colors.primary,
              }}
            />

            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.textPrimary,
              }}
              numberOfLines={1}
            >
              {effectiveCompanionName}
            </Text>

{/* AI mode badge moved to ⋯ overflow menu — technical label not needed in default header */}
          </TouchableOpacity>

          {/* Buttons section — 3 items max to prevent header overflow */}
          <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 0, gap: 6 }}>

            {/* Thread list */}
            <TouchableOpacity
              onPress={() => setShowThreadPanel(true)}
              style={{
                width: 34, height: 34, borderRadius: 999,
                borderWidth: 1,
                borderColor: threads.length > 1 ? "rgba(99,102,241,0.5)" : colors.border,
                backgroundColor: threads.length > 1 ? "rgba(99,102,241,0.12)" : colors.surfaceSoft,
                alignItems: "center", justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="View all conversations"
            >
              <Ionicons name="chatbubbles-outline" size={15} color={threads.length > 1 ? "#818cf8" : colors.textSecondary} />
            </TouchableOpacity>

            {/* New chat */}
            <TouchableOpacity
              onPress={() => { setUnsentLetterSetup(null); startNewThread(); }}
              style={{
                width: 34, height: 34, borderRadius: 999,
                alignItems: "center", justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Start new conversation"
            >
              <Ionicons name="add-outline" size={16} color="#818cf8" />
            </TouchableOpacity>

            {/* More (⋯) — breathing, unsent letter, search, bookmarks, clear */}
            <TouchableOpacity
              onPress={() => setShowHeaderMenu(true)}
              style={{
                width: 34, height: 34, borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSoft,
                alignItems: "center", justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

          </View>
        </View>

        {!keyboardVisible && (
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginTop: 2,
              marginBottom: 4,
            }}
          >
            A calm space to talk about your feelings.
          </Text>
        )}


        {/* Privacy mode badge */}
        {!keyboardVisible && (analysisMode === "local" || !cloudSyncAllowed) && (
          <View
            style={{
              alignSelf: "flex-start",
              marginTop: 4,
              marginBottom: 2,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(34, 197, 94, 0.35)",
              backgroundColor: "rgba(34, 197, 94, 0.10)",
            }}
          >
            <Text style={{ fontSize: 10, marginRight: 4 }}>{"\uD83D\uDD12"}</Text>
            <Text style={{ fontSize: 10, color: "#86efac", fontWeight: "600" }}>
              Device only — no data leaves your phone
            </Text>
          </View>
        )}
      </View>

      {/* Search bar */}
      {showSearch && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: "rgba(24, 15, 30, 0.7)",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>🔍</Text>
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={(t) => { setSearchQuery(t); setSearchMatchIndex(0); }}
            placeholder="Search messages…"
            placeholderTextColor={colors.textSecondary}
            style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.trim().length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {searchMatchIds.size === 0 ? "No results" : `${Math.min(searchMatchIndex + 1, searchMatchIds.size)} / ${searchMatchIds.size}`}
              </Text>
              {searchMatchIds.size > 1 && (
                <>
                  <TouchableOpacity
                    onPress={() => setSearchMatchIndex((i) => Math.max(0, i - 1))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 14, color: colors.primary }}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSearchMatchIndex((i) => Math.min(searchMatchIds.size - 1, i + 1))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 14, color: colors.primary }}>↓</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(""); setSearchMatchIndex(0); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Chat area */}
      <View style={{ flex: 1 }}>
        {DEBUG_UI_ENABLED && refreshing && (
          <Animated.View
            style={{
              position: "absolute",
              top: 10,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 20,
              opacity: pullAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 1],
              }),
              transform: [
                {
                  scale: pullAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1.05],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                backgroundColor: "rgba(56, 189, 248, 0.8)",
              }}
            />
          </Animated.View>
        )}

        <FlatList
          ref={scrollViewRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item: message, index }) => {
            const prevMsg = index > 0 ? displayMessages[index - 1] ?? null : null;
            const prevPrevMsg = index > 1 ? displayMessages[index - 2] ?? null : null;
            return message.isQuotaNotice ? (
            <View style={{ marginHorizontal: 16, marginVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(139,92,246,0.30)", backgroundColor: colors.surface, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 16 }}>✨</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>I've used my 20 replies for today</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 }}>
                I'm still here. My responses now come from on-device mode — a little simpler, but present.
              </Text>
              <TouchableOpacity
                onPress={() => setShowUpgradeSheet(true)}
                style={{ alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#7c3aed" }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#ffffff" }}>Upgrade for unlimited replies →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MemoMessageBubble
              message={message}
              prevMessage={prevMsg}
              prevPrevMessage={prevPrevMsg}
              colors={colors}
              searchMatchIds={searchMatchIds}
              searchActiveMatchId={searchActiveMatchId}
              bookmarks={bookmarks}
              lastSyncStatus={lastSyncStatus}
              dismissedCrisisCards={dismissedCrisisCards}
              reactions={reactions}
              speakingMessageId={speakingMessageId}
              preparingSpeechId={preparingSpeechId}
              companionAvatarSource={companionAvatarSource}
              companionName={toneContext?.companion?.name?.trim() || undefined}
              onLongPress={setActionMessage}
              onDismissCrisisCard={dismissCrisisCard}
              onRetry={(messageId, prevUserText) => {
                setMessages((prev) => prev.filter((m) => m.id !== messageId));
                deleteFromHistory(messageId);
                setInput(prevUserText);
              }}
              onCopy={handleCopyMessage}
              onSpeak={(id, text) => {
                const gender = toneContext?.companion?.enabled
                  ? toneContext?.companion?.gender
                  : toneContext?.user?.gender as string | undefined;
                const lang = toneContext?.user?.preferredLang ?? "en";
                setPreparingSpeechId(id);
                speakMessage(
                  id, text, gender, lang,
                  () => { setSpeakingMessageId(null); },
                  ttsRate, ttsPitch, accessToken ?? undefined,
                  () => { setPreparingSpeechId(null); setSpeakingMessageId(id); },
                  isFeatureEnabled("TTS_ADVANCED", licenseTier),
                  () => toastRef.current?.show("Voice not available for this language on your device. Either install this language in your mobile or login into Imotara account from Settings", "info"),
                );
              }}
              onStopSpeak={() => { stopSpeaking(); setSpeakingMessageId(null); setPreparingSpeechId(null); }}
              onBookmark={handleToggleBookmark}
              onReact={addReaction}
              showTimestamps={showMsgTimestamps}
              showSyncBadge={showSyncBadge}
              reactionsSet={chatReactionsSet}
              crisisThreshold={crisisThresholdSetting}
            />
          );}}
          initialNumToRender={15}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={false}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: messages.length <= 2 ? 20 : 4,
            paddingBottom: 8,
            flexGrow: 1,
            justifyContent: messages.length <= 2 ? "flex-end" : "flex-end",
          }}
          onScroll={handleScroll}
          scrollEventThrottle={50}
          onScrollBeginDrag={() => { userScrolledUpRef.current = true; }}
          onScrollEndDrag={() => {
            if (!DEBUG_UI_ENABLED) return;
            if (pullOffset < -60) handleRefresh();
          }}
          ListHeaderComponent={<View>
          {messages.length === 0 && !initialLoadDone && (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
            </View>
          )}
          {messages.length === 0 && initialLoadDone && (
            <View style={{ paddingTop: 24, paddingBottom: 16 }}>
              <Text
                style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 6 }}
              >
                {toneContext?.user?.name
                  ? `Welcome, ${toneContext.user.name}.`
                  : "Welcome to Imotara."}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>
                Start by sharing how you feel — Imotara listens without judgment.
              </Text>

              {/* Conversation starters */}
              <Text
                style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10, opacity: 0.7 }}
              >
                Not sure where to begin? Tap one:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { emoji: "😔", label: "I'm feeling low today" },
                  { emoji: "😰", label: "I'm stressed and overwhelmed" },
                  { emoji: "😡", label: "Something really upset me" },
                  { emoji: "😕", label: "I feel stuck and don't know what to do" },
                  { emoji: "💬", label: "I just need to talk" },
                  { emoji: "🌟", label: "Something good happened today" },
                ].map(({ emoji, label }) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => handleSend(label)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSoft,
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 14, marginRight: 6 }}>{emoji}</Text>
                    <Text style={{ fontSize: 12, color: colors.textPrimary }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Multilingual starters — shows Imotara understands Indian languages */}
              <Text
                style={{ fontSize: 11, color: colors.textSecondary, marginTop: 16, marginBottom: 8, opacity: 0.7 }}
              >
                Or try in your language:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {[
                  { flag: "🇮🇳", lang: "हिंदी",   text: "मन ठीक नहीं है" },
                  { flag: "🇮🇳", lang: "বাংলা",   text: "মন খারাপ লাগছে" },
                  { flag: "🇮🇳", lang: "தமிழ்",  text: "romba kashtama irukku" },
                  { flag: "🇮🇳", lang: "తెలుగు", text: "chala stress ga undi" },
                  { flag: "🇮🇳", lang: "ಕನ್ನಡ",  text: "tumba bejar agide" },
                  { flag: "🇮🇳", lang: "മലയാളം", text: "valiya vishamamundu" },
                  { flag: "🇮🇳", lang: "ગુજરાતી", text: "man kharap che" },
                  { flag: "🇮🇳", lang: "ਪੰਜਾਬੀ", text: "man kharab aa" },
                  { flag: "🇮🇳", lang: "ଓଡ଼ିଆ",  text: "mana kharap laguchhi" },
                  { flag: "🇮🇳", lang: "मराठी",  text: "man kharab aahe" },
                ].map(({ lang, text }) => (
                  <TouchableOpacity
                    key={lang}
                    onPress={() => handleSend(text)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: "700" }}>{lang}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Return greeting — shown after >24h absence */}
          {activeTier2Banner === "returnGreeting" && (
            <View style={{ marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.35)", backgroundColor: "rgba(99,102,241,0.08)" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: colors.textPrimary }}>Welcome back 👋</Text>
                <TouchableOpacity onPress={() => showCapsuleMenu("Return greeting", () => { setReturnGreetingEnabled(false); AsyncStorage.setItem(RETURN_GREETING_ENABLED_KEY, "0").catch(() => {}); }, () => setShowReturnGreeting(false))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Good to see you again. How are you feeling today?
              </Text>
            </View>
          )}

          {/* UX-4/EN-2 — emotion continuation / topic-specific session greeting */}
          {activeTier2Banner === "sessionGreeting" && sessionGreeting && (
            <View style={{ marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: "rgba(100,116,139,0.3)", backgroundColor: "rgba(51,65,85,0.45)" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 13, color: colors.textPrimary, flex: 1, lineHeight: 19 }}>{sessionGreeting}</Text>
                <TouchableOpacity
                  onPress={() => showCapsuleMenu(
                    "Session greeting",
                    () => { AsyncStorage.setItem(SESSION_GREETING_KEY, "0").catch(() => {}); setSessionGreetingEnabled(false); setSessionGreeting(null); },
                    () => setSessionGreeting(null),
                  )}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 8 }}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {emotionInsightsEnabled && latestMoodHint && moodGlimpseEnabled && !moodGlimpseDismissedSession && (
            <View
              style={{
                marginBottom: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>Mood glimpse</Text>
                <TouchableOpacity onPress={() => showCapsuleMenu("Mood glimpse", () => { setMoodGlimpseEnabled(false); AsyncStorage.setItem(MOOD_GLIMPSE_ENABLED_KEY, "0").catch(() => {}); }, () => setMoodGlimpseDismissedSession(true))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textPrimary,
                  marginTop: 2,
                }}
              >
                {latestMoodHint}
              </Text>

              {DEBUG_UI_ENABLED && (
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  (debug)
                </Text>
              )}
            </View>
          )}

          {DEBUG_UI_ENABLED && devQaRunning && (
            <View
              style={{
                marginBottom: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: "rgba(24, 15, 30, 0.9)",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                QA running…
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                (DEV only) New runs are blocked until this finishes.
              </Text>
            </View>
          )}

          {DEBUG_UI_ENABLED && (
            <View style={{ marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    void runDevQaSuite({ cloudProbe: devQaCloudProbe })
                  }
                  style={{
                    alignSelf: "flex-start",
                    marginRight: 10,
                    marginBottom: 8,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: "rgba(24, 15, 30, 0.9)",
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
                    Run QA 1–10 (DEV)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    void runDevQaCloudOnly({ cloudProbe: devQaCloudProbe })
                  }
                  style={{
                    alignSelf: "flex-start",
                    marginRight: 10,
                    marginBottom: 8,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: "rgba(24, 15, 30, 0.9)",
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
                    Run QA 1–10 (Cloud) (DEV)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    const textToCopy =
                      (DEV_QA_LAST_REPORT || "").trim() ||
                      "No QA report generated yet.";
                    await Clipboard.setStringAsync(textToCopy);
                    debugLog("— IMOTARA DEV QA: copied report to clipboard —");
                  }}
                  style={{
                    alignSelf: "flex-start",
                    marginBottom: 8,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: "rgba(24, 15, 30, 0.9)",
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
                    Copy QA Report (DEV)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ✅ Local quick prompts (DEV) */}
              <View
                style={{
                  marginTop: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: "rgba(24, 15, 30, 0.9)",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      flex: 1,
                    }}
                  >
                    Local quick prompts (DEV) — tap to fill (auto-sends only in
                    Local mode)
                  </Text>

                  {/* ✅ DEV badge: current analysis mode (no behavior change) */}
                  <View
                    style={{
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: "rgba(2, 6, 23, 0.6)",
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.textPrimary }}>
                      {analysisMode === "local" || !cloudSyncAllowed
                        ? "Local"
                        : "Cloud"}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  {LOCAL_DEV_TEST_PROMPTS.map((p, idx) => (
                    <TouchableOpacity
                      key={`local-dev-${idx}`}
                      onPress={() => runLocalDevPrompt(p)}
                      style={{
                        alignSelf: "flex-start",
                        marginRight: 8,
                        marginBottom: 8,
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: "rgba(2, 6, 23, 0.6)",
                        maxWidth: "100%",
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Compatibility Gate (report-only) */}
          {DEBUG_UI_ENABLED &&
            (() => {
              // Find the most recent message (typically bot) that carries compatibility meta
              let compat: any = null;

              for (let i = messages.length - 1; i >= 0; i--) {
                const c = messages[i]?.meta?.compatibility;
                if (c) {
                  compat = c;
                  break;
                }
              }

              if (!compat) return null;

              const summary =
                typeof compat.summary === "string"
                  ? compat.summary
                  : compat.ok === true
                    ? "OK"
                    : "NOT OK";

              return (
                <View
                  style={{
                    marginBottom: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "rgba(24, 15, 30, 0.9)",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: colors.textSecondary,
                      }}
                    >
                      Compatibility Gate
                    </Text>

                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textPrimary,
                      }}
                    >
                      {summary}
                    </Text>
                  </View>

                  <Text
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: colors.textSecondary,
                    }}
                  >
                    {JSON.stringify(compat, null, 2)}
                  </Text>
                </View>
              );
            })()}

          </View>}
          ListFooterComponent={(() => {
            const showIntake = intakeStep > 0 && intakeStep <= 3 && messages.filter((m) => m.from === "user").length === 0;
            if (!isTyping && !showIntake) return null;
            return (
              <View>
                {isTyping && (
                  <Animated.View
                    style={{
                      opacity: typingGlow.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
                      }),
                      transform: [
                        {
                          scale: typingGlow.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.98, 1.03],
                          }),
                        },
                      ],
                    }}
                  >
                    <ImotaraTypingIndicator speed={chatTypingSpeed} />
                  </Animated.View>
                )}
                {showIntake && (
                  <View style={{ marginHorizontal: 12, marginTop: 8, marginBottom: 6, borderRadius: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", backgroundColor: colors.surface, padding: 14 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                      {intakeStep === 1 ? "Step 1 of 3" : intakeStep === 2 ? "Step 2 of 3" : "Step 3 of 3"}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 10 }}>
                      {intakeStep === 1 ? "How are you feeling right now?" : intakeStep === 2 ? "What brings you here today?" : "What would feel most helpful?"}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {(intakeStep === 1
                        ? ["Overwhelmed", "Anxious", "Low", "Okay", "Good", "Just exploring"]
                        : intakeStep === 2
                        ? ["Something happened", "Processing something hard", "Wanting support", "Just checking in", "Curiosity"]
                        : ["Someone to listen", "Gentle guidance", "Space to reflect", "Just being heard"]
                      ).map((chip) => (
                        <TouchableOpacity
                          key={chip}
                          onPress={() => {
                            const updated = [...intakeAnswers] as [string, string, string];
                            updated[intakeStep - 1] = chip;
                            setIntakeAnswers(updated);
                            if (intakeStep < 3) {
                              setIntakeStep((intakeStep + 1) as 1 | 2 | 3);
                            } else {
                              const combined = `I'm feeling ${updated[0].toLowerCase()}. I'm here because: ${updated[1].toLowerCase()}. What I need most: ${updated[2].toLowerCase()}.`;
                              setIntakeStep(0);
                              AsyncStorage.setItem(INTAKE_KEY, "1").catch(() => {});
                              latestInputRef.current = combined;
                              setInput(combined);
                              setTimeout(() => handleSend(combined), 100);
                            }
                          }}
                          style={{ borderRadius: 999, borderWidth: 1, borderColor: "rgba(99,102,241,0.4)", backgroundColor: "rgba(99,102,241,0.12)", paddingHorizontal: 12, paddingVertical: 5 }}
                        >
                          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "500" }}>{chip}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })()}
        />

      </View>

      {/* New messages button — rendered outside scroll container to avoid overlapping messages */}
      {showScrollButton && !isTyping && (
        <Animated.View
          style={{
            alignItems: "flex-end",
            paddingHorizontal: 16,
            paddingVertical: 4,
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          }}
        >
          <TouchableOpacity
            onPress={scrollToBottom}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
              New messages ↓
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Tone reflection moved to Trends tab — check your mood chart there after a session */}

      {/* P4 — Unsent Letter mode banner */}
      {unsentLetterSetup && (
        <View style={{
          marginHorizontal: 12, marginBottom: 6, borderRadius: 12, borderWidth: 1,
          borderColor: isDark ? "rgba(167,139,250,0.3)" : "rgba(139,92,246,0.35)",
          backgroundColor: isDark ? "rgba(167,139,250,0.08)" : "rgba(237,233,254,0.85)",
          paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8,
        }}>
          <Ionicons name="pencil-outline" size={13} color={isDark ? "#a78bfa" : "#6d28d9"} />
          <Text style={{ flex: 1, fontSize: 12, color: isDark ? "#a78bfa" : "#4c1d95" }}>
            Writing to <Text style={{ fontWeight: "700" }}>{unsentLetterSetup.recipientName}</Text> — Imotara will respond in their voice.
          </Text>
          <TouchableOpacity onPress={() => showCapsuleMenu("Unsent Letter mode", () => setUnsentLetterSetup(null), () => setUnsentLetterSetup(null))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-vertical" size={18} color={isDark ? "rgba(167,139,250,0.6)" : "rgba(109,40,217,0.5)"} />
          </TouchableOpacity>
        </View>
      )}

      {/* NF-2 — Grief & Loss space banner */}
      {griefMode && (
        <View style={{
          marginHorizontal: 12, marginBottom: 6, borderRadius: 12, borderWidth: 1,
          borderColor: isDark ? "rgba(251,113,133,0.3)" : "rgba(244,63,94,0.3)",
          backgroundColor: isDark ? "rgba(251,113,133,0.08)" : "rgba(255,228,230,0.85)",
          paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8,
        }}>
          <Ionicons name="heart-outline" size={13} color={isDark ? "#fda4af" : "#be123c"} />
          <Text style={{ flex: 1, fontSize: 12, color: isDark ? "#fda4af" : "#9f1239" }}>
            Grief &amp; Loss space — Imotara will hold this with you, without rushing.
          </Text>
          <TouchableOpacity onPress={() => showCapsuleMenu("Grief & Loss mode", () => setGriefMode(false), () => setGriefMode(false))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-vertical" size={18} color={isDark ? "rgba(253,164,175,0.6)" : "rgba(159,18,57,0.5)"} />
          </TouchableOpacity>
        </View>
      )}

      {/* Trial countdown banner */}
      {activeTier2Banner === "trialCountdown" && licenseExpiresAt && (() => {
        const daysLeft = Math.ceil((new Date(licenseExpiresAt).getTime() - Date.now()) / 86_400_000);
        if (daysLeft <= 0) return null;
        return (
          <View style={{
            marginHorizontal: 12, marginBottom: 6,
            borderRadius: 14,
            backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(255,251,235,0.9)",
            borderWidth: 1, borderColor: isDark ? "rgba(245,158,11,0.25)" : "rgba(217,119,6,0.35)",
            paddingHorizontal: 14, paddingVertical: 10,
            flexDirection: "row", alignItems: "flex-start", gap: 10,
          }}>
            <Text style={{ fontSize: 16, marginTop: 1 }}>⏳</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDark ? "#fcd34d" : "#92400e", fontWeight: "600", fontSize: 13 }}>
                {daysLeft === 1 ? "Last day of your free trial" : `${daysLeft} days left in your free trial`}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                After your trial, Imotara keeps working with on-device replies.
              </Text>
              <TouchableOpacity
                onPress={() => setShowUpgradeSheet(true)}
                style={{ marginTop: 8, alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: isDark ? "rgba(245,158,11,0.20)" : "rgba(217,119,6,0.12)", borderWidth: 1, borderColor: isDark ? "rgba(245,158,11,0.40)" : "rgba(217,119,6,0.35)" }}
              >
                <Text style={{ color: isDark ? "#fcd34d" : "#92400e", fontSize: 12, fontWeight: "600" }}>Upgrade →</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => showCapsuleMenu("Trial countdown", () => { setTrialBannerEnabled(false); AsyncStorage.setItem(TRIAL_BANNER_ENABLED_KEY, "0").catch(() => {}); }, dismissTrialBanner)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Companion insight, weekly recap, collective pulse, grow nudge, and milestone
          cards are now shown in the Trends tab to keep the chat screen clean. */}

      {/* P1 — Open Loop — minimal one-line chip */}
      {activeOpenLoop && (
        <View style={{
          marginHorizontal: 12, marginBottom: 6,
          flexDirection: "row", alignItems: "center", gap: 8,
          borderRadius: 20, borderWidth: 1,
          borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(100,116,139,0.25)",
          backgroundColor: isDark ? "rgba(148,163,184,0.06)" : "rgba(241,245,249,0.9)",
          paddingHorizontal: 12, paddingVertical: 6,
        }}>
          <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
          <Text style={{ flex: 1, fontSize: 11.5, color: colors.textSecondary }} numberOfLines={1}>
            {`Last time you were exploring ${activeOpenLoop.themeName} — still on your mind?`}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const prompt = getLoopPrompt(activeOpenLoop.themeKey);
              dismissLoop(activeOpenLoop.id).catch(() => {});
              setActiveOpenLoop(null);
              setInput(prompt);
              latestInputRef.current = prompt;
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => dismissLoop(activeOpenLoop.id).then(() => setActiveOpenLoop(null)).catch(() => {})}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* UX-3 — contextual unsent-letter hint */}
      {showUnsentHint && unsentHintEnabled && (
        <View style={{
          marginHorizontal: 12, marginBottom: 6, borderRadius: 12, borderWidth: 1,
          borderColor: isDark ? "rgba(167,139,250,0.3)" : "rgba(109,40,217,0.5)",
          backgroundColor: isDark ? "rgba(167,139,250,0.08)" : "#ede9fe",
          paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8,
        }}>
          <Ionicons name="mail-open-outline" size={16} color={isDark ? "#a78bfa" : "#5b21b6"} />
          <Text style={{ flex: 1, fontSize: 11.5, color: isDark ? "rgba(196,181,253,0.9)" : "#3b0764", lineHeight: 16 }}>
            Sounds like there's something you might want to say to someone. The Unsent Letter space is here if you need it.
          </Text>
          <TouchableOpacity
            onPress={() => { setShowUnsentHint(false); setUnsentLetterVisible(true); AsyncStorage.setItem(UNSENT_TRIED_KEY, "1").catch(() => {}); }}
            accessibilityRole="button"
            style={isDark ? undefined : { backgroundColor: "#7c3aed", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 11, color: isDark ? "#a78bfa" : "#ffffff", fontWeight: "700" }}>Try it →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => showCapsuleMenu("Unsent Letter hint", () => { setUnsentHintEnabled(false); AsyncStorage.setItem(UNSENT_HINT_ENABLED_KEY, "0").catch(() => {}); }, () => setShowUnsentHint(false))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="More options" accessibilityRole="button">
            <Ionicons name="ellipsis-vertical" size={18} color={isDark ? "rgba(148,163,184,0.6)" : "rgba(91,33,182,0.5)"} />
          </TouchableOpacity>
        </View>
      )}

      {/* Daily check-in removed from Chat — use the Trends tab FeelSection instead */}

      {/* Message undo toast — 5-second window before API fires */}
      {pendingUndo && (
        <View style={{
          marginHorizontal: 12, marginBottom: 6, borderRadius: 14, overflow: "hidden", borderWidth: 1,
          borderColor: isDark ? "rgba(251,191,36,0.3)" : "rgba(217,119,6,0.35)",
          backgroundColor: isDark ? "rgba(120,53,15,0.35)" : "rgba(254,243,199,0.85)",
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12, color: isDark ? "rgba(253,230,138,0.9)" : "#92400e" }}>Sending in a moment…</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity onPress={handleUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#fbbf24" : "#b45309", textDecorationLine: "underline" }}>Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => showCapsuleMenu("Message undo", () => { setUndoSettingEnabled(false); AsyncStorage.setItem("imotara.undo.enabled.v1", "0").catch(() => {}); }, () => setPendingUndo(null))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="ellipsis-vertical" size={18} color={isDark ? "rgba(253,230,138,0.5)" : "rgba(146,64,14,0.5)"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Sentiment seed chips — shown when chat has messages and input is empty */}
      {sentimentChipsEnabled && !sentimentChipsDismissedSession && messages.length > 0 && input.trim() === "" && (
        <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingBottom: 6, alignItems: "flex-start" }}>
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(SENTIMENT_SEEDS_BY_LANG[toneContext?.user?.preferredLang ?? "en"] ?? SENTIMENT_SEEDS_BY_LANG.en).map((seed) => (
              <TouchableOpacity
                key={seed}
                onPress={() => handleInputChange(seed)}
                style={{
                  borderRadius: 20, borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)",
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  paddingHorizontal: 10, paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 11, color: isDark ? "rgba(161,161,170,0.9)" : "rgba(71,85,105,0.9)" }}>{seed}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => showCapsuleMenu("Sentiment chips", () => { setSentimentChipsEnabled(false); AsyncStorage.setItem("imotara.sentiment.chips.enabled.v1", "0").catch(() => {}); }, () => setSentimentChipsDismissedSession(true))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingLeft: 6 }}>
            <Ionicons name="ellipsis-vertical" size={18} color={isDark ? "rgba(161,161,170,0.5)" : "rgba(71,85,105,0.5)"} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      {discoveryCard && (
        <DiscoveryCard
          cardId={discoveryCard}
          colors={colors}
          onDismiss={dismissDiscoveryCard}
          onAction={handleDiscoveryAction}
        />
      )}

      <ChatInputBar
        input={input}
        inputHeight={inputHeight}
        isSendDisabled={isSendDisabled}
        voiceState={voiceInput.state as any}
        voiceDurationMs={voiceInput.durationMs}
        colors={colors}
        onChangeText={handleInputChange}
        onContentSizeChange={handleContentSizeChange}
        onSend={() => handleSend()}
        onMicPress={handleMicPress}
        firstTimeTip={showFirstTimeTip ? "Just talk — Imotara listens without judgment." : null}
      />
      {renderActionSheet()}

      {/* ── Thread Panel Modal ───────────────────────────────────────── */}
      <Modal
        visible={showThreadPanel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowThreadPanel(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Panel header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>Conversations</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowThreadPanel(false);
                  setUnsentLetterSetup(null);
                  startNewThread();
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: `${colors.primary}22`, borderWidth: 1, borderColor: `${colors.primary}55` }}
                accessibilityRole="button"
                accessibilityLabel="New conversation"
              >
                <Ionicons name="add-outline" size={15} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>New</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowThreadPanel(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Thread list */}
          <FlatList
            data={[...threads].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 40 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>No conversations yet.</Text>
              </View>
            }
            renderItem={({ item: t }) => {
              const isActive = t.id === activeThreadId;
              const msgCount = history.filter((h: any) => (h.threadId ?? "default") === t.id).length;
              const lastMsg = history
                .filter((h: any) => (h.threadId ?? "default") === t.id)
                .sort((a: any, b: any) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0];
              const age = lastMsg
                ? (() => {
                    const diff = Date.now() - lastMsg.timestamp;
                    if (diff < 60_000) return "just now";
                    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
                    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
                    return `${Math.round(diff / 86_400_000)}d ago`;
                  })()
                : new Date(t.createdAt).toLocaleDateString();

              return (
                <TouchableOpacity
                  onPress={() => {
                    setActiveThreadId(t.id);
                    setShowThreadPanel(false);
                  }}
                  onLongPress={() => {
                    Alert.alert(
                      t.title || "Conversation",
                      "What would you like to do?",
                      [
                        {
                          text: "Rename",
                          onPress: () => {
                            if (Platform.OS === "ios") {
                              Alert.prompt(
                                "Rename conversation",
                                "Enter a new name",
                                (newTitle) => {
                                  if (newTitle?.trim()) renameThread(t.id, newTitle.trim());
                                },
                                "plain-text",
                                t.title,
                              );
                            } else {
                              // Android: Alert.prompt not available — use a quick fallback name
                              const ts = new Date().toLocaleDateString();
                              renameThread(t.id, `Conversation ${ts}`);
                            }
                          },
                        },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => {
                            Alert.alert("Delete conversation?", "This removes all messages in this conversation from your device.", [
                              { text: "Cancel", style: "cancel" },
                              { text: "Delete", style: "destructive", onPress: () => deleteThread(t.id) },
                            ]);
                          },
                        },
                        { text: "Cancel", style: "cancel" },
                      ],
                    );
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    marginBottom: 8,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isActive ? `${colors.primary}55` : colors.border,
                    backgroundColor: isActive ? `${colors.primary}14` : "rgba(255,255,255,0.04)",
                  }}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: isActive ? "700" : "500", color: isActive ? colors.primary : colors.textPrimary }}>
                      {t.title || "Conversation"}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      {msgCount} message{msgCount !== 1 ? "s" : ""} · {age}
                    </Text>
                  </View>
                  {isActive && (
                    <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: colors.primary, marginLeft: 10 }} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
      {/* ─────────────────────────────────────────────────────────────── */}

      {/* ── Header overflow menu ─────────────────────────────────────── */}
      <Modal
        visible={showHeaderMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHeaderMenu(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-start", alignItems: "flex-end" }}
          activeOpacity={1}
          onPress={() => setShowHeaderMenu(false)}
        >
          <View
            style={{
              marginTop: insets.top + 52,
              marginRight: 12,
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 0.5,
              borderColor: colors.border,
              minWidth: 220,
              overflow: "hidden",
            }}
          >
            {/* AI mode status (read-only, moved from header) */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: analysisMode === "local" ? "#a78bfa" : "#60a5fa" }} />
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {analysisMode === "local" ? "On-device mode — replies stay on your phone" : "Cloud mode active"}
              </Text>
            </View>

            {/* Search */}
            {messages.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setShowHeaderMenu(false);
                  setShowSearch((v) => {
                    if (v) { setSearchQuery(""); setSearchMatchIndex(0); }
                    return !v;
                  });
                  setTimeout(() => searchInputRef.current?.focus(), 120);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
              >
                <Ionicons name={showSearch ? "search" : "search-outline"} size={17} color={showSearch ? colors.primary : colors.textSecondary} />
                <Text style={{ color: showSearch ? colors.primary : colors.textPrimary, fontSize: 14 }}>
                  {showSearch ? "Close search" : "Search messages"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Bookmarks filter */}
            {bookmarks.size > 0 && (
              <TouchableOpacity
                onPress={() => { setShowHeaderMenu(false); setShowBookmarksOnly((v) => !v); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
              >
                <Ionicons name={showBookmarksOnly ? "star" : "star-outline"} size={17} color={showBookmarksOnly ? "#fde68a" : colors.textSecondary} />
                <Text style={{ color: showBookmarksOnly ? "#fde68a" : colors.textPrimary, fontSize: 14 }}>
                  {showBookmarksOnly ? "Show all messages" : "Show bookmarks"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Breathing exercise */}
            <TouchableOpacity
              onPress={() => { setShowHeaderMenu(false); setBreathingVisible(true); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
            >
              <Ionicons name="pulse-outline" size={17} color={colors.textSecondary} />
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>Breathing exercise</Text>
            </TouchableOpacity>

            {/* Unsent Letter */}
            <TouchableOpacity
              onPress={() => {
                setShowHeaderMenu(false);
                setUnsentLetterVisible(true);
                AsyncStorage.setItem(UNSENT_TRIED_KEY, "1").catch(() => {});
                setShowUnsentHint(false);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
            >
              <Ionicons name="pencil-outline" size={17} color={unsentLetterSetup ? "#a78bfa" : colors.textSecondary} />
              <Text style={{ color: unsentLetterSetup ? "#a78bfa" : colors.textPrimary, fontSize: 14 }}>Unsent letter</Text>
            </TouchableOpacity>

            {/* NF-2 — Grief & Loss space */}
            <TouchableOpacity
              onPress={() => {
                setShowHeaderMenu(false);
                setGriefMode((v) => !v);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
            >
              <Ionicons name="heart-outline" size={17} color={griefMode ? "#fda4af" : colors.textSecondary} />
              <Text style={{ color: griefMode ? "#fda4af" : colors.textPrimary, fontSize: 14 }}>{griefMode ? "Exit grief & loss space" : "Grief & loss space"}</Text>
            </TouchableOpacity>

            {/* Dark / Light mode toggle */}
            <TouchableOpacity
              onPress={() => { setShowHeaderMenu(false); toggleTheme(); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
            >
              <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={17} color={colors.textSecondary} />
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{isDark ? "Switch to light mode" : "Switch to dark mode"}</Text>
            </TouchableOpacity>

            {/* Clear chat */}
            {messages.length > 0 && (
              <TouchableOpacity
                onPress={() => { setShowHeaderMenu(false); handleClearLocalChat(); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 }}
              >
                <Ionicons name="trash-outline" size={17} color="#f87171" />
                <Text style={{ color: "#f87171", fontSize: 14 }}>Clear chat</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
      {/* ─────────────────────────────────────────────────────────────── */}

      <BreathingModal
        visible={breathingVisible}
        onClose={() => setBreathingVisible(false)}
      />

      <UnsentLetterModal
        visible={unsentLetterVisible}
        colors={colors}
        onStart={(setup) => {
          setUnsentLetterSetup(setup);
          setUnsentLetterVisible(false);
          startNewThread(`Unsent letter to ${setup.recipientName}`);
          const prefill = `Dear ${setup.recipientName},\n\n`;
          setInput(prefill);
          latestInputRef.current = prefill;
        }}
        onCancel={() => setUnsentLetterVisible(false)}
      />

      {/* Non-intrusive sign-in prompt — appears after first message, one-time only */}
      <SignInPrompt messageCount={messages.length} />

      {showUpgradeSheet && (
        <UpgradeSheet
          visible={true}
          onClose={() => setShowUpgradeSheet(false)}
          currentTier={licenseTier ?? null}
          onPurchaseComplete={async () => {
            setShowUpgradeSheet(false);
            await refreshLicense().catch(() => {});
            try {
              const raw = await AsyncStorage.getItem("imotara_license_tier_v1");
              const VALID = ["FREE", "PLUS", "PREMIUM", "FAMILY", "EDU", "ENTERPRISE"];
              if (raw && VALID.includes(raw) && setLicenseTier) setLicenseTier(raw as any);
            } catch { /* fail-open */ }
          }}
        />
      )}

      {/* Error / info toast — non-intrusive, auto-dismisses */}
      <Toast ref={toastRef} />
      </View>{/* end iPad centering wrapper */}

      {/* Companion quick panel — swipe right to open, swipe left or tap backdrop to close */}
      <CompanionQuickPanel
        visible={companionPanelVisible}
        onClose={() => setCompanionPanelVisible(false)}
        toneContext={toneContext}
        setToneContext={setToneContext}
        accessToken={accessToken ?? undefined}
      />

      {/* Plan & Support quick panel — swipe left to open, swipe right or tap backdrop to close */}
      <PlanSupportQuickPanel
        visible={planPanelVisible}
        onClose={() => setPlanPanelVisible(false)}
        licenseTier={licenseTier}
        licenseExpiresAt={licenseExpiresAt}
        emotionInsightsEnabled={emotionInsightsEnabled}
        setEmotionInsightsEnabled={setEmotionInsightsEnabled}
        refreshLicense={refreshLicense}
        setLicenseTier={setLicenseTier}
      />
    </View>
    </KeyboardAvoidingView>
  );
}
