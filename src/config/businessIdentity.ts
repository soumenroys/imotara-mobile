// src/config/businessIdentity.ts
//
// 🏢 WHO WE LEGALLY ARE — the mobile copy.
//
// 🔴 WHY THIS EXISTS. BillDesk rejected the Google Play PA-CB application on
// 2026-09-21 with "Mobile Application(s) has a missing/incomplete legal name of
// the applicant company". They were right: `M/S IMOTARA` appeared NOWHERE in
// this app. A payment aggregator verifies that the app it is enabling payments
// for visibly names the applicant company, and the store listing alone is not
// reliably what a reviewer opens.
//
// 🔑 `legalName` is the canonical spelling: no full stop, all caps, one space.
// The partnership deed writes "M/S. IMOTARA" WITH a full stop, but the firm PAN
// and the Federal Bank account both say "M/S IMOTARA" without one — and those
// two are what penny-drop and KYC match on. Do not "fix" it.
//
// ⚠️ DUPLICATED FROM WEB ON PURPOSE. imotaraapp has
// `src/lib/imotara/businessIdentity.ts` with the same values. Two repos cannot
// import each other, so `legalEntityShown.test.ts` in each repo pins the
// literals and fails loudly if one side drifts.

export const BUSINESS = {
    /** Registered legal name — must match the firm PAN and bank account exactly. */
    legalName: "M/S IMOTARA",

    /** Constitution, as declared on the PAN (4th character "F" = firm). */
    entityType: "Registered Partnership Firm",

    address: {
        line1:      "6/B, Kalipada Mukherjee Road",
        locality:   "Barisha",
        city:       "Kolkata",
        state:      "West Bengal",
        postalCode: "700008",
        country:    "India",
    },

    /** The one public mailbox. Support, billing, privacy, legal — all of it. */
    email: "info@imotara.com",
} as const;

/** "6/B, Kalipada Mukherjee Road, Barisha, Kolkata, West Bengal – 700008, India" */
export function formattedAddress(): string {
    const a = BUSINESS.address;
    return `${a.line1}, ${a.locality}, ${a.city}, ${a.state} – ${a.postalCode}, ${a.country}`;
}
