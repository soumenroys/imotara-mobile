/**
 * "Reminders off" must take the pending inactivity nudge with it.
 *
 * Found on the owner's Galaxy A27, 2026-09-16: with the daily reminder switched
 * OFF, `dumpsys alarm` still held an Imotara NOTIFICATION_EVENT for 48 hours
 * later — the "we miss you" nudge scheduled during an earlier chat.
 * cancelCheckInReminder() cancelled the daily notification and cleared the
 * enabled flag but never touched INACTIVITY_NOTIF_ID_KEY, so a person who
 * turned reminders off would still be pinged two days on.
 *
 * The fix is a SEPARATE cancelInactivityReminder(), wired only into the
 * toggle-OFF path. The third test below is the one that matters long-term.
 */
import fs from "fs";
import path from "path";

const mockCancel = jest.fn(async (_id: string) => undefined);
const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
        removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
    },
}));
jest.mock("expo-notifications", () => ({ cancelScheduledNotificationAsync: mockCancel }), { virtual: true });

import { cancelInactivityReminder } from "../notifications/checkInReminder";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const MOD = strip(fs.readFileSync(path.join(__dirname, "..", "notifications", "checkInReminder.ts"), "utf8"));
const SETTINGS = strip(fs.readFileSync(path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8"));

/**
 * Source of one exported function: from its `export` to the next top-level
 * `export`. The `(` matters — "scheduleCheckInReminder" is a PREFIX of
 * "scheduleCheckInReminderWithReason", and a plain indexOf would silently
 * hand back the wrong function's body.
 */
function fnBody(src: string, name: string): string {
    const i = src.indexOf(`export async function ${name}(`);
    expect(i).toBeGreaterThan(-1);
    const j = src.indexOf("\nexport ", i + 1);
    return src.slice(i, j === -1 ? undefined : j);
}

const INACTIVITY_KEY = "imotara.checkin.inactivity.id";

describe("switching the reminder off cancels the pending nudge", () => {
    it("the module has a dedicated cancelInactivityReminder", () => {
        const body = fnBody(MOD, "cancelInactivityReminder");
        expect(body).toMatch(/AsyncStorage\.getItem\(INACTIVITY_NOTIF_ID_KEY\)/);
        expect(body).toMatch(/cancelScheduledNotificationAsync\(id\)/);
        expect(body).toMatch(/AsyncStorage\.removeItem\(INACTIVITY_NOTIF_ID_KEY\)/);
    });

    it("Settings' toggle-OFF path calls it right after the daily cancel", () => {
        expect(SETTINGS).toMatch(/await cancelCheckInReminder\(\);\s*await cancelInactivityReminder\(\);/);
    });

    it("⚠️ the daily cancel does NOT drop the nudge — it runs before every re-arm", () => {
        // cancelCheckInReminder() is called inside the scheduling path, i.e.
        // before every re-schedule: a time change, a rename. Folding the
        // nudge-cancel in there would lose a pending nudge on each of those
        // until the person's next message. Keep the two separate.
        expect(fnBody(MOD, "scheduleCheckInReminderWithReason")).toMatch(/await cancelCheckInReminder\(\);/);
        expect(fnBody(MOD, "cancelCheckInReminder")).not.toMatch(/INACTIVITY/);
    });
});

describe("behaviour, against a mocked store", () => {
    beforeEach(() => {
        for (const k of Object.keys(mockStore)) delete mockStore[k];
        mockCancel.mockClear();
    });

    it("cancels the stored nudge and forgets its id", async () => {
        mockStore[INACTIVITY_KEY] = "nudge-42";
        await cancelInactivityReminder();
        expect(mockCancel).toHaveBeenCalledWith("nudge-42");
        expect(mockStore[INACTIVITY_KEY]).toBeUndefined();
    });

    it("is a no-op when nothing is scheduled", async () => {
        await cancelInactivityReminder();
        expect(mockCancel).not.toHaveBeenCalled();
    });

    it("still forgets the id when the OS cancel rejects", async () => {
        // A stale id the OS no longer knows must not leave us believing a
        // nudge is pending forever.
        mockStore[INACTIVITY_KEY] = "gone-already";
        mockCancel.mockRejectedValueOnce(new Error("no such notification"));
        await expect(cancelInactivityReminder()).resolves.toBeUndefined();
        expect(mockStore[INACTIVITY_KEY]).toBeUndefined();
    });
});
