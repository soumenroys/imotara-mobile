/**
 * 💳 The upgrade sheet treats a guest (anonymous session) as signed OUT (25 Oct 2026),
 * so a guest is asked to sign in before paying or restoring — never charged onto an
 * identity that vanishes on reinstall.
 */
import { readFileSync } from "fs";
import { join } from "path";
const s = readFileSync(join(__dirname, "..", "components", "imotara", "UpgradeSheet.tsx"), "utf8");

describe("upgrade sheet: guests are signed out for payments", () => {
  it("one rule decides it", () => expect(s).toMatch(/return !!session\?\.access_token && session\.user\?\.is_anonymous !== true;/));
  it("no raw 'has a token' check decides signed-in any more", () => {
    expect(s).not.toMatch(/setIsSignedIn\(!!session\?\.access_token\)/);
    expect(s).not.toMatch(/event === "SIGNED_IN" && session\?\.access_token/);
  });
  it("restore asks a guest to sign in", () => expect(s).toMatch(/if \(!session \|\| !isRealAccount\(session\)\) \{\s*Alert\.alert\("Sign in required", "Please sign in to restore your purchases\."\);/));
});
