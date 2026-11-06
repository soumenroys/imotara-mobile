// src/licensing/billingIssue.ts
// "Your last payment didn't go through" — the billing grace period, as the web
// server reports it on /api/license/status (imotaraapp lib/imotara/billingIssue.ts).
//
// 🔑 OWNER, 6 Nov 2026: tell the person on web, Android AND iOS while their
// store subscription is in grace, so they can fix the card before Plus stops.
// ⚠️ PURE ⇒ src/__tests__/billingIssueBanner.test.ts.

export type BillingStore = "apple" | "google_play";
export type BillingIssue = { kind: "grace"; until: string; store: BillingStore };

/** Whatever the server sent ⇒ a notice, or null. Anything malformed or past ⇒ null, never a guess. */
export function parseBillingIssue(raw: unknown, now = Date.now()): BillingIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== "grace" || typeof r.until !== "string") return null;
  if (r.store !== "apple" && r.store !== "google_play") return null;
  const t = Date.parse(r.until);
  if (!Number.isFinite(t) || t <= now) return null;
  return { kind: "grace", until: r.until, store: r.store };
}

/** The store's own subscription page — only the store can fix a card. */
export const MANAGE_URL: Record<BillingStore, string> = {
  apple: "https://apps.apple.com/account/subscriptions",
  google_play: "https://play.google.com/store/account/subscriptions?package=com.imotara.imotara",
};

const ON_STORE: Record<BillingStore, string> = { apple: "in the App Store", google_play: "on Google Play" };
export const BUTTON: Record<BillingStore, string> = {
  apple: "Update payment in the App Store",
  google_play: "Update payment in Google Play",
};

/** The same words the website shows (owner approved, 6 Nov 2026). */
export function billingBannerText(issue: BillingIssue): string {
  const d = new Date(issue.until);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const when = `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  return `Your last payment for Imotara Plus didn't go through ${ON_STORE[issue.store]}. Plus stays on until ${when} — update your payment method to keep it.`;
}
