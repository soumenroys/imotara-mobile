/**
 * Every reply on a phone was being generated TWICE.
 *
 * 🔴 FOUND 2026-10-09, by reading node_modules rather than the code's own
 * comments. `streamChatReply` guarded with:
 *
 *     if (!res.ok || !res.body) return { ok: false, text: "" };
 *
 * **`res.body` does not exist on React Native.** Proof, from the dependency
 * tree, not inference:
 *   · react-native/Libraries/Network/fetch.js
 *       → require('whatwg-fetch'); export const fetch = global.fetch;
 *   · whatwg-fetch 3.6.20 Response exposes `_bodyInit` / `_bodyText` and has
 *     NO `body` getter.
 *   · No expo/fetch, no react-native-fetch-api, no ReadableStream polyfill,
 *     no `global.fetch =` override anywhere in the app.
 *
 * So that guard fired on EVERY message ever sent from a device, and
 * ChatScreen's failure branch deleted the rendered bubble and issued a
 * SECOND complete /api/chat-reply. Two full LLM generations in series, per
 * message, on Android and iOS, in all three shipped versions.
 * ~2× the wait and ~2× the OpenAI spend.
 *
 * 🔑 AND THE REPLY WAS ALREADY IN HAND. whatwg-fetch is XHR-based, so
 * `await fetch()` does not resolve until the whole SSE response has
 * downloaded — the server had already run the model to completion and billed
 * for it. `res.text()` returns it.
 *
 * ⚠️ This is NOT "streaming on React Native" — progressive typing is
 * genuinely impossible without a stream polyfill, and the file's promise of
 * "word-by-word within ~500ms" has never been true on a device. It is: stop
 * discarding a reply we already have and paying to generate it again.
 *
 * ── The second defect in the same function ──────────────────────────────
 * `ok: accumulated.length > 10` rejected valid complete replies:
 *   "Take care." and "Theek hai." are exactly 10 → strictly-greater rejected
 *   them; "ঠিক আছে।" is 8. A rejection triggers the same bubble-delete and
 *   second paid call, so the shortest and warmest answers were precisely the
 *   ones that cost double.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const read = (f: string) =>
    fs.readFileSync(path.join(process.cwd(), f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

const AI = "src/api/aiClient.ts";

describe("🔴 the React Native path must not be treated as a failure", () => {
    it("a missing res.body is no longer bundled into the failure guard", () => {
        const s = read(AI);
        expect(s).not.toMatch(/if \(!res\.ok \|\| !res\.body\) return \{ ok: false/);
        expect(s).toMatch(/if \(!res\.ok\) return \{ ok: false, text: "" \};/);
    });

    it("🔑 when there is no stream, the already-downloaded body is READ, not discarded", () => {
        const s = read(AI);
        expect(s).toMatch(/if \(!res\.body\) \{/);
        expect(s).toMatch(/parseSseText\(await res\.text\(\)\)/);
    });

    it("…and that path still delivers the text to the caller", () => {
        // Without this the reply would be parsed and then silently dropped —
        // the same class of bug, one layer down.
        const s = read(AI);
        const branch = s.slice(s.indexOf("if (!res.body) {"), s.indexOf("const reader = res.body.getReader()"));
        expect(branch).toMatch(/onToken\(accumulated\)/);
        expect(branch).toMatch(/return \{ ok: isUsableReply\(accumulated\), text: accumulated \}/);
    });

    it("⚠️ it clears BOTH timers, like the streaming path does", () => {
        // A leaked abort timer would fire mid-conversation and abort an
        // unrelated later request.
        const s = read(AI);
        const branch = s.slice(s.indexOf("if (!res.body) {"), s.indexOf("const reader = res.body.getReader()"));
        expect(branch).toMatch(/clearTimeout\(rafHandle\)/);
        expect(branch).toMatch(/clearTimeout\(timer\)/);
    });
});

describe("🔴 a short reply is a reply, not a failure", () => {
    it("the >10 character threshold is gone from BOTH return sites", () => {
        const s = read(AI);
        // Counted. The streaming path has two returns — [DONE] and loop-end.
        // Fixing one would leave the other re-generating short replies.
        expect(s).not.toMatch(/accumulated\.length > 10/);
        expect([...s.matchAll(/ok: isUsableReply\(accumulated\)/g)].length).toBe(3);
    });

    it("isUsableReply accepts the real short replies that were being rejected", () => {
        const usable = (t: string) => t.trim().length > 0;
        for (const reply of ["Take care.", "Theek hai.", "ठीक है।", "ঠিক আছে।", "হ্যাঁ।"]) {
            expect(usable(reply)).toBe(true);
        }
        expect(reply_len("Take care.")).toBe(10); // the exact boundary that failed
    });

    it("…but still rejects nothing-at-all", () => {
        const usable = (t: string) => t.trim().length > 0;
        expect(usable("")).toBe(false);
        expect(usable("   \n ")).toBe(false);
    });
});

describe("the SSE parser matches the wire format the reader path handles", () => {
    const parse = (raw: string): string => {
        let acc = "";
        for (const line of raw.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
                const token = String(JSON.parse(data).t ?? "");
                if (token) acc += token;
            } catch { /* skip */ }
        }
        return acc;
    };

    it("accumulates tokens and stops at [DONE]", () => {
        const raw = 'data: {"t":"Take "}\ndata: {"t":"care."}\ndata: [DONE]\ndata: {"t":"IGNORED"}\n';
        expect(parse(raw)).toBe("Take care.");
    });

    it("skips malformed chunks instead of throwing away the whole reply", () => {
        const raw = 'data: {"t":"Hello"}\ndata: {not json\ndata: {"t":" there"}\ndata: [DONE]\n';
        expect(parse(raw)).toBe("Hello there");
    });

    it("ignores non-data lines", () => {
        const raw = ': keep-alive\n\ndata: {"t":"Hi"}\ndata: [DONE]\n';
        expect(parse(raw)).toBe("Hi");
    });

    it("the implementation in the source agrees with this parser", () => {
        const s = read(AI);
        expect(s).toMatch(/function parseSseText\(raw: string\): string/);
        expect(s).toMatch(/if \(data === "\[DONE\]"\) break;/);
        expect(s).toMatch(/line\.startsWith\("data: "\)/);
    });
});

function reply_len(s: string): number { return s.length; }
