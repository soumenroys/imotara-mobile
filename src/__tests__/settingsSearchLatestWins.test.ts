// Dec release check (26 Nov 2026): a slow server answer for a half-typed query replaced the
// list for the full query ("Show connect" showed five unrelated settings). Latest search wins.
import * as fs from "fs";
import * as path from "path";
import { createLatestOnly } from "../lib/latestOnly";

describe("createLatestOnly", () => {
  it("an older search is stale once a newer one begins", () => {
    const l = createLatestOnly();
    const older = l.begin();
    const newer = l.begin();
    expect(l.isCurrent(older)).toBe(false);
    expect(l.isCurrent(newer)).toBe(true);
  });

  it("cancel makes every search stale (cleared box)", () => {
    const l = createLatestOnly();
    const t = l.begin();
    l.cancel();
    expect(l.isCurrent(t)).toBe(false);
  });

  it("simulates the race: slow answer for the old query arrives last and is dropped", async () => {
    const l = createLatestOnly();
    let shown = "";
    const search = async (q: string, delayMs: number) => {
      const token = l.begin();
      await new Promise((r) => setTimeout(r, delayMs));
      if (l.isCurrent(token)) shown = q;
    };
    await Promise.all([search("show c", 30), search("show connect", 0)]);
    expect(shown).toBe("show connect");
  });
});

describe("SettingsSearch uses the guard", () => {
  const src = fs
    .readFileSync(path.join(__dirname, "../components/imotara/SettingsSearch.tsx"), "utf8")
    .replace(/\/\/.*$/gm, "");
  const run = src.slice(src.indexOf("const runSearch"), src.indexOf("const handleChange"));

  it("takes a token first thing in runSearch", () => {
    const body = run.slice(run.indexOf("{") + 1).trim();
    expect(body.startsWith("const token = latestRef.current.begin();")).toBe(true);
  });

  it("every update after the server call is checked against the token", () => {
    const afterFetch = run.slice(run.indexOf("await fetchWithTimeout"));
    const firstSet = afterFetch.search(/set(Results|Loading)\(/);
    const firstCheck = afterFetch.indexOf("isCurrent(token)");
    expect(firstCheck).toBeGreaterThan(-1);
    expect(firstCheck).toBeLessThan(firstSet);
    expect(afterFetch).toMatch(/if \(latestRef\.current\.isCurrent\(token\)\) setLoading\(false\)/);
  });

  it("clearing the box cancels in-flight searches", () => {
    const clear = src.slice(src.indexOf("const handleClear"), src.indexOf("const handleSelect"));
    expect(clear).toContain("latestRef.current.cancel()");
  });
});
