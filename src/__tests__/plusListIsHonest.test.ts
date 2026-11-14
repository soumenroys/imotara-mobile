// src/__tests__/plusListIsHonest.test.ts
// 🔑 #132 F (12 Nov 2026 audit): the upgrade sheet sold as Plus four things every free user already
// has (cross-device access via EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL + CLOUD_SYNC in free; all
// tones — no tier check anywhere) or that were never built (personas, response length), and listed
// "data residency" for organisations — all data lives in one region. Mirror of the web
// src/__tests__/billing/plusListIsHonest.test.ts.
import { readFileSync } from "fs";
import path from "path";

const sheet = readFileSync(path.join(__dirname, "../components/imotara/UpgradeSheet.tsx"), "utf8");
// Only the strings the person reads (quoted), not the explaining comment.
const shown = (sheet.match(/"[^"\n]*"/g) ?? []).join("\n");

describe("the upgrade sheet sells only what Plus really adds", () => {
  it.each([
    ["personas — never built", /persona/i],
    ["response length — never built", /response length/i],
    ["tones — free for everyone", /all companion tones/i],
    ["cross-device — free for everyone", /cross-device access/i],
    ["data residency — one region only", /residency/i],
  ])("%s", (_why, rx) => {
    expect(shown).not.toMatch(rx);
  });
  it.each([
    ["src/payments/upgradePlans.ts"],
    ["src/components/imotara/PlanSupportQuickPanel.tsx"],
    ["src/screens/SettingsScreen.tsx"],
  ])("%s does not sell free features or a 90-day cap", (file) => {
    const src = readFileSync(path.join(__dirname, "../..", file), "utf8");
    expect(src).not.toMatch(/all companion tones|cross-device access|90-day history/i);
  });
  it("the organisation blurb does not promise data residency either", () => {
    expect(sheet).not.toMatch(/data residency/i);
  });
});
