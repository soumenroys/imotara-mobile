// #44 (27 Nov 2026): the app's OFFLINE reply to a crisis message names the person's own
// helpline, in their language, in all 22 languages — same words as the web's built-in reply.
// Before: the offline engine had no crisis path at all (ordinary sad/anxious reply).

let mockCountry: string | null = "IN";
jest.mock("../lib/safety/resolveCrisisCountry", () => ({ resolveCrisisCountry: () => mockCountry }));

import { buildLocalReply } from "../lib/ai/local/localReplyEngine";
import { getCrisisResourcesForCountry } from "../lib/safety/crisisResources";
import { LOCAL_CRISIS_LINES, CRISIS_HELPLINE_LEAD } from "../lib/safety/crisisLocalReply";

const CRISIS: Array<[string, string]> = [
  ["en", "I want to kill myself"],
  ["hi", "मैं मरना चाहता हूँ"],
  ["bn", "আমি মরতে চাই"],
  ["mr", "मला मरायचंय"],
  ["gu", "મારે મરવું છે"],
  ["kn", "ನನಗೆ ಸಾಯಬೇಕು"],
  ["ta", "எனக்கு தற்கொலை எண்ணம் வருகிறது"],
  ["te", "నేను చనిపోవాలి"],
  ["ml", "എനിക്ക് മരിക്കണം"],
  ["pa", "ਮੈਂ ਮਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ"],
  ["ur", "میں مرنا چاہتا ہوں"],
  ["ar", "أريد أن أموت"],
  ["he", "אני רוצה למות"],
  ["zh", "我想自杀"],
  ["ja", "死にたい"],
  ["es", "quiero morir"],
  ["fr", "je veux mourir"],
  ["pt", "quero morrer"],
  ["de", "ich will sterben"],
  ["ru", "я хочу умереть"],
  ["id", "saya ingin mati"],
  ["or", "mu marajaiba"],
];

const NOT_CRISIS = ["how are you?", "I feel a bit tired today", "aaj office mein bahut kaam tha", "我想死你了", "今日は疲れた", "hoy estoy cansado"];

describe("offline crisis reply names the person's own helpline", () => {
  for (const country of ["IN", "US", null] as const) {
    for (const [lang, msg] of CRISIS) {
      it(`${lang} · ${country ?? "unknown country"}`, () => {
        mockCountry = country;
        const reply = buildLocalReply(msg, undefined, { preferredLang: lang }).message;
        const line = getCrisisResourcesForCountry(country).primary[0];
        expect(reply).toContain(line.contact);
        expect(reply).toContain(line.label);
      });
    }
  }

  it("unknown country ⇒ findahelpline.com, never India's number", () => {
    mockCountry = null;
    const reply = buildLocalReply("I want to kill myself", undefined, {}).message;
    expect(reply).toContain("findahelpline.com");
    expect(reply).not.toContain("14416");
  });

  it("English: helpline before the question", () => {
    mockCountry = "US";
    const reply = buildLocalReply("should I kill myself?", undefined, {}).message;
    const at = reply.indexOf("988");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(reply.lastIndexOf("?"));
  });

  for (const msg of NOT_CRISIS) {
    it(`not a crisis: "${msg}"`, () => {
      mockCountry = "IN";
      const reply = buildLocalReply(msg, undefined, {}).message;
      expect(reply).not.toContain("14416");
      expect(reply).not.toContain("Tele-MANAS");
    });
  }

  it("every language has its own lines and lead-in (same tables as the web)", () => {
    for (const [lang] of CRISIS.filter(([l]) => l !== "en")) {
      expect(LOCAL_CRISIS_LINES[lang]).toBeDefined();
      expect(CRISIS_HELPLINE_LEAD[lang]).toBeDefined();
    }
    // spot-pins of the corrected lines (must match web runImotara.ts)
    expect(LOCAL_CRISIS_LINES.gu[0]).toBe("અત્યારે તું ઘણી ભારે જગ્યા પર છે. હું ખરેખર સાથે છું.");
    expect(LOCAL_CRISIS_LINES.or[0]).toBe("ତୁ ଏବେ ବହୁତ ଭାରୀ ଜାଗାରେ ଅଛୁ। ମୁଁ ସତରେ ତୋ ସହିତ ଅଛି।");
  });
});
