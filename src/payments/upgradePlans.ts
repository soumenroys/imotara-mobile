// Product SKUs and pricing for native upgrade flow.
//
// iOS App Store Connect — create these products before going live:
//   Auto-renewable Subscriptions:
//     com.imotara.imotara.plus_monthly  ₹99/mo
//     com.imotara.imotara.plus_annual   ₹699/yr
//     com.imotara.imotara.pro_monthly   ₹149/mo
//     com.imotara.imotara.pro_annual    ₹1299/yr
//   Consumable In-App Purchases:
//     com.imotara.imotara.tokens_100    ₹49
//     com.imotara.imotara.tokens_250    ₹99
//     com.imotara.imotara.tokens_600    ₹199
//     com.imotara.imotara.tokens_1800   ₹499
//
// Android Google Play — product IDs match the server PRODUCT_CATALOG keys exactly.
//   Create these in Play Console → Monetise → Products:
//   Subscriptions: plus_monthly, plus_annual, pro_monthly, pro_annual
//   In-app products: tokens_100, tokens_250, tokens_600, tokens_1800

import { Platform } from "react-native";

export type PlanPeriod  = "monthly" | "annual";
export type PlanTier    = "plus" | "pro";
export type PlanId      = "plus_monthly" | "plus_annual" | "pro_monthly" | "pro_annual";
export type TokenPackId = "tokens_100" | "tokens_250" | "tokens_600" | "tokens_1800";
export type ProductId   = PlanId | TokenPackId;

const IOS_BUNDLE = "com.imotara.imotara";

export const IOS_SUBSCRIPTION_SKUS = [
    `${IOS_BUNDLE}.plus_monthly`,
    `${IOS_BUNDLE}.plus_annual`,
    `${IOS_BUNDLE}.pro_monthly`,
    `${IOS_BUNDLE}.pro_annual`,
] as const;

export const IOS_TOKEN_SKUS = [
    `${IOS_BUNDLE}.tokens_100`,
    `${IOS_BUNDLE}.tokens_250`,
    `${IOS_BUNDLE}.tokens_600`,
    `${IOS_BUNDLE}.tokens_1800`,
] as const;

const VALID_IDS: readonly string[] = [
    "plus_monthly", "plus_annual", "pro_monthly", "pro_annual",
    "tokens_100", "tokens_250", "tokens_600", "tokens_1800",
];

/**
 * The id THIS PLATFORM'S STORE knows a product by.
 *
 * 🔴 Apple uses the bundle-prefixed form (`com.imotara.imotara.plus_monthly`);
 * **Play uses the bare id** (`plus_monthly`). Product ids are immutable in both
 * consoles, so this difference is permanent.
 *
 * ⚠️ WHY THIS EXISTS. The upgrade sheet built the prefixed form unconditionally
 * and used it to look the product up in the store's response. On Android that
 * key never matches anything Play returned, so the lookup silently fell through
 * to the hardcoded `₹` price from PLAN_DEFS — the exact bug that reading the
 * store was meant to fix, wearing a different hat. It failed SILENTLY because
 * the fallback is a plausible-looking price.
 *
 * Purchase was never affected: `handlePlanPress` already passes the bare id to
 * `handleAndroidPurchase`. Only the DISPLAY lookup was wrong.
 */
export function storeSkuFor(productId: ProductId | string): string {
    return Platform.OS === "ios" ? `${IOS_BUNDLE}.${productId}` : String(productId);
}

export function iosSkuToProductId(sku: string): ProductId | null {
    const id = sku.replace(`${IOS_BUNDLE}.`, "");
    return VALID_IDS.includes(id) ? (id as ProductId) : null;
}

// Android Google Play SKUs — same as product IDs (no bundle prefix)
export const ANDROID_SUBSCRIPTION_SKUS = [
    "plus_monthly", "plus_annual", "pro_monthly", "pro_annual",
] as const;

export const ANDROID_TOKEN_SKUS = [
    "tokens_100", "tokens_250", "tokens_600", "tokens_1800",
] as const;

