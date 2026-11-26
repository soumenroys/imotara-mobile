/**
 * #125 (21 Nov 2026): expo-av ⇒ expo-audio through ONE adapter, src/lib/audio/av.ts.
 *
 * 🔴 The guard the old expoAvAudioSourcePatch test held must survive the move:
 * Android records from VOICE_RECOGNITION (device noise suppression, tuned for
 * speech) — the owner's 16 Sep 2026 hands-free noise complaint. expo-audio gives
 * it as `audioSource: 'voice_recognition'`; the adapter sets it on EVERY recording.
 *
 * ⛔ And the three callers must not drift back onto expo-av, which gets no fixes
 * from SDK 55 on.
 */
import fs from "fs";
import path from "path";

jest.mock("react-native", () => ({ Platform: { OS: "android" } }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ea = require("expo-audio");
import { Audio, toExpoAudioMode, toAvPlaybackStatus, withVoiceSource, InterruptionModeAndroid, InterruptionModeIOS } from "../lib/audio/av";

const root = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

beforeEach(() => {
    ea.__controls.refuseSources.clear();
    ea.__controls.lastRecorderOptions.length = 0;
    ea.__controls.modes.length = 0;
    ea.__players.length = 0;
});

describe("⛔ nothing imports expo-av any more", () => {
    const files = ["src/hooks/useVoiceInput.ts", "src/lib/tts/mobileTTS.ts", "src/components/imotara/BreathingModal.tsx"];
    for (const f of files) {
        it(`${f} uses the adapter`, () => {
            const src = read(f);
            expect(src).not.toMatch(/from ["']expo-av["']/);
            expect(src).toMatch(/from ["'][./]+(lib\/)?audio\/av["']|from ["']\.\.\/audio\/av["']/);
        });
    }
    it("expo-av is gone from package.json and its patch is deleted", () => {
        const pkg = JSON.parse(read("package.json"));
        expect(pkg.dependencies["expo-av"]).toBeUndefined();
        expect(pkg.dependencies["expo-audio"]).toBeDefined();
        expect(fs.existsSync(path.join(root, "patches/expo-av+16.0.8.patch"))).toBe(false);
    });
});

describe("🔴 the speech-tuned microphone (was the expo-av patch)", () => {
    it("every recording asks Android for VOICE_RECOGNITION", async () => {
        const { recording } = await Audio.Recording.createAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true });
        expect(ea.__controls.lastRecorderOptions[0].audioSource).toBe("voice_recognition");
        expect(ea.__controls.lastRecorderOptions[0].isMeteringEnabled).toBe(true);
        await recording.stopAndUnloadAsync();
    });

    it("falls back to the default source if the device refuses it — never 'cannot record'", async () => {
        ea.__controls.refuseSources.add("voice_recognition");
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        expect(ea.__controls.lastRecorderOptions.map((o: any) => o.audioSource)).toEqual(["voice_recognition", "default"]);
        expect(recording.getURI()).toMatch(/^file:/);
        await recording.stopAndUnloadAsync();
    });

    it("withVoiceSource keeps the caller's android options", () => {
        expect(withVoiceSource({ android: { bitRate: 32000 } }, "voice_recognition").android).toEqual({ bitRate: 32000, audioSource: "voice_recognition" });
    });
});

describe("recording behaves like expo-av for useVoiceInput", () => {
    it("status updates carry isRecording + metering at the requested interval, and stop after unload", async () => {
        jest.useFakeTimers();
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        const seen: any[] = [];
        recording.setProgressUpdateInterval(200);
        recording.setOnRecordingStatusUpdate((s) => seen.push(s));
        jest.advanceTimersByTime(650);
        expect(seen.length).toBe(3);
        expect(seen[0]).toMatchObject({ isRecording: true, metering: -30 });
        await recording.stopAndUnloadAsync();
        jest.advanceTimersByTime(1000);
        expect(seen.length).toBe(3);
        expect(recording.getURI()).toMatch(/^file:/); // file stays readable after unload
        jest.useRealTimers();
    });

    it("a second stopAndUnloadAsync throws, like expo-av (callers already catch it)", async () => {
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.stopAndUnloadAsync();
        await expect(recording.stopAndUnloadAsync()).rejects.toThrow();
    });
});

describe("audio mode: expo-av keys and defaults ⇒ expo-audio", () => {
    it("recording mode (useVoiceInput) ⇒ doNotMix on Android, recording allowed", () => {
        expect(toExpoAudioMode({ allowsRecordingIOS: true, playsInSilentModeIOS: true, interruptionModeAndroid: InterruptionModeAndroid.DoNotMix, shouldDuckAndroid: false }, "android"))
            .toEqual({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false, interruptionMode: "doNotMix" });
    });
    it("after-recording mode ⇒ duckOthers on Android", () => {
        expect(toExpoAudioMode({ allowsRecordingIOS: false, interruptionModeAndroid: InterruptionModeAndroid.DuckOthers, shouldDuckAndroid: true }, "android").interruptionMode).toBe("duckOthers");
    });
    it("missing keys take expo-av's defaults (mixWithOthers on iOS, no recording)", () => {
        expect(toExpoAudioMode({ playsInSilentModeIOS: true }, "ios")).toEqual({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false, interruptionMode: "mixWithOthers" });
        expect(toExpoAudioMode({ interruptionModeIOS: InterruptionModeIOS.DoNotMix }, "ios").interruptionMode).toBe("doNotMix");
    });
    it("TTS mode keeps the earpiece off and background playback as asked", () => {
        const m = toExpoAudioMode({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true, playThroughEarpieceAndroid: false }, "android");
        expect(m).toMatchObject({ allowsRecording: false, shouldPlayInBackground: true, shouldRouteThroughEarpiece: false });
    });
});

describe("playback behaves like expo-av for mobileTTS + breathing", () => {
    it("TTS: rate with pitch correction, full volume, plays at once", async () => {
        const { sound } = await Audio.Sound.createAsync({ uri: "file:///x.mp3" }, { shouldPlay: true, rate: 0.95, shouldCorrectPitch: true, volume: 1.0 });
        const p = ea.__players[0];
        expect(p.rate).toBe(0.95);
        expect(p.pitch).toBe("medium");
        expect(p.volume).toBe(1);
        expect(p.playing).toBe(true);
        await sound.unloadAsync();
        expect(p.removed).toBe(true);
    });

    it("didJustFinish reaches the callback once; nothing after unload", async () => {
        const { sound } = await Audio.Sound.createAsync({ uri: "file:///x.mp3" }, { shouldPlay: true });
        const p = ea.__players[0];
        const got: any[] = [];
        sound.setOnPlaybackStatusUpdate((s) => got.push(s));
        p.emit({ isLoaded: true, playing: false, didJustFinish: true, currentTime: 1, duration: 1, loop: false });
        expect(got).toHaveLength(1);
        expect(got[0]).toMatchObject({ isLoaded: true, didJustFinish: true });
        await sound.unloadAsync();
        p.emit({ isLoaded: true, playing: false, didJustFinish: true, currentTime: 1, duration: 1, loop: false });
        expect(got).toHaveLength(1);
    });

    it("breathing: loops at volume 0.35; stopAsync then unloadAsync is safe", async () => {
        const { sound } = await Audio.Sound.createAsync({ uri: "android.resource://com.imotara.imotara/raw/rain" }, { isLooping: true, volume: 0.35, shouldPlay: true });
        const p = ea.__players[0];
        expect(p.loop).toBe(true);
        expect(p.volume).toBe(0.35);
        await sound.stopAsync();
        await sound.unloadAsync();
        await sound.unloadAsync(); // idempotent
        expect(p.removed).toBe(true);
    });

    it("an unloaded status is reported as not loaded", () => {
        expect(toAvPlaybackStatus({ isLoaded: false } as any)).toEqual({ isLoaded: false });
    });
});
