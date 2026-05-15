export type CulturalWord = {
  word: string;
  romanized?: string;
  sourceLanguage: string;
  sourceLangCode: string;
  emotion: "sad" | "anxious" | "tired";
  meaning: string;
  intro: string;
};

const CULTURAL_WORDS: CulturalWord[] = [
  // ─── SAD ─────────────────────────────────────────────────────────────────────
  {
    word: "saudade",
    sourceLanguage: "Portuguese",
    sourceLangCode: "pt",
    emotion: "sad",
    meaning: "a melancholic longing for someone or something absent — not just missing, but a deep, bittersweet ache that has no easy fix",
    intro: "There's a Portuguese word — saudade — for this: a melancholic longing, bittersweet and deep, for what is absent.",
  },
  {
    word: "mono no aware",
    romanized: "物の哀れ",
    sourceLanguage: "Japanese",
    sourceLangCode: "ja",
    emotion: "sad",
    meaning: "the bittersweet awareness of impermanence — an ache at the beauty of passing things; the sadness that makes them precious",
    intro: "The Japanese call this mono no aware (物の哀れ) — the bittersweet ache of knowing beautiful things pass. It makes the feeling no lighter, but you're not alone in having it.",
  },
  {
    word: "toska",
    romanized: "тоска",
    sourceLanguage: "Russian",
    sourceLangCode: "ru",
    emotion: "sad",
    meaning: "a vague, deep spiritual anguish — longing without a clear object; a soul-restlessness that has no easy name in other languages",
    intro: "Russian has a word — toska (тоска) — for exactly this: a vague, deep anguish, a longing without a clear object. Real, even when hard to name.",
  },
  {
    word: "Weltschmerz",
    sourceLanguage: "German",
    sourceLangCode: "de",
    emotion: "sad",
    meaning: "world-pain — the deep sadness at the suffering of the world, at the gap between how things are and how they should be",
    intro: "German has a word for this — Weltschmerz — world-pain. The ache of feeling the weight of how things are, and how they could be.",
  },
  {
    word: "hiraeth",
    sourceLanguage: "Welsh",
    sourceLangCode: "cy",
    emotion: "sad",
    meaning: "an untranslatable longing for home, belonging, or a past that may never have truly existed — deeper than nostalgia, harder to shake",
    intro: "Welsh has a word, hiraeth, for this kind of longing — for a home or belonging that may never have quite existed. Sadder than nostalgia, and harder to shake.",
  },
  {
    word: "ya'aburnee",
    romanized: "يقبرني",
    sourceLanguage: "Arabic",
    sourceLangCode: "ar",
    emotion: "sad",
    meaning: "literally 'may you bury me' — loving someone so deeply that the thought of living without them feels unthinkable",
    intro: "Arabic has an expression — ya'aburnee (يقبرني) — 'may you bury me.' What you say when you love someone so much the thought of losing them is unbearable.",
  },
  {
    word: "virah",
    romanized: "विरह",
    sourceLanguage: "Sanskrit",
    sourceLangCode: "sa",
    emotion: "sad",
    meaning: "the ache of separation from someone dearly loved — not anger, not numbness, but a pure, quiet longing in absence",
    intro: "Sanskrit has a word for this — virah (विरह) — the ache of separation. Not anger, not numbness. Just a pure, clean longing.",
  },
  {
    word: "la douleur exquise",
    sourceLanguage: "French",
    sourceLangCode: "fr",
    emotion: "sad",
    meaning: "the exquisite pain of wanting someone you cannot have — the sharpness of love that has no place to land",
    intro: "French calls this la douleur exquise — the exquisite pain of wanting someone you cannot have. The sharpness of it is real.",
  },
  {
    word: "añoranza",
    sourceLanguage: "Spanish",
    sourceLangCode: "es",
    emotion: "sad",
    meaning: "a deep, aching yearning for what is lost or far away — not just missing something, but a longing that settles in the bones",
    intro: "There's a Spanish word — añoranza — for this kind of longing. Not just missing something, but a yearning that settles deep.",
  },
  {
    word: "rindu",
    sourceLanguage: "Indonesian",
    sourceLangCode: "id",
    emotion: "sad",
    meaning: "an intense, aching longing for a person or place that is far away — felt in the chest, hard to put into words",
    intro: "Indonesian has a word for this — rindu — an aching longing, felt in the chest, for someone or somewhere far away.",
  },
  {
    word: "dor",
    sourceLanguage: "Romanian",
    sourceLangCode: "ro",
    emotion: "sad",
    meaning: "a bittersweet longing that is both ache and tenderness — missing something while still feeling its beauty",
    intro: "Romanian has a word — dor — for a longing that is both ache and tenderness at once. Missing something while still feeling its beauty.",
  },

  // ─── ANXIOUS ─────────────────────────────────────────────────────────────────
  {
    word: "Fernweh",
    sourceLanguage: "German",
    sourceLangCode: "de",
    emotion: "anxious",
    meaning: "an aching longing for distant places — the restless pull of the open horizon, the sense of belonging somewhere else",
    intro: "German has a word — Fernweh — for this restless pull toward distant places. The sense that somewhere else, something is calling.",
  },
  {
    word: "Torschlusspanik",
    sourceLanguage: "German",
    sourceLangCode: "de",
    emotion: "anxious",
    meaning: "literally 'gate-closing panic' — the dread that time and opportunities are slipping away before you can reach them",
    intro: "German calls this Torschlusspanik — gate-closing panic. The dread that opportunities are closing before you reach them. More common than people admit.",
  },
  {
    word: "dépaysement",
    sourceLanguage: "French",
    sourceLangCode: "fr",
    emotion: "anxious",
    meaning: "the unsettling disorientation of being in an unfamiliar place or situation — not homesickness exactly, but a sense of being out of place",
    intro: "French has a word — dépaysement — for the quiet unease of being out of place, of not quite fitting where you are. It doesn't mean you're wrong. Just displaced.",
  },
  {
    word: "l'esprit de l'escalier",
    sourceLanguage: "French",
    sourceLangCode: "fr",
    emotion: "anxious",
    meaning: "staircase wit — thinking of the perfect response only after the moment has passed; the lingering ache of a missed word",
    intro: "French calls this l'esprit de l'escalier — staircase wit. The perfect thing you think of only after the moment is gone. That particular regret has a name.",
  },

  // ─── TIRED ───────────────────────────────────────────────────────────────────
  {
    word: "ikigai",
    romanized: "生き甲斐",
    sourceLanguage: "Japanese",
    sourceLangCode: "ja",
    emotion: "tired",
    meaning: "one's reason for being — the sense of purpose that makes mornings worth rising for; its absence is its own kind of deep exhaustion",
    intro: "Japanese has a concept — ikigai (生き甲斐) — your reason for being. The thing that makes mornings worth it. When it feels absent, the tiredness runs deeper than sleep.",
  },
  {
    word: "madrugada",
    sourceLanguage: "Spanish",
    sourceLangCode: "es",
    emotion: "tired",
    meaning: "the heavy, quiet hours before dawn — when exhaustion and longing blur together and the world feels both very still and very hard",
    intro: "Spanish has a word — madrugada — for those heavy, quiet hours before dawn. When tiredness and longing blur. It's its own kind of alone.",
  },
  {
    word: "uitwaaien",
    sourceLanguage: "Dutch",
    sourceLangCode: "nl",
    emotion: "tired",
    meaning: "going out into the wind to clear one's head — a reminder that exhaustion sometimes needs open air, not answers",
    intro: "Dutch has a word — uitwaaien — for going out into the wind to clear your head. Sometimes tiredness needs air, not answers.",
  },
];

