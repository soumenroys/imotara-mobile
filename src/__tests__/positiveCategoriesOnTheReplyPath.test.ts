/**
 * P3-5 part two — the positive side of the on-device emotion path.
 *
 * 🔴 WHY THIS EXISTS. Part one closed four SADNESS gaps. The positive side of
 * the same classifier turned out to be in worse shape, and for the same reason:
 * it feeds the SYSTEM PROMPT through emotionMemory, so a wrong answer here does
 * not mis-colour a label on screen — it makes the companion reply to a feeling
 * the user never expressed.
 *
 * Four separate defects, all in one branch of ChatScreen:
 *
 *   1. ENGLISH-ONLY. The whole positive branch was
 *        GRATITUDE_REGEX.test(raw) || /\b(hope|happy|joy|…)\b/.test(lower)
 *      GRATITUDE_REGEX covers thanks-words in every script, but "happy" and
 *      "calm" existed in English alone. খুশি · खुश · சந்தோஷ · సంతోష · ಸಂತೋಷ ·
 *      സന്തോഷ · ખુશ · ਖੁਸ਼ · ଖୁସି · आनंद matched NOTHING. A user writing
 *      "আমি আজ খুব খুশি" was read as having expressed no feeling at all.
 *
 *   2. 🔴 NO NEGATION GUARD ANYWHERE. "I'm not happy" contains "happy", is not
 *      caught by EN_SAD_RE, and so came out as primary "hopeful" — the exact
 *      opposite of what was said. Web has guarded this since analyticsEmotion
 *      (`isNegated`); mobile had nothing.
 *
 *   3. JOY COLLAPSED INTO "hopeful", although "joy" is already a supported
 *      local primary — the emoji-only path returns it, and both
 *      getDefaultIntensityForPrimary and mapUserEmotionForTTS handle it. So
 *      "I'm so happy" was spoken back in the gratitude TTS style.
 *
 *   4. THE CLASSIFIER WAS UNTESTABLE, living inline in a 4,000-line screen with
 *      nothing exported. That is why part one could be tested and this could
 *      not. The vocabulary now sits in keywordMaps beside the sad maps.
 *
 * ⚠️ WIDENING THESE MAPS IS A REPLY CHANGE. Every pattern here is a word that
 * means the feeling and little else, and the negative cases at the bottom are
 * load-bearing: they are what keeps precision from being traded away later.
 */

import {
  detectPositiveText,
  POSITIVE_JOY_REGEX,
  POSITIVE_HOPE_REGEX,
  POSITIVE_CALM_REGEX,
} from "../lib/emotion/keywordMaps";

describe("🔴 gap 1 — plain happiness that used to go unheard, by language", () => {
  const joy: Array<[string, string, string]> = [
    ["bn", "আমি আজ খুব খুশি", "khushi"],
    ["bn", "আজ মনটা খুব ভালো", "the very sentence part one pinned as NOT sad"],
    ["hi", "मैं बहुत खुश हूँ", "khush"],
    ["mr", "मला खूप आनंद झाला", "anand"],
    ["ta", "நான் மகிழ்ச்சியாக இருக்கிறேன்", "magizhchi"],
    ["te", "నాకు సంతోషంగా ఉంది", "santosha"],
    ["kn", "ನನಗೆ ಸಂತೋಷವಾಗಿದೆ", "santosha"],
    ["ml", "എനിക്ക് സന്തോഷമാണ്", "santosham"],
    ["gu", "હું ખુશ છું", "khush"],
    ["pa", "ਮੈਂ ਖੁਸ਼ ਹਾਂ", "khush"],
    ["or", "ମୁଁ ବହୁତ ଖୁସି", "khusi"],
  ];

  it.each(joy)("%s: %s — %s", (_lang, text) => {
    expect(detectPositiveText(text)).toBe("joy");
  });
});

