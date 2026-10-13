import fs from "fs";
import path from "path";

jest.mock("@react-native-async-storage/async-storage", () => {
    const store: Record<string, string> = {};
    return {
        __esModule: true,
        default: {
            getItem: jest.fn(async (k: string) => store[k] ?? null),
            setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
            removeItem: jest.fn(async (k: string) => { delete store[k]; }),
        },
    };
});
jest.mock("expo-notifications", () => ({}), { virtual: true });

import {
    SNOOZE_DAYS,
    snoozeCheckInReminder,
    resumeCheckInReminder,
    getSnoozedUntil,
    isSnoozed,
} from "../notifications/checkInReminder";

const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const MOD = strip(fs.readFileSync(
    path.join(__dirname, "..", "notifications", "checkInReminder.ts"), "utf8"));
const APP = strip(fs.readFileSync(path.join(__dirname, "..", "..", "App.tsx"), "utf8"));
const SETTINGS = strip(fs.readFileSync(
    path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8"));

describe("pausing the reminder on mobile", () => {
    beforeEach(async () => { await resumeCheckInReminder(); });

    it("offers exactly 3 and 5 days, matching the web repo", () => {
        expect([...SNOOZE_DAYS]).toEqual([3, 5]);
    });

    it("pauses and reports when it resumes", async () => {
        const now = new Date("2026-10-14T12:00:00Z");
        const until = await snoozeCheckInReminder(3, now);
        expect(until?.toISOString()).toBe("2026-10-17T12:00:00.000Z");
        expect(await isSnoozed(new Date("2026-10-16T12:00:00Z"))).toBe(true);
        expect(await isSnoozed(new Date("2026-10-18T12:00:00Z"))).toBe(false);
    });

    it("⛔ refuses a length that is not offered", async () => {
        // Without this a caller could pause for a year and get the paid control
        // free. Mirrors isValidSnoozeDays on the server.
        expect(await snoozeCheckInReminder(30 as unknown as 3)).toBeNull();
        expect(await getSnoozedUntil()).toBeNull();
    });

    it("resuming clears it, and is never gated", async () => {
        await snoozeCheckInReminder(5);
        await resumeCheckInReminder();
        expect(await getSnoozedUntil()).toBeNull();
    });

    it("⛔ a pause CANCELS the scheduled notification, not just a flag", () => {
        // On mobile the reminder is a LOCAL notification: the OS fires what is
        // already scheduled regardless of any stored date. A snooze that only
        // writes a flag would change nothing the person can see.
        const fn = MOD.slice(MOD.indexOf("export async function snoozeCheckInReminder"));
        const body = fn.slice(0, fn.indexOf("export async function resumeCheckInReminder"));
        expect(body).toMatch(/cancelCheckInReminder\(\)/);
        expect(body).toMatch(/cancelInactivityReminder\(\)/);
    });

    it("🔑 the app RE-ARMS when the pause expires", () => {
        // Nothing else can: the notification was cancelled, so there is no
        // pending event to wake us up and put it back. Without this a 3-day
        // pause is permanent — the exact free-tier trap option (a) avoids.
        expect(MOD).toMatch(/export async function rearmAfterSnooze/);
        expect(APP).toMatch(/rearmAfterSnooze\(\)/);
        expect(APP).toMatch(/next === "active"/);
    });

    it("⚠️ junk must not read as paused forever", async () => {
        const AS = require("@react-native-async-storage/async-storage").default;
        await AS.setItem("imotara.checkin.snoozedUntil", "not a date");
        expect(await getSnoozedUntil()).toBeNull();
        expect(await isSnoozed()).toBe(false);
    });

    it("the settings screen says the OS switch is always available", () => {
        // Load-bearing: a paywalled in-app off switch is only defensible
        // because silencing Imotara at the device level is free to everyone.
        expect(SETTINGS).toMatch(/device notification settings/);
        expect(SETTINGS).toMatch(/Resumes on/);
    });
});

describe("🔴 gaps found in the 2026-10-13 verification pass", () => {
    it("⛔ the reminder language is RESOLVED, not read from a key nothing writes", () => {
        // FOUND IN REVIEW: buildCheckInBody read a CHECKIN_LANG_KEY that was
        // never written anywhere, so every daily reminder fell back to English
        // — in all 22 languages, silently, with every test still green.
        expect(MOD).toMatch(/export async function resolveReminderLang/);
        expect(MOD).toMatch(/imotara_settings_v1/);
        expect(MOD).not.toMatch(/getItem\(CHECKIN_LANG_KEY\)/);
    });

    it("⛔ 'auto' falls through to the DEVICE LOCALE, never to English", () => {
        // Collapsing "auto" to English is the trap that put the crisis card in
        // English for everyone on the default setting (a6f167f).
        const fn = MOD.slice(MOD.indexOf("export async function resolveReminderLang"));
        const body = fn.slice(0, 900);
        expect(body).toMatch(/!== "auto"/);
        expect(body).toMatch(/resolvedOptions\(\)\.locale/);
    });

    it("⛔ paid tiers can turn reminders off on mobile, as they can on web", () => {
        // Mobile offered pause only, so a Plus subscriber had a control on web
        // that did not exist on their phone.
        expect(MOD).toMatch(/export async function disableCheckInReminder/);
        expect(SETTINGS).toMatch(/canDisableReminders/);
        expect(SETTINGS).toMatch(/licenseTier !== "free"/);
    });

    it("⛔ turning off also clears a pause", () => {
        // Otherwise a stale snooze could expire and re-arm the reminder behind
        // the person's back, undoing an explicit "off".
        const fn = MOD.slice(MOD.indexOf("export async function disableCheckInReminder"));
        expect(fn.slice(0, 700)).toMatch(/resumeCheckInReminder\(\)/);
    });

    it("⛔ re-arming respects an explicit off", () => {
        // rearmAfterSnooze must not resurrect a reminder the person disabled.
        const fn = MOD.slice(MOD.indexOf("export async function rearmAfterSnooze"));
        expect(fn.slice(0, 800)).toMatch(/isCheckInReminderEnabled\(\)/);
    });
});
