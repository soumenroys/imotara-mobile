// 28 Nov 2026 (1.7.4 emulator test): an on-device reply showed twice — the history rebuild
// already held it (same id) and the send flow appended it again. Also: the "Join Imotara
// Movement" card (a Connect entry point) only shows when Show Connect is on (#108).
import fs from "fs";
import path from "path";
import { appendOnce } from "../lib/chat/appendOnce";

type M = { id: string; text: string; seed?: string };

describe("appendOnce", () => {
  it("a reply already in the list (same id) is updated in place, never added twice", () => {
    const prev: M[] = [{ id: "u-1", text: "hi" }, { id: "b-2", text: "reply" }];
    const next = appendOnce(prev, [{ id: "b-2", text: "reply", seed: "Reflection" }]);
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ id: "b-2", text: "reply", seed: "Reflection" });
  });
  it("new ids are appended in order", () => {
    const next = appendOnce<M>([{ id: "u-1", text: "hi" }], [{ id: "q", text: "" }, { id: "b-2", text: "r" }, { id: "inv", text: "" }]);
    expect(next.map((m) => m.id)).toEqual(["u-1", "q", "b-2", "inv"]);
  });
  it("nothing to add ⇒ same array", () => {
    const prev: M[] = [{ id: "a", text: "" }];
    expect(appendOnce(prev, [])).toBe(prev);
  });
});

describe("ChatScreen and Settings use it", () => {
  const chat = fs.readFileSync(path.join(__dirname, "../screens/ChatScreen.tsx"), "utf8");
  const settings = fs.readFileSync(path.join(__dirname, "../screens/SettingsScreen.tsx"), "utf8");
  it("every reply append goes through appendOnce", () => {
    expect(chat).toMatch(/setMessages\(\(prev\) => appendOnce\(prev, \[\.\.\.extraMessages, botMessage, \.\.\.trailing\]\)\)/);
    expect(chat).toMatch(/setMessages\(\(prev\) => appendOnce\(prev, \[botMessage\]\)\)/);
    expect(chat).toMatch(/setMessages\(\(prev\) => appendOnce\(prev, \[safetyMsg\]\)\)/);
    expect(chat).not.toMatch(/setMessages\(\(prev\) => \[\.\.\.prev, (botMessage|safetyMsg|\.\.\.extraMessages)/);
  });
  it("the Join Imotara Movement card is behind Show Connect", () => {
    const i = settings.indexOf("Join Imotara Movement");
    const block = settings.slice(i, i + 600);
    expect(block).toMatch(/\{showConnect && \(/);
  });
});
