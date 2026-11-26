/**
 * #125 SDK 58: expo-file-system's File.write() became ASYNC (returns a Promise).
 * mobileTTS writes each audio chunk to a file and plays it on the next line — an
 * un-awaited write() could start playback on a half-written file (silence or a cut).
 * ⛔ So the TTS file writes must be writeSync (or awaited) — never a bare write().
 */
import fs from "fs";
import path from "path";

const src = fs.readFileSync(path.join(__dirname, "..", "lib", "tts", "mobileTTS.ts"), "utf8");

describe("TTS audio files are complete before playback", () => {
    it("uses writeSync for the chunk files", () => {
        expect((src.match(/file\.writeSync\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });
    it("has no bare, un-awaited file.write(", () => {
        const bare = src.split("\n").filter((l) => /file\.write\(/.test(l) && !/await\s+file\.write\(/.test(l));
        expect(bare).toEqual([]);
    });
});
