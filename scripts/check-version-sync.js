#!/usr/bin/env node
// Verifies the version "triple sync" this repo requires for every release
// (see RELEASE_GO_NO_GO.md):
//   package.json  version
//   app.json      expo.version
//   app.json      expo.ios.buildNumber  (string)
//   app.json      expo.android.versionCode (number)
// buildNumber and versionCode must be the same build integer, and both
// version strings must match. Run via `npm run check:version` (also wired
// into CI and covered by src/__tests__/versionSync.test.ts).

const path = require("path");

/**
 * Pure checker so tests can exercise it without touching the filesystem.
 * @param {{version?: string}} pkg parsed package.json
 * @param {{expo?: object}} appJson parsed app.json
 * @returns {string[]} list of problems (empty = in sync)
 */
function checkVersionSync(pkg, appJson) {
    const problems = [];
    const expo = appJson && appJson.expo ? appJson.expo : {};

    const pkgVersion = pkg && pkg.version;
    const appVersion = expo.version;
    const buildNumber = expo.ios && expo.ios.buildNumber;
    const versionCode = expo.android && expo.android.versionCode;

    if (!pkgVersion) problems.push("package.json is missing \"version\"");
    if (!appVersion) problems.push("app.json is missing expo.version");
    if (pkgVersion && appVersion && pkgVersion !== appVersion) {
        problems.push(
            `version mismatch: package.json has ${pkgVersion} but app.json expo.version has ${appVersion}`
        );
    }

    if (typeof buildNumber !== "string" || !/^\d+$/.test(buildNumber)) {
        problems.push(
            `expo.ios.buildNumber must be a numeric string, got: ${JSON.stringify(buildNumber)}`
        );
    }
    if (typeof versionCode !== "number" || !Number.isInteger(versionCode)) {
        problems.push(
            `expo.android.versionCode must be an integer, got: ${JSON.stringify(versionCode)}`
        );
    }
    if (
        typeof buildNumber === "string" &&
        /^\d+$/.test(buildNumber) &&
        Number.isInteger(versionCode) &&
        Number(buildNumber) !== versionCode
    ) {
        problems.push(
            `build mismatch: iOS buildNumber ${buildNumber} != Android versionCode ${versionCode}`
        );
    }

    return problems;
}

function main() {
    const root = path.join(__dirname, "..");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(path.join(root, "package.json"));
    const appJson = require(path.join(root, "app.json"));

    const problems = checkVersionSync(pkg, appJson);
    if (problems.length > 0) {
        console.error("✗ Version sync check FAILED:");
        for (const p of problems) console.error("  - " + p);
        process.exit(1);
    }
    console.log(
        `✓ Version sync OK: v${pkg.version} (iOS build ${appJson.expo.ios.buildNumber}, Android versionCode ${appJson.expo.android.versionCode})`
    );
}

if (require.main === module) main();

module.exports = { checkVersionSync };
