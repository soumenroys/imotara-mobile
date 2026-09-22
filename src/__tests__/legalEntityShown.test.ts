/**
 * The app must NAME the operating entity, on screen, to the user.
 *
 * 🔴 WHY THIS EXISTS. BillDesk rejected Google Play PA-CB application
 * 2609171402 on 2026-09-21 with, among five clarifications: "Mobile
 * Application(s) has a missing/incomplete legal name of the applicant company."
 *
 * They were right — `M/S IMOTARA` appeared NOWHERE in this app. The Play store
 * listing was corrected too, but a reviewer may open the app rather than the
 * listing, and a store listing is not part of the build.
 *
 * ⚠️ AGREED_* is duplicated in imotaraapp's copy of this test ON PURPOSE. Two
 * repos cannot import each other, so this pair of literals is the only thing
 * that catches a change applied to one side. Same pattern as
 * `licensingTermsMatchWeb.test.ts` and `pricingCatalog.test.ts`.
 */
import fs from "fs";
import path from "path";
import { BUSINESS, formattedAddress } from "../config/businessIdentity";

/** Keep byte-identical with the web copy. This is what KYC filings carry. */
const AGREED_LEGAL_NAME = "M/S IMOTARA";
const AGREED_EMAIL      = "info@imotara.com";
const AGREED_POSTCODE   = "700008";

const SETTINGS = path.join(__dirname, "..", "screens", "SettingsScreen.tsx");
const read = (p: string) => fs.readFileSync(p, "utf8");

describe("the legal entity constant matches the web repo", () => {
    it("legal name has not drifted", () => {
        // No full stop: the deed writes "M/S. IMOTARA" but PAN and bank agree
        // on no full stop, and those are what penny-drop matches.
        expect(BUSINESS.legalName).toBe(AGREED_LEGAL_NAME);
        expect(BUSINESS.legalName).not.toContain(".");
    });

    it("contact email has not drifted", () => {
        expect(BUSINESS.email).toBe(AGREED_EMAIL);
    });

    it("the registered address is the one on every filing", () => {
        expect(BUSINESS.address.postalCode).toBe(AGREED_POSTCODE);
        expect(formattedAddress()).toContain("Kalipada Mukherjee Road");
        expect(formattedAddress()).toContain("Kolkata");
        expect(formattedAddress()).toContain("India");
    });
});

describe("the app actually shows it", () => {
    const src = read(SETTINGS);

    it("the fixture is real", () => {
        expect(src.length).toBeGreaterThan(1000);
    });

    it("Settings renders the legal name", () => {
        // Via the constant, not a hardcoded string — so it cannot drift from
        // the value the KYC filings carry.
        expect(src).toMatch(/BUSINESS\.legalName/);
    });

    it("Settings renders the registered address and contact email", () => {
        expect(src).toMatch(/formattedAddress\(\)/);
        expect(src).toMatch(/BUSINESS\.email/);
    });

    it("it is labelled so a reviewer knows what they are looking at", () => {
        expect(src).toMatch(/"Operated by"/);
    });
});
