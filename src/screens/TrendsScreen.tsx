// src/screens/TrendsScreen.tsx
// Emotion trends — local history analysis, no external chart library needed.
// Shows: streak, weekly emotion frequency bars, dominant emotion per day, summary.

import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, Share, Alert } from "react-native";
import { useHistoryStore } from "../state/HistoryContext";
import { useColors } from "../theme/ThemeContext";

type EmotionBucket =
  | "sadness"
  | "stressed"
  | "anger"
  | "confused"
  | "hopeful"
  | "joy"
  | "neutral";

const EMOTION_META: Record<EmotionBucket, { emoji: string; color: string; label: string }> = {
  sadness:  { emoji: "💙", color: "rgba(37,99,235,0.70)",   label: "Sad" },
  stressed: { emoji: "💛", color: "rgba(202,138,4,0.70)",   label: "Stressed" },
  anger:    { emoji: "❤️", color: "rgba(220,38,38,0.70)",   label: "Angry" },
  confused: { emoji: "🟣", color: "rgba(124,58,237,0.70)",  label: "Confused" },
  hopeful:  { emoji: "💚", color: "rgba(5,150,105,0.70)",   label: "Hopeful" },
  joy:      { emoji: "😄", color: "rgba(250,204,21,0.80)",  label: "Joy" },
  neutral:  { emoji: "⚪️", color: "rgba(100,116,139,0.55)", label: "Neutral" },
};

function mapEmotionToKey(raw?: string): EmotionBucket {
  if (!raw) return "neutral";
  const s = raw.toLowerCase();
  if (s.includes("sad") || s.includes("low") || s.includes("lonely") || s.includes("depress")) return "sadness";
  if (s.includes("stress") || s.includes("tense") || s.includes("anxious") || s.includes("worried") || s.includes("panic")) return "stressed";
  if (s.includes("ang") || s.includes("frustrat") || s.includes("upset") || s.includes("irritat")) return "anger";
  if (s.includes("confus") || s.includes("stuck") || s.includes("unsure") || s.includes("numb")) return "confused";
  if (s.includes("hope") || s.includes("grateful") || s.includes("relief") || s.includes("light")) return "hopeful";
  if (s.includes("joy") || s.includes("happy") || s.includes("excit") || s.includes("playful")) return "joy";
  return "neutral";
}

function dayLabel(date: Date): string {
  const today = new Date();
  const diff = Math.floor((today.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
}

function toDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return toDateKey(Date.now());
}

/** Returns consecutive-day streak ending today (or yesterday). */
function computeStreak(activeDays: Set<string>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateKey(d.getTime());
    if (activeDays.has(key)) {
      streak++;
    } else {
      // Allow today to be empty (user hasn't chatted yet today)
      if (i === 0) continue;
      break;
    }
  }
  return streak;
}

