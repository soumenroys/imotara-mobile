// src/lib/a11y/reduceMotion.ts
// "Reduce Motion" is a system setting on both platforms, and the app has never
// read it (UX-27). Web has honoured prefers-reduced-motion since globals.css:667;
// mobile had zero uses of AccessibilityInfo.
//
// Kept as a pure function so the decision is testable without a native runtime.

/**
 * How long an animation should run.
 *
 * Reduce Motion means **instant, not absent**. Returning 0 keeps every
 * Animated.timing call, its .start() callback and its final value exactly as
 * they were — the view still ends up opaque, still ends up in place. Skipping
 * the animation instead would leave whatever it was animating stuck at its
 * starting value, which is how "respecting" this setting usually breaks things.
 */
export function motionDuration(ms: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : ms;
}

/**
 * Whether a purely decorative, repeating animation should run at all.
 *
 * This is for loops that exist only as ornament — a pulsing dot, a shimmer.
 * It is NOT for animation that carries meaning: the breathing pacer's whole
 * purpose is the movement, and a still circle is not a gentler version of it,
 * it is a broken one. Those keep animating.
 */
export function shouldLoopDecoration(reduceMotion: boolean): boolean {
  return !reduceMotion;
}
