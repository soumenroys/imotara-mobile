/**
 * Every mobile tier enumeration must derive from TIER_ORDER.
 *
 * 🔴 WHY THIS EXISTS. On 2026-09-17 the web repo was found to have seven
 * hardcoded tier lists, four of which had silently lost "family" — which made
 * Family licence pools unissuable through the admin panel. This repo had five
 * copies of its own list (HistoryContext, SettingsContext, SettingsScreen,
 * ChatScreen, PlanSupportQuickPanel). All five still agreed, so nothing was
 * broken here yet — but five copies is the same bug waiting to happen, and on
 * mobile it is worse: a fix only reaches users through a store release, and
 * anyone who never updates keeps the broken copy forever.
 *
 * ⚠️ These are the MOBILE spellings (PREMIUM, not pro). The web repo has its
 * own TIER_ORDER in lowercase; SettingsContext.tsx is the single place the two
 * vocabularies are bridged.
 */
import fs from "fs";
import path from "path";
import { TIER_ORDER, isLicenseTier, type LicenseTier } from "../licensing/featureGates";

const SRC = path.join(__dirname, "..");
const CANONICAL = path.join(SRC, "licensing", "featureGates.ts");

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, out); }
        else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
}

const files = walk(SRC).filter(
    (f) => f !== CANONICAL && !f.includes("__tests__") && !/\.test\.tsx?$/.test(f),
);

describe("TIER_ORDER is the only mobile tier list", () => {
    it("🔴 no file hand-writes an array of tier names", () => {
        const offenders = files.filter((f) =>
            /\[[^\]]*"FREE"[^\]]*"ENTERPRISE"[^\]]*\]/s.test(fs.readFileSync(f, "utf8")),
        );
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it("🔴 no file re-types the tier union", () => {
        const offenders = files.filter((f) =>
            /"FREE"\s*\|(?:[^;\n]*\|)?\s*"ENTERPRISE"/.test(fs.readFileSync(f, "utf8")),
        );
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it("🔴 no file re-implements the validator as a chain of === comparisons", () => {
        // This is how HistoryContext and SettingsContext each carried a copy:
        // `v === "FREE" || v === "PLUS" || ...`, duplicated verbatim.
        const offenders = files.filter((f) =>
            /===\s*"FREE"[\s\S]{0,200}===\s*"ENTERPRISE"/.test(fs.readFileSync(f, "utf8")),
        );
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it("carries every tier, in the mobile spelling", () => {
        expect([...TIER_ORDER]).toEqual(["FREE", "PLUS", "PREMIUM", "FAMILY", "EDU", "ENTERPRISE"]);
    });

    it("isLicenseTier accepts every real tier and rejects the rest", () => {
        for (const t of TIER_ORDER) expect(isLicenseTier(t)).toBe(true);
        // "pro" is the WEB spelling of PREMIUM — it must not validate here.
        for (const bad of ["pro", "free", "PRO", "", null, undefined, 3, {}])
            expect(isLicenseTier(bad)).toBe(false);
    });

    it("the web↔mobile bridge still maps every web tier to a real mobile tier", () => {
        // SettingsContext.tsx:~330 is the ONLY translation point between the
        // two vocabularies. If it ever maps to a tier this list does not have,
        // the user silently drops to FREE.
        const bridge = fs.readFileSync(path.join(SRC, "state", "SettingsContext.tsx"), "utf8");
        const mapped = Array.from(bridge.matchAll(/\?\s*"([A-Z]+)"\s*:/g)).map((m) => m[1]);
        expect(mapped.length).toBeGreaterThan(0);
        for (const t of mapped) expect(TIER_ORDER).toContain(t as LicenseTier);
    });
});
