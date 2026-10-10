/**
 * Debug output needs somewhere to GO.
 *
 * 🔴 Measured 2026-10-10, Release simulator build, debug flag provably ON
 * (inlined — verified at the bytecode level): `console.log` output does not
 * reach the iOS device log at all. Enabling logging was necessary but not
 * sufficient, and a failure reported from a phone still left no app-level
 * trace. The cause of that day's two issues had to be established by reading
 * code and by reading the NATIVE CFNetwork log instead.
 *
 * ⛔ The file holds reply text — the person's own conversation. It never
 * leaves the device and nothing uploads it. The tests below pin the two
 * properties that keep that true: it is written only when the logging flag is
 * on, and no store profile sets that flag.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "fs";
import path from "path";

const SRC = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const SINK = "src/lib/diagnostics/fileLog.ts";
const DEBUG = "src/config/debug.ts";

describe("🔑 the line format carries what a diagnosis needs", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { formatLine } = require("../lib/diagnostics/fileLog") as
    typeof import("../lib/diagnostics/fileLog");
  const AT = new Date("2026-10-10T12:00:00.000Z");

  it("stamps an ISO time, so it lines up with the native network log", () => {
    // The native log is what actually solves network failures; these lines
    // are only useful if they can be read side by side with it.
    expect(formatLine("log", ["hello"], AT)).toBe("2026-10-10T12:00:00.000Z LOG  hello");
  });

  it("marks warnings distinctly", () => {
    expect(formatLine("warn", ["uh oh"], AT)).toMatch(/ WARN uh oh$/);
  });

  it("renders objects, errors and oddities without throwing", () => {
    expect(formatLine("log", [{ a: 1 }], AT)).toMatch(/\{"a":1\}/);
    expect(formatLine("log", [new TypeError("boom")], AT)).toMatch(/TypeError: boom/);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => formatLine("log", [circular], AT)).not.toThrow();
    expect(() => formatLine("log", [undefined, null, Symbol("s")], AT)).not.toThrow();
  });

  it("⛔ clips a runaway argument instead of letting it become the file", () => {
    const huge = "x".repeat(10_000);
    const line = formatLine("log", [huge], AT);
    expect(line.length).toBeLessThan(2_200);
    expect(line).toMatch(/…\(\+8000\)$/);
  });

  it("joins several arguments the way console does", () => {
    expect(formatLine("log", ["a", 1, true], AT)).toMatch(/a 1 true$/);
  });
});

describe("⚖️ bounded, so it cannot grow without limit", () => {
  it("keeps the TAIL of the session, not the beginning", () => {
    // Failures come last. A buffer that drops the newest lines would throw
    // away exactly the part worth reading.
    const s = SRC(SINK);
    expect(s).toMatch(/while \(lines\.length > MAX_LINES\) lines\.shift\(\);/);
    expect(s).toMatch(/const MAX_LINES = \d+;/);
  });

  it("writes on a timer rather than once per line", () => {
    expect(SRC(SINK)).toMatch(/setInterval\(\(\) => \{ void flush\(\); \}, FLUSH_MS\)/);
  });

  it("keeps the buffer when a write fails, so nothing is lost", () => {
    const s = SRC(SINK);
    const c = s.slice(s.indexOf("} catch {", s.indexOf("async function flush")));
    expect(c).toMatch(/dirty = true;/);
  });

  it("flushes once more on stop", () => {
    expect(SRC(SINK)).toMatch(/export function stopDiagnosticsLog[\s\S]*?void flush\(\);/);
  });
});

describe("⛔ it must be silent in a store build", () => {
  it("does nothing at all unless the logging flag is on", () => {
    const s = SRC(SINK);
    expect(s).toMatch(/if \(!DEBUG_LOGS_ENABLED\) return \(\) => \{\};/);
  });

  it("…and no store profile sets that flag", () => {
    // The property that keeps conversation text out of store builds.
    const eas = JSON.parse(SRC("eas.json")) as
      { build: Record<string, { env?: Record<string, string> }> };
    for (const p of ["production", "iosTestflight"]) {
      // ⚠️ Jest's expect() takes ONE argument — the second-arg message is
      // vitest's API, and passing it here throws. The loop variable goes in
      // the failure path instead.
      const v = eas.build[p]?.env?.EXPO_PUBLIC_IMOTARA_DEBUG_LOGS;
      if (v !== undefined) throw new Error(`${p} must not enable debug logs (got ${v})`);
    }
    expect(eas.build.internal?.env?.EXPO_PUBLIC_IMOTARA_DEBUG_LOGS).toBe("true");
  });

  it("uses documentDirectory, not the evictable cache", () => {
    // A log that iOS deletes under memory pressure is missing exactly when
    // the device was under pressure — the case worth investigating.
    expect(SRC(SINK)).toMatch(/FileSystem\.documentDirectory/);
    expect(SRC(SINK)).not.toMatch(/FileSystem\.cacheDirectory/);
  });
});

describe("🔴 diagnostics must never break the product", () => {
  it("a throwing sink cannot escape debugLog", () => {
    // ⚠️ RE-POINTED when emit() gained the early-replay buffer. The guarantee
    // is unchanged: the dispatch is inside a try/catch.
    const d = SRC(DEBUG);
    const body = d.slice(d.indexOf("function emit("), d.indexOf("export function debugLog"));
    const tryAt = body.indexOf("try {");
    const catchAt = body.indexOf("} catch {");
    expect(tryAt).toBeGreaterThan(-1);
    expect(catchAt).toBeGreaterThan(tryAt);
    expect(body.indexOf("sink(level, args)")).toBeGreaterThan(tryAt);
    expect(body.indexOf("sink(level, args)")).toBeLessThan(catchAt);
  });

  it("…and the console call happens BEFORE the sink, so it is never skipped", () => {
    const d = SRC(DEBUG);
    const body = d.slice(d.indexOf("function emit("), d.indexOf("export function debugLog"));
    expect(body.indexOf("console.warn")).toBeLessThan(body.indexOf("sink(level, args)"));
  });

  it("⛔ …and an early line is buffered rather than silently dropped", () => {
    const d = SRC(DEBUG);
    const body = d.slice(d.indexOf("function emit("), d.indexOf("export function debugLog"));
    expect(body).toMatch(/\} else if \(early\.length < MAX_EARLY\) \{/);
  });

  it("the sink is registered from outside, keeping config/debug dependency-free", () => {
    // That file is imported by almost everything and states it must never
    // throw and never depend on app state.
    expect(SRC(DEBUG)).not.toMatch(/expo-file-system/);
    expect(SRC(SINK)).toMatch(/setDebugSink\(sink\)/);
  });

  it("it is started once, at app startup", () => {
    const app = SRC("App.tsx");
    expect(app).toMatch(/import \{ startDiagnosticsLog \}/);
    expect(app).toMatch(/useEffect\(\(\) => startDiagnosticsLog\(\), \[\]\);/);
  });
});

describe("🔑 the file must exist, and must name the build", () => {
  const SINKSRC = SRC(SINK);
  const DBG = SRC(DEBUG);

  it("⛔ a quiet session still produces a file", () => {
    // Found by actually looking for the file and not finding one: `flush`
    // only writes when `dirty`, and `dirty` only turns true once a line
    // arrives. A session that logged nothing produced NO FILE — which looks
    // exactly like the sink being broken.
    expect(SINKSRC).toMatch(/session started/);
    const start = SINKSRC.slice(SINKSRC.indexOf("export function startDiagnosticsLog"));
    expect(start.indexOf('record("log"')).toBeGreaterThan(-1);
    // header written BEFORE the replay, so the build-identifying lines follow it
    expect(start.indexOf('record("log"')).toBeLessThan(start.indexOf("setDebugSink(sink)"));
    // ...and written at once, not on the next tick
    expect(start).toMatch(/void flush\(\);\s+\/\/ \.\.\.and get that header on disk/);
  });

  it("🔑 lines logged before the sink existed are replayed, not dropped", () => {
    // Module-level logs run as the bundle evaluates, long before App's
    // effects — and those are the ones that identify the build. The API base
    // URL is logged that way, and a WRONG base URL was a real misdiagnosis
    // on 2026-10-10.
    expect(DBG).toMatch(/const early: Array<\{ level: "log" \| "warn"; args: unknown\[\] \}> = \[\];/);
    expect(DBG).toMatch(/early\.push\(\{ level, args \}\)/);
    expect(DBG).toMatch(/const pending = early\.splice\(0, early\.length\);/);
  });

  it("the early buffer is bounded and released once handed over", () => {
    // It must not become a leak in a build where no sink is ever installed.
    expect(DBG).toMatch(/early\.length < MAX_EARLY/);
    expect(DBG).toMatch(/const MAX_EARLY = \d+;/);
    // splice() empties it — a copy would keep the references alive forever.
    expect(DBG).toMatch(/early\.splice\(0, early\.length\)/);
  });

  it("a throwing sink cannot break the replay either", () => {
    const fn = DBG.slice(DBG.indexOf("export function setDebugSink"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toMatch(/try \{[\s\S]*?catch \{/);
  });

  it("nothing is replayed when the sink is removed", () => {
    expect(DBG).toMatch(/if \(!next\) return;/);
  });
});

describe("🔑 the replay, exercised rather than read", () => {
  // ⚠️ Everything above asserts SHAPE. These run the real functions — the
  // distinction that caught the missing file in the first place.
  beforeEach(() => { jest.resetModules(); });

  const load = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../config/debug") as typeof import("../config/debug");
  };

  it("a line logged BEFORE a sink exists still reaches it", () => {
    const d = load();
    d.debugLog("before", 1);
    const got: Array<[string, unknown[]]> = [];
    d.setDebugSink((level, args) => { got.push([level, args]); });
    expect(got).toEqual([["log", ["before", 1]]]);
  });

  it("…in order, and warnings keep their level", () => {
    const d = load();
    d.debugLog("first");
    d.debugWarn("second");
    d.debugLog("third");
    const got: string[] = [];
    d.setDebugSink((level, args) => { got.push(`${level}:${String(args[0])}`); });
    expect(got).toEqual(["log:first", "warn:second", "log:third"]);
  });

  it("a replayed line is not delivered twice", () => {
    // splice() must empty the buffer, or a second sink would see it again.
    const d = load();
    d.debugLog("once");
    d.setDebugSink(() => {});
    const second: unknown[] = [];
    d.setDebugSink((_l, args) => { second.push(args[0]); });
    expect(second).toEqual([]);
  });

  it("after a sink is installed, lines go straight through", () => {
    const d = load();
    const got: unknown[] = [];
    d.setDebugSink((_l, args) => { got.push(args[0]); });
    d.debugLog("live");
    expect(got).toEqual(["live"]);
  });

  it("⛔ a sink that throws cannot break the caller, on replay or live", () => {
    const d = load();
    d.debugLog("buffered");
    expect(() => d.setDebugSink(() => { throw new Error("bad sink"); })).not.toThrow();
    expect(() => d.debugLog("live")).not.toThrow();
  });

  it("the early buffer stops growing at its cap", () => {
    const d = load();
    for (let i = 0; i < 200; i++) d.debugLog("x", i);
    const got: unknown[] = [];
    d.setDebugSink((_l, args) => { got.push(args[1]); });
    expect(got.length).toBeLessThanOrEqual(50);
    // It keeps the FIRST lines — those are the build-identifying ones.
    expect(got[0]).toBe(0);
  });

  it("removing the sink does not replay anything", () => {
    const d = load();
    d.setDebugSink(null);
    d.debugLog("after-null");
    const got: unknown[] = [];
    d.setDebugSink((_l, args) => { got.push(args[0]); });
    expect(got).toEqual(["after-null"]);
  });
});

describe("🔴 raw console.* must be captured too, not just debugLog", () => {
  // ⚠️ Measured 2026-10-10: 51 of the app's diagnostic calls are raw
  // console.log — including EVERY [mobileTTS] line, the ones that say which
  // language and voice a reply was spoken in. On Android those surface in
  // logcat so the gap was invisible; on iOS they went nowhere. The first real
  // question asked of this log — "why did two replies use different voices?"
  // — was unanswerable because of exactly that.
  const SINKSRC = SRC(SINK);

  it("console.log, warn and error are all intercepted", () => {
    expect(SINKSRC).toMatch(/console\.log = \(\.\.\.args: unknown\[\]\) =>/);
    expect(SINKSRC).toMatch(/console\.warn = \(\.\.\.args: unknown\[\]\) =>/);
    expect(SINKSRC).toMatch(/console\.error = \(\.\.\.args: unknown\[\]\) =>/);
  });

  it("⛔ the original console function is still called", () => {
    // The platform logger must keep seeing everything it saw before —
    // logcat is what made Android diagnosable in the first place.
    for (const fn of ["log", "warn", "error"]) {
      expect(SINKSRC).toMatch(new RegExp(`originals!\\.${fn}\\(\\.\\.\\.args\\)`));
    }
  });

  it("recording never breaks the log call itself", () => {
    const patch = SINKSRC.slice(SINKSRC.indexOf("function patchConsole"));
    expect(patch.slice(0, patch.indexOf("\nfunction unpatch")))
      .toMatch(/try \{ record\("log", args\); \} catch/);
  });

  it("⛔ a debugLog is recorded ONCE, not twice", () => {
    // emit() calls console AND the sink. Without the drain flag every
    // debugLog would appear twice in the file.
    expect(SINKSRC).toMatch(/if \(draining\) record\(level, args\);/);
    expect(SINKSRC).toMatch(/draining = true;[\s\S]{0,200}?setDebugSink\(sink\);[\s\S]{0,120}?draining = false;/);
  });

  it("the console is patched BEFORE the replay, and restored on stop", () => {
    const start = SINKSRC.slice(SINKSRC.indexOf("export function startDiagnosticsLog"));
    expect(start.indexOf("patchConsole()")).toBeLessThan(start.indexOf("setDebugSink(sink)"));
    expect(SINKSRC).toMatch(/export function stopDiagnosticsLog[\s\S]{0,160}?unpatchConsole\(\);/);
  });

  it("⛔ still silent in a store build — patching is inside the gate", () => {
    const start = SINKSRC.slice(SINKSRC.indexOf("export function startDiagnosticsLog"));
    expect(start.indexOf("if (!DEBUG_LOGS_ENABLED) return")).toBeLessThan(start.indexOf("patchConsole()"));
  });

  it("the [mobileTTS] lines this was built for are raw console calls", () => {
    // If these ever move to debugLog the capture still works, but the
    // premise of this whole block would have changed.
    expect(SRC("src/lib/tts/mobileTTS.ts")).toMatch(/console\.log\(`\[mobileTTS\] speakMessage start lang=/);
  });
});
