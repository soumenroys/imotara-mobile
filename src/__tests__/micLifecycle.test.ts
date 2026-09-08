// Stopping a recording is not the same as stopping it being SENT.
//
// Once the transcription upload is in flight the recording is already over, so
// cancelRecording has nothing left to cancel: the upload lands, onTranscript
// fires, and in hands-free a message goes out — from wherever the person now
// is. That was watched happening on a simulator on 2026-09-07: the mic kept
// recording after leaving Chat, then transcribed and sent from the Settings
// screen.
//
// Two separate things are needed and both are checked here:
//   1. nothing STARTS the mic for a screen nobody is looking at
//   2. nothing a turn produces is USED once that turn is abandoned

import fs from "fs";
import path from "path";

const chat = fs.readFileSync(
    path.join(__dirname, "..", "screens", "ChatScreen.tsx"), "utf8");
const hook = fs.readFileSync(
    path.join(__dirname, "..", "hooks", "useVoiceInput.ts"), "utf8");

const slice = (src: string, from: string, to: string) => {
    const i = src.indexOf(from);
    expect(i).toBeGreaterThan(-1);
    const j = src.indexOf(to, i);
    expect(j).toBeGreaterThan(i);
    return src.slice(i, j);
};

describe("the mic never opens for a screen nobody is looking at", () => {
    it("focus is tracked separately from mounted", () => {
        // A screen you navigated away from is still mounted. mountedRef alone
        // was the reason the old guards let this through.
        expect(chat).toMatch(/const isFocusedRef = React\.useRef\(false\);/);
        expect(chat).toMatch(/isFocusedRef\.current = true;/);
        expect(chat).toMatch(/isFocusedRef\.current = false;/);
    });

    it.each([
        ["reopenMicIfHandsfree", "const reopenMicIfHandsfree = useCallback", "}, []);"],
        ["startHandsfreeIfIdle", "const startHandsfreeIfIdle = useCallback", "}, []);"],
    ])("%s refuses when unfocused or obscured", (_name, from, to) => {
        const fn = slice(chat, from, to);
        expect(fn).toMatch(/if \(!isFocusedRef\.current\) return;/);
        expect(fn).toMatch(/if \(chatObscuredRef\.current\) return;/);
    });

    it("startHandsfreeIfIdle re-checks focus AFTER awaiting permission", () => {
        const fn = slice(chat, "const startHandsfreeIfIdle = useCallback", "}, []);");
        const after = fn.slice(fn.indexOf("hasPermission()"));
        expect(after).toMatch(/isFocusedRef\.current/);
        expect(after).toMatch(/chatObscuredRef\.current/);
        expect(after).toMatch(/mountedRef\.current/);
    });

    it("every modal that covers the conversation counts as obscuring it", () => {
        const decl = slice(chat, "const chatObscured =", ";");
        for (const m of ["showThreadPanel", "showHeaderMenu", "breathingVisible", "unsentLetterVisible"]) {
            expect(decl).toContain(m);
        }
    });

    it("a modal only suspends hands-free, never a recording someone started by hand", () => {
        const eff = slice(chat, "const chatObscuredRef = useRef(false);", "}, [chatObscured]);");
        // The hands-free check must come before anything cancels.
        const gate = eff.indexOf("if (!handsfreeRef.current) return;");
        expect(gate).toBeGreaterThan(-1);
        expect(gate).toBeLessThan(eff.indexOf("cancelRecording"));
    });

    it("uncovering the chat resumes the loop", () => {
        const eff = slice(chat, "const chatObscuredRef = useRef(false);", "}, [chatObscured]);");
        expect(eff).toMatch(/!chatObscured && wasObscured[\s\S]*startHandsfreeIfIdleRef\.current\(\)/);
    });
});

