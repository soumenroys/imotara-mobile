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
            expect(read(f)).not.toMatch(/local mode is always on|nothing is sent|Local-first|Works offline|saved securely in your Imotara account/);
            expect(read(f)).not.toMatch(/OpenAI|Gemini|Whisper/);
        }
    });
    // 🔄 #94 (owner, 14 Nov 2026): cloud backup is OPT-IN in the app (lib/cloudBackup) ⇒
    //    history stays on the phone unless the person switches backup on. The #127 wording
    //    ('saved in your account by default') became false and is gone; providers never named.
    it("each place says history stays on the phone, backup is off unless switched on, replies go to our service providers", () => {
        expect(read("src/components/imotara/HowItWorksModal.tsx")).toMatch(/Your history stays on your phone, and cloud backup is off unless you switch it on in Settings/);
        expect(read("src/components/imotara/HowItWorksModal.tsx")).toMatch(/To reply, your messages go to our service providers\./);
        expect(read("src/data/featureTips.ts")).toMatch(/Your history stays on your phone, and cloud backup is off unless you switch it on in Settings\. To reply, messages go to our service providers/);
        expect(read("src/screens/SettingsScreen.tsx")).toMatch(/come from our secure servers unless you switch to on-device only/);
        expect(read("src/screens/SettingsScreen.tsx")).toMatch(/cloud\s+backup is off unless you switch it on below/);
    });
});
