/**
 * One reply, one script.
 *
 * The offline reply engine composes each message from several pools at once —
 * an opener, a validation, an extra. For eleven languages those pools were not
 * all in the same script, so every reply came out half transliterated. Caught
 * on a real phone 2026-09-12 with the network off:
 *
 *   "Hmm. Tumi thik jaygay esechho. Tumi ekhono eta r maazhkhane aacho, tai
 *    na? আমি এখনও তোমার সাথেই আছি এতে।"
 *
 * and in Hindi:
 *
 *   "Oh. Tumne sahi kiya baat karte hue. Thoda aur batao. जो सबसे भारी लग र…"
 *
 * Every Indic language in this engine is romanized, so hi and bn — the two
 * outliers — were transliterated to match rather than the other nine being
 * converted the other way. zh, ar, ru and he are wholly in their own scripts
 * and stay that way.
 *
 * This test derives the expectation from the file rather than hardcoding it:
 * whatever script a language uses, it must use that one everywhere.
 */
import fs from "fs";
import path from "path";

const src = fs.readFileSync(
    path.join(__dirname, "..", "lib", "ai", "local", "localReplyEngine.ts"), "utf8");

const SCRIPTS: Record<string, RegExp> = {
    Hi: /[ऀ-ॿ]/g, Mr: /[ऀ-ॿ]/g, Bn: /[ঀ-৿]/g,
    Ta: /[஀-௿]/g, Te: /[ఀ-౿]/g, Gu: /[઀-૿]/g,
    Pa: /[਀-੿]/g, Kn: /[ಀ-೿]/g, Ml: /[ഀ-ൿ]/g,
    Or: /[଀-୿]/g, Zh: /[一-鿿]/g, Ar: /[؀-ۿ]/g,
    Ur: /[؀-ۿ]/g, Ru: /[Ѐ-ӿ]/g, He: /[֐-׿]/g,
};

/** Every `const <name><Lang> = [...]` pool, classified by the script of its VALUES. */
function poolsFor(suffix: string): { name: string; script: "native" | "roman" }[] {
    const range = SCRIPTS[suffix];
    const out: { name: string; script: "native" | "roman" }[] = [];
    const decl = new RegExp(`const (\\w*?)${suffix}\\b[^=]*=\\s*([\\[{])`, "g");
    for (const m of src.matchAll(decl)) {
        const open = m.index! + m[0].length - 1;
        let depth = 0, body = "";
        for (let i = open; i < src.length; i++) {
            const c = src[i];
            if (c === "[" || c === "{") depth++;
            else if (c === "]" || c === "}") { if (--depth === 0) { body = src.slice(open, i + 1); break; } }
        }
        // Values only — key names like `sad:` are Latin and would skew small pools.
        const vals = [...body.matchAll(/`([^`]*)`/g), ...body.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
        const text = vals.join(" ");
        const native = (text.match(range) ?? []).length;
        const latin = (text.match(/[A-Za-z]/g) ?? []).length;
        if (native + latin < 10) continue;
        out.push({ name: m[1] + suffix, script: native > latin ? "native" : "roman" });
    }
    return out;
}

describe("a language never mixes scripts across its pools", () => {
    it.each(Object.keys(SCRIPTS))("%s", (lang) => {
        const pools = poolsFor(lang);
        if (pools.length === 0) return; // language not present in this engine
        const scripts = new Set(pools.map((p) => p.script));
        // On failure this prints which pools disagree, not just "expected 1".
        const detail = pools.map((p) => `${p.name}=${p.script}`).join(", ");
        expect(scripts.size === 1 ? "consistent" : detail).toBe("consistent");
    });

    it("finds pools at all — guards against the scan silently matching nothing", () => {
        expect(poolsFor("Bn").length).toBeGreaterThanOrEqual(5);
        expect(poolsFor("Hi").length).toBeGreaterThanOrEqual(5);
    });
});

describe("the specific strings captured on the phone are gone", () => {
    it("no longer carries the Bengali-script line that mixed into a roman reply", () => {
        expect(src).not.toContain("আমি এখনও তোমার সাথেই আছি এতে।");
    });
    it("no longer carries the Devanagari line that mixed into a roman reply", () => {
        expect(src).not.toContain("जो सबसे भारी लग रहा है");
    });
});

/**
 * The check above scans pools named `const <name><Lang>`. That is how the
 * first pass at this missed 142 more strings: three families — closureRepliesByLang,
 * contextBridge<Lang> and the `desc` shift sentences — are inline arrays that no
 * such name covers, and they were native script for every Indic language while
 * the named pools were romanized. So a reply still came out half-and-half after
 * the "fix".
 *
 * This one needs no names. Every Indic language in this engine is romanized, so
 * ANY Indic-script character inside a template literal is a mixing bug waiting
 * to happen, wherever it is declared. Detection regexes are matched on user
 * INPUT and stay in native script — they are /.../ literals, not backticked, so
 * they are correctly out of scope here.
 */
describe("no Indic script survives anywhere in reply text", () => {
    const INDIC: Record<string, RegExp> = {
        Devanagari: /[ऀ-ॿ]/, Bengali: /[ঀ-৿]/, Odia: /[଀-୿]/,
        Tamil: /[஀-௿]/, Telugu: /[ఀ-౿]/, Gujarati: /[઀-૿]/,
        Gurmukhi: /[਀-੿]/, Kannada: /[ಀ-೿]/, Malayalam: /[ഀ-ൿ]/,
    };
    const literals = [...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]);

    it("finds template literals at all", () => {
        expect(literals.length).toBeGreaterThan(200);
    });

    it.each(Object.entries(INDIC))("no %s in any reply string", (_name, re) => {
        const offenders = literals.filter((l) => re.test(l)).map((l) => l.slice(0, 60));
        expect(offenders).toEqual([]);
    });
});
