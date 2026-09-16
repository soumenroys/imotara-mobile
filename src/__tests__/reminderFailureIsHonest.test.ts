/**
 * The reminder toggle must say what actually went wrong.
 *
 * 🔴 THE BUG THIS FILE EXISTS FOR, 2026-09-16. Turning "Daily check-in
 * reminder" on showed:
 *
 *     Permission needed — Please allow notifications in your device settings
 *
 * while POST_NOTIFICATIONS was granted and had been all along. The real fault
 * was a NotSerializableException inside expo-notifications (R8 had stripped
 * its Serializable hooks). The alert fired on `scheduleCheckInReminder()`
 * returning false FOR ANY REASON — the wording was the UI's guess, not a
 * diagnosis — and it sent an hour of the owner's investigation at device
 * settings. Any user hitting a non-permission fault would be misled the same
 * way, with no way to tell.
 *
 * So the module now reports WHY, and the screen branches on it.
 */
import fs from "fs";
import path from "path";

const mockGetPermissions = jest.fn(async () => ({ status: "granted" }));
const mockRequestPermissions = jest.fn(async () => ({ status: "granted" }));
const mockSchedule = jest.fn(async () => "notif-id-1");
const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
        removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
        multiSet: jest.fn(async () => undefined),
    },
}));
jest.mock("expo-notifications", () => ({
    getPermissionsAsync: mockGetPermissions,
    requestPermissionsAsync: mockRequestPermissions,
    scheduleNotificationAsync: mockSchedule,
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    setNotificationHandler: jest.fn(),
    SchedulableTriggerInputTypes: { DAILY: "daily", TIME_INTERVAL: "timeInterval" },
}), { virtual: true });

import { scheduleCheckInReminder, scheduleCheckInReminderWithReason } from "../notifications/checkInReminder";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const SETTINGS = strip(fs.readFileSync(path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8"));
const MOD = strip(fs.readFileSync(path.join(__dirname, "..", "notifications", "checkInReminder.ts"), "utf8"));

/** The body of handleReminderToggle, where the alert lives. */
const TOGGLE = (() => {
    const i = SETTINGS.indexOf("const handleReminderToggle");
    expect(i).toBeGreaterThan(-1);
    const j = SETTINGS.indexOf("const handleReminderTimeChange", i);
    return SETTINGS.slice(i, j);
})();

describe("the module reports WHY, not just false", () => {
    beforeEach(() => {
        for (const k of Object.keys(mockStore)) delete mockStore[k];
        mockGetPermissions.mockResolvedValue({ status: "granted" });
        mockRequestPermissions.mockResolvedValue({ status: "granted" });
        mockSchedule.mockReset().mockResolvedValue("notif-id-1");
    });

    it("success is { ok: true }", async () => {
        await expect(scheduleCheckInReminderWithReason(9, 0)).resolves.toEqual({ ok: true });
    });

    it("a denied permission reports 'permission'", async () => {
        mockGetPermissions.mockResolvedValue({ status: "denied" });
        mockRequestPermissions.mockResolvedValue({ status: "denied" });
        await expect(scheduleCheckInReminderWithReason(9, 0)).resolves.toEqual({ ok: false, reason: "permission" });
    });

    it("⚠️ a THROW from the notifications module reports 'failed', not 'permission'", async () => {
        // This is the R8 case, reproduced: permission granted, module present,
        // scheduleNotificationAsync blows up. Before the fix this was
        // indistinguishable from a permission refusal.
        mockSchedule.mockRejectedValue(new Error("NotSerializableException: org.json.JSONObject"));
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        await expect(scheduleCheckInReminderWithReason(9, 0)).resolves.toEqual({ ok: false, reason: "failed" });
        // And it must leave a trace — the missing logcat line that cost an hour.
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("a failure does not leave the reminder marked enabled", async () => {
        // Positive control first — otherwise a typo in the key name would make
        // the real assertion below pass against nothing at all.
        await scheduleCheckInReminderWithReason(9, 0);
        expect(mockStore["imotara.checkin.enabled"]).toBe("1");
        delete mockStore["imotara.checkin.enabled"];

        mockSchedule.mockRejectedValue(new Error("boom"));
        jest.spyOn(console, "warn").mockImplementation(() => {});
        await scheduleCheckInReminderWithReason(9, 0);
        expect(mockStore["imotara.checkin.enabled"]).toBeUndefined();
        (console.warn as jest.Mock).mockRestore?.();
    });
});

describe("⚠️ the boolean wrapper stays boolean", () => {
    beforeEach(() => {
        for (const k of Object.keys(mockStore)) delete mockStore[k];
        mockGetPermissions.mockResolvedValue({ status: "granted" });
        mockSchedule.mockReset().mockResolvedValue("notif-id-1");
    });

    it("returns true/false, never an object", async () => {
        // Four call sites do `.catch(() => {})` on this. If it ever returned
        // the result object, an `if (result)` anywhere would read TRUTHY for
        // every failure — reporting success precisely when it failed.
        await expect(scheduleCheckInReminder(9, 0)).resolves.toBe(true);
        mockSchedule.mockRejectedValue(new Error("boom"));
        jest.spyOn(console, "warn").mockImplementation(() => {});
        await expect(scheduleCheckInReminder(9, 0)).resolves.toBe(false);
        (console.warn as jest.Mock).mockRestore?.();
    });

    it("it delegates rather than duplicating the logic", () => {
        expect(MOD).toMatch(/return \(await scheduleCheckInReminderWithReason\(hour, minute, sound, badge\)\)\.ok;/);
    });
});

describe("the screen tells the truth about each case", () => {
    it("the toggle reads the reason instead of a bare boolean", () => {
        expect(TOGGLE).toMatch(/await scheduleCheckInReminderWithReason\(/);
        expect(TOGGLE).toMatch(/result\.reason === "permission"/);
        expect(TOGGLE).toMatch(/result\.reason === "unavailable"/);
    });

    it("🔴 'Open Settings' appears ONLY in the permission branch", () => {
        // The heart of the bug: offering device settings for a fault that
        // device settings cannot fix. Exactly one occurrence, and it must sit
        // inside the permission branch.
        const openSettings = TOGGLE.match(/Linking\.openSettings/g) ?? [];
        expect(openSettings).toHaveLength(1);
        const permIdx = TOGGLE.indexOf('result.reason === "permission"');
        const otherIdx = TOGGLE.indexOf('result.reason === "unavailable"');
        const settingsIdx = TOGGLE.indexOf("Linking.openSettings");
        expect(settingsIdx).toBeGreaterThan(permIdx);
        expect(settingsIdx).toBeLessThan(otherIdx);
    });

    it("🔴 'Permission needed' is never shown for a non-permission failure", () => {
        const permTitles = TOGGLE.match(/"Permission needed"/g) ?? [];
        expect(permTitles).toHaveLength(1);
        // …and the wording after the permission branch must not claim it either.
        const afterPermBranch = TOGGLE.slice(TOGGLE.indexOf('result.reason === "unavailable"'));
        expect(afterPermBranch).not.toMatch(/Permission needed/);
        expect(afterPermBranch).not.toMatch(/allow notifications/i);
    });

    it("each failure gets its own message", () => {
        expect(TOGGLE).toMatch(/Reminders aren't available/);
        expect(TOGGLE).toMatch(/Couldn't set the reminder/);
    });

    it("only success flips the switch on", () => {
        const on = TOGGLE.match(/setReminderEnabled\(true\)/g) ?? [];
        expect(on).toHaveLength(1);
        expect(TOGGLE).toMatch(/if \(result\.ok\) \{\s*setReminderEnabled\(true\);/);
    });
});
