// src/lib/network/failureNotice.ts

import { classifyNetworkFailure } from "./fetchWithTimeout";

/**
 * What to tell someone whose reply came from the on-device engine.
 *
 * 🔴 Reported 2026-10-10, physical iPhone: after sending, the app "suddenly
 * went offline" — on a connection that had just finished uploading a voice
 * recording. Two separate defects produced that sentence:
 *
 * 1. The cause was recovered by substring-matching the error's MESSAGE. Our
 *    own deadline arrives as an AbortError whose message is "Aborted", which
 *    contains none of "Network", "fetch", "connect", "timeout" — so a slow
 *    server fell through to a catch-all that announced the device was offline.
 *
 * 2. ⚠️ Worse, the first branch could never be false. Its last clause was
 *    `typeof navigator !== "undefined" && !navigator.onLine`. React Native
 *    sets `global.navigator = {product: 'ReactNative'}` and defines NO
 *    `onLine` property (Libraries/Core/setUpNavigator.js), so `!undefined` is
 *    `true` and the whole test was `true` for EVERY error. Every AI failure on
 *    every device said "No internet", and the other two branches were dead
 *    code. `navigator.onLine` is a web API; this file never runs in a browser.
 *
 * 🔑 So the kind now comes from the error's TYPE, decided once in
 * classifyNetworkFailure, and this function only chooses words.
 *
 * ⛔ Nothing here may say "offline" unless the device really is offline. That
 * claim sends people to check their wifi for a problem we are having.
 */
export function replyFallbackNotice(err: unknown): string {
    switch (classifyNetworkFailure(err)) {
        case "offline":
            // The device itself reported no connectivity before we tried.
            return "No internet — replied on device";
        case "unreachable":
            // The request could not leave, or nothing answered. Honest about
            // not knowing whose fault it is.
            return "Couldn't reach the server — replied on device";
        case "timeout":
            return "Server took too long — replied on device";
        default:
            // A server answered and something else went wrong. This is the
            // case that used to claim the device had gone offline.
            return "Something went wrong — replied on device";
    }
}
