/**
 * #125 SDK 58: <StatusBar style="auto"> no longer followed our in-app dark theme on iOS
 * (dark clock on dark background). The status bar must take its style from our theme.
 */
import fs from "fs";
import path from "path";

const app = fs.readFileSync(path.join(__dirname, "..", "..", "App.tsx"), "utf8");

describe("status bar follows the app's theme", () => {
    it("is not left on 'auto'", () => {
        expect(app).not.toMatch(/<StatusBar\s+style="auto"/);
    });
    it("derives light/dark from useTheme().isDark", () => {
        expect(app).toMatch(/style=\{isDark \? "light" : "dark"\}/);
        expect(app).toMatch(/<ThemedStatusBar \/>/);
    });
});
