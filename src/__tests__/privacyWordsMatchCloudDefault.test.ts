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
        for (const f of ["src/components/imotara/HowItWorksModal.tsx", "src/data/featureTips.ts", "src/components/chat/DiscoveryCard.tsx", "src/data/settingsCatalog.ts"]) {
            expect(read(f)).not.toMatch(/kept on your device|stays on your phone|local mode is always on|nothing is sent|Local-first|Works offline/);
            expect(read(f)).not.toMatch(/OpenAI|Gemini|Whisper/);
        }
    });
    // 🔄 #127 (11 Nov 2026): history is SAVED IN THE ACCOUNT by default (the app auto-syncs for everyone),
    //    so the screens say that — never "kept on your device" — and never name the providers (owner).
    it("each place now says history is saved in the account and replies go to our service providers", () => {
        expect(read("src/components/imotara/HowItWorksModal.tsx")).toMatch(/Your conversations are saved securely in your Imotara account\. To reply, your messages go to our service providers\./);
        expect(read("src/data/featureTips.ts")).toMatch(/saved securely in your Imotara account\. To reply, messages go to our service providers/);
        expect(read("src/screens/SettingsScreen.tsx")).toMatch(/come from our secure servers unless you switch to on-device only/);
    });
});
