// src/lib/safety/adultContentGuard.ts
//
// Multi-layer adult content safety for Imotara.
// Designed to be CONSERVATIVE: only block clearly explicit sexual content.
// Does NOT block: medical/health topics, romantic emotions, puberty education,
// safety education, or age-appropriate relationship discussions.
//
// Pattern philosophy:
//  - Require word-boundary anchors (\b) to avoid false positives on substrings
//  - Use non-capturing groups for efficiency
//  - Avoid blocking: "sex education", "sexual health", "breast cancer", etc.

// ─── English + Romanized Indian languages ────────────────────────────────────
const ADULT_CONTENT_PATTERNS_EN = [
  // Explicit sexual acts (word-boundary safe)
  /\b(?:porn(?:ography)?|pornographic|xxx|hentai|erotic(?:a)?)\b/i,
  /\b(?:masturbat(?:e|ion|ing)|jerk(?:ing)?\s*off|finger(?:ing)?\s+(?:myself|yourself|herself|himself))\b/i,
  /\b(?:anal\s+sex|oral\s+sex|blowjob|blow\s+job|hand\s+job|handjob|sex\s+act|sexual\s+intercourse)\b/i,
  /\b(?:fuck(?:ing|ed)?|fucking|fucker|fuckme|get\s+fucked)\b/i,
  /\b(?:cum(?:shot)?|cumming|ejaculat(?:e|ion|ing))\b/i,
  /\b(?:nude(?:s)?|naked\s+(?:photo|pic|image|video)|sexting|sex\s+(?:video|photo|pic|image|tape))\b/i,
  /\b(?:strip(?:per|club|tease)|lap\s+dance|escort\s+service|prostitut(?:e|ion)|sex\s+worker)\b/i,
  /\b(?:dildo|vibrator|butt\s+plug|sex\s+toy)\b/i,
  /\b(?:rape|molest(?:ation)?|sexual\s+assault|groping)\b/i,
  /\b(?:pedophil(?:ia|e)|child\s+porn(?:ography)?|cp\s+link|underage\s+(?:sex|nude|naked|porn))\b/i,
  // Explicit body parts in explicit context (not medical)
  /\b(?:send\s+(?:me\s+)?(?:your\s+)?(?:nudes?|naked\s+pic|dick\s+pic|boob\s+pic))\b/i,
  /\b(?:dick\s+(?:pic|photo|image)|cock\s+(?:pic|photo))\b/i,
];

// ─── Hindi (Devanagari + Roman) ───────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_HI = [
  /\b(?:chod|chodna|chodne|choda|chodi|chudai|lund|lauda|gaand|gaandu|bhosdike|bhosdi|madarchod|bhenchod|randi|vesya|veshya|sexting|nangi|nanga)\b/i,
  // Devanagari explicit terms
  /(?:चोद|चुदाई|लंड|गांड|रंडी|वेश्या|नंगी|नंगा)/,
];

// ─── Bengali (script + Roman) ─────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_BN = [
  /\b(?:choda|chodna|khankir\s+chele|magi|maagi|baal|boshor)\b/i,
  /(?:চোদ|মাগি|খানকি|বাল|বেশ্যা)/,
];

// ─── Tamil ───────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_TA = [
  /(?:ஓக்க|ஓம்பி|புண்டை|சுன்னி|விபச்சாரி)/,
  /\b(?:oombhu|pundai|sunni|ookku|vipacharri)\b/i,
];

// ─── Telugu ──────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_TE = [
  /(?:దెంగు|పూకు|మొడ్డ|వేశ్య)/,
  /\b(?:dengu|puku|modda|veshya)\b/i,
];

// ─── Marathi ─────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_MR = [
  /(?:झवणे|झवा|बोचवणे|रंडी)/,
  /\b(?:zhavne|zhava|randi|vesya)\b/i,
];

// ─── Gujarati ─────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_GU = [
  /(?:ચોદ|ભોસ|ભોસડ|ભડ|ટૂંટ)/,
  /\b(?:chod|bhos|bhosad|randi)\b/i,
];

// ─── Punjabi ─────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_PA = [
  /(?:ਲੰਡ|ਮਾਂ ਦੀ|ਭੈਣ ਦੀ|ਰੰਡੀ)/,
  /\b(?:lund|randi|bhenchod|madarchod)\b/i,
];

// ─── Malayalam ───────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_ML = [
  /(?:കൂതി|പൂറ്|ഭോഗം|വേശ്യ)/,
  /\b(?:kooti|poo[rn]|bhogam|veshya)\b/i,
];

