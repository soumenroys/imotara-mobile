/**
 * The expo-av audio-source patch.
 *
 * Imotara records through a FORK of expo-av. That is not a decision to leave
 * undefended: a routine `expo install --fix` or a version bump can drop the
 * patch, and nothing about the app would look broken — it would simply go back
 * to recording the raw microphone, and the noise complaints would return with
 * no obvious cause. These tests are the alarm on that door.
 *
 * Why the fork exists: upstream hardcodes MediaRecorder.AudioSource.DEFAULT and
 * RecordingOptions offers no way to change it. The owner's Galaxy A27 audio log
 * showed every other voice app on the device asking for the tuned capture path
 * while Imotara did not:
 *
 *     src:VOICE_COMMUNICATION ... pack:com.whatsapp
 *     src:VOICE_COMMUNICATION ... pack:us.zoom.videomeetings
 *     src:MIC                 ... pack:com.imotara.imotara
 */
import fs from "fs";
import path from "path";

const root = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const pkg = JSON.parse(read("package.json"));

const AV_MANAGER = "node_modules/expo-av/android/src/main/java/expo/modules/av/AVManager.java";

describe("the patch actually REACHES the build", () => {
    it("expo-av is opted out of prebuilt Expo modules", () => {
        // 🔴 THE BUG THIS TEST EXISTS FOR, found on the A27 2026-09-16.
        //
        // Expo SDK 54 ships Android modules as PREBUILT MAVEN ARTIFACTS.
        // `expo.modules.av-16.0.8` is downloaded and used as-is; the Java under
        // node_modules/expo-av/android/src is NEVER COMPILED. So patch-package
        // faithfully patched a file with no effect whatsoever, the build was
        // green, every other assertion in this file passed — and the shipped
        // app still recorded through the raw mic. Decompiling the artifact's
        // AVManager.class showed `iconst_0` (AudioSource.DEFAULT) unchanged.
        //
        // `buildFromSource` is the documented opt-out: "A list of package names
        // to opt out of prebuilt Expo modules (Android-only)". Without this
        // entry the patch below is decoration.
        expect(pkg.expo?.autolinking?.buildFromSource).toContain("expo-av");
    });

    it("package.json runs patch-package on postinstall", () => {
        // Without this the patch exists on disk and is never applied — and EAS
        // builds from a clean node_modules, so the SHIPPED app would be
        // unpatched while every local checkout looked fine.
        expect(pkg.scripts?.postinstall).toBe("patch-package");
        expect(pkg.devDependencies?.["patch-package"]).toBeTruthy();
    });

    it("the patch file is named for the version actually installed", () => {
        // ⚠️ The quiet failure mode: bump expo-av and the patch filename still
        // says the old version. patch-package warns, the build goes green, and
        // the microphone silently reverts to raw.
        const installed = JSON.parse(read("node_modules/expo-av/package.json")).version;
        const patches = fs.readdirSync(path.join(root, "patches"));
        expect(patches).toContain(`expo-av+${installed}.patch`);
    });

    it("the patch declares what it changes", () => {
        const installed = JSON.parse(read("node_modules/expo-av/package.json")).version;
        const patch = read(`patches/expo-av+${installed}.patch`);
        expect(patch).toMatch(/AVManager\.java/);
        expect(patch).toMatch(/VOICE_RECOGNITION/);
    });
});

describe("what the patch actually does", () => {
    const java = () => read(AV_MANAGER);

    it("records through VOICE_RECOGNITION, not the raw microphone", () => {
        // VOICE_RECOGNITION is the source Android's own speech recogniser
        // uses: device noise suppression, tuned for speech-to-text, and no
        // automatic gain control pumping room noise up between words.
        expect(java()).toMatch(/setAudioSource\(MediaRecorder\.AudioSource\.VOICE_RECOGNITION\)/);
    });

    it("falls back rather than leaving the app unable to record", () => {
        // A manufacturer can refuse the source. Recording nothing at all would
        // be a far worse bug than recording noisily — and "the mic does not
        // work" is precisely the class of fault this whole session started on.
        const body = java().slice(java().indexOf("VOICE_RECOGNITION") - 400, java().indexOf("setOutputFormat"));
        expect(body).toMatch(/try \{/);
        expect(body).toMatch(/catch \(final Exception e\) \{/);
        expect(body).toMatch(/setAudioSource\(MediaRecorder\.AudioSource\.DEFAULT\)/);
    });

    it("says loudly that it is patched, for whoever reads it next", () => {
        expect(java()).toMatch(/PATCHED FOR IMOTARA/);
        expect(java()).toMatch(/patches\/expo-av\+[\d.]+\.patch/);
    });

    it("leaves the rest of the recorder setup alone", () => {
        // The patch must be one line of behaviour, not a rewrite: everything
        // the app already relies on downstream has to stay exactly as it was.
        const j = java();
        for (const call of [
            "setOutputFormat",
            "setAudioEncoder",
            "setAudioSamplingRate",
            "setAudioChannels",
            "setAudioEncodingBitRate",
            "setOutputFile",
        ]) {
            expect(j).toMatch(new RegExp(`mAudioRecorder\\.${call}\\(`));
        }
    });
});
