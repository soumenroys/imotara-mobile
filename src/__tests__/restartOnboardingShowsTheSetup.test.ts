// src/__tests__/restartOnboardingShowsTheSetup.test.ts
// 🔴 Found 7 Nov 2026 (1.6.5, in review): Settings → "Restart onboarding"
// REMOVED the onboarding key — and since #97a an empty key means "first open",
// so the setup never appeared; instead the first-open defaults were applied:
// companion style reset to neutral and replies switched to CLOUD, silently,
// even for someone who had chosen on-device only. The setup screen itself also
// always set "cloud" and Skip erased a chosen style.
import { readFileSync } from "fs";
import { join } from "path";
import { RESTART, applyOnboardingResult, FIRST_OPEN_RESULT } from "../lib/onboarding/firstRun";

describe("what a finished or skipped setup may change", () => {
  it("⛔ never the on-device/cloud choice — except on a true first open", () => {
    expect(applyOnboardingResult({ name: "Asha", relationship: "friend", analysisMode: "cloud" }, {}, false).analysisMode).toBeNull();
    expect(applyOnboardingResult(FIRST_OPEN_RESULT, {}, true).analysisMode).toBe("cloud");
  });
  it("⛔ Skip never erases a style already chosen", () => {
    expect(applyOnboardingResult({ name: "", relationship: "prefer_not", analysisMode: "cloud" }, { relationship: "mentor" }, false).relationship).toBe("mentor");
  });
  it("a style picked in the setup wins", () => {
    expect(applyOnboardingResult({ name: "", relationship: "coach", analysisMode: "cloud" }, { relationship: "mentor" }, false).relationship).toBe("coach");
  });
});

describe("wiring", () => {
  const settings = readFileSync(join(__dirname, "../screens/SettingsScreen.tsx"), "utf8");
  const nav = readFileSync(join(__dirname, "../navigation/RootNavigator.tsx"), "utf8");
  it("Restart stores the RESTART marker, never an empty key", () => {
    expect(settings).toMatch(new RegExp(`AsyncStorage\\.setItem\\(ONBOARDING_DONE_KEY, "${RESTART}"\\)`));
    expect(settings).not.toMatch(/AsyncStorage\.removeItem\(ONBOARDING_DONE_KEY\)/);
  });
  it("the marker opens the setup — before any deferred logic, after the first-open branch", () => {
    const first = nav.indexOf("await handleOnboardingComplete(FIRST_OPEN_RESULT, DEFERRED, true);");
    const restart = nav.indexOf("if (val === RESTART) {");
    const deferred = nav.indexOf("if (val === DEFERRED) {");
    expect(first).toBeGreaterThan(0);
    expect(restart).toBeGreaterThan(first);
    expect(deferred).toBeGreaterThan(restart);
    expect(nav.slice(restart, restart + 80)).toMatch(/setOnboardingVisible\(true\);/);
  });
  it("only the first-open call passes firstOpen = true; the modal's call does not", () => {
    expect(nav.match(/handleOnboardingComplete\([^)]*, true\)/g)).toHaveLength(1);
    expect(nav).toMatch(/onComplete=\{\(result\) => \{ void handleOnboardingComplete\(result\); \}\}/);
  });
});
