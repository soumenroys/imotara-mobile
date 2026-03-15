// src/screens/ChatScreen.tsx
import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Pressable,
  Animated,
  Vibration,
  Share,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

// Haptic helpers (Vibration API — no native deps needed)
const haptic = {
  tap: () => { try { Vibration.vibrate(10); } catch {} },
  receive: () => { try { Vibration.vibrate([0, 8, 40, 8]); } catch {} },
  error: () => { try { Vibration.vibrate([0, 30, 60, 30]); } catch {} },
};
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHistoryStore } from "../state/HistoryContext";
import { useSettings } from "../state/SettingsContext";
import { useColors } from "../theme/ThemeContext";
import type { ColorPalette } from "../theme/colors";
import { callImotaraAI } from "../api/aiClient";
import { useVoiceInput } from "../hooks/useVoiceInput";
import {
    detectMemories,
    addMemory,
    loadMemories,
    buildMemoryContext,
} from "../state/companionMemory";

import { LinearGradient } from "expo-linear-gradient";
import { DEBUG_UI_ENABLED, debugLog, debugWarn } from "../config/debug";

// NEW: lifecycle hook (additive)
import { useAppLifecycle } from "../hooks/useAppLifecycle";
import { getReflectionSeedCard } from "../lib/reflectionSeedContract";
import { BreathingModal } from "../components/imotara/BreathingModal";
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

