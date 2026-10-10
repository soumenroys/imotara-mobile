/**
 * The crisis card must be READABLE by the person it appears for — on mobile.
 *
 * 🔴 THE BUG. ChatScreen passed
 * `lang={concreteLang(toneContext?.user?.preferredLang)}`:
 *   - `preferredLang` is the stored SETTING, which most people never set
 *   - `concreteLang` turns **"auto" into "en"** — a trap already documented
 *     elsewhere in this repo for exactly this class of failure
 * ⇒ the card appeared in ENGLISH, with an English helpline, no matter what the
 * person had just written.
 *
 * ⚠️ All 22 translations already existed in crisisCopy.ts and were unreachable.
 *
 * 🔑 This is the MOBILE twin of the web repo's crisisBannerSpeaksTheirLanguage
 * test, built from the same list and the same precedence. ⚠️ Two repos, no
 * shared package — edit one, run the other.
 *
 * ⛔ A failure here means someone who said they want to die is shown a helpline
 * in a language they may not read.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { crisisCardLangFor, hasCrisisCopy } from "../lib/safety/crisisCardLang";
import { getCrisisCopy, CRISIS_COPY_LANGS } from "../lib/safety/crisisCopy";

const resolve = (pref: string | null | undefined, ...texts: string[]) =>
    crisisCardLangFor(pref, texts);

/** Crisis phrases whose SCRIPT alone identifies the language. */
const BY_SCRIPT: Array<[string, string]> = [
    ["bn", "আমি মরতে চাই"],
    ["hi", "मैं मरना चाहता हूँ"],
    ["ta", "எனக்கு சாக வேண்டும்"],
    ["te", "నేను చనిపోవాలి"],
    ["gu", "મારે મરી જવું છે"],
    ["pa", "ਮੈਂ ਮਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ"],
    ["kn", "ನಾನು ಸಾಯಬೇಕು"],
    ["ml", "എനിക്ക് മരിക്കണം"],
    ["or", "ମୁଁ ବଞ୍ଚିବାକୁ ଚାହୁଁନାହିଁ"],
    ["ur", "میں مرنا چاہتا ہوں"],
    ["ar", "أريد أن أموت"],
    ["he", "אני רוצה למות"],
    ["ru", "я хочу умереть"],
    ["zh", "我想死"],
    ["ja", "死にたい"],
];

describe("🔴 someone who never set a language gets their OWN language", () => {
    it.each(BY_SCRIPT)("%s — the card speaks it", (lang, phrase) => {
        expect(resolve(null, phrase)).toBe(lang);
    });

    it("⛔ all 15 script-identifiable languages, counted", () => {
        const wrong = BY_SCRIPT.filter(([l, p]) => resolve(null, p) !== l).map(([l]) => l);
        expect(wrong).toEqual([]);
        expect(BY_SCRIPT).toHaveLength(15);
    });

    it("🔑 and the copy they see is really in that script", () => {
        const SCRIPTS: Record<string, RegExp> = {
            bn: /[ঀ-৿]/, hi: /[ऀ-ॿ]/, ta: /[஀-௿]/,
            ar: /[؀-ۿ]/, he: /[֐-׿]/, ru: /[Ѐ-ӿ]/,
            zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/,
        };
        for (const [lang, re] of Object.entries(SCRIPTS)) {
            const picked = resolve(null, BY_SCRIPT.find(([l]) => l === lang)![1]);
            const copy = getCrisisCopy(picked);
            const text = `${copy.t1Title} ${copy.t2Title ?? ""}`;
            if (!re.test(text)) {
                throw new Error(`${lang}: resolved to "${picked}" but its copy is not in that script`);
            }
        }
    });
});

