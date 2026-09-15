/**
 * The cache sweeper — voice recordings and exports nothing else cleans up.
 *
 * Owner, 2026-09-16: "we are most probably saving many voice notes from
 * microphone and speaker of imotara. those should be cleaned from storage in a
 * methodical way".
 *
 * These drive the real module against a fake filesystem, so they exercise the
 * actual traversal and the actual delete decisions — including the two traps
 * that make a sweeper look like it works while doing nothing: the per-platform
 * directory name, and modificationTime being in seconds.
 */
import {
    shouldSweepCacheRootFile,
    shouldSweepAudioFile,
    sweepAudioCaches,
    AUDIO_MAX_AGE_MS,
    EXPORT_MAX_AGE_MS,
    AUDIO_CACHE_DIRS,
} from "../lib/audioCacheSweeper";
import * as FileSystem from "expo-file-system/legacy";

jest.mock("expo-file-system/legacy", () => ({
    cacheDirectory: "file:///cache/",
    readDirectoryAsync: jest.fn(),
    getInfoAsync: jest.fn(),
    deleteAsync: jest.fn(),
}));

const fs = FileSystem as unknown as {
    readDirectoryAsync: jest.Mock;
    getInfoAsync: jest.Mock;
    deleteAsync: jest.Mock;
};

const NOW = 1_700_000_000_000;
const secsAgo = (ms: number) => (NOW - ms) / 1000; // modificationTime is SECONDS

/** Builds a fake tree: { "file:///cache/Audio/": { "a.m4a": ageMs } }. */
function mountFs(tree: Record<string, Record<string, number>>) {
    fs.readDirectoryAsync.mockImplementation(async (dir: string) => {
        if (!(dir in tree)) throw new Error("ENOENT");
        return Object.keys(tree[dir]);
    });
    fs.getInfoAsync.mockImplementation(async (uri: string) => {
        for (const [dir, files] of Object.entries(tree)) {
            for (const [name, age] of Object.entries(files)) {
                if (dir + name === uri) {
                    return { exists: true, modificationTime: secsAgo(age) };
                }
            }
        }
        return { exists: false };
    });
    fs.deleteAsync.mockResolvedValue(undefined);
}

const deleted = () => fs.deleteAsync.mock.calls.map((c) => c[0] as string).sort();

beforeEach(() => jest.clearAllMocks());

describe("what gets swept", () => {
    it("an orphaned recording — the app was killed mid-turn", () => {
        // The case no finally block can ever cover.
        expect(shouldSweepAudioFile(AUDIO_MAX_AGE_MS + 1)).toBe(true);
    });

    it("a recording that could still be in flight is left alone", () => {
        expect(shouldSweepAudioFile(AUDIO_MAX_AGE_MS - 1)).toBe(false);
        expect(shouldSweepAudioFile(0)).toBe(false);
        // The longest permitted recording is 5 minutes — nowhere near the gate.
        expect(shouldSweepAudioFile(5 * 60 * 1000)).toBe(false);
    });

    it("exports get a day, not an hour", () => {
        // Someone may hand the file to another app hours later, or pick it up
        // again the same evening. An hour would delete it mid-share.
        expect(shouldSweepCacheRootFile("imotara-export-2026-09-16.json", AUDIO_MAX_AGE_MS + 1)).toBe(false);
        expect(shouldSweepCacheRootFile("imotara-export-2026-09-16.json", EXPORT_MAX_AGE_MS + 1)).toBe(true);
        expect(shouldSweepCacheRootFile("imotara-journal-2026-09-16.txt", EXPORT_MAX_AGE_MS + 1)).toBe(true);
        expect(shouldSweepCacheRootFile("imotara-export-2026-09-16.csv", EXPORT_MAX_AGE_MS + 1)).toBe(true);
    });

    it("never touches a file belonging to someone else", () => {
        // The cache root is shared with libraries we do not own. Deleting
        // another module's working file to save a few kilobytes is a bad trade.
        for (const name of ["ExponentAsset-abc.ttf", "RCTAsyncLocalStorage", "com.google.x", "index.db"]) {
            expect(shouldSweepCacheRootFile(name, 365 * 24 * 60 * 60 * 1000)).toBe(false);
        }
    });

    it("stale TTS clips are swept, fresh ones are not", () => {
        expect(shouldSweepCacheRootFile("imotara_tts_0.mp3", AUDIO_MAX_AGE_MS + 1)).toBe(true);
        expect(shouldSweepCacheRootFile("imotara_tts_1.mp3", 5_000)).toBe(false);
    });
});

