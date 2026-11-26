// #107 (26 Nov 2026): Play kept saying "Resource shrinking isn't enabled" on every release.
// app.json asked for it as `enableShrinkResources`, an option name expo-build-properties
// no longer reads — so the setting was silently ignored. The real name is
// `enableShrinkResourcesInReleaseBuilds` (it needs minify on, which we have).
// Checked on a release APK: 44.1 MB vs 56.8 MB, notification icon kept, reminder alarm
// scheduled, read-aloud plays.
import * as fs from "fs";
import * as path from "path";

const app = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app.json"), "utf8")).expo;
const props = (app.plugins as unknown[]).find(
  (p) => Array.isArray(p) && p[0] === "expo-build-properties",
) as [string, { android: Record<string, unknown> }];

describe("Android release builds really shrink resources", () => {
  it("uses the option name expo-build-properties actually reads", () => {
    expect(props[1].android.enableShrinkResourcesInReleaseBuilds).toBe(true);
    expect(props[1].android).not.toHaveProperty("enableShrinkResources");
  });

  it("keeps minify on, which resource shrinking requires", () => {
    expect(props[1].android.enableMinifyInReleaseBuilds).toBe(true);
  });

  it("the plugin still reads that exact name", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../node_modules/expo-build-properties/build/android.js"),
      "utf8",
    );
    expect(src).toContain("config.android?.enableShrinkResourcesInReleaseBuilds");
  });
});
