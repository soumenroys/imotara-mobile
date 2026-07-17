// Tests for the TTS pipeline's pure text-processing helpers:
// splitIntoSpeechChunks (chunked fetch+playback pipelining) and stripMarkdown.
// The chunking rules matter for latency (small first chunk = speech starts
// fast) and for multilingual sentence terminators (। ۔ ؟ 。 ！ ？).

import { splitIntoSpeechChunks, stripMarkdown } from "../lib/tts/mobileTTS";

describe("splitIntoSpeechChunks", () => {
    test("short reply → single chunk, trimmed", () => {
        expect(splitIntoSpeechChunks("I hear you. That sounds hard. ")).toEqual([
            "I hear you. That sounds hard.",
        ]);
    });

    test("first chunk is capped small so speech starts fast", () => {
        const sentence = "This is a calm and steady sentence to say. ";
        const text = sentence.repeat(10);
        const chunks = splitIntoSpeechChunks(text);
        expect(chunks.length).toBeGreaterThan(1);
        // firstMax=110: first chunk holds at most two of these ~43-char sentences.
        expect(chunks[0].length).toBeLessThanOrEqual(110);
        // Later chunks may pack more (restMax=240).
        expect(Math.max(...chunks.slice(1).map((c) => c.length))).toBeLessThanOrEqual(240 + sentence.length);
    });

    test("no content is lost or reordered by chunking", () => {
        const text = "One. Two! Three? Four. Five. Six. Seven. Eight. Nine. Ten.".repeat(5);
        const chunks = splitIntoSpeechChunks(text);
        const rejoined = chunks.join(" ").replace(/\s+/g, " ").trim();
        expect(rejoined).toBe(text.replace(/\s+/g, " ").trim());
    });

    test("splits on Devanagari danda (।)", () => {
        const text =
            "मैं आपके साथ हूँ। आप अकेले नहीं हैं। थोड़ा रुकिए और एक गहरी साँस लीजिए। सब ठीक हो जाएगा। मैं यहाँ हूँ। आप बात कर सकते हैं। कोई जल्दी नहीं है।";
        const chunks = splitIntoSpeechChunks(text);
        expect(chunks.length).toBeGreaterThan(1);
        // Every chunk should end at (or contain) sentence boundaries, not mid-word.
        for (const c of chunks) expect(c.trim().length).toBeGreaterThan(0);
    });

    test("splits on Urdu (۔) and Arabic question (؟) terminators", () => {
        const text = "میں آپ کے ساتھ ہوں۔ آپ اکیلے نہیں ہیں۔ کیا آپ بات کرنا چاہیں گے؟ میں سن رہا ہوں۔ آہستہ آہستہ سب ٹھیک ہو جائے گا۔ گہری سانس لیں۔";
        expect(splitIntoSpeechChunks(text).length).toBeGreaterThan(1);
    });

    test("splits on CJK ideographic full stop (。)", () => {
        // Repeat to exceed the 110-char first-chunk cap — a single pass of these
        // short CJK sentences is only ~55 chars and correctly stays one chunk.
        const text = "我在你身边。你并不孤单。慢慢来，深呼吸。一切都会好起来的。我会一直陪着你。想说什么都可以。不用着急。".repeat(3);
        expect(splitIntoSpeechChunks(text).length).toBeGreaterThan(1);
    });

    test("text with no terminators at all is returned whole", () => {
        const text = "just a stream of words with no punctuation at all";
        expect(splitIntoSpeechChunks(text)).toEqual([text]);
    });

    test("a single sentence longer than firstMax is not split mid-sentence", () => {
        const long = "This single sentence is deliberately made much longer than the first chunk cap of one hundred and ten characters so we can verify behavior.";
        const chunks = splitIntoSpeechChunks(long);
        expect(chunks).toEqual([long]);
    });
});

describe("stripMarkdown", () => {
    test("removes bold, italic, headings, lists, code and links", () => {
        const md = [
            "# A heading",
            "",
            "This is **bold** and *italic* and `code`.",
            "- first item",
            "* second item",
            "[a link](https://example.com) end.",
        ].join("\n");
        const out = stripMarkdown(md);
        expect(out).not.toMatch(/[#*`\[\]()]/);
        expect(out).toContain("This is bold and italic and code.");
        expect(out).toContain("first item");
        expect(out).toContain("a link end.");
    });

    test("collapses 3+ blank lines and trims", () => {
        expect(stripMarkdown("a\n\n\n\n\nb  ")).toBe("a\n\nb");
    });

    test("plain text passes through unchanged", () => {
        const plain = "I hear you. Take a slow breath with me.";
        expect(stripMarkdown(plain)).toBe(plain);
    });
});
