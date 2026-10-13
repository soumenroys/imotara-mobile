// ⛔ MIRROR OF imotaraapp/src/lib/legal/termsVersion.ts
//
// This file is copied VERBATIM from the web repo below the header. The consent
// gate must say exactly the same thing on web, iOS and Android — a person who
// accepted "18 or older" on their phone must have accepted the same sentence
// they would have on the web. Two catalogues that are meant to match have
// drifted in this codebase before.
//
// ⇒ When you change one, change BOTH, and run the tests in both repos.
//    Web:    src/__tests__/consentGateCoversEveryLanguage.test.ts
//    Mobile: src/__tests__/consentGateMirrorsWeb.test.ts

// src/lib/legal/termsVersion.ts
//
// The single source of truth for WHICH terms a person agreed to.
//
// ⛔ Bump this ONLY when the substance of /terms or /privacy changes. Bumping it
// re-shows the acceptance gate to every user on their next open — which is the
// point: an acceptance record is worthless unless it names the text that was
// accepted. A record saying "agreed" with no version cannot be defended.
//
// Keep it in lockstep with the "Effective date" printed on src/app/terms/page.tsx.

/** Effective date of the currently published Terms + Privacy Policy. */
export const TERMS_VERSION = "2026-10-13b";

/**
 * Everything we persist when someone accepts. Each field exists for a reason:
 *  - `version`  — which text. Without it the record proves nothing.
 *  - `acceptedAt` — when.
 *  - `locale`   — which translation they were actually shown, since the
 *                 non-English copy is a translation of the English original.
 *  - `surface`  — where the gate was shown, so web and mobile records are
 *                 distinguishable after the fact.
 */
export type TermsAcceptance = {
    version: string;
    acceptedAt: string;
    locale: string;
    surface: "web" | "ios" | "android";
};

/** Storage key for the device-level record. */
export const TERMS_ACCEPTANCE_KEY = "imotara.termsAcceptance.v1";

/** `user_memory` coordinates for the account-level copy. */
export const TERMS_MEMORY_TYPE = "legal";
export const TERMS_MEMORY_KEY = "terms_acceptance";

/**
 * True when `record` is a valid acceptance of the CURRENT terms.
 *
 * ⚠️ A record for an older version is deliberately NOT accepted — that is what
 * makes a version bump re-prompt. Returning true here for any past version
 * would quietly defeat the whole mechanism.
 */
export function hasAcceptedCurrentTerms(
    record: TermsAcceptance | null | undefined,
): boolean {
    if (!record) return false;
    if (typeof record.version !== "string") return false;
    if (typeof record.acceptedAt !== "string" || !record.acceptedAt) return false;
    return record.version === TERMS_VERSION;
}

/** Builds a record for persisting. Kept pure so it is trivially testable. */
export function buildAcceptance(
    surface: TermsAcceptance["surface"],
    locale: string,
    now: Date = new Date(),
): TermsAcceptance {
    return {
        version: TERMS_VERSION,
        acceptedAt: now.toISOString(),
        locale: locale || "en",
        surface,
    };
}

/** Parses a stored value, returning null rather than throwing on anything odd. */
export function parseAcceptance(raw: string | null | undefined): TermsAcceptance | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return null;
        const rec = parsed as Partial<TermsAcceptance>;
        if (typeof rec.version !== "string" || typeof rec.acceptedAt !== "string") return null;
        return {
            version: rec.version,
            acceptedAt: rec.acceptedAt,
            locale: typeof rec.locale === "string" ? rec.locale : "en",
            surface: rec.surface === "ios" || rec.surface === "android" ? rec.surface : "web",
        };
    } catch {
        return null;
    }
}
