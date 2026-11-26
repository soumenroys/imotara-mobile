/**
 * How long the Android splash takes to fade into the app, in ms.
 * SDK 58's splash module defaults to 400 ms (ease-in), which made the December
 * build LOOK ~0.25 s slower than 1.7.2 although it was ready at the same moment.
 * 1.7.2's system crossfade was ≈ 100 ms. ⛔ Don't raise this without timing a cold start.
 */
export const SPLASH_FADE_MS = 120;