export default function TrendsScreen() {
  const colors = useColors();
  const store = useHistoryStore() as any;
  const history: any[] = store.history ?? [];

  // Only look at user messages (they carry emotion)
  const userMsgs = useMemo(() =>
    history
      .filter((h) => h.from === "user" && h.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp),
    [history],
  );

  // Last 7 days of user messages grouped by day
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const recent = userMsgs.filter((m) => m.timestamp >= sevenDaysAgo);

  // All days that have any user message (for streak calculation)
  const allActiveDays = useMemo(() => {
    const s = new Set<string>();
    for (const m of userMsgs) s.add(toDateKey(m.timestamp));
    return s;
  }, [userMsgs]);

  const streak = useMemo(() => computeStreak(allActiveDays), [allActiveDays]);
  const chattedToday = allActiveDays.has(todayKey());

  // Group by calendar day (key = "YYYY-MM-DD")
  const byDay = useMemo(() => {
    const map: Record<string, EmotionBucket[]> = {};
    for (const m of recent) {
      const key = toDateKey(m.timestamp);
      if (!map[key]) map[key] = [];
      map[key].push(mapEmotionToKey(m.emotion ?? m.moodHint));
    }
    return map;
  }, [recent]);

  // Produce last-7-days array (always 7 slots, newest last)
  const days = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d.getTime());
      const emotions = byDay[key] ?? [];
      const freq: Partial<Record<EmotionBucket, number>> = {};
      for (const e of emotions) freq[e] = (freq[e] ?? 0) + 1;
      const dominant = (Object.entries(freq).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? "neutral") as EmotionBucket;
      result.push({ date: d, key, emotions, dominant, label: dayLabel(d) });
    }
    return result;
  }, [byDay]);

  // Overall week summary
  const weekEmotions = recent.map((m) => mapEmotionToKey(m.emotion ?? m.moodHint));
  const weekFreq: Partial<Record<EmotionBucket, number>> = {};
  for (const e of weekEmotions) weekFreq[e] = (weekFreq[e] ?? 0) + 1;
  const sorted = (Object.entries(weekFreq) as [EmotionBucket, number][]).sort((a, b) => b[1] - a[1]);
  const topEmotion = sorted[0]?.[0];
  const maxCount = Math.max(1, sorted[0]?.[1] ?? 1);

  // ---- Journal export ----
  const handleExportJournal = async () => {
    if (userMsgs.length === 0) {
      Alert.alert("Nothing to export", "Start chatting and your journal will appear here.");
      return;
    }
    const lines: string[] = [];
    lines.push("── Imotara Emotion Journal ──");
    lines.push(`Exported: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`);
    lines.push("");

    if (topEmotion) {
      lines.push(`This week's dominant feeling: ${EMOTION_META[topEmotion].emoji} ${EMOTION_META[topEmotion].label}`);
      lines.push(`Messages in last 7 days: ${recent.length}`);
      lines.push(`Current streak: ${streak} day${streak !== 1 ? "s" : ""}`);
      lines.push("");
    }

    lines.push("── 7-Day Mood Summary ──");
    for (const day of days) {
      if (day.emotions.length === 0) {
        lines.push(`${day.label}: —`);
      } else {
        const meta = EMOTION_META[day.dominant];
        lines.push(`${day.label}: ${meta.emoji} ${meta.label} (${day.emotions.length} check-in${day.emotions.length !== 1 ? "s" : ""})`);
      }
    }

    lines.push("");
    lines.push("── Emotion Frequency ──");
    for (const [emotion, count] of sorted) {
      const meta = EMOTION_META[emotion as EmotionBucket];
      lines.push(`${meta.emoji} ${meta.label}: ${count}x`);
    }

    lines.push("");
    lines.push("Generated by Imotara — your private emotional companion.");

    try {
      await Share.share({ message: lines.join("\n"), title: "Imotara Journal" });
    } catch {
      // user cancelled share
    }
  };

  if (userMsgs.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ fontSize: 32, marginBottom: 16 }}>📊</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginBottom: 8 }}>
          No data yet
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>
          Start a few conversations and your emotional trends will appear here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Streak card */}
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: streak >= 3 ? "rgba(250,204,21,0.4)" : colors.border,
          backgroundColor: streak >= 3 ? "rgba(250,204,21,0.08)" : colors.surface,
          padding: 16,
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 36 }}>{streak >= 7 ? "🔥" : streak >= 3 ? "⚡" : "💬"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: streak >= 3 ? "#fbbf24" : colors.textPrimary }}>
            {streak} day{streak !== 1 ? "s" : ""} in a row
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {streak === 0
              ? "Start chatting to begin your streak"
              : chattedToday
              ? "Keep going — you chatted today!"
              : "Chat today to keep your streak alive"}
          </Text>
        </View>
      </View>

      {/* Export button */}
      <TouchableOpacity
        onPress={handleExportJournal}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          marginBottom: 16,
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>Export journal</Text>
        <Text style={{ fontSize: 14 }}>↗</Text>
      </TouchableOpacity>

      {/* Summary card */}
      {topEmotion && (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            This week
          </Text>
          <Text style={{ fontSize: 24, marginBottom: 4 }}>
            {EMOTION_META[topEmotion].emoji}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
            Your most common feeling: {EMOTION_META[topEmotion].label}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            Based on {recent.length} message{recent.length !== 1 ? "s" : ""} in the last 7 days
          </Text>
        </View>
      )}

      {/* Emotion frequency bars */}
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
        Frequency this week
      </Text>
      {sorted.map(([emotion, count]) => {
        const meta = EMOTION_META[emotion];
        const pct = count / maxCount;
        return (
          <View key={emotion} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>{meta.emoji}</Text>
              <Text style={{ fontSize: 13, color: colors.textPrimary, flex: 1 }}>{meta.label}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{count}x</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(148,163,184,0.15)", overflow: "hidden" }}>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  width: `${Math.round(pct * 100)}%`,
                  backgroundColor: meta.color,
                }}
              />
            </View>
          </View>
        );
      })}

      {/* 7-day dot calendar */}
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginTop: 24, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
        7-day mood
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {days.map((day) => {
          const meta = EMOTION_META[day.dominant];
          const isEmpty = day.emotions.length === 0;
          return (
            <View key={day.key} style={{ alignItems: "center", flex: 1 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isEmpty ? "rgba(148,163,184,0.10)" : meta.color,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: isEmpty ? colors.border : "transparent",
                }}
              >
                <Text style={{ fontSize: isEmpty ? 14 : 18 }}>
                  {isEmpty ? "·" : meta.emoji}
                </Text>
              </View>
              <Text style={{ fontSize: 9, color: colors.textSecondary, textAlign: "center" }}>
                {day.label.split(" ")[0]}
              </Text>
              {day.emotions.length > 0 && (
                <Text style={{ fontSize: 9, color: colors.textSecondary }}>
                  {day.emotions.length}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Weekly emotion report */}
      {sorted.length > 0 && (() => {
        const now = new Date();
        // Sunday = 0; show report from Sunday onwards
        const dayOfWeek = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartLabel = weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        const weekEndLabel = now.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

        // Positive emotions ratio
        const positiveCount = weekEmotions.filter(
          (e) => e === "hopeful" || e === "joy"
        ).length;
        const positiveRatio = weekEmotions.length > 0
          ? Math.round((positiveCount / weekEmotions.length) * 100)
          : 0;

        // Insight line
        let insight = "";
        if (topEmotion === "hopeful" || topEmotion === "joy") {
          insight = "You had a positive week overall. Keep nurturing what's working.";
        } else if (topEmotion === "sadness") {
          insight = "This week felt heavy. Be gentle with yourself — one step at a time.";
        } else if (topEmotion === "stressed") {
          insight = "Stress dominated this week. Consider a breathing break when it peaks.";
        } else if (topEmotion === "anger") {
          insight = "Frustration showed up often. Your feelings are valid.";
        } else if (topEmotion === "confused") {
          insight = "Uncertainty was present this week. Clarity often comes with rest.";
        } else {
          insight = "You showed up and reflected. That matters.";
        }

        return (
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              Weekly report
            </Text>
            <View style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: 16,
            }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
                {weekStartLabel} — {weekEndLabel}
              </Text>

              {/* Dominant emotion */}
              {topEmotion && (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ fontSize: 28, marginRight: 10 }}>{EMOTION_META[topEmotion].emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Most felt</Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>{EMOTION_META[topEmotion].label}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Positive</Text>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: positiveRatio >= 50 ? "#22c55e" : colors.textSecondary }}>
                      {positiveRatio}%
                    </Text>
                  </View>
                </View>
              )}

              {/* Emotion distribution pills */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {sorted.slice(0, 4).map(([emotion, count]) => (
                  <View
                    key={emotion}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: EMOTION_META[emotion as EmotionBucket].color,
                      gap: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>{EMOTION_META[emotion as EmotionBucket].emoji}</Text>
                    <Text style={{ fontSize: 11, color: "#fff", fontWeight: "600" }}>{count}x</Text>
                  </View>
                ))}
              </View>

              {/* Insight */}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: "italic", lineHeight: 18 }}>
                  {insight}
                </Text>
              </View>
            </View>
          </View>
        );
      })()}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
