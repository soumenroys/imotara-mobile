// src/lib/welcome/openingGreeting.ts
// The first thing every chat says: who is replying.
//
// 🔑 OWNER, 6 Nov 2026 (testing 1.6.3): the line under the chat box — "Replies
// come from software, not a person." — "looks so artificial". Chosen instead:
// say it in the chat's opening greeting, in the person's OWN language (all 22),
// and nothing under the box. SAME TABLE as imotaraapp src/lib/imotara/openingGreeting.ts
// (a web test compares them). ⛔ Shown only — never stored, never sent to the model.

/**
 * "I'm {name} — a private companion. My replies come from software, so you can
 * say anything." — in the 22 languages the app speaks. {name} is the companion's
 * own name. Register follows the warm welcome in each language (bn তুমি, hi आप,
 * de du, fr vous …). ⚠️ Gender-neutral words chosen where the language marks it
 * (kn ಒಡನಾಡಿ, ml കൂട്ട്) — the companion's gender is the person's choice.
 */
export const OPENING_GREETING: Record<string, string> = {
  en: "I'm {name} — a private companion. My replies come from software, so you can say anything.",
  hi: "मैं {name} हूँ — एक निजी साथी। मेरे जवाब सॉफ़्टवेयर से आते हैं, इसलिए आप बेझिझक कुछ भी कह सकते हैं।",
  bn: "আমি {name} — তোমার একান্ত সঙ্গী। আমার উত্তরগুলো সফটওয়্যার থেকে আসে, তাই তুমি নির্দ্বিধায় যা খুশি বলতে পারো।",
  mr: "मी {name} — एक खाजगी सोबती. माझी उत्तरं सॉफ्टवेअरकडून येतात, त्यामुळे तुम्ही मनमोकळेपणाने काहीही बोलू शकता.",
  ta: "நான் {name} — உங்கள் தனிப்பட்ட துணை. என் பதில்கள் மென்பொருளிலிருந்து வருகின்றன, அதனால் நீங்கள் எதையும் தயக்கமின்றிச் சொல்லலாம்.",
  te: "నేను {name} — మీ వ్యక్తిగత తోడు. నా సమాధానాలు సాఫ్ట్‌వేర్ నుండి వస్తాయి, కాబట్టి మీరు ఏదైనా నిస్సంకోచంగా చెప్పవచ్చు.",
  gu: "હું {name} છું — એક ખાનગી સાથી. મારા જવાબો સોફ્ટવેરમાંથી આવે છે, એટલે તમે કંઈ પણ ખચકાટ વગર કહી શકો છો.",
  kn: "ನಾನು {name} — ನಿಮ್ಮ ಖಾಸಗಿ ಒಡನಾಡಿ. ನನ್ನ ಉತ್ತರಗಳು ಸಾಫ್ಟ್‌ವೇರ್‌ನಿಂದ ಬರುತ್ತವೆ, ಹಾಗಾಗಿ ನೀವು ಏನನ್ನಾದರೂ ಹಿಂಜರಿಕೆಯಿಲ್ಲದೆ ಹೇಳಬಹುದು.",
  ml: "ഞാൻ {name} — നിങ്ങളുടെ സ്വകാര്യ കൂട്ട്. എന്റെ മറുപടികൾ സോഫ്റ്റ്‌വെയറിൽ നിന്നാണ് വരുന്നത്, അതിനാൽ നിങ്ങൾക്ക് എന്തും മടികൂടാതെ പറയാം.",
  pa: "ਮੈਂ {name} ਹਾਂ — ਇੱਕ ਨਿੱਜੀ ਸਾਥੀ। ਮੇਰੇ ਜਵਾਬ ਸਾਫ਼ਟਵੇਅਰ ਤੋਂ ਆਉਂਦੇ ਹਨ, ਇਸ ਲਈ ਤੁਸੀਂ ਬੇਝਿਜਕ ਕੁਝ ਵੀ ਕਹਿ ਸਕਦੇ ਹੋ।",
  or: "ମୁଁ {name} — ଜଣେ ବ୍ୟକ୍ତିଗତ ସାଥୀ। ମୋ ଉତ୍ତରଗୁଡ଼ିକ ସଫ୍ଟୱେୟାରରୁ ଆସେ, ତେଣୁ ଆପଣ ନିଃସଙ୍କୋଚରେ ଯାହା ବି କହିପାରିବେ।",
  ur: "میں {name} ہوں — ایک نجی ساتھی۔ میرے جواب سافٹ ویئر سے آتے ہیں، اس لیے آپ بے جھجک کچھ بھی کہہ سکتے ہیں۔",
  ar: "أنا {name} — رفيقك الخاص. ردودي تأتي من برنامج حاسوبي، لذا يمكنك أن تقول أي شيء بحرية.",
  ru: "Я {name} — ваш личный собеседник. Мои ответы создаёт программа, поэтому вы можете говорить что угодно.",
  zh: "我是{name}——你的私密陪伴者。我的回复来自软件，所以你可以放心说任何事。",
  ja: "{name}です。あなただけの話し相手です。返事はソフトウェアが作っているので、何でも気軽に話してください。",
  es: "Soy {name}, un acompañante privado. Mis respuestas vienen de un software, así que puedes decir lo que quieras.",
  fr: "Je suis {name}, un compagnon privé. Mes réponses viennent d'un logiciel, vous pouvez donc tout dire.",
  de: "Ich bin {name} – ein privater Begleiter. Meine Antworten kommen von einer Software, also kannst du alles sagen.",
  pt: "Sou {name}, um companheiro particular. Minhas respostas vêm de um software, então você pode dizer qualquer coisa.",
  id: "Aku {name} — teman pribadimu. Balasanku berasal dari perangkat lunak, jadi kamu bisa cerita apa saja.",
  he: "אני {name} — מלווה פרטי. התשובות שלי מגיעות מתוכנה, אז אפשר לומר כל דבר.",
};

/** The greeting in the person's language (en fallback), with the companion's own name. */
export function openingGreeting(companionName?: string | null, lang?: string | null): string {
  const name = companionName?.trim() || "Imotara";
  const code = (lang ?? "").toLowerCase().split(/[-_]/)[0];
  return (OPENING_GREETING[code] ?? OPENING_GREETING.en).replace("{name}", name);
}
