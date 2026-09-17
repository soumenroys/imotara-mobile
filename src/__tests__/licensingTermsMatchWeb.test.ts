/**
 * Mobile must call the licence tiers by exactly the same names as web — and
 * none of those names may be "Pro".
 *
 * 🔴 WHY THIS EXISTS. Owner, 2026-09-17: "do not say pro. only say plus. thats
 * all… i want web and mobile licensing terms exactly same".
 *
 * That confusion was earned in this repo especially: the SAME tier read "Pro"
 * on the Settings screen and "Premium" in the plan panel, from two prettyTier
 * functions that had drifted apart.
 *
 * ⚠️ AGREED_LABELS is duplicated in imotaraapp's copy of this test ON PURPOSE.
 * Two repos cannot import each other, so this pair of literals is the only
 * thing that can catch a rename applied to one side.
 */
import fs from "fs";
import path from "path";
import { TIER_LABELS, TIER_ORDER, prettyTier } from "../licensing/featureGates";

/** Keep byte-identical with the web copy. Values only — ids differ in case. */
const AGREED_LABELS = ["Free", "Plus", "Family", "Education", "Enterprise"];

const SRC = path.join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, out); }
        else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
}

describe("licensing terms are the same on both platforms", () => {
    it("🔗 the tier labels match web's, in order", () => {
        expect(TIER_ORDER.map((t) => TIER_LABELS[t])).toEqual(AGREED_LABELS);
    });

    it("🔴 every id for the paid tier reads 'Plus' — never 'Pro'", () => {
        // Including the ones stored on devices and the ones web sends.
        for (const id of ["PLUS", "PREMIUM", "premium", "pro", "plus", "PRO"]) {
            expect(prettyTier(id)).toBe("Plus");
        }
    });

    it("🔴 no user-visible string calls a plan 'Pro'", () => {
        // Comments may still explain the history. Only what reaches a screen counts.
        const allow = /Proof|Prometheus|Proverbs|Professional|Profile|Product|Process|Program|Provider|Property|Protocol|Progress|Promise|Prompt|Project|Probab|Proxy|Prop/;
        const offenders: string[] = [];
        for (const f of walk(SRC)) {
            if (f.includes("__tests__")) continue;
            const src = fs.readFileSync(f, "utf8")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/^[ \t]*\/\/.*$/gm, "");
            for (const m of src.matchAll(/\bPro\b(?!\w)/g)) {
                const around = src.slice(Math.max(0, m.index! - 12), m.index! + 14);
                if (!allow.test(around)) { offenders.push(path.relative(SRC, f)); break; }
            }
        }
        expect(offenders).toEqual([]);
    });

    it("the paid tier's id matches its name, so the two cannot drift again", () => {
        expect(TIER_ORDER).toContain("PLUS");
        expect(TIER_LABELS.PLUS).toBe("Plus");
        expect(TIER_ORDER).not.toContain("PREMIUM");
    });
});
