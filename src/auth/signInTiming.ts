// src/auth/signInTiming.ts
// When may the "Remember you, always" sign-in sheet appear? (#100, owner 8 Nov 2026)
//
// 🔴 It used to get `messages.length`, which counts Imotara's own greeting — so
// the threshold of 1 was met on the very FIRST open, and the sheet rose over
// the chat before the person had typed a word (seen in the simulator, 1.6.6).
// Owner: show it after their first conversation instead.
//
// ⛔ Never over a crisis: if anything the person wrote in this thread hits a
// crisis tier, the sheet waits for another day.
// ⛔ Never over a reply being read: only once the latest message is Imotara's.

/** Same "first real conversation" signal as the check-in invite. */
export const SIGN_IN_AFTER_USER_MESSAGES = 3;

export function shouldOfferSignIn(p: {
    userMessageCount: number;
    lastMessageFrom: "user" | "bot" | string | undefined;
    crisisInThread: boolean;
}): boolean {
    if (p.crisisInThread) return false;
    if (p.userMessageCount < SIGN_IN_AFTER_USER_MESSAGES) return false;
    return p.lastMessageFrom === "bot";
}
