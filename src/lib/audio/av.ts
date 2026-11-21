// src/lib/audio/av.ts — the slice of expo-av this app uses, implemented on expo-audio.
//
// 🔴 WHY THIS EXISTS (21 Nov 2026, #125 Expo SDK 54 → 58)
// expo-av gets no updates from SDK 55 on (Expo: "no longer receiving patches and may
// not keep working"). The three files that play or record audio — useVoiceInput
// (hands-free + mic), mobileTTS (spoken replies), BreathingModal (ambience) — carry
// months of hard-won guards against stuck mics, ghost turns and wrong routes.
// ⛔ Rewriting them against a new API would put every one of those guards at risk.
// ⇒ This file reproduces exactly the expo-av calls they make, so each of them changes
//   ONE import line and nothing else.
//
// 🔑 THE PATCH THIS REPLACES — patches/expo-av+16.0.8.patch made Android record from
// AudioSource.VOICE_RECOGNITION (device noise suppression, tuned for speech, no AGC)
// instead of the raw mic. Owner, 16 Sep 2026: hands-free "records lots of noises".
// expo-audio exposes it as `audioSource: 'voice_recognition'`, set below for every
// recording, with the same fallback to the default source if a device refuses it.
//
// ⚠️ DEFAULTS MATCH expo-av, not expo-audio: setAudioModeAsync fills unspecified keys
// with expo-av's defaults (expo-av/build/Audio.js), and Sound starts with expo-av's
// initial status (AV.js _DEFAULT_INITIAL_PLAYBACK_STATUS).

import { Platform } from "react-native";
import {
    createAudioPlayer,
    setAudioModeAsync as eaSetAudioModeAsync,
    requestRecordingPermissionsAsync,
    getRecordingPermissionsAsync,
    RecordingPresets,
    type AudioPlayer,
    type AudioStatus,
    type InterruptionMode,
} from "expo-audio";
// ⚠️ Not re-exported from the package root in expo-audio 1.x; the hook useAudioRecorder
// builds recorders exactly this way. Re-check these two paths at every SDK bump.
import AudioModule from "expo-audio/build/AudioModule";
import { createRecordingOptions } from "expo-audio/build/utils/options";

// ── Enums (same string-free numeric shape callers compare against) ────────────
export const InterruptionModeAndroid = { DoNotMix: 1, DuckOthers: 2 } as const;
export const InterruptionModeIOS = { MixWithOthers: 0, DoNotMix: 1, DuckOthers: 2 } as const;
type AndroidMode = (typeof InterruptionModeAndroid)[keyof typeof InterruptionModeAndroid];
type IOSMode = (typeof InterruptionModeIOS)[keyof typeof InterruptionModeIOS];

export type AvAudioMode = {
    allowsRecordingIOS?: boolean;
    interruptionModeIOS?: IOSMode;
    playsInSilentModeIOS?: boolean;
    staysActiveInBackground?: boolean;
    interruptionModeAndroid?: AndroidMode;
    shouldDuckAndroid?: boolean;
    playThroughEarpieceAndroid?: boolean;
};

const AV_DEFAULT_MODE: Required<AvAudioMode> = {
    allowsRecordingIOS: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    playsInSilentModeIOS: false,
    staysActiveInBackground: false,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
};

/** Pure — exported for tests. expo-av mode (missing keys = expo-av defaults) ⇒ expo-audio mode. */
export function toExpoAudioMode(mode: AvAudioMode, os: string = Platform.OS) {
    const m = { ...AV_DEFAULT_MODE, ...mode };
    let interruptionMode: InterruptionMode;
    if (os === "android") {
        interruptionMode =
            m.interruptionModeAndroid === InterruptionModeAndroid.DoNotMix
                ? "doNotMix"
                : m.shouldDuckAndroid
                ? "duckOthers"
                : "doNotMix";
    } else {
        interruptionMode =
            m.interruptionModeIOS === InterruptionModeIOS.DoNotMix
                ? "doNotMix"
                : m.interruptionModeIOS === InterruptionModeIOS.DuckOthers
                ? "duckOthers"
                : "mixWithOthers";
    }
    return {
        allowsRecording: m.allowsRecordingIOS,
        playsInSilentMode: m.playsInSilentModeIOS,
        shouldPlayInBackground: m.staysActiveInBackground,
        shouldRouteThroughEarpiece: m.playThroughEarpieceAndroid,
        interruptionMode,
    };
}

