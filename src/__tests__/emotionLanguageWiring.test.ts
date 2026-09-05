// The recurring bug in this file's history is not a bad regex — it is a good
// regex nobody wired up. HI_SAD_REGEX sat exported and unused while Hindi
// speakers got nothing (UX-04). TA_SAD_REGEX had no Tamil script in it at all
// (UX-40). Telugu had no emotion regex whatsoever (UX-41). Odia stress was in
// four of the five hand-written stress lists.
//
// So this test does not check a list of languages I typed out — that is the
// thing that keeps drifting. It reads the module's OWN exports and asserts
// that every emotion pattern defined there is actually reachable from the
// shared entry point. Define a new language and forget to wire it, and this
// fails and names it.

import * as KM from "../lib/emotion/keywordMaps";

/** A literal term taken from the pattern itself, so the test cannot drift. */
function sampleFor(re: RegExp): string {
  // Patterns start in a few shapes: /(a|b)/, /\b(a|b)\b/i, /(?:a|b)/.
  // Peel those off before taking the first alternative, or the "sample" comes
  // back as literal regex syntax and the language looks broken when it is not.
  return re.source
    .replace(/^\/+/, "")
    .replace(/^\\b/, "")
    .replace(/^\(\?:?/, "")
    .replace(/^\(/, "")
    .replace(/^\\b/, "")
    .split("|")[0]
    .replace(/\\b$/, "")
    .replace(/[()\\^$?*+\[\]{}]/g, "")
    .trim();
}

// UX-38 is now done: all four are wired. Arabic and Hebrew went in unchanged
// because they measured clean; Japanese and German were tightened first (bare
// うつ matched inside うつくしい, 一人 inside 一人暮らし, and "allein" matched
// "Ich gehe allein einkaufen"). Nothing is deliberately unwired any more, and
// this empty set is what makes the sweep below cover every language.
const DELIBERATELY_UNWIRED_SAD = new Set<string>([]);

function langsWith(suffix: string): string[] {
  return Object.keys(KM)
    .filter((k) => k.endsWith(suffix))
    .map((k) => k.slice(0, k.length - suffix.length));
}

describe("every SAD pattern defined is reachable from isSadText", () => {
  const langs = langsWith("_SAD_REGEX").filter((l) => !DELIBERATELY_UNWIRED_SAD.has(l));
  it("finds the languages at all (guards against a silent empty sweep)", () => {
    expect(langs.length).toBeGreaterThanOrEqual(10);
    expect(langs).toContain("TE"); // UX-41
  });
  for (const L of langs) {
    it(`${L}`, () => {
      const re = (KM as unknown as Record<string, RegExp>)[`${L}_SAD_REGEX`];
      const sample = sampleFor(re);
      expect(re.test(sample)).toBe(true);   // the sample really is one of its own terms
      expect(KM.isSadText(sample)).toBe(true);
    });
  }
});

describe("every STRESS pattern defined is reachable from isStressText", () => {
  // Only the Indic set is folded into isStressText; the others are not wired
  // to any stress caller, same UX-38 reasoning.
  const WIRED = ["HI", "BN", "TA", "TE", "GU", "KN", "ML", "PA", "OR", "MR"];
  it("finds them", () => expect(langsWith("_STRESS_REGEX").length).toBeGreaterThanOrEqual(10));
  for (const L of WIRED) {
    it(`${L}`, () => {
      const re = (KM as unknown as Record<string, RegExp>)[`${L}_STRESS_REGEX`];
      expect(re).toBeDefined();
      const sample = sampleFor(re);
      expect(re.test(sample)).toBe(true);
      expect(KM.isStressText(sample)).toBe(true);
    });
  }
});

// UX-40: Tamil had five emotion patterns and only three carried Tamil script.
// Sadness and stress were romanised-only, so a Tamil speaker writing Tamil got
// nothing while one writing Tanglish was understood.
describe("UX-40 — Tamil in Tamil script", () => {
  for (const s of ["நான் மிகவும் சோகமாக இருக்கிறேன்", "ரொம்ப வருத்தமா இருக்கு", "மனசு வலிக்குது", "தனிமையா உணர்கிறேன்"]) {
    it(`sad: ${s}`, () => expect(KM.isSadText(s)).toBe(true));
  }
  for (const s of ["ரொம்ப கவலையா இருக்கு", "மன அழுத்தம் அதிகமா இருக்கு", "பதட்டமா இருக்கு"]) {
    it(`stress: ${s}`, () => expect(KM.isStressText(s)).toBe(true));
  }
  for (const s of ["இன்று வானிலை நன்றாக உள்ளது", "நான் மகிழ்ச்சியாக இருக்கிறேன்", "நன்றி"]) {
    it(`neutral stays neutral: ${s}`, () => {
      expect(KM.isSadText(s)).toBe(false);
      expect(KM.isStressText(s)).toBe(false);
    });
  }
});

// UX-41: Telugu is one of the 22 supported languages and had no emotion
// pattern of any kind.
describe("UX-41 — Telugu", () => {
  for (const s of ["నేను చాలా బాధగా ఉన్నాను", "మనసు బాగోలేదు", "ఏడుపు వస్తోంది", "చాలా ఒంటరిగా ఉంది"]) {
    it(`sad: ${s}`, () => expect(KM.isSadText(s)).toBe(true));
  }
  for (const s of ["చాలా ఒత్తిడిగా ఉంది", "ఆందోళనగా ఉంది", "టెన్షన్ గా ఉంది"]) {
    it(`stress: ${s}`, () => expect(KM.isStressText(s)).toBe(true));
  }
  for (const s of ["ఏం చేయాలో తెలియట్లేదు", "అర్థం కావట్లేదు"]) {
    it(`confused: ${s}`, () => expect(KM.isConfusedText(s)).toBe(true));
  }
  it("anger", () => expect(KM.TE_ANGER_REGEX.test("చాలా కోపంగా ఉంది")).toBe(true));
  it("fear", () => expect(KM.TE_FEAR_REGEX.test("చాలా భయంగా ఉంది")).toBe(true));
  for (const s of ["ఈ రోజు వాతావరణం బాగుంది", "నేను చాలా సంతోషంగా ఉన్నాను", "ధన్యవాదాలు"]) {
    it(`neutral stays neutral: ${s}`, () => {
      expect(KM.isSadText(s)).toBe(false);
      expect(KM.isStressText(s)).toBe(false);
      expect(KM.isConfusedText(s)).toBe(false);
    });
  }
});

// Adding languages must not make other languages' ordinary sentences emotional.
// UX-38. These four were held back because their patterns were too loose to
// act on. Wiring them in without fixing that would have made the mood hint
// wrong for Japanese and German speakers writing perfectly ordinary sentences.
describe("UX-38 — the four late arrivals do not misread ordinary speech", () => {
  const NEUTRAL: Array<[string, string]> = [
    ["ja", "今日はいい天気ですね"],
    ["ja", "一人暮らしを始めました"],      // "I started living alone" — a fact
    ["ja", "一人で買い物に行きます"],       // going shopping by myself
    ["ja", "写真をうつす"],                 // to take a photo
    ["ja", "うつくしい景色でした"],         // "it was a beautiful view"
    ["ja", "仕事が終わりました"],
    ["de", "Das Wetter ist heute schön"],
    ["de", "Ich gehe allein einkaufen"],    // shopping by myself
    ["de", "Mir geht es gut"],
    ["ar", "الطقس جميل اليوم"],
    ["ar", "أنا سعيد جدا"],
    ["he", "מזג האוויר נעים היום"],
    ["he", "אני שמח מאוד"],
  ];
  for (const [lang, text] of NEUTRAL) {
    it(`${lang}: ${text}`, () => expect(KM.isSadText(text)).toBe(false));
  }

  const SAD: Array<[string, string]> = [
    ["ja", "悲しいです"], ["ja", "一人ぼっちで寂しい"], ["ja", "憂鬱です"],
    ["de", "Ich bin traurig"], ["de", "Ich fühle mich einsam"],
    ["ar", "أنا حزين"], ["he", "אני עצוב"],
  ];
  for (const [lang, text] of SAD) {
    it(`${lang} sadness still detected: ${text}`, () => expect(KM.isSadText(text)).toBe(true));
  }
});

describe("no cross-language bleed from the new patterns", () => {
  for (const s of ["I had a rough day at work", "आज मौसम बहुत अच्छा है", "আজ আবহাওয়া ভালো", "the download finished"]) {
    it(`${s}`, () => {
      expect(KM.TE_SAD_REGEX.test(s)).toBe(false);
      expect(KM.TE_STRESS_REGEX.test(s)).toBe(false);
      expect(KM.TA_SAD_REGEX.test(s)).toBe(false);
      expect(KM.TA_STRESS_REGEX.test(s)).toBe(false);
    });
  }
});
