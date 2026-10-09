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

    test("a short COMPLETE Indic sentence is detected on one hit", () => {
        // 🔴 REWRITTEN 2026-10-09. This block used to assert
        //   detectLangFromRomanHints("wow hai that is so cool") === "en"
        // on the stated grounds that "hai" alone is "below the 2-hit threshold".
        //
        // That threshold WAS the bug. It cannot tell a complete short Indic
        // sentence from a coincidental English match, so it rejected both, and
        // mobile answered ENGLISH to every one of these — the shortest, most
        // common, most vulnerable message this product receives. Measured on 35
        // real sentences: 13 disagreed with web and mobile was wrong in 11.
        for (const [sentence, want] of [
            ["kem cho", "gu"],              // a whole Gujarati greeting
            ["majama", "gu"],
            ["ami valo nei", "bn"],         // Bengali "I'm not well"
            ["mera dil bhari hai", "hi"],   // "my heart is heavy"
            ["enakku kashtama irukku", "ta"],
            ["njan sukhamalla", "ml"],      // Malayalam "I'm not well"
            ["nanu chennagilla", "kn"],     // Kannada "I'm not well"
        ] as const) {
            expect(detectLangFromRomanHints(sentence)).toBe(want);
        }
    });

    test("⚠️ `hai` IS a Hindi marker — and that is deliberate", () => {
        // The old test's own example now resolves to hi, and the WEB detector
        // has always agreed (verified directly, not assumed). `hai` is the
        // single most reliable romanized-Hindi marker there is and sits in the
        // indicGrammar VETO list, which exists so code-mixed text — English
        // nouns inside Indic grammar, the normal register for these speakers —
        // is never called English.
        expect(detectLangFromRomanHints("wow hai that is so cool")).toBe("hi");
        // Remove the marker and it is English again, which is the real check.
        expect(detectLangFromRomanHints("wow that is so cool")).toBe("en");
    });

    test("⛔ a 1–2 letter token alone is NOT evidence of a language", () => {
        // Measured: "Ho ho ho" matched hi=[Ho,ho,ho] and nothing else and was
        // answered in Hindi — a bug that PREDATED the threshold removal.
        expect(detectLangFromRomanHints("Ho ho ho")).toBe("en");
        expect(detectLangFromRomanHints("Na, it is fine")).toBe("en");
        // ✅ …but the short pronouns still COUNT. These depend on them and must
        // keep working: or=[mu,bhala] and mr=[mi,theek nahi,aahe].
        expect(detectLangFromRomanHints("mu bhala nahin")).toBe("or");
        expect(detectLangFromRomanHints("mi theek nahi aahe")).toBe("mr");
    });

    test("plain English stays en", () => {
        expect(detectLangFromRomanHints("I had a long day at work and I want to rest")).toBe("en");
        expect(detectLangFromRomanHints("I have no one to talk to")).toBe("en");
        expect(detectLangFromRomanHints("Everything is fine, I have work tomorrow")).toBe("en");
        expect(detectLangFromRomanHints("Sometimes I wonder if anyone would notice")).toBe("en");
    });

    test("🔑 code-mixing is NOT collateral damage", () => {
        // English nouns inside Indic grammar. The guard must never steal these.
        expect(detectLangFromRomanHints("mane work ma problem che")).toBe("gu");
        expect(detectLangFromRomanHints("enakku really kashtama irukku today")).toBe("ta");
        expect(detectLangFromRomanHints("ami office jabo na aaj, feeling very tired")).toBe("bn");
        expect(detectLangFromRomanHints("I know this is hard lekin mera dil bhari hai")).not.toBe("en");
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
