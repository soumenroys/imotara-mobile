// UX-27. The app never read the system Reduce Motion setting on mobile.
//
// The failure mode worth pinning is not "did we turn animations off" — it is
// what happens to the thing being animated. Turning a fade-in off by skipping
// it leaves the view at opacity 0 forever.

import { motionDuration, shouldLoopDecoration } from "../lib/a11y/reduceMotion";

describe("motionDuration", () => {
  it("leaves durations alone normally", () => {
    expect(motionDuration(220, false)).toBe(220);
    expect(motionDuration(0, false)).toBe(0);
  });

  it("collapses to instant, and to zero rather than something negative", () => {
    expect(motionDuration(220, true)).toBe(0);
    expect(motionDuration(4000, true)).toBe(0);
  });

  it("is instant, never absent — the animation must still run and still land", () => {
    // A duration of 0 keeps Animated.timing, its start() callback and its
    // final value. Anything that instead skipped the call would leave the
    // view stuck at its starting opacity, which is the usual way this setting
    // gets "respected" into a bug.
    expect(typeof motionDuration(220, true)).toBe("number");
    expect(motionDuration(220, true)).not.toBeLessThan(0);
  });
});

describe("shouldLoopDecoration", () => {
  it("stops ornamental loops when motion is reduced", () => {
    expect(shouldLoopDecoration(true)).toBe(false);
    expect(shouldLoopDecoration(false)).toBe(true);
  });
});
