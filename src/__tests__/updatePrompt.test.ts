// src/__tests__/updatePrompt.test.ts
// Owner, 7 Nov 2026: when a newer version is in the store, people who have used
// the app before see "A new version of Imotara is available — Update / Not now"
// when they open it. ⛔ Never on the first open.
import { readFileSync } from "fs";
import { join } from "path";
import { INVITE } from "../notifications/checkInInvite";
import { isNewer, shouldOfferUpdate, updateStrings, UPDATE_LANGS, STORE_URL } from "../lib/update/updatePrompt";

describe("is the store's version newer?", () => {
  it("compares major.minor.patch, ignoring a build suffix", () => {
    expect(isNewer("1.6.6", "1.6.5")).toBe(true);
    expect(isNewer("1.7.0", "1.6.9+169")).toBe(true);
    expect(isNewer("1.6.5", "1.6.5")).toBe(false);
    expect(isNewer("1.6.4", "1.6.5")).toBe(false);
    expect(isNewer("2.0.0", "1.9.9")).toBe(true);
  });
  it("⛔ unsure ⇒ never nag (missing, null, 'unknown', garbage)", () => {
    expect(isNewer(null, "1.6.5")).toBe(false);
    expect(isNewer(undefined, "1.6.5")).toBe(false);
    expect(isNewer("1.6.6", "unknown")).toBe(false);
    expect(isNewer("latest", "1.6.5")).toBe(false);
  });
});

describe("⛔ never on the first open", () => {
  it("first open ⇒ no notice even when a newer version exists", () => {
    expect(shouldOfferUpdate({ firstOpen: true, installed: "1.6.5", latest: "1.6.6" })).toBe(false);
    expect(shouldOfferUpdate({ firstOpen: false, installed: "1.6.5", latest: "1.6.6" })).toBe(true);
  });
  it("the server sending nothing (the default) ⇒ no notice", () => {
    expect(shouldOfferUpdate({ firstOpen: false, installed: "1.6.5", latest: null })).toBe(false);
  });
  const nav = readFileSync(join(__dirname, "../navigation/RootNavigator.tsx"), "utf8");
  it("usedBefore is set only AFTER the first-open branch has returned", () => {
    const firstOpenReturn = nav.indexOf("await handleOnboardingComplete(FIRST_OPEN_RESULT, DEFERRED);");
    const ret = nav.indexOf("return;", firstOpenReturn);
    const set = nav.indexOf("setUsedBefore(true);");
    expect(firstOpenReturn).toBeGreaterThan(0);
    expect(set).toBeGreaterThan(ret);
    expect(nav.slice(ret, set)).toMatch(/^return;[^\n]*\n\s*\}\s*\n\s*$/);
  });
  it("the check refuses to run until usedBefore is true", () => {
    expect(nav).toMatch(/if \(!usedBefore \|\| !STORE_PLATFORM\) return;/);
  });
  it("the check also runs when the app comes back to the front", () => {
    expect(nav).toMatch(/onForeground: \(\) => \{ void runResumeSync\(\); void checkForUpdate\(\); \}/);
  });
});

describe("words in all 22 languages", () => {
  it("the same 22 languages as the check-in card", () => {
    expect([...UPDATE_LANGS].sort()).toEqual(Object.keys(INVITE).sort());
    expect(UPDATE_LANGS).toHaveLength(22);
  });
  it("chosen chat language first, then the phone's language, then English", () => {
    expect(updateStrings("bn", "en-US").title).toBe("Imotara-র নতুন ভার্সন এসেছে।");
    expect(updateStrings("auto", "hi-IN").update).toBe("अपडेट करें");
    expect(updateStrings("auto", "xx-YY").title).toBe("A new version of Imotara is available.");
    expect(updateStrings(null, null).lang).toBe("en");
  });
  it("'Not now' is the check-in card's own words", () => {
    for (const l of UPDATE_LANGS) expect(updateStrings(l).later).toBe(INVITE[l].later);
  });
  it("every title names Imotara", () => {
    for (const l of UPDATE_LANGS) expect(updateStrings(l).title).toContain("Imotara");
  });
});

describe("store pages", () => {
  it("point at Imotara's own listing", () => {
    expect(STORE_URL.ios.web).toContain("id6756697569");
    expect(STORE_URL.android.web).toContain("id=com.imotara.imotara");
  });
});
