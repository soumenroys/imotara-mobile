import fs from "fs";
import path from "path";

jest.mock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock("expo-notifications", () => ({}), { virtual: true });

import {
    buildInactivityPayload,
    localisedWeekday,
    getNudgeStrings,
} from "../notifications/checkInReminder";

const THURSDAY = new Date("2026-10-15T10:00:00Z");

describe("⛔ the lock screen never carries the person's words", () => {
    it("the payload names the DAY, not the message", () => {
        const p = buildInactivityPayload(THURSDAY, "en", null);
        expect(p.body).toContain("Thursday");
    });

    it("the type makes it impossible to pass a message in", () => {
        // buildInactivityPayload used to take `lastContext?: string` — the
        // person's last message — and quote it. It now takes a Date, so the
        // compiler refuses text. This asserts the signature has not drifted
        // back, which a comment alone could not.
        const src = fs.readFileSync(
            path.join(__dirname, "../notifications/checkInReminder.ts"), "utf8");
        expect(src).toMatch(/buildInactivityPayload\(\s*\n?\s*lastActivityAt\?: Date/);
        expect(src).not.toMatch(/lastContext\?: string/);
    });

    it("⛔ ChatScreen no longer reads the message text for the nudge", () => {
        // The leak would come from the CALLER, not the builder.
        const chat = fs.readFileSync(path.join(__dirname, "../screens/ChatScreen.tsx"), "utf8");
        expect(chat).not.toMatch(/const lastContext = lastUserMsg/);
        expect(chat).toMatch(/scheduleInactivityReminder\(lastActivityTs, notifLang\)/);
    });

    it("speaks a native weekday in every supported language", () => {
        const langs = "en hi bn mr ta te gu kn ml pa or ar ur ru zh ja es fr de pt id he".split(" ");
        const english = localisedWeekday(THURSDAY, "en");
        const fellBack: string[] = [];
        for (const l of langs) {
            const w = localisedWeekday(THURSDAY, l);
            expect(w).toBeTruthy();
            if (l !== "en" && w === english) fellBack.push(l);
        }
        // An English weekday inside Bengali copy would be the drift this guards.
        expect(fellBack).toEqual([]);
    });

    it("falls back to generic rather than a half-built sentence", () => {
        const p = buildInactivityPayload(new Date(Number.NaN), "en", null);
        const generic = getNudgeStrings("en").gb;
        expect(generic).toContain(p.body);
    });

    it("every language still has both generic and day-based copy", () => {
        const langs = "en hi bn mr ta te gu kn ml pa or ar ur ru zh ja es fr de pt id he".split(" ");
        const missing: string[] = [];
        for (const l of langs) {
            const L = getNudgeStrings(l);
            if (!L.gb.length) missing.push(`${l}:generic`);
            if (!L.rb("X").length) missing.push(`${l}:day`);
            // ⛔ and the day copy must actually use the slot
            if (!L.rb("ZZQQ").some((v) => v.includes("ZZQQ"))) missing.push(`${l}:slot`);
        }
        expect(missing).toEqual([]);
    });
});
