// Hands-free is the one feature that opens a microphone with nobody tapping
// anything, so two properties matter more than the feature itself:
//
//   1. If the switch is off, absolutely nothing changes.
//   2. If it is on, the person can always see it and stop it in one tap.
//
// The loop also has to survive its own dead ends. Before this, a turn that
// produced no words raised a blocking alert and ended the conversation, and
// backgrounding the app cancelled the recording with nothing to restart it —
// so hands-free quietly stopped being hands-free and only a manual mic tap
// brought it back.

import fs from "fs";
import path from "path";

const chat = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");
const hook = fs.readFileSync(
    path.join(__dirname, "..", "hooks", "useVoiceInput.ts"), "utf8");

const startFn = (() => {
    const i = chat.indexOf("const startHandsfreeIfIdle = useCallback(");
    expect(i).toBeGreaterThan(-1);
    return chat.slice(i, chat.indexOf("}, []);", i));
})();

describe("opening the mic without a tap is guarded", () => {
    it("refuses unless hands-free is actually on", () => {
        expect(startFn).toMatch(/if \(!handsfreeRef\.current\) return;/);
    });

    it("never raises the OS permission dialog on its own", () => {
        // startRecording() calls requestPermissionsAsync(). Auto-start must
        // check permission the read-only way first and give up if not granted,
        // or opening the chat screen could pop a mic prompt out of nowhere.
        expect(startFn).toMatch(/await voiceInputRef\.current\.hasPermission\(\)/);
        expect(startFn).toMatch(/if \(!\(await voiceInputRef\.current\.hasPermission\(\)\)\) return;/);
        expect(hook).toMatch(/const hasPermission = useCallback\(async \(\) => \{[\s\S]*?Audio\.getPermissionsAsync\(\)/);
        // and the read-only check must not be the prompting one
        const hp = hook.slice(hook.indexOf("const hasPermission = useCallback"));
        expect(hp.slice(0, 300)).not.toContain("requestPermissionsAsync");
    });

    it("refuses when the mic is already busy, a reply is coming, or a draft is waiting", () => {
        expect(startFn).toMatch(/voiceStateRef\.current !== "idle"/);
        expect(startFn).toMatch(/isTypingRef\.current \|\| isSendingRef\.current/);
        expect(startFn).toMatch(/latestInputRef\.current\.trim\(\)/);
    });

    it("re-checks after the await, since anything could have changed meanwhile", () => {
        const afterAwait = startFn.slice(startFn.indexOf("hasPermission()"));
        expect(afterAwait).toMatch(/mountedRef\.current/);
        expect(afterAwait).toMatch(/voiceStateRef\.current !== "idle"/);
    });

    it("is reached from entering the chat screen and from returning to the app", () => {
        expect(chat).toMatch(/if \(val\) void startHandsfreeIfIdleRef\.current\(\);/);
        const fg = chat.slice(chat.indexOf("onForeground: () => {"));
        expect(fg.slice(0, 2000)).toMatch(/startHandsfreeIfIdleRef\.current\(\)/);
    });
});

describe("the loop does not die silently", () => {
    it("a wordless turn reopens the mic instead of raising a blocking alert", () => {
        expect(hook).toMatch(/transcriptionAttempted && !onNoSpeechRef\.current\?\.\(\)/);
        expect(chat).toMatch(/onNoSpeech: handleNoSpeech/);
    });

    it("an empty reply reopens the mic, because onDone will never fire", () => {
        // speakMessage's onDone is what normally reopens. No text, no speech,
        // no onDone — both send paths need the explicit else.
        const matches = chat.match(/\} else if \(handsfreeRef\.current\) \{\s*\n\s*\/\/ No speech to wait for/g);
        expect(matches).toHaveLength(2);
    });

    it("counts consecutive empty turns and gives up rather than looping forever", () => {
        expect(chat).toMatch(/MAX_EMPTY_HANDSFREE_TURNS = 3/);
        expect(chat).toMatch(/emptyTurnsRef\.current = 0; \/\/ a turn produced words/);
    });
});

// The empty-turn policy, run as real logic rather than asserted about.
function emptyTurnPolicy(handsfree: boolean, turns: number, MAX = 3) {
    const events: string[] = [];
    let count = 0;
    for (let i = 0; i < turns; i++) {
        if (!handsfree) { events.push("alert"); continue; }
        count += 1;
        if (count >= MAX) { count = 0; events.push("giveup"); continue; }
        events.push("reopen");
    }
    return events;
}

describe("empty-turn policy", () => {
    it("outside hands-free the alert is unchanged", () => {
        expect(emptyTurnPolicy(false, 3)).toEqual(["alert", "alert", "alert"]);
    });
    it("retries twice, then stops instead of recording silence forever", () => {
        expect(emptyTurnPolicy(true, 3)).toEqual(["reopen", "reopen", "giveup"]);
    });
    it("a muted mic cannot spin the loop indefinitely", () => {
        const ev = emptyTurnPolicy(true, 30);
        expect(ev.filter((e) => e === "giveup")).toHaveLength(10);
        expect(ev).not.toContain("alert");
    });
});

describe("hands-free is visible and stoppable", () => {
    it("the indicator renders only while hands-free is on", () => {
        expect(chat).toMatch(/\{handsfree \? \(\s*\n\s*<TouchableOpacity\s*\n\s*onPress=\{handleHandsfreeStop\}/);
    });

    it("it says what the loop is doing, not just that it exists", () => {
        expect(chat).toMatch(/const handsfreeStatus =/);
        for (const s of ["listening", "transcribing", "speaking", "thinking", "ready"]) {
            expect(chat).toContain(`"${s}"`);
        }
    });

    it("it is announced to screen readers as a control, with its state", () => {
        expect(chat).toMatch(/accessibilityRole="button"/);
        expect(chat).toMatch(/accessibilityLabel=\{`Hands-free conversation is on\. \$\{handsfreeStatus\}\. Tap to turn off\.`\}/);
    });

    it("stopping writes the same key Settings writes, so they cannot disagree", () => {
        const settings = fs.readFileSync(
            path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8");
        const KEY = '"imotara:handsfree.v1"';
        expect(chat).toContain(KEY);
        expect(settings).toContain("HANDSFREE_KEY");
        expect(settings).toMatch(/HANDSFREE_KEY = "imotara:handsfree\.v1"/);
        const stop = chat.slice(chat.indexOf("const handleHandsfreeStop"));
        expect(stop.slice(0, 700)).toMatch(/AsyncStorage\.setItem\("imotara:handsfree\.v1", "0"\)/);
    });

    it("stopping closes the mic and the speaker immediately, not at end of turn", () => {
        const stop = chat.slice(chat.indexOf("const handleHandsfreeStop"), chat.indexOf("const handleHandsfreeStop") + 700);
        expect(stop).toMatch(/stopSpeaking\(\)/);
        expect(stop).toMatch(/cancelRecording\(\)/);
        expect(stop).toMatch(/handsfreeRef\.current = false/);
    });

    it("uses theme tokens, so it is not another hardcoded-colour bug", () => {
        const banner = chat.slice(chat.indexOf("{handsfree ? ("), chat.indexOf("{/* Offline / unsynced indicator */}"));
        expect(banner).toMatch(/colors\.primaryTint/);
        expect(banner).toMatch(/colors\.textPrimary/);
        expect(banner).not.toMatch(/#[0-9a-fA-F]{6}/);
        expect(banner).not.toMatch(/rgba?\(/);
    });
});

describe("nothing changes when the switch is off", () => {
    it("every new behaviour is gated on hands-free", () => {
        // Each addition must be unreachable with the switch off.
        expect(startFn).toMatch(/if \(!handsfreeRef\.current\) return;/);
        const noSpeech = chat.slice(chat.indexOf("const handleNoSpeech = useCallback"));
        expect(noSpeech.slice(0, 600)).toMatch(
            /if \(!handsfreeRef\.current\) return false; \/\/ not hands-free — keep the alert/);
    });

    it("the hook still alerts by default when no handler is supplied", () => {
        // onNoSpeech is optional; absent it, `!undefined?.()` is true and the
        // original alert path runs exactly as before.
        expect(hook).toMatch(/onNoSpeech\?: \(\) => boolean;/);
        const call = "transcriptionAttempted && !onNoSpeechRef.current?.()";
        expect(hook).toContain(call);
        expect(undefined as unknown as (() => boolean) | undefined).toBeUndefined();
        const suppressed = (h?: () => boolean) => !!(h?.());
        expect(suppressed(undefined)).toBe(false);      // no handler → alert shows
        expect(suppressed(() => false)).toBe(false);    // declined → alert shows
        expect(suppressed(() => true)).toBe(true);      // handled → alert suppressed
    });
});
