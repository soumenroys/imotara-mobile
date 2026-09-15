// Sweeping up voice recordings and exports that nothing else will.
//
// Asked for by the owner, 2026-09-16: "we are most probably saving many voice
// notes from microphone and speaker of imotara. those should be cleaned from
// storage in a methodical way".
//
// What the audit found:
//
//   Recordings   useVoiceInput deletes the .m4a on all three of its own exit
//                paths (normal stop, cancel, abandon-on-unmount). Those are
//                sound. What NO finally block can cover is the app being
//                KILLED mid-turn — a crash, a swipe-away, an OS memory kill.
//                The recorder's file is already on disk at that moment and
//                nothing ever comes back for it. That is what this sweeps.
//
//   TTS          Already bounded and already correct: mobileTTS writes to just
//                two alternating filenames (imotara_tts_0/1.mp3) and deletes
//                each after playback. Swept anyway, but only when stale, in
//                case playback was interrupted by a kill.
//
//   Exports      SettingsScreen writes imotara-export-<date>.json/.csv and
//                imotara-journal-<date>.txt into the cache for the share
//                sheet, and never deletes them. One per kind per day, kept
//                forever. These can contain the person's whole journal, so
//                leaving them lying about is a privacy point, not only a
//                storage one.
//
// ⚠️ THE PLATFORM TRAP: expo-av does not use the same directory on both.
//    iOS      cachesDirectory/AV/     (EXAV.m:596)
//    Android  cacheDir/Audio/         (AVManager.java)
// A sweeper that knew only one name would silently do nothing on the other
// platform, which is exactly the kind of bug that looks like it works.
//
// Everything here is age-gated and fails silently. It runs at startup, beside
// whatever the person is doing, and must never delete a file still in use nor
// ever surface an error to them.

import * as FileSystem from "expo-file-system/legacy";

/**
 * Recordings and TTS clips older than this are certainly orphans.
 *
 * The longest recording the app permits is 5 minutes, and a transcription
 * upload that has not resolved within an hour never will. One hour is
 * therefore far beyond any legitimate in-use window, which is the property
 * that matters: this must never race a live turn.
 */
export const AUDIO_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Exports get a day. They exist for the share sheet, and a person may well
 * hand the file to another app minutes later — or pick it up again the same
 * evening. Deleting one out from under a share in progress would look like
 * the export had failed.
 */
export const EXPORT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Both spellings, because the platforms disagree. See the trap note above. */
export const AUDIO_CACHE_DIRS = ["AV/", "Audio/"] as const;

/** Files the app leaves in the cache root, by prefix. */
export const EXPORT_PREFIXES = ["imotara-export-", "imotara-journal-"] as const;

/**
 * Should this cache-root file be swept?
 *
 * Deliberately a whitelist of our own prefixes: the cache root is shared with
 * libraries we do not own, and deleting another module's working file to save
 * a few kilobytes would be a bad trade.
 */
export function shouldSweepCacheRootFile(name: string, ageMs: number): boolean {
    if (EXPORT_PREFIXES.some((p) => name.startsWith(p))) return ageMs > EXPORT_MAX_AGE_MS;
    if (name.startsWith("imotara_tts_")) return ageMs > AUDIO_MAX_AGE_MS;
    return false;
}

/** Everything inside the recorder's own directory is ours, so age alone rules. */
export function shouldSweepAudioFile(ageMs: number): boolean {
    return ageMs > AUDIO_MAX_AGE_MS;
}

async function ageOf(uri: string, now: number): Promise<number | null> {
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    // modificationTime is in SECONDS, not milliseconds — multiplying is not
    // optional. Getting this wrong makes every file look ~1000x too new, and
    // the sweeper would quietly never delete anything.
    if (!info?.exists || typeof info.modificationTime !== "number") return null;
    return now - info.modificationTime * 1000;
}

async function sweepDir(
    dir: string,
    decide: (name: string, ageMs: number) => boolean,
    now: number,
): Promise<number> {
    const names = await FileSystem.readDirectoryAsync(dir).catch(() => null);
    if (!names) return 0; // directory absent — nothing recorded yet on this device
    let removed = 0;
    for (const name of names) {
        const uri = dir + name;
        const age = await ageOf(uri, now);
        if (age === null || !decide(name, age)) continue;
        const ok = await FileSystem.deleteAsync(uri, { idempotent: true }).then(
            () => true,
            () => false,
        );
        if (ok) removed++;
    }
    return removed;
}

/**
 * Remove orphaned recordings, stale TTS clips and expired exports.
 *
 * Safe to call on every launch and safe to call concurrently with recording:
 * every rule is age-gated well beyond any in-use window. Never throws.
 *
 * @returns how many files it deleted, for logging and for tests.
 */
export async function sweepAudioCaches(now: number = Date.now()): Promise<number> {
    const root = FileSystem.cacheDirectory;
    if (!root) return 0;
    let removed = 0;
    try {
        for (const sub of AUDIO_CACHE_DIRS) {
            removed += await sweepDir(root + sub, (_n, age) => shouldSweepAudioFile(age), now);
        }
        removed += await sweepDir(root, shouldSweepCacheRootFile, now);
    } catch {
        // Storage cleanup is never worth interrupting someone's session over.
    }
    return removed;
}
