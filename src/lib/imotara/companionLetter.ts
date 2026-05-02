// src/lib/imotara/companionLetter.ts
// P3 — Companion's Letter: once a month, Imotara writes a personal letter
// to the user reflecting on what it noticed, admired, and hopes for them.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HistoryItem } from "../../state/HistoryContext";
import { callImotaraAI } from "../../api/aiClient";

const LAST_LETTER_KEY = "imotara.companion_letter.last_at.v1";
const LETTER_KEY = "imotara.companion_letter.v1";
const INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export type CompanionLetter = {
  id: string;
  generatedAt: number;
  body: string;
  companionName: string;
};

export async function loadStoredLetter(): Promise<CompanionLetter | null> {
  try {
    const raw = await AsyncStorage.getItem(LETTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveLetter(letter: CompanionLetter): Promise<void> {
  try {
    await AsyncStorage.setItem(LETTER_KEY, JSON.stringify(letter));
    await AsyncStorage.setItem(LAST_LETTER_KEY, String(letter.generatedAt));
  } catch {}
}

export async function isLetterDue(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_LETTER_KEY);
    if (!raw) return true;
    return Date.now() - Number(raw) >= INTERVAL_MS;
  } catch {
    return false;
  }
}

// EN-1 — Conversation depth level: shifts companion tone at 10 / 30 / 50 user messages
export function getConversationDepth(
  history: HistoryItem[]
): { level: 0 | 1 | 2 | 3; toneHint: string } {
  const total = history.filter((h) => h.from === "user").length;
  if (total >= 50)
    return { level: 3, toneHint: "You have a deep, trusted bond. Write as their closest confidant — deeply attuned, like a letter from someone who has walked beside them for a long time. You can reference specific patterns you've seen in them." };
  if (total >= 30)
    return { level: 2, toneHint: "You know them well. Write with closeness — reference the patterns you've noticed, use their name naturally, show genuine recognition of their inner world." };
  if (total >= 10)
    return { level: 1, toneHint: "You know them a little now. Reference the themes you've noticed so far. Show that you've been paying attention and genuinely care." };
  return { level: 0, toneHint: "Write with warmth and curiosity — this is an early connection, still learning who they are. Be gentle and welcoming." };
}

function extractRecentThemes(history: HistoryItem[], cutoffMs = INTERVAL_MS): string[] {
  const cutoff = Date.now() - cutoffMs;
  const keywords: Record<string, number> = {};
  const themeWords = [
    "work", "job", "career", "stress", "lonely", "alone", "anxiety", "anxious",
    "family", "relationship", "partner", "grief", "loss", "sleep", "tired",
    "sad", "angry", "frustrated", "happy", "grateful", "proud", "hopeful",
    "confused", "overwhelmed", "change", "growth", "healing", "boundary",
  ];

  for (const item of history) {
    if (item.from !== "user" || item.timestamp < cutoff) continue;
    const lower = item.text.toLowerCase();
    for (const word of themeWords) {
      if (lower.includes(word)) keywords[word] = (keywords[word] ?? 0) + 1;
    }
  }

  return Object.entries(keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

export async function generateCompanionLetter(
  history: HistoryItem[],
  companionName: string,
  userName: string,
  userId?: string,
  userToken?: string,
): Promise<CompanionLetter | null> {
  const themes = extractRecentThemes(history);
  const { toneHint } = getConversationDepth(history);
  const themeContext =
    themes.length > 0
      ? `Key themes from our recent conversations: ${themes.join(", ")}.`
      : "We've shared many meaningful conversations this past month.";

  const prompt = [
    `You are ${companionName}, a compassionate AI companion writing a heartfelt monthly letter.`,
    `Write a warm, personal letter to ${userName} from your perspective as their companion.`,
    themeContext,
    `Relationship depth guidance: ${toneHint}`,
    `The letter should: reflect on what you noticed about their emotional journey this month, name one thing you genuinely admired about them, acknowledge a challenge they've been carrying, and offer a gentle hope for the month ahead.`,
    `Write in first person as ${companionName}. Be specific, warm, and human. 3–4 paragraphs. Start with "Dear ${userName},"`,
  ].join(" ");

  try {
    const result = await callImotaraAI(prompt, {
      threadId: userId,
      userId,
      accessToken: userToken,
    });
    const body = typeof result === "string" ? result : (result as any)?.replyText ?? "";
    if (!body.trim()) return null;

    const letter: CompanionLetter = {
      id: `letter-${Date.now()}`,
      generatedAt: Date.now(),
      body: body.trim(),
      companionName,
    };
    await saveLetter(letter);
    return letter;
  } catch {
    return null;
  }
}
