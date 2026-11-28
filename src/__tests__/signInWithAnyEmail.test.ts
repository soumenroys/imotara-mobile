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
  it("Upgrade: 'Sign in with email' gets the sheet out of the way first (iOS cannot stack sheets)", () => {
    // 27 Nov 2026: it HIDES its Modal (stays mounted, so the purchase can resume) instead of
    // onClose(), which unmounted it — see purchaseFlowSafety.test.ts.
    const U = read("src/components/imotara/UpgradeSheet.tsx");
    expect(U).toMatch(/text: "Sign in with email", onPress: \(\) => signInWithEmailThenResume\(onSuccess\)/);
    expect(U).toMatch(/setHiddenForEmail\(true\);[\s\S]{0,600}setTimeout\(\(\) => openEmailSignIn\(\), \d+\);/);
    expect(U).toMatch(/<Modal visible=\{visible && !hiddenForEmail\}/);
  });
  it("Connect: Browse, Sessions, Wallet and the companion application all offer email", () => {
    const C = read("src/screens/connect/ConnectScreen.tsx");
    expect(C.split("onPress={() => openEmailSignIn()}").length - 1).toBe(4);
  });
});

describe("🔴 found in the 12 Nov simulator test: the companion form only asked for sign-in at the END", () => {
  it("signed out, 'Become a Companion' asks to sign in first — Google, Apple or email", () => {
    const C = read("src/screens/connect/ConnectScreen.tsx");
    const rv = C.slice(C.indexOf("function RegisterView("));
    const gate = rv.indexOf("if (!accessToken) {\n        return (");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(rv.indexOf("Step 1 — Profile & Contact"));
    const card = rv.slice(gate, rv.indexOf("return (\n        <KeyboardAvoidingView", gate));
    expect(card).toMatch(/Sign in to start your application/);
    expect(card).toContain("openEmailSignIn()");
  });
});

describe("🔴 found in the 12 Nov simulator test: the first tap was swallowed while a field was focused", () => {
  it("taps always reach the buttons; each action dismisses the keyboard itself", () => {
    expect(SHEET).toMatch(/<ScrollView keyboardShouldPersistTaps="always"/);
    for (const fn of ["sendCode", "verifyCode", "savePassword", "withPassword"]) {
      expect(SHEET).toMatch(new RegExp(`async function ${fn}\\(\\) \\{\\s*Keyboard\\.dismiss\\(\\);`));
    }
  });
});

// 12 Nov simulator: the reset screen said "Sign in", and the password box inherited the code box's
// letter-spacing (one native field reused across steps). Each field keyed; heading follows the step.
describe("email sheet: each step looks like itself", () => {
  const SRC = require("fs").readFileSync(require("path").join(__dirname, "../auth/EmailSignInSheet.tsx"), "utf8");
  it("every TextInput has its own key", () => {
    const inputs = SRC.match(/<TextInput[\s\S]*?\/>/g) ?? [];
    expect(inputs.length).toBeGreaterThanOrEqual(5);
    const keys = inputs.map((t: string) => (t.match(/key="([^"]+)"/) ?? [])[1]);
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("the heading names the step", () => {
    const { sheetTitle } = require("../auth/emailSheetSteps");
    expect(sheetTitle({ kind: "code-email", intent: "reset" })).toBe("Reset your password");
    expect(sheetTitle({ kind: "code-enter", email: "a@b.co", intent: "create" })).toBe("Create your account");
    expect(sheetTitle({ kind: "set-password", intent: "reset" })).toBe("Choose a new password");
    expect(sheetTitle({ kind: "password" })).toBe("Sign in with your email");
  });
});

describe("email sheet: a recycled field never keeps the code box's spacing", () => {
  it("the plain input style sets letterSpacing 0 and left alignment explicitly", () => {
    const SRC = require("fs").readFileSync(require("path").join(__dirname, "../auth/EmailSignInSheet.tsx"), "utf8");
    const input = (SRC.match(/\n\s{4}input: \{[\s\S]*?\n\s{4}\},/) ?? [""])[0];
    expect(input).toMatch(/letterSpacing: 0/);
    expect(input).toMatch(/textAlign: "left"/);
  });
});

describe("no TextInput style anywhere carries letterSpacing (recycled fields leak it app-wide)", () => {
  it("the code box is plain", () => {
    const SRC = require("fs").readFileSync(require("path").join(__dirname, "../auth/EmailSignInSheet.tsx"), "utf8");
    const code = (SRC.match(/codeInput: \{[^}]*\}/) ?? [""])[0];
    expect(code).not.toMatch(/letterSpacing: [1-9]/);
    expect(code).not.toMatch(/textAlign: "center"/);
  });
});
