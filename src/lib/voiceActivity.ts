// Telling a person talking apart from a room making noise, using only the
// amplitude metering expo-av already gives us.
//
// Why this exists: the owner, 2026-09-16 — "at time of hands free recording
// lots of noises are getting recorded with wrong interpretation as a human
// language". Corroborated on their Galaxy A27, whose chat history contains a
// message reading "Wheeze" (a Whisper sound-event annotation that got through
// as if someone had said it), and whose hands-free turns in a QUIET room were
// ending via silence-stop at 3s — meaning ambient noise was crossing the
// -35 dBFS speech threshold on its own.
//
// Loudness alone cannot separate the two: a fan, traffic or a fridge hum sits
// at a perfectly speech-like level. What separates them is SHAPE. Speech is
// amplitude-modulated — syllables, plosives, the gaps between words — so its
// level swings constantly. Steady noise, by definition, does not swing.
//
// We cannot do this in the frequency domain: metering arrives every 200ms
// (5 Hz), and the syllable rate we would want to detect is 3–8 Hz, above the
// 2.5 Hz Nyquist limit of that sampling. What 5 Hz sampling CAN measure
// reliably, over a few seconds, is dynamic range — and that is enough.
//
// ⚠️ This gate FAILS OPEN, everywhere and deliberately. Every uncertain case —
// too few samples, no samples, a short utterance — is treated as speech. The
// cost of a false negative is someone's actual words silently discarded, which
// is far worse than the cost of a false positive (one wasted transcription that
// the server-side hallucination guards then catch anyway).

/** Metering is dBFS: roughly -160 (digital silence) up to 0 (clipping). */

/**
 * Below this many samples the statistic is not trustworthy, so we do not use
 * it. 10 samples is 2 seconds at expo-av's 200ms progress interval — long
 * enough for at least a couple of syllables and the gaps around them.
 */
export const MIN_METERING_SAMPLES_FOR_VAD = 10;

/**
 * How many dB of spread (90th minus 10th percentile) a turn must show before
 * we accept it as someone talking.
 *
 * Steady mechanical noise typically spreads under ~6 dB across a few seconds;
 * connected speech spreads well past 15 dB, because the gaps between words sit
 * near the room floor while voiced vowels peak far above it. 8 dB sits below
 * the bottom of the speech range rather than in the middle of the gap — the
 * fail-open bias again: we would rather pass some noise through than clip a
 * quiet, evenly-spoken sentence.
 */
export const SPEECH_DYNAMIC_RANGE_DB = 8;

/** Highest number of samples kept per turn — 300 is 60s, the recording cap. */
export const MAX_METERING_SAMPLES = 300;

/** Percentile of an already-sorted ascending array, clamped to its bounds. */
function percentile(sorted: number[], p: number): number {
    const i = Math.round(p * (sorted.length - 1));
    return sorted[Math.min(sorted.length - 1, Math.max(0, i))];
}

/**
 * The spread between the loud and quiet parts of a turn, in dB.
 *
 * Percentiles rather than max-minus-min: a single door slam or a one-sample
 * dropout would otherwise make any recording look like speech.
 */
export function dynamicRangeDb(samples: number[]): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    return percentile(sorted, 0.9) - percentile(sorted, 0.1);
}

/**
 * Does this turn look like a person talking, rather than a room making noise?
 *
 * Returns true whenever we cannot tell — see the fail-open note above.
 */
export function looksLikeSpeech(samples: number[]): boolean {
    if (samples.length < MIN_METERING_SAMPLES_FOR_VAD) return true;
    return dynamicRangeDb(samples) >= SPEECH_DYNAMIC_RANGE_DB;
}