async function setAudioModeAsync(mode: AvAudioMode): Promise<void> {
    await eaSetAudioModeAsync(toExpoAudioMode(mode));
}

// ── Recording ─────────────────────────────────────────────────────────────────
export type AvRecordingStatus = {
    canRecord: boolean;
    isRecording: boolean;
    isDoneRecording: boolean;
    durationMillis: number;
    metering?: number;
};

type RecorderLike = {
    prepareToRecordAsync(): Promise<void>;
    record(): void;
    stop(): Promise<void>;
    getStatus(): { canRecord: boolean; isRecording: boolean; durationMillis: number; metering?: number };
    uri: string | null;
    release(): void;
};

/** Pure — exported for tests. Adds the speech-tuned mic source on Android (was the patch). */
export function withVoiceSource(options: Record<string, any>, source: "voice_recognition" | "default") {
    return { ...options, android: { ...(options.android ?? {}), audioSource: source } };
}

class Recording {
    private rec: RecorderLike;
    private timer: ReturnType<typeof setInterval> | null = null;
    private intervalMs = 500; // expo-av default progressUpdateIntervalMillis
    private listener: ((s: AvRecordingStatus) => void) | null = null;
    private done = false;

    private constructor(rec: RecorderLike) {
        this.rec = rec;
    }

    private static make(options: Record<string, any>): RecorderLike {
        return new (AudioModule as any).AudioRecorder(createRecordingOptions(options as any)) as RecorderLike;
    }

    /** expo-av: resolves once the mic is live; throws if it could not start. */
    static async createAsync(options: Record<string, any>): Promise<{ recording: Recording; status: AvRecordingStatus }> {
        let rec: RecorderLike | null = null;
        try {
            rec = Recording.make(withVoiceSource(options, "voice_recognition"));
            await rec.prepareToRecordAsync();
            rec.record();
        } catch (first) {
            // A manufacturer may refuse VOICE_RECOGNITION — fall back rather than leave the
            // app unable to record at all (same rule as the old patch). iOS never gets here
            // for this reason; it simply ignores the Android source.
            try { rec?.release(); } catch {}
            if (Platform.OS !== "android") throw first;
            rec = Recording.make(withVoiceSource(options, "default"));
            await rec.prepareToRecordAsync();
            rec.record();
        }
        const recording = new Recording(rec);
        return { recording, status: recording.status() };
    }

    private status(): AvRecordingStatus {
        const s = this.rec.getStatus();
        return {
            canRecord: s.canRecord,
            isRecording: this.done ? false : s.isRecording,
            isDoneRecording: this.done,
            durationMillis: s.durationMillis,
            ...(typeof s.metering === "number" ? { metering: s.metering } : {}),
        };
    }

    private restartTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        if (!this.listener || this.done) return;
        this.timer = setInterval(() => {
            if (this.done || !this.listener) return;
            try { this.listener(this.status()); } catch (e) { console.warn("[av] recording status listener threw:", e); }
        }, this.intervalMs);
    }

    setProgressUpdateInterval(ms: number) {
        this.intervalMs = ms;
        this.restartTimer();
    }

    setOnRecordingStatusUpdate(cb: ((s: AvRecordingStatus) => void) | null) {
        this.listener = cb;
        this.restartTimer();
    }

    getURI(): string | null {
        return this.rec.uri ?? null;
    }

    /** expo-av: stops, releases the recorder; the file stays at getURI(). */
    async stopAndUnloadAsync(): Promise<AvRecordingStatus> {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        if (this.done) throw new Error("Cannot unload a Recording that has already been unloaded.");
        let last: AvRecordingStatus;
        try {
            await this.rec.stop();
        } finally {
            this.done = true;
            last = { canRecord: false, isRecording: false, isDoneRecording: true, durationMillis: 0 };
            try { last.durationMillis = this.rec.getStatus().durationMillis; } catch {}
            // ⚠️ Keep the native object until after uri is read by callers? expo-audio keeps
            // `uri` on the JS object after release, so releasing now is safe.
            const uri = this.rec.uri;
            try { this.rec.release(); } catch {}
            (this.rec as any).uri = uri;
        }
        return last;
    }
}

