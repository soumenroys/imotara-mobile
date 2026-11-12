// src/__tests__/signInWithAnyEmail.test.ts
// 🔑 #134 (owner, 12 Nov 2026): the app signs in with ANY email — a code from our own mailbox, or a
// password — exactly like the website, from every sign-in place. And #135: a guest's chats on this
// phone join the account on sign-in (the app switched to a different account and nothing joined them).
import { readFileSync } from "fs";
import path from "path";

const read = (rel: string) => readFileSync(path.join(__dirname, "..", "..", rel), "utf8");
const AUTH = read("src/auth/AuthContext.tsx");
const SHEET = read("src/auth/EmailSignInSheet.tsx");

describe("codes come from OUR server (same route as the website), checked as email codes", () => {
  it("requests the code from /api/auth/email-code", () => {
    expect(AUTH).toMatch(/buildApiUrl\("\/api\/auth\/email-code"\)/);
  });
  it("verifies with supabase.auth.verifyOtp type 'email' — never signInWithOtp / signUp (Supabase's own mail)", () => {
    expect(AUTH).toMatch(/supabase\.auth\.verifyOtp\(\{[^}]*type: "email" \}\)/);
    expect(AUTH).not.toMatch(/signInWithOtp\(|auth\.signUp\(/);
  });
  it("a password is chosen only after a code proved the address (updateUser)", () => {
    expect(AUTH).toMatch(/supabase\.auth\.updateUser\(\{ password \}\)/);
    expect(SHEET).toMatch(/if \(step\.intent !== "signin"\) \{ setPassword\(""\); setStep\(\{ kind: "set-password"/);
  });
  it("accepts the code as Supabase makes it (8 digits here) — never a fixed 6", () => {
    expect(SHEET).toMatch(/digits\.length < CODE_MIN \|\| digits\.length > CODE_MAX/);
    expect(SHEET).not.toMatch(/6-digit/);
  });
});

describe("#135 — the guest's chats join the account on sign-in", () => {
  it("remembers the guest account's token while it is the guest", () => {
    expect(AUTH).toMatch(/if \(s\?\.user\?\.is_anonymous\) \{\s*lastGuestTokenRef\.current = s\.access_token;/);
  });
  it("on a real SIGNED_IN, asks the server to move them — with the guest token as proof", () => {
    expect(AUTH).toMatch(/if \(guestToken && _event === "SIGNED_IN"\)/);
    expect(AUTH).toMatch(/buildApiUrl\("\/api\/history\/claim"\)/);
    expect(AUTH).toMatch(/JSON\.stringify\(\{ anonymousToken: guestToken \}\)/);
  });
  it("⛔ a plain fetch — no supabase.auth.* inside the auth callback (deadlock)", () => {
    const start = AUTH.indexOf("supabase.auth.onAuthStateChange(");
    const cb = AUTH.slice(start + "supabase.auth.onAuthStateChange(".length, AUTH.indexOf("return () => {", start))
      .replace(/^\s*\/\/.*$/gm, ""); // comments may NAME the rule
    expect(start).toBeGreaterThan(-1);
    expect(cb).not.toMatch(/supabase\.auth\./);
  });
});

describe("every sign-in place offers email", () => {
  it("the sheet is mounted once at the root", () => {
    expect(read("App.tsx")).toContain("<EmailSignInSheet />");
  });
  it("'Remember you' sheet: Continue with email — slides away first, and is NOT remembered as 'Not now'", () => {
    const P = read("src/auth/SignInPrompt.tsx");
    const fn = P.slice(P.indexOf("const handleEmail"), P.indexOf("const handleApple"));
    expect(fn).toContain("openEmailSignIn()");
    expect(fn).not.toContain("AsyncStorage.setItem");
  });
  it("Settings: Apple and email beside the Google button", () => {
    const S = read("src/screens/SettingsScreen.tsx");
    expect(S).toContain("onPress={() => openEmailSignIn()}");
    expect(S).toMatch(/Continue with Apple/);
  });
  it("Upgrade: 'Sign in with email' closes the sheet first (iOS cannot stack sheets)", () => {
    const U = read("src/components/imotara/UpgradeSheet.tsx");
    expect(U).toMatch(/text: "Sign in with email", onPress: \(\) => \{ onClose\(\); setTimeout\(\(\) => openEmailSignIn\(\), \d+\); \}/);
  });
  it("Connect: Browse, Sessions and Wallet all offer email", () => {
    const C = read("src/screens/connect/ConnectScreen.tsx");
    expect(C.split("onPress={() => openEmailSignIn()}").length - 1).toBe(3);
  });
});
