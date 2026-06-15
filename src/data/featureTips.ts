// src/data/featureTips.ts
// Feature discovery tips — one per hour, shown as a capsule in the Trends screen.
// Covers every feature, setting, and nuance of Imotara.

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
  tip: string;
  category: TipCategory;
};

export const FEATURE_TIPS: FeatureTip[] = [

  // ── Chat — Core messaging ───────────────────────────────────────────────────
  { id: "mic",               emoji: "🎤", title: "Voice input",             tip: "Tap the mic to speak — Imotara listens and replies without any typing.", category: "chat" },
  { id: "new_thread",        emoji: "✏️", title: "Start fresh",              tip: "Tap the pencil icon in the top bar to begin a new conversation thread anytime.", category: "chat" },
  { id: "offline",           emoji: "📱", title: "Works offline",            tip: "On-device replies work even without internet — conversations stay on your phone.", category: "chat" },
  { id: "undo_send",         emoji: "↩️", title: "Undo send",                tip: "A 5-second window after sending lets you undo and edit your message before it's processed.", category: "chat" },
  { id: "copy",              emoji: "📋", title: "Copy a message",           tip: "Tap the copy icon under any reply to save it to your clipboard.", category: "chat" },
  { id: "star",              emoji: "⭐", title: "Bookmark messages",        tip: "Star any message to bookmark it — find all starred messages in the History tab.", category: "chat" },
  { id: "reactions",         emoji: "😊", title: "React to messages",        tip: "Tap the emoji icon under any reply to react — love, hope, fire, leaf, and more.", category: "chat" },
  { id: "share_msg",         emoji: "📤", title: "Share a reply",            tip: "Tap the copy/share icon under a reply to send it to another app or person.", category: "chat" },
  { id: "new_session",       emoji: "🔖", title: "Session dividers",         tip: "A 'New session' marker shows each time you returned after a break — a timeline of your check-ins.", category: "chat" },
  { id: "auto_save",         emoji: "💚", title: "Auto-save",                tip: "Every conversation is saved automatically — you never need to tap save.", category: "chat" },
  { id: "long_press",        emoji: "👆", title: "Message options",          tip: "Long-press any message to access quick options like copy, bookmark, or share.", category: "chat" },
  { id: "typing_indicator",  emoji: "💭", title: "Thinking indicator",       tip: "The animated dots while Imotara replies mean it's processing — each reply is generated fresh for you.", category: "chat" },
  { id: "timestamps",        emoji: "🕐", title: "Message timestamps",       tip: "Each message shows the exact time it was sent — tap to expand details.", category: "chat" },
  { id: "thread_browse",     emoji: "📜", title: "Browse old threads",       tip: "Every past conversation is saved in History — scroll through months of threads anytime.", category: "chat" },

  // ── Chat — Reply intelligence ────────────────────────────────────────────────
  { id: "source_icon",       emoji: "📡", title: "Reply source icon",        tip: "A small phone icon means on-device reply; a cloud icon means online — both are private.", category: "chat" },
  { id: "quota",             emoji: "🔢", title: "Daily reply limit",        tip: "Free plan includes 20 enhanced replies per day — on-device replies are always unlimited.", category: "chat" },
  { id: "fallback",          emoji: "🔀", title: "Auto fallback",            tip: "When online replies hit the limit, Imotara automatically switches to on-device mode.", category: "chat" },
  { id: "reply_quality",     emoji: "✨", title: "Enhanced vs on-device",    tip: "Enhanced replies use richer psychological depth; on-device replies are private and unlimited.", category: "chat" },
  { id: "context_memory",    emoji: "🧵", title: "In-conversation memory",   tip: "Imotara remembers everything said in the current conversation — it's one continuous thread.", category: "chat" },
  { id: "name_recall",       emoji: "🏷️", title: "Remembers your name",     tip: "Say your name once and Imotara uses it naturally in conversation from then on.", category: "chat" },
  { id: "language_switch",   emoji: "🔄", title: "Switch language mid-chat", tip: "Switch languages mid-conversation — write in Hindi, then English, then Bengali — Imotara follows.", category: "chat" },
  { id: "intent_detection",  emoji: "🎯", title: "Intent detection",         tip: "Imotara reads whether you want to vent, get advice, or just feel heard — and responds accordingly.", category: "chat" },
  { id: "body_language",     emoji: "🫀", title: "Physical symptom awareness",tip: "Mention a tight chest or poor sleep and Imotara acknowledges it specifically — not generically.", category: "chat" },

  // ── Chat — Discovery cards & nudges ─────────────────────────────────────────
  { id: "reflection_seed",   emoji: "🌱", title: "Reflection seeds",         tip: "A small prompt sometimes appears above a reply — it's an invitation to explore a feeling deeper.", category: "chat" },
  { id: "tone_card",         emoji: "🎭", title: "Tone reflection",           tip: "Your session's dominant emotion is reflected in Trends — check your mood chart after a meaningful chat.", category: "growth" },
  { id: "daily_checkin",     emoji: "☀️", title: "Daily mood check-in",      tip: "Tap an emotion in the Trends tab to log today's mood — keeps your streak and mood history alive.", category: "growth" },
  { id: "open_loop",         emoji: "🔄", title: "Open loops",               tip: "A small chip appears in chat if Imotara noticed an unresolved theme — tap Continue to pick up where you left off.", category: "chat" },
  { id: "milestone",         emoji: "🎉", title: "Milestone cards",          tip: "When a recurring theme resolves, a milestone card appears in Trends — Imotara noticed you grew.", category: "growth" },
  { id: "weekly_recap",      emoji: "📋", title: "Weekly mood recap",        tip: "A weekly summary of your emotional themes appears in the Trends tab — check it for insight.", category: "growth" },
  { id: "collective_pulse",  emoji: "💫", title: "Collective pulse",         tip: "Check the Trends tab to see what % of people are carrying something heavy today — you're not alone.", category: "growth" },
  { id: "discovery_card",    emoji: "🗺️", title: "Feature discovery cards",  tip: "Cards in chat occasionally highlight a feature you haven't used yet — a gentle guide.", category: "chat" },
  { id: "grow_nudge",        emoji: "🌿", title: "Trends tab",               tip: "The Trends tab is your growth hub — check it after chatting for insights, mood recap, and more.", category: "growth" },
  { id: "unsent_hint",       emoji: "💭", title: "Unsent letter hint",       tip: "If you seem to be processing something with someone, Imotara may suggest the Unsent Letter space.", category: "chat" },

  // ── Chat — Special modes ─────────────────────────────────────────────────────
  { id: "grief_mode",        emoji: "💙", title: "Grief & Loss space",       tip: "Tap ··· in the header for a quieter mode designed for loss — Imotara speaks more gently.", category: "chat" },
  { id: "grief_no_rush",     emoji: "🕊️", title: "No rushing in grief",      tip: "In Grief mode, Imotara never says 'time heals' or 'they're in a better place' — just presence.", category: "chat" },
  { id: "unsent_letter",     emoji: "💌", title: "Unsent letter",            tip: "Write to someone you can't speak to — Imotara responds in their voice for closure.", category: "chat" },
  { id: "unsent_who",        emoji: "🫂", title: "Who to write to",          tip: "Unsent letters can be to a parent, ex-partner, past self, future self, a friend — anyone.", category: "chat" },
  { id: "unsent_closure",    emoji: "🔑", title: "Writing for closure",      tip: "The unsent letter isn't for sending — it's for the things you need to say but couldn't.", category: "chat" },
  { id: "breathing",         emoji: "🌬️", title: "Breathing exercise",       tip: "Tap ··· in the header for a guided breathing exercise — pulsing visual, calming sounds.", category: "chat" },
  { id: "breathing_types",   emoji: "🫁", title: "Breathing patterns",       tip: "Choose 4-7-8 (anxiety), box breathing (focus), or equal breathing (calm) — each feels different.", category: "chat" },
  { id: "breathing_sound",   emoji: "🎵", title: "Breathing sounds",         tip: "The breathing exercise plays ambient sound — Rain, Ocean waves, or a Singing Bowl.", category: "chat" },

  // ── Chat — History & bookmarks ───────────────────────────────────────────────
  { id: "bookmarks_tab",     emoji: "🗂️", title: "Bookmarks in History",     tip: "In History, tap the bookmark filter to see only your starred messages across all threads.", category: "chat" },
  { id: "history_search",    emoji: "🔎", title: "Search conversations",     tip: "Use the search bar in History to find any word or phrase across all past conversations.", category: "chat" },
  { id: "swipe_delete",      emoji: "👈", title: "Swipe to delete thread",   tip: "In History, swipe a conversation left to reveal the delete option.", category: "chat" },
  { id: "pull_refresh",      emoji: "🔃", title: "Pull to refresh History",  tip: "Pull down in History to refresh and check for any new synced threads.", category: "chat" },
  { id: "crisis",            emoji: "🆘", title: "Crisis resources",         tip: "If serious distress is detected, local crisis line numbers for 60 countries appear quietly.", category: "chat" },
  { id: "cultural_vocab",    emoji: "🌺", title: "Untranslatable feelings",  tip: "Imotara knows 19 words from 11 languages for feelings English can't quite name — like 'saudade'.", category: "chat" },

  // ── Companion reactions ──────────────────────────────────────────────────────
  { id: "companion_react",   emoji: "💜", title: "Companion reacts",         tip: "Imotara sometimes reacts to your messages with a mood-matched emoji — a quiet sign it noticed.", category: "companion" },
  { id: "react_timing",      emoji: "⏱️", title: "Natural reaction timing",  tip: "Reactions appear 1–2 seconds after a reply — timed to feel spontaneous, not automatic.", category: "companion" },
  { id: "react_half",        emoji: "🎲", title: "~50% reaction rate",       tip: "The companion reacts to roughly half your messages — so it always feels like a genuine gesture.", category: "companion" },
  { id: "react_buckets",     emoji: "🎨", title: "Mood-matched emoji",       tip: "Sad messages get 💙 or 🫂, joyful ones get ❤️ or 🌟, proud moments get 🔥 or ⭐.", category: "companion" },
  { id: "react_disable",     emoji: "🔕", title: "Turn off reactions",       tip: "Prefer a clean chat? Toggle off Companion reactions in Settings → Experience.", category: "companion" },

  // ── Voice & TTS ──────────────────────────────────────────────────────────────
  { id: "speaker",           emoji: "🔊", title: "Listen to replies",        tip: "Tap the speaker icon on any reply to hear it read aloud by Imotara's voice.", category: "voice" },
  { id: "tts_auto",          emoji: "🔁", title: "Auto-read replies",        tip: "Enable Auto-read in Settings to hear every new reply automatically — no tap needed.", category: "voice" },
  { id: "tts_speed",         emoji: "⚡", title: "Voice speed & pitch",      tip: "Adjust TTS speed and pitch in Settings → Experience so the voice feels just right.", category: "voice" },
  { id: "tts_stop",          emoji: "⏹️", title: "Stop speaking",            tip: "Tap the stop button while a reply is being read to pause it immediately.", category: "voice" },
  { id: "tts_azure",         emoji: "🎙️", title: "Neural voice quality",     tip: "Imotara uses Azure Neural TTS — one of the most natural-sounding voice systems available.", category: "voice" },
  { id: "voice_lang",        emoji: "🌍", title: "22 language voices",       tip: "Imotara speaks back in the same language you write in — Hindi, Bengali, Arabic, and 18 more.", category: "voice" },
  { id: "voice_quality",     emoji: "🎚️", title: "Mic recording quality",    tip: "Set mic quality in Settings if voice input isn't picking up your words clearly.", category: "voice" },
  { id: "hands_free",        emoji: "🤲", title: "Hands-free mode",          tip: "Enable Hands-free in Settings to auto-listen and auto-speak — no screen touching needed.", category: "voice" },
  { id: "hands_free_how",    emoji: "🔁", title: "How hands-free works",     tip: "In Hands-free mode, after each reply Imotara automatically starts listening for your next message.", category: "voice" },
  { id: "online_transcribe", emoji: "☁️", title: "Online transcription",     tip: "Online transcription uses a more accurate model — useful in noisy environments.", category: "voice" },
  { id: "voice_letter",      emoji: "▶️", title: "Listen to letters",        tip: "In Trends, tap the speaker on any companion letter to hear it read aloud in full.", category: "voice" },
  { id: "voice_perm",        emoji: "🔐", title: "Microphone permission",    tip: "Imotara only activates the mic when you tap the mic button — never listening in the background.", category: "voice" },
  { id: "voice_transcript",  emoji: "📝", title: "Voice to text",            tip: "Your spoken words are transcribed and shown before sending — edit them if needed.", category: "voice" },

  // ── Growth & Trends — Overview ────────────────────────────────────────────
  { id: "trends_tab",        emoji: "📊", title: "Trends tab",               tip: "The Trends tab is your growth hub — mood, letters, challenges, journal, and more.", category: "growth" },
  { id: "feel_section",      emoji: "🌈", title: "Quick mood log",           tip: "Tap a feeling in the Trends tab to instantly log your mood — joy, hope, stress, and more.", category: "growth" },
  { id: "streak",            emoji: "🔥", title: "Conversation streak",      tip: "Your streak counts consecutive days you've chatted — keep it going for a sense of momentum.", category: "growth" },
  { id: "mood_chart",        emoji: "📈", title: "Mood chart",               tip: "Your mood chart shows whether you've been trending lighter or heavier across the week.", category: "growth" },
  { id: "mood_chart_detail", emoji: "🔍", title: "Mood chart detail",        tip: "Tap any point on the mood chart to see the conversation from that day.", category: "growth" },

  // ── Growth & Trends — Mindset analysis ────────────────────────────────────
  { id: "mindset_today",     emoji: "🧠", title: "Today's mindset",          tip: "Tap 'Today' in the History mindset capsule for a psychological snapshot of today.", category: "growth" },
  { id: "mindset_7",         emoji: "🗓️", title: "7-day mindset",            tip: "The 7-day capsule spots emotional patterns across the full past week.", category: "growth" },
  { id: "mindset_30",        emoji: "📆", title: "30-day mindset",           tip: "The 30-day view reveals longer recurring themes — what your mind keeps returning to.", category: "growth" },
  { id: "mindset_all",       emoji: "⏳", title: "All-time mindset",         tip: "The all-time capsule is your complete emotional history — scroll down in History to find it.", category: "growth" },
  { id: "mindset_schema",    emoji: "🪞", title: "Schema detection",         tip: "Mindset analysis spots patterns like shame, abandonment fear, or feeling trapped — named gently.", category: "growth" },
  { id: "mindset_needs",     emoji: "💧", title: "Unmet needs detection",    tip: "Mindset analysis identifies which core needs feel unmet — autonomy, connection, or competence.", category: "growth" },
  { id: "mindset_ptg",       emoji: "🌱", title: "Growth recognition",       tip: "Mindset analysis spots post-traumatic growth — when difficulty becomes depth and wisdom.", category: "growth" },

  // ── Growth & Trends — Emotional arc ──────────────────────────────────────
  { id: "emotional_arc",     emoji: "🌊", title: "Emotional arc story",      tip: "Once a month, Imotara writes a flowing personal narrative of your emotional journey.", category: "growth" },
  { id: "arc_quotes",        emoji: "💬", title: "Your words in the arc",    tip: "The emotional arc uses your actual words as anchors — it's written from what you really said.", category: "growth" },
  { id: "arc_growth",        emoji: "🌿", title: "Growth in the arc",        tip: "If you grew this month, the arc names it as a beginning — 'what happened is becoming who you're becoming'.", category: "growth" },

  // ── Growth & Trends — Challenge & journal ────────────────────────────────
  { id: "challenge",         emoji: "🎯", title: "30-day challenge",         tip: "Join the 30-day reflection challenge in Trends — one prompt per day for a month of growth.", category: "growth" },
  { id: "challenge_prompt",  emoji: "💡", title: "Daily challenge prompts",  tip: "Each challenge prompt is different — some ask you to notice, some to write, some to feel.", category: "growth" },
  { id: "challenge_dot",     emoji: "🟣", title: "Challenge progress grid",  tip: "Each completed day fills a dot in the 30-day grid — a satisfying visual record.", category: "growth" },
  { id: "journal",           emoji: "📓", title: "Reflection journal",       tip: "Write private journal entries in Trends — fully local, never synced, only you ever read them.", category: "growth" },
  { id: "journal_prompt",    emoji: "🖊️", title: "Journal prompts",          tip: "The journal offers optional prompts to get started — or write completely freely.", category: "growth" },
  { id: "journal_auto",      emoji: "🗑️", title: "Journal auto-delete",      tip: "Set journal entries to auto-delete after 7, 30, or 90 days in Settings → Experience.", category: "growth" },
  { id: "journal_export",    emoji: "📤", title: "Export your journal",      tip: "Export all journal entries as a file in Settings → Privacy & safety → Export journal.", category: "growth" },

  // ── Growth & Trends — Other ───────────────────────────────────────────────
  { id: "fingerprint",       emoji: "🔮", title: "Emotional fingerprint",    tip: "Your fingerprint shows your unique pattern of expressed emotions — no two people's are the same.", category: "growth" },
  { id: "on_this_day",       emoji: "📅", title: "On this day",              tip: "See what you shared on the same date in past months — a quiet thread of continuity.", category: "growth" },
  { id: "pulse",             emoji: "💫", title: "Collective pulse",         tip: "The pulse shows what emotions others feel today — a reminder you're part of something larger.", category: "growth" },
  { id: "future_letters",    emoji: "🔮", title: "Future letters (web)",     tip: "On web, write a time-locked letter to your future self — it unlocks on the date you choose.", category: "growth" },
  { id: "mood_glimpse",      emoji: "👁️", title: "Mood glimpse card",        tip: "A subtle mood snapshot card in chat shows your current emotional tone at a glance.", category: "growth" },
  { id: "history_search",    emoji: "🔎", title: "Search conversations",     tip: "Use the search bar in History to find any word or phrase across all your conversations.", category: "growth" },
  { id: "insight_letter",    emoji: "📬", title: "Letter insight card",      tip: "When your monthly letter or emotional arc is ready, a card appears at the top of Trends.", category: "growth" },

  // ── Growth — Psychological depth ─────────────────────────────────────────
  { id: "psych_tools",       emoji: "🔬", title: "71 psychological tools",   tip: "Imotara draws on 71 research-backed psychological tools — from CBT to polyvagal theory.", category: "growth" },
  { id: "polyvagal",         emoji: "🌊", title: "Nervous system reading",   tip: "Before replying, Imotara reads your nervous system state — flooded, shut down, or engaged.", category: "growth" },
  { id: "secondary_emo",     emoji: "🎭", title: "Secondary emotions",       tip: "Imotara looks beneath the stated feeling — anger often hides fear or grief underneath.", category: "growth" },
  { id: "pattern_spot",      emoji: "🔁", title: "Pattern recognition",      tip: "If you keep returning to the same pain, Imotara gently names the loop it sees.", category: "growth" },
  { id: "inner_child",       emoji: "🧸", title: "Inner child awareness",    tip: "Imotara notices when an adult response is coming from a much younger wound.", category: "growth" },
  { id: "hope_honest",       emoji: "🕯️", title: "Honest hope",              tip: "Imotara never says 'it'll be fine' — it offers real, earned hope grounded in truth.", category: "growth" },
  { id: "mythology",         emoji: "📖", title: "Mythological stories",     tip: "Imotara weaves in stories from the Gita, Rumi, Stoics, Zen, and Sufi traditions.", category: "growth" },
  { id: "real_stories",      emoji: "🌟", title: "Real resilience stories",  tip: "Mandela, Frankl, Kalam, Honda, Rowling — Imotara uses real stories of people who carried real weight.", category: "growth" },
  { id: "cultural_routing",  emoji: "🗺️", title: "Culturally rooted wisdom", tip: "Hindi speakers get Indian mythology; Arabic speakers get Sufi wisdom; Japanese speakers get Zen.", category: "growth" },
  { id: "humor",             emoji: "😄", title: "Warm humour",              tip: "On heavy days, Imotara sometimes offers a light, warm observation — humour as healing.", category: "growth" },
  { id: "7_tier_priority",   emoji: "🎛️", title: "7-tier response priority", tip: "Every reply follows a priority: regulate first, validate second, then guide — never the other way.", category: "growth" },
  { id: "multilingual_depth",emoji: "🌐", title: "Deep in every language",   tip: "All 71 psychological tools work equally in Hindi, Bengali, Arabic, Japanese, and every other language.", category: "growth" },
  { id: "validation_first",  emoji: "🫶", title: "Validation before advice", tip: "Imotara always acknowledges what you're feeling before offering any guidance — always.", category: "growth" },
  { id: "anti_toxic_pos",    emoji: "🚫", title: "No toxic positivity",      tip: "Imotara never says 'everything happens for a reason' or 'you've got this' — only real words.", category: "growth" },
  { id: "parts_work",        emoji: "🪞", title: "Internal conflict support",tip: "When you're torn, Imotara honours both sides — 'two true things can live inside you at once'.", category: "growth" },
  { id: "narrative_re",      emoji: "📝", title: "Narrative re-authoring",   tip: "Imotara helps you see that the story you tell about yourself isn't the only version.", category: "growth" },

  // ── Companion ─────────────────────────────────────────────────────────────
  { id: "companion_name",    emoji: "💬", title: "Name your companion",      tip: "Give your companion a personal name in Settings → Your companion — make it feel like yours.", category: "companion" },
  { id: "companion_tone",    emoji: "🌸", title: "Relationship style",       tip: "Choose how your companion relates to you — close friend, calm presence, coach, or mentor.", category: "companion" },
  { id: "companion_tone_how",emoji: "🎭", title: "How tone changes replies", tip: "A 'close friend' tone is real and direct; 'mentor' uses wisdom; 'coach' is action-focused.", category: "companion" },
  { id: "companion_gender",  emoji: "🦋", title: "Companion gender",         tip: "Set your companion's gender tone in Settings so its language feels natural to you.", category: "companion" },
  { id: "companion_age",     emoji: "🎓", title: "Companion age tone",       tip: "Set whether your companion speaks like a peer, a younger voice, or a wise elder.", category: "companion" },
  { id: "companion_adapt",   emoji: "🌀", title: "Companion adapts to you",  tip: "Over time, Imotara's style adapts to your vocabulary, depth, and what you respond to most.", category: "companion" },
  { id: "letter",            emoji: "✉️", title: "Monthly letter",           tip: "Once a month, your companion writes you a personal letter reflecting your emotional journey.", category: "companion" },
  { id: "letter_deep",       emoji: "🧬", title: "Truly personal letters",   tip: "Letters are built from your actual words and patterns — no two are ever alike.", category: "companion" },
  { id: "letter_schema",     emoji: "💡", title: "Letters name core wounds", tip: "If a pattern like shame or abandonment fear shows up, the letter speaks to it warmly.", category: "companion" },
  { id: "letter_growth",     emoji: "🌱", title: "Letters celebrate growth", tip: "Breakthroughs in your month are named in the letter as beginnings, not conclusions.", category: "companion" },
  { id: "letter_cadence",    emoji: "📬", title: "Letter frequency",         tip: "Choose how often letters arrive — monthly, weekly, or custom — in Settings → Your companion.", category: "companion" },
  { id: "letter_archive",    emoji: "📚", title: "Letter archive",           tip: "All past letters are saved in Trends — browse months of letters and see how you've grown.", category: "companion" },
  { id: "letter_react",      emoji: "❤️", title: "React to letters",         tip: "Place an emoji reaction on any letter — a heart, a star, a tear — to mark how it landed.", category: "companion" },
  { id: "letter_reply",      emoji: "↩️", title: "Reply to letters",         tip: "Write a reply back to your companion's letter — a private dialogue in the archive.", category: "companion" },
  { id: "letter_listen",     emoji: "🎧", title: "Listen to letters",        tip: "Tap the speaker on any letter to hear it read aloud — great for a quiet moment.", category: "companion" },
  { id: "letter_lang",       emoji: "🌍", title: "Letters in your language", tip: "Your monthly letter is written in whatever language your messages are in — no translation.", category: "companion" },
  { id: "companion_memory",  emoji: "🧩", title: "Companion memory",         tip: "Imotara remembers things you share — your name, preferences, and what matters to you.", category: "companion" },
  { id: "memory_capture",    emoji: "💡", title: "Auto memory capture",      tip: "Imotara quietly notes things you mention so it can be more personal over time.", category: "companion" },
  { id: "memory_limit",      emoji: "📦", title: "Memory capacity",          tip: "Set how many memories Imotara keeps in Settings — from 10 to 100 personal details.", category: "companion" },
  { id: "memory_edit",       emoji: "✏️", title: "Edit your memories",       tip: "In Settings → Advanced, you can view, edit, or delete any memory Imotara holds about you.", category: "companion" },
  { id: "teen_mode",         emoji: "🎓", title: "Teen insights mode",       tip: "Enable Teen Insights in Settings for age-appropriate responses — for users under 18.", category: "companion" },
  { id: "teen_safety",       emoji: "🛡️", title: "Teen safety features",     tip: "In Teen mode, Imotara has lower thresholds for crisis resources and softer language.", category: "companion" },
  { id: "companion_lang",    emoji: "🗣️", title: "Companion language",       tip: "Write in any of 22 languages and Imotara replies in the same one — switch anytime.", category: "companion" },
  { id: "insight_card",      emoji: "🌟", title: "Companion insight card",   tip: "When Imotara has something personal to share — a letter, arc, or milestone — it appears in Trends.", category: "companion" },
  { id: "unsent_voice",      emoji: "🎤", title: "Unsent letter by voice",   tip: "Speak your unsent letter using the mic — Imotara transcribes and responds in their voice.", category: "companion" },
  { id: "depth_levels",      emoji: "📶", title: "Depth grows over time",    tip: "After 10 messages, Imotara shifts tone. After 30 and 50 messages, it deepens further.", category: "companion" },

  // ── Privacy ───────────────────────────────────────────────────────────────
  { id: "local_first",       emoji: "🔒", title: "Local-first architecture", tip: "Every conversation is stored only on your device by default — nothing leaves without your action.", category: "privacy" },
  { id: "no_ads",            emoji: "🚫", title: "No ads, ever",             tip: "Imotara has no ads and never sells your data — your conversations are yours alone.", category: "privacy" },
  { id: "no_tracking",       emoji: "👁️", title: "No usage tracking",        tip: "Imotara collects zero analytics about you — no usage data, no behaviour profiling.", category: "privacy" },
  { id: "no_llm_local",      emoji: "🧠", title: "On-device = no server",    tip: "On-device mode never sends your messages anywhere — everything stays on your phone.", category: "privacy" },
  { id: "emotion_consent",   emoji: "✅", title: "Emotion analysis consent", tip: "You choose whether Imotara tracks your emotions — revoke consent anytime in Settings.", category: "privacy" },
  { id: "what_syncs",        emoji: "🔍", title: "What syncs vs what stays", tip: "Account backup only syncs conversation history — not emotions, notes, or journal entries.", category: "privacy" },
  { id: "export_json",       emoji: "📤", title: "Export as JSON",           tip: "Export all conversations as a JSON file from Settings → Privacy & safety.", category: "privacy" },
  { id: "export_csv",        emoji: "📊", title: "Export as CSV",            tip: "Export your history as a spreadsheet — easy to open in Excel or Google Sheets.", category: "privacy" },
  { id: "export_journal",    emoji: "📓", title: "Export journal",           tip: "Export reflection journal entries separately from Settings → Privacy & safety.", category: "privacy" },
  { id: "clear_local",       emoji: "🗑️", title: "Clear local history",      tip: "Delete all chat history from this device anytime in Settings → Privacy & safety.", category: "privacy" },
  { id: "clear_remote",      emoji: "☁️", title: "Clear account backup",     tip: "Remove your account backup from the server in Settings → Privacy & safety.", category: "privacy" },
  { id: "delete_account",    emoji: "❌", title: "Delete account",           tip: "Permanently delete your account and all data in Settings → Privacy & safety.", category: "privacy" },
  { id: "account_backup",    emoji: "💾", title: "Account backup",           tip: "Sign in to optionally back up your history and access it across multiple devices.", category: "privacy" },
  { id: "backup_manual",     emoji: "🔄", title: "Back up manually",         tip: "Trigger a manual backup anytime in Settings → Privacy & safety → Back up now.", category: "privacy" },
  { id: "backup_auto",       emoji: "⚡", title: "Auto backup",              tip: "When signed in, new conversations are backed up automatically in the background.", category: "privacy" },
  { id: "family_snapshot",   emoji: "👨‍👩‍👧", title: "Family snapshot",     tip: "Share an anonymous emotional snapshot with trusted family — no conversation content.", category: "privacy" },
  { id: "transcription_priv",emoji: "🎤", title: "Voice transcription privacy",tip: "Online transcription only sends audio — your past conversations are never involved.", category: "privacy" },
  { id: "open_source_feel",  emoji: "🏠", title: "Your data, your terms",    tip: "You can export everything, delete everything, and leave at any time — full data sovereignty.", category: "privacy" },

  // ── Settings — Display & experience ──────────────────────────────────────
  { id: "dark_mode",         emoji: "🌙", title: "Dark / light mode",        tip: "Switch between dark and light themes in Settings → Experience to match your preference.", category: "settings" },
  { id: "text_size",         emoji: "🔡", title: "Text size",                tip: "Make text bigger or smaller in Settings → Experience for comfortable reading.", category: "settings" },
  { id: "accent_color",      emoji: "🎨", title: "Accent colours",           tip: "Pick your favourite accent colour in Settings → Experience to personalise the app.", category: "settings" },
  { id: "reply_source",      emoji: "📡", title: "Show reply source",        tip: "Enable 'Show reply source' in Settings to see icons on each message showing its origin.", category: "settings" },
  { id: "mood_glimpse_set",  emoji: "👁️", title: "Mood glimpse toggle",      tip: "Show or hide the mood snapshot card in chat from Settings → Experience.", category: "settings" },
  { id: "feature_tips_set",  emoji: "🔍", title: "Feature tips toggle",      tip: "Turn these hourly tips on or off in Settings → Experience.", category: "settings" },

  // ── Settings — Chat behaviour ─────────────────────────────────────────────
  { id: "reply_mode",        emoji: "🔀", title: "Online vs on-device mode", tip: "Switch between Online (richer) and On-device (private, unlimited) reply modes in Settings.", category: "settings" },
  { id: "auto_cleanup",      emoji: "🧹", title: "Auto-delete old chats",    tip: "Set conversations to auto-delete after 30, 90, or 180 days in Settings → Experience.", category: "settings" },
  { id: "mindset_toggles",   emoji: "🧠", title: "Mindset analysis periods", tip: "Choose which time periods appear in mindset capsules — today, 7-day, 30-day, all-time.", category: "settings" },

  // ── Settings — Grow & wellbeing ────────────────────────────────────────────
  { id: "challenge_show",    emoji: "🎯", title: "Show 30-day challenge",    tip: "Toggle the challenge tracker on or off in Settings → Experience → Grow & wellbeing.", category: "settings" },
  { id: "breathing_default", emoji: "🌬️", title: "Default breathing pattern",tip: "Set your preferred technique in Settings so it opens to your favourite every time.", category: "settings" },
  { id: "fingerprint_set",   emoji: "🔮", title: "Emotional fingerprint",    tip: "Toggle the fingerprint visualisation on or off in Settings → Experience.", category: "settings" },
  { id: "on_this_day_set",   emoji: "📅", title: "On this day toggle",       tip: "Show or hide 'On this day' memory cards in Settings → Experience.", category: "settings" },
  { id: "journal_max",       emoji: "📓", title: "Journal entry limit",      tip: "Set max journal entries in Settings — older ones auto-delete when the limit is reached.", category: "settings" },
  { id: "journal_auto_del",  emoji: "🗓️", title: "Journal auto-delete days", tip: "Choose 7, 30, or 90 days for journal auto-deletion in Settings → Experience.", category: "settings" },

  // ── Settings — Companion & language ───────────────────────────────────────
  { id: "22_languages",      emoji: "🌐", title: "22 supported languages",   tip: "Imotara supports 22 languages — Hindi, Bengali, Tamil, Telugu, Arabic, Chinese, Japanese, and more.", category: "settings" },
  { id: "lang_list",         emoji: "🗺️", title: "Full language list",       tip: "Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu, Arabic, Chinese, Japanese, Spanish, French, German, Portuguese, Russian, Indonesian, Hebrew, English.", category: "settings" },
  { id: "reminder",          emoji: "🔔", title: "Daily reminder",           tip: "Set a gentle daily check-in reminder in Settings to make Imotara part of your routine.", category: "settings" },
  { id: "search_settings",   emoji: "🔍", title: "Settings search",          tip: "Type what you're looking for in the Settings search bar — finds any setting in any language.", category: "settings" },

  // ── Plans & Upgrade ────────────────────────────────────────────────────────
  { id: "free_plan",         emoji: "🆓", title: "Free plan — what's included",tip: "Free plan: 20 enhanced replies/day, 7-day backup, unlimited on-device replies, full privacy controls.", category: "settings" },
  { id: "free_ondevice",     emoji: "♾️", title: "Unlimited on-device — free",tip: "On-device replies are free and unlimited on every plan — the free plan is genuinely useful.", category: "settings" },
  { id: "plus_plan",         emoji: "✨", title: "Plus plan",                tip: "Plus: unlimited enhanced replies, 90-day history backup, advanced TTS controls, all companion tones.", category: "settings" },
  { id: "pro_plan",          emoji: "🌟", title: "Pro plan",                 tip: "Pro: unlimited replies, full history, companion letters, all growth tools, priority access.", category: "settings" },
  { id: "token_credits",     emoji: "🪙", title: "Token credits",            tip: "Buy extra enhanced reply credits anytime — useful for busy days when the daily limit runs out.", category: "settings" },
  { id: "token_sizes",       emoji: "📦", title: "Token pack sizes",         tip: "Token packs come in 100, 250, 600, and 1800 credits — choose the size that fits your use.", category: "settings" },
  { id: "sub_renews",        emoji: "🔄", title: "Subscription auto-renews", tip: "Subscriptions renew automatically — cancel anytime from Settings → Your plan on iOS/Android.", category: "settings" },
  { id: "restore",           emoji: "♻️", title: "Restore purchases",        tip: "Tap 'Restore previous purchases' on the upgrade screen if your plan isn't showing correctly.", category: "settings" },
  { id: "sign_in_benefits",  emoji: "🔑", title: "Why sign in",              tip: "Signing in links your plan, enables account backup, and lets you access Imotara on multiple devices.", category: "settings" },
  { id: "google_signin",     emoji: "🔵", title: "Sign in with Google",      tip: "Tap 'Sign in with Google' from Settings to connect your account — your data stays private.", category: "settings" },
  { id: "apple_signin",      emoji: "🍎", title: "Sign in with Apple",       tip: "iOS users can sign in with Apple — Apple's privacy-first sign-in keeps your email hidden.", category: "settings" },
  { id: "donate",            emoji: "💝", title: "Support Imotara",          tip: "Imotara is independent — a small donation helps keep it ad-free and privately run.", category: "settings" },
  { id: "free_forever",      emoji: "🌱", title: "Free plan never expires",  tip: "The free plan has no trial period and never expires — Imotara is yours to keep without paying.", category: "settings" },

  // ── Web app ─────────────────────────────────────────────────────────────────
  { id: "web_app",           emoji: "💻", title: "Web app at imotara.com",   tip: "Imotara also works in your browser at imotara.com — same features, bigger screen.", category: "settings" },
  { id: "web_desktop",       emoji: "🖥️", title: "Desktop experience",       tip: "On web, Imotara's full layout appears side-by-side — chat, history, trends, and settings.", category: "settings" },
  { id: "web_mobile_parity", emoji: "📱", title: "Mobile & web in sync",     tip: "Sign in on both mobile and web — your history and settings stay consistent everywhere.", category: "settings" },
  { id: "web_tutorial",      emoji: "📖", title: "Full tutorial on web",     tip: "Visit imotara.com/tutorial for a complete step-by-step guide to every feature.", category: "settings" },
  { id: "web_upgrade",       emoji: "🌐", title: "Compare plans on web",     tip: "Visit imotara.com/upgrade to see a full feature comparison across Free, Plus, Pro, and Enterprise.", category: "settings" },

  // ── Account & advanced ──────────────────────────────────────────────────────
  { id: "link_key",          emoji: "🔗", title: "Chat link key",            tip: "Set a custom link key in Settings → Advanced to sync history across devices without full sign-in.", category: "settings" },
  { id: "version",           emoji: "📱", title: "App version",              tip: "Your current version and build number are at the bottom of Settings → Advanced.", category: "settings" },
  { id: "notifications",     emoji: "🔔", title: "Notification types",       tip: "Imotara only sends check-in reminders you set up — no marketing, no alerts.", category: "settings" },
  { id: "child_safe_mode",   emoji: "🧒", title: "Child-safe mode",          tip: "Families can enable Child-safe Mode in Settings to filter adult themes and mature content — requires Family or EDU plan.", category: "settings" },
  { id: "family_profiles",   emoji: "👨‍👩‍👧‍👦", title: "Family profiles",        tip: "Family plan users can create up to 6 separate profiles — each with its own companion, history, and settings.", category: "settings" },
  { id: "connect_what",      emoji: "🤝", title: "Imotara Connect",          tip: "Book a live session with a verified counsellor or wellness coach via Imotara Connect — available in the Connect tab.", category: "settings" },
  { id: "connect_wallet",    emoji: "💳", title: "Connect Wallet",           tip: "Top up your Connect Wallet (₹1,000–₹10,000) before booking a session — sessions are billed per minute from your balance.", category: "settings" },
  { id: "connect_rate",      emoji: "⏱️", title: "Per-minute billing",       tip: "Each companion sets their own rate (e.g. ₹8/min). The clock starts when they accept your call — end anytime.", category: "settings" },
  { id: "connect_dormancy",  emoji: "🏦", title: "Wallet never expires",     tip: "Your Connect Wallet balance stays active for 2 years and is never zeroed — even dormant balances are preserved with a 1-year grace refund period.", category: "settings" },
  { id: "connect_safety",    emoji: "🛡️", title: "End sessions anytime",     tip: "You can end a Connect session at any moment — you're billed only for the minutes used. A low-balance warning appears before funds run out.", category: "settings" },
  { id: "connect_browse",    emoji: "🔍", title: "Browse companions",        tip: "Filter companions in the Browse tab by language, specialty (grief, anxiety, career), and availability — find the right fit before you book.", category: "settings" },
  { id: "connect_schedule",  emoji: "📅", title: "Schedule sessions",        tip: "Can't talk now? Tap 'Schedule' on any companion profile to book a future slot — both you and the companion get a reminder before it starts.", category: "settings" },
  { id: "connect_apply",     emoji: "🧑‍💼", title: "Become a companion",      tip: "Professionals can apply to join Imotara Connect as a verified companion — set your own rate and hours.", category: "settings" },
  { id: "org_plan",          emoji: "🏢", title: "Team & Org plans",         tip: "Deploy Imotara across your organisation — ₹1,999/seat/yr for companies, ₹999 for educational institutions, ₹799 for NGOs. Self-serve at imotara.com/pricing/corporate.", category: "settings" },

];

