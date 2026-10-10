/**
 * Mobile's half of "15 means 15 replies".
 *
 * The anonymous daily TTS quota counts requests, and a reply is 3-4 of them,
 * so the limit delivered three to five spoken replies before everything fell
 * back to the device voice — reported from a physical iPhone 2026-10-10 as
 * the voice turning faint and expressionless.
 *
 * The server now counts only chunk 0. This pins that mobile actually sends
 * the index, and sends the REAL one.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
  path.join(process.cwd(), "src/lib/tts/mobileTTS.ts"), "utf8");

describe("🔴 mobile sends the chunk index", () => {
  it("it reaches the request body", () => {
    expect(SRC).toMatch(/typeof chunkIndex === "number" \? \{ chunkIndex \} : \{\}/);
  });

  it("…and is threaded from the real loop position", () => {
    expect(SRC).toMatch(/armedFetch\(chunks\[i\], i\)/);
    expect(SRC).toMatch(/armedFetch\(chunks\[nextIndex\], nextIndex\)/);
  });

  it("⛔ not a constant — that would restore the bug or hide the quota", () => {
    expect(SRC).not.toMatch(/armedFetch\(chunks\[i\], 0\)/);
    expect(SRC).not.toMatch(/armedFetch\(chunks\[nextIndex\], 0\)/);
  });

  it("🔑 a RETRY reuses the same index, so it is not a second reply", () => {
    // The timeout retry fetches the SAME chunk. Counting it again would make
    // a slow network cost the person two replies' worth of quota.
    const fn = SRC.slice(SRC.indexOf("const armedFetch = async"));
    const body = fn.slice(0, fn.indexOf("\n    };"));
    expect(body).toMatch(/armedFetchOnce\(chunkText, chunkIndex\)/);
    expect(body).not.toMatch(/armedFetchOnce\(chunkText, 0\)/);
  });

  it("⚖️ omitting it stays possible, and means 'count me as before'", () => {
    // The parameter is optional so older call paths cannot crash, and the
    // server treats absence as the old per-request counting.
    expect(SRC).toMatch(/chunkIndex\?: number,/);
  });
});
