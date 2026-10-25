import fs from "fs";
import path from "path";
import { WARM_WELCOME, warmWelcomeText } from "../lib/welcome/warmWelcome";
import { INVITE } from "../notifications/checkInInvite";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", "..", p), "utf8");

describe("the warm welcome speaks every language the app does", () => {
    it("covers exactly the check-in invite's 22 languages", () => {
        expect(Object.keys(WARM_WELCOME).sort()).toEqual(Object.keys(INVITE).sort());
    });

    it("has no empty line in any language", () => {
        const empty = Object.entries(WARM_WELCOME).filter(([, w]) => !w.hello.trim() || !w.glad.trim() || !w.ask.trim()).map(([k]) => k);
        expect(empty).toEqual([]);
    });

    it("greets by name, and reads naturally without one", () => {
        expect(warmWelcomeText("en", "Asha")).toBe("Hi, Asha — I'm glad you're here. What's on your mind today?");
        expect(warmWelcomeText("en")).toBe("Hi! I'm glad you're here. What's on your mind today?");
        expect(warmWelcomeText("bn", "Asha")).toBe("হ্যালো, Asha। তুমি এসেছ, ভালো লাগল। আজ মনে কী চলছে?");
        expect(warmWelcomeText("ja", "Asha")).toBe("こんにちは、Ashaさん。来てくれてうれしいです。今日はどんなことを考えていますか？");
    });

    it("Bengali uses তুমি — the owner's default voice for replies", () => {
        expect(WARM_WELCOME.bn.glad).toMatch(/তুমি/);
        expect(WARM_WELCOME.bn.glad).not.toMatch(/আপনি/);
    });

    it("falls back to English for an unknown or regional code", () => {
        expect(warmWelcomeText("xx")).toBe(warmWelcomeText("en"));
        expect(warmWelcomeText("hi-IN")).toBe(warmWelcomeText("hi"));
    });

    it("never asks the step card's question twice", () => {
        expect(WARM_WELCOME.en.ask).not.toMatch(/how are you feeling right now/i);
    });
});

describe("ChatScreen shows it — display only", () => {
    const src = read("src/screens/ChatScreen.tsx");

    it("renders the welcome in the empty conversation, replacing the grey English lines", () => {
        expect(src).toMatch(/warmWelcomeText\(welcomeLang\(toneContext\?\.user\?\.preferredLang\), toneContext\?\.user\?\.name\)/);
        expect(src).not.toMatch(/Start by sharing how you feel — \{effectiveCompanionName\} listens without judgment\./);
    });

    it("⛔ 'auto' falls to the device locale, never straight to English", () => {
        const fn = src.slice(src.indexOf("function welcomeLang("), src.indexOf("function welcomeLang(") + 400);
        expect(fn).toMatch(/if \(preferred && preferred !== "auto"\) return preferred;/);
        expect(fn).toMatch(/resolvedOptions\(\)\.locale/);
    });

    it("⛔ is never added to messages or History (so it never reaches the model)", () => {
        expect(src).not.toMatch(/addToHistory\([^)]*warmWelcome/);
        expect(src).not.toMatch(/setMessages\([^)]*warmWelcome/);
    });
});

// The web twin must say exactly the same words.
const WEB = path.resolve(__dirname, "../../../imotaraapp/src/lib/imotara/warmWelcome.ts");
(fs.existsSync(WEB) ? describe : describe.skip)("web and mobile say the same words", () => {
    it("the WARM_WELCOME dictionary is byte-identical", () => {
        const pick = (s: string) => s.slice(s.indexOf("export const WARM_WELCOME"), s.indexOf("};", s.indexOf("export const WARM_WELCOME")) + 2);
        expect(pick(fs.readFileSync(WEB, "utf8"))).toBe(pick(read("src/lib/welcome/warmWelcome.ts")));
    });
});