describe("it actually walks both platforms' directories", () => {
    it("sweeps the iOS directory (AV) and the Android one (Audio)", () => {
        // ⚠️ expo-av uses cachesDirectory/AV on iOS and cache/Audio on Android.
        // A sweeper that knew only one name would do nothing at all on the
        // other platform while appearing to work.
        expect([...AUDIO_CACHE_DIRS]).toEqual(expect.arrayContaining(["AV/", "Audio/"]));
    });

    it("deletes old recordings from whichever directory exists", async () => {
        mountFs({
            "file:///cache/Audio/": { "old.m4a": AUDIO_MAX_AGE_MS * 2, "live.m4a": 3_000 },
            "file:///cache/": {},
        });
        const n = await sweepAudioCaches(NOW);
        expect(n).toBe(1);
        expect(deleted()).toEqual(["file:///cache/Audio/old.m4a"]);
    });

    it("works on the iOS layout too", async () => {
        mountFs({
            "file:///cache/AV/": { "recording-1.m4a": AUDIO_MAX_AGE_MS * 3 },
            "file:///cache/": {},
        });
        await sweepAudioCaches(NOW);
        expect(deleted()).toEqual(["file:///cache/AV/recording-1.m4a"]);
    });

    it("a missing directory is normal, not an error", async () => {
        // Nothing has ever been recorded on this device.
        mountFs({ "file:///cache/": {} });
        await expect(sweepAudioCaches(NOW)).resolves.toBe(0);
        expect(fs.deleteAsync).not.toHaveBeenCalled();
    });
});

describe("the traps", () => {
    it("reads modificationTime as SECONDS", async () => {
        // If this were treated as milliseconds every file would look ~1000x
        // too new and the sweeper would silently never delete anything — the
        // failure mode that looks exactly like success.
        mountFs({
            "file:///cache/Audio/": { "ancient.m4a": 30 * 24 * 60 * 60 * 1000 },
            "file:///cache/": {},
        });
        expect(await sweepAudioCaches(NOW)).toBe(1);
    });

    it("skips a file whose age cannot be determined", async () => {
        fs.readDirectoryAsync.mockImplementation(async (d: string) =>
            d === "file:///cache/Audio/" ? ["mystery.m4a"] : [],
        );
        fs.getInfoAsync.mockResolvedValue({ exists: true }); // no modificationTime
        fs.deleteAsync.mockResolvedValue(undefined);
        expect(await sweepAudioCaches(NOW)).toBe(0);
        expect(fs.deleteAsync).not.toHaveBeenCalled();
    });

    it("never throws, whatever the filesystem does", async () => {
        fs.readDirectoryAsync.mockRejectedValue(new Error("EIO"));
        fs.getInfoAsync.mockRejectedValue(new Error("EIO"));
        await expect(sweepAudioCaches(NOW)).resolves.toBe(0);
    });

    it("a failed delete is not counted as a success", async () => {
        mountFs({
            "file:///cache/Audio/": { "locked.m4a": AUDIO_MAX_AGE_MS * 2 },
            "file:///cache/": {},
        });
        fs.deleteAsync.mockRejectedValue(new Error("EPERM"));
        await expect(sweepAudioCaches(NOW)).resolves.toBe(0);
    });
});
