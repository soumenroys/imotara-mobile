// Characterization tests for the app's THREE parallel language/script
// detection implementations:
//   1. aiClient.detectLangFromScript      — routes /api/chat-reply formatting
//   2. aiClient.detectLangFromRomanHints  — transliterated (Roman-script) Indian langs
//   3. mobileTTS.detectMessageLang        — picks the TTS voice for a reply
//
// They have subtly different rules (Urdu/Marathi disambiguation, fallback
// behavior). These tests pin down the agreed behavior on the same inputs so a
// future change to one implementation that diverges from the others fails
// loudly here instead of silently regressing in one surface.

import {
    detectLangFromScript,
    detectLangFromRomanHints,
} from "../api/aiClient";
import { detectMessageLang, toBCP47 } from "../lib/tts/mobileTTS";

// Native-script samples (one per language) that BOTH script detectors must agree on.
const NATIVE_SAMPLES: Array<{ lang: string; text: string }> = [
    { lang: "bn", text: "আমি আজ খুব ভালো আছি" },
    { lang: "ta", text: "நான் இன்று மிகவும் சோர்வாக இருக்கிறேன்" },
    { lang: "te", text: "నేను ఈరోజు చాలా బాగున్నాను" },
    { lang: "gu", text: "હું આજે ખૂબ ખુશ છું" },
    { lang: "kn", text: "ನಾನು ಇಂದು ತುಂಬಾ ಸಂತೋಷವಾಗಿದ್ದೇನೆ" },
    { lang: "ml", text: "ഞാൻ ഇന്ന് വളരെ സന്തോഷത്തിലാണ്" },
    { lang: "pa", text: "ਮੈਂ ਅੱਜ ਬਹੁਤ ਖੁਸ਼ ਹਾਂ" },
    { lang: "or", text: "ମୁଁ ଆଜି ବହୁତ ଖୁସି ଅଛି" },
    { lang: "he", text: "אני מרגיש טוב היום" },
    { lang: "ru", text: "Сегодня я чувствую себя хорошо" },
    { lang: "zh", text: "我今天感觉很好" },
    { lang: "ja", text: "きょうはとてもげんきです" },
];

describe("native-script detection agreement (aiClient vs mobileTTS)", () => {
    test.each(NATIVE_SAMPLES)("$lang sample detected identically by both", ({ lang, text }) => {
        expect(detectLangFromScript(text)).toBe(lang);
        expect(detectMessageLang(text, "en")).toBe(lang);
    });
});

describe("Devanagari: Hindi vs Marathi disambiguation", () => {
    const hindi = "मैं आज बहुत खुश हूँ और सब ठीक है";
    const marathi = "मी आज खूप आनंदी आहे आणि सगळं छान आहे"; // contains आहे + मी (Marathi hints)

    test("plain Hindi → hi in both implementations", () => {
        expect(detectLangFromScript(hindi)).toBe("hi");
        expect(detectMessageLang(hindi, "en")).toBe("hi");
    });

    test("mobileTTS: Marathi function words flip Devanagari to mr", () => {
        expect(detectMessageLang(marathi, "en")).toBe("mr");
    });

    test("mobileTTS: mr fallback preference wins ties on ambiguous Devanagari", () => {
        // No Marathi-exclusive hint words here — pure shared-alphabet text.
        const ambiguous = "सपना";
        expect(detectMessageLang(ambiguous, "mr")).toBe("mr");
        expect(detectMessageLang(ambiguous, "hi")).toBe("hi");
    });

    test("aiClient (KNOWN LIMITATION): detectLangFromScript maps ALL Devanagari to hi", () => {
        // aiClient has no Marathi hint pass — documenting current behavior so a
        // future unification is a conscious decision, not an accident.
        expect(detectLangFromScript(marathi)).toBe("hi");
    });
});

describe("Arabic script: Arabic vs Urdu disambiguation", () => {
    const urdu = "میں ٹھیک ہوں اور خوش ہوں"; // ٹ ں ے are Urdu-only letters
    const arabic = "أنا بخير اليوم والحمد لله";

    test("Urdu-specific letters → ur in both implementations", () => {
        expect(detectLangFromScript(urdu)).toBe("ur");
        expect(detectMessageLang(urdu, "en")).toBe("ur");
    });

    test("plain Arabic → ar in both implementations", () => {
        expect(detectLangFromScript(arabic)).toBe("ar");
        expect(detectMessageLang(arabic, "en")).toBe("ar");
    });

    test("mobileTTS: ur fallback preference wins ties on plain Arabic script", () => {
        expect(detectMessageLang(arabic, "ur")).toBe("ur");
    });
});

describe("Latin-script behavior", () => {
    test("pure English → en (aiClient) / fallback lang (mobileTTS)", () => {
        const english = "I am feeling really good today, thanks for asking!";
        expect(detectLangFromScript(english)).toBe("en");
        // mobileTTS trusts the app preference for pure-Latin text — this is how
        // es/fr/de/pt/id keep their voices despite looking "English" at the
        // codepoint level.
        expect(detectMessageLang(english, "en")).toBe("en");
        expect(detectMessageLang(english, "es")).toBe("es");
    });

    test("empty text falls back safely", () => {
        expect(detectLangFromScript("")).toBe("en");
        expect(detectMessageLang("", "hi")).toBe("hi");
    });

    test("mixed script: dominant script wins in mobileTTS", () => {
        const mixed = "ok fine, কিন্তু আমার মন খারাপ লাগছে আজকে সারাদিন";
        expect(detectMessageLang(mixed, "en")).toBe("bn");
        expect(detectLangFromScript(mixed)).toBe("bn");
    });
});

describe("Romanized (transliterated) hint detection — aiClient", () => {
    test("romanized Hindi with ≥2 hint words → hi", () => {
        expect(detectLangFromRomanHints("mujhe bahut bura lag raha hai yaar")).toBe("hi");
    });

    test("romanized Bengali with ≥2 hint words → bn", () => {
        expect(detectLangFromRomanHints("ami khub bhalo achi ekhon")).toBe("bn");
    });

    test("single coincidental hint word does NOT flip English", () => {
        // "hai" alone is one hit — below the 2-hit threshold.
        expect(detectLangFromRomanHints("wow hai that is so cool")).toBe("en");
    });

    test("plain English stays en", () => {
        expect(detectLangFromRomanHints("I had a long day at work and I want to rest")).toBe("en");
    });
});

describe("BCP-47 mapping for TTS", () => {
    test("known languages map to regioned tags", () => {
        expect(toBCP47("hi")).toBe("hi-IN");
        expect(toBCP47("bn")).toBe("bn-IN");
        expect(toBCP47("ur")).toBe("ur-PK");
        expect(toBCP47("zh")).toBe("zh-CN");
    });

    test("unknown language falls back to en-US", () => {
        expect(toBCP47("xx")).toBe("en-US");
        expect(toBCP47("")).toBe("en-US");
    });
});
