// The 2x2 matrix, run as real logic rather than asserted about.
//
// handsfreeAutoReadMatrix.test.ts pins the SHAPE of ChatScreen's speak trigger
// so the refactor could not change it silently. That is necessary but thin: a
// regex cannot tell you that a hands-free user with auto-read off still gets
// their mic back, or that the send lock is held long enough to stop the mic
// opening into the app's own voice.
//
// So this file ports the decision logic — faithfully, including the ordering —
// and drives it through every combination the owner reported problems with
// (2026-09-13): "the message read is not stopping", "the user speaking
// completes but the recording from microphone goes on", "the microphone still
// shows recording though the user is speaking the second time".
//
// If ChatScreen's logic changes, the sibling file fails; if the logic is wrong,
// this one does.

type Trace = string[];

interface World {
    handsfree: boolean;
    autoRead: boolean;
    replyText: string;
    /** What startHandsfreeIfIdle would see, if it fired. */
    focused: boolean;
    obscured: boolean;
    voiceState: "idle" | "recording" | "transcribing";
}

const base: World = {
    handsfree: false,
    autoRead: false,
    replyText: "here is a reply",
    focused: true,
    obscured: false,
    voiceState: "idle",
};

/**
 * A turn, modelled the way ChatScreen actually runs one.
 *
 * `probeAt` lets a test fire startHandsfreeIfIdle at a named moment, which is
 * how the send-lock ordering is checked — that is the one thing `void` vs
 * `await` on speakReplyIfEnabled changes.
 */
async function runTurn(
    w: Partial<World>,
    probeAt?: "after-send-lock-released",
): Promise<Trace> {
    const world: World = { ...base, ...w };
    const t: Trace = [];

    // ChatScreen mirrors of the real state.
    let speaking: string | null = null;
    let isSending = false;
    let isTyping = false;
    let recording = world.voiceState !== "idle";

    // --- reopenMicIfHandsfree (ChatScreen ~2056) ---
    const reopenMicIfHandsfree = () => {
        if (!world.handsfree) return;          // auto-read alone must NEVER listen
        if (!world.focused) return;
        if (world.obscured) return;
        if (recording) return;
        recording = true;
        t.push("mic:open");
    };

    // --- startHandsfreeIfIdle (ChatScreen ~2120), the unprompted opener ---
    const startHandsfreeIfIdle = () => {
        if (!world.handsfree) return;
        if (!world.focused) return;
        if (world.obscured) return;
        if (recording) return;
        if (isTyping || isSending) return;
        if (speaking) return;                   // the guard added for this bug
        recording = true;
        t.push("mic:open(unprompted)");
    };

    // --- speakReplyIfEnabled (ChatScreen, the collapsed helper) ---
    const speakReplyIfEnabled = async (text: string) => {
        // stands in for the AsyncStorage read
        await Promise.resolve();
        const autoRead = world.autoRead ? "1" : "0";
        if ((world.handsfree || autoRead === "1") && text) {
            t.push("speak:start");
            speaking = "msg";
            // speakMessage is NOT awaited; onDone lands later.
            return () => {
                t.push("speak:done");
                speaking = null;
                reopenMicIfHandsfree();
            };
        } else if (world.handsfree) {
            t.push("speak:skipped(empty)");
            reopenMicIfHandsfree();
        }
        return null;
    };

    // --- handleSend + the reply path ---
    isSending = true;
    isTyping = true;
    t.push("send");
    // The fix: sending stops whatever is still being read, AFTER the guards.
    if (speaking) { speaking = null; t.push("speak:stopped-by-send"); }

    let onDone: (() => void) | null = null;
    try {
        onDone = await speakReplyIfEnabled(world.replyText);
    } finally {
        isSending = false;
        isTyping = false;
    }

    if (probeAt === "after-send-lock-released") startHandsfreeIfIdle();

    onDone?.();
    return t;
}

