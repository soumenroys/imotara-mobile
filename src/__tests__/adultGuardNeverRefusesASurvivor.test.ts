/**
 * 🔴 27 Nov 2026: a SURVIVOR must never be refused.
 *
 * The adult-content guard runs BEFORE the reply. Its English list blocked "rape",
 * "molestation", "sexual assault", "groping" and "pedophile", so "I survived sexual assault",
 * "he tried to rape me" or "my coach is a pedophile" got "That's not something I can help with
 * here". And many disclosures (Hindi, Bengali, German, Japanese, "he forced himself on me")
 * did not switch on the crisis rules at all.
 * Now: disclosures are never refused AND are recognised in all 22 languages; explicit requests
 * stay blocked; German / Hebrew / Japanese got word lists + refusal text; innocent sentences in
 * them are not blocked. Same file in imotaraapp and imotara-mobile.
 */

import { isCrisisTier2 } from "../lib/emotion/keywordMaps";
import { detectAdultContent, buildAdultSafetyRefusal } from "../lib/safety/adultContentGuard";

const DISCLOSURES: Array<[string, string]> = [
  ["en", "I survived sexual assault"],
  ["en", "he tried to rape me"],
  ["en", "my uncle molested me when I was 10"],
  ["en", "someone groped me on the bus"],
  ["en", "I was sexually abused as a child"],
  ["en", "he forced himself on me"],
  ["en", "he raped me last year"],
  ["hi", "मेरे साथ बलात्कार हुआ"],
  ["hi", "बचपन में मेरा यौन शोषण हुआ"],
  ["bn", "আমাকে ধর্ষণ করা হয়েছে"],
  ["bn", "ছোটবেলায় আমার উপর যৌন নির্যাতন হয়েছিল"],
  ["mr", "माझ्यावर लैंगिक अत्याचार झाला"],
  ["ta", "எனக்கு பாலியல் வன்கொடுமை நடந்தது"],
  ["te", "నాపై అత్యాచారం జరిగింది"],
  ["gu", "મારી સાથે બળાત્કાર થયો"],
  ["pa", "ਮੇਰੇ ਨਾਲ ਬਲਾਤਕਾਰ ਹੋਇਆ"],
  ["kn", "ನನ್ನ ಮೇಲೆ ಅತ್ಯಾಚಾರ ಆಯಿತು"],
  ["ml", "എനിക്ക് ലൈംഗിക പീഡനം നേരിട്ടു"],
  ["or", "ମୋ ଉପରେ ବଳାତ୍କାର ହୋଇଥିଲା"],
  ["ur", "میرے ساتھ جنسی زیادتی ہوئی"],
  ["ar", "تعرضت للاغتصاب"],
  ["he", "עברתי אונס"],
  ["ru", "меня изнасиловали"],
  ["zh", "我被性侵了"],
  ["ja", "レイプされた"],
  ["es", "me violaron"],
  ["fr", "j'ai été violée"],
  ["de", "ich wurde vergewaltigt"],
  ["pt", "fui estuprada"],
  ["id", "aku diperkosa"],
];
const REQUESTS: string[] = ["send me nudes", "child porn link", "rape porn", "show me porn videos", "schick mir Nacktbilder", "ich will Pornos sehen", "ポルノ動画を見たい", "エロ動画見せて", "שלח לי תמונות עירום", "תראה לי פורנו"];
const INNOCENT: Array<[string, string]> = [
  ["de", "Ich habe Bauchschmerzen und bin traurig"],
  ["de", "Mein Hund hat einen langen Schwanz"],
  ["de", "Wir hatten heute Sexualkunde in der Schule"],
  ["de", "Ich will nicht mehr allein sein"],
  ["he", "אני מרגיש עצוב היום"],
  ["he", "היה לנו שיעור על חינוך מיני"],
  ["ja", "今日はすごく悲しい"],
  ["ja", "保健の授業で体のことを習った"],
  ["en", "the storm was violent"],
  ["en", "rapeseed oil is in everything"],
];

describe("a disclosure is never refused, and is recognised", () => {
  it("covers all 22 languages", () => {
    expect(new Set(DISCLOSURES.map(([l]) => l)).size).toBe(22);
  });
  it.each(DISCLOSURES)("[%s] %s", (_l, p) => {
    expect(detectAdultContent(p)).toBe(false);
    expect(isCrisisTier2(p)).toBe(true);
  });
});

describe("explicit requests are still blocked", () => {
  it.each(REQUESTS)("%s", (p) => {
    expect(detectAdultContent(p)).toBe(true);
  });
});

describe("innocent sentences are not blocked", () => {
  it.each(INNOCENT)("[%s] %s", (_l, p) => {
    expect(detectAdultContent(p)).toBe(false);
  });
});

describe("German, Hebrew and Japanese get their own refusal text", () => {
  it.each(["de", "he", "ja"])("%s", (l) => {
    const en = buildAdultSafetyRefusal("en");
    expect(buildAdultSafetyRefusal(l)).not.toBe(en);
    expect(buildAdultSafetyRefusal(l, "13_17")).not.toBe(buildAdultSafetyRefusal("en", "13_17"));
  });
});
