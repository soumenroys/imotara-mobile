/**
 * A link a user SHARES must point at imotara.com.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-10-16 the family mood-snapshot link was
 * hardcoded in SettingsScreen as:
 *
 *     `https://imotaraapp.vercel.app/family/view?snap=${encoded}`
 *
 * So every snapshot someone shared with their mother, their partner or their
 * doctor sent that person to the raw Vercel deployment URL. eas.json sets
 * EXPO_PUBLIC_IMOTARA_API_BASE_URL to https://www.imotara.com for all four
 * build profiles — this one line simply bypassed it.
 *
 * ⚠️ NOTHING WAS BROKEN, which is exactly why it survived: both hosts return
 * 200. But a shared link is the one surface word of mouth actually travels on,
 * and ours pointed at a domain that will never rank and does not read like a
 * company.
 *
 * ⛔ THE DISTINCTION THIS GUARDS. There are two different URLs and they are not
 * interchangeable:
 *   - IMOTARA_API_BASE_URL (src/config/api.ts) — where the app CALLS. Resolves
 *     to localhost in dev and to a Metro host on a device. Correct for fetches.
 *   - BUSINESS.siteUrl — where a HUMAN is sent. Always the public domain.
 * Using the first for the second is how you ship a share link to localhost.
 */

import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Strip comments so the explanatory notes above don't satisfy the assertions. */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

describe("shared links use the branded domain", () => {
    it("the family snapshot link is built from BUSINESS.siteUrl", () => {
        const code = stripComments(read("src/screens/SettingsScreen.tsx"));
        expect(code).toMatch(/\$\{BUSINESS\.siteUrl\}\/family\/view/);
    });

    it("no user-facing screen hardcodes the vercel.app deployment host", () => {
        // ⚠️ Screens only. src/config/api.ts and mobileTTS.ts may legitimately
        // fall back to the deployment host for API CALLS when no env var is set
        // — nobody sees those URLs.
        const dir = path.join(ROOT, "src", "screens");
        const walk = (d: string): string[] =>
            fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
                const p = path.join(d, e.name);
                return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) ? [p] : [];
            });

        const offenders = walk(dir).filter((f) => {
            const code = stripComments(fs.readFileSync(f, "utf8"));
            // A bare literal is the problem. An env-var fallback is not a link
            // anyone is shown.
            return /["'`]https:\/\/imotaraapp\.vercel\.app/.test(code);
        });

        // If this fails: a screen hardcodes the Vercel deployment host. When a
        // user can see or share the URL, use BUSINESS.siteUrl. When it is an API
        // call nobody sees, use IMOTARA_API_BASE_URL from src/config/api.ts.
        expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
    });

    it("siteUrl is the public domain, not a deployment or a local host", () => {
        const cfg = read("src/config/businessIdentity.ts");
        expect(cfg).toMatch(/siteUrl:\s*"https:\/\/www\.imotara\.com"/);
        expect(cfg).not.toMatch(/siteUrl:[^\n]*vercel\.app/);
        expect(cfg).not.toMatch(/siteUrl:[^\n]*localhost/);
    });
});

describe("the app links to the social channels", () => {
    /**
     * 🔴 Until 2026-10-16 the mobile app linked to NO social channel at all.
     * Almost every Imotara user is on mobile, so the people most likely to
     * follow were the only ones never asked.
     */
    it("settings exposes all four channels from BUSINESS.social", () => {
        const code = stripComments(read("src/screens/SettingsScreen.tsx"));
        for (const key of ["instagram", "youtube", "x", "linkedin", "facebook"]) {
            expect(code).toContain(`BUSINESS.social.${key}`);
        }
    });

    it("the social URLs match the owner's table", () => {
        // ⛔ The owner's social table is the source of truth. Facebook and
        // WaBhai are deliberately absent — the table holds a bare facebook.com
        // root and a login page, neither of which is a profile.
        const cfg = read("src/config/businessIdentity.ts");
        expect(cfg).toContain('x:         "https://x.com/imotaraofficial"');
        expect(cfg).toContain('instagram: "https://www.instagram.com/imotaraofficial/"');
        expect(cfg).toContain('youtube:   "https://www.youtube.com/@Imotara"');
        expect(cfg).toContain('linkedin:  "https://www.linkedin.com/in/imotara"');
        expect(cfg).toContain('facebook:  "https://www.facebook.com/imotaraofficial"');
    });
});
