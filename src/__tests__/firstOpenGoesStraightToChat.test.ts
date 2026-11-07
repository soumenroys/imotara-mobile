// src/__tests__/firstOpenGoesStraightToChat.test.ts
// 🔑 #97a (owner, 7 Nov 2026, option A): first open = welcome → chat. The
// 2-step setup and the 3-step questionnaire (both English only) stood between
// a new person and the message box. The setup is offered once later.
import { readFileSync } from "fs";
import { DEFERRED, FIRST_OPEN_RESULT, shouldOfferDeferredSetup } from "../lib/onboarding/firstRun";

const settings = (name: string, rel?: string) =>
    JSON.stringify({ toneContext: { user: { name }, companion: { relationship: rel } } });

describe("first open applies exactly what 'Skip setup' always applied", () => {
    it("neutral companion, no name, cloud replies", () => {
        expect(FIRST_OPEN_RESULT).toEqual({ name: "", relationship: "prefer_not", analysisMode: "cloud" });
        const modal = readFileSync("src/components/imotara/OnboardingModal.tsx", "utf8");
        expect(modal).toMatch(/onComplete\(\{ name: "", relationship: "prefer_not", analysisMode: "cloud" \}\)/);
    });
});

describe("the setup is offered ONCE, later, and never over a choice already made", () => {
    it("not before a first real conversation", () => {
        expect(shouldOfferDeferredSetup({ onboardingValue: DEFERRED, inviteState: "unseen", storedSettings: settings("") })).toBe(false);
    });
    it("after one, if nothing was personalised ⇒ offered", () => {
        expect(shouldOfferDeferredSetup({ onboardingValue: DEFERRED, inviteState: "declined", storedSettings: settings("", "prefer_not") })).toBe(true);
        expect(shouldOfferDeferredSetup({ onboardingValue: DEFERRED, inviteState: "accepted", storedSettings: null })).toBe(true);
    });
    it("⛔ a name or a style already set in Settings ⇒ never shown", () => {
        expect(shouldOfferDeferredSetup({ onboardingValue: DEFERRED, inviteState: "accepted", storedSettings: settings("Rina") })).toBe(false);
        expect(shouldOfferDeferredSetup({ onboardingValue: DEFERRED, inviteState: "accepted", storedSettings: settings("", "mentor") })).toBe(false);
    });
    it("done ('1') or an old install mid-onboarding (null) ⇒ this rule never shows it", () => {
        expect(shouldOfferDeferredSetup({ onboardingValue: "1", inviteState: "accepted", storedSettings: null })).toBe(false);
        expect(shouldOfferDeferredSetup({ onboardingValue: null, inviteState: "accepted", storedSettings: null })).toBe(false);
    });
    it("unreadable settings ⇒ not shown (never guess)", () => {
        expect(shouldOfferDeferredSetup({ onboardingValue: DEFERRED, inviteState: "accepted", storedSettings: "{bad" })).toBe(false);
    });
});

describe("wiring", () => {
    const nav = readFileSync("src/navigation/RootNavigator.tsx", "utf8");
    const chat = readFileSync("src/screens/ChatScreen.tsx", "utf8");
    it("first open applies the defaults instead of opening the setup", () => {
        expect(nav).toMatch(/if \(!val\) \{\s*await handleOnboardingComplete\(FIRST_OPEN_RESULT, DEFERRED, true\);\s*return;\s*\}/);
        expect(nav).not.toMatch(/if \(!val\) setOnboardingVisible\(true\);/);
    });
    it("the questionnaire no longer opens by itself", () => {
        expect(chat).not.toMatch(/if \(!v\) setIntakeStep\(1\);/);
    });
    it("the privacy tip says what is counted, and never claims 'zero analytics'", () => {
        const tips = readFileSync("src/data/featureTips.ts", "utf8");
        expect(tips).not.toMatch(/collects zero analytics/);
        expect(tips).toMatch(/We only count how many replies you use, to apply your daily limit — never what you write\./);
    });
});
