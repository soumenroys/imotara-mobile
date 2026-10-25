import fs from "fs";
import path from "path";

/**
 * Owner, 26 Oct 2026: version x.y.z ⇒ build number xyz, the same on web, iOS and
 * Android; z is never more than 9 (1.6.9 → 1.7.0, never 1.6.10).
 */
const root = path.join(__dirname, "..", "..");
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

describe("one version, one build number, everywhere", () => {
    const v: string = app.version;
    const digits = v.split(".").join("");

    it("version is x.y.z with every part a single digit", () => {
        expect(v).toMatch(/^\d\.\d\.\d$/);
    });

    it("iOS buildNumber and Android versionCode are the version's digits", () => {
        expect(app.ios.buildNumber).toBe(digits);
        expect(String(app.android.versionCode)).toBe(digits);
    });

    it("package.json carries the same version", () => {
        expect(pkg.version).toBe(v);
    });

    const WEB = path.resolve(root, "../imotaraapp/package.json");
    (fs.existsSync(WEB) ? it : it.skip)("the web says the same version and build", () => {
        const web = JSON.parse(fs.readFileSync(WEB, "utf8"));
        expect(web.version).toBe(v);
        expect(web.buildNumber).toBe(digits);
    });
});
