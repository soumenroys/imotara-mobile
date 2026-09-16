/**
 * The companion's chosen name is used where the COMPANION speaks; the product
 * name stays where the PRODUCT is meant.
 *
 * Owner, 2026-09-16: "if user specify the companion name in the setting page,
 * still the texts are showing in this app as 'Imotara'".
 *
 * The trap this file guards is that "Imotara" is two different things wearing
 * one word — the companion's default name AND the brand. A blanket rename would
 * turn "[Imotara] Bug Report" into "[Maya] Bug Report", tell someone to log
 * into their "Maya account", and export a journal from a product that does not
 * exist. So every string here was classified by hand, and the brand ones are
 * pinned as UNCHANGED just as firmly as the companion ones are pinned as changed.
 */
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const CHAT = strip(read("screens/ChatScreen.tsx"));
const VOICE = strip(read("hooks/useVoiceInput.ts"));

describe("companion-voice strings follow the chosen name", () => {
    it("the low-mood hint helpers take the name instead of hardcoding it", () => {
        expect(CHAT).toMatch(/function getLocalMoodHint\(text: string, companionName = "Imotara"\)/);
        expect(CHAT).toMatch(/function getLocalMoodHintWithPrimary\(text: string, companionName = "Imotara"\)/);
        // all three occurrences of the sad hint use the parameter
        const hits = CHAT.match(/It's okay to feel this way — \$\{companionName\} is here with you\./g) ?? [];
        expect(hits).toHaveLength(3);
        expect(CHAT).not.toMatch(/It's okay to feel this way — Imotara is here with you\./);
    });

    it("...and every in-component call passes the effective name", () => {
        expect(CHAT).toMatch(/getLocalMoodHintWithPrimary\(trimmed, effectiveCompanionName\)/);
        expect(CHAT).toMatch(/getLocalMoodHint\(latestUserMessage\.text, effectiveCompanionName\)/);
        // the memo must re-run when the name changes, or the old name lingers
        expect(CHAT).toMatch(/\[emotionInsightsEnabled, latestUserMessage, effectiveCompanionName\]/);
    });

    it.each([
        ["offline banner",   /You're offline — \$\{effectiveCompanionName\} will reply using on-device mode/],
        ["empty-state line", /Start by sharing how you feel — \{effectiveCompanionName\} listens without judgment\./],
        ["first-time tip",   /Just talk — \$\{effectiveCompanionName\} listens without judgment\./],
        ["unsent letter",    /— \{effectiveCompanionName\} will/],
        ["grief space",      /Grief &amp; Loss space — \{effectiveCompanionName\} will hold this with you/],
        ["trial notice",     /After your trial, \{effectiveCompanionName\} keeps working/],
    ])("%s speaks as the companion", (_label, re) => {
        expect(CHAT).toMatch(re);
    });
});

describe("⚠️ brand strings are UNCHANGED — the product is still called Imotara", () => {
    it.each([
        ["chat export header", /Imotara Chat Export/],
        ["share sheet title",  /title: "Imotara Chat"/],
        ["account instruction", /login into Imotara account from Settings/],
        ["product welcome",    /"Welcome to Imotara\."/],
        ["error log prefix",   /"Imotara mobile AI error:"/],
    ])("%s still says Imotara", (_label, re) => {
        expect(CHAT).toMatch(re);
    });
});

describe("Whisper is hinted with the companion's name, not the product's", () => {
    it("useVoiceInput accepts and forwards the companion name", () => {
        expect(VOICE).toMatch(/companionName\?: string;/);
        expect(VOICE).toMatch(/parameters: \{ lang, \.\.\.\(companionName \? \{ companionName \} : \{\}\) \}/);
        expect(VOICE).toMatch(/companionNameRef\.current\)/);
    });

    it("ChatScreen supplies it — via state, because toneContext is declared later", () => {
        // Reading toneContext directly at the useVoiceInput call is a TS2448
        // (used before declaration). The bridge state is what makes it work.
        expect(CHAT).toMatch(/companionName: voiceCompanionName,/);
        expect(CHAT).toMatch(/setVoiceCompanionName\(toneContext\?\.companion\?\.name\?\.trim\(\) \|\| undefined\)/);
    });
});
