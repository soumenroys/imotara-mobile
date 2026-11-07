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

/**
 * After the 5th message from the person. ⚠️ NOT 3: the check-in invite ("Shall
 * I check in with you tomorrow?") appears after the 3rd, and in the simulator
 * (8 Nov) the sign-in sheet rose over that card — two asks at once. The invite
 * keeps the 3rd message; sign-in waits two more.
 */
export const SIGN_IN_AFTER_USER_MESSAGES = 5;

export function shouldOfferSignIn(p: {
    userMessageCount: number;
    lastMessageFrom: "user" | "bot" | string | undefined;
    crisisInThread: boolean;
}): boolean {
    if (p.crisisInThread) return false;
    if (p.userMessageCount < SIGN_IN_AFTER_USER_MESSAGES) return false;
    return p.lastMessageFrom === "bot";
}
