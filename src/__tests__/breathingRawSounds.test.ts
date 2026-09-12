import fs from "fs";
import path from "path";

const withAndroidRawSounds = require("../../plugins/withAndroidRawSounds");

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * Strip comments before asserting about code.
 *
 * Without this, `not.toMatch(/require\(.*\.mp3/)` matched the sentence
 * "a `require()`d .mp3 could not be resolved" in the file's own explanation —
 * the test failed on prose describing the bug, not on the bug.
 */
const code = (p: string) =>
    read(p)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * Why any of this exists — do not "simplify" it away.
 *
 * On a release build a require()d .mp3 could not be resolved to a URI on a
 * real Galaxy A27, while the identical APK was fine on an emulator:
 *
 *   Image.resolveAssetSource() -> { "__packager_asset": true, "uri": "", "scale": 1 }
 *   Asset.fromModule()         -> uri: "", name: "bowl", type: "mp3", hash: "f6d326bd…"
 *
 * Correct metadata, files present in the APK, empty URI. expo-av then rejected
 * with "Unable to download asset from url:" and the breathing exercise played
 * in silence on hardware. Android now plays from an android.resource:// URI
 * pointing at res/raw, which needs no packager metadata at all.
 */

describe("the Android raw-resource plugin", () => {
    it("is registered in app.json", () => {
        const app = JSON.parse(read("app.json"));
        expect(app.expo.plugins).toContain("./plugins/withAndroidRawSounds");
    });

    it("covers exactly the three ambiences", () => {
        expect([...withAndroidRawSounds.SOUNDS].sort()).toEqual(["bowl", "ocean", "rain"]);
    });

    it("every name is a legal Android resource id", () => {
        // res/raw ids must be lowercase a-z0-9_ starting with a letter, and
        // carry no extension. An illegal one fails the Android build with a
        // confusing aapt error far from the cause.
        for (const name of withAndroidRawSounds.SOUNDS) {
            expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
        }
    });

    it("the source files it copies actually exist", () => {
        for (const name of withAndroidRawSounds.SOUNDS) {
            expect(fs.existsSync(path.join(ROOT, "assets", "sounds", `${name}.mp3`))).toBe(true);
        }
    });
});

describe("Android must not bundle the mp3s twice", () => {
    const androidSrc = code("src/components/imotara/musicSources.android.ts");
    const sharedSrc = code("src/components/imotara/musicSources.ts");

    it("the android variant contains NO require() of the audio", () => {
        // The whole point of the platform split. Letting the packager bundle
        // them for Android as well, on top of res/raw, cost 11.8 MB —
        // measured: APK 114.9 -> 126.7 MB.
        expect(androidSrc).not.toMatch(/require\(.*\.mp3/);
        expect(androidSrc).not.toMatch(/assets\/sounds/);
    });

    it("the android variant does not import the shared module at all", () => {
        // Even a type-only import can make the bundler pull that module in,
        // and its require() calls are exactly what must not reach Android.
        expect(androidSrc).not.toMatch(/from\s+["']\.\/musicSources["']/);
    });

    it("the shared (iOS) variant DOES require the modules", () => {
        expect(sharedSrc).toMatch(/require\(".*bowl\.mp3"\)/);
        expect(sharedSrc).toMatch(/require\(".*rain\.mp3"\)/);
        expect(sharedSrc).toMatch(/require\(".*ocean\.mp3"\)/);
    });

    it("both variants export the same function name", () => {
        expect(androidSrc).toMatch(/export function musicSource\(/);
        expect(sharedSrc).toMatch(/export function musicSource\(/);
    });
});

describe("the Android URI is built correctly", () => {
    const androidSrc = code("src/components/imotara/musicSources.android.ts");

    it("uses android.resource:// with the real application id", () => {
        expect(androidSrc).toMatch(/android\.resource:\/\/\$\{pkg\}\/raw\/\$\{track\}/);
        expect(androidSrc).toMatch(/Application\.applicationId/);
    });

    it("carries no file extension — res/raw ids do not have one", () => {
        expect(androidSrc).not.toMatch(/raw\/\$\{track\}\.mp3/);
    });

    it("fails loudly rather than returning something unplayable", () => {
        expect(androidSrc).toMatch(/throw new Error/);
    });
});

describe("BreathingModal goes through the platform module", () => {
    const src = code("src/components/imotara/BreathingModal.tsx");

    it("calls musicSource(), not a require map", () => {
        expect(src).toMatch(/musicSource\(track\)/);
        expect(src).toMatch(/from "\.\/musicSources"/);
    });

    it("no longer holds its own MUSIC_SOURCES require map", () => {
        // If this comes back, Android starts bundling the mp3s again.
        expect(src).not.toMatch(/const MUSIC_SOURCES/);
        expect(src).not.toMatch(/require\(.*\.mp3/);
    });
});
