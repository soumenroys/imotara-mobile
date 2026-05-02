// src/lib/imotara/openLoops.ts
// P1 — Emotional Open Loops: detects recurring unresolved themes across threads
// and surfaces them as a named "open loop" with a gentle prompt.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HistoryItem } from "../../state/HistoryContext";

const LOOPS_KEY = "imotara.open_loops.v1";
const MIN_THREADS = 3;
const MIN_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export type OpenLoopStatus = "active" | "dismissed" | "deferred" | "closed";

export type OpenLoop = {
  id: string;
  themeKey: string;
  themeName: string;
  firstSeenAt: number;
  lastSeenAt: number;
  threadCount: number;
  status: OpenLoopStatus;
  deferUntil?: number;
};

// ── Theme definitions ────────────────────────────────────────────────────────

const THEMES: Record<string, { name: string; prompt: string; pattern: RegExp; closure: RegExp }> = {
  work_stress: {
    name: "work stress",
    prompt: "Work stress has come up in several of our conversations. Want to sit with it together?",
    pattern: /\b(work|job|boss|manager|deadline|office|colleague|fired|promotion|career|burnout|overwork|workload|meeting|salary)\b/i,
    closure: /\b(got the job|got promoted|quit|resigned|new job|work is (good|better|great)|job is going well|love my work)\b/i,
  },
  loneliness: {
    name: "loneliness",
    prompt: "Loneliness has surfaced a few times across your conversations. I'm here whenever you want to explore it.",
    pattern: /\b(lonely|loneliness|alone|isolated|no friends|nobody|no one cares|disconnected|left out|excluded|invisible)\b/i,
    closure: /\b(made a friend|not alone|feel connected|felt understood|found my people|less lonely|not as lonely)\b/i,
  },
  anxiety: {
    name: "anxiety",
    prompt: "Anxiety seems to be a recurring thread for you. Want to go deeper on what's underneath it?",
    pattern: /\b(anxious|anxiety|worry|worried|nervous|panic|panic attack|overwhelmed|overthinking|spiral|dread|terrified)\b/i,
    closure: /\b(feeling calmer|less anxious|not as worried|more at peace|calmed down|anxiety is better|feel peaceful)\b/i,
  },
  grief_loss: {
    name: "grief & loss",
    prompt: "Grief and loss have come up across several conversations. Would you like to open a space just for that?",
    pattern: /\b(grief|grieving|loss|lost someone|died|death|passed away|miss them|mourning|bereavement|gone forever)\b/i,
    closure: /\b(at peace with|accepted|healing|found closure|moving forward|coming to terms)\b/i,
  },
  relationship: {
    name: "relationship struggles",
    prompt: "Relationship struggles keep appearing in your chats. Want to explore what's really going on there?",
    pattern: /\b(relationship|partner|boyfriend|girlfriend|husband|wife|breakup|broke up|divorce|fight|argument|conflict|betrayal|cheating)\b/i,
    closure: /\b(made up|resolved|we talked|things are better|moved on|relationship is good|feeling closer)\b/i,
  },
  sleep: {
    name: "sleep troubles",
    prompt: "Sleep difficulties have come up several times. Want to look at what might be underneath them?",
    pattern: /\b(can'?t sleep|insomnia|sleepless|exhausted|no energy|fatigue|nightmares|sleep deprived|awake all night|wide awake)\b/i,
    closure: /\b(sleeping better|slept well|good sleep|finally rested|sleep (has )?improved|getting rest)\b/i,
  },
  self_worth: {
    name: "self-worth",
    prompt: "Questions about self-worth keep coming up for you. I'd love to explore this with you more intentionally.",
    pattern: /\b(worthless|not good enough|failure|failing|shame|ashamed|hate myself|self.hate|loser|useless|inadequate|imposter|don'?t deserve)\b/i,
    closure: /\b(feeling better about myself|proud of myself|I('m| am) enough|self.acceptance|value myself|good about myself)\b/i,
  },
  family: {
    name: "family tension",
    prompt: "Family tension keeps showing up in your conversations. Want to dedicate a thread just to untangling it?",
    pattern: /\b(toxic family|controlling (parents?|family)|family pressure|expectations from (family|parents?|mom|dad)|family (conflict|tension|fight|drama))\b/i,
    closure: /\b(family is better|talked to my (parents?|mom|dad)|set boundaries|family (accepted|supports?|understood))\b/i,
  },
};

// ── Persistence ──────────────────────────────────────────────────────────────

export async function loadOpenLoops(): Promise<OpenLoop[]> {
  try {
    const raw = await AsyncStorage.getItem(LOOPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveOpenLoops(loops: OpenLoop[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOOPS_KEY, JSON.stringify(loops));
  } catch {}
}

export async function clearOpenLoops(): Promise<void> {
  await AsyncStorage.removeItem(LOOPS_KEY);
}

// ── Detection ────────────────────────────────────────────────────────────────

export async function detectAndUpdateOpenLoops(
  history: HistoryItem[]
): Promise<OpenLoop[]> {
  const now = Date.now();
  const userMessages = history.filter((h) => h.from === "user" && h.text?.trim());

  // Group user messages by thread
  const byThread = new Map<string, HistoryItem[]>();
  for (const msg of userMessages) {
    const tid = msg.threadId ?? "default";
    if (!byThread.has(tid)) byThread.set(tid, []);
    byThread.get(tid)!.push(msg);
  }

  const existing = await loadOpenLoops();
  const existingByKey = new Map(existing.map((l) => [l.themeKey, l]));
  const updated: OpenLoop[] = [];

  for (const [themeKey, theme] of Object.entries(THEMES)) {
    const matchingThreadIds: string[] = [];
    let firstSeenAt = Infinity;
    let lastSeenAt = 0;
    let hasClosure = false;

    for (const [tid, msgs] of byThread) {
      const combined = msgs.map((m) => m.text).join(" ");
      if (theme.pattern.test(combined)) {
        matchingThreadIds.push(tid);
        for (const m of msgs) {
          if (m.timestamp < firstSeenAt) firstSeenAt = m.timestamp;
          if (m.timestamp > lastSeenAt) lastSeenAt = m.timestamp;
        }
        if (theme.closure.test(combined)) hasClosure = true;
      }
    }

    const prev = existingByKey.get(themeKey);
    const thresholdMet =
      matchingThreadIds.length >= MIN_THREADS &&
      firstSeenAt !== Infinity &&
      now - firstSeenAt >= MIN_AGE_MS;

    if (!thresholdMet) {
      if (prev) updated.push(prev);
      continue;
    }

    if (hasClosure) {
      updated.push(
        prev
          ? { ...prev, status: "closed", lastSeenAt }
          : {
              id: `loop-${themeKey}-${Date.now()}`,
              themeKey,
              themeName: theme.name,
              firstSeenAt,
              lastSeenAt,
              threadCount: matchingThreadIds.length,
              status: "closed",
            }
      );
      continue;
    }

    if (prev) {
      const deferExpired = prev.status === "deferred" && prev.deferUntil != null && now > prev.deferUntil;
      updated.push({
        ...prev,
        lastSeenAt,
        threadCount: matchingThreadIds.length,
        status: deferExpired ? "active" : prev.status,
        deferUntil: deferExpired ? undefined : prev.deferUntil,
      });
    } else {
      updated.push({
        id: `loop-${themeKey}-${Date.now()}`,
        themeKey,
        themeName: theme.name,
        firstSeenAt,
        lastSeenAt,
        threadCount: matchingThreadIds.length,
        status: "active",
      });
    }
  }

  await saveOpenLoops(updated);
  return updated;
}

// ── Actions ──────────────────────────────────────────────────────────────────

export async function dismissLoop(id: string): Promise<void> {
  const loops = await loadOpenLoops();
  await saveOpenLoops(loops.map((l) => (l.id === id ? { ...l, status: "dismissed" } : l)));
}

export async function deferLoop(id: string, days = 7): Promise<void> {
  const loops = await loadOpenLoops();
  const deferUntil = Date.now() + days * 24 * 60 * 60 * 1000;
  await saveOpenLoops(
    loops.map((l) => (l.id === id ? { ...l, status: "deferred", deferUntil } : l))
  );
}

export async function closeLoop(id: string): Promise<void> {
  const loops = await loadOpenLoops();
  await saveOpenLoops(loops.map((l) => (l.id === id ? { ...l, status: "closed" } : l)));
}

export function getActiveLoop(loops: OpenLoop[]): OpenLoop | null {
  const now = Date.now();
  return (
    loops.find(
      (l) =>
        l.status === "active" ||
        (l.status === "deferred" && l.deferUntil != null && now > l.deferUntil)
    ) ?? null
  );
}

export function getLoopPrompt(themeKey: string): string {
  return THEMES[themeKey]?.prompt ?? `"${themeKey}" keeps coming up. Want to explore it?`;
}
