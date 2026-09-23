/**
 * What the store will actually charge — read from the store, not from our code.
 *
 * 🔴 WHY THIS MODULE EXISTS. Android used to render `₹${plan.priceInr}` from
 * PLAN_DEFS and never ask Play, so a US user saw "₹149" while Play charged US
 * dollars. Both platforms now read the store, which also means a reprice in
 * either console no longer needs an app release to match.
 *
 * 🔴 WHY THE **LAST** PRICING PHASE. Play describes a subscription as an ORDERED
 * list of pricing phases. With an introductory offer the list is e.g.
 * [7 days free, then ₹149/month] — so `pricingPhaseList[0]` is the TRIAL, not
 * the price. This code read index 0 between 2026-09-25 and this commit, which
 * would have advertised "Free" as the plan's price the moment the offers
 * approved on 2026-09-24 were configured. The recurring price is ALWAYS the
 * last phase; everything before it is introductory.
 *
 * 🔑 Play returns only offers the signed-in user is ELIGIBLE for, so an intro
 * phase coming back is permission to advertise it.
 *
 * ⚠️ The iOS introductory shape is NOT yet verified against a device. expo-iap's
 * field name for StoreKit's introductory offer is read across the likely
 * spellings; its absence simply means no intro line is shown, never a wrong
 * price. Confirm against a real sandbox purchase before trusting it.
 *
 * The rupee fallback is a last resort for when the store returns nothing
 * (offline, Play Billing unavailable). Right for India, wrong elsewhere — but a
 * device with no store connection cannot buy anyway.
 */

export type StorePricing = {
    /** The recurring price, as the store formats it. Always present. */
    regular: string;
    /** The introductory price, if this user is eligible for one. */
    intro?: string;
    /** True when the introductory phase costs nothing — a free trial. */
    introIsFree?: boolean;
    /** How long the introductory phase lasts, as ISO-8601 ("P1Y", "P7D"). */
    introPeriod?: string;
    /** False when nothing came back from the store and `regular` is our rupee guess. */
    fromStore: boolean;
};

/** Read one product's pricing out of whatever shape the platform handed us. */
export function readStorePricing(product: any, fallbackInr: number): StorePricing {
    const miss: StorePricing = { regular: `₹${fallbackInr}`, fromStore: false };
    if (!product) return miss;

    // ── Android / Play: pricing phases ──────────────────────────────────────
    const offers: any[] = product?.subscriptionOfferDetails ?? [];
    // Prefer an offer that HAS an introductory phase. Play only returns offers
    // this user is eligible for, so advertising it is safe.
    const offer =
        offers.find((o) => (o?.pricingPhases?.pricingPhaseList?.length ?? 0) > 1) ??
        offers[0];
    const phases: any[] = offer?.pricingPhases?.pricingPhaseList ?? [];
    if (phases.length) {
        const last = phases[phases.length - 1];
        const first = phases.length > 1 ? phases[0] : undefined;
        const regular = last?.formattedPrice ?? product.displayPrice;
        if (regular) {
            return {
                regular,
                intro: first?.formattedPrice,
                // Play marks a free trial with zero micros; the formatted string
                // is localised ("Free", "Gratuit"), so never match on the text.
                introIsFree: first ? Number(first.priceAmountMicros ?? -1) === 0 : undefined,
                introPeriod: first?.billingPeriod,
                fromStore: true,
            };
        }
    }

    // ── iOS / StoreKit, and one-time products on both platforms ─────────────
    if (!product.displayPrice) return miss;
    const io = product?.introductoryPrice ?? product?.subscriptionInfo?.introductoryOffer;
    const intro = typeof io === "string" ? io : io?.displayPrice;
    return {
        regular: product.displayPrice,
        intro: typeof intro === "string" ? intro : undefined,
        introIsFree: io && typeof io !== "string" ? Number(io.price ?? -1) === 0 : undefined,
        introPeriod: io && typeof io !== "string" ? io.periodIso ?? io.period : undefined,
        fromStore: true,
    };
}

/** "P1Y" → "the first year". Returns undefined for anything unrecognised. */
export function humanPeriod(iso?: string): string | undefined {
    if (!iso) return undefined;
    const m = /^P(\d+)([DWMY])$/.exec(iso.trim().toUpperCase());
    if (!m) return undefined;
    const n = Number(m[1]);
    const unit = { D: "day", W: "week", M: "month", Y: "year" }[m[2]]!;
    return n === 1 ? `the first ${unit}` : `the first ${n} ${unit}s`;
}

/**
 * The one-line offer note shown under the price, or undefined when there is no
 * introductory offer. The REGULAR price stays the headline figure — the reader
 * must never be shown the trial as if it were the plan's price.
 */
export function introNote(p: StorePricing): string | undefined {
    if (!p.intro) return undefined;
    const when = humanPeriod(p.introPeriod);
    const lead = p.introIsFree ? "Free" : p.intro;
    return when
        ? `${lead} for ${when}, then ${p.regular}`
        : `${lead} to start, then ${p.regular}`;
}