describe("🔴 gap 1 — hope and calm, which existed in English only", () => {
  const hopeful: Array<[string, string]> = [
    ["hi", "मुझे उम्मीद है"],
    ["bn", "আমার আশা আছে"],
    ["ta", "எனக்கு நம்பிக்கை இருக்கிறது"],
    ["ml", "എനിക്ക് പ്രതീക്ഷയുണ്ട്"],
    ["gu", "મને આશા છે"],
  ];
  it.each(hopeful)("%s: %s is heard as hope", (_lang, text) => {
    expect(detectPositiveText(text)).toBe("hopeful");
  });

  const calm: Array<[string, string]> = [
    ["bn", "আমি এখন শান্ত"],
    ["hi", "मैं अब शांत महसूस कर रहा हूँ"],
    ["te", "నేను ప్రశాంతంగా ఉన్నాను"],
    ["en", "I feel calm and at peace now"],
  ];
  it.each(calm)("%s: %s is heard (as hopeful — see note)", (_lang, text) => {
    // 🔑 Calm is NOT given its own primary. The canonical vocabulary
    // (src/types/history.ts on web) is joy · sadness · anger · fear · disgust ·
    // surprise · gratitude · neutral — there is no "calm" for it to map to, and
    // inventing one would be silently dropped at the TTS boundary, which is the
    // precise class of bug mapUserEmotionForTTS was written to prevent. Calm
    // therefore joins "relieved", which this branch already treated as hopeful.
    expect(detectPositiveText(text)).toBe("hopeful");
  });
});

describe("🔴 gap 2 — THE NEGATION HOLE. A positive word is not a positive feeling.", () => {
  /**
   * Each of these used to return "hopeful". The companion was then told the
   * person sounded hopeful in the same breath as they said they did not.
   */
  const negated = [
    ["en", "I'm not happy"],
    ["en", "I am not happy at all with this"],
    ["en", "I don't feel grateful"],
    ["en", "there is no hope left"],
    ["en", "I never feel calm"],
    ["bn", "মন ভালো নেই"],
    ["bn", "আমি খুশি নই"],
    ["hi", "कोई उम्मीद नहीं"],
    ["hi", "मैं खुश नहीं हूँ"],
    ["ta", "எனக்கு சந்தோஷம் இல்லை"],
    ["de", "ich bin nicht glücklich"],
    ["jp", "幸せじゃない"],
  ];

  it.each(negated)("%s: %s is NOT a positive state", (_lang, text) => {
    expect(detectPositiveText(text)).toBeUndefined();
  });
});

describe("🔴 the अशांत trap — a negative word that CONTAINS the positive one", () => {
  /**
   * Indic scripts have no word boundary for \b to use. शांत (calm) sits inside
   * अशांत (restless, agitated), and শান্ত inside অশান্ত. A naive calm pattern
   * reads "I am very restless" as calm — a false positive on the reply surface,
   * which is strictly worse than the miss this change set out to fix.
   */
  const trap = [
    ["hi", "मैं बहुत अशांत हूँ"],
    ["bn", "আমি খুব অশান্ত"],
    ["mr", "मन अशांत आहे"],
  ];
  it.each(trap)("%s: %s is not calm", (_lang, text) => {
    expect(detectPositiveText(text)).toBeUndefined();
  });
});

describe("🔴 gap 3 — joy is its own primary again, not folded into hope", () => {
  it("clear joy is joy", () => {
    expect(detectPositiveText("I'm so happy today")).toBe("joy");
    expect(detectPositiveText("that is wonderful, I feel delighted")).toBe("joy");
  });

  it("hope stays hope", () => {
    expect(detectPositiveText("I'm hopeful about next week")).toBe("hopeful");
  });

  it("🔑 joy is checked BEFORE hope, so a message carrying both reads as joy", () => {
    // Not a style point: "joy" maps to the canonical joy emotion for TTS, while
    // "hopeful" maps to gratitude. Getting the order wrong changes how the
    // reply is SPOKEN, not just what it is labelled.
    expect(detectPositiveText("I am so happy and hopeful")).toBe("joy");
  });
});

describe("⚠️ and it still says no to ordinary sentences", () => {
  /**
   * The cost of widening a positive map is a companion that answers a flat or
   * unhappy message as though it were cheerful. These carry no feeling.
   */
  const neutral = [
    ["bn", "আজ আমি অফিসে যাচ্ছি"],
    ["hi", "मैं कल ऑफिस जाऊंगा"],
    ["en", "can you remind me at six"],
    ["en", "I need to buy a better laptop"],
    ["en", ""],
  ];

  it.each(neutral)("%s: %s is not a positive state", (_lang, text) => {
    expect(detectPositiveText(text)).toBeUndefined();
  });

  it("🔑 bare 'better' is deliberately NOT a positive word", () => {
    // It used to be, and it fired on "I need a better job" — a complaint. Only
    // the phrases that state a CHANGE in how the person feels count. This
    // narrows detection on purpose: a miss is recoverable, a wrong reply is not.
    expect(detectPositiveText("I want a better phone")).toBeUndefined();
    expect(detectPositiveText("I am feeling better today")).toBe("joy");
  });
});

