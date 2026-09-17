// src/licensing/featureGates.ts

/**
 * The canonical mobile tier list — single source of truth, ordered least →
 * most privileged.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-09-17 five separate copies of this list were
 * hand-written across HistoryContext, SettingsContext, SettingsScreen,
 * ChatScreen and PlanSupportQuickPanel. All five happened to agree — but the
 * web repo had the same pattern and four of its seven copies had silently lost
 * "family", which made Family licences unissuable. Five copies is the same bug
 * waiting to happen, and on mobile a fix needs a store release to reach users.
 *
 * ⚠️ These are the MOBILE spellings. Web uses lowercase.
 *
 * 🔗 "PREMIUM" IS NOT HERE ANY MORE. Plus and Pro merged (L10) and PLUS is the
 * canonical id, matching the name users see. PREMIUM — and web's `pro` — are
 * LEGACY ALIASES handled by normaliseTier().
 *
 * 🔴 THIS IS THE DANGEROUS ONE. "PREMIUM" is written into AsyncStorage on every
 * installed device. Anything that reads a stored tier MUST go through
 * normaliseTier, never isLicenseTier — a bare validity check now returns false
 * for "PREMIUM" and would drop every existing paid user to FREE, needing a
 * store release to undo.
 */
export const TIER_ORDER = ["FREE", "PLUS", "FAMILY", "EDU", "ENTERPRISE"] as const;

export type LicenseTier = (typeof TIER_ORDER)[number];

/**
 * 🔗 THE ONE NORMALISER. Accepts every spelling either side of the wire has ever
 * used — mobile's "PREMIUM", web's "pro"/"plus", any casing — and returns the
 * canonical mobile id. Unknown input reads FREE, never upward into a paid tier.
 *
 * Use this, not isLicenseTier, wherever a tier arrives from AsyncStorage or from
 * the server. isLicenseTier answers "is this canonical?"; this answers "what did
 * they mean?", and for stored values that is the question.
 */
const TIER_ALIASES: Record<string, LicenseTier> = {
    free:       "FREE",
    plus:       "PLUS",
    pro:        "PLUS",   // web's id before the rename
    premium:    "PLUS",   // 🔴 this app's id before the rename — ON DEVICES
    family:     "FAMILY",
    edu:        "EDU",
    education:  "EDU",
    enterprise: "ENTERPRISE",
};

export function normaliseTier(tier: unknown): LicenseTier {
    return TIER_ALIASES[String(tier ?? "").trim().toLowerCase()] ?? "FREE";
}

/** Narrowing guard for untrusted input (AsyncStorage reads, server payloads). */
export function isLicenseTier(value: unknown): value is LicenseTier {
    return typeof value === "string" && (TIER_ORDER as readonly string[]).includes(value);
}

/**
 * The one place a tier is turned into words for a user.
 *
 * 🔴 WHY THIS EXISTS. Two `prettyTier` functions existed — SettingsScreen and
 * PlanSupportQuickPanel — and they disagreed: the SAME tier read "Pro" on the
 * Settings screen and "Premium" in the plan panel. The quick panel also had no
 * case for PLUS at all and only rendered it correctly by accident, via a
 * title-casing fallback.
 *
 * ⚠️ Stage C renames the public paid tier to "Imotara Plus". When that lands,
 * this map is the only edit — which is the point of it existing.
 */
export const TIER_LABELS: Record<LicenseTier, string> = {
    FREE:       "Free",
    // 🔗 PLUS and PREMIUM both read "Plus" — they ARE the same plan since L10.
    // The one paid consumer tier. In-app the brand prefix is redundant, so the
    // label is "Plus"; prose and marketing say "Imotara Plus".
    PLUS:       "Plus",
    FAMILY:     "Family",
    EDU:        "Education",
    ENTERPRISE: "Enterprise",
};

