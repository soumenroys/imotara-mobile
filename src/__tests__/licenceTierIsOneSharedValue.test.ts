/**
 * The licence tier is ONE value, and every copy hears about changes.
 *
 * 🔴 WHY THIS EXISTS — observed on a device, not theorised. On 2026-10-02, on an
 * emulator signed in as a Plus user, two parts of the SAME screen disagreed at
 * the SAME moment:
 *
 *     chat header plan badge  →  "Free"
 *     upgrade sheet           →  "Current plan: Plus"
 *
 * There were two independent copies of the tier, communicating through
 * AsyncStorage:
 *
 *   • HistoryContext kept `useState<LicenseTier>("FREE")` and read
 *     `imotara_license_tier_v1` ONCE, during hydration.
 *   • SettingsContext.refreshLicense() fetched /api/license/status and WROTE
 *     that same key afterwards.
 *
 * ⚠️ AsyncStorage is a key-value store, not an event bus. Nothing told
 * HistoryContext to read it again. On a fresh install the key does not exist
 * yet, so its copy latched on "FREE" and stayed there for the whole session.
 *
 * 🔴 AND IT WAS NOT COSMETIC. HistoryContext runs the HISTORY_DAYS_LIMIT
 * retention effect off that same stale value, so a Plus user displayed as Free
 * also had local history pruned to the free window.
 *
 * 🔑 Same family as the web bug fixed the night before (eight copies there,
 * two here) — see imotaraapp `src/lib/imotara/licenseStore.ts`.
 */
import {
    publishLicenseTier,
    subscribeLicenseTier,
    getPublishedLicenseTier,
    __resetLicenseTierStoreForTests,
} from "../licensing/licenseTierStore";
import fs from "fs";
import path from "path";

beforeEach(() => { __resetLicenseTierStoreForTests(); });

// ── The store's behaviour ────────────────────────────────────────────────────

describe("🔴 one tier, broadcast to every copy", () => {
    it("a subscriber hears a published tier", () => {
        const seen: string[] = [];
        subscribeLicenseTier((t) => seen.push(t));
        publishLicenseTier("PLUS");
        expect(seen).toEqual(["PLUS"]);
    });

    it("🔴 EVERY subscriber hears it — not just the first", () => {
        // The bug was one copy updating while another did not.
        const a: string[] = [];
        const b: string[] = [];
        subscribeLicenseTier((t) => a.push(t));
        subscribeLicenseTier((t) => b.push(t));
        publishLicenseTier("PLUS");
        expect(a).toEqual(["PLUS"]);
        expect(b).toEqual(["PLUS"]);
    });

    it("🔑 a LATE subscriber is told the current tier immediately", () => {
        // Without this, a consumer mounting after the refresh has already landed
        // sits on its stale default until the NEXT change — which is the
        // original bug wearing a different hat.
        publishLicenseTier("PLUS");
        const seen: string[] = [];
        subscribeLicenseTier((t) => seen.push(t));
        expect(seen).toEqual(["PLUS"]);
    });

    it("reports nothing before anything has been published", () => {
        expect(getPublishedLicenseTier()).toBeNull();
    });

    it("unsubscribing stops delivery", () => {
        const seen: string[] = [];
        const off = subscribeLicenseTier((t) => seen.push(t));
        off();
        publishLicenseTier("PLUS");
        expect(seen).toEqual([]);
    });

    it("🔑 one throwing subscriber cannot stop the others updating", () => {
        // A copy that fails to render must not freeze the rest on a stale tier.
        const seen: string[] = [];
        subscribeLicenseTier(() => { throw new Error("boom"); });
        subscribeLicenseTier((t) => seen.push(t));
        expect(() => publishLicenseTier("PLUS")).not.toThrow();
        expect(seen).toEqual(["PLUS"]);
    });

    it("⚠️ does NOT persist — AsyncStorage stays the one writer", () => {
        // Two things writing the same key is how this bug started.
        const src = fs.readFileSync(
            path.join(__dirname, "..", "licensing", "licenseTierStore.ts"), "utf8",
        ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
        expect(src).not.toMatch(/AsyncStorage/);
    });
});

// ── The wiring. Source assertions: these are structural guarantees. ──────────

const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("🔴 both ends are actually wired", () => {
    it("SettingsContext PUBLISHES after it writes the tier it fetched", () => {
        const src = read("state/SettingsContext.tsx");
        const write = src.indexOf("AsyncStorage.setItem(LICENSE_TIER_KEY, mobileTier)");
        const pub = src.indexOf("publishLicenseTier(mobileTier)");
        expect(write).toBeGreaterThan(-1);
        expect(pub).toBeGreaterThan(write);   // announced, and after the write
    });

    it("SettingsContext also announces the tier it hydrated at cold start", () => {
        expect(read("state/SettingsContext.tsx")).toMatch(/publishLicenseTier\(localTier\)/);
    });

    it("🔴 HistoryContext SUBSCRIBES — the piece that was missing", () => {
        const src = read("state/HistoryContext.tsx");
        expect(src).toMatch(/subscribeLicenseTier\(/);
        // and it must feed the state the header renders from
        expect(src).toMatch(/subscribeLicenseTier\(\(tier\) => \{[\s\S]{0,200}_setLicenseTier\(/);
    });

    it("🔑 HistoryContext's own setter publishes too, so copies cannot diverge", () => {
        const src = read("state/HistoryContext.tsx");
        const i = src.indexOf("const setLicenseTier = useCallback");
        expect(i).toBeGreaterThan(-1);
        expect(src.slice(i, i + 400)).toMatch(/publishLicenseTier\(tier\)/);
    });

    it("⚠️ the subscription normalises — legacy PREMIUM must still become PLUS", () => {
        // Every device installed before the 2026-09-17 rename stores "PREMIUM".
        const src = read("state/HistoryContext.tsx");
        const i = src.indexOf("subscribeLicenseTier(");
        expect(src.slice(i, i + 300)).toMatch(/normaliseTier\(tier\)/);
    });
});
