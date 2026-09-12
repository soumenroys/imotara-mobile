/**
 * One stray character must not switch the conversation's language.
 *
 * Found on a real phone, 2026-09-12: with the network off, the message
 * "no network test" — plain English — came back answered in Bengali. The
 * trigger was a single "শ" accidentally left on the end of an EARLIER message,
 * because the check was a bare `/[ঀ-৿]/.test(prev)`. A pasted name,
 * a keyboard slip, or one borrowed word does the same thing.
 *
 * These tests drive detectLanguage through its real entry point rather than
 * the private helper, so they keep holding if the internals are reshaped.
 */
import { buildLocalReply } from "../lib/ai/local/localReplyEngine";

/** Which language did the engine answer in? Judged by script/keyword. */
function scriptOf(text: string): "bengali" | "devanagari" | "latin" | "empty" {
    if (!text.trim()) return "empty";
    if (/[ঀ-৿]/.test(text)) return "bengali";
    if (/[ऀ-ॿ]/.test(text)) return "devanagari";
    return "latin";
}

/** Romanised Bengali gives a Latin-script reply, so check for its markers too. */
function looksBengali(text: string): boolean {
    return scriptOf(text) === "bengali" ||
        /\b(ami|tumi|tomar|achi|achhi|korchi|bolo|kotha|shathe|sathe)\b/i.test(text);
}

describe("a stray character must not change the language", () => {
    it("answers English in English despite one Bengali char in an earlier message", () => {
        const reply = buildLocalReply("no network test", undefined, { recentUserTexts: ["offline test messageশ"] });
        expect(looksBengali(reply.message)).toBe(false);
    });

    it("stays English when an earlier message carries a Bengali name only", () => {
        // "hmm" has no language signal, so this really does reach the history
        // check — with "I am feeling low today" the English path answered first
        // and the test passed without exercising anything.
        const reply = buildLocalReply("hmm", undefined, {
            recentUserTexts: ["my name is শাশ্বতী and I work in Kolkata"],
        });
        expect(looksBengali(reply.message)).toBe(false);
    });

    it("stays English for a single Devanagari glyph", () => {
        const reply = buildLocalReply("just tired", undefined, { recentUserTexts: ["ok क"] });
        expect(scriptOf(reply.message)).not.toBe("devanagari");
    });
});

describe("REAL non-English conversations must still be recognised", () => {
    // "hmm" carries no language signal of its own, so the engine has to fall
    // through to history — which is exactly the path being guarded.
    it("still answers Bengali when the previous message is genuinely Bengali", () => {
        const reply = buildLocalReply("hmm", undefined, {
            recentUserTexts: ["আমার মন খুব খারাপ লাগছে আজকে"],
        });
        expect(looksBengali(reply.message)).toBe(true);
    });

    it("still answers Hindi when the previous message is genuinely Hindi", () => {
        const reply = buildLocalReply("hmm", undefined, {
            recentUserTexts: ["मुझे आज बहुत अकेला महसूस हो रहा है"],
        });
        expect(/[ऀ-ॿ]/.test(reply.message) || /\b(tumne|tumhare|thoda|batao|baat|aur)\b/i.test(reply.message)).toBe(true);
    });

    it("the same neutral message goes English when history is only a stray glyph", () => {
        // The pair that proves the guard is doing the work: identical input,
        // the only difference is whether the history is really in that script.
        const reply = buildLocalReply("hmm", undefined, {
            recentUserTexts: ["offline test message\u09b6"],
        });
        expect(looksBengali(reply.message)).toBe(false);
    });
});
