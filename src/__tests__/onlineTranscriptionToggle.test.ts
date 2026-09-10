// "Online transcription" reads like a choice between sending audio to a server
// and doing it on the device. There is no on-device option — expo-speech is
// text-to-SPEECH, and nothing in package.json does the reverse. So switching it
// off did not pick a different route; it recorded the person's voice, threw the
// audio away, and said nothing at all. Voice input simply stopped working.
//
// The toggle is worth keeping: it is a real consent control over whether a
// recording leaves the device, which matters for this product. It just has to
// be honest that turning it off turns voice input off too.

import fs from "fs";
import path from "path";

const hook = fs.readFileSync(
    path.join(__dirname, "..", "hooks", "useVoiceInput.ts"), "utf8");
const settings = fs.readFileSync(
    path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8");
const pkg = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "..", "package.json"), "utf8"));

describe("the premise: there really is no on-device fallback", () => {
    it("no speech-recognition dependency exists", () => {
        // If one is ever added, this fails — and the guard below should then be
        // replaced by an actual fallback rather than an explanation.
        const deps = Object.keys(pkg.dependencies ?? {});
        const recognisers = deps.filter((d) =>
            /voice|recogn|whisper|\bstt\b/i.test(d) && d !== "expo-speech");
        expect(recognisers).toEqual([]);
        expect(deps).toContain("expo-speech"); // text-to-speech, the other direction
    });
});

describe("the microphone does not open when nothing can transcribe", () => {
    it("startRecording refuses before recording begins", () => {
        const fn = hook.slice(hook.indexOf("const startRecording = useCallback"));
        const guard = fn.indexOf("if (!cloudTranscriptionRef.current)");
        expect(guard).toBeGreaterThan(-1);
        // Before any Audio.Recording work — the point is not to capture audio
        // that will be discarded.
        const record = fn.indexOf("Audio.Recording");
        expect(record).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(record);
        expect(fn.slice(guard, guard + 700)).toMatch(/return false;/);
    });

    it("it says why, and where to change it", () => {
        const fn = hook.slice(hook.indexOf("const startRecording = useCallback"));
        const block = fn.slice(fn.indexOf("if (!cloudTranscriptionRef.current)"));
        expect(block).toMatch(/Online transcription is off/);
        expect(block).toMatch(/no on-device speech recognition/);
        expect(block).toMatch(/Settings → Experience → Voice input/);
    });

    it("reads the live setting, not one captured at mount", () => {
        // startRecording has [] deps; without a ref it would keep whatever the
        // flag was when the screen mounted.
        expect(hook).toMatch(/const cloudTranscriptionRef = useRef\(cloudTranscription\);/);
        expect(hook).toMatch(/cloudTranscriptionRef\.current = cloudTranscription;/);
    });
});

describe("the setting says what it does", () => {
    it("the description no longer implies an alternative exists", () => {
        const row = settings.slice(settings.indexOf('label="Online transcription"'));
        const desc = row.slice(0, row.indexOf(">") + 1);
        expect(desc).toMatch(/Required for voice input/);
        expect(desc).toMatch(/no on-device alternative/);
    });

    it("the toggle still exists — it is a consent control, not a bug", () => {
        // The fix is honesty, not removal. Someone who does not want their
        // voice leaving the device must still be able to say so.
        expect(settings).toMatch(/VOICE_CLOUD_KEY = "imotara\.voice\.cloudTranscription\.v1"/);
        expect(settings).toMatch(/<Switch value=\{voiceCloudTranscription\} onValueChange=\{handleVoiceCloudToggle\} \/>/);
    });
});
