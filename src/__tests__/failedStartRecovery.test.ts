/**
 * A recording that half-started must leave NOTHING running.
 *
 * 🔴 The bug this guards, found on a real iPhone 2026-09-16: an alert reading
 * "Could not start recording" on screen, while the composer showed
 * "Recording… 6s" in red and the iOS orange microphone dot was lit. The
 * device syslog confirmed the microphone was genuinely live. A user told the
 * recording had failed was in fact being recorded.
 *
 * ⚠️ WHY IT SHIPPED UNVERIFIED. The recovery runs only when a native call
 * throws AFTER `createAsync` has resolved — setProgressUpdateInterval,
 * setOnRecordingStatusUpdate or setInterval. No sequence of taps can provoke
 * that, so the fix was shipped on the strength of reading it, and the
 * ordering it depends on was protected by a comment. Injecting the
 * collaborators makes every step assertable on any machine.
 */

import { describe, it, expect } from "@jest/globals";
import { recoverFromFailedStart, type FailedStartIO } from "../hooks/useVoiceInput";

/** Records the real call ORDER, which is the part that matters most. */
function harness(over: Partial<FailedStartIO> & { granted?: boolean } = {}) {
  const calls: string[] = [];
  const deleted: string[] = [];
  const io: FailedStartIO = {
    clearTimer: () => void calls.push("clearTimer"),
    takeRecording: () => {
      calls.push("takeRecording");
      return {
        stopAndUnload: async () => void calls.push("stopAndUnload"),
        getUri: () => {
          calls.push("getUri");
          return "file:///cache/partial.m4a";
        },
      };
    },
    toIdle: () => void calls.push("toIdle"),
    restoreAudioMode: () => void calls.push("restoreAudioMode"),
    deleteFile: (uri) => {
      calls.push("deleteFile");
      deleted.push(uri);
    },
    isPermissionGranted: async () => {
      calls.push("isPermissionGranted");
      return over.granted ?? true;
    },
    ...over,
  };
  return { io, calls, deleted };
}

describe("🔴 nothing may be left running after a failed start", () => {
  it("stops the recorder, goes idle, and restores the audio mode", async () => {
    const { io, calls } = harness();
    await recoverFromFailedStart(io);
    expect(calls).toContain("stopAndUnload");
    expect(calls).toContain("toIdle");
    expect(calls).toContain("restoreAudioMode");
  });

  it("⛔ unloads the recorder BEFORE restoring the audio mode", async () => {
    // Load-bearing. Setting allowsRecordingIOS:false while a recording is
    // still running is suspected of producing the original Android report —
    // a red indicator over a microphone that captures nothing.
    const { io, calls } = harness();
    await recoverFromFailedStart(io);
    expect(calls.indexOf("stopAndUnload")).toBeLessThan(calls.indexOf("restoreAudioMode"));
  });

  it("⛔ clears the timer FIRST, before the recorder is torn down", async () => {
    // A tick that survives the teardown calls stop against a dead recorder.
    const { io, calls } = harness();
    await recoverFromFailedStart(io);
    expect(calls.indexOf("clearTimer")).toBe(0);
    expect(calls.indexOf("clearTimer")).toBeLessThan(calls.indexOf("takeRecording"));
  });

  it("deletes the partial .m4a — a failed start must not leave audio on disk", async () => {
    const { io, deleted } = harness();
    await recoverFromFailedStart(io);
    expect(deleted).toEqual(["file:///cache/partial.m4a"]);
  });

  it("🔑 finishes the WHOLE cleanup even when the unload itself throws", async () => {
    // The most dangerous case: the recorder is wedged. Bailing here is what
    // would leave the mic live, so every later step must still run.
    const { io, calls } = harness();
    io.takeRecording = () => ({
      stopAndUnload: async () => {
        calls.push("stopAndUnload");
        throw new Error("recorder already gone");
      },
      getUri: () => "file:///cache/wedged.m4a",
    });
    await expect(recoverFromFailedStart(io)).resolves.toBeDefined();
    expect(calls).toContain("toIdle");
    expect(calls).toContain("restoreAudioMode");
    expect(calls).toContain("deleteFile");
  });

  it("a start that threw before any recorder existed still resets the UI", async () => {
    // createAsync itself threw: there is nothing to unload, but the composer
    // must not be left saying "Recording…".
    const { io, calls, deleted } = harness({ takeRecording: () => null });
    await recoverFromFailedStart(io);
    expect(calls).toContain("toIdle");
    expect(calls).toContain("restoreAudioMode");
    expect(calls).not.toContain("stopAndUnload");
    expect(deleted).toEqual([]);
  });

  it("no file to delete ⇒ no delete call", async () => {
    const { io, deleted } = harness({
      takeRecording: () => ({ stopAndUnload: async () => {}, getUri: () => null }),
    });
    await recoverFromFailedStart(io);
    expect(deleted).toEqual([]);
  });

  it("detaches the recorder from the hook exactly once", async () => {
    // Taking it twice could hand the same recorder to two teardowns.
    const { io, calls } = harness();
    await recoverFromFailedStart(io);
    expect(calls.filter((c) => c === "takeRecording")).toHaveLength(1);
  });
});

describe("which alert the user is shown", () => {
  it("permission revoked ⇒ the Settings alert, not a generic error", async () => {
    const { io } = harness({ granted: false });
    expect(await recoverFromFailedStart(io)).toBe("permission-blocked");
  });

  it("permission intact ⇒ the generic retry alert", async () => {
    const { io } = harness({ granted: true });
    expect(await recoverFromFailedStart(io)).toBe("generic-error");
  });

  it("⛔ the permission check runs AFTER the mic is released", async () => {
    // Asking about permissions while the recorder is live has its own
    // side effects on iOS; the cleanup must not depend on the answer.
    const { io, calls } = harness();
    await recoverFromFailedStart(io);
    expect(calls.indexOf("stopAndUnload")).toBeLessThan(calls.indexOf("isPermissionGranted"));
    expect(calls.indexOf("toIdle")).toBeLessThan(calls.indexOf("isPermissionGranted"));
  });
});
