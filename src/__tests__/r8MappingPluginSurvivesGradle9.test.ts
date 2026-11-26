// Dec release (26 Nov 2026): the 1.7.3 EAS Android build failed at :app:bundleRelease —
// "Could not find method exec()". Gradle 9 (Expo SDK 58) removed project.exec, and only the
// STORE bundle task runs this plugin's code, so local APK builds never showed it.
import * as fs from "fs";
import * as path from "path";

const plugin = fs.readFileSync(path.join(__dirname, "../../plugins/withAndroidR8Mapping.js"), "utf8");
const groovy = plugin.slice(plugin.indexOf("afterEvaluate"));

describe("R8 mapping plugin works on Gradle 9", () => {
  it("does not call project.exec / exec { } (removed in Gradle 9)", () => {
    const code = groovy.replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/project\.exec\b/);
    expect(code).not.toMatch(/\bexec\s*\{/);
  });

  it("runs the shell step through ProcessBuilder and fails the build on a non-zero exit", () => {
    expect(groovy).toContain("new ProcessBuilder('sh', '-c', embedCmd)");
    expect(groovy).toMatch(/if \(code != 0\) throw new GradleException/);
  });

  it("is still wired into app.json", () => {
    const app = fs.readFileSync(path.join(__dirname, "../../app.json"), "utf8");
    expect(app).toContain("./plugins/withAndroidR8Mapping");
  });
});
