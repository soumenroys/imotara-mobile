// #44 (27 Nov 2026): the app tells the server what a Play purchase charged — for the payment
// RECORD only (Play's server API has no price; it used to be recorded as a false "USD 0").
import fs from "fs";
import path from "path";
import { storePaidPrice } from "../payments/storePricing";

describe("storePaidPrice", () => {
  it("subscription: the first pricing phase of the offer shown (a free trial is honestly 0)", () => {
    const sub = {
      subscriptionOfferDetails: [
        { pricingPhases: { pricingPhaseList: [{ priceAmountMicros: "149000000", priceCurrencyCode: "INR" }] } },
        { pricingPhases: { pricingPhaseList: [
          { priceAmountMicros: "0", priceCurrencyCode: "INR" },
          { priceAmountMicros: "149000000", priceCurrencyCode: "INR" },
        ] } },
      ],
    };
    expect(storePaidPrice(sub)).toEqual({ paidMicros: 0, paidCurrency: "INR" });
    const noTrial = { subscriptionOfferDetails: [sub.subscriptionOfferDetails[0]] };
    expect(storePaidPrice(noTrial)).toEqual({ paidMicros: 149000000, paidCurrency: "INR" });
  });

  it("one-time pack: the one-time offer, else the product's own fields", () => {
    expect(storePaidPrice({ oneTimePurchaseOfferDetails: { priceAmountMicros: "6990000", priceCurrencyCode: "usd" } }))
      .toEqual({ paidMicros: 6990000, paidCurrency: "USD" });
    expect(storePaidPrice({ priceAmountMicros: "99000000", priceCurrencyCode: "INR" }))
      .toEqual({ paidMicros: 99000000, paidCurrency: "INR" });
    expect(storePaidPrice({ price: 1.99, currency: "EUR" })).toEqual({ paidMicros: 1990000, paidCurrency: "EUR" });
  });

  it("missing / malformed ⇒ null (server records 'not reported')", () => {
    expect(storePaidPrice(undefined)).toBeNull();
    expect(storePaidPrice({})).toBeNull();
    expect(storePaidPrice({ priceAmountMicros: "abc", priceCurrencyCode: "INR" })).toBeNull();
    expect(storePaidPrice({ priceAmountMicros: "100", priceCurrencyCode: "RUPEES" })).toBeNull();
  });

  it("the purchase-time Play verify sends it (records only)", () => {
    const src = fs.readFileSync(path.join(__dirname, "../components/imotara/UpgradeSheet.tsx"), "utf8");
    expect(src).toMatch(/body: JSON\.stringify\(\{ productId, purchaseToken, \.\.\.\(paid \?\? \{\}\) \}\)/);
    expect(src).toMatch(/storePaidPrice\(storeProductRef\.current\(productId as string\)\)/);
    expect(src).toMatch(/storeProductRef\.current = storeProduct;/);
  });
});
