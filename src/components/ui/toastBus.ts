// src/components/ui/toastBus.ts
// A way to show a toast from anywhere in a screen without threading a ref
// through every component (UX-17).
//
// ConnectScreen is 5,400 lines across sixteen components, and the failure
// messages worth moving off Alert live in six of them. Passing a ref down all
// of those is a lot of churn for a message that is fire-and-forget.
//
// The important property is the fallback. If no Toast is mounted — the screen
// is unmounting, a component renders outside the provider, someone reuses this
// somewhere new — the message goes to Alert instead. So the worst case is the
// behaviour we already had, and a failure message can never be silently
// swallowed. That matters here: these fire in a paid booking and wallet flow,
// where "nothing happened and nothing was said" is the bad outcome.

import { Alert } from "react-native";
import type { ToastKind } from "./toastColors";

type Show = (message: string, kind?: ToastKind) => void;

let current: Show | null = null;

/** Called by the screen that mounts <Toast/>. Returns an unregister function. */
export function registerToast(show: Show): () => void {
  current = show;
  return () => {
    if (current === show) current = null;
  };
}

/**
 * Show a transient message. Falls back to a blocking Alert when nothing is
 * mounted, so the message is always delivered somehow.
 */
export function showToast(message: string, kind: ToastKind = "error"): void {
  if (current) {
    current(message, kind);
    return;
  }
  Alert.alert(kind === "error" ? "Something went wrong" : "Imotara", message);
}

/** Tests only. */
export function __resetToastBus(): void {
  current = null;
}
