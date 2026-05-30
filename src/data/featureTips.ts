// src/data/featureTips.ts
// Feature discovery tips — one per hour, shown as a capsule in the chat screen.
// Keep each tip to one short sentence. Categories control the card gradient color.

export type TipCategory =
  | "chat"       // purple
  | "voice"      // sky blue
  | "growth"     // emerald
  | "companion"  // pink
  | "privacy"    // indigo
  | "settings";  // slate

export type FeatureTip = {
  id: string;
  emoji: string;
  title: string;
  tip: string;       // one sentence, max ~80 chars
  category: TipCategory;
};

export const FEATURE_TIPS: FeatureTip[] = [
  // ── Chat ──────────────────────────────────────────────────────────────────
  { id: "mic", emoji: "🎤", title: "Voice input", tip: "Tap the mic to speak — Imotara listens and replies without typing.", category: "chat" },
  { id: "speaker", emoji: "🔊", title: "Listen to replies", tip: "Tap the speaker icon on any reply to hear it read aloud in a warm voice.", category: "chat" },
  { id: "reactions", emoji: "😊", title: "React to messages", tip: "Tap the emoji icon under any reply to react with a feeling.", category: "chat" },
  { id: "copy", emoji: "📋", title: "Copy a message", tip: "Tap the copy icon under any reply to save it to your clipboard.", category: "chat" },
  { id: "star", emoji: "⭐", title: "Bookmark messages", tip: "Star any message to bookmark it — find all bookmarks in History.", category: "chat" },
  { id: "new_thread", emoji: "✏️", title: "Start fresh", tip: "Tap the pencil icon in the top bar to begin a new conversation thread.", category: "chat" },
  { id: "hands_free", emoji: "🤲", title: "Hands-free mode", tip: "Enable Hands-free in Settings to auto-speak replies and start listening automatically.", category: "chat" },
  { id: "companion_react", emoji: "💜", title: "Companion reactions", tip: "Imotara sometimes reacts to your messages with a small emoji — a quiet sign it noticed.", category: "chat" },
  { id: "grief_mode", emoji: "💙", title: "Grief & Loss space", tip: "Tap ··· in the chat header for a gentler mode designed for loss and grief.", category: "chat" },
  { id: "unsent_letter", emoji: "💌", title: "Unsent letter", tip: "Write a letter to someone you can't speak to — Imotara responds in their voice.", category: "chat" },
  { id: "breathing", emoji: "🌬️", title: "Breathing exercise", tip: "Tap ··· in the chat header for a guided breathing exercise — great for anxiety.", category: "chat" },
  { id: "offline", emoji: "📱", title: "Works offline", tip: "On-device replies work even without internet — your conversations stay on your phone.", category: "chat" },

  // ── Voice ─────────────────────────────────────────────────────────────────
  { id: "tts_speed", emoji: "⚡", title: "Voice speed", tip: "Adjust TTS speed and pitch in Settings → Experience so replies sound just right.", category: "voice" },
  { id: "tts_auto", emoji: "🔁", title: "Auto-read replies", tip: "Enable Auto-read in Settings to hear every reply automatically — no tap needed.", category: "voice" },
  { id: "voice_lang", emoji: "🌍", title: "Voice in your language", tip: "Imotara speaks back in the same language you use — Hindi, Bengali, Tamil, and 19 more.", category: "voice" },
  { id: "voice_quality", emoji: "🎙️", title: "Voice quality", tip: "Set recording quality in Settings → Experience if your voice isn't being heard clearly.", category: "voice" },

  // ── Growth & Trends ────────────────────────────────────────────────────────
  { id: "trends", emoji: "📊", title: "Emotion trends", tip: "The Trends tab shows your emotional patterns over days, weeks, and months.", category: "growth" },
  { id: "mood_chart", emoji: "📈", title: "Mood chart", tip: "Your mood chart shows whether you've been trending lighter or heavier over time.", category: "growth" },
  { id: "mindset", emoji: "🧠", title: "Mindset analysis", tip: "Tap a time capsule in History for a deep insight into your emotional patterns.", category: "growth" },
  { id: "challenge", emoji: "🎯", title: "30-day challenge", tip: "Join the 30-day reflection challenge in Trends for a daily prompt to grow.", category: "growth" },
  { id: "emotional_arc", emoji: "🌊", title: "Emotional arc", tip: "Once a month, Imotara writes a personal narrative of your emotional journey.", category: "growth" },
  { id: "fingerprint", emoji: "🔮", title: "Emotional fingerprint", tip: "Your emotional fingerprint in Trends shows your unique pattern of expressed feelings.", category: "growth" },
  { id: "on_this_day", emoji: "📅", title: "On this day", tip: "See a reflection from the same date in past months — a quiet moment of continuity.", category: "growth" },
  { id: "journal", emoji: "📓", title: "Reflection journal", tip: "Write private reflection notes in Trends — only you can see them.", category: "growth" },
  { id: "pulse", emoji: "💫", title: "Collective pulse", tip: "The collective pulse shows what emotions others are feeling today — you're not alone.", category: "growth" },
  { id: "search_settings", emoji: "🔍", title: "Settings search", tip: "Type what you're looking for in the Settings search bar — finds any setting instantly.", category: "settings" },

  // ── Companion ─────────────────────────────────────────────────────────────
  { id: "companion_name", emoji: "💬", title: "Name your companion", tip: "Give your companion a personal name in Settings → Your companion.", category: "companion" },
  { id: "companion_tone", emoji: "🌸", title: "Companion tone", tip: "Choose how your companion relates to you — as a friend, mentor, coach, or calm presence.", category: "companion" },
  { id: "companion_letter", emoji: "✉️", title: "Monthly letter", tip: "Once a month, your companion writes you a personal letter reflecting on your journey.", category: "companion" },
  { id: "letter_archive", emoji: "📬", title: "Letter archive", tip: "Browse all past letters in Trends — react to them, listen, or write a reply.", category: "companion" },
  { id: "companion_lang", emoji: "🗣️", title: "Language of companion", tip: "Imotara replies in whatever language you write in — switch anytime, mid-conversation.", category: "companion" },
  { id: "teen_mode", emoji: "🎓", title: "Teen insights mode", tip: "Enable Teen Insights in Settings for more careful, age-appropriate responses for under-18 users.", category: "companion" },
  { id: "memory", emoji: "🧩", title: "Companion memory", tip: "Imotara remembers things about you across conversations — like a friend who pays attention.", category: "companion" },

  // ── Privacy ───────────────────────────────────────────────────────────────
  { id: "local_first", emoji: "🔒", title: "Local-first", tip: "All your conversations stay on your phone by default — nothing leaves unless you choose.", category: "privacy" },
  { id: "export", emoji: "📤", title: "Export your data", tip: "Export all your conversations as JSON or CSV anytime from Settings → Privacy & safety.", category: "privacy" },
  { id: "clear", emoji: "🗑️", title: "Clear history", tip: "Delete all local chat history in Settings → Privacy & safety — your choice, your data.", category: "privacy" },
  { id: "account_backup", emoji: "☁️", title: "Account backup", tip: "Sign in to optionally back up your history and access it on multiple devices.", category: "privacy" },
  { id: "no_ads", emoji: "🚫", title: "No ads, ever", tip: "Imotara has no ads and never sells your data — your conversations are yours alone.", category: "privacy" },
  { id: "emotion_consent", emoji: "✅", title: "Emotion analysis consent", tip: "You control whether Imotara tracks your emotions — revoke consent anytime in Settings.", category: "privacy" },
  { id: "family_snapshot", emoji: "👨‍👩‍👧", title: "Family snapshot", tip: "Share an anonymous emotional snapshot with trusted family in Settings → Privacy.", category: "privacy" },

  // ── Settings ─────────────────────────────────────────────────────────────
  { id: "dark_mode", emoji: "🌙", title: "Dark mode", tip: "Switch to dark or light mode in Settings → Experience to match your preference.", category: "settings" },
  { id: "text_size", emoji: "🔡", title: "Text size", tip: "Make text bigger or smaller in Settings → Experience for a more comfortable read.", category: "settings" },
  { id: "reminder", emoji: "🔔", title: "Daily reminder", tip: "Set a gentle daily check-in reminder in Settings so Imotara stays part of your routine.", category: "settings" },
  { id: "reply_source", emoji: "📡", title: "Reply source", tip: "Enable 'Show reply source' in Settings to see whether each reply came from online or on-device.", category: "settings" },
  { id: "version", emoji: "📱", title: "App version", tip: "Your current version and build number are shown at the bottom of Settings → Advanced.", category: "settings" },
  { id: "22_languages", emoji: "🌐", title: "22 languages", tip: "Imotara supports 22 languages including Hindi, Bengali, Tamil, Arabic, Chinese, Japanese, and more.", category: "settings" },
];

