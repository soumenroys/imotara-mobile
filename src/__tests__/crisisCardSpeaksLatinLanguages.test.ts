/**
 * #48 (27 Nov 2026): twin of the web test — Spanish, French, German, Portuguese and
 * Indonesian get their own crisis card; English writers keep English; the phone's language
 * decides only when the text cannot.
 */
import { crisisCardLangFor } from "../lib/safety/crisisCardLang";
import { detectLatinLang } from "../lib/lang/latinLang";
const pick = (pref: string | null, text: string, device: string | null = null) => crisisCardLangFor(pref, [text], device);

const LATIN: Array<[string, string]> = [
    ["es", "ya no quiero vivir"],
    ["es", "estoy pensando en suicidarme"],
    ["es", "quiero quitarme la vida"],
    ["fr", "je ne veux plus vivre"],
    ["fr", "je pense au suicide"],
    ["fr", "j'ai envie de me tuer"],
    ["de", "ich will nicht mehr leben"],
    ["de", "ich denke an Selbstmord"],
    ["de", "ich will mich umbringen"],
    ["pt", "não quero mais viver"],
    ["pt", "estou pensando em me matar"],
    ["pt", "quero tirar minha vida"],
    ["id", "aku tidak ingin hidup lagi"],
    ["id", "aku ingin bunuh diri"],
    ["es", "quiero morir"],
    ["fr", "je veux mourir"],
    ["de", "ich will sterben"],
    ["pt", "quero morrer"],
    ["id", "saya ingin mati"],
];
const ENGLISH: string[] = ["I don't want to live anymore", "I'm going to kill myself", "thinking about ending my life", "everyone would be better off without me", "I cut myself again tonight", "I want to die"];

describe("the crisis card speaks Spanish, French, German, Portuguese and Indonesian", () => {
  it.each(LATIN)("[%s] %s", (lang, p) => {
    expect(pick(null, p)).toBe(lang);
    expect(pick("auto", p, "en-US")).toBe(lang);
  });
});

describe("⛔ English stays English", () => {
  it.each(ENGLISH)("%s — even on a Hindi or Spanish phone", (p) => {
    expect(detectLatinLang(p)).toBeNull();
    expect(pick(null, p, "hi-IN")).toBe("en");
    expect(pick(null, p, "es-ES")).toBe("en");
  });
});

describe("when the text cannot tell, the phone's language decides", () => {
  it("unclear text: Spanish phone ⇒ Spanish; no phone language ⇒ English", () => {
    expect(pick(null, "ok", "es-ES")).toBe("es");
    expect(pick(null, "ok", null)).toBe("en");
  });
  it("a stated choice still wins", () => {
    expect(pick("hi", "ya no quiero vivir", "es-ES")).toBe("hi");
  });
  it("script languages are unchanged", () => {
    expect(pick(null, "আমি মরতে চাই", "es-ES")).toBe("bn");
  });
});
