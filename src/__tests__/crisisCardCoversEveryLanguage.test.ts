/**
 * The crisis card must appear in all 22 languages, on every platform.
 *
 * 🔴 MEASURED 2026-10-10, before this file existed. The web chat page and the
 * mobile chat screen each had their own tier-2 detector, and they disagreed:
 *
 *     web     covered  9 / 22 languages
 *     mobile  covered 22 / 22
 *
 * ⛔ Thirteen languages got NO crisis card on the web app — Gujarati, Odia,
 * Urdu, Arabic, Hebrew, Russian, Chinese, Japanese, Spanish, French, German,
 * Portuguese, Indonesian. Someone could type "quiero morir" or "我想死" into
 * imotara.com and see nothing, then type the same sentence on their phone and
 * get a helpline. Every one of those languages is advertised by the product.
 *
 * ⚠️ AND NOT ONLY ONE WAY. Mobile used CRISIS_HINT_REGEX alone and missed 16
 * phrases the web page caught, including the bare word "suicide".
 *
 * 🔑 So tier 2 is now the UNION of both, in `isCrisisTier2`. This file is what
 * stops it drifting again — it is the MOBILE twin of the web repo's file of
 * the same name, built from the same 22-language and 16-phrase lists, because
 * two repos cannot share a test run. ⚠️ Edit one, run the other.
 *
 * ⛔ A failure here is not a style problem. It means someone saying they want
 * to die is shown nothing.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { isCrisisTier2, CRISIS_HINT_REGEX } from "../lib/emotion/keywordMaps";

/**
 * One explicit statement of suicidal ideation per supported language.
 *
 * ⚠️ These are taken from the detectors' own vocabulary, so a failure means
 * the language is genuinely uncovered — not that an unusual phrasing was
 * invented to make a point.
 */
const TIER2_BY_LANGUAGE: Array<[string, string, string]> = [
    ["en", "I want to die",                  "English"],
    ["hi", "मैं मरना चाहता हूँ",                 "Hindi"],
    ["bn", "আমি মরতে চাই",                    "Bengali"],
    ["mr", "मला मरायचंय",                      "Marathi"],
    ["ta", "எனக்கு சாக வேண்டும்",               "Tamil"],
    ["te", "నేను చనిపోవాలి",                    "Telugu"],
    ["gu", "મારે મરી જવું છે",                    "Gujarati"],
    ["pa", "ਮੈਂ ਮਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ",                 "Punjabi"],
    ["kn", "ನಾನು ಸಾಯಬೇಕು",                    "Kannada"],
    ["ml", "എനിക്ക് മരിക്കണം",                   "Malayalam"],
    ["or", "ମୁଁ ବଞ୍ଚିବାକୁ ଚାହୁଁନାହିଁ",                "Odia"],
    ["ur", "میں مرنا چاہتا ہوں",                "Urdu"],
    ["ar", "أريد أن أموت",                      "Arabic"],
    ["he", "אני רוצה למות",                     "Hebrew"],
    ["ru", "я хочу умереть",                    "Russian"],
    ["zh", "我想死",                            "Chinese"],
    ["ja", "死にたい",                           "Japanese"],
    ["es", "quiero morir",                     "Spanish"],
    ["fr", "je veux mourir",                   "French"],
    ["de", "ich will sterben",                 "German"],
    ["pt", "quero morrer",                     "Portuguese"],
    ["id", "saya ingin mati",                  "Indonesian"],
];

describe("🔴 TIER 2 — every one of the 22 languages shows the card", () => {
    it.each(TIER2_BY_LANGUAGE)(
        "%s (%s) — %s",
        (_code, phrase) => {
            expect(isCrisisTier2(phrase)).toBe(true);
        },
    );

    it("⛔ all 22, counted — so a dropped row cannot hide", () => {
        // it.each above would silently shrink if someone deleted a line.
        expect(TIER2_BY_LANGUAGE).toHaveLength(22);
        const missing = TIER2_BY_LANGUAGE
            .filter(([, phrase]) => !isCrisisTier2(phrase))
            .map(([code]) => code);
        expect(missing).toEqual([]);
    });

    it("🔑 and the 22 codes are exactly the product's languages", () => {
        const codes = TIER2_BY_LANGUAGE.map(([c]) => c).sort();
        expect(codes).toEqual([
            "ar", "bn", "de", "en", "es", "fr", "gu", "he", "hi", "id", "ja",
            "kn", "ml", "mr", "or", "pa", "pt", "ru", "ta", "te", "ur", "zh",
        ]);
    });
});

