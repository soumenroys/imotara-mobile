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

    /**
     * 🔴 THE PUBLIC SITE. Use this for any URL a USER WILL SEE OR SHARE.
     *
     * ⛔ NOT the API base. `IMOTARA_API_BASE_URL` in src/config/api.ts resolves
     * to localhost in development and to a Metro host on a device — correct for
     * API calls, catastrophic in a link someone sends their mother.
     *
     * ⚠️ WHY THIS EXISTS. Until 2026-10-16 the family mood-snapshot link was
     * hardcoded to `https://imotaraapp.vercel.app/family/view`. Every snapshot a
     * user shared with their family sent that person to the raw deployment URL
     * instead of imotara.com. Nothing was broken — both resolve — which is
     * exactly why it survived: a shared link is the one surface word of mouth
     * actually travels on, and ours pointed at a domain that will never rank and
     * does not look like a company.
     */
    siteUrl: "https://www.imotara.com",

    /**
     * ⛔ THE OWNER'S SOCIAL TABLE IS THE SOURCE OF TRUTH, not this file and not
     * the code. Mirrors `social` in imotaraapp's src/lib/imotara/businessIdentity.ts.
     * Facebook and WaBhai are deliberately absent: the table holds a bare
     * facebook.com root and a login page, neither of which is a profile.
     */
    social: {
        x:         "https://x.com/imotaraofficial",
        instagram: "https://www.instagram.com/imotaraofficial/",
        youtube:   "https://www.youtube.com/@Imotara",
        linkedin:  "https://www.linkedin.com/in/imotara",
        facebook:  "https://www.facebook.com/imotaraofficial",
    },
} as const;

/** "6/B, Kalipada Mukherjee Road, Barisha, Kolkata, West Bengal – 700008, India" */
export function formattedAddress(): string {
    const a = BUSINESS.address;
    return `${a.line1}, ${a.locality}, ${a.city}, ${a.state} – ${a.postalCode}, ${a.country}`;
}
