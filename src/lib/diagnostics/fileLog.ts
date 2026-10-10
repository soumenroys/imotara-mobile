// src/lib/diagnostics/fileLog.ts
//
// A place for debug output to GO.
//
// 🔴 Measured 2026-10-10: `console.log` output does not reach the iOS device
// log in a Release React Native build. The debug flag was fixed so the helpers
// actually run (3254b6c), and still nothing was readable — so a failure
// reported from a phone left no app-level trace, and the cause of the two
// issues reported that day had to be established by reading code and by
// reading the NATIVE CFNetwork log, which records requests regardless.
//
// This writes the same lines to a file inside the app's own container, which
// survives a release build and can be pulled off a device.
//
// ⚖️ Deliberately small and boring:
//   • It only runs when DEBUG_LOGS_ENABLED, which no store profile sets.
//   • It holds a bounded ring buffer and writes at most every FLUSH_MS.
//   • Every path swallows its own errors. Diagnostics must never be the
//     reason the product breaks — that would be worse than having none.
//
// ⛔ The file contains reply text, which is the person's own conversation. It
// never leaves the device, and nothing uploads it. Keep it that way.
//
// ── HOW TO READ IT ────────────────────────────────────────────────────────
//
// Simulator:
//   C=$(xcrun simctl get_app_container <UDID> com.imotara.imotara data)
//   cat "$C/Documents/imotara-diagnostics.log"
//
// Physical device (verified working 2026-10-10 on the iPhone 14 Pro):
//   xcrun devicectl device copy from --device <DEVICE-UUID> \
//     --domain-type appDataContainer --domain-identifier com.imotara.imotara \
//     --user mobile \
//     --source Documents/imotara-diagnostics.log --destination ./diag.log
//
// ⚠️ `--user mobile`, not `--username`. And the device UUID is devicectl's
// own identifier from `xcrun devicectl list devices`, not the hardware UDID.
//
// 🔑 Read it ALONGSIDE the native network log, which records every request
// whether or not the JS layer logged anything, and which is what actually
// diagnosed the 2026-10-10 failures:
//   xcrun simctl spawn <UDID> log show --last 5m \
//     --predicate 'processImagePath CONTAINS "Imotara"' --style compact \
//     | grep -iE "imotara\.com|finished with error"

import * as FileSystem from "expo-file-system/legacy";
import { DEBUG_LOGS_ENABLED, setDebugSink, type DebugSink } from "../../config/debug";

/** Keep the tail of the session, not the beginning — failures come last. */
const MAX_LINES = 400;
/** A single runaway argument must not become the whole file. */
const MAX_LINE_CHARS = 2_000;
/** Write at most this often, so a chatty moment cannot cause I/O per line. */
const FLUSH_MS = 3_000;

export const DIAGNOSTICS_FILENAME = "imotara-diagnostics.log";

/**
 * documentDirectory, not cacheDirectory: the cache can be evicted by iOS at
 * any time, and a log that disappears exactly when the device is under
 * pressure is a log that is missing when it is most needed.
 */
export function diagnosticsFileUri(): string | null {
    const dir = FileSystem.documentDirectory;
    return dir ? dir + DIAGNOSTICS_FILENAME : null;
}

const lines: string[] = [];
let dirty = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** One argument, rendered without ever throwing. */
function render(a: unknown): string {
    try {
        if (typeof a === "string") return a;
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        return JSON.stringify(a) ?? String(a);
    } catch {
        // Circular structures, exotic getters, anything at all.
        try { return String(a); } catch { return "<unrenderable>"; }
    }
}

export function formatLine(level: "log" | "warn", args: unknown[], now = new Date()): string {
    const body = args.map(render).join(" ");
    const clipped = body.length > MAX_LINE_CHARS
        ? body.slice(0, MAX_LINE_CHARS) + `…(+${body.length - MAX_LINE_CHARS})`
        : body;
    // ISO time first, so the file sorts and lines up with the native log.
    return `${now.toISOString()} ${level === "warn" ? "WARN" : "LOG "} ${clipped}`;
}

/** Test seam — the buffer as it stands. */
export function __bufferForTest(): string[] {
    return [...lines];
}

