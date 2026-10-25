import fs from "fs";
import path from "path";
import { DEFAULT_INACTIVITY_HOURS } from "../notifications/checkInReminder";

/**
 * The win-back nudge (owner approved 25 Oct 2026: one gentle notification after
 * three quiet days). It already existed as the "inactivity reminder" — these
 * pin the three things that were wrong with it.
 */
const src = fs.readFileSync(path.join(__dirname, "..", "notifications", "checkInReminder.ts"), "utf8");
const fn = src.slice(src.indexOf("export async function scheduleInactivityReminder"), src.indexOf("export async function setCompanionNameForReminders"));
// Comments explain WHY a call was removed and name it — assert on code only.
const code = fn.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the win-back nudge", () => {
    it("waits three quiet days by default", () => {
        expect(DEFAULT_INACTIVITY_HOURS).toBe(72);
    });

    it("⛔ never ASKS for permission — it runs as the app goes to the background", () => {
        expect(code).not.toMatch(/requestNotificationPermission\(\)/);
        expect(code).not.toMatch(/requestPermissionsAsync/);
        expect(fn).toMatch(/const \{ status \} = await Notifications\.getPermissionsAsync\(\);\s*if \(status !== "granted"\) return;/);
    });

    it("⛔ stays silent while reminders are paused", () => {
        expect(fn).toMatch(/if \(await isSnoozed\(\)\) return;/);
        // …and the pause check comes before anything is scheduled.
        expect(fn.indexOf("isSnoozed()")).toBeLessThan(fn.indexOf("scheduleNotificationAsync"));
    });

    it("⛔ 'auto' resolves to a real language, never English by default", () => {
        expect(fn).toMatch(/const nudgeLang = lang && lang !== "auto" \? lang : await resolveReminderLang\(\);/);
        expect(fn).toMatch(/buildInactivityPayload\(\s*new Date\(lastActivityTs\), nudgeLang,/);
    });

    it("still fires only once per quiet spell — one-off, and rescheduled (not stacked) on each use", () => {
        expect(fn).toMatch(/repeats: false/);
        expect(fn).toMatch(/cancelScheduledNotificationAsync\(prevId\)/);
    });
});