// ── Active-time rotation helpers ──────────────────────────────────────────────
//
// Tips rotate after 30 minutes of ACTIVE app usage — not wall-clock time.
// "Active" = the app is open and in the foreground.
// Closing the app pauses the clock; reopening it resumes.
//
// Implementation:
//   ACCUMULATED_MS  = total ms of active use since last tip was shown
//   SESSION_START   = timestamp when the current active session began
//
// On session start (app foreground): store SESSION_START = now
// On session end (app background): add (now - SESSION_START) to ACCUMULATED_MS,
//   check if >= 30 min → if so, advance tip and carry over remainder
// On getCurrentTip: add live in-progress session time to get real total

const LAST_INDEX_KEY    = "imotara.feature_tip.last_index.v2";
const ACCUMULATED_MS_KEY= "imotara.feature_tip.accumulated_ms.v2";
const SESSION_START_KEY = "imotara.feature_tip.session_start.v2";

export const ACTIVE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes of active use

import AsyncStorage from "@react-native-async-storage/async-storage";

/** Call when app comes to foreground (session begins). */
export async function recordSessionStart(): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_START_KEY, String(Date.now()));
  } catch {}
}

/**
 * Call when app goes to background (session ends).
 * Adds elapsed time to accumulator. Returns whether the tip advanced.
 */
