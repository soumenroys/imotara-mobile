// Product SKUs and pricing for native upgrade flow.
//
// iOS App Store Connect — create these products before going live:
//   Auto-renewable Subscriptions:
//     com.imotara.imotara.plus_monthly  ₹79/mo
//     com.imotara.imotara.plus_annual   ₹699/yr
//     com.imotara.imotara.pro_monthly   ₹149/mo
//     com.imotara.imotara.pro_annual    ₹1199/yr
//   Consumable In-App Purchases:
//     com.imotara.imotara.tokens_100    ₹49
//     com.imotara.imotara.tokens_250    ₹99
//     com.imotara.imotara.tokens_600    ₹199
//     com.imotara.imotara.tokens_1800   ₹499
//
// Android: product IDs match the server PRODUCT_CATALOG keys exactly.

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

export function iosSkuToProductId(sku: string): ProductId | null {
    const id = sku.replace(`${IOS_BUNDLE}.`, "");
    return VALID_IDS.includes(id) ? (id as ProductId) : null;
}

export type PlanDef = {
    id: PlanId;
    tier: PlanTier;
    period: PlanPeriod;
    priceInr: number;
    paise: number;
    monthlyPriceInr?: number;
    savingsPct?: number;
    features: string[];
};

export const PLAN_DEFS: PlanDef[] = [
    {
        id: "plus_monthly", tier: "plus", period: "monthly",
        priceInr: 79, paise: 7_900,
        features: ["Unlimited AI chat", "Cloud sync across devices", "90-day history", "All companion tones"],
    },
    {
        id: "plus_annual", tier: "plus", period: "annual",
        priceInr: 699, paise: 69_900, monthlyPriceInr: 58, savingsPct: 27,
        features: ["Unlimited AI chat", "Cloud sync across devices", "90-day history", "All companion tones"],
    },
    {
        id: "pro_monthly", tier: "pro", period: "monthly",
        priceInr: 149, paise: 14_900,
        features: ["Everything in Plus", "Priority AI responses", "Mood trends & insights", "Export conversations"],
    },
    {
        id: "pro_annual", tier: "pro", period: "annual",
        priceInr: 1_199, paise: 119_900, monthlyPriceInr: 100, savingsPct: 33,
        features: ["Everything in Plus", "Priority AI responses", "Mood trends & insights", "Export conversations"],
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
