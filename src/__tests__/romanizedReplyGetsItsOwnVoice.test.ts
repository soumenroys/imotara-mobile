/**
 * A romanized Indic reply must not be read aloud by an English voice.
 *
 * 🔴 Observed on Android 2026-10-10, on a reply that was entirely Gujarati:
 *     [mobileTTS] speakMessage start lang=en textLen=108 ... transliterate=0ms
 *
 * The companion often replies in ROMANIZED Indic — "Hu saaru chhu, tane
 * shanti male evi shubhkamna" is Gujarati in Latin letters. detectMessageLang
 * found no non-Latin script and fell straight through to the app setting,
 * which is `concreteLang(preferredLang)` — and that maps "auto" AND an unset
 * preference to "en".
 *
 * Two things went wrong at once for anyone who had not picked a language:
 *   • an ENGLISH voice spoke Gujarati words, and
 *   • because the language resolved to "en", transliteration was skipped, so
 *     Azure never received native script either.
 *
 * 🔑 The WEB app already consulted the roman-hint detector before the profile
 * setting, "because that setting is frequently stale/unset". Same decision,
 * two copies, one fixed. The third instance of the concreteLang trap today.
 */

import { describe, it, expect } from "@jest/globals";
import { detectMessageLang } from "../lib/tts/mobileTTS";

/** What an unset / "auto" preference collapses to before reaching TTS. */
const UNSET = "en";

describe("🔴 romanized Indic gets its own voice, not English", () => {
  it("the Gujarati reply from the device log", () => {
    const live = "Hu saaru chhu, tane shanti male evi shubhkamna. Tane kai vishesh vaat karvi hoy to hu sambhlu chhu, no rush.";
    expect(detectMessageLang(live, UNSET)).toBe("gu");
  });

  it("romanized Bengali, Hindi and Tamil too", () => {
    expect(detectMessageLang("ami bhalo nei, mon kharap lagche", UNSET)).toBe("bn");
    expect(detectMessageLang("main theek nahi hoon, bahut thaka hua hoon", UNSET)).toBe("hi");
    expect(detectMessageLang("enakku romba kashtama irukku", UNSET)).toBe("ta");
  });
});

describe("⚖️ what must NOT change", () => {
  it("genuine English stays English", () => {
    // The regression that would matter most: an Indic voice reading English.
    for (const t of [
      "I'm really glad you reached out. What feels heaviest right now?",
      "You do not have to carry the whole weight at once.",
      "That sounds exhausting. Tell me more when you are ready.",
    ]) {
      expect(detectMessageLang(t, UNSET)).toBe("en");
    }
  });

  it("native script still wins over everything", () => {
    expect(detectMessageLang("আমি ভালো নেই", UNSET)).toBe("bn");
    expect(detectMessageLang("मैं ठीक नहीं हूँ", UNSET)).toBe("hi");
    expect(detectMessageLang("એવું લાગે છે", UNSET)).toBe("gu");
  });

  it("⛔ an EXPLICIT language choice is still honoured for English-looking text", () => {
    // Someone who chose Hindi and gets a Latin-looking reply keeps Hindi.
    expect(detectMessageLang("hello", "hi")).toBe("hi");
    expect(detectMessageLang("ok", "bn")).toBe("bn");
  });

  it("empty and trivial text falls back rather than guessing", () => {
    expect(detectMessageLang("", UNSET)).toBe("en");
    expect(detectMessageLang("...", UNSET)).toBe("en");
  });

  it("the Marathi and Urdu disambiguation still works", () => {
    expect(detectMessageLang("मी ठीक नाही आहे", UNSET)).toBe("mr");
    expect(detectMessageLang("میں ٹھیک نہیں ہوں", UNSET)).toBe("ur");
  });
});
