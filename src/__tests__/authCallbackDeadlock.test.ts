// The auth deadlock, and why this test exists.
//
// supabase-js invokes onAuthStateChange subscribers WHILE HOLDING the auth
// lock. Calling another auth method from inside such a callback therefore
// waits for a lock the caller already holds — a re-entrant deadlock.
// _initialize() never finishes, the lock is never released, and every later
// call queues behind it forever. Not just auth calls: every .from() query
// resolves the session first, so the whole Supabase client stops.
//
// Measured on the iPhone 17 Pro simulator before the fix: lockAcquired stuck
// true, initializePromise never settling, 437 operations queued and never
// drained, autoRefreshTicker null so tokens never refreshed either. Android
// happened to win the race and looked healthy, which is exactly what made this
// look like a platform quirk instead of a latent bug present in both.
//
// This is a source check rather than a runtime one because reproducing it
// needs a real client on a device. It reads AuthContext and asserts that the
// onAuthStateChange callback does not call supabase.auth.* directly.

import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(path.join(process.cwd(), "src/auth/AuthContext.tsx"), "utf8");

/** The body of the onAuthStateChange callback, brace-matched. */
function authStateChangeCallback(src: string): string {
  // Must match the CALL, not the several comments that mention it by name —
  // indexOf("onAuthStateChange") lands in a comment and yields a 2-char body
  // that then passes every check vacuously. The "finds the callback" test
  // below exists because that is exactly what happened while writing this.
  const start = src.indexOf("supabase.auth.onAuthStateChange(");
  if (start === -1) return "";
  const open = src.indexOf("(", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

describe("nothing calls supabase.auth from inside onAuthStateChange", () => {
  const body = authStateChangeCallback(SRC);

  it("finds the callback at all — guards against a vacuous pass", () => {
    expect(body.length).toBeGreaterThan(50);
    expect(SRC).toContain("onAuthStateChange");
  });

  it("the callback body contains no direct supabase.auth call", () => {
    // A deferred call (setTimeout / queueMicrotask) is fine and is how the
    // anonymous sign-in is done — the callback returns, the lock releases,
    // and the auth call runs afterwards.
    const directCalls: string[] = [];
    const re = /supabase\.auth\.(\w+)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const before = body.slice(Math.max(0, m.index - 220), m.index);
      const deferred = /setTimeout\s*\(|queueMicrotask\s*\(|requestAnimationFrame\s*\(|InteractionManager/.test(before);
      if (!deferred) directCalls.push(m[1]);
    }
    expect(directCalls).toEqual([]);
  });

  it("the anonymous sign-in specifically is deferred", () => {
    // The exact call that deadlocked. If someone un-defers it, this fails.
    const i = SRC.indexOf("supabase.auth.signInAnonymously");
    expect(i).toBeGreaterThan(-1);
    // Look back to the guard that precedes it, so an explanatory comment of
    // any length between them does not break the check.
    const guard = SRC.lastIndexOf("anonymousSignInInFlight.current = true", i);
    expect(guard).toBeGreaterThan(-1);
    expect(SRC.slice(guard, i)).toMatch(/setTimeout\s*\(/);
  });

  it("the check can actually fail", () => {
    // A direct call in a callback body must be detected, or this guard is
    // decoration.
    const sample = `supabase.auth.onAuthStateChange((event, s) => { supabase.auth.signInAnonymously(); })`;
    const b = authStateChangeCallback(sample);
    const found = /supabase\.auth\.\w+\s*\(/.test(b);
    expect(found).toBe(true);
  });
});
