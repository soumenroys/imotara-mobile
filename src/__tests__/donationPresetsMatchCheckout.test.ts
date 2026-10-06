/**
 * The donation amounts the app SHOWS must be the ones the checkout CHARGES.
 *
 * 🔴 THE DEFECT. On Android the donate buttons rendered DONATION_PRESETS —
 * India's flat ladder, ₹49/₹99/₹199/₹499/₹999 — to every donor in the world.
 * The button then opens `{base}/donate`, which has been banded by country since
 * web c039082. So someone donating from a higher-income country was shown one
 * set of numbers in the app and a different set the moment the page loaded.
 * The amounts in the app were a promise the checkout did not keep.
 *
 * 🔑 THIS IS NOT CURRENCY CONVERSION, and must not become it. Razorpay settles
 * INR only; a foreign card pays in INR and the customer's own bank converts.
 * imotaraapp's lib/imotara/pricingBands.ts says so in terms — "do NOT add
 * multi-currency here" — and Razorpay confirmed the same in writing on
 * 2026-10-05 (ticket 21230048). Banding decides HOW MANY RUPEES to ask a given
 * country for. Nothing more.
 *
 * ⚠️ iOS is deliberately untouched: donations there go through Apple's tip jar,
 * already banded across 175 storefronts in App Store Connect.
 */

import fs from "fs";
import path from "path";
import { DONATION_PRESETS, fetchDonationPresets } from "../payments/donations";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

describe("the helper asks the server which band this donor is in", () => {
  const ok = (presets: unknown) =>
    ({ ok: true, json: async () => ({ ok: true, presets }) }) as never;

  it("converts the endpoint's paise into whole rupees", async () => {
    const got = await fetchDonationPresets("https://x", (() =>
      Promise.resolve(ok([{ id: "d-1", paise: 29900, label: "₹299" }]))) as never);
    expect(got).toEqual([{ id: "d-1", label: "₹299", amount: 299 }]);
  });

  it("falls back to the local ladder when the request fails", async () => {
    const got = await fetchDonationPresets("https://x", (() =>
      Promise.reject(new Error("offline"))) as never);
    expect(got).toBe(DONATION_PRESETS);
  });

  it("falls back on a non-ok response", async () => {
    const got = await fetchDonationPresets("https://x", (() =>
      Promise.resolve({ ok: false, json: async () => ({}) })) as never);
    expect(got).toBe(DONATION_PRESETS);
  });

  it("falls back on an empty or malformed payload", async () => {
    // A donate screen that renders NOTHING because the network blinked is
    // worse than one showing India's prices.
    for (const body of [{ ok: true, presets: [] }, { ok: true }, { ok: false }]) {
      const got = await fetchDonationPresets("https://x", (() =>
        Promise.resolve({ ok: true, json: async () => body })) as never);
      expect(got).toBe(DONATION_PRESETS);
    }
  });

  it("falls back when there is no API base configured", async () => {
    const got = await fetchDonationPresets("");
    expect(got).toBe(DONATION_PRESETS);
  });
});

describe("Settings renders the fetched presets, not the hardcoded ladder", () => {
  const SETTINGS = () => strip(read("src/screens/SettingsScreen.tsx"));

  it("maps over the fetched list", () => {
    expect(SETTINGS()).toContain("donationPresets.map(");
  });

  it("no longer maps the hardcoded ladder directly", () => {
    expect(SETTINGS()).not.toContain("DONATION_UI_PRESETS.map(");
  });

  it("skips the fetch on iOS, where Apple's tip jar is used", () => {
    const s = SETTINGS();
    const i = s.indexOf("fetchDonationPresets(");
    expect(i).toBeGreaterThan(-1);
    expect(s.slice(Math.max(0, i - 220), i)).toMatch(/Platform\.OS === "ios"\)\s*return;/);
  });

  it("still seeds from the local ladder, so it never renders empty", () => {
    expect(SETTINGS()).toMatch(/useState\(DONATION_UI_PRESETS\)/);
  });
});

describe("⛔ it stays INR — this must never become multi-currency", () => {
  it("the mobile module names no currency other than INR", () => {
    const src = read("src/payments/donations.ts");
    expect(src).not.toMatch(/\b(USD|EUR|GBP)\b/);
  });

  it("amounts stay whole rupees in the UI contract", () => {
    expect(DONATION_PRESETS.every((p) => Number.isInteger(p.amount))).toBe(true);
  });
});
