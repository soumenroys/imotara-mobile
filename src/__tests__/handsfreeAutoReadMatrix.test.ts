// The two switches that decide whether the app talks and listens by itself:
//
//   imotara:handsfree.v1      — hands-free conversations
//   imotara.tts.autoRead.v1   — auto-read assistant replies
//
// They are independent, so there are FOUR combinations, and nothing tested
// them together. The owner reported (2026-09-13) that the combinations
// misbehave: "sometimes the message read is not stopping", "the user speaking
// completes but the recording from microphone goes on", "the microphone still
// shows recording though the user is speaking the second time".
//
// Two concrete defects were found behind that, and these tests pin both plus
// the matrix itself, so the shared trigger can be refactored without silently
// changing when the app speaks or listens.

import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"),
    "utf8"
);

/** Code with comments stripped — assertions must not match prose. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

function fnBody(marker: string, end = "}, []);"): string {
    const i = SRC.indexOf(marker);
    expect(i).toBeGreaterThan(-1);
    return SRC.slice(i, SRC.indexOf(end, i));
}

describe("the 2x2 matrix: who speaks, and who reopens the mic", () => {
    it("a reply is spoken when EITHER switch is on", () => {
        // hands-free implies speaking (the loop needs it); auto-read is the
        // explicit opt-in for people who do not want the mic at all.
        const triggers = CODE.match(/handsfreeRef\.current \|\| autoRead\w* === "1"/g) ?? [];
        expect(triggers.length).toBeGreaterThanOrEqual(1);
    });

    it("nothing is spoken when BOTH are off", () => {
        // The condition is a plain OR with no third disjunct — if someone adds
        // one, silence-by-default stops being guaranteed.
        const m = CODE.match(/if \(\(handsfreeRef\.current \|\| autoRead\w* === "1"\) && botMessage\.text\)/g);
        expect(m).not.toBeNull();
    });

    it("the mic is only reopened for HANDS-FREE, never for auto-read alone", () => {
        // Auto-read must not start listening. reopenMicIfHandsfree is wired
        // into onDone unconditionally, so its internal guard is what keeps an
        // auto-read-only user's mic shut.
        const reopen = fnBody("const reopenMicIfHandsfree = useCallback(");
        expect(reopen).toMatch(/if \(!handsfreeRef\.current\) return;/);
    });

    it("an empty reply still reopens the mic in hands-free, or the loop dies", () => {
        // onDone never fires when there is nothing to speak.
        expect(CODE).toMatch(/else if \(handsfreeRef\.current\) \{\s*reopenMicIfHandsfree\(\);/);
    });

    it("silence-stop stays hands-free only", () => {
        // Owner decision 2026-09-13, asked explicitly: a manual recording must
        // never cut someone off mid-thought.
        expect(CODE).toMatch(/autoStopOnSilence: handsfree/);
    });
});

describe("BUG: speech kept playing after the person moved on", () => {
    it("sending a message stops any reply that is still being read", () => {
        // With auto-read on, typing and sending while the previous reply was
        // still being spoken left it talking over the new turn — the owner's
        // "the message read is not stopping". Every other way of moving on
        // (tapping the mic, tapping the speaker, leaving the screen) already
        // stopped it; sending did not.
        const send = fnBody("const handleSend = (overrideText?: string) => {", "\n  };");
        expect(send).toMatch(/stopSpeaking\(\)/);
    });

    it("it stops AFTER the early returns, so a rejected send is not punished", () => {
        // An over-length message or a double-tap must not silence a reply the
        // person is still listening to.
        const send = fnBody("const handleSend = (overrideText?: string) => {", "\n  };");
        const guard = send.indexOf("isTyping || isSendingRef.current");
        const stop = send.indexOf("stopSpeaking()");
        expect(guard).toBeGreaterThan(-1);
        expect(stop).toBeGreaterThan(guard);
    });
});

describe("BUG: the mic could open into a speaking reply", () => {
    it("the unprompted opener refuses while a reply is being spoken", () => {
        // handleMicPress already stopped TTS first, with the reason in a
        // comment: "on Android, TTS audio bleeds into the mic if it's still
        // playing when recording begins." startHandsfreeIfIdle fires on focus
        // and on returning from the background, so it could open a mic into
        // the speaker output — the same bleed, with nobody having tapped.
        const start = fnBody("const startHandsfreeIfIdle = useCallback(");
        expect(start).toMatch(/currentSpeakingId\(\)/);
    });

    it("that check is re-done after the await, like the others", () => {
        // Everything in this function is re-checked after awaiting permission,
        // because seconds can pass. A speaking check that is only done before
        // the await would be worth little.
        const start = fnBody("const startHandsfreeIfIdle = useCallback(");
        const awaitAt = start.indexOf("await voiceInputRef.current.hasPermission()");
        expect(awaitAt).toBeGreaterThan(-1);
        expect(start.indexOf("currentSpeakingId()", awaitAt)).toBeGreaterThan(awaitAt);
    });

    it("currentSpeakingId is imported from the TTS module", () => {
        expect(SRC).toMatch(/import \{[^}]*currentSpeakingId[^}]*\} from "\.\.\/lib\/tts\/mobileTTS"/);
    });
});

describe("the speak trigger exists ONCE, not once per reply path", () => {
    it("there is a single shared helper, not two copies", () => {
        // There used to be two near-identical ~16-line blocks — the streaming
        // path and the non-streaming path — each reading the setting and
        // wiring the mic-reopen callback. Two copies of a state transition is
        // how the combinations drifted apart in the first place.
        expect(CODE.match(/const speakReplyIfEnabled = /g) ?? []).toHaveLength(1);
        expect(CODE.match(/await AsyncStorage\.getItem\("imotara\.tts\.autoRead\.v1"\)/g) ?? [])
            .toHaveLength(1);
    });

    it("it is NOT a useCallback, or it would speak with stale settings", () => {
        // Both call sites live inside handleSend, which is rebuilt every
        // render, so the two old blocks always used the CURRENT toneContext,
        // ttsRate, ttsPitch, guestAccessToken and licenseTier. Wrapping the
        // shared helper in useCallback([]) — which is the right pattern for
        // reopenMicIfHandsfree, because that one outlives the render — would
        // freeze the first render's values and silently change the voice, the
        // speed and the tier check. The refactor must not do that.
        expect(CODE).toMatch(/const speakReplyIfEnabled = async \(/);
        expect(CODE).not.toMatch(/const speakReplyIfEnabled = useCallback/);
    });

    it("both reply paths go through it", () => {
        // streaming and non-streaming
        const uses = CODE.match(/await speakReplyIfEnabled\(/g) ?? [];
        expect(uses).toHaveLength(2);
    });

    it("the emotion still differs per path, which is why it is a parameter", () => {
        // The ONLY difference between the two old blocks was finalEmotion vs
        // userEmotion. Collapsing them must not quietly pick one.
        expect(CODE).toMatch(/speakReplyIfEnabled\([^)]*finalEmotion/s);
        expect(CODE).toMatch(/speakReplyIfEnabled\([^)]*userEmotion/s);
    });
});