describe("🔴 gap 5 — THE OTHER SEVEN LANGUAGES. Imotara supports 22, not 15.", () => {
  /**
   * The first pass covered English, the ten Indian languages, Arabic, Hebrew,
   * German and Japanese. Imotara supports TWENTY-TWO: Urdu, Chinese, French,
   * Indonesian, Portuguese, Russian and Spanish were missing — and Urdu is one
   * of the Indian-subcontinent languages the picker offers, so this was not
   * only an "international" gap.
   */
  const joy: Array<[string, string]> = [
    ["ur", "میں بہت خوش ہوں"],
    ["zh", "我今天很开心"],
    ["fr", "je suis heureux aujourd'hui"],
    ["id", "saya merasa bahagia"],
    ["pt", "estou muito feliz"],
    ["ru", "я счастлив сегодня"],
    ["es", "estoy muy feliz"],
  ];
  it.each(joy)("%s: %s is joy", (_l, t) => expect(detectPositiveText(t)).toBe("joy"));

  const hopeful: Array<[string, string]> = [
    ["ur", "مجھے امید ہے"],
    ["zh", "我有希望"],
    ["fr", "j'ai de l'espoir"],
    ["id", "saya punya harapan"],
    ["pt", "tenho esperança"],
    ["ru", "у меня есть надежда"],
    ["es", "tengo esperanza"],
  ];
  it.each(hopeful)("%s: %s is hope", (_l, t) => expect(detectPositiveText(t)).toBe("hopeful"));

  const calm: Array<[string, string]> = [
    ["ur", "مجھے سکون ہے"],
    ["zh", "我很平静"],
    ["fr", "je me sens calme"],
    ["id", "saya merasa tenang"],
    ["pt", "estou tranquilo"],
    ["ru", "мне спокойно"],
    ["es", "estoy tranquilo"],
  ];
  it.each(calm)("%s: %s is calm (as hopeful)", (_l, t) => expect(detectPositiveText(t)).toBe("hopeful"));

  it("🔑 'мне спокойно' is NOT read as negated", () => {
    // The Russian negator is "не", and it sits inside "мне". A negator pattern
    // without boundaries turns "I feel calm" into "I do not feel calm" — the
    // same class of bug as अशांत, arriving from the opposite direction.
    expect(detectPositiveText("мне спокойно")).toBe("hopeful");
  });

  const negated = [
    ["ur", "میں خوش نہیں ہوں"],
    ["zh", "我不开心"],
    ["fr", "je ne suis pas heureux"],
    ["id", "saya tidak bahagia"],
    ["pt", "não estou feliz"],
    ["ru", "я не счастлив"],
    ["es", "no estoy feliz"],
  ];
  it.each(negated)("%s: %s is NOT positive", (_l, t) => expect(detectPositiveText(t)).toBeUndefined());

  it("⚠️ English 'content' is not French 'contente'", () => {
    // \bcontent\b would make "please check the content" a joyful message.
    expect(detectPositiveText("please check the content of the file")).toBeUndefined();
  });
});

describe("the regexes themselves carry the vocabulary", () => {
  it("joy spans the Indic scripts, not just English", () => {
    for (const w of ["খুশি", "खुश", "આનંદ", "ਖੁਸ਼", "ଖୁସି", "സന്തോഷ", "ಸಂತೋಷ", "సంతోష", "மகிழ்ச்சி"]) {
      expect(POSITIVE_JOY_REGEX.test(w)).toBe(true);
    }
  });
  it("hope spans the Indic scripts", () => {
    for (const w of ["আশা", "उम्मीद", "આશા", "ਉਮੀਦ", "ଆଶା", "പ്രതീക്ഷ", "ಭರವಸೆ", "ఆశ", "நம்பிக்கை"]) {
      expect(POSITIVE_HOPE_REGEX.test(w)).toBe(true);
    }
  });
  it("calm spans the Indic scripts", () => {
    for (const w of ["শান্ত", "शांत", "શાંત", "ਸ਼ਾਂਤ", "ଶାନ୍ତ", "ശാന്ത", "ಶಾಂತ", "ప్రశాంత", "அமைதி"]) {
      expect(POSITIVE_CALM_REGEX.test(w)).toBe(true);
    }
  });
});
