// src/data/settingsCatalog.ts
// Comprehensive index of all Imotara settings for AI-powered search.
// Each entry includes natural-language descriptions and multilingual keywords.

export type SettingEntry = {
  id: string;
  title: string;
  section: string;         // Display section name
  sectionKey: string;      // Maps to accordion key in SettingsScreen
  description: string;     // Plain-language description
  keywords: string[];      // Synonyms and natural-language phrases
};

export const SETTINGS_CATALOG: SettingEntry[] = [
  // ── COMPANION ──────────────────────────────────────────────────────────────
  {
    id: "companion_name",
    title: "Companion name",
    section: "Your companion",
    sectionKey: "companion",
    description: "Change the name of your AI companion",
    keywords: ["companion name", "rename", "call her", "call him", "name my companion", "change name", "companion called", "साथी का नाम", "সঙ্গীর নাম"],
  },
  {
    id: "companion_relationship",
    title: "Relationship style",
    section: "Your companion",
    sectionKey: "companion",
    description: "Set how your companion relates to you — close friend, calm companion, coach, or mentor",
    keywords: ["relationship", "friend", "coach", "mentor", "calm", "tone", "style", "companion style", "how companion talks", "रिश्ता", "সম্পর্ক"],
  },
  {
    id: "companion_gender",
    title: "Companion gender",
    section: "Your companion",
    sectionKey: "companion",
    description: "Choose the gender tone of your companion's voice and language",
    keywords: ["gender", "female", "male", "she", "he", "her", "him", "neutral", "companion gender", "लिंग", "লিঙ্গ"],
  },
  {
    id: "companion_age",
    title: "Companion age tone",
    section: "Your companion",
    sectionKey: "companion",
    description: "Set whether the companion speaks with a younger, peer, or elder tone",
    keywords: ["age", "older", "younger", "elder", "peer", "age tone", "उम्र", "বয়স"],
  },
  {
    id: "letter_cadence",
    title: "Letter frequency",
    section: "Your companion",
    sectionKey: "companion",
    description: "How often Imotara writes you a personal letter — monthly, weekly, or custom",
    keywords: ["letter", "monthly letter", "frequency", "how often letter", "companion letter", "letter schedule", "पत्र", "চিঠি"],
  },

  // ── LANGUAGE ───────────────────────────────────────────────────────────────
  {
    id: "language",
    title: "Language",
    section: "Experience",
    sectionKey: "experience",
    description: "Change the app language. Supports Hindi, Bengali, Tamil, Telugu, Arabic, Chinese, Japanese, English and 14 more",
    keywords: ["language", "hindi", "bengali", "tamil", "english", "arabic", "chinese", "japanese", "español", "français", "deutsch", "भाषा", "ভাষা", "மொழி", "change language", "speak in", "reply in"],
  },

  // ── APPEARANCE / EXPERIENCE ────────────────────────────────────────────────
  {
    id: "dark_mode",
    title: "Dark mode / Light mode",
    section: "Experience",
    sectionKey: "experience",
    description: "Switch between dark and light theme",
    keywords: ["dark mode", "light mode", "theme", "dark", "light", "night mode", "brightness", "डार्क मोड", "ডার্ক মোড", "rात का मोड"],
  },
  {
    id: "text_size",
    title: "Text size",
    section: "Experience",
    sectionKey: "experience",
    description: "Increase or decrease the font size throughout the app",
    keywords: ["text size", "font size", "bigger text", "smaller text", "font", "readability", "large text", "टेक्स्ट साइज़", "টেক্সট সাইজ"],
  },
  {
    id: "companion_reactions",
    title: "Companion reactions",
    section: "Advanced",
    sectionKey: "advanced",
    description: "Enable or disable Imotara reacting to your messages with emoji",
    keywords: ["companion reactions", "emoji reactions", "imotara emoji", "reaction", "thumbs up", "heart", "disable reactions", "प्रतिक्रिया", "প্রতিক্রিয়া"],
  },
  {
    id: "show_sync_badge",
    title: "Show sync status badge",
    section: "Experience",
    sectionKey: "experience",
    description: "Show or hide the Local/Cloud badge on messages",
    keywords: ["sync badge", "local badge", "cloud badge", "hide badge", "local cloud label", "source badge", "badge", "सिंक बैज", "সিঙ্ক ব্যাজ"],
  },
  {
    id: "mood_glimpse",
    title: "Mood glimpse card",
    section: "Experience",
    sectionKey: "experience",
    description: "Show or hide the mood snapshot card in the chat screen",
    keywords: ["mood glimpse", "mood card", "mood snapshot", "hide mood", "मूड कार्ड", "মুড কার্ড"],
  },

  // ── VOICE & TTS ────────────────────────────────────────────────────────────
  {
    id: "tts_auto_read",
    title: "Auto-read new messages",
    section: "Experience",
    sectionKey: "experience",
    description: "Automatically read Imotara's responses aloud using text-to-speech",
    keywords: ["text to speech", "tts", "auto read", "read aloud", "speak", "voice", "speak responses", "ऑटो रीड", "স্বয়ংক্রিয় পড়া", "listen", "audio"],
  },
  {
    id: "tts_speed",
    title: "TTS speed & pitch",
    section: "Experience",
    sectionKey: "experience",
    description: "Adjust how fast and high the companion's voice reads messages aloud",
    keywords: ["voice speed", "tts speed", "speaking speed", "pitch", "fast voice", "slow voice", "voice pitch", "আওয়াজের গতি", "आवाज की गति"],
  },
  {
    id: "voice_input",
    title: "Voice input",
    section: "Experience",
    sectionKey: "experience",
    description: "Use microphone to speak your messages instead of typing",
    keywords: ["voice input", "microphone", "speak", "talk", "dictate", "speech to text", "hands free", "माइक्रोफोन", "মাইক্রোফোন"],
  },
  {
    id: "voice_quality",
    title: "Voice recording quality",
    section: "Experience",
    sectionKey: "experience",
    description: "Set the microphone recording quality — low, medium, or high",
    keywords: ["voice quality", "recording quality", "microphone quality", "audio quality", "ध्वनि गुणवत्ता", "রেকর্ডিং গুণমান"],
  },
  {
    id: "chat_relationship_backdrop",
    title: "Colour the chat by relationship",
    section: "Experience",
    sectionKey: "experience",
    description: "Give the chat message area a background colour that matches your companion relationship — friend, mentor, coach and the rest each get their own",
    keywords: ["chat background", "background colour", "background color", "wallpaper", "chat theme", "colour the chat", "relationship colour", "change chat background", "chat colour", "चैट पृष्ठभूमि", "চ্যাটের পটভূমি"],
  },
  {
    id: "voice_auto_send",
    title: "Send voice notes automatically",
    section: "Experience",
    sectionKey: "experience",
    description: "Send a voice transcription as soon as it is ready, instead of putting it in the composer to edit first",
    keywords: ["auto send", "autosend", "send automatically", "voice note", "send voice", "no editing", "send transcription", "straight away", "अपने आप भेजें", "স্বয়ংক্রিয়ভাবে পাঠান"],
  },
  {
    id: "hands_free",
    title: "Hands-free mode",
    section: "Experience",
    sectionKey: "experience",
    description: "Automatically start voice input and play responses — fully hands-free experience",
    keywords: ["hands free", "handsfree", "automatic voice", "auto voice", "speak automatically", "हैंड्स फ्री", "হ্যান্ডস ফ্রি"],
  },

  // ── MEMORY ─────────────────────────────────────────────────────────────────
  {
    id: "memory_capture",
    title: "Auto-capture memories",
    section: "Experience",
    sectionKey: "experience",
    description: "Automatically remember things you share about yourself across conversations",
    keywords: ["memory", "remember", "auto capture", "remember me", "personal memory", "recall", "स्मृति", "স্মৃতি"],
  },
  {
    id: "memory_max",
    title: "Memory capacity",
    section: "Experience",
    sectionKey: "experience",
    description: "Maximum number of personal memories Imotara stores about you",
    keywords: ["memory limit", "memory capacity", "how many memories", "memory count", "स्मृति सीमा", "স্মৃতির সীমা"],
  },

  // ── CHAT & HISTORY ─────────────────────────────────────────────────────────
  {
    id: "chat_cleanup",
    title: "Auto-delete old conversations",
    section: "Experience",
    sectionKey: "experience",
    description: "Automatically delete conversations older than a set number of days",
    keywords: ["auto delete", "delete old chats", "cleanup", "clear old", "conversation limit", "history cleanup", "पुरानी बातचीत हटाएं", "পুরনো কথোপকথন মুছুন"],
  },
  {
    id: "challenge_show",
    title: "30-day reflection challenge",
    section: "Experience",
    sectionKey: "experience",
    description: "Show or hide the 30-day daily reflection challenge tracker",
    keywords: ["30 day challenge", "reflection challenge", "daily challenge", "challenge tracker", "३० दिन", "৩০ দিন"],
  },
  {
    id: "journal_show",
    title: "Reflection journal",
    section: "Experience",
    sectionKey: "experience",
    description: "Show or hide the personal reflection journal section",
    keywords: ["journal", "reflection journal", "diary", "write journal", "जर्नल", "জার্নাল"],
  },
  {
    id: "breathing_pattern",
    title: "Default breathing pattern",
    section: "Experience",
    sectionKey: "experience",
    description: "Set the default breathing exercise pattern — box breathing, 4-7-8, or others",
    keywords: ["breathing", "breathe", "breathing exercise", "meditation", "breath pattern", "4-7-8", "box breathing", "साँस", "শ্বাস"],
  },

  // ── MINDSET ANALYSIS ───────────────────────────────────────────────────────
  {
    id: "mindset_analysis",
    title: "Mindset Analysis",
    section: "Mindset Analysis",
    sectionKey: "mindset",
    description: "Enable or disable psychological mindset analysis of your conversations",
    keywords: ["mindset analysis", "psychological analysis", "conversation analysis", "insights", "mental analysis", "मानसिकता विश्लेषण", "মানসিক বিশ্লেষণ"],
  },
  {
    id: "mood_chart",
    title: "Mood chart",
    section: "Mindset Analysis",
    sectionKey: "mindset",
    description: "Show or hide the mood trend chart over time",
    keywords: ["mood chart", "mood graph", "mood trend", "emotion chart", "मूड चार्ट", "মুড চার্ট"],
  },

  // ── SYNC & PRIVACY ─────────────────────────────────────────────────────────
  {
    id: "cloud_sync",
    title: "Cloud sync",
    section: "Privacy & safety",
    sectionKey: "privacy",
    description: "Sync your conversations and data across devices using your account",
    keywords: ["cloud sync", "sync", "backup", "cross device", "sync data", "क्लाउड सिंक", "ক্লাউড সিঙ্ক", "sync across devices"],
  },
  {
    id: "export_data",
    title: "Export data",
    section: "Privacy & safety",
    sectionKey: "privacy",
    description: "Export your conversation history as JSON or CSV file",
    keywords: ["export", "download data", "backup", "save data", "export json", "export csv", "निर्यात", "ডেটা রপ্তানি"],
  },
  {
    id: "clear_history",
    title: "Clear history",
    section: "Privacy & safety",
    sectionKey: "privacy",
    description: "Delete all your local conversation history",
    keywords: ["clear history", "delete history", "erase", "wipe", "clear all", "delete all", "इतिहास साफ़ करें", "ইতিহাস মুছুন"],
  },
  {
    id: "delete_account",
    title: "Delete account",
    section: "Privacy & safety",
    sectionKey: "privacy",
    description: "Permanently delete your Imotara account and all associated data",
    keywords: ["delete account", "remove account", "account deletion", "खाता हटाएं", "অ্যাকাউন্ট মুছুন"],
  },

  // ── PLAN & ACCOUNT ─────────────────────────────────────────────────────────
  {
    id: "upgrade_plan",
    title: "Upgrade plan",
    section: "Your plan",
    sectionKey: "support",
    description: "Upgrade to Plus or Pro for unlimited replies, cloud sync, and advanced features",
    keywords: ["upgrade", "plus", "pro", "subscription", "premium", "unlimited", "plan", "buy", "अपग्रेड", "আপগ্রেড"],
  },
  {
    id: "token_credits",
    title: "Token credits",
    section: "Your plan",
    sectionKey: "support",
    description: "Buy additional AI reply tokens for on-demand access",
    keywords: ["tokens", "credits", "buy tokens", "token pack", "top up", "टोकन", "টোকেন"],
  },
  {
    id: "sign_in",
    title: "Sign in / Sign out",
    section: "Your plan",
    sectionKey: "support",
    description: "Sign in with Google or Apple to sync your data, or sign out of your account",
    keywords: ["sign in", "sign out", "login", "logout", "google", "apple", "account", "साइन इन", "সাইন ইন"],
  },
  {
    id: "org_membership",
    title: "Organization membership",
    section: "Your plan",
    sectionKey: "support",
    description: "See which organization, NGO, school, or company manages your plan and your role there",
    keywords: ["organization", "org", "ngo", "company", "school", "managed by", "who manages my plan", "enterprise", "workplace", "employer", "संगठन", "সংস্থা"],
  },
  {
    id: "donate",
    title: "Donate to Imotara",
    section: "Plan & support",
    sectionKey: "support",
    description: "Support the development of Imotara with a one-time donation",
    keywords: ["donate", "donation", "support", "contribute", "दान", "দান"],
  },

  // ── ADVANCED ───────────────────────────────────────────────────────────────
  {
    id: "app_version",
    title: "App version",
    section: "Advanced",
    sectionKey: "advanced",
    description: "View the current app version and build number",
    keywords: ["version", "build", "app version", "which version", "संस्करण", "ভার্সন"],
  },
  {
    id: "emotional_arc",
    title: "Emotional arc cadence",
    section: "Your companion",
    sectionKey: "companion",
    description: "How often Imotara generates your monthly emotional journey story",
    keywords: ["emotional arc", "arc cadence", "emotional story", "journey story", "भावनात्मक चाप", "আবেগময় আর্ক"],
  },
  {
    id: "on_this_day",
    title: "On this day",
    section: "Experience",
    sectionKey: "experience",
    description: "Show a memory or reflection from the same day in previous months",
    keywords: ["on this day", "memory", "past conversation", "this day last year", "आज के दिन", "আজকের দিনে"],
  },
  {
    id: "emotional_fingerprint",
    title: "Emotional fingerprint",
    section: "Experience",
    sectionKey: "experience",
    description: "Visual chart showing your unique emotional patterns over time",
    keywords: ["emotional fingerprint", "emotion pattern", "emotion chart", "fingerprint", "भावनात्मक पहचान", "আবেগীয় ছাপ"],
  },
  {
    id: "teen_mode",
    title: "Teen insights mode",
    section: "Experience",
    sectionKey: "experience",
    description: "Age-appropriate responses and insights for users aged 13-17",
    keywords: ["teen mode", "teenager", "young", "youth mode", "13-17", "किशोर", "কিশোর"],
  },

  // ── ADDED 2026-09-12 ───────────────────────────────────────────────────────
  // Eighteen settings that existed on the Settings screen but had no catalog
  // entry, so search could never return them — searching "timestamp" answered
  // "No settings found". Found because the owner tried exactly that.
  // settingsCatalogCoverage.test.ts now fails if a new SettingRow is added
  // without one of these.
  {
    id: "chat_timestamps",
    title: "Show message timestamps",
    section: "Advanced",
    sectionKey: "advanced",
    description: "Show or hide the time printed under each chat message",
    keywords: ["timestamp", "timestamps", "time stamp", "message time", "show time", "hide time", "clock", "when sent", "time under message", "समय", "टाइमस्टैम्प", "সময়", "টাইমস্ট্যাম্প"],
  },
  {
    id: "notif_sound",
    title: "Reminder sound",
    section: "Experience",
    sectionKey: "experience",
    description: "Play a sound when the inactivity reminder notification fires",
    keywords: ["notification sound", "reminder sound", "play sound", "alert sound", "silent notification", "mute reminder", "ध्वनि", "आवाज़", "শব্দ"],
  },
  {
    id: "notif_badge",
    title: "App icon badge",
    section: "Experience",
    sectionKey: "experience",
    description: "Show a number badge on the Imotara app icon when there is something waiting",
    keywords: ["badge", "app icon badge", "red dot", "unread count", "notification badge", "icon number", "बैज", "ব্যাজ"],
  },
  {
    id: "voice_cloud_transcription",
    title: "Online transcription",
    section: "Experience",
    sectionKey: "experience",
    description: "Send voice recordings to the server to be turned into text. Turning it off stops voice input entirely, because there is no on-device speech recognition",
    keywords: ["online transcription", "cloud transcription", "speech to text", "transcribe", "voice to text", "offline voice", "privacy voice", "mic privacy", "ट्रांसक्रिप्शन", "ট্রান্সক্রিপশন"],
  },
  {
    id: "voice_confirm",
    title: "Ask before using voice text",
    section: "Experience",
    sectionKey: "experience",
    description: "Show a confirmation before putting transcribed speech into the message box",
    keywords: ["confirm voice", "ask before", "review transcription", "check before sending", "voice confirmation", "पुष्टि", "নিশ্চিত"],
  },
  {
    id: "reduced_motion",
    title: "Reduced motion",
    section: "Experience",
    sectionKey: "experience",
    description: "Reduce animations and movement across the app",
    keywords: ["reduced motion", "animation", "animations off", "less movement", "motion sickness", "accessibility", "still", "एनिमेशन", "অ্যানিমেশন"],
  },
  {
    id: "grow_nudge_hide",
    title: "Hide Grow nudge",
    section: "Experience",
    sectionKey: "experience",
    description: "Permanently hide the suggestion to try the Grow feature in chat",
    keywords: ["grow nudge", "hide grow", "grow suggestion", "stop suggesting", "dismiss grow", "ग्रो", "গ্রো"],
  },
  {
    id: "sentiment_chips",
    title: "Sentiment seed chips",
    section: "Experience",
    sectionKey: "experience",
    description: "Show the quick-tap mood hints above the message box, such as \"Feeling heavy\" or \"Need to vent\"",
    keywords: ["sentiment chips", "mood chips", "quick taps", "seed chips", "feeling heavy", "need to vent", "suggestion chips", "मूड चिप्स", "মুড চিপস"],
  },
  {
    id: "weekly_recap",
    title: "Weekly mood recap",
    section: "Experience",
    sectionKey: "experience",
    description: "Show a summary of how your week has felt, based on your recent messages",
    keywords: ["weekly recap", "week summary", "mood recap", "weekly summary", "how my week was", "साप्ताहिक", "সাপ্তাহিক"],
  },
  {
    id: "message_undo",
    title: "Message undo",
    section: "Experience",
    sectionKey: "experience",
    description: "Give a few seconds to take a message back after sending it",
    keywords: ["undo", "unsend", "take back", "cancel message", "undo send", "recall message", "5 seconds", "वापस", "ফিরিয়ে"],
  },
  {
    id: "daily_checkin",
    title: "Daily check-in",
    section: "Experience",
    sectionKey: "experience",
    description: "Show the once-a-day check-in prompt in chat",
    keywords: ["daily check-in", "check in", "daily prompt", "everyday question", "दैनिक", "দৈনিক"],
  },
  {
    id: "collective_pulse",
    title: "Collective pulse",
    section: "Experience",
    sectionKey: "experience",
    description: "Show the anonymous card about how other people are feeling today",
    keywords: ["collective pulse", "others feeling", "community mood", "anonymous pulse", "how others feel", "सामूहिक", "সম্মিলিত"],
  },
  {
    id: "tone_reflection",
    title: "Tone reflection card",
    section: "Experience",
    sectionKey: "experience",
    description: "Show the card that reflects back the tone of a finished conversation",
    keywords: ["tone reflection", "reflection card", "after session", "session summary", "tone card", "प्रतिबिंब", "প্রতিফলন"],
  },
  {
    id: "return_greeting",
    title: "Return greeting",
    section: "Experience",
    sectionKey: "experience",
    description: "Greet you when you come back after being away for a while",
    keywords: ["return greeting", "welcome back", "greeting", "hello again", "when I return", "अभिवादन", "অভিবাদন"],
  },
  {
    id: "milestone_celebration",
    title: "Milestone celebration",
    section: "Experience",
    sectionKey: "experience",
    description: "Celebrate when you work through something you have been carrying for a while",
    keywords: ["milestone", "celebration", "achievement", "progress", "closed loop", "मील का पत्थर", "মাইলফলক"],
  },
  {
    id: "unsent_letter_hint",
    title: "Unsent Letter hint",
    section: "Experience",
    sectionKey: "experience",
    description: "Suggest writing an unsent letter when you talk about a difficult relationship",
    keywords: ["unsent letter", "letter hint", "write a letter", "letter suggestion", "अनभेजा पत्र", "অপ্রেরিত চিঠি"],
  },
  {
    id: "trial_banner",
    title: "Trial countdown banner",
    section: "Experience",
    sectionKey: "experience",
    description: "Show the banner counting down the days left in your trial",
    keywords: ["trial banner", "countdown", "days left", "trial reminder", "expiry banner", "ट्रायल", "ট্রায়াল"],
  },
  {
    id: "history_search_exact",
    title: "Exact history search",
    section: "Experience",
    sectionKey: "experience",
    description: "Match the exact phrase when searching your history, instead of individual words",
    keywords: ["exact search", "phrase search", "search history", "exact match", "whole phrase", "खोज", "অনুসন্ধান"],
  },
];

// ── Local search engine ────────────────────────────────────────────────────

export type SearchResult = SettingEntry & { score: number };

export function searchSettingsLocally(query: string, topN = 5): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);

  const scored = SETTINGS_CATALOG.map((s) => {
    let score = 0;
    const titleLower = s.title.toLowerCase();
    const descLower = s.description.toLowerCase();
    const keywordsLower = s.keywords.map((k) => k.toLowerCase());

    // Exact title match
    if (titleLower === q) score += 50;
    // Title contains query
    if (titleLower.includes(q)) score += 20;
    // Each word found in title
    words.forEach((w) => { if (titleLower.includes(w)) score += 10; });
    // Each keyword match
    keywordsLower.forEach((k) => {
      if (k === q) score += 15;
      if (k.includes(q) || q.includes(k)) score += 8;
      words.forEach((w) => { if (k.includes(w)) score += 4; });
    });
    // Description match
    words.forEach((w) => { if (descLower.includes(w)) score += 2; });
    // Section match
    if (s.section.toLowerCase().includes(q)) score += 5;

    return { ...s, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// Confidence threshold below which we fall back to AI
export const AI_FALLBACK_THRESHOLD = 8;
