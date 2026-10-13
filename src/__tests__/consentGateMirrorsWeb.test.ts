import fs from "fs";
import path from "path";
import { CONSENT_COPY_BY_LANG, getConsentCopy, MINIMUM_AGE } from "../lib/legal/consentCopy";
// ⚠️ Mobile exports CRISIS_COPY_LANGS; the web twin of this file imports
// CRISIS_BANNER_BY_LANG. The two repos name the crisis copy differently —
// same facts, different export. Do not "fix" one to match the other without
// checking every call site in that repo.
import { CRISIS_COPY_LANGS } from "../lib/safety/crisisCopy";
import {
    TERMS_VERSION,
    buildAcceptance,
    hasAcceptedCurrentTerms,
    parseAcceptance,
} from "../lib/legal/termsVersion";

// The web repo, if it is checked out beside this one. Drift between the two is
// the failure this file exists to catch, but a mobile CI box may not have it.
const WEB_LEGAL = path.resolve(__dirname, "../../../imotaraapp/src/lib/legal");
const webAvailable = fs.existsSync(WEB_LEGAL);

describe("the consent gate speaks every language the crisis card does", () => {
    it("covers exactly the crisis card's language set", () => {
        expect(Object.keys(CONSENT_COPY_BY_LANG).sort()).toEqual(
            [...CRISIS_COPY_LANGS].sort(),
        );
    });

    it("has no empty string, and keeps both link placeholders, in every language", () => {
        // ⚠️ jest's expect() takes ONE argument — vitest's 2nd "message" arg
        // throws here. Offenders are collected so a failure still names the
        // language instead of just saying false !== true.
        const empty: string[] = [];
        const noPlaceholder: string[] = [];
        for (const [lang, copy] of Object.entries(CONSENT_COPY_BY_LANG)) {
            for (const [field, value] of Object.entries(copy)) {
                if (!value.trim()) empty.push(`${lang}.${field}`);
            }
            if (!copy.agree.includes("{terms}")) noPlaceholder.push(`${lang}:{terms}`);
            if (!copy.agree.includes("{privacy}")) noPlaceholder.push(`${lang}:{privacy}`);
        }
        expect(empty).toEqual([]);
        expect(noPlaceholder).toEqual([]);
    });

    it("⛔ keeps the DISCLAIMER in every language, not just the warm line", () => {
        // If a translation ever carried the warm line but lost `body`, the gate
        // would be pure marketing in that language — silently, and only for
        // non-English speakers.
        const missing: string[] = [];
        for (const [lang, copy] of Object.entries(CONSENT_COPY_BY_LANG)) {
            if (!copy.warm.trim()) missing.push(`${lang}:warm`);
            if (!copy.body.trim()) missing.push(`${lang}:disclaimer`);
            if (!copy.emergencyLead.trim()) missing.push(`${lang}:emergency`);
        }
        expect(missing).toEqual([]);
    });

    it("states the minimum age in every translation", () => {
        const ageless = Object.entries(CONSENT_COPY_BY_LANG)
            .filter(([, copy]) =>
                !copy.agree.includes(String(MINIMUM_AGE)) &&
                !copy.agree.includes("\u0b67\u0b6e") &&   // Odia 18
                !copy.agree.includes("\u09e7\u09ee"))     // Bengali 18
            .map(([lang]) => lang);
        expect(ageless).toEqual([]);
    });

    it("never collapses an unknown language or 'auto' into a throw", () => {
        expect(getConsentCopy("auto")).toBe(CONSENT_COPY_BY_LANG.en);
        expect(getConsentCopy(null)).toBe(CONSENT_COPY_BY_LANG.en);
        expect(getConsentCopy("ar-EG")).toBe(CONSENT_COPY_BY_LANG.ar);
    });
});

describe("an acceptance record is only good for the version it names", () => {
    it("accepts current, rejects stale, rejects nothing", () => {
        expect(hasAcceptedCurrentTerms(buildAcceptance("ios", "bn"))).toBe(true);
        expect(
            hasAcceptedCurrentTerms({ ...buildAcceptance("android", "en"), version: "2020-01-01" }),
        ).toBe(false);
        expect(hasAcceptedCurrentTerms(null)).toBe(false);
    });

    it("records the platform it was accepted on", () => {
        expect(buildAcceptance("ios", "ta").surface).toBe("ios");
        expect(buildAcceptance("android", "ta").surface).toBe("android");
    });

    it("survives corrupt storage", () => {
        expect(parseAcceptance("not json")).toBeNull();
        expect(parseAcceptance(null)).toBeNull();
    });
});

describe("⛔ mobile and web must not drift apart", () => {
    const maybe = webAvailable ? it : it.skip;

    maybe("the consent copy is byte-identical to the web repo's", () => {
        // The gate must say exactly the same thing on every platform: someone
        // who accepted "18 or older" on a phone must have accepted the same
        // sentence they would have on the web. The mobile file carries a MIRROR
        // header above the copied content, so compare from the first line of
        // real code onwards.
        const strip = (s: string) => s.slice(s.indexOf("// src/lib/legal/"));
        const web = fs.readFileSync(path.join(WEB_LEGAL, "consentCopy.ts"), "utf8");
        const mobile = fs.readFileSync(
            path.resolve(__dirname, "../lib/legal/consentCopy.ts"), "utf8");
        expect(strip(mobile)).toBe(strip(web));
    });

    maybe("the terms VERSION is the same on both platforms", () => {
        // A version skew would mean one platform silently re-prompting while
        // the other does not, and acceptance records that cannot be compared.
        const web = fs.readFileSync(path.join(WEB_LEGAL, "termsVersion.ts"), "utf8");
        const m = web.match(/TERMS_VERSION\s*=\s*"([^"]+)"/);
        expect(m).not.toBeNull();
        expect(TERMS_VERSION).toBe(m ? m[1] : null);
    });
});
