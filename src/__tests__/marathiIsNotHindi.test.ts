/**
 * Marathi typed in Devanagari must be answered in Marathi.
 *
 * 🔴 THE SPLIT THIS CLOSES. `MARATHI_HINT` existed in THREE places and only two
 * of them worked:
 *
 *   imotara-mobile  lib/tts/mobileTTS.ts   ✅ had it — picked the Marathi VOICE
 *   imotaraapp      app/chat/page.tsx      ✅ had it — picked the Marathi REPLY
 *   imotara-mobile  api/aiClient.ts        ❌ DID NOT
 *
 * `detectLangFromScript` returned "hi" for every Devanagari string, so on a
 * phone the same sentence was SPOKEN in Marathi and ANSWERED in Hindi. On the
 * web it was correct. The board carried this as "mobile is strictly worse".
 *
 * ⚠️ The web copy even carries the comment "the mobile app already had this
 * right" — true of the script RANGE, false of the HINT. That is exactly the
 * kind of claim that survives because nobody opens the other file.
 *
 * ⛔ A failure here means a Marathi speaker is being answered in Hindi again.
 */

import fs from "fs";
import path from "path";
import { MARATHI_HINT, devanagariLang } from "../lib/lang/devanagariHint";
import { detectLangFromScript } from "../api/aiClient";

/** Real Marathi, using the markers the hint is built from. */
const MARATHI: Array<[string, string]> = [
    ["आहे", "मी ठीक आहे"],
    ["नाही", "मला बरं वाटत नाही"],
    ["माझे", "हे माझे मन आहे"],
    ["तुम्ही", "तुम्ही कसे आहात"],
    ["मी + space", "मी खूप थकलो आहे"],
];

/** Ordinary Hindi that must NOT be mistaken for Marathi. */
const HINDI: Array<[string, string]> = [
    ["negation", "मुझे अच्छा नहीं लग रहा"],
    ["plain", "मैं बहुत थका हुआ हूँ"],
    ["crisis", "मैं मरना चाहता हूँ"],
    ["question", "आज मैं क्या करूँ"],
];

describe("🔴 Devanagari is not automatically Hindi", () => {
    it.each(MARATHI)("Marathi via %s → mr", (_marker, text) => {
        expect(devanagariLang(text)).toBe("mr");
        expect(detectLangFromScript(text)).toBe("mr");
    });

    it.each(HINDI)("Hindi (%s) stays hi", (_what, text) => {
        expect(devanagariLang(text)).toBe("hi");
        expect(detectLangFromScript(text)).toBe("hi");
    });

    it("⛔ the crisis phrase keeps working in BOTH languages", () => {
        // The thing we device-tested on 2026-10-11 must not regress, and the
        // Marathi equivalent must now resolve correctly rather than to Hindi.
        expect(detectLangFromScript("मैं मरना चाहता हूँ")).toBe("hi");
        expect(detectLangFromScript("मला मरायचं आहे")).toBe("mr");
    });

    it("🔑 non-Devanagari scripts are untouched by this change", () => {
        expect(detectLangFromScript("আমি মরতে চাই")).toBe("bn");
        expect(detectLangFromScript("أريد أن أموت")).toBe("ar");
        expect(detectLangFromScript("я хочу умереть")).toBe("ru");
        expect(detectLangFromScript("hello")).toBe("en");
    });
});

describe("⚠️ one hint, one home", () => {
    const read = (p: string) =>
        fs.readFileSync(path.join(__dirname, "..", p), "utf8");

    it("⛔ no file re-declares MARATHI_HINT inline", () => {
        // Three copies is how this broke. A fourth would break it again.
        for (const f of ["api/aiClient.ts", "lib/tts/mobileTTS.ts"]) {
            if (/const\s+MARATHI_HINT\s*=/.test(read(f))) {
                throw new Error(`${f} re-declares MARATHI_HINT — import it from lib/lang/devanagariHint`);
            }
        }
    });

    it("🔑 the trailing space in 'मी ' survives", () => {
        // Without it the pattern fires on Hindi words merely starting with मी.
        expect(MARATHI_HINT.source).toContain("मी ");
        // And prove the space matters, rather than just asserting it is there.
        expect(MARATHI_HINT.test("मीठा")).toBe(false);
        expect(MARATHI_HINT.test("मी आहे")).toBe(true);
    });
});
