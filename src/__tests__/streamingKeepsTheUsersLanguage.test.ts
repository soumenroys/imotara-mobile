/**
 * A Bengali message must not get an English reply.
 *
 * 🔴 THE NEAR-MISS, 2026-10-09. Two paths resolved the reply language, and
 * one of them was wrong:
 *
 *   JSON path     (aiClient.callImotaraAI)  → explicit > stated > detected > en
 *   STREAMING path (ChatScreen payload)     → concreteLang(preferredLang)
 *
 * `concreteLang` maps "auto" — the default — to "en". The server does NOT
 * re-detect: chat-reply/route.ts:833 reads `body.lang` verbatim, and on "en"
 * injects "LANGUAGE: Always respond in English. Even if the user's messages
 * contain text in another script or language, reply in English only — do not
 * mirror their non-English script."
 *
 * ⚠️ Why nobody ever saw it: `res.body` does not exist on React Native, so
 * streaming ALWAYS failed and every message fell through to the JSON path.
 * The device verification behind commit 8a1577e — "ami khub valo nei tumi
 * kemon acho" answered in Bengali on a real phone — passed through that
 * fallback, not through the path it appeared to test.
 *
 * 🔑 So fixing res.body (0ff56cb, the same day) would have made the broken
 * payload live for the first time, turning that verified Bengali reply back
 * into English — re-introducing the exact bug 8a1577e was written to fix.
 * Caught in review before any build was cut.
 *
 * ⛔ The root cause was TWO COPIES of one decision. There is now one:
 * resolveReplyLang. These tests fail if a second copy reappears.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const code = (f: string) =>
    raw(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const AI = "src/api/aiClient.ts";
const CHAT = "src/screens/ChatScreen.tsx";

describe("🔴 the streaming payload must not flatten the user's language", () => {
    it("⛔ the streaming payload does NOT use concreteLang", () => {
        const s = code(CHAT);
        // The exact shape of the bug. concreteLang("auto") === "en".
        expect(s).not.toMatch(/lang: concreteLang\(toneContext\?\.user\?\.preferredLang\)/);
    });

    it("…it resolves from the MESSAGE, which is the only thing that knows", () => {
        const s = code(CHAT);
        expect(s).toMatch(/lang: resolveReplyLang\(aiMessage, toneContext\?\.user\?\.preferredLang\)/);
    });

    it("🔑 both paths now call the SAME function", () => {
        const s = code(AI);
        expect(s).toMatch(/export function resolveReplyLang\(/);
        // callImotaraAI delegates rather than repeating the logic
        expect(s).toMatch(/const chatReplyLang = resolveReplyLang\(/);
    });

    it("⚠️ and callImotaraAI no longer has its own copy", () => {
        // Two copies of one decision is what caused this. If the inline block
        // comes back, they can diverge again and nothing will notice for weeks.
        const s = code(AI);
        expect(s).not.toMatch(/const _detectedLang = _scriptLang !== "en"/);
        expect(s).not.toMatch(/_explicitLang \|\| _profileLang/);
    });
});

describe("🔴 the resolution order is the one that was device-verified", () => {
    // Mirrors resolveReplyLang so the ORDER is asserted, not just its presence.
    const AUTO = "auto";
    const resolve = (
        explicit: string | null,
        profileRaw: string | undefined,
        detected: string,
    ): string => {
        const profile =
            !profileRaw || profileRaw.trim().toLowerCase() === AUTO
                ? undefined
                : profileRaw.trim().toLowerCase();
        return explicit || profile || (detected !== "en" ? detected : "en");
    };

    it('"auto" falls through to detection — it does NOT become English', () => {
        // The whole bug in one assertion.
        expect(resolve(null, "auto", "bn")).toBe("bn");
        expect(resolve(null, undefined, "bn")).toBe("bn");
    });

    it("an explicit switch request outranks everything", () => {
        expect(resolve("hi", "bn", "ta")).toBe("hi");
    });

    it("a stated preference outranks detection", () => {
        // Someone who deliberately chose Bengali keeps Bengali even when a
        // single English word trips the romanized hints.
        expect(resolve(null, "bn", "gu")).toBe("bn");
    });

    it("detection is used only when nothing was stated", () => {
        expect(resolve(null, "auto", "ta")).toBe("ta");
        expect(resolve(null, "auto", "en")).toBe("en");
    });
});

describe("the resolver reads the real signals, in the real order", () => {
    it("it consults explicit request, script, and roman hints", () => {
        const s = code(AI);
        const fn = s.slice(s.indexOf("export function resolveReplyLang"));
        const body = fn.slice(0, fn.indexOf("\n}"));
        expect(body).toMatch(/detectExplicitLangRequest\(message\)/);
        expect(body).toMatch(/detectLangFromScript\(message\)/);
        expect(body).toMatch(/detectLangFromRomanHints\(message\)/);
        expect(body).toMatch(/statedPreference\(preferredLang\)/);
    });

    it("⚠️ roman hints run only when script detection found nothing", () => {
        // Script is the stronger signal. Running the 1-hit roman table on
        // native-script text would let an English word override real Bengali.
        const s = code(AI);
        expect(s).toMatch(/script !== "en" \? script : detectLangFromRomanHints\(message\)/);
    });

    it("🔑 the SOURCE returns them in that precedence, not just the mirror above", () => {
        // ⚠️ Added after mutation testing: flipping explicit/profile in the real
        // function left every other test green, because the order was only ever
        // asserted against this file's own mirror. A mirror cannot catch a
        // change to the thing it mirrors.
        //
        // The order is behaviour: if a stated preference outranked an explicit
        // "reply in Hindi", nobody could switch language mid-conversation.
        const s = code(AI);
        expect(s).toMatch(
            /return explicit \|\| profile \|\| \(detected !== "en" \? detected : "en"\);/,
        );
    });

    it("✅ concreteLang still exists — it is correct for voices and locales", () => {
        // Not a deprecation. "auto" is a real language nowhere except here.
        const s = code(AI);
        expect(s).toMatch(/export function concreteLang\(/);
        expect(code(CHAT)).toMatch(/concreteLang\(toneContext\?\.user\?\.preferredLang\)/);
    });
});
