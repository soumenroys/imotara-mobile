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
