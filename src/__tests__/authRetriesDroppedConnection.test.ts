// #134 — 12 Nov 2026 simulator: a sign-in POST after an idle minute failed with -1005 ("connection lost");
// iOS does not retry a POST itself. Each email sign-in call now gets exactly one quiet retry.
import { readFileSync } from "fs";
import { join } from "path";
import { isDroppedConnection, onceMoreIfDropped } from "../auth/retryDropped";

describe("a dropped connection gets one more try, nothing else does", () => {
  it("recognises a dropped request, not a refusal", () => {
    expect(isDroppedConnection({ name: "AuthRetryableFetchError", message: "Network request failed", status: 0 })).toBe(true);
    expect(isDroppedConnection(new TypeError("Network request failed"))).toBe(true);
    expect(isDroppedConnection({ name: "AuthApiError", message: "Invalid login credentials", status: 400 })).toBe(false);
    expect(isDroppedConnection(null)).toBe(false);
  });
  it("retries once on a dropped connection and returns the second answer", async () => {
    let n = 0;
    const r = await onceMoreIfDropped(async () => (++n === 1 ? { error: { name: "AuthRetryableFetchError", message: "Network request failed" } } : { error: null, ok: true }), 0);
    expect(n).toBe(2);
    expect(r.error).toBeNull();
  });
  it("never retries a real answer (wrong password stays one call)", async () => {
    let n = 0;
    const r = await onceMoreIfDropped(async () => { n++; return { error: { name: "AuthApiError", message: "Invalid login credentials" } }; }, 0);
    expect(n).toBe(1);
    expect((r.error as { message: string }).message).toMatch(/Invalid login/);
  });
  it("retries at most once", async () => {
    let n = 0;
    await onceMoreIfDropped(async () => { n++; return { error: { name: "AuthRetryableFetchError", message: "x" } }; }, 0);
    expect(n).toBe(2);
  });
  it("every email sign-in call in AuthContext goes through it", () => {
    const SRC = readFileSync(join(__dirname, "../auth/AuthContext.tsx"), "utf8");
    for (const call of ["verifyOtp", "signInWithPassword", "updateUser"]) {
      expect(SRC).toMatch(new RegExp(`onceMoreIfDropped\\(\\(\\) => supabase\\.auth\\.${call}\\(`));
    }
    expect(SRC).toMatch(/if \(!isDroppedConnection\(err\)\) throw err;[\s\S]{0,120}return ask\(\);/);
  });
});