// ── Playback ──────────────────────────────────────────────────────────────────
export type AvPlaybackStatus =
    | { isLoaded: false; error?: string }
    | {
          isLoaded: true;
          isPlaying: boolean;
          didJustFinish: boolean;
          positionMillis: number;
          durationMillis?: number;
          isLooping: boolean;
      };

type InitialStatus = {
    shouldPlay?: boolean;
    rate?: number;
    shouldCorrectPitch?: boolean;
    volume?: number;
    isLooping?: boolean;
};

/** Pure — exported for tests. expo-audio player status ⇒ expo-av playback status. */
export function toAvPlaybackStatus(s: Pick<AudioStatus, "isLoaded" | "playing" | "didJustFinish" | "currentTime" | "duration" | "loop">): AvPlaybackStatus {
    if (!s.isLoaded) return { isLoaded: false };
    return {
        isLoaded: true,
        isPlaying: s.playing,
        didJustFinish: s.didJustFinish,
        positionMillis: Math.round((s.currentTime ?? 0) * 1000),
        durationMillis: s.duration ? Math.round(s.duration * 1000) : undefined,
        isLooping: s.loop,
    };
}

const LOAD_TIMEOUT_MS = 15_000;

class Sound {
    private player: AudioPlayer;
    private sub: { remove(): void } | null = null;
    private unloaded = false;

    private constructor(player: AudioPlayer) {
        this.player = player;
    }

    /** expo-av: resolves once loaded (and playing, if shouldPlay); throws if it cannot load. */
    static async createAsync(source: any, initial: InitialStatus = {}): Promise<{ sound: Sound; status: AvPlaybackStatus }> {
        const player = createAudioPlayer(source);
        const sound = new Sound(player);
        try {
            await sound.waitLoaded();
            const rate = initial.rate ?? 1.0;
            if (rate !== 1.0 || initial.shouldCorrectPitch) {
                // expo-av's setRateAsync default quality is Medium.
                player.setPlaybackRate(rate, initial.shouldCorrectPitch ? "medium" : undefined);
                if (!initial.shouldCorrectPitch) (player as any).shouldCorrectPitch = false;
            }
            player.volume = initial.volume ?? 1.0;
            player.loop = initial.isLooping ?? false;
            if (initial.shouldPlay) player.play();
        } catch (e) {
            try { player.remove(); } catch {}
            throw e;
        }
        return { sound, status: toAvPlaybackStatus(player.currentStatus) };
    }

    private waitLoaded(): Promise<void> {
        if (this.player.isLoaded) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => {
                sub.remove();
                reject(new Error("Audio did not load in time."));
            }, LOAD_TIMEOUT_MS);
            const sub = this.player.addListener("playbackStatusUpdate", (s: AudioStatus) => {
                if (s.isLoaded) {
                    clearTimeout(t);
                    sub.remove();
                    resolve();
                }
            });
        });
    }

    setOnPlaybackStatusUpdate(cb: ((s: AvPlaybackStatus) => void) | null) {
        this.sub?.remove();
        this.sub = null;
        if (!cb || this.unloaded) return;
        this.sub = this.player.addListener("playbackStatusUpdate", (s: AudioStatus) => {
            if (this.unloaded) return;
            cb(toAvPlaybackStatus(s));
        });
    }

    async playAsync() {
        if (!this.unloaded) this.player.play();
    }

    async pauseAsync() {
        if (!this.unloaded) this.player.pause();
    }

    async stopAsync() {
        if (this.unloaded) return;
        this.player.pause();
        await this.player.seekTo(0).catch(() => {});
    }

    async unloadAsync() {
        if (this.unloaded) return;
        this.unloaded = true;
        this.sub?.remove();
        this.sub = null;
        try { this.player.pause(); } catch {}
        this.player.remove();
    }
}

// ── The namespace the callers import as `Audio` ───────────────────────────────
export const Audio = {
    setAudioModeAsync,
    requestPermissionsAsync: requestRecordingPermissionsAsync,
    getPermissionsAsync: getRecordingPermissionsAsync,
    RecordingOptionsPresets: RecordingPresets as Record<"HIGH_QUALITY" | "LOW_QUALITY", any>,
    Recording,
    Sound,
};
export namespace Audio {
    export type Recording = RecordingClass;
    export type Sound = SoundClass;
}
type RecordingClass = Recording;
type SoundClass = Sound;
