// What to hand expo-av for a breathing ambience — ANDROID.
//
// WHY THIS FILE EXISTS
// On a release build, a `require()`d .mp3 could not be resolved to a URI on a
// real Galaxy A27, while the identical APK was fine on an emulator. Measured
// on the device:
//
//   Image.resolveAssetSource() -> { "__packager_asset": true, "uri": "", "scale": 1 }
//   Asset.fromModule()         -> uri: "", name: "bowl", type: "mp3", hash: "f6d326bd…"
//
// Correct metadata, files present in the APK, and an EMPTY uri. expo-av then
// called ExpoAsset.downloadAsync with that empty string and rejected with
// "Unable to download asset from url:", so the breathing exercise played in
// silence on hardware. Three JS-side fixes failed first — an explicit
// Asset.fromModule + downloadAsync, and a migration to expo-audio — because
// they all still depend on the same resolution that produces nothing.
//
// So Android skips JS asset resolution entirely. plugins/withAndroidRawSounds.js
// copies the same three files into res/raw at prebuild time, and this URI
// needs no packager metadata at all. expo-av plays from a URI reliably — that
// is how TTS works, and TTS audio was verified on this very device.
//
// NOTE the deliberate absence of `require()` here. Metro resolves this file
// for Android, so the packager never bundles the mp3s for this platform and
// they ship once rather than twice (that duplication cost 11.8 MB).

import * as Application from "expo-application";

// Declared locally, NOT imported from ./musicSources. Even a type-only import
// can make the bundler pull that module in, and its require() calls are
// exactly what must not reach the Android bundle — that duplication cost
// 11.8 MB. Keep this file free of any reference to the shared module.
export type AmbienceTrack = "bowl" | "rain" | "ocean";

export function musicSource(track: AmbienceTrack): unknown {
    const pkg = Application.applicationId;
    if (!pkg) {
        // Synchronous native constant on Android, so this should not happen.
        // Throwing is better than returning something unplayable: the caller
        // already catches and warns, and a clear message beats silence with no
        // explanation — which is exactly the bug this file exists to fix.
        throw new Error(
            "musicSource: Application.applicationId is unavailable, cannot build " +
                "an android.resource:// URI for the breathing ambience."
        );
    }
    // res/raw ids carry no extension — withAndroidRawSounds copies <track>.mp3
    // and Android exposes it as R.raw.<track>.
    return { uri: `android.resource://${pkg}/raw/${track}` };
}
