/**
 * ⚡ Dec release check (25 Nov 2026): SDK 58's splash module fades out over 400 ms on
 * Android, which made the app look ~0.25 s slower than 1.7.2. We set a short fade
 * before the app registers.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { SPLASH_FADE_MS } from "../config/splash";

const index = readFileSync(join(__dirname, "..", "..", "index.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("the splash fades out quickly", () => {
  it("the fade is short (≤ 150 ms), like 1.7.2's system crossfade", () => {
    expect(SPLASH_FADE_MS).toBeGreaterThan(0);
    expect(SPLASH_FADE_MS).toBeLessThanOrEqual(150);
  });
  it("index.ts sets it BEFORE the app registers", () => {
    const set = index.indexOf("SplashScreen.setOptions({ duration: SPLASH_FADE_MS })");
    const reg = index.indexOf("registerRootComponent(App)");
    expect(set).toBeGreaterThan(-1);
    expect(reg).toBeGreaterThan(set);
  });
  it("⛔ it does not turn on the iOS fade (iOS stays as it was)", () => {
    expect(index).not.toMatch(/fade:\s*true/);
  });
});
