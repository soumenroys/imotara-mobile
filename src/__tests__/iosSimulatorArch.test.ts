import fs from "fs";
import path from "path";

const withIosSimulatorArch = require("../../plugins/withIosSimulatorArch");

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * Why this plugin exists, so the next person does not delete it:
 *
 * razorpay-core-pod 1.0.2 ships
 *   "user_target_xcconfig": { "EXCLUDED_ARCHS[sdk=iphonesimulator*]": "arm64" }
 * and user_target_xcconfig propagates to the APP target. On Apple Silicon that
 * leaves no buildable simulator architecture, and the symptom is NOT an
 * architecture error — Xcode simply lists no concrete simulator destinations,
 * so every build fails with "Unable to find a destination matching the
 * provided destination specifier", which reads like a missing runtime.
 *
 * The exclusion is an Intel-era leftover; the vendored xcframework now ships
 * an ios-arm64_x86_64-simulator slice.
 */

const PODFILE_FIXTURE = `require File.join(File.dirname(\`node --print "require.resolve('expo/package.json')"\`), "scripts/autolinking")

target 'Imotara' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

/** The plugin exports its transform so it can be tested directly. */
function applyToPodfile(contents: string): string {
    return withIosSimulatorArch.transformPodfile(contents);
}

describe("iOS simulator arch plugin", () => {
    it("is registered in app.json", () => {
        const app = JSON.parse(read("app.json"));
        expect(app.expo.plugins).toContain("./plugins/withIosSimulatorArch");
    });

    it("injects a post_install hook that clears the simulator exclusion", () => {
        const out = applyToPodfile(PODFILE_FIXTURE);
        expect(out).toContain("IMOTARA_SIM_ARCH_V1");
        expect(out).toContain("EXCLUDED_ARCHS[sdk=iphonesimulator*]");
        expect(out).toContain("Target Support Files");
    });

    it("runs AFTER react_native_post_install, or the files would not exist yet", () => {
        const out = applyToPodfile(PODFILE_FIXTURE);
        expect(out.indexOf("react_native_post_install")).toBeLessThan(
            out.indexOf("IMOTARA_SIM_ARCH_V1")
        );
    });

    it("rewrites the generated xcconfigs, not build_settings", () => {
        // The value arrives through the xcconfig files CocoaPods generates.
        // Deleting the key from build_configurations.build_settings does not
        // touch those files, so the setting would survive.
        const out = applyToPodfile(PODFILE_FIXTURE);
        expect(out).toContain(".xcconfig");
        expect(out).toContain("File.write");
    });

    it("is scoped to the simulator, so device and store builds cannot change", () => {
        const src = read("plugins/withIosSimulatorArch.js");
        expect(src).toContain("sdk=iphonesimulator");
        // never touches an unscoped EXCLUDED_ARCHS or iphoneos
        expect(src).not.toMatch(/EXCLUDED_ARCHS\[sdk=iphoneos/);
    });

    it("is idempotent — prebuild runs more than once", () => {
        const once = applyToPodfile(PODFILE_FIXTURE);
        const twice = applyToPodfile(once);
        expect(twice).toBe(once);
        expect(twice.split("IMOTARA_SIM_ARCH_V1").length - 1).toBe(1);
    });

    it("THROWS if the Expo template moves the anchor, rather than silently not applying", () => {
        const broken = PODFILE_FIXTURE.replace(
            ":ccache_enabled => ccache_enabled?(podfile_properties),",
            ":ccache_enabled => false,"
        );
        expect(() => applyToPodfile(broken)).toThrow(/react_native_post_install/);
    });
});