describe("an abandoned turn is never used", () => {
    it("the hook stamps each turn and drops the result if it moved", () => {
        expect(hook).toMatch(/const turnRef = useRef\(0\);/);
        expect(hook).toMatch(/const myTurn = turnRef\.current;/);
        expect(hook).toMatch(/if \(turnRef\.current !== myTurn\) return;/);
    });

    it("the check sits immediately before delivery, not merely somewhere above it", () => {
        // "Somewhere before onTranscript" is too weak an assertion: the quota
        // guard also sits above it, so deleting the delivery guard entirely
        // still satisfied that. Pin the adjacency instead.
        const stop = slice(hook, "const myTurn = turnRef.current;", "} catch (err) {");
        expect(stop).toMatch(
            /if \(turnRef\.current !== myTurn\) return;\s*\n\s*\n\s*if \(transcript\.trim\(\)\) \{\s*\n\s*onTranscript\(/);
    });

    it("even the quota alert is guarded — it must not pop on a screen you left", () => {
        const stop = slice(hook, "const myTurn = turnRef.current;", "} catch (err) {");
        const quota = stop.indexOf('err?.message === "quota_exceeded"');
        expect(quota).toBeGreaterThan(-1);
        const guardBefore = stop.lastIndexOf("turnRef.current !== myTurn", quota);
        expect(guardBefore).toBeGreaterThan(-1);
        expect(guardBefore).toBeLessThan(quota);
    });

    it("cancelling, unmounting and abandonTurn all bump the counter", () => {
        expect(hook).toMatch(/const cancelRecording = useCallback\(async \(\): Promise<void> => \{\s*\n\s*turnRef\.current \+= 1;/);
        expect(hook).toMatch(/const abandonTurn = useCallback\(\(\) => \{ turnRef\.current \+= 1; \}, \[\]\);/);
        const unmount = slice(hook, "// Cleanup on unmount", "}, []);");
        expect(unmount).toMatch(/turnRef\.current \+= 1;/);
        expect(hook).toMatch(/return \{[^}]*abandonTurn[^}]*\};/);
    });

    it("leaving Chat abandons a turn that already reached the upload", () => {
        // cancelRecording only helps while state is "recording". Once it is
        // "transcribing" the recording is over and only abandonTurn stops the send.
        const cleanup = slice(chat, "isFocusedRef.current = false;", "}, []));");
        expect(cleanup).toMatch(/cancelRecording\(\)/);
        expect(cleanup).toMatch(/abandonTurn\(\)/);
    });

    it("backgrounding does too", () => {
        const bg = slice(chat, "onBackground: () => {", "resetTypingState(\"background\")");
        expect(bg).toMatch(/voiceStateRef\.current === "transcribing"[\s\S]*abandonTurn\(\)/);
    });
});

// The turn-counter policy, run as real logic rather than asserted about.
function turnOutcome(events: string[]) {
    let turn = 0, myTurn = 0, delivered = false;
    for (const e of events) {
        if (e === "start") myTurn = turn;
        else if (e === "abandon") turn += 1;
        else if (e === "resolve") delivered = turn === myTurn;
    }
    return delivered;
}

describe("turn-counter policy", () => {
    it("an undisturbed turn delivers, as it always did", () => {
        expect(turnOutcome(["start", "resolve"])).toBe(true);
    });
    it("abandoning mid-flight drops the result", () => {
        expect(turnOutcome(["start", "abandon", "resolve"])).toBe(false);
    });
    it("a turn started AFTER an abandon still delivers", () => {
        // The guard must not poison every future turn.
        expect(turnOutcome(["abandon", "start", "resolve"])).toBe(true);
        expect(turnOutcome(["start", "abandon", "start", "resolve"])).toBe(true);
    });
    it("repeated abandons do not break a later good turn", () => {
        expect(turnOutcome(["abandon", "abandon", "abandon", "start", "resolve"])).toBe(true);
    });
});

describe("nothing changes when hands-free is off", () => {
    it("the modal suspension is gated on it", () => {
        const eff = slice(chat, "const chatObscuredRef = useRef(false);", "}, [chatObscured]);");
        expect(eff).toMatch(/if \(!handsfreeRef\.current\) return;/);
    });
    it("both start callbacks are still gated on it first", () => {
        for (const from of ["const reopenMicIfHandsfree = useCallback", "const startHandsfreeIfIdle = useCallback"]) {
            const fn = slice(chat, from, "}, []);");
            expect(fn.indexOf("!handsfreeRef.current")).toBeLessThan(fn.indexOf("isFocusedRef.current"));
        }
    });
    it("abandonTurn is inert unless something calls it", () => {
        // Manual, non-hands-free recording never reaches an abandon path except
        // through cancelRecording, which the user triggers deliberately.
        expect(turnOutcome(["start", "resolve"])).toBe(true);
    });
});
