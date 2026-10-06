// src/payments/donations.ts

/**
 * Donation presets and INR formatting for the mobile app.
 * Stripe is not required for these — Razorpay + UI can use them directly.
 */

export type DonationUIItem = {
    id: string;
    label: string;
    amount: number; // INR amount (not paise)
};

/**
 * Presets used by Settings / Donate UI.
 * Keep stable ids (important if UI uses keys).
 */
export const DONATION_PRESETS: readonly DonationUIItem[] = [
    { id: "d-49", label: "₹49", amount: 49 },
    { id: "d-99", label: "₹99", amount: 99 },
    { id: "d-199", label: "₹199", amount: 199 },
    { id: "d-499", label: "₹499", amount: 499 },
    { id: "d-999", label: "₹999", amount: 999 },
] as const;

/**
 * Format paise to INR string (e.g., 4900 -> "₹49")
 * Used wherever amounts are stored/handled in paise.
 */
export function formatINRFromPaise(paise: number): string {
    const n = Number(paise);
    if (!Number.isFinite(n)) return "₹0";
    const rupees = Math.round(n / 100);
    return `₹${rupees}`;
}

/**
 * Fetch the DONATION PRESETS FOR THIS DONOR'S COUNTRY.
 *
 * 🔴 WHY THIS EXISTS. The presets above are India's ladder, and until now
 * Android rendered them to everyone — while the button opens `{base}/donate`,
 * which HAS been banded by country since web `c039082`. So a donor outside
 * India was shown ₹49 / ₹99 / ₹199 in the app and then landed on a page
 * offering different numbers. The amounts in the app were a promise the
 * checkout did not keep.
 *
 * 🔑 Still INR — this is NOT currency conversion. Razorpay settles INR only and
 * a foreign card pays in INR while the customer's own bank converts; see the
 * standing note at the top of imotaraapp's lib/imotara/pricingBands.ts, which
 * says in terms: "do NOT add multi-currency here". Banding decides HOW MANY
 * RUPEES to ask a given country for, nothing more.
 *
 * ⚠️ iOS does not use this. Donations there go through Apple's tip jar, whose
 * prices are banded across 175 storefronts in App Store Connect.
 *
 * Falls back to the local ladder on any failure: a donate screen that renders
 * nothing because the network blinked is worse than one showing India's prices.
 */
export async function fetchDonationPresets(
    apiBase: string,
    fetchImpl: (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }> =
        ((url: string) => fetch(url)) as never,
): Promise<readonly DonationUIItem[]> {
    if (!apiBase) return DONATION_PRESETS;
    try {
        const r = await fetchImpl(`${apiBase}/api/payments/donation-presets`);
        if (!r.ok) return DONATION_PRESETS;
        const j = (await r.json()) as {
            ok?: boolean;
            presets?: { id: string; paise: number; label: string }[];
        };
        if (!j?.ok || !Array.isArray(j.presets) || j.presets.length === 0) {
            return DONATION_PRESETS;
        }
        // The endpoint speaks paise; this UI speaks whole rupees.
        return j.presets.map((x) => ({
            id: x.id,
            label: x.label,
            amount: Math.round(x.paise / 100),
        }));
    } catch {
        return DONATION_PRESETS;
    }
}