export const ANDROID_SUBSCRIPTION_SET = new Set<string>(ANDROID_SUBSCRIPTION_SKUS);

export type PlanDef = {
    id: PlanId;
    /**
     * 🔴 Retired for NEW purchases (L10/L12). The tiers merged into one paid
     * plan sold as "Imotara Plus" on the pro_* SKUs; plus_* stays here, and
     * stays in the store SKU lists, because existing subscribers still bill on
     * it and a restore must still recognise it. It is filtered out of the
     * upgrade sheet so nobody can start a new subscription on it.
     *
     * ⚠️ Do NOT delete a SKU with an active subscriber — deactivate it for new
     * purchases in the consoles instead.
     */
    retired?: boolean;
    tier: PlanTier;
    period: PlanPeriod;
    priceInr: number;
    paise: number;
    monthlyPriceInr?: number;
    savingsPct?: number;
    features: string[];
};

export const PLAN_DEFS: PlanDef[] = [
    // ✅ THE PLANS ON SALE. Shown as "Imotara Plus".
    //
    // 🔄 FLIPPED 2026-09-25. `plus_*` used to be the RETIRED pair at ₹99/₹699
    // while `pro_*` was live. The pairs were swapped because **nobody had ever
    // purchased `pro_monthly` or `pro_annual`** — zero rows in
    // `payment_licenses`, verified 2026-09-18. An id nobody has bought costs
    // nothing to abandon, and `plus_*` is the id that matches the label.
    //
    // 🔑 Play sells exactly these two, bare (`plus_monthly`, `plus_annual`).
    // Apple sells the same suffixes bundle-prefixed. Web's PRODUCT_CATALOG
    // agrees. `pricingCatalog.test.ts` in both repos pins the amounts.
    {
        id: "plus_monthly", tier: "plus", period: "monthly",
        priceInr: 149, paise: 14_900,
        features: ["Unlimited replies", "Unlimited history", "Cross-device access", "All companion tones", "Mood trends & insights", "Companion letters", "Growth arc", "Export conversations"],
    },
    {
        id: "plus_annual", tier: "plus", period: "annual",
        priceInr: 1_299, paise: 129_900, monthlyPriceInr: 108, savingsPct: 27,
        features: ["Unlimited replies", "Unlimited history", "Cross-device access", "All companion tones", "Mood trends & insights", "Companion letters", "Growth arc", "Export conversations"],
    },
    // 🔴 RETIRED for new purchases — filtered out of the upgrade sheet, kept so
    // a restore still recognises them. Same tier, same price; simply not offered.
    // ⛔ Do NOT delete a SKU from the consoles — deactivate it instead.
    {
        id: "pro_monthly", tier: "plus", period: "monthly", retired: true,
        priceInr: 149, paise: 14_900,
        features: ["Unlimited replies", "Unlimited history", "Cross-device access", "All companion tones", "Mood trends & insights", "Companion letters", "Growth arc", "Export conversations"],
    },
    {
        id: "pro_annual", tier: "plus", period: "annual", retired: true,
        priceInr: 1_299, paise: 129_900, monthlyPriceInr: 108, savingsPct: 27,
        features: ["Unlimited replies", "Unlimited history", "Cross-device access", "All companion tones", "Mood trends & insights", "Companion letters", "Growth arc", "Export conversations"],
    },
];

export type TokenPackDef = {
    id: TokenPackId;
    tokens: number;
    priceInr: number;
    paise: number;
};

export const TOKEN_PACK_DEFS: TokenPackDef[] = [
    { id: "tokens_100",  tokens: 100,  priceInr: 49,  paise: 4_900  },
    { id: "tokens_250",  tokens: 250,  priceInr: 99,  paise: 9_900  },
    { id: "tokens_600",  tokens: 600,  priceInr: 199, paise: 19_900 },
    { id: "tokens_1800", tokens: 1800, priceInr: 499, paise: 49_900 },
];