// ── Rotation helpers ─────────────────────────────────────────────────────────

const LAST_INDEX_KEY = "imotara.feature_tip.last_index.v1";
const LAST_SHOWN_KEY = "imotara.feature_tip.last_shown_at.v1";
const INTERVAL_MS    = 60 * 60 * 1000; // 1 hour

import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getCurrentTip(): Promise<{ tip: FeatureTip; index: number }> {
  try {
    const [idxRaw, lastRaw] = await Promise.all([
      AsyncStorage.getItem(LAST_INDEX_KEY),
      AsyncStorage.getItem(LAST_SHOWN_KEY),
    ]);

    let idx = idxRaw ? parseInt(idxRaw, 10) : 0;
    if (!isFinite(idx) || idx < 0) idx = 0;

    const lastShown = lastRaw ? Number(lastRaw) : 0;
    const elapsed   = Date.now() - lastShown;

    if (elapsed >= INTERVAL_MS) {
      // Advance to next tip
      idx = (idx + 1) % FEATURE_TIPS.length;
      await Promise.all([
        AsyncStorage.setItem(LAST_INDEX_KEY, String(idx)),
        AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now())),
      ]);
    }

    const safeIdx = idx % FEATURE_TIPS.length;
    return { tip: FEATURE_TIPS[safeIdx], index: safeIdx };
  } catch {
    return { tip: FEATURE_TIPS[0], index: 0 };
  }
}

