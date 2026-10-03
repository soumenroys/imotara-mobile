/**
 * A plan card must never show the hardcoded ₹ fallback as if it were the price.
 *
 * 🔴 WHY THIS EXISTS. `readStorePricing()` returns `{ regular: "₹<priceInr>",
 * fromStore: false }` whenever the store product has not arrived yet. That is
 * correct in India and wrong in the other ~174 markets, which since
 * 2026-10-02/03 pay the agreed purchasing-power band. A US reader opening the
 * upgrade sheet on a slow connection saw **₹149** before it settled to **$6.99**.
 *
 * 🔑 The credit packs already had this right — `f31a5e5` renders a pack only
 * once the store confirms it exists. Packs can disappear; a PLAN card cannot,
 * because it is the conversion surface. So the card stays and only the FIGURE
 * waits, showing "—" and "checking price…" until the store answers.
 *
 * ⚠️ The sub-lines matter as much as the headline. The annual breakdown
 * ("₹108/mo billed annually") and the introductory-offer note are both derived
 * from the same unresolved pricing, so both must also wait — otherwise the
 * headline says "—" while the line underneath still quotes rupees.
 *
 * ⚠️ SOURCE TEST ON PURPOSE. Rendering this needs expo-iap, a live store and a
 * slow network. What must hold is a property of the code.
 */
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "components", "imotara", "UpgradeSheet.tsx"), "utf8",
);
/** The comments quote the very pattern being pinned — strip them first. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("🔴 the plan price waits for the store", () => {
    it("derives a truth flag from fromStore, not from the string", () => {
        expect(CODE).toMatch(/const priceIsReal = pricing\.fromStore;/);
    });

    it("🔑 renders a placeholder, never the fallback, until the store answers", () => {
        expect(CODE).toMatch(/priceIsReal \? displayPrice : "—"/);
    });

    it("says why the figure is missing", () => {
        expect(CODE).toMatch(/checking price…/);
    });
});

describe("⚠️ the sub-lines wait too — a headline alone is not enough", () => {
    it("the annual ₹/month breakdown is gated on the real price", () => {
        expect(CODE).toMatch(/plan\.monthlyPriceInr && priceIsReal && displayPrice\.startsWith\("₹"\)/);
    });

    it("🔑 the intro-offer note is gated too", () => {
        // introNote() is computed from the same unresolved pricing object.
        expect(CODE).toMatch(/offerNote && priceIsReal \?/);
    });
});

describe("⛔ the guard must not be weakened back", () => {
    it("the bare fallback is no longer rendered unconditionally", () => {
        // ⚠️ Anchor on `priceIsReal`, NOT on a bare `fontSize: 22` — the
        // purchase-success block uses the same size and matched first, which is
        // why the first version of this test failed against correct code.
        const i = CODE.indexOf("const priceIsReal");
        expect(i).toBeGreaterThan(-1);
        const planBlock = CODE.slice(i, i + 3000);
        // the headline in the PLAN card must be the gated form
        expect(planBlock).toMatch(/priceIsReal \? displayPrice : "—"/);
        // and must not also render the raw fallback alongside it
        expect(planBlock).not.toMatch(/>\s*\{displayPrice\}\s*</);
    });

    it("packs keep their own stricter rule — they hide entirely", () => {
        // f31a5e5. Regression guard: the two rules must not be merged.
        expect(CODE).toMatch(/!!storeProduct\(storeSkuFor\(pack\.id\)\)/);
    });
});
