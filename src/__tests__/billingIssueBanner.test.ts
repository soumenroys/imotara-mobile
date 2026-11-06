import fs from "fs";
import path from "path";
import { parseBillingIssue, billingBannerText, MANAGE_URL } from "../licensing/billingIssue";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * 🔑 Owner, 6 Nov 2026: tell a subscriber their payment failed while their store
 * subscription is in the billing grace period — on web, Android AND iOS. The web
 * server sends `billingIssue` on /api/license/status; this app shows the SAME
 * words with the store's own subscription link.
 */
describe("grace-period notice", () => {
  const NOW = Date.parse("2026-11-10T00:00:00Z");

  it("reads the server's notice", () => {
    expect(parseBillingIssue({ kind: "grace", until: "2026-11-22T00:00:00Z", store: "apple" }, NOW))
      .toEqual({ kind: "grace", until: "2026-11-22T00:00:00Z", store: "apple" });
  });

  it("⛔ missing, malformed, unknown store or a date already past ⇒ no banner", () => {
    expect(parseBillingIssue(undefined, NOW)).toBeNull();
    expect(parseBillingIssue({ kind: "grace", until: "nope", store: "apple" }, NOW)).toBeNull();
    expect(parseBillingIssue({ kind: "grace", until: "2026-11-22T00:00:00Z", store: "paypal" }, NOW)).toBeNull();
    expect(parseBillingIssue({ kind: "grace", until: "2026-11-01T00:00:00Z", store: "apple" }, NOW)).toBeNull();
  });

  it("the words match the website exactly (owner-approved)", () => {
    expect(billingBannerText({ kind: "grace", until: "2026-11-22T00:00:00.000Z", store: "apple" })).toBe(
      "Your last payment for Imotara Plus didn't go through in the App Store. Plus stays on until 22 November — update your payment method to keep it.",
    );
    expect(billingBannerText({ kind: "grace", until: "2026-11-22T00:00:00.000Z", store: "google_play" })).toBe(
      "Your last payment for Imotara Plus didn't go through on Google Play. Plus stays on until 22 November — update your payment method to keep it.",
    );
  });

  it("the button opens the store's own subscription page", () => {
    expect(MANAGE_URL.apple).toBe("https://apps.apple.com/account/subscriptions");
    expect(MANAGE_URL.google_play).toContain("package=com.imotara.imotara");
  });

  it("the licence refresh stores it, and the chat shows it", () => {
    expect(read("src/state/SettingsContext.tsx")).toMatch(/setBillingIssue\(parseBillingIssue\(statusData\?\.billingIssue\)\)/);
    expect(read("src/screens/ChatScreen.tsx")).toMatch(/billingIssue=\{billingIssue\}/);
    expect(read("src/components/chat/ChatInputBar.tsx")).toMatch(/billingBannerText\(billingIssue\)/);
  });
});