describe("who speaks, across all four switch combinations", () => {
    it("both off: silence, and the mic stays shut", async () => {
        expect(await runTurn({ handsfree: false, autoRead: false })).toEqual(["send"]);
    });

    it("auto-read only: speaks, and NEVER opens the mic", async () => {
        // The owner's "the recording goes on" reports come from mics opening
        // when nobody asked. Auto-read is a listening-free feature.
        const t = await runTurn({ handsfree: false, autoRead: true });
        expect(t).toEqual(["send", "speak:start", "speak:done"]);
        expect(t.join()).not.toContain("mic:open");
    });

    it("hands-free only: speaks even with auto-read off, then hands the mic back", async () => {
        // Hands-free implies speaking — the loop has nothing to do otherwise.
        expect(await runTurn({ handsfree: true, autoRead: false }))
            .toEqual(["send", "speak:start", "speak:done", "mic:open"]);
    });

    it("both on: one reply, spoken once, one mic reopen", async () => {
        // Not two of anything. The trigger used to exist twice; a second copy
        // firing would show up here as a doubled trace.
        expect(await runTurn({ handsfree: true, autoRead: true }))
            .toEqual(["send", "speak:start", "speak:done", "mic:open"]);
    });
});

describe("the loop must not stop dead", () => {
    it("an empty reply still returns the mic in hands-free", async () => {
        // onDone never fires when there is nothing to speak.
        expect(await runTurn({ handsfree: true, replyText: "" }))
            .toEqual(["send", "speak:skipped(empty)", "mic:open"]);
    });

    it("an empty reply with auto-read alone does nothing at all", async () => {
        expect(await runTurn({ handsfree: false, autoRead: true, replyText: "" })).toEqual(["send"]);
    });
});

describe("the mic is not reopened onto a screen nobody is looking at", () => {
    it("not when the chat has been left", async () => {
        const t = await runTurn({ handsfree: true, focused: false });
        expect(t.join()).not.toContain("mic:open");
    });

    it("not when a sheet or the breathing exercise covers it", async () => {
        const t = await runTurn({ handsfree: true, obscured: true });
        expect(t.join()).not.toContain("mic:open");
    });

    it("not when a recording is already running", async () => {
        // "the microphone still shows recording though the user is speaking
        // the second time" — a second open on top of a live one.
        const t = await runTurn({ handsfree: true, voiceState: "recording" });
        expect(t.join()).not.toContain("mic:open");
    });
});

describe("the mic must not open into the app's own voice", () => {
    it("the unprompted opener waits while a reply is being read", async () => {
        // This is what awaiting speakReplyIfEnabled buys. The send lock is
        // released in a finally; if the speak call were fire-and-forget, the
        // lock would drop BEFORE speaking began and this probe would find an
        // idle screen with no speech in progress, and open a mic that the
        // reply is about to talk into. On Android that bleed is transcribed as
        // if the person had said it.
        const t = await runTurn({ handsfree: true }, "after-send-lock-released");
        expect(t).toEqual(["send", "speak:start", "speak:done", "mic:open"]);
        expect(t.join()).not.toContain("unprompted");
    });

    it("but it DOES open once there is nothing to speak", async () => {
        // The guard must be a wait, not a refusal — otherwise hands-free needs
        // a manual tap again.
        const t = await runTurn({ handsfree: true, autoRead: false, replyText: "" },
            "after-send-lock-released");
        expect(t.join()).toContain("mic:open");
    });
});

describe("BUG: speech that would not stop", () => {
    it("sending again silences the reply that is still being read", async () => {
        // Reproduces the owner's report as a sequence: auto-read is on, a reply
        // is mid-sentence, and the person types and sends. Before the fix the
        // old reply kept talking over the new turn.
        const trace: Trace = [];
        let speaking: string | null = "previous-reply";
        const handleSend = (rejected: boolean) => {
            trace.push("send");
            if (rejected) return;                 // over-length, or a double tap
            if (speaking) { speaking = null; trace.push("speak:stopped-by-send"); }
        };
        handleSend(false);
        expect(trace).toEqual(["send", "speak:stopped-by-send"]);
        expect(speaking).toBeNull();
    });

    it("a REJECTED send does not silence it", async () => {
        // The stop sits after the early returns on purpose: a message over the
        // character limit, or a stray double tap, must not cut off a reply
        // someone is still listening to.
        const trace: Trace = [];
        let speaking: string | null = "previous-reply";
        const handleSend = (rejected: boolean) => {
            trace.push("send");
            if (rejected) return;
            if (speaking) { speaking = null; trace.push("speak:stopped-by-send"); }
        };
        handleSend(true);
        expect(trace).toEqual(["send"]);
        expect(speaking).toBe("previous-reply");
    });
});
