/**
 * #48 (27 Nov 2026): the crisis card and the reply's crisis rules must catch how people
 * ACTUALLY say it — in all 22 languages — not only the detector's own vocabulary.
 *
 * 🔴 Measured that day with these 59 natural phrasings: 21 showed NO crisis card (web and
 * app), 26 did not switch on the reply's crisis-safety rules. Now 0 and 0.
 * ⚖️ The 30 everyday idioms below ("this exam is killing me", "me muero de risa",
 * "我想死你了" = I miss you so much) must NOT be flagged by the new list.
 * ⛔ Same file in imotaraapp and imotara-mobile. A failure means someone saying they want
 * to die is shown nothing.
 */
import { isCrisisTier2, CRISIS_HINT_REGEX, CRISIS_NATURAL_PHRASES_REGEX } from "../lib/emotion/keywordMaps";


const NATURAL: Array<[string, string]> = [
    ["en", "I don't want to live anymore"],
    ["en", "I'm going to kill myself"],
    ["en", "thinking about ending my life"],
    ["en", "everyone would be better off without me"],
    ["en", "I cut myself again tonight"],
    ["hi", "मैं अब जीना नहीं चाहती"],
    ["hi", "मैं खुद को मार डालूँगा"],
    ["hi", "अपनी ज़िंदगी खत्म करने के बारे में सोच रहा हूँ"],
    ["hi", "आत्महत्या करने का मन कर रहा है"],
    ["bn", "আমি আর বাঁচতে চাই না"],
    ["bn", "নিজেকে শেষ করে দিতে ইচ্ছে করছে"],
    ["bn", "আত্মহত্যা করার কথা ভাবছি"],
    ["bn", "মরে গেলেই ভালো হতো"],
    ["mr", "मला आता जगायचं नाही"],
    ["mr", "मी आत्महत्या करणार आहे"],
    ["mr", "जीव द्यावासा वाटतोय"],
    ["ta", "எனக்கு வாழ விருப்பமில்லை"],
    ["ta", "தற்கொலை செய்துக்கொள்ளலாம்னு தோணுது"],
    ["ta", "செத்துப் போயிடலாம்னு இருக்கு"],
    ["te", "నాకు బతకాలని లేదు"],
    ["te", "ఆత్మహత్య చేసుకోవాలని అనిపిస్తోంది"],
    ["te", "చచ్చిపోవాలని ఉంది"],
    ["gu", "મારે હવે જીવવું નથી"],
    ["gu", "આત્મહત્યા કરવાનું મન થાય છે"],
    ["pa", "ਮੈਂ ਹੁਣ ਜੀਣਾ ਨਹੀਂ ਚਾਹੁੰਦੀ"],
    ["pa", "ਖੁਦਕੁਸ਼ੀ ਕਰਨ ਨੂੰ ਦਿਲ ਕਰਦਾ ਹੈ"],
    ["kn", "ನನಗೆ ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ"],
    ["kn", "ಆತ್ಮಹತ್ಯೆ ಮಾಡಿಕೊಳ್ಳಬೇಕು ಅನಿಸುತ್ತಿದೆ"],
    ["ml", "എനിക്ക് ജീവിക്കണ്ട"],
    ["ml", "ആത്മഹത്യ ചെയ്യാൻ തോന്നുന്നു"],
    ["or", "ମୁଁ ଆତ୍ମହତ୍ୟା କରିବି"],
    ["or", "ମରିଯିବାକୁ ଇଚ୍ଛା ହେଉଛି"],
    ["ur", "میں اب جینا نہیں چاہتی"],
    ["ur", "خودکشی کرنے کا دل کر رہا ہے"],
    ["ar", "لا أريد أن أعيش بعد الآن"],
    ["ar", "أفكر في الانتحار"],
    ["he", "אני לא רוצה לחיות יותר"],
    ["he", "אני חושבת על התאבדות"],
    ["ru", "я больше не хочу жить"],
    ["ru", "думаю о самоубийстве"],
    ["ru", "хочу покончить с собой"],
    ["zh", "我不想活了"],
    ["zh", "我想自杀"],
    ["ja", "もう生きていたくない"],
    ["ja", "自殺したい"],
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
];

const IDIOMS: Array<[string, string]> = [
    ["en", "this exam is killing me"],
    ["en", "I'm dying to see you"],
    ["en", "I'd kill for a coffee right now"],
    ["en", "that joke killed me"],
    ["en", "I could just die of embarrassment"],
    ["hi", "ये गर्मी मुझे मार डालेगी"],
    ["hi", "हँसते-हँसते मर गया"],
    ["bn", "হাসতে হাসতে মরে গেলাম"],
    ["bn", "গরমে মরে যাচ্ছি"],
    ["es", "me muero de risa"],
    ["es", "este examen me va a matar"],
    ["es", "me mata el calor"],
    ["pt", "essa prova vai me matar"],
    ["pt", "morrendo de rir"],
    ["pt", "esse calor vai me matar"],
    ["fr", "ça me tue"],
    ["fr", "je meurs de faim"],
    ["fr", "mort de rire"],
    ["de", "der Stress bringt mich noch um"],
    ["de", "ich sterbe vor Hunger"],
    ["ru", "умираю со смеху"],
    ["ru", "этот экзамен меня убьёт"],
    ["zh", "笑死我了"],
    ["zh", "热死了"],
    ["zh", "我想死你了"],
    ["ja", "死ぬほど笑った"],
    ["ja", "お腹空いて死にそう"],
    ["id", "mati ketawa"],
    ["ar", "سأموت من الضحك"],
    ["he", "אני מת מצחוק"],
];

describe("natural ways of saying it are caught in every language", () => {
  it("covers all 22 languages", () => {
    expect(new Set(NATURAL.map(([l]) => l)).size).toBe(22);
  });
  it.each(NATURAL)("[%s] %s → crisis card", (_l, p) => {
    expect(isCrisisTier2(p)).toBe(true);
  });
  it.each(NATURAL)("[%s] %s → shared crisis regex (reply safety, fallback, logging)", (_l, p) => {
    expect(CRISIS_HINT_REGEX.test(p)).toBe(true);
  });
});

describe("⚖️ everyday idioms are not made into crises by the new list", () => {
  it.each(IDIOMS)("[%s] %s", (_l, p) => {
    expect(CRISIS_NATURAL_PHRASES_REGEX.test(p)).toBe(false);
  });
  it("'I miss you so much' in Chinese is not a crisis — on ANY list; 'I want to die' stays caught", () => {
    // 27 Nov 2026 (owner OK): the ORIGINAL list matched "我想死你了" (= I miss you so much) and showed
    // the crisis card. Narrowed to the same guard as the new list: 想死 followed by 你/您/他/她/它 is
    // "miss someone". Nothing else about the Chinese crisis phrases changed.
    for (const miss of ["我想死你了", "我想死您了", "我好想死你啊", "我想死他了", "我想死她了"]) {
      expect(CRISIS_NATURAL_PHRASES_REGEX.test(miss)).toBe(false);
      expect(CRISIS_HINT_REGEX.test(miss)).toBe(false);
      expect(isCrisisTier2(miss)).toBe(false);
    }
    for (const die of ["我想死", "我想死了", "我真的想死", "我不想活了", "我想自杀", "想死，活不下去了"]) {
      expect(isCrisisTier2(die)).toBe(true);
      expect(CRISIS_HINT_REGEX.test(die)).toBe(true);
    }
  });
});
