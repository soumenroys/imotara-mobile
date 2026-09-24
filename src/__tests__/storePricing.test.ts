/**
 * Reading a price out of Play and StoreKit.
 *
 * 🔴 WHY THIS EXISTS. Between 2026-09-25 and this commit the reader took
 * `pricingPhaseList[0]` — the FIRST pricing phase. That is correct only while no
 * introductory offer exists. Play's introductory offers were approved on
 * 2026-09-24 and configuring one would have made phase[0] the 7-day trial, so
 * every Android plan card would have advertised **"Free"** as the plan's price
 * and then charged ₹149. It was never seen in the wild only because Play had no
 * products at all until 2026-09-25.
 *
 * The fixtures below are the shapes Play and StoreKit actually return. The
 * headline assertion is the one that would have caught it:
 * `a subscription WITH a free trial still shows the recurring price`.
 */
import { readStorePricing, humanPeriod, introNote } from "../payments/storePricing";

/** A Play subscription. `phases` is ordered: introductory first, recurring last. */
const play = (phases: Array<{ formattedPrice: string; priceAmountMicros: number; billingPeriod: string }>) => ({
    id: "plus_annual",
    subscriptionOfferDetails: [
        { basePlanId: "annual", offerId: null, offerToken: "tok", pricingPhases: { pricingPhaseList: phases } },
    ],
});

const RECURRING_YEAR = { formattedPrice: "₹1,299.00", priceAmountMicros: 1_299_000_000, billingPeriod: "P1Y" };
const FREE_WEEK      = { formattedPrice: "Free",      priceAmountMicros: 0,             billingPeriod: "P7D" };
const CHEAP_YEAR     = { formattedPrice: "₹649.00",   priceAmountMicros:   649_000_000, billingPeriod: "P1Y" };

describe("Play subscriptions", () => {
    it("with no offer, the single phase is the price", () => {
        const p = readStorePricing(play([RECURRING_YEAR]), 1299);
        expect(p.regular).toBe("₹1,299.00");
        expect(p.intro).toBeUndefined();
        expect(p.fromStore).toBe(true);
    });

    it("🔴 with a FREE TRIAL, still shows the recurring price — not 'Free'", () => {
        // THE REGRESSION. Reading phase[0] returns "Free" here.
        const p = readStorePricing(play([FREE_WEEK, RECURRING_YEAR]), 1299);
        expect(p.regular).toBe("₹1,299.00");
        expect(p.regular).not.toBe("Free");
        expect(p.intro).toBe("Free");
        expect(p.introIsFree).toBe(true);
        expect(p.introPeriod).toBe("P7D");
    });

    it("🔴 with a DISCOUNTED first year, still shows the recurring price", () => {
        const p = readStorePricing(play([CHEAP_YEAR, RECURRING_YEAR]), 1299);
        expect(p.regular).toBe("₹1,299.00");
        expect(p.intro).toBe("₹649.00");
        expect(p.introIsFree).toBe(false);
    });

    it("picks the offer that HAS an intro, not merely the first one listed", () => {
        // Play lists the base plan and the offers; order is not guaranteed, and
        // taking offers[0] blindly would hide an offer the user is eligible for.
        const product = {
            id: "plus_annual",
            subscriptionOfferDetails: [
                { basePlanId: "annual", offerId: null, pricingPhases: { pricingPhaseList: [RECURRING_YEAR] } },
                { basePlanId: "annual", offerId: "intro", pricingPhases: { pricingPhaseList: [FREE_WEEK, RECURRING_YEAR] } },
            ],
        };
        const p = readStorePricing(product, 1299);
        expect(p.regular).toBe("₹1,299.00");
        expect(p.intro).toBe("Free");
    });

    it("a free trial is detected by MICROS, never by the word 'Free'", () => {
        // Play localises it — "Gratis", "Gratuit", "বিনামূল্যে".
        const p = readStorePricing(play([{ ...FREE_WEEK, formattedPrice: "Gratuit" }, RECURRING_YEAR]), 1299);
        expect(p.introIsFree).toBe(true);
        expect(introNote(p)).toBe("Free for the first 7 days, then ₹1,299.00");
    });
});

describe("iOS / StoreKit, and one-time products", () => {
    it("a token pack uses displayPrice", () => {
        const p = readStorePricing({ id: "tokens_250", displayPrice: "$2.99" }, 99);
        expect(p).toMatchObject({ regular: "$2.99", fromStore: true });
        expect(p.intro).toBeUndefined();
    });

    it("an introductory offer is read when expo-iap surfaces one", () => {
        const p = readStorePricing(
            { displayPrice: "$59.99", introductoryPrice: { displayPrice: "$29.99", price: 29.99, periodIso: "P1Y" } },
            1299,
        );
        expect(p.regular).toBe("$59.99");
        expect(introNote(p)).toBe("$29.99 for the first year, then $59.99");
    });

    it("an unrecognised intro shape is ignored rather than guessed at", () => {
        // ⚠️ The iOS field name is unverified on device. Wrong shape must mean
        // "no offer line", never a wrong headline price.
        const p = readStorePricing({ displayPrice: "$59.99", introductoryOffer: { mystery: 1 } }, 1299);
        expect(p.regular).toBe("$59.99");
        expect(introNote(p)).toBeUndefined();
    });
});

