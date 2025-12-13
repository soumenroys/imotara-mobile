// src/licensing/featureGates.ts

export type LicenseTier = "FREE" | "PREMIUM" | "FAMILY" | "EDU" | "ENTERPRISE";

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
    | "ADMIN_DASHBOARD";

/**
 * Feature result is designed to support:
 * - boolean gates (enabled/disabled)
 * - parameter gates (e.g., limits)
 */
export type FeatureGateResult =
    | { enabled: false; reason?: string }
    | { enabled: true; params?: Record<string, unknown> };

const ALL: Record<LicenseTier, Set<FeatureKey>> = {
    FREE: new Set<FeatureKey>([
        // FREE is intentionally not “crippled” — most core functionality is ungated.
        // Keep this list small; only add truly premium things.
        "HISTORY_DAYS_LIMIT",
    ]),
    PREMIUM: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        "EXPORT_DATA",
    ]),
    FAMILY: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        // Export is intentionally off for Family by default (privacy boundary).
        "MULTI_PROFILE",
        "CHILD_SAFE_MODE",
    ]),
    EDU: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        // EDU tends to be institution-focused; export typically restricted.
        "TRENDS_INSIGHTS",
        "ADMIN_DASHBOARD",
    ]),
    ENTERPRISE: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        "ADMIN_DASHBOARD",
    ]),
};

/**
 * Central feature gate resolver.
 * Always call this rather than sprinkling `tier === ...` checks around the app.
 */
export function gate(
    feature: FeatureKey,
    tier: LicenseTier | undefined | null
): FeatureGateResult {
    const t: LicenseTier = tier ?? "FREE";

    // Parameterized gates first
    if (feature === "HISTORY_DAYS_LIMIT") {
        // If tier has unlimited history, the limit is irrelevant.
        if (ALL[t].has("HISTORY_UNLIMITED")) {
            return { enabled: true, params: { days: Infinity } };
        }

        // FREE default: 7 days; you can change this without refactoring the app.
        // You could also tune per tier if you ever want (e.g., EDU 30 days).
        const days = 7;

        // Enabled = true because the *feature* here is “there is a limit.”
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
    tier: LicenseTier | undefined | null
): boolean {
    return gate(feature, tier).enabled;
}

export function getParam<T = unknown>(
    feature: FeatureKey,
    tier: LicenseTier | undefined | null,
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
            return "Cloud sync is available with Premium.";
        case "HISTORY_UNLIMITED":
            return "Full history is available with Premium.";
        case "TRENDS_INSIGHTS":
            return "Insights are available with Premium.";
        case "EXPORT_DATA":
            return "Export is available with Premium.";
        case "MULTI_PROFILE":
            return "Multiple profiles are available with Family plan.";
        case "CHILD_SAFE_MODE":
            return "Child-safe mode is available with Family plan.";
        case "ADMIN_DASHBOARD":
            return "Admin tools are available on institutional plans.";
        case "HISTORY_DAYS_LIMIT":
            return "History retention limit applies on Free plan.";
        default:
            return "This feature is not available on your current plan.";
    }
}
