/**
 * Mobile's price list must agree with the web's, and with the stores.
 *
 * 🔴 WHY THIS EXISTS. Mobile carries its own copy of every price in PLAN_DEFS,
 * and the web repo carries another in PRODUCT_CATALOG. Two repos cannot import
 * each other, so nothing connected them — a Stage C reprice could easily land
 * on one side only.
 *
 * 🔴 AND THE ANDROID CASE IS THE DANGEROUS ONE. UpgradeSheet.tsx renders
 * `₹${plan.priceInr}` on Android — the number below, never Play Console. (iOS
 * calls iosPrice() and shows the real store price.) So on Android this file IS
 * what the user is quoted. Reprice in Play Console without shipping a matching
 * PLAN_DEFS and the app advertises one price while Play charges another.
 *
 * ⚠️ The literals here are duplicated in imotaraapp's pricingCatalog.test.ts ON
 * PURPOSE. They are the contract between the two repos. Change both, in the
 * same pass, in the same release.
 */
import fs from "fs";
import path from "path";
import {
    PLAN_DEFS,
    TOKEN_PACK_DEFS,
    ANDROID_SUBSCRIPTION_SKUS,
    IOS_SUBSCRIPTION_SKUS,
} from "../payments/upgradePlans";

const AGREED_PAISE: Record<string, number> = {
    // 🔄 FLIPPED 2026-09-25 — `plus_*` is the LIVE pair, `pro_*` retired.
    // Both pairs now carry the SAME amounts: the merged tier has one price, and
    // a retired SKU that somehow resolves must grant at that price, not an old one.
    plus_monthly:  14_900,
    plus_annual:   129_900,
    pro_monthly:   14_900,
    pro_annual:    129_900,
    tokens_100:    4_900,
    tokens_250:    9_900,
    tokens_600:    19_900,
    tokens_1800:   49_900,
};

describe("which pair is ON SALE", () => {
    // 🔴 WHY THIS EXISTS. The live and retired pairs were SWAPPED on 2026-09-25:
    // `plus_*` became the pair on sale, `pro_*` retired. Before that, nothing in
    // either repo asserted which was which — the only marker was a `retired`
    // flag and a comment, so an accidental re-flip would have passed every test
    // and quietly offered a retired SKU (or hidden the live one) in the sheet.
    //
    // This matters beyond tidiness: Play sells `plus_monthly`/`plus_annual` and
    // nothing else. If `plus_*` were marked retired again, UpgradeSheet's
    // `filter(p => !p.retired)` would offer Android users a SKU that does not
    // exist in Play, and the purchase would fail with "Store unavailable".

    it("the plans OFFERED are exactly plus_monthly and plus_annual", () => {
        const live = PLAN_DEFS.filter((p) => !p.retired).map((p) => p.id).sort();
        expect(live).toEqual(["plus_annual", "plus_monthly"]);
    });

    it("the RETIRED plans are exactly pro_monthly and pro_annual", () => {
        const retired = PLAN_DEFS.filter((p) => p.retired).map((p) => p.id).sort();
        expect(retired).toEqual(["pro_annual", "pro_monthly"]);
    });

    it("both pairs carry the same price — one merged tier, one price", () => {
        // A retired SKU that somehow resolves (an in-flight purchase, a restore)
        // must grant at the current price, not a pre-merge one.
        const by = (id: string) => PLAN_DEFS.find((p) => p.id === id)!;
        expect(by("pro_monthly").paise).toBe(by("plus_monthly").paise);
        expect(by("pro_annual").paise).toBe(by("plus_annual").paise);
    });

    it("every plan grants the one paid tier", () => {
        // There is no "pro" tier. The id is a historical string; the TIER is plus.
        for (const p of PLAN_DEFS) expect(p.tier).toBe("plus");
    });
});

describe("the mobile price list", () => {
    it("🔴 matches the amounts the web repo ships", () => {
        for (const p of PLAN_DEFS) expect(p.paise).toBe(AGREED_PAISE[p.id]);
        for (const t of TOKEN_PACK_DEFS) expect(t.paise).toBe(AGREED_PAISE[t.id]);
    });

    it("🔴 priceInr and paise agree — this is the number Android shows", () => {
        // A mismatch here means the app quotes one figure and charges another.
        for (const p of PLAN_DEFS) expect(p.priceInr * 100).toBe(p.paise);
        for (const t of TOKEN_PACK_DEFS) expect(t.priceInr * 100).toBe(t.paise);
    });

    it("covers every product, once", () => {
        const ids = [...PLAN_DEFS.map((p) => p.id), ...TOKEN_PACK_DEFS.map((t) => t.id)];
        expect(ids.sort()).toEqual(Object.keys(AGREED_PAISE).sort());
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("every plan has a store SKU on both platforms", () => {
        for (const p of PLAN_DEFS) {
            expect(ANDROID_SUBSCRIPTION_SKUS as readonly string[]).toContain(p.id);
            expect(IOS_SUBSCRIPTION_SKUS as readonly string[]).toContain(`com.imotara.imotara.${p.id}`);
        }
    });

    it("🔴 the header comment documents the prices this file actually sets", () => {
        // That comment is the instruction someone follows when creating the
        // products in App Store Connect and Play Console. If it drifts from
        // PLAN_DEFS, the consoles get configured to the wrong amount.
        const src = fs.readFileSync(path.join(__dirname, "..", "payments", "upgradePlans.ts"), "utf8");
        const header = src.slice(0, src.indexOf("export type PlanPeriod"));
        for (const p of PLAN_DEFS) {
            const unit = p.period === "monthly" ? "mo" : "yr";
            expect(header).toContain(`${p.id}`);
            expect(header.replace(/,/g, "")).toContain(`₹${p.priceInr}/${unit}`);
        }
    });
});
