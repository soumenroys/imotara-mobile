// src/lib/safety/crisisCardLang.ts
/**
 * Which language the CRISIS CARD must speak.
 *
 * 🔴 THE BUG THIS REPLACES. ChatScreen passed
 * `lang={concreteLang(toneContext?.user?.preferredLang)}` — the person's stored
 * SETTING, run through `concreteLang`, which is itself a documented trap:
 * it turns **"auto" into "en"**. So anyone who never picked a language — which
 * is most people, and overwhelmingly the ones who most need the card — got the
 * crisis card in ENGLISH, with an English helpline, no matter what they had
 * just written.
 *
 * ⚠️ All 22 translations already existed in crisisCopy.ts. They were
 * unreachable. Measured on the web side the same day: 12 of 12 languages
 * resolved to English, including Bengali and Hindi, whose scripts are
 * unambiguous.
 *
 * 🔑 THE FIX IS THE SAME SHAPE AS THE WEB'S `crisisBannerLangFor`, deliberately:
 * a stated choice wins, otherwise the SCRIPT of what they actually wrote, then
 * romanised Indic hints, then English. ⛔ Do not reorder — someone who CHOSE
 * English while typing Bengali script gets English, because they asked for it.
 *
 * ⚖️ es/fr/de/pt/id still fall back to English: they share the Latin script and
 * there is no detector for them. A known gap, recorded rather than hidden.
 */
import { detectLangFromScript, detectLangFromRomanHints } from "../../api/aiClient";
import { CRISIS_COPY_LANGS } from "./crisisCopy";

const HAS_COPY = new Set(CRISIS_COPY_LANGS);

/** Is `lang` one of the languages the crisis card can actually speak? */
export function hasCrisisCopy(lang: string | undefined | null): boolean {
    if (!lang) return false;
    return HAS_COPY.has(lang.toLowerCase().split(/[-_]/)[0]);
}

/**
 * @param preferredLang the person's stored choice — may be undefined or "auto"
 * @param recentTexts   their recent messages, OLDEST first
 */
export function crisisCardLangFor(
    preferredLang: string | undefined | null,
    recentTexts: readonly string[] = [],
): string {
    // 1. A stated choice wins — they picked it.
    //    ⛔ "auto" is NOT a choice. Treating it as one is the whole bug:
    //    concreteLang("auto") === "en".
    const stated = (preferredLang ?? "").trim().toLowerCase();
    if (stated && stated !== "auto" && hasCrisisCopy(stated)) {
        return stated.split(/[-_]/)[0];
    }

    // 2. The script of what they wrote, most recent first.
    //    detectLangFromScript returns "en" when it recognises nothing, so an
    //    "en" result here is "no script detected", not evidence of English.
    for (let i = recentTexts.length - 1; i >= 0; i--) {
        const fromScript = detectLangFromScript(recentTexts[i] ?? "");
        if (fromScript && fromScript !== "en" && hasCrisisCopy(fromScript)) return fromScript;
    }

    // 3. Romanised Indic — "ami marte chai" is Bengali, in Latin letters.
    for (let i = recentTexts.length - 1; i >= 0; i--) {
        const fromRoman = detectLangFromRomanHints(recentTexts[i] ?? "");
        if (fromRoman && fromRoman !== "en" && hasCrisisCopy(fromRoman)) return fromRoman;
    }

    // 4. Nothing to go on — the same answer as before this function existed.
    return "en";
}
