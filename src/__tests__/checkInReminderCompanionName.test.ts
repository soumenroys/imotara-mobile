/**
 * Check-in notifications speak as the companion — stage 2 of the
 * companion-name work, 2026-09-16.
 *
 * The daily reminder is scheduled with a REPEATING trigger and its title is
 * baked in at schedule time. So "rename the companion" is not enough on its
 * own: an already-scheduled notification keeps greeting the person by the old
 * name every morning until something reschedules it. This file pins both
 * halves — the text follows the name, AND a rename re-issues the reminder.
 */
import fs from "fs";
import path from "path";

jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock("expo-notifications", () => ({}), { virtual: true });

import { withCompanionName, buildInactivityPayload, getNudgeStrings } from "../notifications/checkInReminder";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const MOD = strip(fs.readFileSync(path.join(__dirname, "..", "notifications", "checkInReminder.ts"), "utf8"));
const SETTINGS = strip(fs.readFileSync(path.join(__dirname, "..", "screens", "SettingsScreen.tsx"), "utf8"));

// Every language the nudge table knows. Derived, not hand-typed, so a new
// language is covered the day it is added.
const LANGS = Array.from(MOD.matchAll(/^\s{4}([a-z]{2}(?:-[A-Za-z]+)?):\s*\{\s*$/gm)).map((m) => m[1]);

describe("the text follows the chosen name", () => {
    it("substitutes the name onto finished text — the pattern the reply engine already uses", () => {
        expect(withCompanionName("Imotara is here for you 💙", "Maya")).toBe("Maya is here for you 💙");
    });

    it("the default name leaves the text untouched — no rename, no change", () => {
        expect(withCompanionName("Imotara is here for you 💙", "Imotara")).toBe("Imotara is here for you 💙");
        expect(withCompanionName("Imotara is here for you 💙", null)).toBe("Imotara is here for you 💙");
        expect(withCompanionName("Imotara is here for you 💙", "   ")).toBe("Imotara is here for you 💙");
    });

    it("finds a substitution point in EVERY language's titles", () => {
        // If a language's title never mentioned the name, a rename would
        // silently do nothing there. All of them do.
        expect(LANGS.length).toBeGreaterThanOrEqual(15);
        for (const lang of LANGS) {
            const L = getNudgeStrings(lang);
            expect(withCompanionName(L.gt, "Maya")).not.toBe(L.gt);
            expect(withCompanionName(L.pt, "Maya")).not.toBe(L.pt);
        }
    });

    it("the inactivity payload applies the name to title AND body, personalised or not", () => {
        for (let i = 0; i < 30; i++) { // bodies are picked at random
            const generic = buildInactivityPayload(undefined, "en", "Maya");
            const personal = buildInactivityPayload("my exam tomorrow", "en", "Maya");
            for (const p of [generic, personal]) {
                expect(p.title).not.toMatch(/Imotara/);
                expect(p.body).not.toMatch(/Imotara/);
            }
        }
    });

    it("the daily reminder title is built through the same helper", () => {
        expect(MOD).toMatch(/title: withCompanionName\("Imotara is here for you 💙", companionName\)/);
        expect(MOD).toMatch(/const companionName = await getSavedCompanionName\(\);/);
    });
});

describe("⚠️ a rename RE-ISSUES the scheduled reminder", () => {
    it("Settings calls the reminder module when the name field is left", () => {
        expect(SETTINGS).toMatch(/void setCompanionNameForReminders\(companionNameDraft\);/);
    });

    it("the module saves the name, then reschedules only if the reminder is on", () => {
        const i = MOD.indexOf("export async function setCompanionNameForReminders");
        const body = MOD.slice(i, MOD.indexOf("export async function cancelCheckInReminder", i));
        expect(body).toMatch(/AsyncStorage\.setItem\(COMPANION_NAME_KEY, n\)/);
        // Off means off — a rename must never switch reminders back on.
        expect(body).toMatch(/if \(!\(await isCheckInReminderEnabled\(\)\)\) return;/);
        // Reschedule with the SAVED time and prefs, so nothing else changes.
        expect(body).toMatch(/const \{ hour, minute \} = await getSavedReminderTime\(\);/);
        expect(body).toMatch(/scheduleCheckInReminder\(hour, minute, sound, badge\)/);
    });

    it("clearing the name removes the key rather than storing an empty string", () => {
        const i = MOD.indexOf("export async function setCompanionNameForReminders");
        expect(MOD.slice(i, i + 900)).toMatch(/else await AsyncStorage\.removeItem\(COMPANION_NAME_KEY\);/);
    });
});
