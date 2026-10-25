import fs from "fs";
import path from "path";

const plugin = require("../../plugins/withAndroidTextBounds");

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * Why this exists — do not "simplify" it away.
 *
 * Android 15+ (targetSdk ≥ 35) breaks lines by glyph BOUNDS; React Native
 * measures by ADVANCES. Indic glyphs overhang, so on 25 Oct 2026 "মন খারাপ
 * লাগছে" drew as "মন খারাপ" plus the sliver of a clipped second line, in a
 * TextView RN had sized for one line. Turning useBoundsForWidth off in the
 * theme put all three words back on one line in the same 166 px box.
 */

// What `expo prebuild` writes today (SDK 54).
const PREBUILD_STYLES = `<resources xmlns:tools="http://schemas.android.com/tools">
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="colorPrimary">@color/colorPrimary</item>
  </style>
  <style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowBackground">@drawable/ic_launcher_background</item>
  </style>
</resources>`;

describe("the Android text-bounds plugin", () => {
    it("is registered in app.json", () => {
        const app = JSON.parse(read("app.json"));
        expect(app.expo.plugins).toContain("./plugins/withAndroidTextBounds");
    });

    it("points AppTheme's textViewStyle at a style of its own", () => {
        const out = plugin.transformStyles(PREBUILD_STYLES);
        const appTheme = out.slice(out.indexOf('<style name="AppTheme"'), out.indexOf("</style>"));
        expect(appTheme).toContain('<item name="android:textViewStyle">@style/ImotaraTextView</item>');
        // ⛔ Not on the splash theme only — the app runs on AppTheme after launch.
        expect(out).toMatch(/<style name="ImotaraTextView" parent="@android:style\/Widget\.Material\.TextView"\/>/);
    });

    it("turns useBoundsForWidth OFF, and only where the attribute exists (v35)", () => {
        expect(plugin.V35_STYLES).toMatch(/<item name="android:useBoundsForWidth">false<\/item>/);
        // In plain values/ it would fail aapt on older compileSdks and mean nothing below 35.
        expect(plugin.transformStyles(PREBUILD_STYLES)).not.toContain("useBoundsForWidth");
    });

    it("is idempotent — an incremental prebuild does not stack items", () => {
        const once = plugin.transformStyles(PREBUILD_STYLES);
        expect(plugin.transformStyles(once)).toBe(once);
    });

    it("fails the build loudly if prebuild stops writing an AppTheme", () => {
        expect(() => plugin.transformStyles("<resources>\n</resources>")).toThrow(/AppTheme/);
    });
});