/** Display label for a tier. Unknown or missing values read "Free". */
export function prettyTier(tier: unknown): string {
    return TIER_LABELS[normaliseTier(tier)];
}

/**
 * 🔗 THE ONLY PLACE THE TWO VOCABULARIES MEET.
 *
 * The web calls the paid tier `pro`; this app has always called it `PREMIUM`,
 * and that string is what sits in AsyncStorage on every installed device. So
 * the names cannot simply be unified — renaming would need a storage migration
 * on every phone, and a migration that goes wrong silently drops someone to
 * FREE.
 *
 * 🔴 WHY THIS EXISTS. The translation was hand-written in SIX places:
 * SettingsContext's if-chain, and five more in UpgradeSheet — some operating on
 * web spellings that arrive from `/api/license/status`, some on mobile spellings
 * read back from AsyncStorage, with only a comment to tell you which. That is
 * how `pro` and `PREMIUM` end up compared to each other and quietly not
 * matching.
 *
 * Accepts either spelling, so a caller does not have to know which side of the
 * wire its value came from. Unknown input reads FREE — never a paid tier.
 */
/** Kept as a name for the web→mobile direction; it is the same normaliser. */
export const fromWebTier = normaliseTier;

/**
 * All features that may be gated by license.
 * Add new gated capabilities ONLY here.
 */
export type FeatureKey =
    | "CLOUD_SYNC"
    | "HISTORY_UNLIMITED"
    | "HISTORY_DAYS_LIMIT"
    | "TRENDS_INSIGHTS"
    | "EXPORT_DATA"
    | "MULTI_PROFILE"
    | "CHILD_SAFE_MODE"
    | "ADMIN_DASHBOARD"
    // Plus+ features
    | "TTS_ADVANCED"       // TTS voice selection, rate/pitch control, Azure Neural
    | "SEARCH_MODE"        // Exact / semantic search mode toggle in history
    | "REPLY_CADENCE"      // Arc & companion-letter cadence controls
    // Imotara Plus features
    | "COMPANION_LETTER"   // Monthly AI-written letter from the companion
    | "GROWTH_ARC";        // Long-term emotional growth arc narrative

/**
 * Feature result is designed to support:
 * - boolean gates (enabled/disabled)
 * - parameter gates (e.g., limits)
 */
export type FeatureGateResult =
    | { enabled: false; reason?: string }
    | { enabled: true; params?: Record<string, unknown> };

// History days per tier — only needed for tiers without HISTORY_UNLIMITED.
const HISTORY_DAYS: Partial<Record<LicenseTier, number>> = {
    FREE: 7,
    // PLUS: 90 removed in L10 — PLUS now carries HISTORY_UNLIMITED, and the
    // caller checks that first, so a 90 here would be dead and misleading.
};

/**
 * 🔗 THE MERGED PAID CONSUMER TIER (L10).
 *
 * PLUS and PREMIUM are one tier now. Publicly it is **"Imotara Plus"**;
 * internally the web id stays `pro` (this app's `PREMIUM`) and the SKUs stay
 * `pro_*`, so existing licence rows and the grandfather backfill stay valid.
 *
 * PLUS survives only as the LEGACY id — the one remaining ₹99 subscriber and
 * anyone grandfathered onto it. Same features, older price. That is what
 * "merged" means.
 *
 * ⚠️ Both read from this one array rather than listing their own keys — two
 * lists that happen to agree is the drift that made Family licences unissuable
 * on web. tierMergeIsComplete.test.ts pins the equality, and pins it against
 * the web repo's copy too.
 */
const MERGED_PAID_FEATURES: readonly FeatureKey[] = [
    "CLOUD_SYNC",
    "HISTORY_UNLIMITED",
    "TRENDS_INSIGHTS",
    "EXPORT_DATA",
    "TTS_ADVANCED",
    "SEARCH_MODE",
    "REPLY_CADENCE",
    "COMPANION_LETTER", // Monthly AI-written letter
    "GROWTH_ARC",       // Long-term emotional growth arc narrative
];