export async function advanceTip(currentIndex: number): Promise<{ tip: FeatureTip; index: number }> {
  const next = (currentIndex + 1) % FEATURE_TIPS.length;
  try {
    await Promise.all([
      AsyncStorage.setItem(LAST_INDEX_KEY, String(next)),
      AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now())),
    ]);
  } catch {}
  return { tip: FEATURE_TIPS[next], index: next };
}

export async function prevTip(currentIndex: number): Promise<{ tip: FeatureTip; index: number }> {
  const prev = (currentIndex - 1 + FEATURE_TIPS.length) % FEATURE_TIPS.length;
  try {
    await AsyncStorage.setItem(LAST_INDEX_KEY, String(prev));
  } catch {}
  return { tip: FEATURE_TIPS[prev], index: prev };
}

export const CATEGORY_COLORS: Record<TipCategory, { bg: string; border: string; text: string; badge: string }> = {
  chat:      { bg: "rgba(139,92,246,0.13)", border: "rgba(139,92,246,0.30)", text: "#c4b5fd", badge: "rgba(139,92,246,0.25)" },
  voice:     { bg: "rgba(14,165,233,0.12)",  border: "rgba(14,165,233,0.28)",  text: "#7dd3fc", badge: "rgba(14,165,233,0.22)" },
  growth:    { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.28)",  text: "#6ee7b7", badge: "rgba(16,185,129,0.22)" },
  companion: { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.28)",  text: "#f9a8d4", badge: "rgba(236,72,153,0.22)" },
  privacy:   { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.28)",  text: "#a5b4fc", badge: "rgba(99,102,241,0.22)" },
  settings:  { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.28)", text: "#cbd5e1", badge: "rgba(100,116,139,0.22)" },
};
