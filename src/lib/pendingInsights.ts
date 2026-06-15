// src/lib/pendingInsights.ts
// Shared AsyncStorage bridge: Chat computes insights, Trends displays them.
// Keeps the Chat screen clean — badge on Trends tab signals new content.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type InsightPayload = {
  weeklyRecap?: string;
  collectivePulse?: { heavyPercent: number };
  milestone?: { id: string; themeName: string };
  companionInsight?: { variant: string; title: string; body: string };
};

const STORE_KEY = "imotara.pending_insights.v2";
const BADGE_KEY = "imotara.trends_badge.v2";

export async function savePendingInsight<K extends keyof InsightPayload>(
  key: K,
  value: InsightPayload[K],
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const store: InsightPayload = raw ? JSON.parse(raw) : {};
    store[key] = value as any;
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
    const count = Object.values(store).filter(Boolean).length;
    await AsyncStorage.setItem(BADGE_KEY, String(count));
  } catch {}
}

export async function loadPendingInsights(): Promise<InsightPayload> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function clearPendingInsight(key: keyof InsightPayload): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const store: InsightPayload = raw ? JSON.parse(raw) : {};
    delete store[key];
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
    const count = Object.values(store).filter(Boolean).length;
    await AsyncStorage.setItem(BADGE_KEY, String(count));
  } catch {}
}

export async function getBadgeCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BADGE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function clearBadge(): Promise<void> {
  try {
    await AsyncStorage.setItem(BADGE_KEY, "0");
  } catch {}
}
