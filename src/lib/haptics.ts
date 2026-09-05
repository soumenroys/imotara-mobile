// src/lib/haptics.ts
// One haptics implementation, for both platforms (UX-07).
//
// It was built on React Native's Vibration API. On Android that is fine. On
// iOS it does not reach the Taptic Engine at all, and vibration PATTERNS are
// ignored outright — so `Vibration.vibrate([0, 15, 60, 15])` did nothing on an
// iPhone, and the off/light/strong control in Settings was a switch wired to
// nothing for every iOS user.
//
// expo-haptics is the iOS path. Android keeps Vibration, unchanged: it already
// worked, and the patterns there are tuned. Fixing the broken platform is not a
// reason to disturb the working one.
//
// Every call is fire-and-forget and swallows its own errors. A device with no
// haptic hardware, or a user who has disabled system haptics, must never turn a
// sent message into a crash.

import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

export type HapticIntensity = "off" | "light" | "strong";

let intensity: HapticIntensity = "light";

/** Set from the stored preference on launch, and when Settings changes it. */
export function setHapticIntensity(value: string | null | undefined): void {
  if (value === "off" || value === "light" || value === "strong") intensity = value;
}

export function getHapticIntensity(): HapticIntensity {
  return intensity;
}

const quiet = (p: Promise<unknown>) => { void p.catch(() => {}); };

/**
 * "strong" maps to the richer feedback rather than a louder one.
 *
 * iOS has no volume knob — impact styles differ in character, not amplitude.
 * So light gets a plain impact and strong gets the patterned notification
 * feedback, which parallels what the Android patterns already do: the strong
 * setting is longer and more textured, not merely harder.
 */
export const haptic = {
  /** A button, a send, a selection. */
  tap(): void {
    if (intensity === "off") return;
    if (Platform.OS === "ios") {
      quiet(Haptics.impactAsync(
        intensity === "strong" ? Haptics.ImpactFeedbackStyle.Heavy
                               : Haptics.ImpactFeedbackStyle.Light));
      return;
    }
    try { Vibration.vibrate(intensity === "strong" ? 20 : 10); } catch {}
  },

  /** A reply arrived. */
  receive(): void {
    if (intensity === "off") return;
    if (Platform.OS === "ios") {
      quiet(intensity === "strong"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      return;
    }
    try { Vibration.vibrate(intensity === "strong" ? [0, 15, 60, 15] : [0, 8, 40, 8]); } catch {}
  },

  /** Something went wrong. */
  error(): void {
    if (intensity === "off") return;
    if (Platform.OS === "ios") {
      quiet(intensity === "strong"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
      return;
    }
    try { Vibration.vibrate(intensity === "strong" ? [0, 50, 80, 50] : [0, 30, 60, 30]); } catch {}
  },
};