function record(level: "log" | "warn", args: unknown[]): void {
    lines.push(formatLine(level, args));
    // Bounded: drop the oldest, keep the tail.
    while (lines.length > MAX_LINES) lines.shift();
    dirty = true;
}

/**
 * ⚠️ Only true while setDebugSink() replays what was logged before we
 * started. Live lines are captured by the console patch below instead, so
 * without this flag every debugLog would be recorded TWICE — once by emit()
 * calling the sink, and once by its own console call.
 */
let draining = false;

const sink: DebugSink = (level, args) => {
    if (draining) record(level, args);
};

/**
 * 🔴 CAPTURE RAW console.* TOO, not only debugLog/debugWarn.
 *
 * Measured 2026-10-10: 51 of the app's ~100 diagnostic calls are raw
 * `console.log`, including EVERY `[mobileTTS]` line — the ones that say which
 * language and voice a reply was spoken in. On Android those surface in
 * logcat, so the gap was invisible; on iOS they went nowhere at all.
 *
 * The first real question asked of this log — "why did two replies use
 * different voices?" — could not be answered because of exactly that.
 *
 * ⛔ Only when DEBUG_LOGS_ENABLED, which no store profile sets. The original
 * console function is always called, so nothing changes about what the
 * platform logger sees.
 */
type ConsoleFn = (...args: unknown[]) => void;
let originals: { log: ConsoleFn; warn: ConsoleFn; error: ConsoleFn } | null = null;

function patchConsole(): void {
    if (originals) return;
    /* eslint-disable no-console */
    originals = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
    };
    console.log = (...args: unknown[]) => { try { record("log", args); } catch { /* never break logging */ } originals!.log(...args); };
    console.warn = (...args: unknown[]) => { try { record("warn", args); } catch { /* never break logging */ } originals!.warn(...args); };
    console.error = (...args: unknown[]) => { try { record("warn", args); } catch { /* never break logging */ } originals!.error(...args); };
    /* eslint-enable no-console */
}

function unpatchConsole(): void {
    if (!originals) return;
    /* eslint-disable no-console */
    console.log = originals.log;
    console.warn = originals.warn;
    console.error = originals.error;
    /* eslint-enable no-console */
    originals = null;
}

async function flush(): Promise<void> {
    if (!dirty) return;
    dirty = false;
    const uri = diagnosticsFileUri();
    if (!uri) return;
    try {
        await FileSystem.writeAsStringAsync(uri, lines.join("\n") + "\n", {
            encoding: FileSystem.EncodingType.UTF8,
        });
    } catch {
        // Out of space, sandbox refusal, anything. Try again next tick; the
        // buffer is still intact, so nothing is lost until the process ends.
        dirty = true;
    }
}

/**
 * Start capturing. Returns a stop function.
 *
 * ⛔ A no-op unless DEBUG_LOGS_ENABLED. Store builds leave the flag unset, so
 * they neither register a sink nor create the file.
 */
export function startDiagnosticsLog(): () => void {
    if (!DEBUG_LOGS_ENABLED) return () => {};
    if (timer) return stopDiagnosticsLog;   // already running
    // A header FIRST, so every file names the build it came from and so the
    // file exists even in a quiet session. Without it `flush` had nothing to
    // write — `dirty` only turns true once a line arrives — and a session
    // that logged nothing produced no file at all, which is indistinguishable
    // from the sink being broken.
    record("log", [
        `=== Imotara diagnostics — session started ${new Date().toISOString()} ===`,
    ]);
    // Patch BEFORE the replay, so anything logged during it is still caught.
    patchConsole();
    // setDebugSink replays anything logged before now, which is where the
    // build-identifying lines live (module-level logs run before App's
    // effects).
    // Drain what was logged before now — those lines name the build. The flag
    // makes the sink accept ONLY the replay; everything live arrives via the
    // console patch, and recording both would duplicate every debugLog.
    draining = true;
    setDebugSink(sink);   // replays synchronously
    draining = false;
    timer = setInterval(() => { void flush(); }, FLUSH_MS);
    void flush();   // ...and get that header on disk immediately
    return stopDiagnosticsLog;
}

export function stopDiagnosticsLog(): void {
    if (timer) { clearInterval(timer); timer = null; }
    unpatchConsole();
    setDebugSink(null);
    void flush();   // final write, so the last lines are not lost
}
