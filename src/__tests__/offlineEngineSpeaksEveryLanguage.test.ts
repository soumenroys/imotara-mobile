/**
 * #48 (27 Nov 2026): the on-device (offline) reply engine answered greetings, "who are you"
 * and goodbyes in ENGLISH for several of the 22 languages — and did not even recognise a
 * goodbye in es fr pt ru zh ja ar he id. Each case must now come back in its own script/words.
 */
import { buildLocalReply } from "../lib/ai/local/localReplyEngine";

const reply = (m: string) => buildLocalReply(m).message;
const ENGLISH_GOODBYES = ["Take care", "Rest well", "Glad we got to talk", "Take good care"];
const SCRIPT: Record<string, RegExp> = {
  he: /[֐-׿]/, ja: /[぀-ヿ一-鿿]/, zh: /[一-鿿]/, ru: /[Ѐ-ӿ]/, ar: /[؀-ۿ]/,
};

describe("greetings", () => {
  it.each([["he", "שלום"], ["ja", "こんにちは"]])("[%s] %s ⇒ greeted in that script", (l, m) => {
    expect(reply(m)).toMatch(SCRIPT[l]);
  });
});

describe("goodbyes are recognised and answered in the same language", () => {
  it.each([
    ["es", "buenas noches", /Cuídate|Descansa|Me alegra|espacio/], ["fr", "bonne nuit", /Prends|Repose|Merci|espace/],
    ["pt", "boa noite", /cuida|Descanse|conversamos|espaço/], ["id", "selamat malam", /Jaga|Istirahat|Senang|Ruang/],
    ["ru", "спокойной ночи", SCRIPT.ru], ["zh", "晚安", SCRIPT.zh], ["ja", "おやすみ", SCRIPT.ja],
    ["ar", "تصبح على خير", SCRIPT.ar], ["he", "לילה טוב", SCRIPT.he],
  ])("[%s] %s", (_l, m, expected) => {
    const r = reply(m);
    expect(r).toMatch(expected as RegExp);
    for (const en of ENGLISH_GOODBYES) expect(r.startsWith(en)).toBe(false);
  });
  it("⚖️ Russian 'пока' inside a sentence (= 'yet/while') is not a goodbye", () => {
    expect(reply("пока не знаю, что делать")).not.toMatch(/Береги себя|Отдыхай|Хорошо, что мы поговорили|Это место всегда здесь/);
  });
});

describe("'who are you' is recognised and answered in the same language", () => {
  it.each([
    ["ru", "кто ты", SCRIPT.ru], ["zh", "你是谁", SCRIPT.zh], ["ja", "あなたは誰", SCRIPT.ja], ["he", "מי את", SCRIPT.he],
    ["pt", "quem é você", /Sou Imotara|Sou sua companheira/], ["mr", "tu kon aahes", /Mi Imotara|Mi tujhi/],
    ["kn", "neenu yaaru", /Naanu/], ["ml", "nee aaraanu", /Njaan/], ["gu", "tame kon cho", /Hu /], ["pa", "tusi kaun ho", /Main /], ["or", "tume kie", /Mu /],
  ])("[%s] %s", (_l, m, expected) => {
    expect(reply(m)).toMatch(expected as RegExp);
  });
});

describe("accented phrases are recognised (JS \\b ignores é ó à ê)", () => {
  it.each([["es", "adiós", /Cuídate|Descansa|Me alegra|espacio/], ["fr", "à demain", /Prends|Repose|Merci|espace/], ["pt", "até amanhã", /cuida|Descanse|conversamos|espaço/]])("[%s] %s", (_l, m, expected) => {
    expect(reply(m)).toMatch(expected as RegExp);
  });
  it("[es] quién eres ⇒ Spanish", () => {
    expect(reply("quién eres")).toMatch(/Soy/);
  });
});

describe("'how are you?' is answered in the language it was asked in (was English for everyone)", () => {
  const ROMAN = /^(Main|Ami|Mi|Naan|Nenu|Hu|Naanu|Njaan|Mu|Sach|Sotti|Khara|Unmaiya|Nijam|Saachu|Nija|Sathyam|Sata)\b/;
  it.each([
    ["hi", "kaise ho", ROMAN], ["hi", "आप कैसे हैं?", ROMAN], ["bn", "কেমন আছো", ROMAN], ["bn", "kemon acho", ROMAN],
    ["mr", "kasa aahes", ROMAN], ["ta", "எப்படி இருக்கீங்க", ROMAN], ["te", "ela unnaru", ROMAN], ["gu", "kem cho", ROMAN],
    ["pa", "ਕੀ ਹਾਲ ਹੈ", ROMAN], ["kn", "hegiddira", ROMAN], ["ml", "sukhamano", ROMAN], ["or", "kemiti achha", ROMAN],
    ["ur", "آپ کیسے ہیں", ROMAN], ["ar", "كيف حالك", /[؀-ۿ]/], ["he", "מה שלומך", /[֐-׿]/],
    ["ru", "как дела?", /[Ѐ-ӿ]/], ["zh", "你好吗", /[一-鿿]/], ["ja", "元気ですか", /[぀-ヿ]/],
    ["es", "¿cómo estás?", /Estoy|Aquí|La verdad/], ["fr", "ça va ?", /Ça va bien|Je suis là|Honnêtement/],
    ["de", "wie geht's?", /Mir geht's|Ich bin da|Ehrlich/], ["pt", "como vai", /Estou|Sinceramente/], ["id", "apa kabar", /Aku|Jujur/],
  ])("[%s] %s", (_l, m, expected) => {
    const r = reply(m);
    expect(r).toMatch(expected as RegExp);
    expect(r).not.toMatch(/^I'm (doing well|here and present|good)|^Honestly, I feel/);
  });
  it("English is unchanged", () => {
    expect(reply("how are you")).toMatch(/^(I'm doing well|I'm here and present|I'm good|Honestly, I feel)/);
  });
  it("⚖️ a longer sentence that merely contains the words is not small talk", () => {
    expect(reply("kaise ho sakta hai ki sab kuch itna bura ho gaya")).not.toMatch(/poochhne ke liye shukriya|achha lag raha hai\. Tumhare saath/);
  });
});
