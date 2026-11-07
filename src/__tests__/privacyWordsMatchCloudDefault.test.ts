// src/__tests__/privacyWordsMatchCloudDefault.test.ts
// 🔑 #94 / #97b (owner, 7 Nov 2026): the onboarding sets analysisMode "cloud",
// so no screen may say messages stay on the device by default. Owner chose to
// fix the WORDS (same decision as the website).
import { readFileSync } from "fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("while onboarding defaults to cloud replies, no screen says otherwise", () => {
    it("the default really is cloud (if this changes, revisit the words)", () => {
        expect(read("src/components/imotara/OnboardingModal.tsx")).toMatch(/analysisMode: "cloud"/);
    });
    it("⛔ the old untrue sentences are gone", () => {
        expect(read("src/screens/SettingsScreen.tsx")).not.toMatch(/By default your messages stay on this/);
        expect(read("src/components/imotara/HowItWorksModal.tsx")).not.toMatch(/stays on your device unless you choose to sync/);
        expect(read("src/data/featureTips.ts")).not.toMatch(/stored only on your device by default/);
    });
    it("each place now says replies use our servers, and where to switch", () => {
        expect(read("src/components/imotara/HowItWorksModal.tsx")).toMatch(/To reply, your messages go to our secure servers — you can switch to on-device only in Settings\./);
        expect(read("src/data/featureTips.ts")).toMatch(/Replies come from our secure servers by default/);
        expect(read("src/screens/SettingsScreen.tsx")).toMatch(/come from our secure servers unless you switch to on-device only/);
    });
});
