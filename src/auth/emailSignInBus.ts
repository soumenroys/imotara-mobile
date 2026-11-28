// src/auth/emailSignInBus.ts — #134 (12 Nov 2026): every sign-in place in the app opens the ONE
// email sign-in sheet (src/auth/EmailSignInSheet.tsx), mounted once in App.tsx.
export type EmailIntent = "signin" | "create" | "reset";
type Listener = (start: { intent: EmailIntent | null }) => void;
const listeners = new Set<Listener>();

/** Open the email sign-in sheet — at its first screen, or straight at a step (create / reset). */
export function openEmailSignIn(intent: EmailIntent | null = null): void {
  listeners.forEach((l) => l({ intent }));
}
export function onOpenEmailSignIn(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// 27 Nov 2026: the upgrade sheet hides itself while the email sheet is open and must know when it
// closes (signed in or not) so it can come back and resume the purchase the person tapped.
const closedListeners = new Set<() => void>();
export function emailSignInClosed(): void {
  closedListeners.forEach((l) => l());
}
export function onEmailSignInClosed(l: () => void): () => void {
  closedListeners.add(l);
  return () => { closedListeners.delete(l); };
}
