// src/lib/welcome/warmWelcome.ts
// The companion's first words in an empty conversation — one warm question in
// the person's own language, instead of grey English text above the chips.
// Owner approved 25 Oct 2026 (action plan Phase 1: "First 60 seconds").
//
// ⛔ DISPLAY ONLY. It is never saved to History and never sent to the model, so
//    replies are byte-for-byte what they were (reply-quality rule).
// 🔑 Formality follows the reply voice: Bengali তুমি (the owner's default for
//    replies), Hindi/Urdu आप/آپ, French vous, German du, as checkInInvite.ts.
// ⚠️ "What's on your mind today?" — not "How are you feeling right now?", which
//    the step card under the chips already asks, and not "How was your day?",
//    which reads oddly at 7 am.
// 🪞 Mirrored byte-for-byte in imotaraapp/src/lib/imotara/warmWelcome.ts.

export type WelcomeLine = { hello: string; glad: string; ask: string };

export const WARM_WELCOME: Record<string, WelcomeLine> = {
    en: { hello: "Hi", glad: "I'm glad you're here.", ask: "What's on your mind today?" },
    hi: { hello: "नमस्ते", glad: "अच्छा लगा कि आप यहाँ हैं।", ask: "आज मन में क्या चल रहा है?" },
    bn: { hello: "হ্যালো", glad: "তুমি এসেছ, ভালো লাগল।", ask: "আজ মনে কী চলছে?" },
    mr: { hello: "नमस्कार", glad: "तुम्ही इथे आलात, छान वाटलं.", ask: "आज मनात काय चाललंय?" },
    ta: { hello: "வணக்கம்", glad: "நீங்கள் வந்தது மகிழ்ச்சி.", ask: "இன்று உங்கள் மனதில் என்ன ஓடிக்கொண்டிருக்கிறது?" },
    te: { hello: "నమస్తే", glad: "మీరు వచ్చినందుకు సంతోషం.", ask: "ఈ రోజు మీ మనసులో ఏముంది?" },
    gu: { hello: "નમસ્તે", glad: "તમે આવ્યા એ ગમ્યું.", ask: "આજે મનમાં શું ચાલી રહ્યું છે?" },
    kn: { hello: "ನಮಸ್ಕಾರ", glad: "ನೀವು ಬಂದಿದ್ದು ಖುಷಿ.", ask: "ಇವತ್ತು ನಿಮ್ಮ ಮನಸ್ಸಿನಲ್ಲಿ ಏನಿದೆ?" },
    ml: { hello: "നമസ്കാരം", glad: "നിങ്ങൾ വന്നതിൽ സന്തോഷം.", ask: "ഇന്ന് മനസ്സിൽ എന്താണ്?" },
    pa: { hello: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", glad: "ਤੁਸੀਂ ਆਏ, ਚੰਗਾ ਲੱਗਾ।", ask: "ਅੱਜ ਮਨ ਵਿੱਚ ਕੀ ਚੱਲ ਰਿਹਾ ਹੈ?" },
    or: { hello: "ନମସ୍କାର", glad: "ଆପଣ ଆସିଲେ, ଭଲ ଲାଗିଲା।", ask: "ଆଜି ମନରେ କ'ଣ ଚାଲିଛି?" },
    ur: { hello: "آداب", glad: "اچھا لگا کہ آپ یہاں ہیں۔", ask: "آج دل میں کیا چل رہا ہے؟" },
    ar: { hello: "مرحبًا", glad: "يسعدني وجودك هنا.", ask: "ما الذي يشغل بالك اليوم؟" },
    ru: { hello: "Здравствуйте", glad: "Хорошо, что вы здесь.", ask: "Что у вас сегодня на душе?" },
    zh: { hello: "你好", glad: "很高兴你来了。", ask: "今天心里在想些什么？" },
    ja: { hello: "こんにちは", glad: "来てくれてうれしいです。", ask: "今日はどんなことを考えていますか？" },
    es: { hello: "Hola", glad: "Me alegra que estés aquí.", ask: "¿Qué tienes en mente hoy?" },
    fr: { hello: "Bonjour", glad: "Merci d'être là.", ask: "Qu'avez-vous en tête aujourd'hui ?" },
    de: { hello: "Hallo", glad: "Schön, dass du da bist.", ask: "Was beschäftigt dich heute?" },
    pt: { hello: "Olá", glad: "Que bom que você está aqui.", ask: "O que está passando pela sua cabeça hoje?" },
    id: { hello: "Hai", glad: "Senang kamu ada di sini.", ask: "Apa yang sedang kamu pikirkan hari ini?" },
    he: { hello: "שלום", glad: "טוב שבאת.", ask: "מה עובר עליך היום?" },
};

// How the greeting (and a name, if known) opens the line in each script.
const DANDA = ["hi", "bn", "pa", "or"];
const FULL_STOP = ["mr", "ta", "te", "gu", "kn", "ml", "ru", "es", "fr", "de", "pt", "id", "he"];

function opener(key: string, hello: string, name: string): string {
    if (key === "ja") return name ? `${hello}、${name}さん。` : `${hello}。`;
    if (key === "zh") return name ? `${hello}，${name}。` : `${hello}！`;
    if (key === "ar" || key === "ur") return name ? `${hello} ${name}،` : `${hello}،`;
    if (DANDA.includes(key)) return name ? `${hello}, ${name}।` : `${hello}।`;
    if (FULL_STOP.includes(key)) return name ? `${hello}, ${name}.` : `${hello}.`;
    return name ? `${hello}, ${name} —` : `${hello}!`; // en
}

/** The welcome text for a language (falls back to English), with the name if known. */
export function warmWelcomeText(lang: string | null | undefined, name?: string | null): string {
    const code = (lang ?? "").toLowerCase().split(/[-_]/)[0];
    const key = WARM_WELCOME[code] ? code : "en";
    const w = WARM_WELCOME[key];
    // Chinese and Japanese put no space between sentences.
    const sep = key === "zh" || key === "ja" ? "" : " ";
    return [opener(key, w.hello, (name ?? "").trim()), w.glad, w.ask].join(sep);
}

/** Just "glad + ask" — for a screen that already greets (web shows a localized "Good evening"). */
export function warmWelcomeBody(lang: string | null | undefined): string {
    const code = (lang ?? "").toLowerCase().split(/[-_]/)[0];
    const w = WARM_WELCOME[WARM_WELCOME[code] ? code : "en"];
    return [w.glad, w.ask].join(code === "zh" || code === "ja" ? "" : " ");
}
