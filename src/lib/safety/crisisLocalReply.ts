// src/lib/safety/crisisLocalReply.ts
// #44 (27 Nov 2026): the app's OFFLINE reply to a crisis message.
//
// The offline engine (lib/ai/local/localReplyEngine.ts) had NO crisis handling — "I want to
// die" offline got the ordinary sad/anxious flow. The crisis card still showed the number,
// but the reply itself never did. Now, in all 22 languages: a caring line, the person's OWN
// helpline (same country resolver + resources as the crisis card), then one question.
//
// 🔑 The tables below are BYTE-IDENTICAL to the web's built-in crisis reply
// (imotaraapp src/lib/ai/orchestrator/runImotara.ts), copied 27 Nov 2026 — change BOTH together;
// so someone switching device hears the same words.

import { isCrisisTier2 } from "../emotion/keywordMaps";
import { getCrisisResourcesForCountry } from "./crisisResources";

export const CRISIS_HELPLINE_LEAD: Record<string, string> = {
  en: "If you need a real person right now",
  hi: "अगर अभी किसी इंसान से बात करनी हो",
  bn: "এখনই কোনো মানুষের সঙ্গে কথা বলতে চাইলে",
  mr: "आत्ता कोणाशी तरी बोलायचं असेल तर",
  gu: "અત્યારે કોઈ વ્યક્તિ સાથે વાત કરવી હોય તો",
  pa: "ਜੇ ਹੁਣੇ ਕਿਸੇ ਨਾਲ ਗੱਲ ਕਰਨੀ ਹੋਵੇ",
  ta: "இப்போதே ஒருவரிடம் பேச வேண்டுமென்றால்",
  te: "ఇప్పుడే ఎవరితోనైనా మాట్లాడాలంటే",
  kn: "ಈಗಲೇ ಯಾರೊಂದಿಗಾದರೂ ಮಾತನಾಡಬೇಕಿದ್ದರೆ",
  ml: "ഇപ്പോൾ തന്നെ ആരോടെങ്കിലും സംസാരിക്കണമെങ്കിൽ",
  or: "ଏବେ କାହା ସହିତ କଥା ହେବାକୁ ଚାହିଁଲେ",
  ur: "اگر ابھی کسی سے بات کرنی ہو",
  ar: "إذا احتجت إلى التحدث مع شخص الآن",
  he: "אם צריך לדבר עם מישהו עכשיו",
  zh: "如果现在需要找人说说话",
  ja: "今すぐ誰かと話したいときは",
  es: "Si necesitas hablar con alguien ahora mismo",
  fr: "Si tu as besoin de parler à quelqu'un tout de suite",
  pt: "Se você precisar falar com alguém agora",
  de: "Wenn du jetzt sofort mit jemandem sprechen möchtest",
  ru: "Если нужно поговорить с кем-то прямо сейчас",
  id: "Kalau kamu perlu bicara dengan seseorang sekarang",
};

