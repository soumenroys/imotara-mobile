// src/data/featureTips.ts
// Feature discovery tips — one per hour, shown as a capsule in the chat screen.
// Covers every feature and functionality of Imotara.
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
  tip: string;       // one sentence, max ~90 chars
  category: TipCategory;
};

export const FEATURE_TIPS: FeatureTip[] = [

  // ── Chat — Messaging ────────────────────────────────────────────────────────
  { id: "mic",            emoji: "🎤", title: "Voice input",          tip: "Tap the mic to speak — Imotara listens and replies without any typing.", category: "chat" },
  { id: "new_thread",     emoji: "✏️", title: "Start fresh",           tip: "Tap the pencil icon in the top bar to begin a brand new conversation thread.", category: "chat" },
  { id: "offline",        emoji: "📱", title: "Works offline",         tip: "On-device replies work even without internet — your conversations stay on your phone.", category: "chat" },
  { id: "undo_send",      emoji: "↩️", title: "Undo send",             tip: "There's a 5-second window after sending to undo and edit your message before it's processed.", category: "chat" },
  { id: "copy",           emoji: "📋", title: "Copy a message",        tip: "Tap the copy icon under any reply to save it to your clipboard.", category: "chat" },
  { id: "star",           emoji: "⭐", title: "Bookmark messages",     tip: "Star any message to bookmark it — find all starred messages in the History tab.", category: "chat" },
  { id: "reactions",      emoji: "😊", title: "React to messages",     tip: "Tap the emoji icon under any reply to react with a feeling — love, hope, fire, and more.", category: "chat" },
  { id: "share_msg",      emoji: "📤", title: "Share a message",       tip: "Long-press a message or tap the share icon to send a reply to another app.", category: "chat" },
  { id: "new_session",    emoji: "🔖", title: "Session dividers",      tip: "Each time you return after a break, a 'New session' marker shows where you left off.", category: "chat" },
  { id: "reflection_seed",emoji: "🌱", title: "Reflection seeds",      tip: "Sometimes Imotara drops a small prompt above a reply — tap it to go deeper on a feeling.", category: "chat" },
  { id: "tone_card",      emoji: "🎭", title: "Tone reflection",       tip: "After a meaningful conversation, a tone card appears showing the dominant emotion it detected.", category: "chat" },
  { id: "source_icon",    emoji: "📡", title: "Reply source icon",     tip: "A small phone or cloud icon on each reply shows whether it came from on-device or online mode.", category: "chat" },
  { id: "daily_checkin",  emoji: "☀️", title: "Daily check-in chips",  tip: "Emotion prompt chips appear above the input bar — tap one to start a check-in easily.", category: "chat" },
  { id: "open_loop",      emoji: "🔄", title: "Open loops",            tip: "Imotara occasionally revisits unresolved themes from earlier conversations — a gentle follow-up.", category: "chat" },
  { id: "crisis",         emoji: "🆘", title: "Crisis resources",      tip: "If serious distress is detected, Imotara quietly shows local crisis line numbers for your country.", category: "chat" },
  { id: "cultural_vocab", emoji: "🌺", title: "Untranslatable feelings",tip: "Imotara knows words other languages have for feelings English can't name — like 'saudade' or 'hygge'.", category: "chat" },
  { id: "milestone",      emoji: "🎉", title: "Milestone moments",     tip: "When you resolve a recurring theme, a milestone card appears — Imotara noticed you grew.", category: "chat" },
  { id: "weekly_recap",   emoji: "📋", title: "Weekly mood recap",     tip: "A brief weekly summary appears in chat reminding you of the emotional themes from that week.", category: "chat" },
  { id: "collective_pulse",emoji:"💫", title: "Collective pulse",      tip: "The pulse card shows what % of users are carrying something heavy today — you're not alone.", category: "chat" },
  { id: "bookmarks_tab",  emoji: "🗂️", title: "Bookmarks in History",  tip: "In History, tap the bookmark filter to see only your starred messages across all threads.", category: "chat" },
  { id: "quota",          emoji: "🔢", title: "Daily reply limit",     tip: "Free plan includes 20 enhanced replies per day — on-device replies are always unlimited.", category: "chat" },

  // ── Chat — Special Modes ─────────────────────────────────────────────────────
  { id: "grief_mode",     emoji: "💙", title: "Grief & Loss space",    tip: "Tap ··· in the header to enter a quieter mode for loss — Imotara speaks more slowly and carefully.", category: "chat" },
  { id: "unsent_letter",  emoji: "💌", title: "Unsent letter",         tip: "Write a letter to someone you can't speak to — Imotara responds in their voice for closure.", category: "chat" },
  { id: "unsent_who",     emoji: "🫂", title: "Who to write to",       tip: "Unsent letters can be to a parent, ex-partner, past self, future self, or anyone at all.", category: "chat" },
  { id: "breathing",      emoji: "🌬️", title: "Breathing exercise",    tip: "Tap ··· for a guided breathing exercise — pulsing visual, ambient sound, great for anxiety.", category: "chat" },
  { id: "breathing_types",emoji: "🫁", title: "Breathing patterns",    tip: "Choose 4-7-8, box breathing, or equal breathing — each technique helps with different feelings.", category: "chat" },

  // ── Companion Reactions ──────────────────────────────────────────────────────
  { id: "companion_react",emoji: "💜", title: "Companion reacts",      tip: "Imotara sometimes reacts to your messages with a mood-matched emoji — a quiet sign it noticed.", category: "companion" },
  { id: "react_timing",   emoji: "⏱️", title: "Natural reactions",     tip: "Companion reactions appear 1–2 seconds after a reply — timed to feel like a spontaneous gesture.", category: "companion" },
  { id: "react_disable",  emoji: "🔕", title: "Turn off reactions",    tip: "Prefer a clean chat? Toggle off Companion reactions in Settings → Experience.", category: "companion" },

  // ── Voice & TTS ─────────────────────────────────────────────────────────────
  { id: "speaker",        emoji: "🔊", title: "Listen to replies",     tip: "Tap the speaker icon on any reply to hear it read aloud by Imotara's voice.", category: "voice" },
  { id: "tts_auto",       emoji: "🔁", title: "Auto-read replies",     tip: "Enable Auto-read in Settings to hear every new reply automatically — no tap needed.", category: "voice" },
  { id: "tts_speed",      emoji: "⚡", title: "Voice speed & pitch",   tip: "Adjust TTS speed and pitch in Settings → Experience so the voice feels just right for you.", category: "voice" },
  { id: "tts_stop",       emoji: "⏹️", title: "Stop speaking",         tip: "Tap the stop button while a reply is being read to pause it immediately.", category: "voice" },
  { id: "voice_lang",     emoji: "🌍", title: "22 language voices",    tip: "Imotara speaks back in the same language you write in — Hindi, Bengali, Tamil, Arabic, and 18 more.", category: "voice" },
  { id: "voice_quality",  emoji: "🎙️", title: "Voice recording quality",tip: "Set mic quality in Settings → Experience if voice input isn't picking up your words clearly.", category: "voice" },
  { id: "hands_free",     emoji: "🤲", title: "Hands-free mode",       tip: "Enable Hands-free in Settings to auto-listen and auto-speak — no touching the screen needed.", category: "voice" },
  { id: "online_transcribe",emoji:"☁️",title:"Online transcription",   tip: "Online transcription uses a more accurate model — toggle it in Settings for noisy environments.", category: "voice" },
  { id: "voice_letter",   emoji: "▶️", title: "Listen to letters",     tip: "In Trends, tap the speaker on any companion letter to hear it read aloud in full.", category: "voice" },

  // ── Growth & Trends ──────────────────────────────────────────────────────────
  { id: "trends_tab",     emoji: "📊", title: "Trends tab",            tip: "The Trends tab holds all your growth features — mood, letters, challenges, and more.", category: "growth" },
  { id: "mood_chart",     emoji: "📈", title: "Mood chart",            tip: "Your mood chart shows whether you've been trending lighter or heavier over weeks.", category: "growth" },
  { id: "mindset_today",  emoji: "🧠", title: "Today's mindset",       tip: "Tap 'Today' in the History mindset capsule for a psychological snapshot of today's mood.", category: "growth" },
  { id: "mindset_7",      emoji: "🗓️", title: "7-day mindset",         tip: "The 7-day mindset capsule spots emotional patterns across the whole past week.", category: "growth" },
  { id: "mindset_30",     emoji: "📆", title: "30-day mindset",        tip: "The 30-day view reveals longer recurring themes — things your mind keeps coming back to.", category: "growth" },
  { id: "mindset_all",    emoji: "⏳", title: "All-time mindset",      tip: "The All-time mindset capsule is your full emotional history — scroll down in History to find it.", category: "growth" },
  { id: "emotional_arc",  emoji: "🌊", title: "Emotional arc story",   tip: "Once a month, Imotara writes a flowing narrative of your emotional journey — find it in Trends.", category: "growth" },
  { id: "challenge",      emoji: "🎯", title: "30-day challenge",      tip: "Join the 30-day reflection challenge in Trends — one prompt per day for a month of growth.", category: "growth" },
  { id: "challenge_dot",  emoji: "🟣", title: "Challenge progress",    tip: "Each day you complete gets a filled dot — watch your 30-day grid fill up.", category: "growth" },
  { id: "fingerprint",    emoji: "🔮", title: "Emotional fingerprint", tip: "Your fingerprint visualisation in Trends shows your unique emotional pattern at a glance.", category: "growth" },
  { id: "on_this_day",    emoji: "📅", title: "On this day",           tip: "See what you shared on the same day in past months — a quiet thread of continuity.", category: "growth" },
  { id: "journal",        emoji: "📓", title: "Reflection journal",    tip: "Write private journal entries in Trends — fully local, only you ever read them.", category: "growth" },
  { id: "journal_auto",   emoji: "🗑️", title: "Journal auto-delete",   tip: "Set journal entries to auto-delete after 7, 30, or 90 days in Settings → Experience.", category: "growth" },
  { id: "pulse",          emoji: "💫", title: "Collective pulse",      tip: "The collective pulse shows what emotions others are feeling right now — a reminder you're not alone.", category: "growth" },
  { id: "future_letters", emoji: "🔮", title: "Future letters (web)",  tip: "On web, write a letter to your future self — it locks until the date you choose.", category: "growth" },
  { id: "mood_glimpse",   emoji: "👁️", title: "Mood glimpse card",     tip: "A subtle mood snapshot card appears in chat — toggle it on or off in Settings.", category: "growth" },
  { id: "search_settings",emoji: "🔍", title: "Settings search",       tip: "Type what you're looking for in the Settings search bar — finds any setting in plain language.", category: "settings" },
  { id: "history_search", emoji: "🔎", title: "History search",        tip: "Use the search bar in History to find any conversation by keyword.", category: "growth" },

  // ── Companion ─────────────────────────────────────────────────────────────
  { id: "companion_name", emoji: "💬", title: "Name your companion",   tip: "Give your companion a personal name in Settings → Your companion — make it feel like yours.", category: "companion" },
  { id: "companion_tone", emoji: "🌸", title: "Relationship style",    tip: "Choose how your companion relates to you — close friend, calm presence, coach, or mentor.", category: "companion" },
  { id: "companion_gender",emoji:"🦋", title: "Companion gender",      tip: "Set your companion's gender tone in Settings so its language feels natural to you.", category: "companion" },
  { id: "companion_age",  emoji: "🎓", title: "Companion age tone",    tip: "Set whether your companion sounds like a peer, a younger voice, or a wise elder.", category: "companion" },
  { id: "letter",         emoji: "✉️", title: "Monthly letter",        tip: "Once a month, your companion writes you a personal letter reflecting on your journey.", category: "companion" },
  { id: "letter_deep",    emoji: "🧬", title: "Personal letters",      tip: "Letters are written using your actual words and emotional patterns — no two letters are alike.", category: "companion" },
  { id: "letter_cadence", emoji: "📬", title: "Letter frequency",      tip: "Choose how often you receive letters from your companion in Settings → Your companion.", category: "companion" },
  { id: "letter_archive", emoji: "📚", title: "Letter archive",        tip: "All past letters live in Trends — browse months of letters and see how you've grown.", category: "companion" },
  { id: "letter_react",   emoji: "❤️", title: "React to letters",      tip: "Place an emoji reaction on any letter — a heart, a star, a tear — to mark how it landed.", category: "companion" },
  { id: "letter_reply",   emoji: "↩️", title: "Reply to letters",      tip: "Write a reply back to your companion's letter — a private dialogue that stays in the archive.", category: "companion" },
  { id: "letter_listen",  emoji: "🎧", title: "Listen to letters",     tip: "Tap the speaker on any letter to hear it read aloud — great for a quiet moment.", category: "companion" },
  { id: "companion_memory",emoji:"🧩", title: "Companion memory",      tip: "Imotara remembers things you share — your name, preferences, and what matters to you.", category: "companion" },
  { id: "memory_capture", emoji: "💡", title: "Auto memory capture",   tip: "Imotara quietly notes things you mention about yourself so it can be more personal over time.", category: "companion" },
  { id: "memory_limit",   emoji: "📦", title: "Memory capacity",       tip: "Set how many memories Imotara keeps in Settings — from 10 to 100 personal details.", category: "companion" },
  { id: "teen_mode",      emoji: "🎓", title: "Teen insights mode",    tip: "Enable Teen Insights in Settings for more careful, age-appropriate responses for under-18 users.", category: "companion" },
  { id: "companion_lang", emoji: "🗣️", title: "Companion language",    tip: "Write in any language and Imotara replies in the same one — switch mid-conversation anytime.", category: "companion" },
  { id: "insight_card",   emoji: "🌟", title: "Companion insight card",tip: "A quiet card occasionally appears when Imotara has something personal to share with you.", category: "companion" },
  { id: "unsent_voice",   emoji: "🎤", title: "Unsent letter by voice",tip: "You can speak your unsent letter using the mic — Imotara transcribes it before responding.", category: "companion" },

  // ── Growth — Psychological depth ─────────────────────────────────────────────
  { id: "psych_tools",    emoji: "🔬", title: "71 psychological tools",tip: "Imotara draws on 71 research-backed tools to respond — from CBT to narrative therapy.", category: "growth" },
  { id: "secondary_emo",  emoji: "🎭", title: "Secondary emotions",    tip: "Imotara looks for the emotion beneath the emotion — anger often hides fear or grief.", category: "growth" },
  { id: "pattern_spot",   emoji: "🔁", title: "Pattern recognition",   tip: "If you keep returning to the same pain, Imotara gently names the pattern it sees.", category: "growth" },
  { id: "hope_honest",    emoji: "🕯️", title: "Honest hope",           tip: "Imotara never says 'it'll be fine' — it offers real, earned hope grounded in truth.", category: "growth" },
  { id: "mythology",      emoji: "📖", title: "Mythological stories",  tip: "Imotara weaves in stories from the Gita, Rumi, Stoics, and more when the moment calls for it.", category: "growth" },
  { id: "multilingual_depth",emoji:"🌐",title:"Deep in every language",tip:"All 71 psychological tools work equally in Hindi, Bengali, Arabic, Japanese, and every other language.", category: "growth" },

  // ── Privacy ───────────────────────────────────────────────────────────────
  { id: "local_first",    emoji: "🔒", title: "Local-first",           tip: "All your conversations stay on your phone by default — nothing leaves unless you choose.", category: "privacy" },
  { id: "no_ads",         emoji: "🚫", title: "No ads, ever",          tip: "Imotara has no ads and never sells your data — your conversations are yours alone.", category: "privacy" },
  { id: "emotion_consent",emoji: "✅", title: "Emotion consent",       tip: "You control whether Imotara tracks your emotions — revoke consent anytime in Settings.", category: "privacy" },
  { id: "export_json",    emoji: "📤", title: "Export as JSON",        tip: "Export all conversations as a JSON file from Settings → Privacy & safety → Export data.", category: "privacy" },
  { id: "export_csv",     emoji: "📊", title: "Export as CSV",         tip: "Export your history as a CSV spreadsheet — easy to open in Excel or Google Sheets.", category: "privacy" },
  { id: "export_journal", emoji: "📓", title: "Export journal",        tip: "Export your reflection journal entries separately from Settings → Privacy & safety.", category: "privacy" },
  { id: "clear_local",    emoji: "🗑️", title: "Clear local history",   tip: "Delete all chat history from this device anytime in Settings → Privacy & safety.", category: "privacy" },
  { id: "clear_remote",   emoji: "☁️", title: "Clear remote data",     tip: "Delete your account backup from the server in Settings → Privacy & safety — your choice.", category: "privacy" },
  { id: "delete_account", emoji: "❌", title: "Delete account",        tip: "Permanently delete your account and all associated data in Settings → Privacy & safety.", category: "privacy" },
  { id: "account_backup", emoji: "💾", title: "Account backup",        tip: "Sign in to optionally back up your history and access it on multiple devices.", category: "privacy" },
  { id: "backup_manual",  emoji: "🔄", title: "Back up manually",      tip: "Trigger a manual backup anytime in Settings → Privacy & safety → Back up now.", category: "privacy" },
  { id: "family_snapshot",emoji: "👨‍👩‍👧", title: "Family snapshot",  tip: "Share an anonymous emotional snapshot with trusted family from Settings → Privacy.", category: "privacy" },
  { id: "no_tracking",    emoji: "👁️‍🗨️",title: "No tracking",          tip: "Imotara collects no analytics about you — no usage data, no behaviour profiling.", category: "privacy" },

  // ── Settings — Experience ─────────────────────────────────────────────────
  { id: "dark_mode",      emoji: "🌙", title: "Dark mode",             tip: "Switch between dark and light mode in Settings → Experience to match your preference.", category: "settings" },
  { id: "text_size",      emoji: "🔡", title: "Text size",             tip: "Make text bigger or smaller in Settings → Experience for a more comfortable reading experience.", category: "settings" },
  { id: "reply_source",   emoji: "📡", title: "Show reply source",     tip: "Enable 'Show reply source' in Settings to see the phone or cloud icon on each message.", category: "settings" },
  { id: "mood_glimpse_set",emoji:"👁️", title: "Mood glimpse toggle",   tip: "Hide or show the mood snapshot card in chat from Settings → Experience.", category: "settings" },
  { id: "auto_cleanup",   emoji: "🧹", title: "Auto-delete old chats", tip: "Set conversations to auto-delete after 30, 90, or 180 days in Settings → Experience.", category: "settings" },
  { id: "challenge_show", emoji: "🎯", title: "Show 30-day challenge", tip: "Toggle the challenge tracker on or off in Settings → Experience → Grow & wellbeing.", category: "settings" },
  { id: "breathing_default",emoji:"🌬️",title:"Default breathing pattern",tip:"Set your preferred breathing technique in Settings so it opens to your favourite every time.", category: "settings" },
  { id: "fingerprint_set",emoji: "🔮", title: "Emotional fingerprint", tip: "Toggle the fingerprint visualisation on or off in Settings → Experience.", category: "settings" },
  { id: "on_this_day_set",emoji: "📅", title: "On this day toggle",    tip: "Show or hide the 'On this day' memory card in Settings → Experience.", category: "settings" },
  { id: "journal_max",    emoji: "📓", title: "Journal entry limit",   tip: "Set how many journal entries to keep in Settings — older ones auto-delete when full.", category: "settings" },
  { id: "feature_tips_set",emoji:"🔍", title: "Feature tips toggle",   tip: "Turn hourly feature tips on or off in Settings → Experience — they're on by default.", category: "settings" },

  // ── Settings — Companion & Language ───────────────────────────────────────
  { id: "22_languages",   emoji: "🌐", title: "22 languages",          tip: "Imotara supports 22 languages — switch anytime and it replies in the same language.", category: "settings" },
  { id: "reply_mode",     emoji: "🔀", title: "Online vs on-device",   tip: "Switch between Online (richer) and On-device (private, offline) reply modes in Settings.", category: "settings" },
  { id: "reminder",       emoji: "🔔", title: "Daily reminder",        tip: "Set a gentle daily check-in reminder in Settings to make Imotara part of your routine.", category: "settings" },
  { id: "mindset_toggles",emoji: "🧠", title: "Mindset analysis periods",tip: "Choose which time periods appear in History mindset capsules — today, 7-day, 30-day, all-time.", category: "settings" },
  { id: "accent_color",   emoji: "🎨", title: "Accent colours",        tip: "Pick your favourite accent colour in Settings → Experience to personalise the app's feel.", category: "settings" },

  // ── Plan & Upgrade ────────────────────────────────────────────────────────
  { id: "free_plan",      emoji: "🆓", title: "Free plan",             tip: "The Free plan includes 20 enhanced replies/day, 7-day history, and unlimited on-device replies.", category: "settings" },
  { id: "plus_plan",      emoji: "✨", title: "Plus plan",             tip: "Plus gives unlimited enhanced replies, 90-day history backup, and advanced TTS controls.", category: "settings" },
  { id: "pro_plan",       emoji: "🌟", title: "Pro plan",              tip: "Pro unlocks everything: unlimited replies, full history, companion letters, and all growth tools.", category: "settings" },
  { id: "token_credits",  emoji: "🪙", title: "Token credits",         tip: "Buy extra enhanced reply credits anytime — useful when you need more on the Free plan.", category: "settings" },
  { id: "restore",        emoji: "♻️", title: "Restore purchases",     tip: "Tap 'Restore previous purchases' on the upgrade screen if your plan isn't showing correctly.", category: "settings" },
  { id: "donate",         emoji: "💝", title: "Support Imotara",       tip: "Imotara is independent — a small donation helps keep it ad-free and private for everyone.", category: "settings" },
  { id: "sign_in",        emoji: "🔑", title: "Sign in benefits",      tip: "Signing in (Google or Apple) links your plan, enables account backup, and works across devices.", category: "settings" },
  { id: "version",        emoji: "📱", title: "App version",           tip: "Your current version and build number are at the bottom of Settings → Advanced.", category: "settings" },
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