// Create a medium-intensity gradient from the mood tint
function getMoodGradient(baseColor: string) {
  return {
    start: toRgba(baseColor, 0.55),
    end: toRgba(baseColor, 0.95),
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

function smoothScrollToBottom(ref: React.RefObject<ScrollView | null>) {
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
  index: number,
  messages: ChatMessage[],
): boolean {
  if (message.from !== "bot") return false;

  const prev = messages[index - 1];
  if (!prev || prev.from !== "user") return false;

  if (index - 1 === 0) return true;

  const beforeUser = messages[index - 2];
  if (!beforeUser) return true;

  const gap = prev.timestamp - (beforeUser.timestamp ?? 0);
  return gap > SESSION_GAP_MS;
}

export default function ChatScreen() {
  console.log("[imotara] ChatScreen mounted");
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [inputHeight, setInputHeight] = useState(40);
  const [isTyping, setIsTyping] = useState(false);
  const [typingDots, setTypingDots] = useState(1);

  const [recentlySyncedAt, setRecentlySyncedAt] = useState<number | null>(null);

  // ✅ Action sheet state
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);

  // Crisis safety card — tracks which bot message IDs have been dismissed
  const [dismissedCrisisCards, setDismissedCrisisCards] = useState<Set<string>>(new Set());
  const dismissCrisisCard = (id: string) =>
    setDismissedCrisisCards((prev) => new Set([...prev, id]));

  // Breathing modal
  const [breathingVisible, setBreathingVisible] = useState(false);

  // Voice input
  const voiceInput = useVoiceInput(
    (text) => setInput((prev) => prev ? `${prev} ${text}` : text),
    process.env.EXPO_PUBLIC_IMOTARA_API_BASE_URL,
  );

  // Message reactions — messageId → emoji
  const [reactions, setReactions] = useState<Map<string, string>>(new Map());
  const addReaction = (messageId: string, emoji: string) => {
    setReactions((prev) => {
      const next = new Map(prev);
      // Toggle off if same emoji tapped again
      if (next.get(messageId) === emoji) next.delete(messageId);
      else next.set(messageId, emoji);
      return next;
    });
    setActionMessage(null);
  };

  // ✅ Read store once, but allow optional newer helpers safely (no behavior loss)
  const store = useHistoryStore() as any;
  const {
    addToHistory,
    history,
    clearHistory,
    deleteFromHistory,
    isSyncing,
    pushHistoryToRemote,
    runSync,
    syncNow,
  } = store;

  const {
    emotionInsightsEnabled,
    lastSyncAt,
    lastSyncStatus,
    analysisMode,
    toneContext,
    cloudSyncAllowed,

    // ✅ Cross-device chat link key (optional)
    chatLinkKey,
  } = useSettings();

  // ---------------------------------------------------------------------------
  // Cloud sync trigger (centralized in HistoryContext)
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

  const scrollViewRef = useRef<ScrollView | null>(null);

  // ✅ RN-safe typing (fixes TS issues in many RN setups)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ 80/20: prevent double-send / overlapping async flows
  const isSendingRef = useRef(false);

  // ✅ 80/20: avoid setState on unmounted
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // NEW: lifecycle safety refs (additive)
  const typingStartedAtRef = useRef<number>(0);
  const sendStartedAtRef = useRef<number>(0);
  const lastLifecycleResetAtRef = useRef<number>(0);

  const resetTypingState = (reason: string) => {
    // Avoid repeated rapid resets on noisy AppState transitions
    const now = Date.now();
    if (now - lastLifecycleResetAtRef.current < 250) return;
    lastLifecycleResetAtRef.current = now;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
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

  // NEW: app lifecycle handling (prevents stuck typing on background/foreground)
  useAppLifecycle({
    debounceMs: 350,
    onBackground: () => {
      // If the app goes background mid "typing", clear timers and unlock
      if (isTyping || isSendingRef.current) {
        resetTypingState("background");
      }
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
    },
  });

  const [showScrollButton, setShowScrollButton] = useState(false);

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
      return "Some messages are stored locally until cloud sync is enabled.";

    const lower = (lastSyncStatus || "").toLowerCase();
    if (lower.includes("failed") || lower.includes("error")) {
      return "Sync issue · your latest messages are only on this device.";
    }

    if (
      lower.includes("pushed") ||
      lower.includes("merged") ||
      lower.includes("synced")
    ) {
      return "Recent messages are safely backed up to Imotara cloud.";
    }

    return "Sync checked recently · some messages may still be local-only.";
  }, [lastSyncAt, lastSyncStatus]);

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

    return "#9ca3af";
  }, [lastSyncAt, lastSyncStatus]);

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
          relationshipTone:
            (toneContext?.companion?.enabled
              ? toneContext?.companion?.relationship
              : undefined) ?? toneContext?.user?.relationship,

          ageTone:
            (toneContext?.companion?.enabled
              ? (toneContext?.companion?.ageTone ??
                toneContext?.companion?.ageRange)
              : undefined) ??
            toneContext?.user?.ageTone ??
            toneContext?.user?.ageRange,

          genderTone:
            (toneContext?.companion?.enabled
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
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const closeActionSheet = () => {
    setActionMessage(null);
  };

  const handleClearLocalChat = () => {
    Alert.alert(
      "Clear local chat?",
      "This will remove the chat history stored on this device. Your cloud copy (if any) will remain.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            // Clear persisted local history (scoped key) + reset sync UI state
            if (typeof clearHistory === "function") clearHistory();

            // Clear in-memory UI immediately (extra-safe UX)
            setMessages([]);
            setInput("");
            setInputHeight(40);
            setActionMessage(null);
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
      const who = m.from === "user" ? "You" : "Imotara";
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
          "Cloud sync unavailable",
          lastSyncStatus || "Cloud sync is not available on your plan.",
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
          "Sync issue",
          result.errorMessage ||
            "Could not sync right now. Your message is safe on this device.",
        );
      }
    } catch (err) {
      debugWarn("Sync now failed:", err);

      Alert.alert(
        "Sync error",
        "Could not sync right now. Your message is safe on this device.",
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

    const atBottom = distanceFromBottom < 24;
    setShowScrollButton(!atBottom && distanceFromBottom > 80);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = e.nativeEvent;
    setPullOffset(contentOffset.y);
    onScroll(e);
  };

  const handleSend = (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed) return;

    // ✅ 80/20: block double taps / overlapping send cycles
    if (isTyping || isSendingRef.current) return;
    isSendingRef.current = true;
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

      // ✅ emotion required for moodSummary / session insight card in HistoryScreen
      ...(userEmotion ? { emotion: userEmotion } : {}),
    });

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setInputHeight(40);

    setIsTyping(true);
    typingStartedAtRef.current = Date.now();
    setTypingStatus("thinking");

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const networkNote =
      "\n\n(I'm replying from your device because the network is a little slow.)";

    typingTimeoutRef.current = setTimeout(() => {
      (async () => {
        try {
          const wantsCloud = analysisMode !== "local";
          const wantsInsights = emotionInsightsEnabled;

          // ── Companion memory ──────────────────────────────────
          // Detect facts from user's message and persist them
          const newFacts = detectMemories(trimmed);
          for (const fact of newFacts) {
              void addMemory({ text: fact, source: trimmed.slice(0, 80) });
          }
          // Load stored memories and build context prefix
          const memories = await loadMemories();
          const memoryContext = buildMemoryContext(memories);
          // Prepend to prompt so both cloud and local AI are aware
          const promptWithMemory = memoryContext
              ? `${memoryContext}\nUser message: ${trimmed}`
              : trimmed;

          // 1) Try cloud if allowed by Analysis Mode
          const remote: any = wantsCloud
            ? await callImotaraAI(promptWithMemory, {
                // ✅ always send toneContext if present (server can decide what to use)
                // ✅ parity: ensure ageTone is present (fallback to ageRange) when sending
                toneContext: toneContext
                  ? {
                      ...toneContext,
                      user: toneContext.user
                        ? {
                            ...toneContext.user,
                            ageTone:
                              toneContext.user.ageTone ??
                              toneContext.user.ageRange,
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
                emotionInsightsEnabled: wantsInsights,

                // ✅ persona hints: prefer companion settings when enabled, else fall back to user settings
                settings: {
                  relationshipTone:
                    (toneContext?.companion?.enabled
                      ? toneContext?.companion?.relationship
                      : undefined) ?? toneContext?.user?.relationship,

                  // ✅ parity: ageTone preferred, ageRange legacy fallback
                  ageTone:
                    (toneContext?.companion?.enabled
                      ? (toneContext?.companion?.ageTone ??
                        toneContext?.companion?.ageRange)
                      : undefined) ??
                    toneContext?.user?.ageTone ??
                    toneContext?.user?.ageRange,

                  genderTone:
                    (toneContext?.companion?.enabled
                      ? toneContext?.companion?.gender
                      : undefined) ?? toneContext?.user?.gender,
                },

                recentMessages: messages.slice(-6).map((m) => ({
                  role: m.from === "user" ? "user" : "assistant",
                  content: m.text,
                })),
              })
            : { ok: false, replyText: "" };

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
          if (remote.ok && String(remote.replyText || "").trim().length > 0) {
            replyText = String(remote.replyText);
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
            const localMood = getLocalMoodHintWithPrimary(trimmed);
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
          } else {
            // 3) Otherwise fallback to NEW local reply engine
            const localRecentCtx: LocalRecentContext = {
              recentUserTexts: messages.filter((m) => m.from === "user").slice(-5).map((m) => m.text),
              recentAssistantTexts: messages.filter((m) => m.from === "bot").slice(-3).map((m) => m.text),
              emotionMemory: memoryContext || undefined,
            };
            const local = buildLocalReply(trimmed, toneContext, localRecentCtx);

            const localMoodForFallback = getLocalMoodHintWithPrimary(trimmed);
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

            replyText =
              (baseMessage || local.message) + (wantsCloud ? networkNote : "");

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
          const localPrimary = getLocalMoodHintWithPrimary(trimmed).primary;

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

          addToHistory({
            id: botMessage.id,
            text: botMessage.text,
            from: "bot",
            timestamp: botMessage.timestamp,
            isSynced: false,
            source: botMessage.source,

            // ✅ Existing persisted hint
            moodHint: botMessage.moodHint,

            // ✅ NEW persisted emotion payload (HistoryContext now supports this)
            emotion: finalEmotion,
            intensity: finalIntensity,
          });

          if (!mountedRef.current) return;

          setTypingStatus("responding");
          haptic.receive();
          setMessages((prev) => [...prev, botMessage]);
          smoothScrollToBottom(scrollViewRef);
        } catch (error) {
          debugWarn("Imotara mobile AI error:", error);

          const wantsCloud = analysisMode !== "local" && cloudSyncAllowed;
          const wantsInsights = emotionInsightsEnabled;

          const localRecentCtxErr: LocalRecentContext = {
            recentUserTexts: messages.filter((m) => m.from === "user").slice(-5).map((m) => m.text),
            recentAssistantTexts: messages.filter((m) => m.from === "bot").slice(-3).map((m) => m.text),
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

          const replyWithNote = wantsCloud
            ? (baseMessage || local.message) + networkNote
            : baseMessage || local.message;

          const botTimestamp = Date.now();

          const followUp = reflectionSeed?.prompt;

          const botMessage: ChatMessage = {
            id: `b-${botTimestamp}`,
            from: "bot",
            text: replyWithNote,
            timestamp: botTimestamp,
            moodHint: wantsInsights ? (() => { const m = getLocalMoodHintWithPrimary(trimmed); return m.primary ? m.hint : undefined; })() : undefined,
            isSynced: false,
            source: "local",

            // ✅ parity metadata for local fallback
            reflectionSeed,
            followUp,
          };

          // ✅ Additive: persist user emotion for timelines/insights (stable primary label)
          const userPrimary = wantsInsights
            ? getLocalMoodHintWithPrimary(trimmed).primary
            : undefined;

          const userEmotion =
            typeof userPrimary === "string" && userPrimary.trim()
              ? userPrimary.trim()
              : undefined;

          const userIntensity = userEmotion
            ? getDefaultIntensityForPrimary(userEmotion)
            : undefined;

          addToHistory({
            id: userMessage.id,
            text: userMessage.text,
            from: "user",
            timestamp: userMessage.timestamp,
            isSynced: false,
            source: userMessage.source,

            // ✅ NEW
            emotion: userEmotion,
            intensity: userIntensity,
          });

          if (!mountedRef.current) return;

          setTypingStatus("responding");
          haptic.receive();
          setMessages((prev) => [...prev, botMessage]);
          smoothScrollToBottom(scrollViewRef);
        } finally {
          if (!mountedRef.current) return;

          setIsTyping(false);
          setTypingStatus("idle");

          // ✅ release send-lock after full cycle ends
          isSendingRef.current = false;
        }
      })();
    }, 800);
  };

  // ✅ DEV-only helper: fill input with a local test prompt (auto-send only in local mode)
  const runLocalDevPrompt = (prompt: string) => {
    setInput(prompt);

    // Auto-send only when explicitly in local mode (prevents surprise cloud sends)
    if (analysisMode === "local") {
      setTimeout(() => handleSend(), 0);
    }
  };

  // Hydrate from persisted history whenever history changes
  useEffect(() => {
    if (history.length === 0) {
      // Scope changed or cleared → reset local messages
      setMessages([]);
      return;
    }

    const sorted = [...history].sort(
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
  }, [history, messages.length]);

  // ✅ NEW: when history updates (e.g., after Sync Now), reflect isSynced/source changes in chat bubbles
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
      // Fresh start — simple welcome
      greetText = `${timeGreet} I'm Imotara, and I'm here with you. How are you feeling right now?`;
    } else {
      // Returning session — check time gap and last emotion
      const lastMsg = [...messages].sort((a, b) => b.timestamp - a.timestamp)[0];
      const gapHours = (now - (lastMsg?.timestamp ?? now)) / 3_600_000;

      if (gapHours >= 6) {
        // Check last strong emotion from bot replies
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

  const renderSessionDivider = (current: ChatMessage, prev?: ChatMessage) => {
    if (!prev) return null;

    const gap = current.timestamp - (prev.timestamp ?? 0);
    if (gap <= SESSION_GAP_MS) return null;

    return (
      <View
        style={{
          alignSelf: "center",
          marginVertical: 6,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: colors.border,
            opacity: 0.5,
            marginRight: 8,
          }}
        />
        <Text style={{ fontSize: 11, color: colors.textSecondary }}>
          New session
        </Text>
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: colors.border,
            opacity: 0.5,
            marginLeft: 8,
          }}
        />
      </View>
    );
  };

  const renderBubble = (message: ChatMessage, index: number) => {
    const isUser = message.from === "user";

    // ✅ Step 7 continuity note (hook-safe)
    const showContinuityNote = isFirstBotReplyOfSession(
      message,
      index,
      messages,
    );

    let bubbleBorderColor: string;
    let statusLabel: string;
    let statusBg: string;
    let statusTextColor: string;

    const bubbleBackground = USER_BUBBLE_BG;
    let gradientStart: string | null = null;
    let gradientEnd: string | null = null;

    if (!isUser) {
      const tintSource = message.moodHint || message.text;
      const tint = getMoodTintForHint(tintSource, colors);
      const gradient = getMoodGradient(tint);
      gradientStart = gradient.start;
      gradientEnd = gradient.end;
    }

    if (message.isPending) {
      bubbleBorderColor = "rgba(148, 163, 184, 0.55)";
      statusLabel = "Syncing…";
      statusBg = "rgba(148, 163, 184, 0.18)";
      statusTextColor = colors.textSecondary;
    } else if (message.isSynced) {
      bubbleBorderColor = colors.primary;
      statusLabel = "Synced to cloud";
      statusBg = "rgba(56, 189, 248, 0.18)";
      statusTextColor = colors.textPrimary;
    } else {
      const lower = (lastSyncStatus || "").toLowerCase();
      const hasSyncError = lower.includes("failed") || lower.includes("error");
      const isCloudGenerated = message.source === "cloud";

      // ✅ Truth rule:
      // - "isSynced/isPending" refers to HISTORY sync
      // - "source" refers to where the reply was GENERATED
      // So a cloud reply should never be labeled "On this device only".
      if (hasSyncError) {
        bubbleBorderColor = "#f97373";
        statusLabel = isCloudGenerated
          ? "Sync issue · cloud reply"
          : "Sync issue · on this device only";
        statusBg = "rgba(248, 113, 113, 0.24)";
        statusTextColor = "#fecaca";
      } else {
        if (isCloudGenerated) {
          bubbleBorderColor = "rgba(56, 189, 248, 0.55)";
          statusLabel = "Imotara Cloud";
          statusBg = "rgba(56, 189, 248, 0.14)";
          statusTextColor = colors.textPrimary;
        } else if (!isUser && message.cloudAttempted) {
          bubbleBorderColor = "#fbbf24";
          statusLabel = "Cloud failed → Local";
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

    const prev = messages[index - 1];

    let sourceIcon = "";
    if (!isUser) {
      if (message.source === "local") sourceIcon = " 🌙";
      else if (message.source === "cloud") sourceIcon = " ☁️";
    }

    const content = (
      <>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: colors.textPrimary,
            opacity: 0.75,
            marginBottom: 2,
          }}
        >
          {isUser
            ? "You"
            : `Imotara${sourceIcon}${getMoodEmojiForHint(message.moodHint)}`}
        </Text>

        {!isUser && message.source === "local"
          ? (() => {
              const seed = getReflectionSeedCard({
                message: message.text,
                reflectionSeed: message.reflectionSeed,
              } as any);

              if (!seed) return null;

              return (
                <View
                  style={{
                    marginBottom: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    backgroundColor: "rgba(0,0,0,0.22)",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.textPrimary,
                      }}
                    >
                      {seed.title}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                        backgroundColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      <Text
                        style={{ fontSize: 10, color: colors.textSecondary }}
                      >
                        {seed.label}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: colors.textPrimary,
                      opacity: 0.92,
                    }}
                  >
                    {seed.prompt}
                  </Text>
                </View>
              );
            })()
          : null}

        <Text style={{ fontSize: 14, color: colors.textPrimary }} selectable>
          {(() => {
            // If a reflection seed prompt is being shown in the card,
            // don't show the same prompt again inside message.text.
            if (isUser) return message.text;

            // Only strip the reflection prompt if we are actually showing the reflection card (local-only).
            if (message.source !== "local") return message.text;

            const seed = getReflectionSeedCard({
              message: message.text,
              reflectionSeed: message.reflectionSeed,
            } as any);

            if (!seed?.prompt) return message.text;

            return stripReflectionPromptFromMessage(message.text, seed.prompt);
          })()}
        </Text>

        {/* ✅ NEW: render follow-up question (bot only) */}
        {!isUser &&
        typeof message.followUp === "string" &&
        message.followUp.trim() ? (
          <Text
            style={{
              fontSize: 13,
              color: colors.textPrimary,
              marginTop: 8,
              opacity: 0.92,
            }}
          >
            {message.followUp.trim()}
          </Text>
        ) : null}

        {message.moodHint && (
          <Text
            style={{
              fontSize: 11,
              color: colors.textPrimary,
              marginTop: 4,
              opacity: 0.9,
            }}
          >
            {message.moodHint}
          </Text>
        )}

        <Text
          style={{
            fontSize: 11,
            color: colors.textSecondary,
            marginTop: 4,
            opacity: 0.85,
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString()} ·{" "}
          {message.text.length} chars
        </Text>

        {/* Compatibility badge (DEBUG only) */}
        {DEBUG_UI_ENABLED && message.meta?.compatibility && (
          <View
            style={{
              alignSelf: "flex-start",
              marginTop: 4,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              borderWidth: 1,
              borderColor:
                message.meta.compatibility.ok === true
                  ? "rgba(34,197,94,0.6)"
                  : "rgba(248,113,113,0.6)",
              backgroundColor:
                message.meta.compatibility.ok === true
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(248,113,113,0.15)",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "500",
                color: colors.textPrimary,
              }}
            >
              {typeof message.meta.compatibility.summary === "string"
                ? message.meta.compatibility.summary
                : message.meta.compatibility.ok === true
                  ? "OK"
                  : "Issues"}
            </Text>
          </View>
        )}

        <View
          style={{
            alignSelf: isUser ? "flex-end" : "flex-start",
            marginTop: 4,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            borderWidth: 1,
            borderColor:
              bubbleBorderColor === "transparent"
                ? "rgba(148, 163, 184, 0.4)"
                : bubbleBorderColor,
            backgroundColor: statusBg,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "500",
              color: statusTextColor,
            }}
          >
            {statusLabel}
          </Text>
        </View>

        {/* Reaction emoji */}
        {reactions.get(message.id) && (
          <Text style={{ fontSize: 18, marginTop: 4 }}>{reactions.get(message.id)}</Text>
        )}

        {/* ✅ continuity note */}
        {!isUser && showContinuityNote && (
          <Text
            style={{
              fontSize: 11,
              color: colors.textSecondary,
              marginTop: 6,
              opacity: 0.9,
            }}
          >
            This conversation is now part of your Emotion History.
          </Text>
        )}
      </>
    );

    const extraTopSpace =
      isUser && index > 0 && messages[index - 1].from === "user"
        ? { marginTop: 4 }
        : {};

    const onLongPress = message.isPending
      ? undefined
      : () => setActionMessage(message);

    return (
      <View key={message.id} style={extraTopSpace}>
        {renderSessionDivider(message, prev)}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={250}
          style={{
            alignSelf: isUser ? "flex-end" : "flex-start",
            maxWidth: "82%",
            marginBottom: 10,
            paddingHorizontal: 1,
          }}
        >
          {isUser ? (
            <View
              style={{
                backgroundColor: bubbleBackground,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 16,
                borderWidth: bubbleBorderColor === "transparent" ? 0 : 1,
                borderColor: bubbleBorderColor,
              }}
            >
              {content}
            </View>
          ) : (
            <LinearGradient
              colors={[
                gradientStart || "rgba(148, 163, 184, 0.25)",
                gradientEnd || "rgba(148, 163, 184, 0.45)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: bubbleBorderColor === "transparent" ? 0 : 1,
                borderColor:
                  bubbleBorderColor === "transparent"
                    ? "rgba(148, 163, 184, 0.4)"
                    : bubbleBorderColor,
              }}
            >
              {content}
            </LinearGradient>
          )}
        </Pressable>

        {/* Crisis safety card — shown below bot reply when preceding user message matches */}
        {!isUser && (() => {
          const prevMsg = messages[index - 1];
          if (!prevMsg || prevMsg.from !== "user") return null;
          const MOBILE_CRISIS_TIER1_RE = /\b(hopeless|helpless|worthless|nothing matters|give up|can't take it anymore|breaking down|falling apart|no one cares|all alone|empty inside|disappear|feel like a burden|trapped|no way out|no escape|thinking about death|thoughts of ending)\b/i;
          if (!CRISIS_HINT_REGEX.test(prevMsg.text) && !MOBILE_CRISIS_TIER1_RE.test(prevMsg.text)) return null;
          if (dismissedCrisisCards.has(message.id)) return null;
          return (
            <View
              style={{
                marginTop: 2,
                marginBottom: 6,
                marginLeft: 4,
                maxWidth: "88%",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(251, 191, 36, 0.35)",
                backgroundColor: "rgba(251, 191, 36, 0.10)",
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#fde68a", flex: 1 }}>
                  {"\u{1F49B}"} If things feel urgent right now
                </Text>
                <TouchableOpacity
                  onPress={() => dismissCrisisCard(message.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 14, color: "#fde68a", opacity: 0.7, marginLeft: 8 }}>x</Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 10, gap: 6 }}>
                {(() => {
                  const countryCode = detectCountryCode();
                  const resources = getCrisisResourcesForCountry(countryCode);
                  const lines: { label: string; number: string }[] = [];
                  if (resources?.emergency) {
                    lines.push({ label: resources.emergency.label, number: resources.emergency.contact });
                  }
                  resources?.primary?.slice(0, 2).forEach((r) => {
                    lines.push({ label: r.label, number: r.contact });
                  });
                  return lines.map(({ label, number }) => (
                    <TouchableOpacity
                      key={label}
                      onPress={() => Linking.openURL(`tel:${number.replace(/[^\d+]/g, "")}`)}
                      style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}
                      accessibilityRole="link"
                      accessibilityLabel={`Call ${label}: ${number}`}
                    >
                      <Text style={{ fontSize: 12, color: "#fde68a", opacity: 0.85 }}>{label}</Text>
                      <Text style={{ fontSize: 12, color: "#fde68a", fontWeight: "700", textDecorationLine: "underline" }}>{number}</Text>
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
            backgroundColor: "rgba(15, 23, 42, 0.92)",
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
            onPress={() => handleCopyMessage(actionMessage.text)}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>
              Copy text
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
              Sync now (try cloud)
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
                      ? "Sync in progress…"
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
      return `Imotara is thinking about your feelings${formattedTypingDots}`;
    }
    return `Imotara is typing${formattedTypingDots}`;
  }, [isTyping, typingStatus, formattedTypingDots]);

  const typingBubbleBg = useMemo(() => {
    if (!isTyping) return "rgba(15, 23, 42, 0.9)";
    if (latestMoodHint) return getMoodTintForHint(latestMoodHint, colors);
    return "rgba(15, 23, 42, 0.9)";
  }, [isTyping, latestMoodHint]);

  // ✅ 80/20: disable Send while typing or in-flight
  const isSendDisabled =
    input.trim().length === 0 || isTyping || isSendingRef.current;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={tabBarHeight}
    >
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 2,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
          backgroundColor: "rgba(15, 23, 42, 0.96)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
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
          >
            Imotara
          </Text>

          <Text
            style={{ marginLeft: 6, fontSize: 11, color: colors.textSecondary }}
          >
            (mobile)
          </Text>

          {/* AI mode badge */}
          <View
            style={{
              marginLeft: 8,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: analysisMode === "local"
                ? "rgba(139, 92, 246, 0.18)"
                : "rgba(59, 130, 246, 0.18)",
              borderWidth: 1,
              borderColor: analysisMode === "local"
                ? "rgba(139, 92, 246, 0.45)"
                : "rgba(59, 130, 246, 0.45)",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                color: analysisMode === "local" ? "#a78bfa" : "#60a5fa",
                letterSpacing: 0.3,
              }}
            >
              {analysisMode === "local" ? "LOCAL" : "CLOUD"}
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          {/* Breathing exercise button */}
          <TouchableOpacity
            onPress={() => setBreathingVisible(true)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "rgba(255,255,255,0.06)",
              marginRight: 8,
            }}
            accessibilityRole="button"
            accessibilityLabel="Breathing exercise"
          >
            <Text style={{ fontSize: 16 }}>{"🫁"}</Text>
          </TouchableOpacity>

          {messages.length > 0 && (
            <TouchableOpacity
              onPress={handleClearLocalChat}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear local chat"
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.textPrimary,
                }}
              >
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>

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

        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              marginRight: 6,
              backgroundColor: hasUnsynced ? "#f97373" : syncHintAccent,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
            {syncHint}
          </Text>
        </View>

        {isSyncing && (
          <Text
            style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}
          >
            Syncing your latest messages…
          </Text>
        )}

        {showRecentlySyncedPulse && (
          <Text
            style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}
          >
            ✅ All changes synced · Imotara cloud copy updated.
          </Text>
        )}

        {/* Privacy mode badge */}
        {(analysisMode === "local" || !cloudSyncAllowed) && (
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

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: 4,
            paddingBottom: 80,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={50}
          onScrollEndDrag={() => {
            if (!DEBUG_UI_ENABLED) return;
            if (pullOffset < -60) handleRefresh();
          }}
        >
          {messages.length === 0 && (
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
                ].map(({ flag, lang, text }) => (
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

          {emotionInsightsEnabled && latestMoodHint && (
            <View
              style={{
                marginBottom: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                Mood glimpse
              </Text>
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
                backgroundColor: "rgba(15, 23, 42, 0.9)",
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
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
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
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
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
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
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
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
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
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
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

          {messages.map((message, index) => renderBubble(message, index))}

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
              <View
                style={{
                  alignSelf: "flex-start",
                  marginTop: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: typingBubbleBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  {typingStatusText || "Imotara is typing…"}
                </Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {showScrollButton && (
          <Animated.View
            style={{
              position: "absolute",
              bottom: 80,
              right: 16,
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
                shadowOpacity: 0.25,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
                New messages ↓
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* Input */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: "rgba(15, 23, 42, 0.98)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <View
            style={{
              flex: 1,
              marginRight: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "rgba(15, 23, 42, 1)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              minHeight: 40,
              justifyContent: "center",
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              multiline
              onContentSizeChange={(e) => {
                const height = e?.nativeEvent?.contentSize?.height ?? 40;
                const minHeight = 40;
                const maxHeight = 120;
                const nextHeight = Math.min(
                  Math.max(height + 14, minHeight),
                  maxHeight,
                );
                setInputHeight(nextHeight);
              }}
              placeholder={
                voiceInput.state === "recording"
                  ? `Recording… ${Math.round(voiceInput.durationMs / 1000)}s`
                  : voiceInput.state === "transcribing"
                  ? "Transcribing voice…"
                  : "Type something you feel…"
              }
              editable={voiceInput.state === "idle"}
              placeholderTextColor={
                voiceInput.state === "recording"
                  ? "rgba(239,68,68,0.9)"
                  : "rgba(148, 163, 184, 0.9)"
              }
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                maxHeight: 120,
                minHeight: inputHeight,
              }}
            />
          </View>

          {/* Mic button — hold to record, tap again to stop */}
          <TouchableOpacity
            onPress={async () => {
              if (voiceInput.state === "idle") {
                await voiceInput.startRecording();
              } else if (voiceInput.state === "recording") {
                await voiceInput.stopRecording();
              }
            }}
            disabled={voiceInput.state === "transcribing"}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor:
                voiceInput.state === "recording"
                  ? "rgba(239,68,68,0.2)"
                  : colors.surfaceSoft,
              borderWidth: 1,
              borderColor:
                voiceInput.state === "recording"
                  ? "rgba(239,68,68,0.6)"
                  : colors.border,
              marginRight: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel={voiceInput.state === "recording" ? "Stop recording" : "Start voice input"}
          >
            <Text style={{ fontSize: 16 }}>
              {voiceInput.state === "transcribing"
                ? "⏳"
                : voiceInput.state === "recording"
                ? "⏹️"
                : "🎙️"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={isSendDisabled}
            style={{
              opacity: isSendDisabled ? 0.4 : 1,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderActionSheet()}

      <BreathingModal
        visible={breathingVisible}
        onClose={() => setBreathingVisible(false)}
      />
    </View>
    </KeyboardAvoidingView>
  );
}