export const LOCAL_CRISIS_LINES: Record<string, readonly [string, string]> = {
  bn: ["এখন তুমি অনেক ভারী জায়গায় আছো। আমি সত্যিই পাশে আছি।", "এই মুহূর্তে তোমার কি কাছে কেউ আছে — কেউ যাকে ডাকতে পারো?"],
  hi: ["अभी तुम बहुत भारी जगह पर हो। मैं यहाँ हूँ — सच में।", "इस वक़्त तुम्हारे पास कोई है — कोई जिसे बुला सको?"],
  mr: ["आत्ता तू खूप जड जागी आहेस. मी खरोखरच सोबत आहे.", "या क्षणी तुझ्याजवळ कोणी आहे का — कोणाला बोलवू शकतोस?"],
  gu: ["અત્યારે તું ઘણી ભારે જગ્યા પર છે. હું ખરેખર સાથે છું.", "આ ક્ષણે તારી પાસે કોઈ છે — કોઈ જેને બોલાવી શકે?"],
  kn: ["ನೀನು ಈಗ ತುಂಬಾ ಕಷ್ಟದ ಜಾಗದಲ್ಲಿ ಇದ್ದೀಯ. ನಾನು ನಿಜವಾಗಿಯೂ ಪಕ್ಕದಲ್ಲಿದ್ದೇನೆ.", "ಈ ಕ್ಷಣ ನಿನ್ನ ಹತ್ತಿರ ಯಾರಾದರೂ ಇದ್ದಾರಾ — ಯಾರನ್ನಾದರೂ ಕರೆಯಬಲ್ಲೆಯಾ?"],
  pa: ["ਤੂੰ ਹੁਣ ਬਹੁਤ ਭਾਰੀ ਥਾਂ 'ਤੇ ਹੈਂ। ਮੈਂ ਸੱਚਮੁੱਚ ਨਾਲ ਹਾਂ।", "ਇਸ ਵੇਲੇ ਤੇਰੇ ਕੋਲ ਕੋਈ ਹੈ — ਕਿਸੇ ਨੂੰ ਬੁਲਾ ਸਕਦਾ/ਸਕਦੀ ਹੈਂ?"],
  or: ["ତୁ ଏବେ ବହୁତ ଭାରୀ ଜାଗାରେ ଅଛୁ। ମୁଁ ସତରେ ତୋ ସହିତ ଅଛି।", "ଏହି ମୁହୂର୍ତ୍ତରେ ତୋ ପାଖରେ କେହି ଅଛନ୍ତି କି — କାହାକୁ ଡାକି ପାରିବୁ?"],
  ur: ["آپ ابھی بہت بھاری جگہ پر ہیں۔ میں سچ میں ساتھ ہوں۔", "اس وقت آپ کے پاس کوئی ہے — کسی کو بلا سکتے ہیں؟"],
  ta: ["நீ இப்போது மிகவும் கனமான இடத்தில் இருக்கிறாய். நான் உண்மையிலேயே இங்கே இருக்கிறேன்.", "இந்த நேரத்தில் உன்னிடம் யாராவது இருக்கிறார்களா — யாரையாவது அழைக்க முடியுமா?"],
  te: ["నువ్వు ఇప్పుడు చాలా కష్టమైన స్థలంలో ఉన్నావు. నేను నిజంగా ఇక్కడే ఉన్నాను.", "ఈ క్షణంలో నీ దగ్గర ఎవరైనా ఉన్నారా — ఎవరినైనా పిలవగలవా?"],
  ml: ["നീ ഇപ്പോൾ വളരെ ഭാരമേറിയ ഇടത്തിലാണ്. ഞാൻ ശരിക്കും ഇവിടെ ഉണ്ട്.", "ഈ നേരത്ത് നിന്റെ അടുത്ത് ആരെങ്കിലും ഉണ്ടോ — ആരെയെങ്കിലും വിളിക്കാൻ പറ്റുമോ?"],
  ar: ["أنت الآن في مكان ثقيل جداً. أنا هنا معك حقاً.", "هل هناك أحد قريب منك الآن يمكنك الاتصال به؟"],
  zh: ["你现在处在一个很沉重的地方。我真的在这里陪着你。", "你现在身边有没有可以联系的人？"],
  es: ["Estás en un lugar muy pesado ahora. Estoy aquí contigo de verdad.", "¿Hay alguien cerca de ti ahora con quien puedas hablar?"],
  fr: ["Tu es dans un endroit très lourd là. Je suis vraiment là avec toi.", "Est-ce qu'il y a quelqu'un près de toi maintenant que tu peux appeler ?"],
  pt: ["Você está num lugar muito pesado agora. Estou aqui de verdade.", "Tem alguém perto de você agora com quem possa falar?"],
  ru: ["Ты сейчас в очень тяжёлом месте. Я здесь с тобой.", "Есть ли рядом с тобой кто-то, кому ты можешь позвонить?"],
  id: ["Kamu sekarang berada di tempat yang sangat berat. Aku benar-benar di sini bersamamu.", "Ada seseorang di dekatmu sekarang yang bisa kamu hubungi?"],
  de: ["Du bist jetzt an einem sehr schweren Ort. Ich bin wirklich bei dir.", "Gibt es jemanden in deiner Nähe, den du jetzt anrufen kannst?"],
  he: ["אתה עכשיו במקום כבד מאוד. אני ממש כאן איתך.", "יש מישהו קרוב אליך עכשיו שאתה יכול להתקשר אליו?"],
  ja: ["今、あなたはとても重い場所にいます。本当にここにいます、一緒に。", "今、近くに電話できる人はいますか?"],
};

