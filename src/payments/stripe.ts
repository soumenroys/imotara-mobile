// src/payments/stripe.ts

/**
 * Stripe setup (Mobile).
 *
 * IMPORTANT:
 * - Only the Stripe *publishable* key is used in the app.
 * - Secret keys MUST stay on the backend.
 *
 * Expo env var:
 *   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
 */

export const STRIPE_PUBLISHABLE_KEY: string =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/**
 * True if Stripe is configured in this build.
 * Use this to disable Donate UI gracefully when key is missing.
 */
export const STRIPE_ENABLED: boolean = STRIPE_PUBLISHABLE_KEY.startsWith("pk_");

/**
 * Donation presets for “Support Imotara 🇮🇳”.
 *
 * Stripe expects amount in the *smallest* currency unit.
 * For INR that is paise:
 *   ₹99  ->  9900 paise
 */
export const DONATION_PRESETS = [
    { id: "donate_99", label: "₹99", amount: 9900, currency: "inr" },
    { id: "donate_199", label: "₹199", amount: 19900, currency: "inr" },
    { id: "donate_499", label: "₹499", amount: 49900, currency: "inr" },
    { id: "donate_999", label: "₹999", amount: 99900, currency: "inr" },
] as const;

export type DonationPreset = (typeof DONATION_PRESETS)[number];

/**
 * Optional: if you ever show a “custom amount” input, this helps convert rupees to paise.
 */
export function rupeesToPaise(rupees: number): number {
    if (!Number.isFinite(rupees)) return 0;
    const r = Math.max(0, rupees);
    // Multiply first, then round safely
    return Math.round(r * 100);
}

/**
 * For displaying INR nicely (UI only).
 */
export function formatINRFromPaise(paise: number): string {
    const rupees = Math.round((Number(paise) || 0) / 100);
    return `₹${rupees}`;
}