export async function flushActiveTime(): Promise<{ advanced: boolean; newIndex: number }> {
  try {
    const sessionStartRaw = await AsyncStorage.getItem(SESSION_START_KEY);
    if (!sessionStartRaw) return { advanced: false, newIndex: -1 };

    const elapsed = Math.max(0, Date.now() - Number(sessionStartRaw));
    await AsyncStorage.removeItem(SESSION_START_KEY);

    const accRaw = await AsyncStorage.getItem(ACCUMULATED_MS_KEY);
    const accumulated = (accRaw ? Number(accRaw) : 0) + elapsed;

    const idxRaw = await AsyncStorage.getItem(LAST_INDEX_KEY);
    let idx = idxRaw ? parseInt(idxRaw, 10) : 0;
    if (!isFinite(idx) || idx < 0) idx = 0;

    if (accumulated >= ACTIVE_INTERVAL_MS) {
      const next = (idx + 1) % FEATURE_TIPS.length;
      const remainder = accumulated - ACTIVE_INTERVAL_MS;
      await Promise.all([
        AsyncStorage.setItem(LAST_INDEX_KEY, String(next)),
        AsyncStorage.setItem(ACCUMULATED_MS_KEY, String(remainder)),
      ]);
      return { advanced: true, newIndex: next };
    }

    await AsyncStorage.setItem(ACCUMULATED_MS_KEY, String(accumulated));
    return { advanced: false, newIndex: -1 };
  } catch {
    return { advanced: false, newIndex: -1 };
  }
}