export const ROMAN_CRISIS_WORDS: Record<string, RegExp> = {
  bn: /\b(sesh kore|sesh kore debo|mara jabo|mare jabo|nishwas nite)\b/,
  hi: /\b(marne|mar jaana|khatam karna|khud ko nahi|mujhe nahi chahiye|sab khatam)\b/,
  mr: /\b(marne|marayla|sab sampla|khud la|swatahla)\b/,
  gu: /\b(marne|khatam|sab sambhal nathi)\b/,
  kn: /\b(saaybekku|saaytini|khatam|sambalisolla)\b/,
  ta: /\b(saaganum|saavenu|khatam|thanga mudiyala)\b/,
  te: /\b(chaavali|chaavatam|khatam|aasha ledu)\b/,
  ml: /\b(marikkanam|marikkan|sambhalikkan patunilla|khatam)\b/,
  pa: /\b(marna|maar laina|khatam|sambhaal nahi)\b/,
  or: /\b(marajaiba|mara jai|khatam|handle napariba)\b/,
  ur: /\b(marne|mar jaana|khatam karna|mujhe nahi chahiye|sab khatam)\b/,
};

export const FOREIGN_CRISIS_LATIN = /\b(suicide|kill myself|end it|can't go on|no point|suicidio|suicídio|mau mati|sterben|sich umbringen)\b/i;
export const FOREIGN_CRISIS_OTHER = /(самоубийств|не хочу жить|хочу умереть|انتحار|أريد أن أموت|自杀|不想活|אני רוצה למות|אין לי כוח|自殺|死にたい|もう無理)/;

const EN_CRISIS_ACK = [
        "I’m really glad you said it here. You matter, and I want to stay with you right now.",
        "Thank you for telling me directly. I'm here with you. We can take this one safe step at a time.",
        "I’m with you right now. Your safety matters more than anything else in this moment.",
      ] as const;
const EN_CRISIS_FOLLOW = [
        "Are you in immediate danger right now, or have you already done anything to hurt yourself?",
        "Can you move a little farther from anything you could use to hurt yourself, and tell me once you have?",
        "Can you call or message one trusted person right now and stay with me while you do it?",
      ] as const;

/** Same detection as the web's built-in reply: the crisis card's detector + romanised words. */
export function isLocalCrisisMessage(lang: string, text: string): boolean {
  const lower = text.toLowerCase();
  return (
    isCrisisTier2(text) ||
    (ROMAN_CRISIS_WORDS[lang]?.test(lower) ?? false) ||
    FOREIGN_CRISIS_LATIN.test(lower) ||
    FOREIGN_CRISIS_OTHER.test(lower)
  );
}

export function crisisHelplineLine(lang: string, countryCode?: string | null): string {
  const line = getCrisisResourcesForCountry(countryCode).primary[0];
  const lead = CRISIS_HELPLINE_LEAD[lang] ?? CRISIS_HELPLINE_LEAD.en;
  const colon = lang === "zh" || lang === "ja" ? "：" : ": ";
  return `${lead} — ${line.label}${colon}${line.contact}`;
}

function pickBySeed<T>(items: readonly T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return items[Math.abs(h) % items.length];
}

/**
 * The offline crisis reply, or null when the message is not a crisis.
 * Order (as on the web): caring line → helpline → question. Never cut.
 */
export function localCrisisReply(message: string, lang: string, countryCode: string | null): string | null {
  if (!isLocalCrisisMessage(lang, message)) return null;
  if (lang !== "en" && LOCAL_CRISIS_LINES[lang]) {
    const [care, question] = LOCAL_CRISIS_LINES[lang];
    return `${care} ${crisisHelplineLine(lang, countryCode)}\n\n${question}`;
  }
  const ack = pickBySeed(EN_CRISIS_ACK, `ack:${message}`);
  const follow = pickBySeed(EN_CRISIS_FOLLOW, `follow:${message}`);
  return `${ack}\n\n${crisisHelplineLine("en", countryCode)}.\n\n${follow}`;
}
