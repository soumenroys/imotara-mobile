/**
 * The crisis card must lay out right-to-left when it speaks an RTL language.
 *
 * 🔴 SEEN ON A REAL iPHONE, 2026-10-11, build 1.4.10/157. Typing
 * "أريد أن أموت" produced a card whose TEXT was correct — the 💛 rendered to
 * the right of the Arabic string, so bidi works — inside an LTR CONTAINER:
 *
 *     header            left-aligned, hugging the left edge
 *     dismiss "x"       on the right
 *     Emergency / 112   label left, number right
 *
 * ⛔ I18nManager could never have fixed that card. It reads the STORED language
 * setting, the person was on "auto", and React Native only applies direction at
 * the NEXT cold start (lib/rtl.ts says so in its own header). A card that
 * exists to answer the message just typed cannot wait for a relaunch.
 *
 * ⇒ Direction is applied PER CARD from the language the card is speaking.
 *
 * ⚠️ WHAT THIS TEST CANNOT DO. It cannot see pixels. It proves the language
 * decision and proves the card reads its direction from that decision rather
 * than from a hardcoded "row". **The visual result still needs a device** —
 * the same honesty rtl.ts has carried since it was written.
 */

import fs from "fs";
import path from "path";
import { isRtlLang } from "../lib/lang/rtlLangs";

describe("🔴 which languages flip", () => {
    it.each(["ar", "he", "ur", "ar-EG", "he_IL", "UR"])("%s is RTL", (lang) => {
        expect(isRtlLang(lang)).toBe(true);
    });

    it.each(["en", "hi", "bn", "mr", "ta", "ru", "zh", "ja", "es", "fr"])(
        "%s is not RTL", (lang) => {
            expect(isRtlLang(lang)).toBe(false);
        });

    it("🔑 absent or junk input is never RTL", () => {
        // The card renders before a language is known. Flipping on undefined
        // would mirror the layout for everyone.
        for (const v of [undefined, null, "", "   ", "xx"]) {
            expect(isRtlLang(v as unknown as string)).toBe(false);
        }
    });

    it("⛔ the three RTL languages are exactly ar/he/ur", () => {
        // All three are shipped languages with their own prompts, TTS voices
        // and crisis copy. A fourth added to the product must be added here.
        const all = ["ar", "he", "ur", "en", "hi", "bn", "mr", "ta", "te", "gu",
            "pa", "kn", "ml", "or", "ru", "zh", "ja", "es", "fr", "de", "pt", "id"];
        expect(all.filter(isRtlLang).sort()).toEqual(["ar", "he", "ur"]);
    });
});

describe("⚠️ the card actually reads that decision", () => {
    const screen = fs.readFileSync(
        path.join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");

    /** The crisis-card block, so assertions cannot pass on unrelated rows. */
    const card = (() => {
        const i = screen.indexOf("const rtl = isRtlLang(lang);");
        if (i < 0) throw new Error("the crisis card no longer derives direction from the card's language");
        const j = screen.indexOf("MemoMessageBubble", i);
        return screen.slice(i, j > i ? j : i + 6000);
    })();

    it("🔴 direction comes from the CARD's language, not a stored setting", () => {
        // If someone swaps this for I18nManager.isRTL, the card goes back to
        // obeying a setting the person never chose.
        expect(card).toMatch(/const rtl = isRtlLang\(lang\);/);
        expect(card).not.toMatch(/I18nManager/);
    });

    it("⛔ no row inside the card is hardcoded flexDirection: \"row\"", () => {
        // The exact shape of the bug: every row was "row", so nothing flipped.
        const hardcoded = [...card.matchAll(/flexDirection: "row"/g)];
        if (hardcoded.length) {
            throw new Error(
                `${hardcoded.length} row(s) in the crisis card still hardcode flexDirection: "row" — ` +
                `they will not flip for Arabic, Hebrew or Urdu`,
            );
        }
    });

    it("…and the rows use the derived direction", () => {
        // Header, the tier-1 call row, and the tier-2 resource rows.
        expect([...card.matchAll(/flexDirection: rowDir/g)].length).toBeGreaterThanOrEqual(3);
    });

    it("🔑 the title, body and footer carry textAlign and writingDirection", () => {
        // writingDirection alone is not enough — it orders the glyphs but does
        // not move the block to the right edge. Both are needed.
        expect([...card.matchAll(/textAlign, writingDirection/g)].length).toBeGreaterThanOrEqual(3);
    });

    it("⛔ the dismiss 'x' margin flips with the layout", () => {
        // It used to be a fixed marginLeft, which in a row-reverse layout puts
        // the gap on the wrong side of the button.
        expect(card).toMatch(/\.\.\.dismissMargin/);
        expect(card).not.toMatch(/dismissOpacity, marginLeft: 8/);
    });
});