describe("⚠️ THE UNION — neither platform may lose what it already caught", () => {
    /**
     * 🔑 The phrases the WEB page caught and CRISIS_HINT_REGEX does not. If
     * tier 2 were ever "simplified" to the shared regex alone, every one of
     * these would stop showing a card — which is what mobile was doing.
     */
    // ⚠️ CORRECTED. My first draft of this list also named "overdose",
    // "being abused" and "thinking about suicide" — wrong, the shared regex
    // covers all three. They came from a throwaway script that scraped the
    // regex out of the source with a faulty pattern and truncated it. The
    // numbers below come from the real module instead.
    const WEB_ONLY = [
        "suicide",
        "मरून जातो",
        "ಬದುಕಬೇಕಾಗಿಲ್ಲ",
        "મરવું છે",
        "నన్ను నేను హాని",
        "maraycha",
        "jagaych nahi",
        "chanipovali",
        "saayabeku",
        "marikknam",
        "jeevanam venda",
        "saaga beku",
        "aatmahatya",
        "mar jaun",
        "जिंदगी खत्म",
        "ਜਿਉਣਾ ਨਹੀਂ",
    ];

    it("🔴 the shared regex alone really does miss these — the premise", () => {
        // If this ever fails, CRISIS_HINT_REGEX has grown to cover them and
        // the legacy sets may finally be redundant. Check before deleting.
        const covered = WEB_ONLY.filter((p) => CRISIS_HINT_REGEX.test(p));
        expect(covered).toEqual([]);
    });

    it("⛔ …and the union catches every one", () => {
        const missing = WEB_ONLY.filter((p) => !isCrisisTier2(p));
        expect(missing).toEqual([]);
    });

    it("⛔ the bare word 'suicide' shows a card", () => {
        // Called out on its own because it is the single most likely thing
        // for someone to type, and mobile was missing it.
        expect(isCrisisTier2("suicide")).toBe(true);
        expect(isCrisisTier2("I keep thinking about suicide")).toBe(true);
    });
});

describe("⚖️ what must NOT trigger it", () => {
    // A false positive shows somebody a helpline they did not need. That is
    // far cheaper than the alternative, but it is not free — the card
    // interrupts an ordinary conversation about a hard day.
    it.each([
        ["an ordinary hard day", "I feel very tired today"],
        ["Bengali tiredness", "আমার আজ খুব ক্লান্ত লাগছে"],
        ["sadness without ideation", "মন ভালো নেই"],
        ["talking about someone else's news", "my friend got a new job"],
        ["the word death in the abstract", "we talked about death in class"],
        ["a film plot", "the movie was about a killer"],
    ])("%s", (_what, phrase) => {
        expect(isCrisisTier2(phrase)).toBe(false);
    });

    it("empty and degenerate input never throws, never fires", () => {
        for (const v of ["", "   ", null, undefined]) {
            expect(isCrisisTier2(v as unknown as string)).toBe(false);
        }
    });
});

describe("\u26d4 the chat SCREEN uses the shared decision, not its own copy", () => {
    const SCREEN = fs.readFileSync(
        path.join(process.cwd(), "src/screens/ChatScreen.tsx"), "utf8");

    it("detectMobileCrisisTier calls isCrisisTier2", () => {
        expect(SCREEN).toMatch(/if \(isCrisisTier2\(text\)\) return 2;/);
    });

    it("\ud83d\udd34 and it no longer uses CRISIS_HINT_REGEX alone", () => {
        // That regex misses 16 phrases the web page caught, "suicide" among
        // them. Narrowing back to it would silently drop all 16 on mobile.
        expect(SCREEN).not.toMatch(/const MOBILE_CRISIS_TIER2_RE = CRISIS_HINT_REGEX/);
    });
});