const ALL: Record<LicenseTier, Set<FeatureKey>> = {
    FREE: new Set<FeatureKey>([
        "CLOUD_SYNC",
        // Server enforces 20 replies/day quota. History capped at 7 days.
    ]),
    // The one paid consumer tier. Sold as "Imotara Plus". Subscribers on the
    // retired plus_* SKUs are on this same tier at their old price.
    PLUS: new Set<FeatureKey>(MERGED_PAID_FEATURES),
    FAMILY: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        "MULTI_PROFILE",
        "CHILD_SAFE_MODE",
        "TTS_ADVANCED",
        "SEARCH_MODE",
        "REPLY_CADENCE",
        "COMPANION_LETTER",
        "GROWTH_ARC",
        // Export intentionally off for Family (privacy boundary — shared device).
    ]),
    EDU: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",  // Aggregated/anonymised for admins; individual analytics off
        "ADMIN_DASHBOARD",
        "CHILD_SAFE_MODE",
        "TTS_ADVANCED",
        "SEARCH_MODE",
        "REPLY_CADENCE",
        // Individual export off; bulk anonymised export via admin panel only.
        // COMPANION_LETTER / GROWTH_ARC off — individual narrative features not suited to EDU.
    ]),
    ENTERPRISE: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        "EXPORT_DATA",
        "ADMIN_DASHBOARD",
        "CHILD_SAFE_MODE",
        "MULTI_PROFILE",
        "TTS_ADVANCED",
        "SEARCH_MODE",
        "REPLY_CADENCE",
        "COMPANION_LETTER",
        "GROWTH_ARC",
    ]),
};

// Soft launch (2026-07): mirrors web's license_mode="off" (see serverGate.ts) —
// every mobile user gets the individual Plus/Pro consumer experience for free
// right now, by evaluating gates as if every tier were PREMIUM ("Pro" in the
// reasonFor() copy below). PREMIUM deliberately does NOT include
// MULTI_PROFILE / CHILD_SAFE_MODE / ADMIN_DASHBOARD — those are Family/EDU/
// Enterprise institutional entitlements, not part of "everyone gets Plus or
// Pro," so they stay gated to their real tiers even during soft launch. The
// user's real tier is untouched elsewhere (e.g. Settings' "Current plan"
// still shows the truth) — only feature *checks* are bypassed. Flip to false
// once tiers are actually sold and enforcement should start for real.
export const SOFT_LAUNCH_BYPASS_ALL_GATES = true;
const SOFT_LAUNCH_EFFECTIVE_TIER: LicenseTier = "PLUS";

// Institutional entitlements that must NOT be affected by the soft-launch
// bypass (see the comment above): they are granted by Family/EDU/Enterprise
// membership, not by the "everyone gets Pro" launch offer. Evaluating them at
// the bypass tier (PREMIUM) would wrongly *revoke* them from real Family/EDU/
// Enterprise users during soft launch, since PREMIUM doesn't include them.
export const INSTITUTIONAL_FEATURES: ReadonlySet<FeatureKey> = new Set<FeatureKey>([
    "MULTI_PROFILE",
    "CHILD_SAFE_MODE",
    "ADMIN_DASHBOARD",
]);

/**
 * What a tier actually grants, WITHOUT the soft-launch bypass.
 *
 * 🔴 `gate()` bypasses to PREMIUM while SOFT_LAUNCH_BYPASS_ALL_GATES is true,
 * which makes every tier look identical. That is correct for the app and
 * useless for checking the tier table — a test written against gate() would
 * pass no matter how badly the sets were wrong. This is the honest read.
 *
 * Read-only: returns the live Set, so callers must not mutate it.
 */
export function featuresForTier(tier: LicenseTier): ReadonlySet<FeatureKey> {
    return ALL[tier];
}

