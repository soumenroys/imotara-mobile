// src/licensing/billingIssue.ts
// "Your last payment didn't go through" — the billing grace period, as the web
// server reports it on /api/license/status (imotaraapp lib/imotara/billingIssue.ts).
//
// 🔑 OWNER, 6 Nov 2026: tell the person on web, Android AND iOS while their
// store subscription is in grace, so they can fix the card before Plus stops.
// ⚠️ PURE ⇒ src/__tests__/billingIssueBanner.test.ts.
// 🌐 #85 (11 Nov 2026): the words live in graceNoticeText.ts (22 languages, mirrored from the web).

import { graceBanner, graceLang } from "./graceNoticeText";

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

/** The banner sentence in the person's language (#85) — English is the owner-approved text of 6 Nov. */
export function billingBannerText(issue: BillingIssue, lang?: string | null): string {
  return graceBanner(issue.store, issue.until, lang).text;
}

/** The banner's one button, in the person's language. */
export function billingButtonText(issue: BillingIssue, lang?: string | null): string {
  return graceBanner(issue.store, issue.until, lang).button;
}

/** Arabic, Urdu and Hebrew read right to left. */
export function billingIsRtl(lang?: string | null): boolean {
  return ["ar", "ur", "he"].includes(graceLang(lang));
}
