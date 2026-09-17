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
import { TIER_ORDER, isLicenseTier, fromWebTier, type LicenseTier } from "../licensing/featureGates";

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
        // PREMIUM removed 2026-09-17 — PLUS is canonical, matching the name
        // users see. PREMIUM survives as an alias, which is not optional: it is
        // in AsyncStorage on every device installed before that date.
        expect([...TIER_ORDER]).toEqual(["FREE", "PLUS", "FAMILY", "EDU", "ENTERPRISE"]);
    });

    it("isLicenseTier accepts every real tier and rejects the rest", () => {
        for (const t of TIER_ORDER) expect(isLicenseTier(t)).toBe(true);
        // "pro" is the WEB spelling of PREMIUM — it must not validate here.
        for (const bad of ["pro", "free", "PRO", "PREMIUM", "", null, undefined, 3, {}])
            expect(isLicenseTier(bad)).toBe(false);
    });

    it("🔗 every web tier maps to a real mobile tier", () => {
        // The web repo's TIER_ORDER, pinned. If a tier is added there and not
        // handled here, users on it silently drop to FREE on mobile — and a
        // mobile fix needs a store release, so it would stick.
        const WEB_TIERS = ["free", "plus", "pro", "family", "edu", "enterprise"];
        // jest has no per-assert message arg, so name the pair in the value.
        const mapped = WEB_TIERS.map((w) => `${w}->${fromWebTier(w)}`);
        expect(mapped).toEqual([
            "free->FREE", "plus->PLUS", "pro->PLUS",
            "family->FAMILY", "edu->EDU", "enterprise->ENTERPRISE",
        ]);
        // The rename that started all this: web "pro" IS mobile "PREMIUM".
        expect(fromWebTier("pro")).toBe("PLUS");
        expect(fromWebTier("plus")).toBe("PLUS");
    });

    it("🔗 the bridge accepts either spelling, and never invents a paid tier", () => {
        // Callers read tiers from two sources — the API (lowercase) and
        // AsyncStorage (uppercase) — and should not have to know which.
        expect(fromWebTier("PREMIUM")).toBe("PLUS");
        expect(fromWebTier("premium")).toBe("PLUS");
        expect(fromWebTier("  Pro  ")).toBe("PLUS");
        expect(fromWebTier("education")).toBe("EDU");
        // Anything unrecognised must fall to FREE. Never upward.
        for (const bad of ["", "gold", "PRO_PLUS", null, undefined, 7, {}])
            expect(fromWebTier(bad)).toBe("FREE");
    });

    it("🔴 no file hand-rolls the pro↔PREMIUM translation any more", () => {
        // It was written out six times: SettingsContext's if-chain plus five in
        // UpgradeSheet, some on API spellings and some on AsyncStorage
        // spellings, distinguishable only by a comment.
        const offenders = files.filter((f) => {
            const src = fs.readFileSync(f, "utf8").replace(/^[ \t]*\/\/.*$/gm, "");
            return /["']pro["']\s*\?\s*["']PREMIUM["']/.test(src)
                || /===\s*["']PREMIUM["']\s*\?\s*["']Pro["']/.test(src);
        });
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it("🔴 no file hardcodes a tier's display label", () => {
        // Stage C renames the paid tier to "Imotara Plus". TIER_LABELS must be
        // the only edit — these were `{isPro ? "Pro" : "Plus"}` and friends.
        const offenders = files.filter((f) => {
            const src = fs.readFileSync(f, "utf8").replace(/^[ \t]*\/\/.*$/gm, "");
            return /\?\s*["']Pro["']\s*:\s*["']Plus["']/.test(src);
        });
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });
});