/**
 * Returns a culturally resonant untranslatable emotion word that fits the signal,
 * excluding words from the user's own language (they already know those).
 * Returns null when signal doesn't match (angry/okay) or no candidates exist.
 */
export function getCulturalEmotionWord(
  signal: string,
  userLangCode: string,
  seed: number,
): CulturalWord | null {
  if (signal !== "sad" && signal !== "anxious" && signal !== "tired") return null;
  const typedSignal = signal as "sad" | "anxious" | "tired";

  // Exclude words from the user's own language family
  // (showing saudade to a Portuguese speaker is not illuminating)
  const langFamilyExclusions: Record<string, string[]> = {
    pt: ["pt"],
    ja: ["ja"],
    ru: ["ru"],
    de: ["de"],
    fr: ["fr"],
    es: ["es"],
    id: ["id"],
    // Indic languages — virah is Sanskrit, exclude for all Indic speakers
    hi: ["sa", "hi"], mr: ["sa", "mr"], bn: ["sa", "bn"],
    ta: ["sa", "ta"], te: ["sa", "te"], gu: ["sa", "gu"],
    pa: ["sa", "pa"], kn: ["sa", "kn"], ml: ["sa", "ml"],
    or: ["sa", "or"], ur: ["sa", "ur"],
    ar: ["ar"],
  };
  const excluded = new Set(langFamilyExclusions[userLangCode] ?? []);

  const candidates = CULTURAL_WORDS.filter(
    (w) => w.emotion === typedSignal && !excluded.has(w.sourceLangCode),
  );
  if (!candidates.length) return null;

  return candidates[Math.abs(seed) % candidates.length] ?? null;
}
