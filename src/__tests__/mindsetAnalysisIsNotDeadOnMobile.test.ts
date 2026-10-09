/**
 * A 401 must not be rendered as "nothing to say about you".
 *
 * 🔴 U5 of the 2026-10-09 audit, VERIFIED 2026-10-10 by reading both cited
 * lines. Both were exactly as reported, and together they made mobile's
 * "Psychological Insight" 100% DEAD — silently.
 *
 *   web   api/mindset-analysis/route.ts   cookie-only auth ⇒ 401 for mobile
 *   mobile HistoryScreen.tsx              sent no Authorization header
 *   mobile HistoryScreen.tsx              data.analysis ?? ""  ⇐ the 401 body
 *
 * ⚠️ THE THIRD LINE IS WHAT HID IT. `r.json()` was called unconditionally, so
 * the error body `{error:"Unauthorized"}` became `{analysis: undefined}`, and
 * `?? ""` turned that into an empty SUCCESS which was then CACHED. An outage,
 * an expired session, and "we have nothing to say about you" all looked
 * identical — and all looked fine.
 *
 * 🔑 Three independent things had to be wrong for a user to see nothing, and
 * none of them logged anything. That is why it survived.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(f, "utf8");
const MOBILE = path.join(process.cwd(), "src/screens/HistoryScreen.tsx");
const WEB = "/Users/soumenroy/Projects/imotaraapp/src/app/api/mindset-analysis/route.ts";

describe("🔴 mobile actually authenticates", () => {
  const s = raw(MOBILE);

  it("the request carries a Bearer token", () => {
    const i = s.indexOf('buildApiUrl("/api/mindset-analysis")');
    expect(i).toBeGreaterThan(-1);
    expect(s.slice(i, i + 700)).toMatch(/Authorization: `Bearer \$\{accessToken\}`/);
  });

  it("🔑 …and the token is a real dependency, not a stale closure", () => {
    // Without accessToken in the deps this callback closes over the token as
    // it was at mount — null before auth resolves — and the request goes out
    // unauthenticated again while the call site still looks correct.
    expect(s).toMatch(/\}, \[expandedCapsules, capsuleInsights, history, accessToken\]\);/);
  });

  it("the screen can see the token at all", () => {
    expect(s).toMatch(/import \{ useAuth \} from "\.\.\/auth\/AuthContext";/);
    expect(s).toMatch(/const \{ accessToken \} = useAuth\(\);/);
  });
});

describe("🔴 a failure is no longer rendered as an empty success", () => {
  const s = raw(MOBILE);

  it("a non-OK response throws instead of being parsed as data", () => {
    const i = s.indexOf('buildApiUrl("/api/mindset-analysis")');
    const block = s.slice(i, i + 1400);
    expect(block).toMatch(/if \(!r\.ok\) throw new Error\(`mindset-analysis HTTP \$\{r\.status\}`\);/);
  });

  it("⛔ r.json() is no longer called unconditionally", () => {
    const i = s.indexOf('buildApiUrl("/api/mindset-analysis")');
    const block = s.slice(i, i + 1400);
    expect(block).not.toMatch(/\.then\(\(r\) => r\.json\(\)\)/);
  });

  it("…and the error state is still reachable", () => {
    const i = s.indexOf('buildApiUrl("/api/mindset-analysis")');
    expect(s.slice(i, i + 1800)).toMatch(/\.catch\(\(\) => setCapsuleInsights\(\(v\) => \(\{ \.\.\.v, \[key\]: "error" \}\)\)\)/);
  });
});

describe("🔴 the web route accepts what mobile sends", () => {
  it("Bearer token OR cookie — the same contract as api/license/status", () => {
    if (!fs.existsSync(WEB)) {
      console.warn("[mindsetAnalysis] ⚠️ SKIPPED the web half — sibling repo not checked out.");
      return;
    }
    const s = raw(WEB);
    expect(s).toMatch(/req\.headers\.get\("authorization"\)\?\.replace\(\/\^Bearer\\s\+\/i, ""\)\.trim\(\)/);
    expect(s).toMatch(/getSupabaseAdmin\(\)\.auth\.getUser\(bearer\)/);
    // the cookie path must survive for web callers
    expect(s).toMatch(/await supabaseUserServer\(\)/);
  });

  it("⛔ and it still 401s when NEITHER is present", () => {
    if (!fs.existsSync(WEB)) return;
    expect(raw(WEB)).toMatch(/if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);/);
  });
});
