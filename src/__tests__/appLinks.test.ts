import fs from "fs";
import path from "path";

/**
 * App Links / Universal Links, step 1 of 2 (owner approved 25 Oct 2026). The
 * web half (assetlinks.json + apple-app-site-association) lives in imotaraapp
 * and is pinned there. ⛔ www.imotara.com only — the apex 308-redirects and
 * Android will not follow a redirect when verifying. ⛔ Two narrow paths only,
 * so ordinary imotara.com links still open the website.
 */
const app = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "app.json"), "utf8"));

describe("the app claims only its two verified links", () => {
    it("Android: one autoVerify filter, https on www.imotara.com, /open + /auth/app-callback", () => {
        const verified = app.expo.android.intentFilters.filter((f: { autoVerify?: boolean }) => f.autoVerify);
        expect(verified).toHaveLength(1);
        const data = verified[0].data as { scheme: string; host: string; pathPrefix: string }[];
        expect(data.every((d) => d.scheme === "https" && d.host === "www.imotara.com")).toBe(true);
        expect(data.map((d) => d.pathPrefix).sort()).toEqual(["/auth/app-callback", "/open"]);
    });

    it("iOS: associated domain on www.imotara.com", () => {
        expect(app.expo.ios.associatedDomains).toEqual(["applinks:www.imotara.com"]);
    });

    it("keeps the imotara:// scheme — sign-in still uses it until step 2", () => {
        expect(app.expo.scheme).toBe("imotara");
    });
});
