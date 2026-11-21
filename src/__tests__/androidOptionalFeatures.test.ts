import fs from "fs";
import path from "path";

const plugin = require("../../plugins/withAndroidOptionalFeatures");

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * Why this exists — 21 Nov 2026, Play refused to send 1.7.1 for review:
 * "Required hardware feature declarations are restricting your app's
 * availability" (android.hardware.wifi, android.hardware.screen.portrait),
 * and "Proceed anyway" errored. Both were IMPLIED by library manifests
 * (ACCESS_WIFI_STATE; ML Kit's portrait-locked delegate activity).
 * Declaring them required="false" is Android's documented override.
 */

const manifest = () => ({
    manifest: {
        $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
        "uses-permission": [{ $: { "android:name": "android.permission.RECORD_AUDIO" } }],
    },
});

const features = (m: any) =>
    (m.manifest["uses-feature"] || []).map((f: any) => `${f.$["android:name"]}=${f.$["android:required"]}`);

describe("the Android optional-features plugin", () => {
    it("is registered in app.json", () => {
        const app = JSON.parse(read("app.json"));
        expect(app.expo.plugins).toContain("./plugins/withAndroidOptionalFeatures");
    });

    it("marks wifi and portrait screen as NOT required", () => {
        const out = plugin.addOptionalFeatures(manifest());
        expect(features(out)).toEqual(
            expect.arrayContaining(["android.hardware.wifi=false", "android.hardware.screen.portrait=false"]),
        );
    });

    it("leaves permissions alone (the app still works the same)", () => {
        const out = plugin.addOptionalFeatures(manifest());
        expect(out.manifest["uses-permission"]).toEqual([{ $: { "android:name": "android.permission.RECORD_AUDIO" } }]);
    });

    it("flips an existing required=true instead of adding a duplicate", () => {
        const m: any = manifest();
        m.manifest["uses-feature"] = [{ $: { "android:name": "android.hardware.wifi", "android:required": "true" } }];
        const out = plugin.addOptionalFeatures(m);
        const wifi = out.manifest["uses-feature"].filter((f: any) => f.$["android:name"] === "android.hardware.wifi");
        expect(wifi).toHaveLength(1);
        expect(wifi[0].$["android:required"]).toBe("false");
    });

    it("is idempotent — a second prebuild does not stack entries", () => {
        const once = plugin.addOptionalFeatures(manifest());
        const twice = plugin.addOptionalFeatures(JSON.parse(JSON.stringify(once)));
        expect(twice).toEqual(once);
    });

    it("fails the build loudly if the manifest shape changes", () => {
        expect(() => plugin.addOptionalFeatures({})).toThrow(/manifest/);
    });
});