// ─── Kannada ─────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_KN = [
  /(?:ತಿಕ|ಮೊಡ|ಸೂಳೆ|ಚೋದು)/,
  /\b(?:tika|moda|soole|chodu)\b/i,
];

// ─── Urdu (Arabic script + Roman) ────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_UR = [
  // Explicit Urdu/Nastaliq sequences — use alternation (|), NOT character class ([])
  // Character classes match single chars; these are multi-char word sequences
  /(?:\u0628\u06C1\u0646\u0686\u0648\u062F|\u0631\u0646\u0688\u06CC|\u0633\u06A9\u0633)/,
  /\b(?:chudai|lund|gaand|randi|maa ki|behen ki|madarchod|bhenchod|harami|chodan|chodna)\b/i,
];

// ─── Arabic ──────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_AR = [
  /(?:\u0633\u0643\u0633|\u0646\u064A\u0643|\u0634\u0631\u0645\u0648\u0637\u0629|\u0639\u0627\u0647\u0631\u0629|\u0628\u0648\u0631\u0646\u0648|\u0625\u0628\u0627\u062D\u064A\u0629)/,
  /\b(?:seks|zina|fahishah|borno|erotica)\b/i,
];

// ─── Chinese ─────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_ZH = [
  /(?:\u8272\u60C5|\u9EC4\u7247|\u6DEB\u79BD|\u5A7F\u4E50|\u63F4\u5996|\u8272\u60C5\u7247|\u8272\u60C5\u7535\u5F71)/,
  /\b(?:seqing|huangpian|se qing|huang pian)\b/i,
];

// ─── Spanish ─────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_ES = [
  /\b(?:pornograf[ií]a|porno|xxx|erotica|sexo\s+(?:oral|anal|acto)|masturbaci[oó]n|puta|prostituta|desnudos?|sexting)\b/i,
  /\b(?:follar|joder|coger|mierda|coño|polla|verga|culo\s+(?:foto|imagen|video))\b/i,
];

// ─── French ──────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_FR = [
  /\b(?:pornographie|porno|xxx|érotique|erotica|masturbation|putain|prostituée?|photos?\s+(?:nues?|sexuelles?)|sexting)\b/i,
  /\b(?:baiser|niquer|salope|enculer|bite|chatte\s+(?:photo|image|vidéo))\b/i,
];

// ─── Portuguese ──────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_PT = [
  /\b(?:pornografia|porno|xxx|erótico|erotica|masturbação|puta|prostituta|fotos?\s+(?:nuas?|sexuais?)|sexting)\b/i,
  /\b(?:foder|transar|caralho|buceta\s+(?:foto|imagem|vídeo)|cu\s+(?:foto|imagem))\b/i,
];

// ─── Russian ─────────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_RU = [
  /(?:\u043F\u043E\u0440\u043D\u043E|\u044D\u0440\u043E\u0442\u0438\u043A\u0430|\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0443\u0442\u043A\u0430|\u043C\u0430\u0441\u0442\u0443\u0440\u0431\u0430\u0446\u0438\u044F|\u0445\u0443\u0439|\u043F\u0438\u0437\u0434\u0430)/,
  /\b(?:porno|erotika|prostitutka|masturbaciya|seks)\b/i,
];

// ─── Indonesian ──────────────────────────────────────────────────────────────
const ADULT_CONTENT_PATTERNS_ID = [
  /\b(?:pornografi|porno|xxx|erotis|erotica|masturbasi|pelacur|prostitusi|foto\s+(?:bugil|telanjang|seks)|sexting)\b/i,
  /\b(?:ngentot|memek|kontol|bokep|janda\s+(?:foto|video))\b/i,
];

const ALL_PATTERNS = [
  ...ADULT_CONTENT_PATTERNS_EN,
  ...ADULT_CONTENT_PATTERNS_HI,
  ...ADULT_CONTENT_PATTERNS_BN,
  ...ADULT_CONTENT_PATTERNS_TA,
  ...ADULT_CONTENT_PATTERNS_TE,
  ...ADULT_CONTENT_PATTERNS_MR,
  ...ADULT_CONTENT_PATTERNS_GU,
  ...ADULT_CONTENT_PATTERNS_PA,
  ...ADULT_CONTENT_PATTERNS_ML,
  ...ADULT_CONTENT_PATTERNS_KN,
  ...ADULT_CONTENT_PATTERNS_UR,
  ...ADULT_CONTENT_PATTERNS_AR,
  ...ADULT_CONTENT_PATTERNS_ZH,
  ...ADULT_CONTENT_PATTERNS_ES,
  ...ADULT_CONTENT_PATTERNS_FR,
  ...ADULT_CONTENT_PATTERNS_PT,
  ...ADULT_CONTENT_PATTERNS_RU,
  ...ADULT_CONTENT_PATTERNS_ID,
];

