// What to hand expo-av for a breathing ambience — iOS and any other platform.
//
// There is a sibling `musicSources.android.ts`. Metro picks the platform file
// automatically, and that is the whole point: the `require()` calls below
// never enter the Android bundle, so Android ships the tracks ONCE (as res/raw
// resources, via plugins/withAndroidRawSounds.js) instead of twice.
//
// Keeping both in one file with a Platform.OS branch cost 11.8 MB — the
// packager bundled the required assets for Android as well, on top of the raw
// resources, and the APK went 114.9 -> 126.7 MB.

export type AmbienceTrack = "bowl" | "rain" | "ocean";

const MODULES: Record<AmbienceTrack, number> = {
    bowl: require("../../../assets/sounds/bowl.mp3"),
    rain: require("../../../assets/sounds/rain.mp3"),
    ocean: require("../../../assets/sounds/ocean.mp3"),
};

/**
 * iOS resolves the bundled module fine — the empty-URI failure documented in
 * musicSources.android.ts was only ever observed on Android, and a working
 * path should not be changed to match a broken one.
 */
export function musicSource(track: AmbienceTrack): unknown {
    return MODULES[track];
}
