/**
 * The individual-reporting consent checkbox, mobile side (Android + iOS).
 *
 * 🔑 THE PROMISE THE COPY MUST MAKE, from the owner's spec (2026-10-05):
 * switching this OFF means the org admin sees no user-specific data — but the
 * person is STILL counted in the organisation's aggregate.
 *
 * 🔴 WHY THE WORDING IS TESTED AND NOT JUST THE WIRING. A consent control that
 * does not say what opting out actually does is not consent, it is a switch.
 * Someone on an organisational licence has to be able to tell, from this screen
 * alone, that turning it off hides them as an individual and does NOT remove
 * them from their organisation's totals. If that sentence disappears, the
 * feature still "works" and the promise is broken silently — which is exactly
 * the kind of regression no functional test would catch.
 *
 * ⚠️ One file serves BOTH Android and iOS, so this covers both.
 */

import fs from "fs";
import path from "path";

const SETTINGS = () =>
  fs.readFileSync(path.join(process.cwd(), "src/screens/SettingsScreen.tsx"), "utf8");

/** Strip comments — the block's own explanation restates the promise. */
const code = () =>
  SETTINGS().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the control is wired to the server", () => {
  it("reads the member's current consent", () => {
    expect(code()).toContain("/api/org/report-consent");
  });

  it("sends PATCH with a boolean", () => {
    const s = code();
    expect(s).toMatch(/method:\s*"PATCH"/);
    expect(s).toMatch(/JSON\.stringify\(\{\s*consent:\s*next\s*\}\)/);
  });

  it("authenticates with the bearer token", () => {
    const s = code();
    const i = s.indexOf("/api/org/report-consent");
    expect(s.slice(i, i + 400)).toContain("Authorization");
  });
});

describe("it is shown only to someone it applies to", () => {
  it("renders nothing unless the server says applicable", () => {
    // A personal user must never see a control implying someone could be
    // watching them.
    expect(code()).toMatch(/\{reportConsentApplicable\s*&&/);
  });

  it("hides it again when the user signs out", () => {
    const s = code();
    expect(s).toMatch(/if\s*\(!accessToken\)\s*\{\s*setReportConsentApplicable\(false\)/);
  });
});

describe("🔴 the copy tells the truth about opting out", () => {
  it("says the admin will see nothing about them specifically", () => {
    expect(SETTINGS()).toMatch(/no information about you specifically/i);
  });

  it("says they are STILL in the organisation's aggregate", () => {
    // The half people get wrong. Without it, opting out looks like opting out
    // of being counted, which is not what happens.
    expect(SETTINGS()).toMatch(/still count[\s\S]{0,60}organisation/i);
  });

  it("promises conversation contents are never shown to anyone", () => {
    expect(SETTINGS()).toMatch(/never shows anyone the contents/i);
  });
});

describe("a failed save never leaves a false promise on screen", () => {
  it("reverts the toggle when the request fails", () => {
    // Showing "off" while the server still has "on" would be the worst
    // possible failure for a privacy control.
    const s = code();
    const fn = s.slice(s.indexOf("const toggleReportConsent"));
    expect(fn).toMatch(/if\s*\(!r\.ok\)\s*setReportConsent\(!next\)/);
    expect(fn).toMatch(/catch\s*\{[\s\S]{0,80}setReportConsent\(!next\)/);
  });
});
