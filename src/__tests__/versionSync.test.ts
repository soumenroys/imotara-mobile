// Guards the release "triple sync": package.json version, app.json
// expo.version, iOS buildNumber, Android versionCode. Drift here has shipped
// before (see commit 08d9433) — this test makes it a red build instead.

/* eslint-disable @typescript-eslint/no-var-requires */
const { checkVersionSync } = require("../../scripts/check-version-sync.js");
const pkg = require("../../package.json");
const appJson = require("../../app.json");

describe("release version sync", () => {
    test("package.json, app.json version, buildNumber and versionCode are in sync", () => {
        expect(checkVersionSync(pkg, appJson)).toEqual([]);
    });
});

describe("checkVersionSync detects drift", () => {
    const good = {
        pkg: { version: "1.2.7" },
        app: {
            expo: {
                version: "1.2.7",
                ios: { buildNumber: "107" },
                android: { versionCode: 107 },
            },
        },
    };

    test("accepts a fully synced set", () => {
        expect(checkVersionSync(good.pkg, good.app)).toEqual([]);
    });

    test("flags version string mismatch", () => {
        const problems = checkVersionSync({ version: "1.2.8" }, good.app);
        expect(problems.some((p: string) => p.includes("version mismatch"))).toBe(true);
    });

    test("flags iOS/Android build mismatch", () => {
        const app = JSON.parse(JSON.stringify(good.app));
        app.expo.android.versionCode = 106;
        const problems = checkVersionSync(good.pkg, app);
        expect(problems.some((p: string) => p.includes("build mismatch"))).toBe(true);
    });

    test("flags non-numeric buildNumber", () => {
        const app = JSON.parse(JSON.stringify(good.app));
        app.expo.ios.buildNumber = "1.2.7";
        const problems = checkVersionSync(good.pkg, app);
        expect(problems.some((p: string) => p.includes("buildNumber"))).toBe(true);
    });

    test("flags missing fields", () => {
        expect(checkVersionSync({}, {}).length).toBeGreaterThan(0);
    });
});
