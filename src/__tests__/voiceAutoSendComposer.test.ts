import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"),
    "utf8"
);

/**
 * The voice → text → auto-submit → spoken-reply flow (owner, 2026-09-13).
 *
 * The owner's wording was: speech "will be converted to text from microphone
 * and show into text box[,] that reply will be submitted automatically and can
 * be spoken through speaker". The pieces all existed; what did not match was
 * that auto-send bypassed the composer completely.
 *
 * That was not merely cosmetic. handleSend has early returns that fire BEFORE
 * it clears the input — over the character limit, and much more commonly
 * `isTyping || isSendingRef.current` while the previous reply is still
 * arriving. On that path the transcription was neither sent nor left in the
 * box: the person spoke and it vanished.
 */

/** The body of onTranscript, where the delivery decision is made. */
function onTranscriptBody(): string {
    const start = SRC.indexOf("const onTranscript = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const end = SRC.indexOf("}, []); // intentional [] — all mutable values accessed via refs", start);
    expect(end).toBeGreaterThan(start);
    return SRC.slice(start, end);
}

describe("auto-send shows the words before sending them", () => {
    it("writes to the composer and THEN sends, in that order", () => {
        const body = onTranscriptBody();
        const branch = body.slice(body.indexOf("if (voiceAutoSendRef.current)"));
        const insertAt = branch.indexOf("insertText()");
        const sendAt = branch.indexOf("handleSendRef.current");
        expect(insertAt).toBeGreaterThan(-1);
        expect(sendAt).toBeGreaterThan(-1);
        expect(insertAt).toBeLessThan(sendAt);
    });

    it("sends what the COMPOSER holds, not just the new words", () => {
        // insertText appends to an existing draft and handleSend clears the
        // composer as it sends. Sending the transcript alone would silently
        // discard whatever the person had already typed.
        const body = onTranscriptBody();
        expect(body).toMatch(/const toSend = insertText\(\)/);
        expect(body).toMatch(/handleSendRef\.current\(toSend\)/);
        // the old shape must not come back
        expect(body).not.toMatch(/voiceAutoSendRef\.current\)\s*\{\s*setTimeout\(\(\) => handleSendRef\.current\(text\)/);
    });

    it("insertText returns the combined text so the caller can send it", () => {
        expect(SRC).toMatch(/const insertText = \(\): string =>/);
        expect(SRC).toMatch(/return newText;/);
    });
});

describe("hands-free is deliberately NOT changed", () => {
    it("hands-free still sends without writing to the composer", () => {
        // startHandsfreeIfIdle refuses to reopen the mic while the composer
        // holds text ("a half-typed message is waiting"). Leaving a failed
        // send's words there would stall the loop permanently, so hands-free
        // keeps its fire-and-forget send.
        const body = onTranscriptBody();
        const hf = body.slice(
            body.indexOf("if (handsfreeRef.current)"),
            body.indexOf("const insertText")
        );
        expect(hf).toMatch(/handleSendRef\.current\(text\)/);
        expect(hf).not.toMatch(/insertText/);
    });

    it("the reason is written down where someone would undo it", () => {
        const body = onTranscriptBody();
        expect(body).toMatch(/startHandsfreeIfIdle refuses to reopen/i);
    });

    it("the guard it depends on still exists", () => {
        // If this ever stops being true, the carve-out above is pointless.
        expect(SRC).toMatch(/if \(latestInputRef\.current\.trim\(\)\) return;/);
    });
});

describe("the confirmation step still comes first", () => {
    it("'ask before using' wraps delivery, so a bad take can still be discarded", () => {
        const body = onTranscriptBody();
        const confirmAt = body.indexOf("voiceConfirmRef.current");
        const alertAt = body.indexOf("Use this transcription?");
        expect(confirmAt).toBeGreaterThan(-1);
        expect(alertAt).toBeGreaterThan(confirmAt);
        expect(body).toMatch(/onPress: deliver/);
        expect(body).toMatch(/text: "Discard"/);
    });
});

describe("the settings this flow depends on are still wired", () => {
    it("auto-send stays a SETTING, not a default", () => {
        // Owner 2026-09-13: "it should be selectable from setting". Opt-in via
        // === "1" means absent/unset is off.
        expect(SRC).toMatch(/setVoiceAutoSend\(get\("imotara\.voice\.autoSend\.v1"\) === "1"\)/);
    });

    it("auto-read is what speaks the reply, and is independent of hands-free", () => {
        expect(SRC).toMatch(/imotara\.tts\.autoRead\.v1/);
        // The two switches are a plain OR. This used to read autoReadEnabled1
        // / autoReadEnabled2 — the streaming and non-streaming copies of the
        // same trigger. They were collapsed into speakReplyIfEnabled; the
        // condition itself is unchanged. See handsfreeAutoReadMatrix.test.ts.
        expect(SRC).toMatch(/handsfreeRef\.current \|\| autoRead === "1"/);
    });

    it("silence-stop remains hands-free ONLY", () => {
        // Owner 2026-09-13 was asked whether to extend it to manual recording
        // and said no — a manual recording must not cut someone off mid-thought.
        expect(SRC).toMatch(/autoStopOnSilence: handsfree/);
    });
});
