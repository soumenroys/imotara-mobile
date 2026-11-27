// #44 (27 Nov 2026): Roman Urdu and Arabizi reply language — same cases as the web's
// replyLangJapaneseUrduArabizi.test.ts, so the two platforms cannot drift.
import { resolveReplyLang } from "../api/aiClient";

const auto = (t: string) => resolveReplyLang(t, "auto");

describe("Roman Urdu", () => {
  it.each([
    "mujhe bohat dukh hai yaar",
    "ammi se baat hui, dil udaas hai",
    "kyunke main thak gaya hoon, kuch samajh nahi aa raha",
    "inshallah sab theek hoga, abhi bohot pareshan hoon",
  ])("%s ⇒ ur", (t) => expect(auto(t)).toBe("ur"));

  it.each([
    ["mujhe bahut dard hai", "hi"],
    ["aaj office mein bahut kaam tha yaar", "hi"],
    ["Inshallah it will be fine tomorrow", "en"],
    ["My mom made biryani today, mashallah it was great", "en"],
  ])("%s ⇒ %s (unchanged)", (t, want) => expect(auto(t)).toBe(want));
});

describe("Arabizi", () => {
  it.each([
    "ana ta3ban kteer",
    "ya3ni msh 3arif eh el moshkela",
    "habibi ana za3lan awi",
    "wallah ana mabsoot",
  ])("%s ⇒ ar", (t) => expect(auto(t)).toBe("ar"));

  it.each([
    "I'm 3 years into my job and tired",
    "web3 and b2b sales are stressful",
    "Ana is my best friend",
    "yalla let's go, I am so tired today",
    "I feel really low today",
  ])("%s ⇒ en (unchanged)", (t) => expect(auto(t)).toBe("en"));
});

describe("unchanged", () => {
  it("a stated language still wins", () => {
    expect(resolveReplyLang("ana ta3ban kteer", "en")).toBe("en");
    expect(resolveReplyLang("mujhe bohat dukh hai", "hi")).toBe("hi");
  });
  it("native scripts unchanged", () => {
    expect(auto("今日は気分が悪い")).toBe("ja");
    expect(auto("我很累")).toBe("zh");
    expect(auto("আমি ক্লান্ত")).toBe("bn");
    expect(auto("أنا تعبان")).toBe("ar");
  });
});
