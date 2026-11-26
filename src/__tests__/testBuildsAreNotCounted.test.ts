// #170 (25 Nov 2026): our own test runs must not land in the real anonymous counts.
import { readFileSync } from "fs";
import { join } from "path";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const eas = JSON.parse(readFileSync(join(__dirname, "../../eas.json"), "utf8"));

describe("which builds count as STORE builds", () => {
  it("only the store profiles carry the store marker", () => {
    expect(eas.build.production.env.EXPO_PUBLIC_IMOTARA_BUILD_CHANNEL).toBe("store");
    expect(eas.build.iosTestflight.env.EXPO_PUBLIC_IMOTARA_BUILD_CHANNEL).toBe("store");
    for (const [name, prof] of Object.entries<any>(eas.build)) {
      if (name === "production" || name === "iosTestflight") continue;
      expect(prof?.env?.EXPO_PUBLIC_IMOTARA_BUILD_CHANNEL).toBeUndefined();
    }
  });
  it("a dev build is never a store build, and the env var is read literally (inlined in release)", () => {
    const b = src("config/buildChannel.ts").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(b).toMatch(/!__DEV__ && process\.env\.EXPO_PUBLIC_IMOTARA_BUILD_CHANNEL === "store"/);
    expect(b).not.toMatch(/process\?\.env/);
  });
  it("in this test run (__DEV__) the app says 'test'", () => {
    const { BUILD_HEADER_VALUE, IS_STORE_BUILD } = require("../config/buildChannel");
    expect(IS_STORE_BUILD).toBe(false);
    expect(BUILD_HEADER_VALUE).toBe("test");
  });
  it("the anonymous counts carry the header", () => {
    expect(src("lib/analytics/visitTally.ts")).toMatch(/"x-imotara-build": BUILD_HEADER_VALUE/);
  });
});
