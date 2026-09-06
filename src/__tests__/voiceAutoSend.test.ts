// Auto-send composes with two settings that already existed, and the order
// matters more than the feature itself:
//
//   hands-free  -> send, never touch the composer (unchanged)
//   ask-first   -> confirm, and only THEN honour auto-send
//   auto-send   -> send instead of inserting
//
// The failure that would be easy to ship and hard to notice is the confirm
// dialog's "Use" button going back to inserting text: auto-send would then
// look broken for exactly the users who are most careful about their voice
// notes. The logic lives inline in ChatScreen's onTranscript (all mutable
// values are read through refs so the callback can keep `[]` deps), so this
// checks the source shape, then re-runs the same shape as real code.

import fs from "fs";
import path from "path";

const SRC = path.join(__dirname, "..", "screens", "ChatScreen.tsx");
const src = fs.readFileSync(SRC, "utf8");

const onTranscript = (() => {
    const start = src.indexOf("const onTranscript = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("const voiceInput = useVoiceInput(", start);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
})();

describe("voice transcription delivery", () => {
    it("still short-circuits to send in hands-free mode", () => {
        const handsfree = onTranscript.indexOf("handsfreeRef.current");
        expect(handsfree).toBeGreaterThan(-1);
        // before any confirm/auto-send branching
        expect(handsfree).toBeLessThan(onTranscript.indexOf("voiceConfirmRef.current"));
        expect(handsfree).toBeLessThan(onTranscript.indexOf("voiceAutoSendRef.current"));
    });

    it("routes the confirmation's Use button through deliver, not insertText", () => {
        expect(onTranscript).toMatch(/text:\s*"Use",\s*onPress:\s*deliver/);
        expect(onTranscript).not.toMatch(/text:\s*"Use",\s*onPress:\s*insertText/);
    });

    it("falls back to inserting when auto-send is off", () => {
        expect(onTranscript).toMatch(/if \(voiceAutoSendRef\.current\)[\s\S]*?else \{\s*insertText\(\);/);
    });

    it("reads both settings through refs so the callback can keep [] deps", () => {
        expect(onTranscript).toMatch(/\}, \[\]\); \/\/ intentional \[\]/);
        expect(onTranscript).not.toMatch(/[^.]\bvoiceAutoSend\b(?!Ref)/);
    });
});

// The same four-way table, run as executable logic rather than asserted about.
function deliverOutcome(opts: { handsfree: boolean; confirm: boolean; autoSend: boolean; confirmAnswer?: "use" | "discard" }) {
    const events: string[] = [];
    const insertText = () => events.push("insert");
    const send = () => events.push("send");
    const deliver = () => (opts.autoSend ? send() : insertText());

    if (opts.handsfree) { send(); return events; }
    if (opts.confirm) {
        if (opts.confirmAnswer === "use") deliver();
        return events;
    }
    deliver();
    return events;
}

describe("delivery outcomes", () => {
    it("defaults (everything off) still insert into the composer", () => {
        expect(deliverOutcome({ handsfree: false, confirm: false, autoSend: false })).toEqual(["insert"]);
    });
    it("auto-send alone sends", () => {
        expect(deliverOutcome({ handsfree: false, confirm: false, autoSend: true })).toEqual(["send"]);
    });
    it("confirm + auto-send sends only after Use", () => {
        expect(deliverOutcome({ handsfree: false, confirm: true, autoSend: true, confirmAnswer: "use" })).toEqual(["send"]);
        expect(deliverOutcome({ handsfree: false, confirm: true, autoSend: true, confirmAnswer: "discard" })).toEqual([]);
    });
    it("confirm without auto-send still inserts after Use", () => {
        expect(deliverOutcome({ handsfree: false, confirm: true, autoSend: false, confirmAnswer: "use" })).toEqual(["insert"]);
    });
    it("hands-free ignores both settings", () => {
        expect(deliverOutcome({ handsfree: true, confirm: true, autoSend: false })).toEqual(["send"]);
    });
});

describe("persistence", () => {
    it("uses the same storage key in the chat screen and the settings screen", () => {
        const settings = fs.readFileSync(path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8");
        const KEY = '"imotara.voice.autoSend.v1"';
        expect(src).toContain(KEY);
        expect(settings).toContain(KEY);
    });

    it("defaults to off, so an upgrade does not start sending on its own", () => {
        expect(src).toContain("const [voiceAutoSend, setVoiceAutoSend] = useState(false);");
        expect(src).toMatch(/setVoiceAutoSend\(vAutoSend === "1"\)/);
    });

    it("re-reads the setting on focus so a toggle applies without a remount", () => {
        expect(src).toMatch(/AsyncStorage\.getItem\("imotara\.voice\.autoSend\.v1"\)\s*\.then\(\(v\) => setVoiceAutoSend\(v === "1"\)\)/);
    });
});
