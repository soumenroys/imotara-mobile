/**
 * U15 (mobile half) and U12 — the last two confirmed findings.
 *
 * ── U15: the streaming path had no client-side placeholder guard ────────
 * The JSON path has always rejected known-bad placeholder strings server-side.
 * The STREAMING path — the one BOTH clients try first — had no equivalent on
 * mobile, so a placeholder that reached the device was accepted as a real
 * reply and written into the person's history.
 *
 * ⚠️ The list is a deliberate COPY of web's badPlaceholderText.ts: React
 * Native cannot import from the web package. Two copies of one decision is
 * the drift that caused most of tonight's language bugs, so a test asserts
 * they still agree — which is the only honest way to keep a copy.
 *
 * ── U12: Azure gave up without trying the plain request ─────────────────
 * The styled body is the fragile part: `mstts:express-as` only accepts styles
 * the SPECIFIC voice supports, and Azure rejects the WHOLE request when it
 * does not. Azure also retires and renames voices. Either way the route went
 * straight to 502 and the person dropped to their device voice for the rest of
 * the reply, when the plain Azure voice would have worked.
 *
 * ⚠️ Severity bounded: a 502 does not leave them silent — both clients fall
 * back to the device voice, verified tonight. This recovers the BETTER voice.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(f, "utf8");
const MOBILE = path.join(process.cwd(), "src/api/aiClient.ts");
const WEB_BAD = "/Users/soumenroy/Projects/imotaraapp/src/lib/imotara/response/badPlaceholderText.ts";
const WEB_TTS = "/Users/soumenroy/Projects/imotaraapp/src/app/api/tts/route.ts";

const PHRASES = [
  "soft, placeholder reply",
  "I tried to connect to Imotara's AI engine",
  "but something went wrong",
];

describe("🔴 U15 — mobile rejects placeholder text on the streaming path", () => {
  const s = raw(MOBILE);

  it("every known placeholder phrase is checked", () => {
    for (const p of PHRASES) expect(s).toContain(p);
  });

  it("⛔ an empty reply is still rejected — that behaviour is unchanged", () => {
    expect(s).toMatch(/const t = text\.trim\(\);\s*\n\s*if \(!t\) return false;/);
  });

  it("🔑 the guard is on the path that actually runs", () => {
    // Three stream exits all route through isUsableReply.
    expect([...s.matchAll(/return \{ ok: isUsableReply\(accumulated\), text: accumulated \};/g)].length).toBe(3);
  });

  it("⚠️ the two copies of the list still AGREE — the only honest way to copy", () => {
    if (!fs.existsSync(WEB_BAD)) {
      console.warn("[lastTwo] ⚠️ SKIPPED the web half — sibling repo not checked out.");
      return;
    }
    // ⚠️ Jest's expect() takes no message argument (that is vitest) — and this
    // repo is Jest. Report the drift by naming the missing phrases instead.
    const web = raw(WEB_BAD);
    const missing = PHRASES.filter((p) => !web.includes(p));
    expect(missing).toEqual([]);
  });
});

describe("🔴 U12 — Azure retries plain before giving up", () => {
  it("there is a retry, and it drops the wrapper", () => {
    if (!fs.existsSync(WEB_TTS)) return;
    const s = raw(WEB_TTS);
    expect(s).toMatch(/if \(!azureRes\.ok && bodyXml !== escapedText\) \{/);
    expect(s).toMatch(/azureRes = await synthesize\(escapedText\);/);
  });

  it("⛔ a PLAIN request that failed is not retried — it would fail again", () => {
    // `bodyXml !== escapedText` is the whole guard: without it every genuine
    // outage would take twice as long for no benefit.
    if (!fs.existsSync(WEB_TTS)) return;
    expect(raw(WEB_TTS)).toMatch(/bodyXml !== escapedText/);
  });

  it("…and a still-failing retry ends in the same 502 as before", () => {
    if (!fs.existsSync(WEB_TTS)) return;
    const s = raw(WEB_TTS);
    const i = s.indexOf("if (!azureRes.ok && bodyXml !== escapedText)");
    expect(s.slice(i)).toMatch(/if \(!azureRes\.ok\) \{[\s\S]{0,400}?status: 502/);
  });

  it("🔑 the retry says WHY it happened, so a bad style can be found and fixed", () => {
    if (!fs.existsSync(WEB_TTS)) return;
    const s = raw(WEB_TTS);
    expect(s).toMatch(/retrying plain/);
    expect(s).toMatch(/plain retry SUCCEEDED — the style/);
  });
});
