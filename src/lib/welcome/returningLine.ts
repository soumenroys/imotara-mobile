// returningLine.ts — the first line someone sees when they COME BACK to a chat.
// "Last time you were feeling low. How are you doing today?" (#77c, owner 7 Nov 2026)
//
// ⚠️ ONE FILE, TWO REPOS, BYTE-IDENTICAL:
//    imotaraapp      src/lib/imotara/returningLine.ts
//    imotara-mobile  src/lib/welcome/returningLine.ts
// The web test (returningLine.test.ts) fails if they differ. No imports on
// purpose: each platform passes in its OWN detectors (crisis union, sad,
// stress, anger), so this file never has to agree on them.
//
// 🔑 WHY: before this, mobile said it in English only (from English keywords)
// and the web said a generic "welcome back" in 12 of 22 languages. A Bengali
// speaker coming back got English, or nothing about how they had been.
//
// ⛔ RULES:
//  • a crisis in their recent messages ⇒ NEVER name a feeling or topic — only
//    "I'm glad you're back. How are you doing right now?";
//  • the line is about a FEELING, never quotes what they wrote (someone else
//    may be looking at the screen);
//  • no feeling found ⇒ a plain welcome, never a guess.

export type ReturningFeeling = "crisis" | "sad" | "stressed" | "angry" | "heavy" | "plain";

export type FeelingDetectors = {
  isCrisis: (text: string) => boolean;
  isSad: (text: string) => boolean;
  isStressed: (text: string) => boolean;
  isAngry: (text: string) => boolean;
};

/** How many of their last messages are read. */
export const RECENT_USER_MESSAGES = 4;

/**
 * Their last messages (oldest → newest) ⇒ the feeling to mention.
 * A crisis in ANY of them wins. Otherwise the NEWEST message with a feeling
 * decides. `heavyHint` = the platform's own "things seemed heavy" signal.
 */
export function returningFeeling(userTexts: string[], d: FeelingDetectors, heavyHint = false): ReturningFeeling {
  const recent = userTexts.filter((t) => typeof t === "string" && t.trim()).slice(-RECENT_USER_MESSAGES);
  if (recent.some((t) => d.isCrisis(t))) return "crisis";
  for (let i = recent.length - 1; i >= 0; i--) {
    const t = recent[i];
    if (d.isSad(t)) return "sad";
    if (d.isStressed(t)) return "stressed";
    if (d.isAngry(t)) return "angry";
  }
  return heavyHint ? "heavy" : "plain";
}

type Lines = Record<ReturningFeeling, string>;