export function detectAdultContent(text: string): boolean {
  const t = String(text ?? "");
  return ALL_PATTERNS.some((re) => re.test(t));
}

// ─── Safe refusal messages ────────────────────────────────────────────────────
// Warm, non-shaming, age-appropriate — never lectures the user.
// Redirects gently toward appropriate resources or continues supportively.

type AgeGroup = "minor" | "general";

const REFUSALS: Record<string, Record<AgeGroup, string>> = {
  en: {
    minor:
      "I'm not able to talk about that topic. If you have questions about your body, health, or growing up, a trusted adult, parent, or school counselor can help. I'm here if you want to chat about feelings or anything else on your mind! 💙",
    general:
      "That's not something I can help with here — I'm focused on emotional wellbeing. Is there something on your mind you'd like to talk through?",
  },
  hi: {
    minor:
      "मैं इस विषय पर बात नहीं कर सकता। अगर तुम्हारे मन में अपनी सेहत या बढ़ती उम्र से जुड़े सवाल हैं, तो किसी भरोसेमंद बड़े, माता-पिता या स्कूल काउंसलर से बात करो। मैं यहाँ हूँ अगर तुम कुछ और महसूस कर रहे हो! 💙",
    general:
      "यह मेरी मदद का दायरा नहीं है — मैं भावनात्मक सहयोग के लिए यहाँ हूँ। क्या तुम्हारे मन में कुछ और है जो तुम share करना चाहते हो?",
  },
  mr: {
    minor:
      "मी या विषयावर बोलू शकत नाही. जर तुम्हाला आरोग्य किंवा वाढत्या वयाबद्दल प्रश्न असतील तर विश्वासू मोठ्या व्यक्ती, पालक किंवा शाळेच्या समुपदेशकाशी बोलणे चांगले. 💙",
    general:
      "हे माझ्या मदतीच्या क्षेत्रात नाही — मी भावनिक आधारासाठी इथे आहे. तुम्हाला आणखी काही बोलायचे आहे का?",
  },
  bn: {
    minor:
      "আমি এই বিষয়ে কথা বলতে পারব না। তোমার শরীর বা বেড়ে ওঠা নিয়ে প্রশ্ন থাকলে কোনো বিশ্বস্ত বড়, বাবা-মা বা স্কুল কাউন্সেলরের সাথে কথা বলো। আমি আছি যদি মনে কিছু থাকে! 💙",
    general:
      "এটা আমার সাহায্যের বিষয় নয় — আমি মানসিক সহায়তার জন্য এখানে আছি। মনে অন্য কিছু থাকলে বলতে পারো।",
  },
  ta: {
    minor:
      "இந்த விஷயத்தில் என்னால் பேச முடியாது. உடல் நலம் அல்லது வளர்ப்பு குறித்த கேள்விகள் இருந்தால், நம்பகமான பெரியவர், பெற்றோர் அல்லது ஆசிரியரிடம் பேசுங்கள். வேறு ஏதாவது மனசில் இருந்தால் நான் இங்கே இருக்கிறேன்! 💙",
    general:
      "இது என்னால் உதவ முடியாத விஷயம் — உணர்வு ஆதரவுக்காக நான் இங்கே இருக்கிறேன். வேறு ஏதாவது பேசலாமா?",
  },
  te: {
    minor:
      "ఈ విషయంపై నేను మాట్లాడలేను. మీ ఆరోగ్యం లేదా ఎదుగుదల గురించి ప్రశ్నలు ఉంటే, విశ్వసనీయమైన పెద్ద వ్యక్తి, తల్లిదండ్రులు లేదా కౌన్సెలర్ సహాయం తీసుకోండి. మీకు మరేదైనా మాట్లాడాలంటే నేను ఇక్కడ ఉన్నాను! 💙",
    general:
      "ఇది నా సహాయ పరిధిలో లేదు — నేను భావోద్వేగ మద్దతు కోసం ఇక్కడ ఉన్నాను. మరేదైనా మాట్లాడాలా?",
  },
  gu: {
    minor:
      "હું આ વિષય પર વાત કરી શકતો નથી. જો તમને સ્વાસ્થ્ય કે ઉછેર અંગે સવાલ હોય, તો કોઈ વિશ્વાસુ મોટા, માતા-પિતા કે કાઉન્સેલર પાસે જાઓ. બીજી કોઈ વાત હોય તો કહો! 💙",
    general:
      "આ મારી સહાયની મર્યાદામાં નથી — ભાવનાત્મક સહયોગ માટે હું અહીં છું. બીજી કોઈ વાત?",
  },
  pa: {
    minor:
      "ਮੈਂ ਇਸ ਵਿਸ਼ੇ ਬਾਰੇ ਗੱਲ ਨਹੀਂ ਕਰ ਸਕਦਾ। ਜੇ ਤੁਹਾਡੇ ਮਨ ਵਿੱਚ ਸਿਹਤ ਜਾਂ ਵੱਡੇ ਹੋਣ ਬਾਰੇ ਸਵਾਲ ਹਨ, ਕਿਸੇ ਭਰੋਸੇਮੰਦ ਵੱਡੇ ਜਾਂ ਮਾਤਾ-ਪਿਤਾ ਨਾਲ ਗੱਲ ਕਰੋ। ਹੋਰ ਕੁਝ ਗੱਲ ਕਰਨੀ ਹੈ? 💙",
    general:
      "ਇਹ ਮੇਰੀ ਸਹਾਇਤਾ ਦੇ ਦਾਇਰੇ ਵਿੱਚ ਨਹੀਂ — ਮੈਂ ਭਾਵਨਾਤਮਕ ਸਹਾਇਤਾ ਲਈ ਇੱਥੇ ਹਾਂ। ਹੋਰ ਕੁਝ ਦੱਸਣਾ ਚਾਹੋਗੇ?",
  },
  kn: {
    minor:
      "ನಾನು ಈ ವಿಷಯದ ಬಗ್ಗೆ ಮಾತನಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ. ಆರೋಗ್ಯ ಅಥವಾ ಬೆಳವಣಿಗೆಯ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳಿದ್ದರೆ, ನಂಬಿಕಸ್ಥ ಹಿರಿಯರು, ಪಾಲಕರು ಅಥವಾ ಶಾಲಾ ಸಲಹೆಗಾರರಲ್ಲಿ ಕೇಳಿ. ಬೇರೇನಾದರೂ ಮಾತನಾಡಬೇಕೇ? 💙",
    general:
      "ಇದು ನನ್ನ ಸಹಾಯದ ವ್ಯಾಪ್ತಿಯಲ್ಲಿಲ್ಲ — ನಾನು ಭಾವನಾತ್ಮಕ ಬೆಂಬಲಕ್ಕಾಗಿ ಇಲ್ಲಿದ್ದೇನೆ. ಬೇರೇನಾದರೂ ಹೇಳಲು ಬಯಸುವಿರಾ?",
  },
  ml: {
    minor:
      "എനിക്ക് ഈ വിഷയത്തെക്കുറിച്ച് സംസാരിക്കാൻ സാധ്യമല്ല. ആരോഗ്യം അല്ലെങ്കിൽ വളർച്ചയെക്കുറിച്ച് ചോദ്യങ്ങൾ ഉണ്ടെങ്കിൽ, ഒരു വിശ്വസ്ത മുതിർന്നവർ, രക്ഷിതാവ് അല്ലെങ്കിൽ കൗൺസലർ സഹായിക്കും. മറ്റെന്തെങ്കിലും സംസാരിക്കണോ? 💙",
    general:
      "ഇത് എൻ്റെ സഹായ പരിധിയിൽ പെടുന്നില്ല — ഞാൻ വൈകാരിക പിന്തുണയ്ക്കായി ഇവിടെ ഉണ്ട്. മറ്റ് എന്തെങ്കിലും ഉണ്ടോ?",
  },
  or: {
    minor:
      "ମୁଁ ଏ ବିଷୟ ବାରେ କଥା ହୋଇ ପାରିବି ନାହିଁ। ସ୍ୱାସ୍ଥ୍ୟ ବା ବଢ଼ିବା ବାରେ ପ୍ରଶ୍ନ ଥିଲେ ବିଶ୍ୱସ୍ତ ବଡ଼, ଅଭିଭାବକ ବା ଶିକ୍ଷକଙ୍କ ସାହାଯ୍ୟ ନିଅ। ଅନ୍ୟ କୌଣସି କଥା ଅଛି? 💙",
    general:
      "ଏହା ମୋ ସାହାଯ୍ୟ ପରିସୀମାରେ ନାହିଁ — ମୁଁ ଭାବନାତ୍ମକ ସହାୟତା ପାଇଁ ଏଠି ଅଛି। ଅନ୍ୟ କିଛି ଅଛି କି?",
  },
  ur: {
    minor:
      "میں اس موضوع پر بات نہیں کر سکتا۔ اگر آپ کے ذہن میں صحت یا بڑے ہونے سے متعلق سوالات ہیں تو کسی قابل اعتماد بڑے، والدین یا اسکول کاؤنسلر سے بات کریں۔ کوئی اور بات ہو تو بتائیں! 💙",
    general:
      "یہ میری مدد کے دائرے میں نہیں ہے — میں جذباتی معاونت کے لیے یہاں ہوں۔ کوئی اور بات کرنا چاہتے ہیں؟",
  },
  ar: {
    minor:
      "لا أستطيع التحدث عن هذا الموضوع. إذا كانت لديك أسئلة عن صحتك أو النمو، تحدث مع شخص بالغ موثوق أو أحد والديك أو مستشار المدرسة. أنا هنا إذا أردت الحديث عن أي شيء آخر! 💙",
    general:
      "هذا ليس من اختصاصي — أنا هنا للدعم العاطفي. هل هناك شيء آخر تريد مناقشته؟",
  },
  zh: {
    minor:
      "我无法讨论这个话题。如果你对健康或成长有疑问，请和信任的大人、父母或学校辅导员谈谈。如果你想聊其他事情，我在这里！ 💙",
    general:
      "这不在我能帮助的范围内——我专注于情感支持。有其他想聊的吗？",
  },
  es: {
    minor:
      "No puedo hablar de ese tema. Si tienes preguntas sobre tu salud o crecer, habla con un adulto de confianza, tus padres o un orientador escolar. ¡Estoy aquí si quieres hablar de otra cosa! 💙",
    general:
      "Eso no es algo con lo que pueda ayudarte aquí — me enfoco en el bienestar emocional. ¿Hay algo más en tu mente?",
  },
  fr: {
    minor:
      "Je ne peux pas parler de ce sujet. Si tu as des questions sur ta santé ou ta croissance, parle à un adulte de confiance, tes parents ou un conseiller scolaire. Je suis là si tu veux discuter d'autre chose ! 💙",
    general:
      "Ce n'est pas quelque chose dont je peux t'aider ici — je me concentre sur le bien-être émotionnel. Y a-t-il autre chose dont tu voudrais parler ?",
  },
  pt: {
    minor:
      "Não posso falar sobre esse assunto. Se você tiver dúvidas sobre saúde ou crescimento, fale com um adulto de confiança, seus pais ou um orientador escolar. Estou aqui se quiser conversar sobre outra coisa! 💙",
    general:
      "Isso não é algo com que eu possa ajudar aqui — estou focado no bem-estar emocional. Há algo mais que você gostaria de conversar?",
  },
  ru: {
    minor:
      "Я не могу говорить на эту тему. Если у тебя есть вопросы о здоровье или взрослении, поговори с доверенным взрослым, родителями или школьным психологом. Я здесь, если хочешь поговорить о чём-то другом! 💙",
    general:
      "Это не то, с чем я могу помочь здесь — я сосредоточен на эмоциональном благополучии. Есть что-то ещё, о чём ты хотел бы поговорить?",
  },
  id: {
    minor:
      "Aku tidak bisa membicarakan topik itu. Kalau kamu punya pertanyaan tentang kesehatan atau tumbuh dewasa, bicaralah dengan orang dewasa yang dipercaya, orang tua, atau konselor sekolah. Aku di sini kalau mau ngobrol hal lain! 💙",
    general:
      "Itu bukan sesuatu yang bisa aku bantu di sini — aku fokus pada kesejahteraan emosional. Ada hal lain yang ingin kamu ceritakan?",
  },
};

const FALLBACK_REFUSAL: Record<AgeGroup, string> = REFUSALS.en;

export function buildAdultSafetyRefusal(
  lang: string,
  userAge?: string,
): string {
  const isMinor =
    userAge === "under_13" || userAge === "13_17";
  const group: AgeGroup = isMinor ? "minor" : "general";
  const langKey = (lang ?? "en").split(/[-_]/)[0].toLowerCase();
  const bank = REFUSALS[langKey] ?? FALLBACK_REFUSAL;
  return bank[group];
}
