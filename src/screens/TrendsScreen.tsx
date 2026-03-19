// src/screens/TrendsScreen.tsx
// Emotion trends — local history analysis, no external chart library needed.
// Shows: streak, weekly emotion frequency bars, dominant emotion per day, summary.

import React, { useMemo, useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Share, Alert, TextInput, RefreshControl, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHistoryStore } from "../state/HistoryContext";
import { useColors } from "../theme/ThemeContext";

// ── Quick Mood Check-in ─────────────────────────────────────────────────────────
const FEEL_EMOTIONS: { key: EmotionBucket; emoji: string; label: string }[] = [
  { key: "joy",      emoji: "😄", label: "Joy" },
  { key: "hopeful",  emoji: "💚", label: "Hopeful" },
  { key: "sadness",  emoji: "💙", label: "Sad" },
  { key: "stressed", emoji: "💛", label: "Stressed" },
  { key: "anger",    emoji: "❤️", label: "Angry" },
  { key: "confused", emoji: "🟣", label: "Confused" },
  { key: "neutral",  emoji: "⚪️", label: "Neutral" },
  { key: "hopeful",  emoji: "🙏", label: "Grateful" },
];

// Deduplicated for rendering (Grateful uses hopeful bucket internally)
const FEEL_BUTTONS: { bucket: EmotionBucket; emoji: string; label: string }[] = [
  { bucket: "joy",      emoji: "😄", label: "Joy" },
  { bucket: "hopeful",  emoji: "💚", label: "Hopeful" },
  { bucket: "hopeful",  emoji: "🙏", label: "Grateful" },
  { bucket: "sadness",  emoji: "💙", label: "Sad" },
  { bucket: "stressed", emoji: "💛", label: "Stressed" },
  { bucket: "anger",    emoji: "❤️", label: "Angry" },
  { bucket: "confused", emoji: "🟣", label: "Confused" },
  { bucket: "neutral",  emoji: "⚪️", label: "Neutral" },
];

function FeelSection({
  colors,
  onCheckin,
}: {
  colors: ReturnType<typeof useColors>;
  onCheckin: (emotion: EmotionBucket, label: string, note: string) => void;
}) {
  const [selected, setSelected] = useState<{ bucket: EmotionBucket; label: string } | null>(null);
  const [note, setNote] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  function handleSave() {
    if (!selected) return;
    onCheckin(selected.bucket, selected.label, note.trim());
    setSelected(null);
    setNote("");
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
        How are you feeling right now?
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {FEEL_BUTTONS.map((btn) => {
          const isActive = selected?.label === btn.label;
          return (
            <TouchableOpacity
              key={btn.label}
              onPress={() => setSelected(isActive ? null : { bucket: btn.bucket, label: btn.label })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: isActive ? EMOTION_META[btn.bucket].color : colors.border,
                backgroundColor: isActive
                  ? EMOTION_META[btn.bucket].color.replace(/[\d.]+\)$/, "0.18)")
                  : colors.surface,
              }}
            >
              <Text style={{ fontSize: 16 }}>{btn.emoji}</Text>
              <Text style={{ fontSize: 13, color: isActive ? colors.textPrimary : colors.textSecondary, fontWeight: isActive ? "600" : "400" }}>
                {btn.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected && (
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 }}>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
            Add a note (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={`What's making you feel ${selected.label.toLowerCase()}?`}
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              lineHeight: 20,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSoft,
              padding: 10,
              minHeight: 64,
              textAlignVertical: "top",
              marginBottom: 10,
            }}
          />
          <TouchableOpacity
            onPress={handleSave}
            style={{ borderRadius: 999, paddingVertical: 10, backgroundColor: EMOTION_META[selected.bucket].color.replace(/[\d.]+\)$/, "0.85)"), alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Log check-in</Text>
          </TouchableOpacity>
        </View>
      )}

      {justSaved && (
        <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary, textAlign: "center" }}>
          ✓ Check-in logged
        </Text>
      )}
    </View>
  );
}

// ── Reflection Journal ──────────────────────────────────────────────────────────
const JOURNAL_KEY = "imotara.journal.v1";

type JournalEntry = {
  id: string;
  prompt: string;
  body: string;
  createdAt: number;
};

