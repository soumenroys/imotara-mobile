/**
 * 🆘 The crisis card's country follows where the person is (25 Oct 2026):
 * /api/chat-reply — the route the app actually uses — now sends the edge's
 * country, and the app must remember it from BOTH the stream and JSON replies.
 */
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "api", "aiClient.ts"), "utf8");

describe("the app remembers the server's country from chat-reply", () => {
  it("from the streamed meta event, in both stream readers", () => {
    const calls = src.match(/const parsed = JSON\.parse\(data\);\s*noteServerCountry\(parsed\);/g) ?? [];
    expect(calls.length).toBe(2);
  });
  it("from a JSON chat-reply reply", () => {
    expect(src).toMatch(/noteServerCountry\(chatData\);\s*const chatReplyText/);
  });
  it("hands it to resolveCrisisCountry, never blocking the reply", () => {
    expect(src).toMatch(/function noteServerCountry[\s\S]{0,200}void rememberServerCountry\(c\)/);
  });
});
