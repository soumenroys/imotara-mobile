/**
 * The voice-activity gate — does this turn look like a person, or a room?
 *
 * Owner report, 2026-09-16: "at time of hands free recording lots of noises are
 * getting recorded with wrong interpretation as a human language." The A27's
 * own chat history holds a message reading "Wheeze" — a Whisper sound-event
 * annotation that arrived as if someone had said it.
 *
 * Every test here runs the real function over a synthesised metering trace, so
 * these assert behaviour rather than the presence of source text.
 *
 * The bias under test is FAIL OPEN. A false negative discards words somebody
 * actually said; a false positive costs one transcription that the server-side
 * hallucination guards catch anyway. Where the two trade off, speech wins.
 */
import {
    looksLikeSpeech,
    dynamicRangeDb,
    MIN_METERING_SAMPLES_FOR_VAD,
    SPEECH_DYNAMIC_RANGE_DB,
} from "../lib/voiceActivity";

/** Steady mechanical noise: a fan, traffic, a fridge. Jitters a decibel or so. */
const steadyNoise = (n: number, level: number, jitter = 1) =>
    Array.from({ length: n }, (_, i) => level + Math.sin(i * 1.7) * jitter);

/** Connected speech: voiced peaks with the gaps between words falling away. */
const speech = (n: number, peak = -25, floor = -52) =>
    Array.from({ length: n }, (_, i) => (i % 5 < 2 ? floor + (i % 3) : peak - (i % 4) * 2));

describe("a room making noise is not a person talking", () => {
    it("steady noise is rejected however LOUD it is", () => {
        // The point the whole gate turns on: loudness cannot separate these.
        // A fan at -20 dBFS is louder than a quiet person and still not speech.
        for (const level of [-60, -45, -35, -20, -10]) {
            expect(looksLikeSpeech(steadyNoise(60, level))).toBe(false);
        }
    });

    it("connected speech is accepted however QUIET it is", () => {
        // Shifting the whole trace down must not change the verdict — someone
        // softly spoken, or holding the phone at arm's length, still gets heard.
        for (const shift of [0, -10, -20]) {
            expect(looksLikeSpeech(speech(60, -25 + shift, -52 + shift))).toBe(true);
        }
    });

    it("the decision is about spread, not level", () => {
        const quietSpeech = speech(60, -45, -70);
        const loudNoise = steadyNoise(60, -15);
        expect(dynamicRangeDb(quietSpeech)).toBeGreaterThan(dynamicRangeDb(loudNoise));
    });
});

describe("it fails open — never discard what someone actually said", () => {
    it("too few samples is treated as speech, not as noise", () => {
        // A very short utterance gives too little to measure. Guessing "noise"
        // there would bin a real, if brief, answer.
        for (let n = 0; n < MIN_METERING_SAMPLES_FOR_VAD; n++) {
            expect(looksLikeSpeech(steadyNoise(n, -30))).toBe(true);
        }
    });

    it("the very next sample after the minimum is judged normally", () => {
        expect(looksLikeSpeech(steadyNoise(MIN_METERING_SAMPLES_FOR_VAD, -30))).toBe(false);
    });

    it("an empty trace — metering unavailable — is treated as speech", () => {
        // Manual recording does not meter at all. It must never be gated.
        expect(looksLikeSpeech([])).toBe(true);
    });

    it("a borderline trace is resolved towards speech", () => {
        const atThreshold = [
            ...Array(30).fill(-40),
            ...Array(30).fill(-40 + SPEECH_DYNAMIC_RANGE_DB),
        ];
        expect(looksLikeSpeech(atThreshold)).toBe(true);
    });
});

describe("one loud event does not make a recording into speech", () => {
    it("a single door slam over steady noise is still noise", () => {
        // Why percentiles and not max-minus-min: one outlier sample would
        // otherwise let an hour of fan noise through.
        const slam = steadyNoise(60, -45);
        slam[30] = -5;
        expect(dynamicRangeDb(slam)).toBeLessThan(SPEECH_DYNAMIC_RANGE_DB);
        expect(looksLikeSpeech(slam)).toBe(false);
    });

    it("a single dropout in real speech does not change the verdict", () => {
        const s = speech(60);
        const withDropout = [...s];
        withDropout[10] = -160;
        expect(looksLikeSpeech(s)).toBe(true);
        expect(looksLikeSpeech(withDropout)).toBe(true);
    });

    it("a handful of outliers cannot carry a noise trace over the line", () => {
        const noisy = steadyNoise(100, -40);
        for (const i of [10, 20, 30, 40]) noisy[i] = 0; // 4% of samples, clipping
        expect(looksLikeSpeech(noisy)).toBe(false);
    });
});

describe("the statistic itself", () => {
    it("is zero for a perfectly flat trace and for nothing at all", () => {
        expect(dynamicRangeDb(Array(50).fill(-30))).toBe(0);
        expect(dynamicRangeDb([])).toBe(0);
    });

    it("is order-independent — the same samples shuffled give the same answer", () => {
        const s = speech(60);
        const shuffled = [...s].sort(() => 0.5 - Math.random());
        expect(dynamicRangeDb(shuffled)).toBeCloseTo(dynamicRangeDb(s), 10);
    });

    it("does not mutate the caller's array", () => {
        // The hook keeps appending to this array while a turn runs.
        const s = speech(30);
        const before = [...s];
        dynamicRangeDb(s);
        expect(s).toEqual(before);
    });

    it("grows as the gap between loud and quiet parts grows", () => {
        const narrow = dynamicRangeDb(speech(60, -30, -40));
        const wide = dynamicRangeDb(speech(60, -30, -70));
        expect(wide).toBeGreaterThan(narrow);
    });
});
