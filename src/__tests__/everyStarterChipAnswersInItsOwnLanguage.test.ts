/**
 * Every "Or try in your language" chip must be answered in THAT language.
 *
 * 🔴 FOUND 2026-10-09 by tapping them on a device: FOUR of the ten were not.
 *
 *     മലയാളം  "valiya vishamamundu"   → en   (English!)
 *     ગુજરાતી  "man kharap che"        → bn   (Bengali!)
 *     ਪੰਜਾਬੀ  "man kharab aa"         → en
 *     ଓଡ଼ିଆ   "mana kharap laguchhi"  → bn
 *
 * ⚠️ This is the worst possible place for it. These chips exist FOR someone
 * who may not be comfortable in English; they are the first thing that person
 * taps. Tapping the Punjabi button and being answered in English is the whole
 * promise of the product failing on contact.
 *
 * 🔑 CAUSE — a pan-Indic word living in ONE language's row. `kharap`/`kharab`
 * ("bad") is Bengali, Gujarati, Punjabi, Odia, Hindi and Marathi, but it sat
 * only in the Bengali row, so it won every tie it took part in. The same shape
 * as `have` in the Gujarati row (see englishIsNotGujarati.test.ts on web): a
 * shared token treated as proof of one language.
 *
 * ⛔ THE TEST READS THE CHIPS FROM ChatScreen.tsx ON PURPOSE. A hardcoded copy
 * would pass forever while someone adds an 11th language with text nothing can
 * detect — which is exactly how these four shipped.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { resolveReplyLang } from "../api/aiClient";

/** The language each chip LABEL promises, by its native name. */
const LABEL_TO_LANG: Record<string, string> = {
    "हिंदी": "hi", "বাংলা": "bn", "தமிழ்": "ta", "తెలుగు": "te", "ಕನ್ನಡ": "kn",
    "മലയാളം": "ml", "ગુજરાતી": "gu", "ਪੰਜਾਬੀ": "pa", "ଓଡ଼ିଆ": "or", "मराठी": "mr",
};

function readChips(): Array<{ label: string; text: string }> {
    const src = fs.readFileSync(path.join(process.cwd(), "src/screens/ChatScreen.tsx"), "utf8");
    const block = src.slice(src.indexOf("Or try in your language"));
    return [...block.matchAll(/\{ flag: "[^"]*", lang: "([^"]+)",\s*text: "([^"]+)" \}/g)]
        .map((m) => ({ label: m[1], text: m[2] }));
}

describe("🔴 the starter chips", () => {
    const chips = readChips();

    it("were actually found in the source", () => {
        // If this breaks, the regex drifted — fix it rather than deleting the file.
        expect(chips.length).toBeGreaterThanOrEqual(10);
    });

    it("every chip's label is a language we can assert on", () => {
        for (const { label } of chips) expect(Object.keys(LABEL_TO_LANG)).toContain(label);
    });

    it.each(readChips().map((c) => [c.label, c.text] as const))(
        "the %s button is answered in its own language (%s)",
        (label, text) => {
            expect(resolveReplyLang(text, "auto")).toBe(LABEL_TO_LANG[label]);
        },
    );
});

describe("🔑 the pan-Indic word no longer decides on its own", () => {
    it("`kharap`/`kharab` does not hand every language to Bengali", () => {
        // One shared word, five different languages — each settled by its OWN
        // distinctive marker (che / aa / laguchhi / aahe), not by the shared one.
        expect(resolveReplyLang("man kharap che", "auto")).toBe("gu");       // che  → Gujarati
        expect(resolveReplyLang("man kharab aa", "auto")).toBe("pa");        // aa   → Punjabi
        expect(resolveReplyLang("mana kharap laguchhi", "auto")).toBe("or"); // or
        expect(resolveReplyLang("man kharab aahe", "auto")).toBe("mr");      // aahe → Marathi
        expect(resolveReplyLang("মন খারাপ লাগছে", "auto")).toBe("bn");        // and Bengali still works
    });

    it("⚠️ the word boundaries are what keep these apart — do not loosen them", () => {
        // `man kharap` (gu) must NOT match inside "mana kharap" (or), and
        // `kharab aa` (pa) must NOT match inside "kharab aahe" (mr). Both rely
        // on \b. Dropping it silently merges four languages into one.
        expect(resolveReplyLang("mana kharap laguchhi", "auto")).not.toBe("gu");
        expect(resolveReplyLang("man kharab aahe", "auto")).not.toBe("pa");
    });
});

describe("⚖️ and nothing was paid for it", () => {
    it.each([
        "I have no one to talk to",
        "Everything is fine, I have work tomorrow",
        "Sometimes I wonder if anyone would notice",
        "I lost my job last week and I am struggling",
    ])("plain English stays English: %s", (s) => {
        expect(resolveReplyLang(s, "auto")).toBe("en");
    });

    it("✅ and an Odia sentence that used to fall through now lands", () => {
        // Measured as part of this change: en -> or, on BOTH platforms.
        expect(resolveReplyLang("mote bhari kasta lagucha", "auto")).toBe("or");
    });
});