describe("🔴 'auto' is the whole bug — it must NOT mean English", () => {
    it("auto + Bengali script ⇒ Bengali, not English", () => {
        // concreteLang("auto") === "en" is what broke this.
        expect(resolve("auto", "আমি মরতে চাই")).toBe("bn");
    });

    it("undefined + Hindi script ⇒ Hindi", () => {
        expect(resolve(undefined, "मैं मरना चाहता हूँ")).toBe("hi");
    });

    it("empty string + Arabic script ⇒ Arabic", () => {
        expect(resolve("", "أريد أن أموت")).toBe("ar");
    });

    it("⛔ ChatScreen no longer routes the card through concreteLang", () => {
        const src = fs.readFileSync(
            path.join(process.cwd(), "src/screens/ChatScreen.tsx"), "utf8");
        expect(src).not.toMatch(/lang=\{concreteLang\(/);
        expect(src).toMatch(/lang=\{crisisCardLangFor\(/);
        // …and it is fed the USER's recent messages, not the bot's
        const i = src.indexOf("lang={crisisCardLangFor(");
        expect(src.slice(i, i + 300)).toMatch(/m\.from === "user"/);
    });
});

describe("⛔ a stated choice still wins — they asked for it", () => {
    it("English chosen, Bengali typed ⇒ English", () => {
        expect(resolve("en", "আমি মরতে চাই")).toBe("en");
    });

    it("Hindi chosen, English typed ⇒ Hindi", () => {
        expect(resolve("hi", "I want to die")).toBe("hi");
    });

    it("a BCP-47 choice is reduced to its base", () => {
        expect(resolve("bn-IN", "I want to die")).toBe("bn");
    });
});

describe("⚖️ the honest limits", () => {
    it("⚠️ es/fr/de/pt/id get English — no detector exists for them", () => {
        // ⛔ NOT an assertion that this is fine. Latin script, no roman hints.
        for (const p of ["quiero morir", "je veux mourir", "ich will sterben",
                         "quero morrer", "saya ingin mati"]) {
            expect(resolve(null, p)).toBe("en");
        }
    });

    it("…but if they HAVE set it, those five work", () => {
        for (const l of ["es", "fr", "de", "pt", "id"]) {
            expect(resolve(l, "quiero morir")).toBe(l);
        }
    });

    it("no messages ⇒ English, unchanged", () => {
        expect(resolve(null)).toBe("en");
        expect(resolve(null, "", "  ")).toBe("en");
    });

    it("the MOST RECENT message decides", () => {
        expect(resolve(null, "আমি মরতে চাই", "我想死")).toBe("zh");
    });
});

describe("⚠️ the premise, pinned", () => {
    it("all 22 languages really do have crisis copy", () => {
        const APP = "en hi bn mr ta te gu pa kn ml or ur ar he ru zh ja es fr de pt id".split(" ");
        const missing = APP.filter((l) => !CRISIS_COPY_LANGS.includes(l));
        expect(missing).toEqual([]);
    });

    it("hasCrisisCopy agrees with the copy table", () => {
        expect(hasCrisisCopy("bn")).toBe(true);
        expect(hasCrisisCopy("bn-IN")).toBe(true);
        expect(hasCrisisCopy("xx")).toBe(false);
        expect(hasCrisisCopy(null)).toBe(false);
    });
});

describe("🔑 ROMANISED Indic — Latin letters, not an English speaker", () => {
    /**
     * ⚠️ ADDED AFTER MUTATION TESTING. Deleting the roman-hints branch
     * entirely SURVIVED the first version of this file: every case I had
     * written was either native script or a stated choice, so the branch was
     * never executed. A test suite that cannot tell whether a branch exists is
     * not testing it.
     *
     * 🔴 These people matter most here: someone typing "ami marte chai" on a
     * phone keyboard has no Bengali script available, and under the old code
     * got an English helpline.
     */
    it.each([
        ["bn", "ami marte chai"],
        ["mr", "mala khup tras hotoy"],
        ["ta", "enakku romba kashtam"],
        ["te", "naku chala badha ga undi"],
        ["hi", "mujhe bahut akela lagta hai"],
        ["gu", "hun bahu dukhi chu"],
    ])("%s in Latin letters resolves to %s", (lang, phrase) => {
        expect(resolve(null, phrase)).toBe(lang);
    });

    it("⛔ dropping the romanised branch must FAIL this file", () => {
        // The explicit guard. If every assertion above were native-script,
        // removing the branch would pass silently — which it did.
        expect(resolve(null, "ami marte chai")).toBe("bn");
        expect(resolve(null, "ami marte chai")).not.toBe("en");
    });

    it("⚠️ native script still OUTRANKS a romanised hint", () => {
        // Most recent wins, and script is checked before roman hints.
        expect(resolve(null, "ami marte chai", "\u6211\u60f3\u6b7b")).toBe("zh");
    });
});

describe("⚠️ the 'auto' guard is an EQUIVALENT MUTANT — recorded, not faked", () => {
    it("'auto' must never become a crisis-copy language", () => {
        // 🔑 Removing `stated !== "auto"` changes nothing today, because
        // hasCrisisCopy("auto") is already false — so no test can catch that
        // mutation, and contriving one would be theatre.
        //
        // ⛔ The guard still earns its place: the day someone adds an `auto`
        // entry to crisisCopy.ts, "auto" becomes selectable and a person who
        // chose nothing gets whatever that entry says instead of their own
        // script. THIS assertion is what fails then.
        expect(CRISIS_COPY_LANGS).not.toContain("auto");
        expect(hasCrisisCopy("auto")).toBe(false);
    });
});
