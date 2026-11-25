// src/config/buildChannel.ts
//
// #170 (owner OK 21 Nov, built 25 Nov 2026): is this a STORE build or a TEST build?
// Our own simulator/emulator runs kept landing in the real anonymous counts (25 Nov: ~10 test
// counts from one evening of testing), so retention numbers mixed real people with us.
//
// Only the EAS profiles that go to the stores ("production", "iosTestflight" in eas.json) set
// EXPO_PUBLIC_IMOTARA_BUILD_CHANNEL=store. Dev clients (__DEV__), local release builds and the
// "internal" profile do not ⇒ "test". A software fact about the build — nothing about the person.
//
// ⛔ No optional chaining on process.env: Expo only inlines the literal `process.env.EXPO_PUBLIC_X`
//    (trap: `process?.env?.X` is undefined in release builds).
export const IS_STORE_BUILD: boolean =
    !__DEV__ && process.env.EXPO_PUBLIC_IMOTARA_BUILD_CHANNEL === "store";

/** Sent with anonymous counts; the server drops "test" (apps from before 1.7.3 send nothing ⇒ counted). */
export const BUILD_HEADER_VALUE: "store" | "test" = IS_STORE_BUILD ? "store" : "test";
