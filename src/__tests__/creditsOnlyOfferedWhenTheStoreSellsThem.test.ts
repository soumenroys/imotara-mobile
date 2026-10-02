/**
 * The upgrade sheet never advertises a product the store will not sell.
 *
 * 🔴 WHY THIS EXISTS — observed on a device, not theorised. On 2026-10-02, on an
 * Android emulator, the upgrade sheet offered four credit packs with prices:
 *
 *     100 credits ₹49 · 250 credits ₹99 · 600 credits ₹199 · 1,800 credits ₹499
 *
 * None of them existed in Play Console. The device's own Billing log said so:
 *
 *     fetchProductsAndroid payload: {"type":"in-app","skus":["tokens_100",…]}
 *     fetchProductsAndroid result:  []          <-- EMPTY
 *
 * …while the `subs` fetch in the same breath returned both plans. So tapping a
 * pack called requestPurchase() with a SKU Play has never heard of, and those
 * rupee figures were the hardcoded `priceInr` fallbacks from upgradePlans.ts
 * rather than store prices — storePricing.ts had nothing to read.
 *
 * 🔑 Advertising an unbuyable price is worse than offering nothing. The user
 * taps, it fails, and they conclude payment is broken — on the one screen where
 * that conclusion costs money.
 *
 * ⚠️ SOURCE TEST ON PURPOSE. Rendering UpgradeSheet needs expo-iap, navigation,
 * auth, Supabase and a dozen providers. What must hold is a property of the
 * code — "what is offered is derived from what the store returned" — and
 * asserting it on the source states it without a fragile harness.
 */
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "components", "imotara", "UpgradeSheet.tsx"),
    "utf8",
);

/** The comments here quote the very patterns being pinned — strip them first. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("🔴 credits are offered only when the store actually sells them", () => {
    it("derives the offer list from the store, not from the local catalogue", () => {
        expect(CODE).toMatch(/const sellableTokenPacks\s*=\s*TOKEN_PACK_DEFS\.filter/);
        // the filter must consult the STORE, not merely reshape the catalogue
        const i = CODE.indexOf("const sellableTokenPacks");
        expect(CODE.slice(i, i + 220)).toMatch(/storeProduct\(storeSkuFor\(pack\.id\)\)/);
    });

    it("🔴 renders the derived list — never the raw catalogue", () => {
        // This is the actual bug: TOKEN_PACK_DEFS.map() offered all four
        // regardless of what Play returned.
        expect(CODE).toMatch(/\{sellableTokenPacks\.map\(/);
        expect(CODE).not.toMatch(/\{TOKEN_PACK_DEFS\.map\(/);
    });

    it("🔑 hides the heading too when nothing is sellable", () => {
        // Leaving "Top up with message credits" above an empty row is its own
        // bug report.
        const i = CODE.indexOf("sellableTokenPacks.length > 0");
        expect(i).toBeGreaterThan(-1);
        const heading = CODE.indexOf("Top up with message credits");
        expect(heading).toBeGreaterThan(i);          // heading sits INSIDE the gate
        expect(heading - i).toBeLessThan(400);       // …and in the same block
    });

    it("⚠️ is a POSITIVE test, not a hide-on-known-empty", () => {
        // Hiding only when a list is known-empty flashes the section away after
        // a slow fetch. Asking "is it in the store?" means the section is simply
        // absent until the answer arrives, then appears.
        const i = CODE.indexOf("const sellableTokenPacks");
        const decl = CODE.slice(i, i + 220);
        expect(decl).toMatch(/!!storeProduct/);
        expect(decl).not.toMatch(/length === 0|!products\.length/);
    });
});

describe("the catalogue itself is unchanged — this is a display rule only", () => {
    it("all four packs still exist for restore and for iOS", () => {
        // ⛔ Never delete a SKU from the catalogue: store product ids can never
        // be reused, and an existing purchase must still restore.
        const plans = fs.readFileSync(
            path.join(__dirname, "..", "payments", "upgradePlans.ts"), "utf8",
        );
        for (const id of ["tokens_100", "tokens_250", "tokens_600", "tokens_1800"]) {
            expect(plans).toContain(id);
        }
    });
});
