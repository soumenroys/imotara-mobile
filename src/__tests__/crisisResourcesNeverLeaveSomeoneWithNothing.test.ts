/**
 * A person in crisis must never be shown an empty crisis card, and must never
 * be shown another country's helpline.
 *
 * 🔴 MOBILE IS THE WORSE HALF OF THIS DEFECT. The web resolves the country
 * from Vercel's `x-vercel-ip-country` header, which is almost always present.
 * Here there is only detectCountryCode() — an Intl locale heuristic — so a
 * country outside the 59 with their own numbers is routine, and
 * `getCrisisResourcesForCountry` used to answer that with `null`. The Tier-1
 * card then did `if (!primary) return null` and the Tier-2 card built an EMPTY
 * list of numbers under a heading promising help.
 *
 * ⛔ The other half: a missing code returned INDIAN numbers, to anyone,
 * anywhere. Tele-MANAS is a short code that dials from nowhere else.
 *
 * ⚠️ Mirrors src/__tests__/safety/crisisResourcesNeverLeaveSomeoneWithNothing
 * .test.ts in imotaraapp. The two data files must not drift — the lookup is
 * the same in both, and so is the fallback.
 */

import fs from "fs";
import path from "path";
import {
    getCrisisResourcesForCountry,
    INDIA_CRISIS_RESOURCES,
    INTERNATIONAL_CRISIS_RESOURCES,
} from "../lib/safety/crisisResources";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const UNCOVERED = [
    "NP", "BT", "MM", "KH", "LA", "MN", "AF", "UZ", "KZ", "GE", "AM", "AZ",
    "UA", "BG", "HR", "RS", "SK", "SI", "LT", "LV", "EE", "IS", "LU", "MT",
    "CY", "AL", "BA", "MK", "ME", "BY", "MD",
    "GH", "ET", "TZ", "UG", "ZM", "ZW", "SN", "CI", "CM", "RW", "BW", "NA",
    "MU", "MZ", "AO", "SD", "LY",
    "QA", "KW", "BH", "OM", "YE", "SY", "IR",
    "VN", "BN", "MV", "FJ", "PG",
    "EC", "BO", "PY", "UY", "VE", "CR", "PA", "GT", "DO", "CU", "JM", "TT",
    "HN", "NI", "SV", "BZ", "GY", "SR",
];

const NON_ANSWERS = [undefined, null, "", "   ", "ZZ", "XX", "QQ", "zz"];

describe("🔴 nobody in crisis is left with nothing", () => {
    it("always returns resources holding at least one contactable line", () => {
        for (const code of [...NON_ANSWERS, ...UNCOVERED]) {
            const r = getCrisisResourcesForCountry(code as string | null | undefined);
            expect(r).toBeTruthy();
            expect(r.primary.length).toBeGreaterThan(0);
            expect(r.primary[0].label.trim().length).toBeGreaterThan(0);
            expect(r.primary[0].contact.trim().length).toBeGreaterThan(0);
        }
    });
});

describe("⛔ nobody is shown another country's helpline", () => {
    it("an undetected country does NOT get Indian numbers", () => {
        for (const code of NON_ANSWERS) {
            const r = getCrisisResourcesForCountry(code as string | null | undefined);
            expect(r.countryCode).not.toBe("IN");
            expect(JSON.stringify(r)).not.toMatch(/14416|Tele-MANAS|KIRAN|NIMHANS/);
        }
    });

    it("an uncovered country gets the international directory", () => {
        for (const code of UNCOVERED) {
            expect(getCrisisResourcesForCountry(code)).toBe(INTERNATIONAL_CRISIS_RESOURCES);
        }
    });

    it("✅ a covered country still gets its OWN numbers — the control", () => {
        // Without this, a fallback that swallowed the whole map would pass
        // every assertion above.
        expect(getCrisisResourcesForCountry("IN")).toBe(INDIA_CRISIS_RESOURCES);
        const cases: ReadonlyArray<readonly [string, string]> = [
            ["US", "988"], ["GB", "116 123"], ["JP", "0120-783-556"], ["SG", "1767"],
            ["AU", "13 11 14"], ["BD", "01779-554391"],
        ];
        for (const [code, expected] of cases) {
            const r = getCrisisResourcesForCountry(code);
            expect(r.countryCode).toBe(code);
            expect(JSON.stringify(r.primary)).toContain(expected);
        }
    });
});

describe("⛔ the international fallback invents no phone number", () => {
    it("carries a URL and no dialable number", () => {
        const r = INTERNATIONAL_CRISIS_RESOURCES;
        expect(r.emergency).toBeUndefined();
        for (const line of r.primary) {
            expect(line.url).toBeTruthy();
            expect(line.contact).not.toMatch(/^\s*(\+?\d|1\d\d\b)/);
        }
    });
});

describe("🔑 both crisis cards can reach it", () => {
    const screen = read("screens/ChatScreen.tsx");

    it("⛔ the Tier-1 card no longer bails out when there are no local numbers", () => {
        // The exact line that showed a person in crisis a card with no helpline
        // on it. If it comes back, so does the defect.
        expect(screen).not.toMatch(/if \(!primary\) return null;/);
    });

    it("opens a directory line as a URL, and a real number as a tel:", () => {
        // A `tel:` built from "findahelpline.com" strips to nothing and dials
        // nothing — but the tel: path must stay for the 59 countries that do
        // have numbers, so both halves are pinned.
        const opens = screen.match(/Linking\.openURL\([^)]*\)/g) ?? [];
        const crisisOpens = opens.filter((o) => /tel:/.test(o));
        expect(crisisOpens.length).toBeGreaterThanOrEqual(2);
        // Jest's expect takes no message argument, so name the offenders.
        const missingUrlFallback = crisisOpens.filter((o) => !/url \?\?/.test(o));
        expect(missingUrlFallback).toEqual([]);
    });

    it("⚠️ the Tier-2 list can no longer come out empty", () => {
        // It builds `lines` from `primary`, which now always has an entry.
        expect(screen).toMatch(/resources\.primary\.slice\(0, 2\)/);
        expect(screen).not.toMatch(/resources\?\.primary\?\.slice/);
    });
});
