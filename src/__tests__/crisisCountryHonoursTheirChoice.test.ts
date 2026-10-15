/**
 * Which country's crisis numbers a person is shown, and in what order of
 * trust.
 *
 * 🔴 TWO DEFECTS, found 2026-10-16:
 *
 *   ① **THE SETTINGS CHOICE DID NOTHING.** `imotara.crisis.country.v1` was
 *      written by SettingsScreen and read by NOBODY — the key appeared in
 *      exactly three places, all inside SettingsScreen: the constant, the
 *      load, and the save. ChatScreen called detectCountryCode() directly. So
 *      somebody who went looking for this control, set it, and trusted it was
 *      shown the auto-detected numbers anyway. The WEB honoured the same key;
 *      only mobile ignored it. A safety control that silently does nothing is
 *      worse than one that is missing, because the person stops looking.
 *
 *   ② **THE AUTO-DETECTION IS NOT A LOCATION.** detectCountryCode() reads the
 *      Intl LOCALE. A Bengali- or Hindi-locale phone in London reports IN, so
 *      a diaspora user in crisis is shown Tele-MANAS 14416 — a short code that
 *      does not dial from the UK. The people most likely to keep a
 *      home-country locale are exactly the people furthest from that
 *      country's helplines.
 *
 * ⛔ THE LOCALE FALLBACK IS KEPT ON PURPOSE. It is the only source that works
 * offline and before the first reply, and on a crisis card a worse answer
 * beats no answer.
 */

import fs from "fs";
import path from "path";

import {
    resolveCrisisCountry,
    crisisCountrySource,
    setCrisisCountryOverride,
    rememberServerCountry,
    __resetCrisisCountryCacheForTests,
} from "../lib/safety/resolveCrisisCountry";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

beforeEach(() => __resetCrisisCountryCacheForTests());

describe("🔑 the order of trust", () => {
    it("the person's own choice beats everything", async () => {
        await rememberServerCountry("GB");
        await setCrisisCountryOverride("AU");
        expect(resolveCrisisCountry()).toBe("AU");
        expect(crisisCountrySource()).toBe("override");
    });

    it("🔴 the server's country beats the locale guess", async () => {
        // The whole point: the network knows where the request came from; the
        // locale only knows which language the phone is set to.
        await rememberServerCountry("GB");
        expect(resolveCrisisCountry()).toBe("GB");
        expect(crisisCountrySource()).toBe("server");
    });

    it("⛔ and the locale guess is still there when nothing else is", () => {
        // Offline, and before the first reply. Never remove it.
        expect(crisisCountrySource()).toBe("locale");
        expect(() => resolveCrisisCountry()).not.toThrow();
    });

    it('"auto" is a sentinel for no choice, not a country', async () => {
        await rememberServerCountry("GB");
        await setCrisisCountryOverride("auto");
        expect(resolveCrisisCountry()).toBe("GB");
        expect(crisisCountrySource()).toBe("server");
    });

    it("⚠️ junk never becomes a country", async () => {
        // getCrisisResourcesForCountry maps an unknown code to the
        // international directory, but a malformed one must not get that far
        // and must never displace a good value.
        await rememberServerCountry("GB");
        for (const junk of ["", "   ", "XYZ", "1", null, undefined, "g"]) {
            await rememberServerCountry(junk);
            expect(resolveCrisisCountry()).toBe("GB");
        }
    });
});

describe("🔴 the Settings choice is actually wired up", () => {
    it("⛔ ChatScreen no longer resolves the country from the locale alone", () => {
        // The exact defect. If detectCountryCode() reappears in the crisis
        // cards, both the Settings choice and the real country are lost again.
        const screen = read("screens/ChatScreen.tsx");
        const cards = screen.slice(screen.indexOf("getCrisisResourcesForCountry"));
        expect(cards).not.toMatch(/getCrisisResourcesForCountry\(detectCountryCode\(\)\)/);
        expect(screen).toMatch(/getCrisisResourcesForCountry\(resolveCrisisCountry\(\)\)/);
    });

    it("🔑 Settings writes through the resolver, not straight to storage", () => {
        // Writing to AsyncStorage directly is what made the setting inert: the
        // in-memory cache the card reads never learned about it.
        const settings = read("screens/SettingsScreen.tsx");
        expect(settings).toMatch(/setCrisisCountryOverride\(code\)/);
        // ⚠️ Jest's expect takes no message argument, unlike vitest's.
        expect(settings).not.toMatch(/AsyncStorage\.setItem\(CRISIS_COUNTRY_KEY/);
    });

    it("⚠️ the cached sources are hydrated before a card can render", () => {
        expect(read("screens/ChatScreen.tsx")).toMatch(/void hydrateCrisisCountry\(\)/);
    });

    it("🔑 and every cloud reply feeds the server country back", () => {
        // ⛔ Fire-and-forget: a crisis card must never wait on this.
        const client = read("api/aiClient.ts");
        expect(client).toMatch(/void rememberServerCountry\(/);
        expect(client).toMatch(/resolvedCountry/);
    });

    it("⛔ the key matches the one Settings and the web both use", () => {
        // Three copies of this string exist — here, SettingsScreen, and the web
        // chat page. A drift would silently split the setting in two.
        const settings = read("screens/SettingsScreen.tsx");
        expect(settings).toContain('"imotara.crisis.country.v1"');
        expect(read("lib/safety/resolveCrisisCountry.ts")).toContain('"imotara.crisis.country.v1"');
    });
});
