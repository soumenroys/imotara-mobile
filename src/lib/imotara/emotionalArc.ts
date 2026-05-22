// src/lib/imotara/emotionalArc.ts
// P5 — Emotional Arc Narrative: month/year-end written story of the user's
// emotional journey — not a chart, but a narrative with turning points.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HistoryItem } from "../../state/HistoryContext";
import { callImotaraAI } from "../../api/aiClient";

const LAST_ARC_KEY = "imotara.emotional_arc.last_at.v1";
const ARC_KEY = "imotara.emotional_arc.v1";
const ARC_CADENCE_KEY = "imotara.arc.cadenceDays.v1";
const DEFAULT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

async function getIntervalMs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ARC_CADENCE_KEY);
    const days = parseInt(raw ?? "30", 10);
    return isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : DEFAULT_INTERVAL_MS;
  } catch {
    return DEFAULT_INTERVAL_MS;
  }
}

export type EmotionalArc = {
  id: string;
  generatedAt: number;
  periodLabel: string;
  narrative: string;
};

export async function loadStoredArc(): Promise<EmotionalArc | null> {
  try {
    const raw = await AsyncStorage.getItem(ARC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveArc(arc: EmotionalArc): Promise<void> {
  try {
    await AsyncStorage.setItem(ARC_KEY, JSON.stringify(arc));
    await AsyncStorage.setItem(LAST_ARC_KEY, String(arc.generatedAt));
  } catch {}
}

export async function isArcDue(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ARC_KEY);
    if (!raw) return true;
    const intervalMs = await getIntervalMs();
    return Date.now() - Number(raw) >= intervalMs;
  } catch {
    return false;
  }
}

function buildArcContext(
  history: HistoryItem[],
  cutoffMs = DEFAULT_INTERVAL_MS
): { emotionProgression: string[]; milestones: string[]; messageCount: number } {
  const cutoff = Date.now() - cutoffMs;
  const positiveWords = ["better", "good", "happy", "grateful", "hopeful", "proud", "calm", "peace", "progress", "healed", "resolved"];
  const challengeWords = ["struggle", "hard", "difficult", "exhausted", "sad", "anxious", "overwhelmed", "lost", "confused", "hurt", "tired"];

  const recentUserMessages = history.filter(
    (h) => h.from === "user" && h.timestamp >= cutoff
  );

  const milestones: string[] = [];
  let positiveShift = 0;
  let challengeStart = 0;

  for (const msg of recentUserMessages) {
    const lower = msg.text.toLowerCase();
    if (positiveWords.some((w) => lower.includes(w))) positiveShift++;
    if (challengeWords.some((w) => lower.includes(w))) challengeStart++;
    if (/\b(finally|breakthrough|realized|figured out|made a decision|let go|accepted|forgave?)\b/i.test(msg.text)) {
      milestones.push(msg.text.slice(0, 60).replace(/\n/g, " "));
    }
  }

  const progression: string[] = [];
  if (challengeStart > 1) progression.push("started the month carrying real weight");
  if (positiveShift > challengeStart) progression.push("moved toward something lighter");
  if (milestones.length > 0) progression.push("had at least one meaningful shift");

  return {
    emotionProgression: progression,
    milestones: milestones.slice(0, 3),
    messageCount: recentUserMessages.length,
  };
}

export async function generateEmotionalArc(
  history: HistoryItem[],
  userName: string,
  userId?: string,
  userToken?: string,
): Promise<EmotionalArc | null> {
  const { emotionProgression, milestones, messageCount } = buildArcContext(history);
  if (messageCount < 5) return null;

  const now = new Date();
  const periodLabel = now.toLocaleString("en", { month: "long", year: "numeric" });

  const progressionText =
    emotionProgression.length > 0
      ? `The arc this month: ${emotionProgression.join(", ")}.`
      : "There was meaningful movement across several conversations this month.";

  const milestoneText =
    milestones.length > 0
      ? `Notable moments: "${milestones.join('"; "')}".`
      : "";

  const prompt = [
    `Write a short personal narrative (flowing story, no lists, no bullet points) about ${userName}'s emotional journey this month (${periodLabel}).`,
    progressionText,
    milestoneText,
    `Use second person ("You started...", "By mid-month..."). Include: how the month opened emotionally, any turning points or shifts, something the user should be proud of, and a closing line that looks forward.`,
    `Tone: intimate, honest, hopeful. 3 paragraphs max. No headers. No emojis.`,
  ].join(" ");

  try {
    const result = await callImotaraAI(prompt, {
      threadId: userId,
      userId,
      accessToken: userToken,
    });
    const narrative = typeof result === "string" ? result : (result as any)?.replyText ?? "";
    if (!narrative.trim()) return null;

    const arc: EmotionalArc = {
      id: `arc-${Date.now()}`,
      generatedAt: Date.now(),
      periodLabel,
      narrative: narrative.trim(),
    };
    await saveArc(arc);
    return arc;
  } catch {
    return null;
  }
}
