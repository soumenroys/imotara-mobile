// Regression test for CRISIS_HINT_REGEX language coverage — this file is a
// manually-synced copy of imotaraapp's src/lib/emotion/keywordMaps.ts (no
// shared package between the two repos). Synced 2026-08-14 to close a real
// gap: this copy was stale at 13 languages while the web original had grown
// to 22, so mobile's crisis card silently didn't fire for 9 languages
// (pa, or, ur, zh, es, fr, id, pt, ru). Keep this test in sync whenever the
// regex is re-synced from web.

import { CRISIS_HINT_REGEX } from "../lib/emotion/keywordMaps";

const CRISIS_SAMPLES: Record<string, string> = {
  en: "I want to die",
  hi: "मैं मरना चाहता हूँ",
  bn: "আমি মরতে চাই",
  pa: "ਮੈਂ ਮਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ",
  or: "ମୋତେ ମରିଯିବାକୁ ମନ ହେଉଛି",
  ur: "میں مرنا چاہتا ہوں",
  zh: "我想死",
  es: "quiero morir",
  fr: "je veux mourir",
  id: "saya ingin mati",
  pt: "quero morrer",
  ru: "я хочу умереть",
};

const NEGATIVE_CONTROLS = [
  "I had a rough day at work",
  "estoy muy feliz hoy",
  "今天天气很好",
];

describe("CRISIS_HINT_REGEX (mobile copy, all 22 languages)", () => {
  test.each(Object.entries(CRISIS_SAMPLES))("matches %s", (_lang, text) => {
    expect(CRISIS_HINT_REGEX.test(text)).toBe(true);
  });

  test.each(NEGATIVE_CONTROLS)("does not false-positive on: %s", (text) => {
    expect(CRISIS_HINT_REGEX.test(text)).toBe(false);
  });
});

// Found on the iPhone simulator, 2026-09-05. The pattern carried only the
// "...है" form of this sentence, so the "...करता" form — which is at least as
// common in ordinary Hindi — scored tier 0 and produced no crisis card and no
// helpline. Both forms are pinned here so the narrower one cannot come back.
describe("Hindi says this more than one way", () => {
  const SAME_MEANING = [
    "जीने का मन नहीं है",
    "मुझे जीने का मन नहीं करता",
    "मुझे जीने का मन नहीं करती",
    "अब जीने का मन नहीं",
    "मुझे जीने की इच्छा नहीं",
  ];
  test.each(SAME_MEANING)("detects: %s", (text) => {
    expect(CRISIS_HINT_REGEX.test(text)).toBe(true);
  });

  // Widening the pattern must not make ordinary Hindi look like a crisis.
  const ORDINARY_HINDI = [
    "आज मौसम बहुत अच्छा है",
    "मुझे यह फिल्म देखने का मन नहीं है",
    "मुझे आज बाहर जाने का मन नहीं करता",
    "खाने का मन नहीं है",
    "मैं ठीक हूँ",
  ];
  test.each(ORDINARY_HINDI)("does not fire on: %s", (text) => {
    expect(CRISIS_HINT_REGEX.test(text)).toBe(false);
  });
});
