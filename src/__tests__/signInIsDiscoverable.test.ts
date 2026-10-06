/**
 * Signing in must be findable by someone who has never had a plan.
 *
 * 🔴 WHAT THIS IS NOT. It is NOT guarding a truthiness bug. A previous
 * diagnosis claimed "a guest can never see a Sign in button" because
 * ChatScreen renders `user ? "Sign out…" : "Sign in"` and an anonymous session
 * was assumed to make `user` truthy. That was WRONG:
 *
 *     AuthContext.tsx:391   user: session?.user ?? null
 *     AuthContext.tsx:127   if (s?.user?.is_anonymous) { setSession(null); … }
 *
 * Anonymous sessions are routed to anonymousToken and `session` is set to null,
 * so `user` is ALREADY null for a guest and the label ALREADY says "Sign in".
 * The first test below pins that, so the false diagnosis cannot be re-filed.
 *
 * ✅ THE REAL FINDING was discoverability, and a web↔mobile parity gap:
 *   web    — a plain "Sign in", five times in SiteHeader plus settings
 *   mobile — the ••• chat overflow menu, and a Settings button that read
 *            "Sign in to restore your plan"
 * Framed that way, the only sign-in affordance on the Settings screen looks
 * irrelevant to anyone who never had a plan — which is exactly an NGO or school
 * member joining their organisation, on exactly the screen they look on.
 * The owner hit this live: "i am not finding sign in button".
 */

import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const AUTH = () => read("src/auth/AuthContext.tsx");
const SETTINGS = () => stripComments(read("src/screens/SettingsScreen.tsx"));
const CHAT = () => stripComments(read("src/screens/ChatScreen.tsx"));

describe("a guest is genuinely signed-OUT as far as the UI is concerned", () => {
  it("AuthContext derives user from session, not from the raw auth user", () => {
    expect(AUTH()).toMatch(/user:\s*session\?\.user\s*\?\?\s*null/);
  });

  it("an anonymous session nulls `session`, so `user` is null for guests", () => {
    const s = AUTH();
    const i = s.indexOf("is_anonymous");
    expect(i).toBeGreaterThan(-1);
    // Within the anonymous branch, session must be cleared.
    expect(s.slice(i, i + 400)).toContain("setSession(null)");
  });

  it("⇒ the chat menu therefore already offers 'Sign in' to a guest", () => {
    // Pins the CORRECT behaviour so the false "guests only ever see Sign out"
    // diagnosis cannot be re-filed as a bug.
    expect(CHAT()).toContain('"Sign in"');
  });
});

describe("Settings offers a sign-in a non-subscriber can recognise", () => {
  it("has a sign-in affordance at all, shown when signed out", () => {
    const s = SETTINGS();
    expect(s).toContain("signInWithGoogle");
    expect(s).toMatch(/!accessToken/);
  });

  it("the label LEADS with 'Sign in', not with plan restoration", () => {
    // "Sign in to restore your plan" is invisible to someone who never had a
    // plan — an org member joining their NGO is exactly that person.
    const s = SETTINGS();
    expect(s).toContain("Sign in or restore your plan");
    expect(s).not.toContain("Sign in to restore your plan");
  });

  it("still mentions restoring, for a returning subscriber", () => {
    // Do not solve one audience by losing the other.
    expect(SETTINGS()).toMatch(/Sign in or restore your plan/);
  });
});
