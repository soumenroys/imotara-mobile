/**
 * #85 (11 Nov 2026): the grace notice in all 22 languages — the same file as
 * the website (byte-for-byte from GRACE_LANGS down), wired to the person's language.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { GRACE_LANGS, graceBanner } from "../licensing/graceNoticeText";
import { billingBannerText, billingButtonText, billingIsRtl } from "../licensing/billingIssue";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const ISSUE = { kind: "grace" as const, until: "2026-11-22T00:00:00.000Z", store: "google_play" as const };

describe("the same words as the website", () => {
  const webPath = join(__dirname, "../../../imotaraapp/src/lib/imotara/graceNoticeText.ts");
  (existsSync(webPath) ? it : it.skip)("identical to the web file from GRACE_LANGS down", () => {
    const body = (t: string) => t.slice(t.indexOf("export const GRACE_LANGS"));
    expect(body(src("licensing/graceNoticeText.ts"))).toBe(body(readFileSync(webPath, "utf8")));
  });
  it("22 languages, each naming the store and Imotara Plus", () => {
    expect(GRACE_LANGS).toHaveLength(22);
    for (const l of GRACE_LANGS) {
      const b = graceBanner("apple", ISSUE.until, l);
      expect(b.text).toContain("App Store");
      expect(b.text).toContain("Imotara Plus");
      expect(b.button).toContain("App Store");
      expect(`${b.text}${b.button}`).not.toMatch(/\$\{|undefined|\bAI\b/);
    }
  });
});

describe("the banner speaks the person's language", () => {
  it("English unchanged; Bengali and Hindi in their own words and dates", () => {
    expect(billingBannerText(ISSUE)).toBe("Your last payment for Imotara Plus didn't go through on Google Play. Plus stays on until 22 November — update your payment method to keep it.");
    expect(billingButtonText(ISSUE, "bn")).toBe("Google Play-তে পেমেন্ট আপডেট করুন");
    expect(billingBannerText(ISSUE, "hi")).toContain("Google Play पर नहीं हो पाया");
  });
  it("right-to-left only for Arabic, Urdu, Hebrew", () => {
    expect(["ar", "ur", "he", "bn", "en"].map((l) => billingIsRtl(l))).toEqual([true, true, true, false, false]);
  });
  it("the chat screen hands over the chosen language (never 'auto')", () => {
    expect(src("screens/ChatScreen.tsx")).toMatch(/billingLang=\{toneContext\?\.user\?\.preferredLang && toneContext\.user\.preferredLang !== "auto" \? toneContext\.user\.preferredLang : null\}/);
    expect(src("components/chat/ChatInputBar.tsx")).toMatch(/billingButtonText\(billingIssue, billingLang\)/);
  });
});
