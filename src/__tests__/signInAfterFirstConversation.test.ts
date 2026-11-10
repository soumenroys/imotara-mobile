// src/__tests__/signInAfterFirstConversation.test.ts
// #100 (owner, 8 Nov 2026): the "Remember you, always" sign-in sheet rose over
// the chat on the very first open — it counted Imotara's own greeting as a
// message. Now: after the person's first real conversation, never over a
// crisis, never over a reply still arriving.
import { readFileSync } from "fs";
import { join } from "path";
import { shouldOfferSignIn, SIGN_IN_AFTER_USER_MESSAGES } from "../auth/signInTiming";

describe("when the sign-in sheet may appear", () => {
  it("⛔ never on a first open (only Imotara's greeting so far)", () => {
    expect(shouldOfferSignIn({ userMessageCount: 0, lastMessageFrom: "bot", crisisInThread: false })).toBe(false);
  });
  it("not before the 5th message — the check-in invite owns the 3rd", () => {
    for (const n of [1, 2, 3, 4]) expect(shouldOfferSignIn({ userMessageCount: n, lastMessageFrom: "bot", crisisInThread: false })).toBe(false);
  });
  it("after the first real conversation, once the reply is in", () => {
    expect(SIGN_IN_AFTER_USER_MESSAGES).toBe(5);
    expect(shouldOfferSignIn({ userMessageCount: 5, lastMessageFrom: "bot", crisisInThread: false })).toBe(true);
  });
  it("⛔ never on the same message as the check-in invite (2 since #16 B, 10 Nov 2026)", () => {
    const invite = readFileSync(join(__dirname, "../notifications/checkInInvite.ts"), "utf8");
    expect(invite).toMatch(/args\.userMessageCount >= INVITE_MIN_MESSAGES/);
    expect(invite).toMatch(/export const INVITE_MIN_MESSAGES = 2;/);
    expect(SIGN_IN_AFTER_USER_MESSAGES).toBeGreaterThan(2);
  });
  it("⛔ never while a reply is still on its way", () => {
    expect(shouldOfferSignIn({ userMessageCount: 5, lastMessageFrom: "user", crisisInThread: false })).toBe(false);
  });
  it("⛔ never in a thread that touched a crisis", () => {
    expect(shouldOfferSignIn({ userMessageCount: 9, lastMessageFrom: "bot", crisisInThread: true })).toBe(false);
  });
});

describe("wiring", () => {
  const chat = readFileSync(join(__dirname, "../screens/ChatScreen.tsx"), "utf8");
  const prompt = readFileSync(join(__dirname, "../auth/SignInPrompt.tsx"), "utf8");
  it("the chat counts only the person's messages, and checks every crisis tier", () => {
    expect(chat).toMatch(/userMessageCount: messages\.filter\(\(m\) => m\.from === "user"\)\.length,/);
    expect(chat).toMatch(/crisisInThread: messages\.some\(\(m\) => m\.from === "user" && detectMobileCrisisTier\(m\.text \?\? ""\) > 0\),/);
    expect(chat).not.toMatch(/<SignInPrompt messageCount=\{messages\.length\} \/>/);
  });
  it("the sheet shows only when ready (no message-count threshold of its own)", () => {
    expect(prompt).not.toMatch(/SHOW_AFTER_MESSAGES/);
    expect(prompt).toMatch(/status === "unauthenticated" &&\s*ready/);
  });
  it("waits a few seconds after the reply lands, and cancels if not ready any more", () => {
    expect(prompt).toMatch(/export const SHOW_DELAY_MS = 6000;/);
    expect(prompt).toMatch(/const t = setTimeout\(\(\) => \{\s*setVisible\(true\);/);
    expect(prompt).toMatch(/return \(\) => clearTimeout\(t\);/);
  });
});