const JOURNAL_PROMPTS = [
  "What's been weighing on your mind today?",
  "What are you grateful for right now?",
  "Describe one emotion you felt strongly today.",
  "What would you want your future self to remember about today?",
  "What is one thing you'd do differently this week?",
  "What brought you even a small moment of peace today?",
  "What does rest mean to you right now?",
  "What are you learning about yourself lately?",
  "What boundary did you uphold — or wish you had — today?",
  "What does 'enough' look like for you today?",
  "Write about someone who showed up for you recently.",
  "What emotion are you avoiding right now?",
  "What small thing helped you through a hard moment lately?",
  "If today had a color, what would it be and why?",
  "What do you need more of in your life right now?",
];

async function loadJournal(): Promise<JournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function saveJournal(entries: JournalEntry[]): Promise<void> {
  await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

const JOURNAL_EMOTION_PROMPTS: Partial<Record<EmotionBucket, string[]>> = {
  sadness: [
    "What's weighing on your heart most right now?",
    "Is there something you need to grieve or let go of today?",
    "What would a small act of kindness toward yourself look like right now?",
    "When did this feeling start — and what was happening around then?",
    "What would you say to a close friend feeling exactly this way?",
  ],
  stressed: [
    "What's taking the most energy from you today — and could anything be set down?",
    "Which of your worries are truly within your control right now?",
    "If you could pause one obligation today, which would it be?",
    "What does 'just enough' look like for you instead of 'everything at once'?",
    "What small thing helped you get through a stressful moment recently?",
  ],
  anger: [
    "What's underneath the frustration you're carrying?",
    "What boundary feels like it was crossed — and how do you want to respond?",
    "Where does this anger live in your body, and what does it need?",
    "What would you want the person or situation to understand about your experience?",
    "What would it feel like to express this without it controlling you?",
  ],
  confused: [
    "What feels most unclear right now — and what one thing might bring a little clarity?",
    "What do you already know, even if the bigger picture isn't clear yet?",
    "If you trusted your instincts right now, what would they be pointing toward?",
    "What decision feels most tangled, and what would untangling it look like?",
    "What do you need most: information, space, or someone to talk to?",
  ],
  hopeful: [
    "What possibility are you most looking forward to right now?",
    "What has changed recently that makes this hope feel real?",
    "What would you want your future self to remember about how you feel today?",
    "What are you quietly looking forward to that you haven't told anyone?",
    "How does this hope feel different from your usual day?",
  ],
  joy: [
    "What created this feeling of lightness — and how can you keep more of it?",
    "Who or what contributed most to how good you've been feeling?",
    "What would you want to bottle up from right now to open on a harder day?",
    "What does thriving look like for you — are you closer to it than you realise?",
    "How has this positive feeling changed how you see things around you?",
  ],
};

function JournalSection({ colors, topEmotion }: { colors: ReturnType<typeof useColors>; topEmotion?: EmotionBucket }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const dayIndex = Math.floor(Date.now() / 86400000);
  const emotionBank = topEmotion && topEmotion !== "neutral" ? JOURNAL_EMOTION_PROMPTS[topEmotion] : undefined;
  const todayPrompt = emotionBank
    ? emotionBank[dayIndex % emotionBank.length]
    : JOURNAL_PROMPTS[dayIndex % JOURNAL_PROMPTS.length];
  const todayKey = new Date().toISOString().slice(0, 10);
  const hasEntryToday = entries.some((e) => new Date(e.createdAt).toISOString().slice(0, 10) === todayKey);

  useEffect(() => {
    loadJournal().then(setEntries);
  }, []);

  const handleSave = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    let next: JournalEntry[];
    if (editingId) {
      next = entries.map((e) => e.id === editingId ? { ...e, body: trimmed } : e);
    } else {
      const entry: JournalEntry = {
        id: `j-${Date.now()}`,
        prompt: todayPrompt,
        body: trimmed,
        createdAt: Date.now(),
      };
      next = [entry, ...entries];
    }
    setEntries(next);
    await saveJournal(next);
    setBody("");
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setBody(entry.body);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const next = entries.filter((e) => e.id !== id);
          setEntries(next);
          await saveJournal(next);
        },
      },
    ]);
  };

  const handleExport = async () => {
    if (entries.length === 0) { Alert.alert("Nothing to export", "Write a journal entry first."); return; }
    const lines = entries.map((e) => {
      const date = new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      return `── ${date} ──\nPrompt: ${e.prompt}\n${e.body}`;
    });
    try {
      await Share.share({ message: ["Imotara Reflection Journal", "=".repeat(32), "", ...lines].join("\n\n"), title: "Imotara Journal" });
    } catch {}
  };

  const recent = entries.slice(0, 5);

  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>
            Daily Journal
          </Text>
          {emotionBank && topEmotion && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: EMOTION_META[topEmotion].color.replace(/[\d.]+\)$/, "0.18)"), borderWidth: 1, borderColor: EMOTION_META[topEmotion].color }}>
              <Text style={{ fontSize: 9, color: colors.textPrimary, fontWeight: "600" }}>
                {EMOTION_META[topEmotion].emoji} mood-matched
              </Text>
            </View>
          )}
        </View>
        {entries.length > 0 && (
          <TouchableOpacity onPress={handleExport} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Export</Text>
            <Text style={{ fontSize: 13 }}>↗</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Today's prompt + write CTA */}
      {!showForm && (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, marginBottom: 10 }}>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Today's prompt</Text>
          <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20, fontStyle: "italic", marginBottom: 12 }}>
            "{todayPrompt}"
          </Text>
          <TouchableOpacity
            onPress={() => { setEditingId(null); setBody(""); setShowForm(true); }}
            style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>
              {hasEntryToday ? "Write another" : "Write now"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Write / edit form */}
      {showForm && (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontStyle: "italic" }}>
            {editingId ? "Edit entry" : `"${todayPrompt}"`}
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write here…"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              minHeight: 100,
              color: colors.textPrimary,
              fontSize: 14,
              lineHeight: 22,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSoft,
              padding: 10,
              marginBottom: 10,
              textAlignVertical: "top",
            }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={handleSave} disabled={!body.trim()}
              style={{ flex: 1, borderRadius: 999, paddingVertical: 9, backgroundColor: body.trim() ? colors.primary : "rgba(148,163,184,0.2)", alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: body.trim() ? "#fff" : colors.textSecondary }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowForm(false); setEditingId(null); setBody(""); }}
              style={{ flex: 1, borderRadius: 999, paddingVertical: 9, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Past entries */}
      {recent.map((entry) => {
        const dateStr = new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        return (
          <View key={entry.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, padding: 12, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{dateStr}</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={() => handleEdit(entry)}>
                  <Text style={{ fontSize: 11, color: colors.primary }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(entry.id)}>
                  <Text style={{ fontSize: 11, color: "#fca5a5" }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: "italic", marginBottom: 4 }} numberOfLines={1}>
              {entry.prompt}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 18 }} numberOfLines={4}>
              {entry.body}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Future Letters ─────────────────────────────────────────────────────────────
const FUTURE_LETTERS_KEY = "imotara.futureletters.v1";

type FutureLetter = {
  id: string;
  body: string;
  createdAt: number;
  unlockAt: number;
  unlocked: boolean;
};

async function loadFutureLetters(): Promise<FutureLetter[]> {
  try {
    const raw = await AsyncStorage.getItem(FUTURE_LETTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function saveFutureLetters(letters: FutureLetter[]): Promise<void> {
  await AsyncStorage.setItem(FUTURE_LETTERS_KEY, JSON.stringify(letters));
}

function FutureLetterSection({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [letters, setLetters] = useState<FutureLetter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [days, setDays] = useState(30);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const now = Date.now();

  useEffect(() => {
    loadFutureLetters().then((loaded) => {
      // Mark newly unlocked letters
      const updated = loaded.map((l) => ({ ...l, unlocked: l.unlocked || l.unlockAt <= Date.now() }));
      setLetters(updated);
    });
  }, []);

  function handleSave() {
    const text = body.trim();
    if (!text) return;
    const letter: FutureLetter = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      body: text,
      createdAt: now,
      unlockAt: now + days * 86_400_000,
      unlocked: false,
    };
    const updated = [letter, ...letters];
    setLetters(updated);
    saveFutureLetters(updated);
    setBody("");
    setShowForm(false);
  }

  function handleDelete(id: string) {
    Alert.alert("Delete this letter?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        const updated = letters.filter((l) => l.id !== id);
        setLetters(updated);
        saveFutureLetters(updated);
      }},
    ]);
  }

  const unlocked = letters.filter((l) => l.unlocked);
  const locked = letters.filter((l) => !l.unlocked);

  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>
            Letter to future self
          </Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, opacity: 0.7 }}>
            Write a note that unlocks on a future date.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm((v) => !v)}
          style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Text style={{ fontSize: 12, color: colors.textPrimary }}>{showForm ? "Cancel" : "+ Write"}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, marginBottom: 12 }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Dear future me…"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={5}
            style={{ fontSize: 13, color: colors.textPrimary, minHeight: 90, textAlignVertical: "top", marginBottom: 12 }}
          />
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>Unlock in:</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[7, 30, 90, 180, 365].map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDays(d)}
                style={{
                  borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
                  borderColor: days === d ? colors.primary : colors.border,
                  backgroundColor: days === d ? `${colors.primary}22` : colors.surfaceSoft,
                }}
              >
                <Text style={{ fontSize: 11, color: days === d ? colors.primary : colors.textSecondary }}>
                  {d === 365 ? "1 yr" : `${d}d`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!body.trim()}
            style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: body.trim() ? colors.primary : colors.surfaceSoft, alignSelf: "flex-end", opacity: body.trim() ? 1 : 0.5 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: body.trim() ? "#fff" : colors.textSecondary }}>Seal letter 🔒</Text>
          </TouchableOpacity>
        </View>
      )}

      {unlocked.map((l) => (
        <View key={l.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: "rgba(52,211,153,0.35)", backgroundColor: "rgba(52,211,153,0.06)", padding: 14, marginBottom: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#34d399", marginBottom: 6 }}>
            ✉ Unlocked · written {Math.round((now - l.createdAt) / 86_400_000)} days ago
          </Text>
          {revealedId === l.id ? (
            <>
              <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>{l.body}</Text>
              <TouchableOpacity onPress={() => handleDelete(l.id)} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 11, color: "rgba(248,113,113,0.8)" }}>Delete</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => setRevealedId(l.id)}>
              <Text style={{ fontSize: 12, color: colors.primary }}>Open letter →</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {locked.map((l) => {
        const daysLeft = Math.ceil((l.unlockAt - now) / 86_400_000);
        return (
          <View key={l.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}>
            <View>
              <Text style={{ fontSize: 12, color: colors.textPrimary }}>🔒 Sealed letter</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Unlocks in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(l.id)}>
              <Text style={{ fontSize: 11, color: "rgba(248,113,113,0.8)" }}>Delete</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {letters.length === 0 && !showForm && (
        <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: "italic" }}>
          No letters yet — write one now.
        </Text>
      )}
    </View>
  );
}

// ── Radar chart (zero-dep, pure RN Views) ──────────────────────────────────────
function LineSegment({
  x1, y1, x2, y2, color, thickness = 1,
}: { x1: number; y1: number; x2: number; y2: number; color: string; thickness?: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return null;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <View
      style={{
        position: "absolute",
        width: length,
        height: thickness,
        left: midX - length / 2,
        top: midY - thickness / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

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

// 6-axis radar — joy(top), hopeful(top-right), sadness(bottom-right),
// stressed(bottom), anger(bottom-left), confused(top-left)
const RADAR_AXES: { key: EmotionBucket; label: string; angleDeg: number }[] = [
  { key: "joy",      label: "Joy",      angleDeg: -90  },
  { key: "hopeful",  label: "Hopeful",  angleDeg: -30  },
  { key: "sadness",  label: "Sad",      angleDeg:  30  },
  { key: "stressed", label: "Stressed", angleDeg:  90  },
  { key: "anger",    label: "Angry",    angleDeg:  150 },
  { key: "confused", label: "Confused", angleDeg: -150 },
];

function EmotionRadarChart({
  weekFreq,
  maxCount,
  colors,
}: {
  weekFreq: Partial<Record<EmotionBucket, number>>;
  maxCount: number;
  colors: ReturnType<typeof useColors>;
}) {
  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const MAX_R = 78;

  const toXY = (angleDeg: number, r: number) => ({
    x: CX + r * Math.cos((angleDeg * Math.PI) / 180),
    y: CY + r * Math.sin((angleDeg * Math.PI) / 180),
  });

  const dataPoints = RADAR_AXES.map(({ key, angleDeg }) => {
    const count = weekFreq[key] ?? 0;
    const v = maxCount > 0 ? Math.min(1, count / maxCount) : 0;
    return { ...toXY(angleDeg, MAX_R * Math.max(0.06, v)), key, v };
  });

  const spokeEnds = RADAR_AXES.map(({ angleDeg }) => toXY(angleDeg, MAX_R));

  return (
    <View style={{ width: SIZE, height: SIZE, position: "relative", alignSelf: "center" }}>
      {/* Concentric rings */}
      {[0.33, 0.66, 1.0].map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: MAX_R * 2 * r,
            height: MAX_R * 2 * r,
            borderRadius: MAX_R * r,
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.18)",
            left: CX - MAX_R * r,
            top: CY - MAX_R * r,
          }}
        />
      ))}

      {/* Spoke lines */}
      {spokeEnds.map((end, i) => (
        <LineSegment key={i} x1={CX} y1={CY} x2={end.x} y2={end.y} color="rgba(148,163,184,0.2)" />
      ))}

      {/* Data polygon edges */}
      {dataPoints.map((pt, i) => {
        const next = dataPoints[(i + 1) % dataPoints.length];
        return (
          <LineSegment key={i} x1={pt.x} y1={pt.y} x2={next.x} y2={next.y} color="rgba(99,102,241,0.65)" thickness={2} />
        );
      })}

      {/* Data dots */}
      {dataPoints.map((pt, i) => {
        const meta = EMOTION_META[pt.key];
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: meta.color,
              left: pt.x - 5,
              top: pt.y - 5,
              borderWidth: 1.5,
              borderColor: "#fff",
            }}
          />
        );
      })}

      {/* Axis labels */}
      {RADAR_AXES.map(({ key, label, angleDeg }, i) => {
        const pos = toXY(angleDeg, MAX_R + 22);
        const meta = EMOTION_META[key];
        return (
          <View key={i} style={{ position: "absolute", left: pos.x - 26, top: pos.y - 10, width: 52, alignItems: "center" }}>
            <Text style={{ fontSize: 9, color: colors.textSecondary, textAlign: "center" }}>
              {meta.emoji} {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── 30-day mood line chart ──────────────────────────────────────────────────────
const EMOTION_VALENCE: Record<EmotionBucket, number> = {
  joy:      1.00,
  hopeful:  0.80,
  neutral:  0.50,
  confused: 0.40,
  stressed: 0.28,
  anger:    0.20,
  sadness:  0.10,
};

function MoodLineChart({
  data,
  colors,
}: {
  data: { key: string; dominant: EmotionBucket; count: number }[];
  colors: ReturnType<typeof useColors>;
}) {
  const screenW = Dimensions.get("window").width;
  const W = screenW - 56; // 16px scroll padding each side + 12px card padding each side
  const H = 120;
  const PAD_X = 20;
  const PAD_Y = 12;
  const LABEL_H = 16;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2 - LABEL_H;

  const hasData = data.some((d) => d.count > 0);
  if (!hasData) {
    return (
      <View style={{ height: H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: "italic" }}>
          Chat on more days to see your mood trend
        </Text>
      </View>
    );
  }

  const n = data.length;
  const pts = data.map((d, i) => {
    const val = d.count === 0 ? null : EMOTION_VALENCE[d.dominant];
    const x = PAD_X + (i / (n - 1)) * plotW;
    const y = val == null ? null : PAD_Y + (1 - val) * plotH;
    return { x, y, count: d.count, dominant: d.dominant };
  });

  const segments: { x1: number; y1: number; x2: number; y2: number; dominant: EmotionBucket }[] = [];
  let prev: { x: number; y: number; dominant: EmotionBucket } | null = null;
  for (const pt of pts) {
    if (pt.y != null) {
      if (prev) {
        segments.push({ x1: prev.x, y1: prev.y, x2: pt.x, y2: pt.y, dominant: pt.dominant });
      }
      prev = { x: pt.x, y: pt.y, dominant: pt.dominant };
    }
  }

  // Date labels at day 0, ~10, ~20, 29
  const labelIdxs = [0, 9, 19, 29].filter((i) => i < n);

  return (
    <View style={{ width: W, alignSelf: "center" }}>
      <View style={{ width: W, height: H, position: "relative" }}>
        {/* Y-axis emoji anchors */}
        {([["😄", 0.95], ["😐", 0.5], ["💙", 0.05]] as [string, number][]).map(([emoji, v], i) => {
          const y = PAD_Y + (1 - v) * plotH;
          return (
            <View key={i}>
              <View style={{ position: "absolute", left: PAD_X, right: PAD_X, top: y, height: 1, backgroundColor: "rgba(148,163,184,0.10)" }} />
              <Text style={{ position: "absolute", fontSize: 9, left: 0, top: y - 6, color: "rgba(148,163,184,0.55)" }}>{emoji}</Text>
            </View>
          );
        })}

        {/* Line segments */}
        {segments.map((seg, i) => (
          <LineSegment
            key={i}
            x1={seg.x1} y1={seg.y1}
            x2={seg.x2} y2={seg.y2}
            color={EMOTION_META[seg.dominant].color}
            thickness={2}
          />
        ))}

        {/* Data dots */}
        {pts.filter((pt) => pt.y != null).map((pt, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: EMOTION_META[pt.dominant].color,
              left: pt.x - 3,
              top: pt.y! - 3,
              borderWidth: 1,
              borderColor: colors.surface,
            }}
          />
        ))}

        {/* X-axis date labels */}
        {labelIdxs.map((idx) => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - (n - 1 - idx));
          const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          const x = PAD_X + (idx / (n - 1)) * plotW;
          return (
            <Text
              key={idx}
              style={{ position: "absolute", fontSize: 8, color: colors.textSecondary, left: x - 14, top: H - LABEL_H, width: 30, textAlign: "center" }}
            >
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

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
  const addToHistory: ((item: any) => void) | undefined = store.addToHistory;

  const handleCheckin = (emotion: EmotionBucket, label: string, note: string) => {
    if (!addToHistory) return;
    addToHistory({
      id: `feel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: note || `Feeling ${label.toLowerCase()} right now.`,
      from: "user",
      timestamp: Date.now(),
      emotion: label.toLowerCase(),
      isSynced: false,
    });
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = React.useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try { await store.pushHistoryToRemote?.(); } catch { /* ignore */ }
    finally { setIsRefreshing(false); }
  }, [isRefreshing, store]);

  // Only look at user messages (they carry emotion)
  const userMsgs = useMemo(() =>
    history
      .filter((h) => h.from === "user" && h.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp),
    [history],
  );

  // Last 7 days of user messages grouped by day — memoized so byDay doesn't cascade
  const recent = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return userMsgs.filter((m) => m.timestamp >= cutoff);
  }, [userMsgs]);

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

  // 12-week heatmap — 84 cells (Mon→Sun columns, week rows newest at bottom)
  const heatmapCells = useMemo(() => {
    const NUM_WEEKS = 12;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align so the grid ends on today's column (0=Mon … 6=Sun)
    const todayDow = (today.getDay() + 6) % 7; // Mon=0
    const totalDays = NUM_WEEKS * 7;
    const cells: { key: string; dominant: EmotionBucket; count: number }[] = [];
    for (let i = totalDays - 1 - todayDow; i >= -(todayDow); i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d.getTime());
      const emotions = byDay[key] ?? [];
      const freq: Partial<Record<EmotionBucket, number>> = {};
      for (const e of emotions) freq[e] = (freq[e] ?? 0) + 1;
      const dominant = (Object.entries(freq).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? "neutral") as EmotionBucket;
      cells.push({ key, dominant, count: emotions.length });
    }
    // Chunk into weeks (7 cells each)
    const weeks: typeof cells[] = [];
    for (let w = 0; w < NUM_WEEKS; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
    return weeks;
  }, [byDay]);

  // 30-day mood trend data
  const moodTrend30 = useMemo(() => {
    const allByDay: Record<string, EmotionBucket[]> = {};
    for (const m of userMsgs) {
      const key = toDateKey(m.timestamp);
      if (!allByDay[key]) allByDay[key] = [];
      allByDay[key].push(mapEmotionToKey(m.emotion ?? m.moodHint));
    }
    const result: { key: string; dominant: EmotionBucket; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d.getTime());
      const emotions = allByDay[key] ?? [];
      const freq: Partial<Record<EmotionBucket, number>> = {};
      for (const e of emotions) freq[e] = (freq[e] ?? 0) + 1;
      const dominant = (Object.entries(freq).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? "neutral") as EmotionBucket;
      result.push({ key, dominant, count: emotions.length });
    }
    return result;
  }, [userMsgs]);

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
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#38bdf8" colors={["#38bdf8"]} />}
      >
        <FeelSection colors={colors} onCheckin={handleCheckin} />
        <View style={{ alignItems: "center", paddingTop: 24 }}>
          <Text style={{ fontSize: 32, marginBottom: 16 }}>📊</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginBottom: 8 }}>
            No data yet
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>
            Log a check-in above or start a few conversations and your trends will appear here.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#38bdf8" colors={["#38bdf8"]} />}
    >
      {/* Quick mood check-in */}
      <FeelSection colors={colors} onCheckin={handleCheckin} />

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

      {/* Emotion radar chart */}
      {sorted.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Emotion Radar
          </Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 12 }}>
            How your emotions spread this week
          </Text>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 12, alignItems: "center" }}>
            <EmotionRadarChart weekFreq={weekFreq} maxCount={maxCount} colors={colors} />
          </View>
        </View>
      )}

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

      {/* 30-day mood line chart */}
      <View style={{ marginTop: 28 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
          30-Day Mood Trend
        </Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 12 }}>
          How your emotional tone has shifted this month
        </Text>
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 }}>
          <MoodLineChart data={moodTrend30} colors={colors} />
        </View>
      </View>

      {/* 12-week mood heatmap */}
      <View style={{ marginTop: 28 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
          12-Week Mood Map
        </Text>
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 }}>
          {/* Day-of-week labels */}
          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 9, color: colors.textSecondary }}>{d}</Text>
              </View>
            ))}
          </View>
          {/* Grid: each row = one week */}
          {heatmapCells.map((week, wi) => (
            <View key={wi} style={{ flexDirection: "row", marginBottom: 3 }}>
              {week.map((cell, di) => {
                const meta = EMOTION_META[cell.dominant];
                const opacity = cell.count === 0 ? 0.12 : Math.min(0.9, 0.3 + cell.count * 0.15);
                return (
                  <View key={di} style={{ flex: 1, marginHorizontal: 1 }}>
                    <View style={{
                      aspectRatio: 1,
                      borderRadius: 3,
                      backgroundColor: cell.count === 0
                        ? "rgba(100,116,139,0.12)"
                        : meta.color.replace(/[\d.]+\)$/, `${opacity})`),
                    }} />
                  </View>
                );
              })}
            </View>
          ))}
          {/* Legend */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {(["sadness", "stressed", "anger", "confused", "hopeful", "joy"] as EmotionBucket[]).map((e) => (
              <View key={e} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: EMOTION_META[e].color }} />
                <Text style={{ fontSize: 9, color: colors.textSecondary }}>{EMOTION_META[e].label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Emotion-aware reflection prompt — daily rotation from deep banks */}
      {(() => {
        const GENERAL_PROMPTS = [
          "What has been weighing on your mind most this week?",
          "What's one thing you're proud of that you haven't said out loud yet?",
          "If your feelings this week had a shape, what would it look like?",
          "What does your body feel like carrying right now — heavy, light, tight, open?",
          "What would you tell a close friend who felt exactly what you're feeling today?",
          "What are you holding on to that you could gently release?",
          "What small moment brought you unexpected comfort recently?",
          "What does 'rest' truly mean for you right now?",
          "What pattern do you keep noticing in yourself lately?",
          "If next week had one theme, what theme would you choose for it?",
          "What emotion has been hardest to admit to yourself lately?",
          "What would feel like progress to you by this time next week?",
          "What are you grateful for that you usually take for granted?",
          "What would you do differently if you weren't afraid of judgment?",
          "What is your inner voice saying most loudly right now?",
        ];

        const EMOTION_PROMPT_BANKS: Partial<Record<EmotionBucket, string[]>> = {
          sadness: [
            "Is there something you need to grieve or let go of right now?",
            "What do you need most when you're feeling this low — and are you giving that to yourself?",
            "When did this sadness start — and what was happening around that time?",
            "What would a small act of self-kindness look like for you today?",
            "What would it mean for this feeling to slowly lift — what would feel different?",
          ],
          stressed: [
            "What's taking the most energy from you — and what could you release today?",
            "Which of your worries are within your control, and which are not?",
            "What does your body do when stress builds — and what does it need?",
            "If you could press pause on one obligation today, which would it be?",
            "What would 'just enough' look like for you instead of 'everything at once'?",
          ],
          anger: [
            "What is underneath the frustration you're feeling?",
            "What boundary feels like it was crossed — and how do you want to respond?",
            "What would you want the person or situation to understand about your experience?",
            "Where does this anger live in your body, and what does it need?",
            "What would it feel like to express this feeling without it controlling you?",
          ],
          confused: [
            "What feels most unclear — and what one thing might bring a little more clarity?",
            "What do you already know, even if the bigger picture isn't clear yet?",
            "What would you need to feel less lost — information, space, or someone to talk to?",
            "If you trusted your instincts right now, what would they be pointing toward?",
            "What decision or situation feels most tangled, and what would untangling look like?",
          ],
          hopeful: [
            "What possibility are you most looking forward to, and what's one step toward it?",
            "What has changed recently that makes this hope feel real?",
            "What would you want your future self to remember about how you feel right now?",
            "What are you quietly looking forward to that you haven't told anyone?",
            "How does hope feel different in your body compared to your usual state?",
          ],
          joy: [
            "What created this feeling of lightness — and how can you keep more of it?",
            "Who or what contributed most to how good you've been feeling?",
            "What would you want to bottle up from right now to open on a harder day?",
            "How has this positive feeling changed how you see things around you?",
            "What does thriving look like for you — and are you closer to it than you realize?",
          ],
          anxious: [
            "What is your anxiety trying to protect you from right now?",
            "What's the worst-case you keep imagining — and how likely is it really?",
            "What small, grounding action could bring you back to the present moment?",
            "What would you need to feel even 10% safer right now?",
            "What has helped you through anxious stretches before?",
          ],
          lonely: [
            "What kind of connection do you most need right now — deep, easy, or just presence?",
            "Who in your life would want to know you're feeling this way?",
            "What makes loneliness harder than usual right now?",
            "What does 'feeling seen' look like for you — and when did you last experience it?",
            "What would you say if you could be completely honest with someone you trust?",
          ],
          grateful: [
            "What recent moment of appreciation surprised you?",
            "Who showed up for you lately in a way you haven't thanked yet?",
            "How has gratitude changed what you notice in your daily life?",
            "What ordinary thing would you miss deeply if it were gone?",
            "How might you pass this sense of appreciation along to someone else?",
          ],
        };

        const dayIndex = Math.floor(Date.now() / 86400000);
        let bank: string[] | undefined;
        if (topEmotion && topEmotion !== "neutral") {
          bank = EMOTION_PROMPT_BANKS[topEmotion as EmotionBucket];
        }
        const prompt = bank
          ? bank[dayIndex % bank.length]
          : GENERAL_PROMPTS[dayIndex % GENERAL_PROMPTS.length];

        const meta = topEmotion && topEmotion !== "neutral" ? EMOTION_META[topEmotion as EmotionBucket] : null;

        return (
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              Reflect on this
            </Text>
            <View style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: 16,
            }}>
              {meta && <Text style={{ fontSize: 18, marginBottom: 8 }}>{meta.emoji}</Text>}
              <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 22, fontStyle: "italic" }}>
                "{prompt}"
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 10 }}>
                {bank ? "Based on your recent emotional pattern." : "A daily prompt to spark reflection."} Take a moment to write this out in your next chat.
              </Text>
            </View>
          </View>
        );
      })()}

      {/* Daily Journal */}
      <JournalSection colors={colors} topEmotion={topEmotion as EmotionBucket | undefined} />

      {/* Future Letters */}
      <FutureLetterSection colors={colors} />

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
