// src/lib/chat/localSourceLabel.ts
//
// What to call a reply that came from the on-device engine.
//
// 🔴 THE INCIDENT, measured on a real iPhone 2026-10-11. The bubble label was:
//
//     source === "local" ? " (offline)" : ""
//
// so EVERY on-device reply told the person they were offline. With both wifi
// and mobile data on, one cold-start cloud failure produced "Imotara (offline)"
// — blaming the user's connection for a failure that was not theirs. Tested
// directly at the same moment, /api/chat-reply answered the same crisis phrase
// in 2.4 / 3.1 / 2.4 seconds. The server was fine. The user was online. The
// label was simply wrong.
//
// ⚠️ It was wrong in a second way too: the greeting and the content-guard reply
// are on-device BY DESIGN and were also labelled "(offline)", which is both
// false and faintly alarming on a mental-health surface.
//
// 🔑 THE FIX IS NOT A BETTER GUESS. The app already knew the answer — the toast
// "Couldn't connect — used on-device mode." is gated on `cloudFailed && isOnline`.
// So the REASON is stamped at creation, where it is known, and this function
// only renders it.
//
// ⛔ Never re-derive this from `isOnline` at render time. ChatScreen's own
// comment records that on iOS `isOnline` is a PROBE, and "a Vercel blip or a
// cold start makes that probe time out" — the exact failure that produced the
// wrong label. A renderer that re-probes would reintroduce the bug.

/** WHY a reply came from the on-device engine. */
export type LocalReason =
    /** NetInfo said there was no connection when we tried. "(offline)" is TRUE. */
    | "offline"
    /** We had a connection and the cloud still failed. NOT the user's fault. */
    | "cloud_failed"
    /** The person is out of cloud replies. Nothing to do with connectivity. */
    | "quota"
    /** Never went to the cloud by design — greeting, content guard. Not degraded. */
    | "by_design";

/** The suffix after the companion's name, including its leading space. */
export function localSourceLabel(message: {
    source?: string;
    localReason?: LocalReason;
}): string {
    if (message.source !== "local") return "";

    switch (message.localReason) {
        // The only case where the word "offline" is true.
        case "offline":
            return " (offline)";

        // ⚠️ Online, but the reply was written on the device. Say THAT, and say
        // nothing about the person's connection. "on-device" is also true when
        // they are offline, so an unset reason degrades to something accurate
        // rather than to the old lie.
        case "cloud_failed":
        case "quota":
            return " (on-device)";

        // ⛔ A greeting is not a degraded reply. Labelling it at all invites the
        // person to read a normal message as a failure.
        case "by_design":
            return "";

        // 🔑 Unknown or not yet stamped — e.g. a message restored from history
        // written before this field existed. Fail to the ACCURATE label, never
        // back to "(offline)": the whole point is that we do not claim to know
        // the person's connection state when we do not.
        default:
            return " (on-device)";
    }
}