/** History-day cap for a tier, bypass-free. Infinity when unlimited. */
export function historyDaysForTier(tier: LicenseTier): number {
    return ALL[tier].has("HISTORY_UNLIMITED") ? Infinity : (HISTORY_DAYS[tier] ?? 7);
}

/**
 * Central feature gate resolver.
 * Always call this rather than sprinkling `tier === ...` checks around the app.
 */
export function gate(
    feature: FeatureKey,
    tier: LicenseTier | string | undefined | null
): FeatureGateResult {
    // 🔴 normaliseTier, not `?? "FREE"`. A stored "PREMIUM" would otherwise
    // index ALL[] as undefined and grant nothing to a paying subscriber.
    const realTier: LicenseTier = normaliseTier(tier);
    const t: LicenseTier =
        SOFT_LAUNCH_BYPASS_ALL_GATES && !INSTITUTIONAL_FEATURES.has(feature)
            ? SOFT_LAUNCH_EFFECTIVE_TIER
            : realTier;

    // Parameterized gates first
    if (feature === "HISTORY_DAYS_LIMIT") {
        if (ALL[t].has("HISTORY_UNLIMITED")) {
            return { enabled: true, params: { days: Infinity } };
        }
        const days = HISTORY_DAYS[t] ?? 7;
        return { enabled: true, params: { days } };
    }

    // Simple boolean gates
    const enabled = ALL[t].has(feature);

    if (!enabled) {
        return {
            enabled: false,
            reason: reasonFor(feature, t),
        };
    }

    return { enabled: true };
}

/**
 * Convenience helpers (optional but handy for UI).
 */
export function isEnabled(
    feature: FeatureKey,
    // `string` on purpose, like gate(): callers pass values read from
    // AsyncStorage or the server, which may still be a legacy spelling.
    tier: LicenseTier | string | undefined | null
): boolean {
    return gate(feature, tier).enabled;
}

export function getParam<T = unknown>(
    feature: FeatureKey,
    // `string` like gate()/isEnabled — callers pass stored values.
    tier: LicenseTier | string | undefined | null,
    key: string
): T | undefined {
    const g = gate(feature, tier);
    if (!g.enabled) return undefined;
    return (g.params?.[key] as T | undefined) ?? undefined;
}

/**
 * Human-readable reasons (used for UI nudges).
 * Keep these short and non-pushy.
 */
function reasonFor(feature: FeatureKey, tier: LicenseTier): string {
    // For now, tier is unused in messages, but left in signature for future nuance.
    switch (feature) {
        case "CLOUD_SYNC":
            return "Cloud sync is available with Imotara Plus.";
        case "HISTORY_UNLIMITED":
            return "Unlimited history is available with Imotara Plus.";
        case "TRENDS_INSIGHTS":
            return "Insights are available with Imotara Plus.";
        case "EXPORT_DATA":
            return "Export is available with Imotara Plus.";
        case "MULTI_PROFILE":
            return "Multiple profiles are available with Family plan.";
        case "CHILD_SAFE_MODE":
            return "Child-safe mode is available on Family, EDU, and Enterprise plans.";
        case "ADMIN_DASHBOARD":
            return "Admin tools are available on institutional plans.";
        case "HISTORY_DAYS_LIMIT":
            return "History retention limit applies on Free plan.";
        case "TTS_ADVANCED":
            return "Advanced TTS voice selection and speed/pitch control are available with Imotara Plus.";
        case "SEARCH_MODE":
            return "Exact/semantic search mode is available with Imotara Plus.";
        case "REPLY_CADENCE":
            return "Cadence controls for arc and companion letter are available with Imotara Plus.";
        case "COMPANION_LETTER":
            return "Monthly companion letters are available with Imotara Plus.";
        case "GROWTH_ARC":
            return "Emotional growth arc narrative is available with Imotara Plus.";
        default:
            return "This feature is not available on your current plan.";
    }
}