export const RETURNING_LINES: Record<string, Lines> = {
  en: {
    sad: "Last time you were feeling low. How are you doing today?",
    stressed: "Last time you were carrying some worry. How is that sitting with you now?",
    angry: "Last time something had really upset you. How have things been since?",
    heavy: "Last time we talked, things seemed a little heavy. How are you doing now?",
    crisis: "I'm glad you're back. How are you doing right now?",
    plain: "Good to have you back. How has your day been?",
  },
  hi: {
    sad: "पिछली बार आपका मन उदास था। आज कैसा लग रहा है?",
    stressed: "पिछली बार आपके मन पर कुछ चिंता थी। अब वह कैसी है?",
    angry: "पिछली बार किसी बात ने आपको बहुत परेशान किया था। तब से कैसा चल रहा है?",
    heavy: "पिछली बार बात करते समय मन थोड़ा भारी लगा था। अब कैसा है?",
    crisis: "आपके लौटने से अच्छा लगा। अभी आपका हाल कैसा है?",
    plain: "आपको फिर देखकर अच्छा लगा। आज का दिन कैसा रहा?",
  },
  bn: {
    sad: "গতবার আপনার মন খারাপ ছিল। আজ কেমন আছেন?",
    stressed: "গতবার আপনার মনে কিছু দুশ্চিন্তা ছিল। এখন সেটা কেমন?",
    angry: "গতবার কোনো একটা ব্যাপারে আপনি খুব বিরক্ত হয়েছিলেন। তারপর থেকে কেমন চলছে?",
    heavy: "গতবার কথা বলার সময় মনটা একটু ভারী লাগছিল। এখন কেমন আছেন?",
    crisis: "আপনি ফিরে এসেছেন, ভালো লাগল। এখন কেমন আছেন?",
    plain: "আবার দেখা হয়ে ভালো লাগল। আজকের দিনটা কেমন গেল?",
  },
  mr: {
    sad: "मागच्या वेळी तुमचं मन उदास होतं. आज कसं वाटतंय?",
    stressed: "मागच्या वेळी तुमच्या मनावर थोडी काळजी होती. आता ती कशी आहे?",
    angry: "मागच्या वेळी एखाद्या गोष्टीचा तुम्हाला खूप त्रास झाला होता. तेव्हापासून कसं चाललंय?",
    heavy: "मागच्या वेळी बोलताना मन थोडं जड वाटत होतं. आता कसं आहे?",
    crisis: "तुम्ही परत आलात, बरं वाटलं. आत्ता कसं वाटतंय?",
    plain: "पुन्हा भेटून बरं वाटलं. आजचा दिवस कसा गेला?",
  },
  ta: {
    sad: "கடந்த முறை உங்கள் மனம் சோர்வாக இருந்தது. இன்று எப்படி இருக்கிறீர்கள்?",
    stressed: "கடந்த முறை உங்கள் மனதில் கொஞ்சம் கவலை இருந்தது. இப்போது அது எப்படி இருக்கிறது?",
    angry: "கடந்த முறை ஏதோ ஒன்று உங்களை மிகவும் வருத்தப்படுத்தியிருந்தது. அதன் பிறகு எப்படி போகிறது?",
    heavy: "கடந்த முறை பேசும்போது மனம் கொஞ்சம் கனமாக இருந்தது. இப்போது எப்படி இருக்கிறீர்கள்?",
    crisis: "நீங்கள் திரும்பி வந்தது மகிழ்ச்சி. இப்போது எப்படி இருக்கிறீர்கள்?",
    plain: "மீண்டும் சந்தித்தது மகிழ்ச்சி. இன்றைய நாள் எப்படி இருந்தது?",
  },
  te: {
    sad: "గతసారి మీ మనసు బాధగా ఉంది. ఈ రోజు ఎలా ఉన్నారు?",
    stressed: "గతసారి మీ మనసులో కొంచెం ఆందోళన ఉంది. ఇప్పుడు అది ఎలా ఉంది?",
    angry: "గతసారి ఏదో విషయం మిమ్మల్ని చాలా బాధపెట్టింది. అప్పటి నుండి ఎలా సాగుతోంది?",
    heavy: "గతసారి మాట్లాడినప్పుడు మనసు కొంచెం బరువుగా అనిపించింది. ఇప్పుడు ఎలా ఉన్నారు?",
    crisis: "మీరు తిరిగి వచ్చినందుకు సంతోషం. ఇప్పుడు ఎలా ఉన్నారు?",
    plain: "మళ్ళీ కలిసినందుకు సంతోషం. ఈ రోజు ఎలా గడిచింది?",
  },
  gu: {
    sad: "ગયા વખતે તમારું મન ઉદાસ હતું. આજે કેવું લાગે છે?",
    stressed: "ગયા વખતે તમારા મનમાં થોડી ચિંતા હતી. હવે તે કેવી છે?",
    angry: "ગયા વખતે કોઈ વાતથી તમને ખૂબ તકલીફ થઈ હતી. ત્યારથી કેવું ચાલે છે?",
    heavy: "ગયા વખતે વાત કરતી વખતે મન થોડું ભારે લાગતું હતું. હવે કેવું છે?",
    crisis: "તમે પાછા આવ્યા, સારું લાગ્યું. અત્યારે કેવું લાગે છે?",
    plain: "ફરી મળીને આનંદ થયો. આજનો દિવસ કેવો રહ્યો?",
  },
  kn: {
    sad: "ಕಳೆದ ಬಾರಿ ನಿಮ್ಮ ಮನಸ್ಸು ಬೇಸರದಲ್ಲಿತ್ತು. ಇಂದು ಹೇಗಿದ್ದೀರಿ?",
    stressed: "ಕಳೆದ ಬಾರಿ ನಿಮ್ಮ ಮನಸ್ಸಿನಲ್ಲಿ ಸ್ವಲ್ಪ ಚಿಂತೆ ಇತ್ತು. ಈಗ ಅದು ಹೇಗಿದೆ?",
    angry: "ಕಳೆದ ಬಾರಿ ಯಾವುದೋ ವಿಷಯ ನಿಮಗೆ ತುಂಬಾ ಬೇಸರ ತಂದಿತ್ತು. ಅಂದಿನಿಂದ ಹೇಗೆ ನಡೆಯುತ್ತಿದೆ?",
    heavy: "ಕಳೆದ ಬಾರಿ ಮಾತನಾಡುವಾಗ ಮನಸ್ಸು ಸ್ವಲ್ಪ ಭಾರವಾಗಿತ್ತು. ಈಗ ಹೇಗಿದ್ದೀರಿ?",
    crisis: "ನೀವು ಮರಳಿ ಬಂದದ್ದು ಸಂತೋಷ. ಈಗ ಹೇಗಿದ್ದೀರಿ?",
    plain: "ಮತ್ತೆ ಭೇಟಿಯಾಗಿದ್ದು ಸಂತೋಷ. ಇಂದಿನ ದಿನ ಹೇಗಿತ್ತು?",
  },
  ml: {
    sad: "കഴിഞ്ഞ തവണ നിങ്ങളുടെ മനസ്സ് വിഷമത്തിലായിരുന്നു. ഇന്ന് എങ്ങനെയുണ്ട്?",
    stressed: "കഴിഞ്ഞ തവണ നിങ്ങളുടെ മനസ്സിൽ കുറച്ച് ആശങ്ക ഉണ്ടായിരുന്നു. ഇപ്പോൾ അത് എങ്ങനെയുണ്ട്?",
    angry: "കഴിഞ്ഞ തവണ എന്തോ ഒന്ന് നിങ്ങളെ വല്ലാതെ അസ്വസ്ഥരാക്കിയിരുന്നു. അതിനുശേഷം എങ്ങനെ പോകുന്നു?",
    heavy: "കഴിഞ്ഞ തവണ സംസാരിക്കുമ്പോൾ മനസ്സ് അൽപ്പം ഭാരമുള്ളതായി തോന്നി. ഇപ്പോൾ എങ്ങനെയുണ്ട്?",
    crisis: "നിങ്ങൾ തിരിച്ചുവന്നതിൽ സന്തോഷം. ഇപ്പോൾ എങ്ങനെയുണ്ട്?",
    plain: "വീണ്ടും കണ്ടതിൽ സന്തോഷം. ഇന്നത്തെ ദിവസം എങ്ങനെയായിരുന്നു?",
  },
  pa: {
    sad: "ਪਿਛਲੀ ਵਾਰ ਤੁਹਾਡਾ ਮਨ ਉਦਾਸ ਸੀ। ਅੱਜ ਕਿਵੇਂ ਲੱਗ ਰਿਹਾ ਹੈ?",
    stressed: "ਪਿਛਲੀ ਵਾਰ ਤੁਹਾਡੇ ਮਨ ਵਿੱਚ ਕੁਝ ਚਿੰਤਾ ਸੀ। ਹੁਣ ਉਹ ਕਿਵੇਂ ਹੈ?",
    angry: "ਪਿਛਲੀ ਵਾਰ ਕਿਸੇ ਗੱਲ ਨੇ ਤੁਹਾਨੂੰ ਬਹੁਤ ਪਰੇਸ਼ਾਨ ਕੀਤਾ ਸੀ। ਉਦੋਂ ਤੋਂ ਕਿਵੇਂ ਚੱਲ ਰਿਹਾ ਹੈ?",
    heavy: "ਪਿਛਲੀ ਵਾਰ ਗੱਲ ਕਰਦਿਆਂ ਮਨ ਥੋੜ੍ਹਾ ਭਾਰੀ ਲੱਗ ਰਿਹਾ ਸੀ। ਹੁਣ ਕਿਵੇਂ ਹੈ?",
    crisis: "ਤੁਸੀਂ ਵਾਪਸ ਆਏ, ਚੰਗਾ ਲੱਗਾ। ਹੁਣ ਤੁਹਾਡਾ ਹਾਲ ਕਿਵੇਂ ਹੈ?",
    plain: "ਫਿਰ ਮਿਲ ਕੇ ਚੰਗਾ ਲੱਗਾ। ਅੱਜ ਦਾ ਦਿਨ ਕਿਵੇਂ ਰਿਹਾ?",
  },
  or: {
    sad: "ଗତଥର ଆପଣଙ୍କ ମନ ଦୁଃଖୀ ଥିଲା। ଆଜି କେମିତି ଲାଗୁଛି?",
    stressed: "ଗତଥର ଆପଣଙ୍କ ମନରେ କିଛି ଚିନ୍ତା ଥିଲା। ଏବେ ତାହା କେମିତି ଅଛି?",
    angry: "ଗତଥର କିଛି କଥା ଆପଣଙ୍କୁ ବହୁତ ବିବ୍ରତ କରିଥିଲା। ସେବେଠୁ କେମିତି ଚାଲିଛି?",
    heavy: "ଗତଥର କଥା ହେବା ବେଳେ ମନ ଟିକେ ଭାରି ଲାଗୁଥିଲା। ଏବେ କେମିତି ଅଛନ୍ତି?",
    crisis: "ଆପଣ ଫେରିଆସିଲେ, ଭଲ ଲାଗିଲା। ଏବେ କେମିତି ଅଛନ୍ତି?",
    plain: "ପୁଣି ଦେଖା ହୋଇ ଭଲ ଲାଗିଲା। ଆଜିର ଦିନ କେମିତି ଗଲା?",
  },
  ur: {
    sad: "پچھلی بار آپ کا دل اداس تھا۔ آج کیسا محسوس ہو رہا ہے؟",
    stressed: "پچھلی بار آپ کے دل پر کچھ فکر تھی۔ اب وہ کیسی ہے؟",
    angry: "پچھلی بار کسی بات نے آپ کو بہت پریشان کیا تھا۔ تب سے کیسا چل رہا ہے؟",
    heavy: "پچھلی بار بات کرتے ہوئے دل کچھ بوجھل لگ رہا تھا۔ اب کیسا ہے؟",
    crisis: "آپ واپس آئے، اچھا لگا۔ ابھی آپ کا حال کیسا ہے؟",
    plain: "آپ کو دوبارہ دیکھ کر اچھا لگا۔ آج کا دن کیسا رہا؟",
  },
  ar: {
    sad: "في المرة الماضية بدا أن قلبك حزين. كيف حالك اليوم؟",
    stressed: "في المرة الماضية كان في قلبك بعض القلق. كيف هو الآن؟",
    angry: "في المرة الماضية أزعجك أمر ما كثيرًا. كيف تسير الأمور منذ ذلك الحين؟",
    heavy: "في حديثنا الأخير بدت الأمور ثقيلة بعض الشيء. كيف حالك الآن؟",
    crisis: "يسعدني أنك عدت. كيف حالك الآن؟",
    plain: "يسعدني أن أراك مجددًا. كيف كان يومك؟",
  },
  ru: {
    sad: "В прошлый раз вам было грустно. Как вы сегодня?",
    stressed: "В прошлый раз вас что-то тревожило. Как с этим сейчас?",
    angry: "В прошлый раз что-то сильно вас расстроило. Как всё с тех пор?",
    heavy: "В прошлый раз на душе было тяжеловато. Как вы сейчас?",
    crisis: "Хорошо, что вы вернулись. Как вы сейчас?",
    plain: "Хорошо, что вы снова здесь. Как прошёл ваш день?",
  },
  zh: {
    sad: "上次你心情有些低落。今天感觉怎么样？",
    stressed: "上次你心里有些担忧。现在怎么样了？",
    angry: "上次有件事让你很不开心。之后怎么样了？",
    heavy: "上次聊天时，你的心情有点沉重。现在还好吗？",
    crisis: "很高兴你回来了。你现在怎么样？",
    plain: "很高兴再见到你。今天过得怎么样？",
  },
  ja: {
    sad: "前回は気持ちが沈んでいるようでしたね。今日はいかがですか？",
    stressed: "前回は少し心配事を抱えていましたね。今はどうですか？",
    angry: "前回は何かでとても嫌な思いをしていましたね。その後はいかがですか？",
    heavy: "前回お話ししたとき、少し気持ちが重そうでした。今はいかがですか？",
    crisis: "また来てくれてうれしいです。今はどんな気持ちですか？",
    plain: "また会えてうれしいです。今日はどんな一日でしたか？",
  },
  es: {
    sad: "La última vez tenías el ánimo bajo. ¿Cómo estás hoy?",
    stressed: "La última vez algo te preocupaba. ¿Cómo va eso ahora?",
    angry: "La última vez algo te había molestado mucho. ¿Cómo han ido las cosas desde entonces?",
    heavy: "La última vez que hablamos, las cosas se sentían un poco pesadas. ¿Cómo estás ahora?",
    crisis: "Me alegra que hayas vuelto. ¿Cómo estás ahora?",
    plain: "Qué bueno verte de nuevo. ¿Qué tal tu día?",
  },
  fr: {
    sad: "La dernière fois, vous aviez le moral un peu bas. Comment allez-vous aujourd'hui ?",
    stressed: "La dernière fois, quelque chose vous inquiétait. Où en êtes-vous maintenant ?",
    angry: "La dernière fois, quelque chose avait suscité beaucoup de colère en vous. Comment ça se passe depuis ?",
    heavy: "La dernière fois que nous avons parlé, les choses semblaient un peu lourdes. Comment allez-vous maintenant ?",
    crisis: "C'est bien de vous retrouver. Comment allez-vous en ce moment ?",
    plain: "Quel plaisir de vous revoir. Comment s'est passée votre journée ?",
  },
  de: {
    sad: "Letztes Mal warst du ziemlich niedergeschlagen. Wie geht es dir heute?",
    stressed: "Letztes Mal hat dich etwas beunruhigt. Wie ist das jetzt?",
    angry: "Letztes Mal hat dich etwas sehr aufgeregt. Wie läuft es seitdem?",
    heavy: "Als wir zuletzt gesprochen haben, war es etwas schwer. Wie geht es dir jetzt?",
    crisis: "Schön, dass du wieder da bist. Wie geht es dir gerade?",
    plain: "Schön, dich wiederzusehen. Wie war dein Tag?",
  },
  pt: {
    sad: "Da última vez, você estava com o ânimo baixo. Como você está hoje?",
    stressed: "Da última vez, algo estava te preocupando. Como está isso agora?",
    angry: "Da última vez, algo tinha te incomodado muito. Como as coisas têm ido desde então?",
    heavy: "Da última vez que conversamos, as coisas pareciam um pouco pesadas. Como você está agora?",
    crisis: "Que bom que você voltou. Como você está agora?",
    plain: "Que bom te ver de novo. Como foi o seu dia?",
  },
  id: {
    sad: "Terakhir kali kamu sedang merasa sedih. Bagaimana kabarmu hari ini?",
    stressed: "Terakhir kali ada sesuatu yang membuatmu cemas. Bagaimana sekarang?",
    angry: "Terakhir kali ada sesuatu yang sangat mengganggumu. Bagaimana keadaannya sejak itu?",
    heavy: "Waktu terakhir kita bicara, rasanya agak berat. Bagaimana kabarmu sekarang?",
    crisis: "Senang kamu kembali. Bagaimana kabarmu sekarang?",
    plain: "Senang bertemu lagi. Bagaimana harimu?",
  },
  he: {
    sad: "בפעם הקודמת היה לך עצוב. מה שלומך היום?",
    stressed: "בפעם הקודמת משהו הדאיג אותך. איך זה עכשיו?",
    angry: "בפעם הקודמת משהו מאוד הרגיז אותך. איך הדברים מאז?",
    heavy: "כשדיברנו בפעם הקודמת, היה קצת כבד. מה שלומך עכשיו?",
    crisis: "טוב שחזרת. מה שלומך עכשיו?",
    plain: "טוב לראות אותך שוב. איך עבר היום?",
  },
};

export const RETURNING_LANGS = Object.keys(RETURNING_LINES);

/** "bn-IN" / "BN" ⇒ "bn"; unknown or "auto" ⇒ null. */
export function returningLangOf(lang: string | null | undefined): string | null {
  const base = String(lang ?? "").split(/[-_]/)[0].toLowerCase();
  return base && base !== "auto" && RETURNING_LINES[base] ? base : null;
}

/**
 * The line, in the person's language: their chosen chat language, else the
 * language of what they last wrote (`scriptLang`), else English.
 */
export function returningLine(feeling: ReturningFeeling, preferredLang?: string | null, scriptLang?: string | null): string {
  const lang = returningLangOf(preferredLang) ?? returningLangOf(scriptLang) ?? "en";
  return RETURNING_LINES[lang][feeling];
}