describe("when the store gives us nothing", () => {
    it.each([[null], [undefined], [{}], [{ id: "x", subscriptionOfferDetails: [] }]])(
        "falls back to rupees and says so (%#)",
        (product) => {
            const p = readStorePricing(product as any, 1299);
            expect(p).toEqual({ regular: "₹1299", fromStore: false });
        },
    );

    it("an offer with an empty phase list does not crash or return ''", () => {
        const p = readStorePricing(play([]), 1299);
        expect(p.regular).toBe("₹1299");
        expect(p.fromStore).toBe(false);
    });
});

describe("the offer line", () => {
    it.each([
        ["P7D", "the first 7 days"],
        ["P1W", "the first week"],
        ["P1M", "the first month"],
        ["P3M", "the first 3 months"],
        ["P1Y", "the first year"],
    ])("%s reads as %s", (iso, text) => expect(humanPeriod(iso)).toBe(text));

    it("an unknown period is dropped, not printed raw", () => {
        expect(humanPeriod("P2W3D")).toBeUndefined();
        expect(humanPeriod(undefined)).toBeUndefined();
        const p = readStorePricing(play([{ ...CHEAP_YEAR, billingPeriod: "P2W3D" }, RECURRING_YEAR]), 1299);
        expect(introNote(p)).toBe("₹649.00 to start, then ₹1,299.00");
    });

    it("is absent when there is no offer — no empty string to render", () => {
        expect(introNote(readStorePricing(play([RECURRING_YEAR]), 1299))).toBeUndefined();
    });

    it("🔴 always names the RECURRING price, so nobody reads the intro as the plan's price", () => {
        for (const phases of [[FREE_WEEK, RECURRING_YEAR], [CHEAP_YEAR, RECURRING_YEAR]]) {
            expect(introNote(readStorePricing(play(phases), 1299))).toContain("then ₹1,299.00");
        }
    });
});

/**
 * 🔴 THE KEY THE STORE IS ASKED BY.
 *
 * Apple knows the product as `com.imotara.imotara.plus_monthly`; **Play knows it
 * as `plus_monthly`**. Product ids are immutable in both consoles, so this split
 * is permanent.
 *
 * The upgrade sheet built the PREFIXED form unconditionally and used it to look
 * the product up in the store's response. On Android that key matches nothing
 * Play returned, so the lookup fell through to the hardcoded `₹` price from
 * PLAN_DEFS — the exact bug that reading the store was meant to fix.
 *
 * It failed SILENTLY, because the fallback is a plausible-looking price. A US
 * Android user would have seen "₹149" while Play charged $6.99. Every existing
 * test passed: they checked that the call went through the store reader, not
 * that it asked for a key the store would recognise.
 *
 * Purchase was never affected — `handlePlanPress` already passed the bare id to
 * `handleAndroidPurchase`. Display only.
 */
describe("the SKU the store is asked by", () => {
    const sheet = require("fs").readFileSync(
        require("path").join(__dirname, "..", "components", "imotara", "UpgradeSheet.tsx"), "utf8",
    );

    it("🔴 no price lookup hardcodes the iOS bundle prefix", () => {
        // A literal `com.imotara.imotara.${...}` anywhere near a pricing call is
        // the bug. Comments are stripped — they explain the prefix on purpose.
        const src = sheet.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
        const lookups = src.match(/pricingFor\([^)]*\)/g) ?? [];
        expect(lookups.length).toBeGreaterThanOrEqual(2);
        for (const l of lookups) expect(l).not.toMatch(/com\.imotara\.imotara/);
    });

    it("🔴 both price lookups go through the platform-aware helper", () => {
        const src = sheet.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
        const skuDecls = src.match(/const sku = [^;]+;/g) ?? [];
        // The two RENDER sites must use storeSkuFor. The two PURCHASE sites may
        // keep the prefixed literal: they hand it to handleIosPurchase only, and
        // pass the bare id to handleAndroidPurchase separately.
        expect(skuDecls.filter((d: string) => d.includes("storeSkuFor")).length).toBeGreaterThanOrEqual(2);
    });

    it("storeSkuFor returns the BARE id on Android", () => {
        jest.resetModules();
        jest.doMock("react-native", () => ({ Platform: { OS: "android" } }));
        const { storeSkuFor } = require("../payments/upgradePlans");
        expect(storeSkuFor("plus_monthly")).toBe("plus_monthly");
        expect(storeSkuFor("tokens_250")).toBe("tokens_250");
        jest.dontMock("react-native");
    });

    it("storeSkuFor returns the BUNDLE-PREFIXED id on iOS", () => {
        jest.resetModules();
        jest.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
        const { storeSkuFor } = require("../payments/upgradePlans");
        expect(storeSkuFor("plus_monthly")).toBe("com.imotara.imotara.plus_monthly");
        jest.dontMock("react-native");
    });

    it("🔑 the two platforms must NOT agree — that is the whole point", () => {
        jest.resetModules();
        jest.doMock("react-native", () => ({ Platform: { OS: "android" } }));
        const android = require("../payments/upgradePlans").storeSkuFor("plus_annual");
        jest.resetModules();
        jest.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
        const ios = require("../payments/upgradePlans").storeSkuFor("plus_annual");
        jest.dontMock("react-native");
        expect(android).not.toBe(ios);
    });
});
