/**
 * Scripts that SHARE characters must be told apart by the unambiguous ones.
 *
 * 🔴 Found 2026-10-10 while testing the web script detector, which had the
 * identical ordering. Two separate misclassifications, same root cause: a
 * script was identified by a character range it does not own exclusively.
 *
 *   • KANJI are shared between Japanese and Chinese. Testing the CJK range
 *     first classified ordinary Japanese — which nearly always mixes kanji
 *     with kana — as CHINESE. This feeds resolveReplyLang, so a Japanese
 *     speaker with no stated language was ANSWERED IN CHINESE.
 *
 *   • U+0964 DANDA (।) sits in the Devanagari block but is shared punctuation
 *     across Bengali, Punjabi, Odia and Gujarati. This detector already
 *     excluded it; the WEB one did not, and was reading Bengali aloud in a
 *     Hindi voice. Pinned here so the two cannot drift apart again.
 */

import { describe, it, expect } from "@jest/globals";
import { detectLangFromScript } from "../api/aiClient";

const DANDA = "।";

describe("🔴 kana before kanji — Japanese is not Chinese", () => {
  it("ordinary Japanese, mixing kanji and kana, is Japanese", () => {
    // The exact string that returned "zh".
    expect(detectLangFromScript("今日は気分が悪い")).toBe("ja");
  });

  it("…in hiragana, katakana, and mixed", () => {
    expect(detectLangFromScript("きょうはつらい")).toBe("ja");          // hiragana
    expect(detectLangFromScript("ストレスがつらい")).toBe("ja");        // katakana
    expect(detectLangFromScript("今日はストレスが多い")).toBe("ja");    // mixed
  });

  it("⚖️ Chinese is still Chinese — no regression", () => {
    expect(detectLangFromScript("我今天感觉不好")).toBe("zh");
    expect(detectLangFromScript("我很难过")).toBe("zh");
  });

  it("kanji-only text stays Chinese, which is the honest answer", () => {
    // Genuinely ambiguous without kana. Unchanged behaviour.
    expect(detectLangFromScript("日本")).toBe("zh");
  });
});

describe("🔴 the danda is punctuation, not a language", () => {
  it("Bengali ending in a danda is Bengali", () => {
    expect(detectLangFromScript(`আমি আজ ভালো নেই${DANDA}`)).toBe("bn");
  });

  it("every danda-using script keeps its identity", () => {
    expect(detectLangFromScript(`ਮੈਨੂੰ ਚੰਗਾ ਨਹੀਂ ਲੱਗਦਾ${DANDA}`)).toBe("pa");
    expect(detectLangFromScript(`ମୁଁ ଭଲ ନାହିଁ${DANDA}`)).toBe("or");
    expect(detectLangFromScript(`મને સારું નથી${DANDA}`)).toBe("gu");
  });

  it("⚖️ Hindi is still Hindi, danda or not", () => {
    expect(detectLangFromScript("मैं ठीक नहीं हूँ")).toBe("hi");
    expect(detectLangFromScript(`मैं ठीक नहीं हूँ${DANDA}`)).toBe("hi");
  });

  it("⛔ a danda alone is not a language signal", () => {
    expect(detectLangFromScript(DANDA)).toBe("en");
  });
});

describe("⚖️ the whole supported set still resolves — no regression", () => {
  it("every non-Latin language the product supports", () => {
    const cases: Array<[string, string]> = [
      ["আমি ভালো নেই", "bn"],
      ["मैं ठीक नहीं", "hi"],
      ["எனக்கு நல்லா இல்ல", "ta"],
      ["నాకు బాగాలేదు", "te"],
      ["મને સારું નથી", "gu"],
      ["ನನಗೆ ಬೇಸರ", "kn"],
      ["എനിക്ക് സുഖമില്ല", "ml"],
      ["ਮੈਨੂੰ ਚੰਗਾ ਨਹੀਂ", "pa"],
      ["ମୁଁ ଭଲ ନାହିଁ", "or"],
      ["אני לא מרגיש טוב", "he"],
      ["أنا لست بخير", "ar"],
      ["مجھے اچھا نہیں لگ رہا", "ur"],
      ["мне плохо", "ru"],
      ["我感觉不好", "zh"],
      ["つらいです", "ja"],
    ];
    for (const [text, want] of cases) {
      expect(detectLangFromScript(text)).toBe(want);
    }
  });

  it("Latin text is still English", () => {
    expect(detectLangFromScript("i feel low today")).toBe("en");
    expect(detectLangFromScript("")).toBe("en");
  });
});
