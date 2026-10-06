/**
 * Sadness that the on-device path missed, in four Indian languages.
 *
 * 🔴 WHY THIS EXISTS. The web analytics path carries an X_SAD_GAPS patch for
 * bn · mr · gu · ml. The mobile reply path does not, and mobile is where it
 * matters more: the emotion label does NOT stay on screen — it feeds the SYSTEM
 * PROMPT through emotionMemory, so a missed "I feel sad" costs the user a reply
 * written as though they had said nothing of the kind.
 *
 * These are not hypothetical strings. They are ordinary ways people write the
 * sentence in each language:
 *
 *   bn  মনটা খারাপ        — the regex had only the unspaced "মন খারাপ", so the
 *                            extremely common "মনটা" inflection fell through
 *   mr  वाईट वाटत          — present only in romanised form (khup kharab vatat)
 *   gu  દુઃખ / દુઃખી       — sorrow was absent from Gujarati ENTIRELY
 *   ml  വിഷമ               — present only romanised (vishamamundu)
 *
 * ⚠️ WIDENING THESE MAPS IS A REPLY CHANGE, not a display change — see the
 * emotion-label trap. So every pattern added here is high-precision: each is an
 * unambiguous word for sadness or distress in its language, never a general
 * negative that might fire on an ordinary sentence. The neutral cases at the
 * bottom exist to keep it that way.
 */

import {
  isSadText,
  BN_SAD_REGEX, MR_SAD_REGEX, GU_SAD_REGEX, ML_SAD_REGEX,
} from "../lib/emotion/keywordMaps";

describe("🔴 the four gaps — plain sadness that used to go unheard", () => {
  const cases: Array<[string, string, string]> = [
    ["bn", "মনটা খারাপ",            "the 'মনটা' inflection, not just 'মন খারাপ'"],
    ["bn", "আজ মনটা খুব খারাপ",      "and inside a sentence"],
    ["mr", "खूप वाईट वाटत आहे",      "Devanagari, not only the romanised form"],
    ["mr", "मला वाईट वाटत आहे",      "first person"],
    ["gu", "મને દુઃખ થાય છે",        "sorrow in Gujarati — was absent entirely"],
    ["gu", "હું દુઃખી છું",           "and the adjective form"],
    ["ml", "വിഷമമുണ്ട്",             "distress in Malayalam script"],
    ["ml", "എനിക്ക് വിഷമമാണ്",       "and the -ആണ് form"],
  ];

  it.each(cases)("%s: %s — %s", (_lang, text) => {
    expect(isSadText(text)).toBe(true);
  });
});

describe("the language regexes themselves now carry it", () => {
  it("bn matches a spaced/inflected 'mon kharap'", () => {
    expect(BN_SAD_REGEX.test("মনটা খারাপ")).toBe(true);
  });
  it("mr matches Devanagari 'vait vatat'", () => {
    expect(MR_SAD_REGEX.test("वाईट वाटत आहे")).toBe(true);
  });
  it("gu matches 'dukh'", () => {
    expect(GU_SAD_REGEX.test("દુઃખ")).toBe(true);
  });
  it("ml matches 'vishamam'", () => {
    expect(ML_SAD_REGEX.test("വിഷമമുണ്ട്")).toBe(true);
  });
});

describe("⚠️ and it still says no to ordinary sentences", () => {
  /**
   * The cost of widening a map is false positives, and on this surface a false
   * positive means the companion answers a cheerful message as if it were sad.
   * These are everyday sentences in the same four languages with no sadness in
   * them at all.
   */
  const neutral = [
    ["bn", "আজ আমি অফিসে যাচ্ছি"],        // I'm going to the office today
    ["bn", "আজ মনটা খুব ভালো"],            // today I feel very good — 'মনটা' present, NOT sad
    ["mr", "मी आज ऑफिसला जात आहे"],        // I'm going to the office today
    ["gu", "આજે હું ખુશ છું"],              // I am happy today
    ["ml", "ഇന്ന് എനിക്ക് സന്തോഷമാണ്"],     // I am happy today
  ];

  it.each(neutral)("%s: %s is not treated as sadness", (_lang, text) => {
    expect(isSadText(text)).toBe(false);
  });
});
