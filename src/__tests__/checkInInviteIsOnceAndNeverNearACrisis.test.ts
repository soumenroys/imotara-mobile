/**
 * 🌙 THE CHECK-IN INVITE (owner, 25 Oct 2026) — once ever, after a real
 * exchange, never near a crisis; and the daily reminder that was ON but never
 * scheduled is now actually scheduled at launch (without asking at launch).
 */
import { readFileSync } from "fs";
import { join } from "path";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { INVITE, getInviteStrings, shouldOfferInvite, formatHour, INVITE_MIN_MESSAGES, INVITE_HOURS, INVITE_MINUTES } from "../notifications/checkInInvite";
import { DEFAULT_HOUR, DEFAULT_MINUTE } from "../notifications/checkInReminder";

const LANGS = ["en", "hi", "bn", "mr", "ta", "te", "gu", "kn", "ml", "pa", "or", "ur", "ar", "ru", "zh", "ja", "es", "fr", "de", "pt", "id", "he"];
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const base = { state: "unseen" as const, userMessageCount: 2, crisisInThread: false, remindersOn: true, paused: false };

describe("when the card may appear", () => {
  it("after a real exchange — 2 messages from the person (#16 B, 10 Nov 2026; was 3)", () => {
    expect(INVITE_MIN_MESSAGES).toBe(2);
    expect(shouldOfferInvite(base)).toBe(true);
    expect(shouldOfferInvite({ ...base, userMessageCount: 1 })).toBe(false);
  });
  it("#16 B / #77e: the evening choice and the default reminder are both 20:30", () => {
    expect([DEFAULT_HOUR, DEFAULT_MINUTE]).toEqual([20, 30]);
    expect([INVITE_HOURS.evening, INVITE_MINUTES.evening]).toEqual([20, 30]);
    expect(formatHour(20, "en-US", 30)).toMatch(/8:30/);
    const card = src("components/imotara/CheckInInviteCard.tsx");
    expect(card).toMatch(/pick\(INVITE_HOURS\.evening, INVITE_MINUTES\.evening\)/);
    expect(card).toMatch(/acceptInvite\(hour, minute\)/);
  });
  it("⛔ never anywhere near a crisis", () => expect(shouldOfferInvite({ ...base, crisisInThread: true })).toBe(false));
  it("⛔ never again once answered — 'Not now' included", () => {
    expect(shouldOfferInvite({ ...base, state: "declined" })).toBe(false);
    expect(shouldOfferInvite({ ...base, state: "accepted" })).toBe(false);
  });
  it("⛔ not when reminders are off or paused", () => {
    expect(shouldOfferInvite({ ...base, remindersOn: false })).toBe(false);
    expect(shouldOfferInvite({ ...base, paused: true })).toBe(false);
  });
  it("the chat screen checks crisis across the WHOLE conversation, plus the message just sent", () =>
    expect(src("screens/ChatScreen.tsx")).toMatch(/crisisInThread: userTexts\.some\(\(t\) => detectMobileCrisisTier\(t\) > 0\)/));
});

describe("its words, in every language Imotara speaks", () => {
  it("all 22 languages, every line written", () => {
    for (const l of LANGS) {
      const s = INVITE[l];
      expect(s).toBeDefined();
      for (const k of ["q", "sub", "choose", "later", "blocked"] as const) expect(s[k].trim().length).toBeGreaterThan(1);
      expect(s.done("TIME")).toContain("TIME");
    }
    expect(Object.keys(INVITE).sort()).toEqual([...LANGS].sort());
  });
  it("⛔ it promises the lock screen never shows what they wrote — in every language", () => {
    expect(INVITE.en.sub).toMatch(/never shows what you wrote/);
  });
  it("regional tags fall back to the base language, unknown to English", () => {
    expect(getInviteStrings("bn-IN").q).toBe(INVITE.bn.q);
    expect(getInviteStrings("xx").q).toBe(INVITE.en.q);
  });
  it("the hour reads as a time", () => expect(formatHour(20, "en-US")).toMatch(/8/));
});

describe("permission is asked only after a tap", () => {
  it("⛔ the launch fix never raises the prompt — it reads the status only", () => {
    const f = src("notifications/checkInInvite.ts");
    const fn = f.slice(f.indexOf("export async function ensureDailyReminderScheduled"));
    expect(fn).toMatch(/getPermissionsAsync\(\)/);
    expect(fn).toMatch(/if \(status !== "granted"\) return false;/);
    expect(fn).not.toMatch(/requestPermissionsAsync/);
  });
  it("the launch fix runs at app start, after a pause is re-armed", () =>
    expect(src("../App.tsx")).toMatch(/rearmAfterSnooze\(\)\.then\(\(\) => ensureDailyReminderScheduled\(\)\)/));
  it("the person's own sound and badge choices are kept", () =>
    expect(src("notifications/checkInInvite.ts").match(/getSavedNotifPrefs\(\)/g)?.length).toBe(2));
});