/**
 * Returns the current tip. If a session is active, live session time is
 * included so the tip can advance mid-session without waiting for background.
 */
export async function getCurrentTip(): Promise<{ tip: FeatureTip; index: number }> {
  try {
    const [idxRaw, accRaw, sessionStartRaw] = await Promise.all([
      AsyncStorage.getItem(LAST_INDEX_KEY),
      AsyncStorage.getItem(ACCUMULATED_MS_KEY),
      AsyncStorage.getItem(SESSION_START_KEY),
    ]);

    let idx = idxRaw ? parseInt(idxRaw, 10) : 0;
    if (!isFinite(idx) || idx < 0) idx = 0;

    const base       = accRaw ? Number(accRaw) : 0;
    const liveMs     = sessionStartRaw ? Math.max(0, Date.now() - Number(sessionStartRaw)) : 0;
    const total      = base + liveMs;

    if (total >= ACTIVE_INTERVAL_MS) {
      const next      = (idx + 1) % FEATURE_TIPS.length;
      const remainder = total - ACTIVE_INTERVAL_MS;
      await Promise.all([
        AsyncStorage.setItem(LAST_INDEX_KEY, String(next)),
        AsyncStorage.setItem(ACCUMULATED_MS_KEY, String(remainder)),
        // reset session start so remainder is counted from now
        sessionStartRaw ? AsyncStorage.setItem(SESSION_START_KEY, String(Date.now())) : Promise.resolve(),
      ]);
      idx = next;
    }

    return { tip: FEATURE_TIPS[idx % FEATURE_TIPS.length], index: idx % FEATURE_TIPS.length };
  } catch {
    return { tip: FEATURE_TIPS[0], index: 0 };
  }
}

export async function advanceTip(currentIndex: number): Promise<{ tip: FeatureTip; index: number }> {
  const next = (currentIndex + 1) % FEATURE_TIPS.length;
  try {
    await Promise.all([
      AsyncStorage.setItem(LAST_INDEX_KEY, String(next)),
      AsyncStorage.setItem(ACCUMULATED_MS_KEY, "0"),
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
