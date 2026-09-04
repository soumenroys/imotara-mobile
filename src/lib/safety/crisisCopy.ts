// src/lib/safety/crisisCopy.ts
// The words on the crisis card, in every language Imotara ships (UX-01).
//
// Crisis DETECTION on mobile has been multilingual for a long time —
// CRISIS_HINT_REGEX covers 22 languages for tier 2, and the Indic tier-1
// patterns cover the rest. The card that appeared afterwards was hardcoded
// English. So someone writing "मुझे जीने का मन नहीं करता" was correctly
// recognised and then handed help they might not be able to read, at the exact
// moment reading is hardest.
//
// Two things are deliberate here.
//
// The phone numbers are NOT in this file. They come from
// getCrisisResourcesForCountry() and depend on where the person is, not what
// language they write in — an Indian user writing English still needs the
// Indian helpline.
//
// English is the fallback for an unknown language rather than an empty card.
// Help in a language you may not read still beats no help.

export type CrisisCopy = {
  /** Tier 1 — gentle. Heading and body. */
  t1Title: string;
  t1Body: string;
  /** Tier 2 — urgent. Heading and closing line above the numbers. */
  t2Title: string;
  t2Footer: string;
};

// Indic, Hebrew, Arabic, German and Japanese wording follows the web app's
// CRISIS_BANNER_BY_LANG so a person switching device sees the same voice.
const COPY: Record<string, CrisisCopy> = {
  en: {
    t1Title: "You don't have to carry this alone",
    t1Body: "It sounds like things are feeling really heavy. I'm here. If it ever feels like too much, free crisis support is just a call away.",
    t2Title: "If things feel urgent right now",
    t2Footer: "You don't have to face this alone.",
  },
  hi: {
    t1Title: "आपको यह अकेले नहीं झेलना है",
    t1Body: "लगता है अभी चीज़ें बहुत भारी लग रही हैं। मैं यहीं हूँ। अगर कभी यह बहुत ज़्यादा लगे, तो मुफ़्त सहायता बस एक कॉल दूर है।",
    t2Title: "अगर अभी हालात बहुत गंभीर लग रहे हैं",
    t2Footer: "आपको यह अकेले नहीं झेलना है।",
  },
  bn: {
    t1Title: "তোমাকে এটা একা বইতে হবে না",
    t1Body: "মনে হচ্ছে এখন সবকিছু অনেক ভারী লাগছে। আমি আছি। যদি কখনও খুব বেশি মনে হয়, বিনামূল্যে সহায়তা মাত্র একটা ফোন দূরে।",
    t2Title: "এখনই যদি খুব জরুরি মনে হয়",
    t2Footer: "তোমাকে একা এর মুখোমুখি হতে হবে না।",
  },
  mr: {
    t1Title: "हे एकट्याने झेलण्याची गरज नाही",
    t1Body: "वाटतंय आत्ता सगळं खूप जड वाटतंय. मी इथेच आहे. कधी खूप जास्त वाटलं, तर मोफत मदत फक्त एका कॉलवर आहे.",
    t2Title: "आत्ता खूप तातडीचं वाटत असेल तर",
    t2Footer: "याला एकट्याने सामोरं जाण्याची गरज नाही.",
  },
  ta: {
    t1Title: "இதை நீங்கள் தனியாக சுமக்க வேண்டியதில்லை",
    t1Body: "இப்போது எல்லாம் மிகவும் கனமாக இருப்பது போல் தெரிகிறது. நான் இங்கே இருக்கிறேன். மிகவும் அதிகமாக உணர்ந்தால், இலவச உதவி ஒரு அழைப்பு தூரத்தில் உள்ளது.",
    t2Title: "இப்போது மிக அவசரமாக உணர்ந்தால்",
    t2Footer: "இதை நீங்கள் தனியாக எதிர்கொள்ள வேண்டியதில்லை.",
  },
  te: {
    t1Title: "దీన్ని మీరు ఒంటరిగా మోయాల్సిన అవసరం లేదు",
    t1Body: "ఇప్పుడు అంతా చాలా బరువుగా అనిపిస్తోంది. నేను ఇక్కడే ఉన్నాను. ఎప్పుడైనా ఎక్కువగా అనిపిస్తే, ఉచిత సహాయం ఒక కాల్ దూరంలో ఉంది.",
    t2Title: "ఇప్పుడు చాలా అత్యవసరంగా అనిపిస్తే",
    t2Footer: "దీన్ని మీరు ఒంటరిగా ఎదుర్కోవాల్సిన అవసరం లేదు.",
  },
  kn: {
    t1Title: "ಇದನ್ನು ನೀವು ಒಂಟಿಯಾಗಿ ಹೊರಬೇಕಾಗಿಲ್ಲ",
    t1Body: "ಈಗ ಎಲ್ಲವೂ ತುಂಬಾ ಭಾರವಾಗಿ ಅನಿಸುತ್ತಿದೆ. ನಾನು ಇಲ್ಲಿದ್ದೇನೆ. ಎಂದಾದರೂ ತುಂಬಾ ಜಾಸ್ತಿ ಅನಿಸಿದರೆ, ಉಚಿತ ಸಹಾಯ ಒಂದು ಕರೆಯಷ್ಟು ದೂರದಲ್ಲಿದೆ.",
    t2Title: "ಈಗ ತುರ್ತು ಎನಿಸುತ್ತಿದ್ದರೆ",
    t2Footer: "ಇದನ್ನು ನೀವು ಒಂಟಿಯಾಗಿ ಎದುರಿಸಬೇಕಾಗಿಲ್ಲ.",
  },
  ml: {
    t1Title: "ഇത് നിങ്ങൾ ഒറ്റയ്ക്ക് വഹിക്കേണ്ടതില്ല",
    t1Body: "ഇപ്പോൾ എല്ലാം വളരെ ഭാരമുള്ളതായി തോന്നുന്നു. ഞാൻ ഇവിടെയുണ്ട്. എപ്പോഴെങ്കിലും അധികമായി തോന്നിയാൽ, സൗജന്യ സഹായം ഒരു വിളി അകലെയാണ്.",
    t2Title: "ഇപ്പോൾ അടിയന്തിരമായി തോന്നുന്നുവെങ്കിൽ",
    t2Footer: "ഇത് നിങ്ങൾ ഒറ്റയ്ക്ക് നേരിടേണ്ടതില്ല.",
  },
  gu: {
    t1Title: "આ તમારે એકલા ઝીલવું નથી પડતું",
    t1Body: "લાગે છે અત્યારે બધું ઘણું ભારે લાગી રહ્યું છે. હું અહીં જ છું. ક્યારેય ઘણું વધારે લાગે, તો મફત મદદ માત્ર એક કૉલ દૂર છે.",
    t2Title: "જો અત્યારે ખૂબ તાત્કાલિક લાગતું હોય",
    t2Footer: "આનો સામનો તમારે એકલા કરવો પડતો નથી.",
  },
  pa: {
    t1Title: "ਇਹ ਤੁਹਾਨੂੰ ਇਕੱਲੇ ਨਹੀਂ ਝੱਲਣਾ ਪੈਂਦਾ",
    t1Body: "ਲੱਗਦਾ ਹੈ ਹੁਣ ਸਭ ਕੁਝ ਬਹੁਤ ਭਾਰਾ ਲੱਗ ਰਿਹਾ ਹੈ। ਮੈਂ ਇੱਥੇ ਹਾਂ। ਜੇ ਕਦੇ ਬਹੁਤ ਜ਼ਿਆਦਾ ਲੱਗੇ, ਤਾਂ ਮੁਫ਼ਤ ਮਦਦ ਸਿਰਫ਼ ਇੱਕ ਕਾਲ ਦੂਰ ਹੈ।",
    t2Title: "ਜੇ ਹੁਣ ਹਾਲਾਤ ਬਹੁਤ ਗੰਭੀਰ ਲੱਗ ਰਹੇ ਹਨ",
    t2Footer: "ਇਸ ਦਾ ਸਾਹਮਣਾ ਤੁਹਾਨੂੰ ਇਕੱਲੇ ਨਹੀਂ ਕਰਨਾ ਪੈਂਦਾ।",
  },
  or: {
    t1Title: "ଏହା ଆପଣଙ୍କୁ ଏକୁଟିଆ ସହିବାକୁ ପଡ଼ିବ ନାହିଁ",
    t1Body: "ମନେ ହେଉଛି ଏବେ ସବୁ ବହୁତ ଭାରୀ ଲାଗୁଛି। ମୁଁ ଏଠାରେ ଅଛି। ଯଦି କେବେ ଅତ୍ୟଧିକ ଲାଗେ, ମାଗଣା ସହାୟତା କେବଳ ଗୋଟିଏ କଲ ଦୂରରେ।",
    t2Title: "ଯଦି ଏବେ ଅତ୍ୟନ୍ତ ଜରୁରୀ ଲାଗୁଛି",
    t2Footer: "ଏହାର ସାମ୍ନା ଆପଣଙ୍କୁ ଏକୁଟିଆ କରିବାକୁ ପଡ଼ିବ ନାହିଁ।",
  },
  ur: {
    t1Title: "آپ کو یہ اکیلے نہیں سہنا پڑتا",
    t1Body: "لگتا ہے ابھی سب کچھ بہت بھاری محسوس ہو رہا ہے۔ میں یہیں ہوں۔ اگر کبھی یہ بہت زیادہ لگے، تو مفت مدد صرف ایک کال کے فاصلے پر ہے۔",
    t2Title: "اگر ابھی حالات بہت سنگین لگ رہے ہیں",
    t2Footer: "آپ کو اس کا سامنا اکیلے نہیں کرنا پڑتا۔",
  },
  ar: {
    t1Title: "لست مضطراً لتحمّل هذا وحدك",
    t1Body: "يبدو أن الأمور ثقيلة جداً الآن. أنا هنا. وإذا شعرت في أي وقت أن الأمر أكبر من احتمالك، فالدعم المجاني على بُعد مكالمة واحدة.",
    t2Title: "إذا كان الوضع عاجلاً الآن",
    t2Footer: "لست مضطراً لمواجهة هذا وحدك.",
  },
  he: {
    t1Title: "אתה לא צריך לשאת את זה לבד",
    t1Body: "נשמע שהדברים מרגישים כבדים מאוד כרגע. אני כאן. אם אי פעם זה מרגיש יותר מדי, תמיכה חינמית נמצאת במרחק שיחה אחת.",
    t2Title: "אם המצב דחוף כרגע",
    t2Footer: "אתה לא צריך להתמודד עם זה לבד.",
  },
  de: {
    t1Title: "Du musst das nicht allein tragen",
    t1Body: "Es klingt, als wäre gerade alles sehr schwer. Ich bin da. Wenn es jemals zu viel wird — kostenlose Hilfe ist nur einen Anruf entfernt.",
    t2Title: "Wenn es sich gerade dringend anfühlt",
    t2Footer: "Du musst dem nicht allein begegnen.",
  },
  ja: {
    t1Title: "ひとりで抱えなくて大丈夫です",
    t1Body: "今、とても重く感じているようですね。私はここにいます。もし抱えきれないと感じたら、無料の相談窓口が電話一本で利用できます。",
    t2Title: "今、緊急だと感じているなら",
    t2Footer: "ひとりで向き合わなくて大丈夫です。",
  },
  es: {
    t1Title: "No tienes que cargar con esto solo",
    t1Body: "Parece que ahora mismo todo se siente muy pesado. Estoy aquí. Si en algún momento es demasiado, hay ayuda gratuita a una llamada de distancia.",
    t2Title: "Si ahora mismo sientes que es urgente",
    t2Footer: "No tienes que enfrentarte a esto solo.",
  },
  fr: {
    t1Title: "Tu n'as pas à porter ça tout seul",
    t1Body: "On dirait que tout est très lourd en ce moment. Je suis là. Si jamais c'est trop, une aide gratuite est à un appel près.",
    t2Title: "Si la situation semble urgente maintenant",
    t2Footer: "Tu n'as pas à affronter ça tout seul.",
  },
  pt: {
    t1Title: "Você não precisa carregar isso sozinho",
    t1Body: "Parece que tudo está muito pesado agora. Estou aqui. Se em algum momento for demais, existe ajuda gratuita a uma ligação de distância.",
    t2Title: "Se agora parece urgente",
    t2Footer: "Você não precisa enfrentar isso sozinho.",
  },
  ru: {
    t1Title: "Вам не нужно нести это в одиночку",
    t1Body: "Кажется, сейчас всё ощущается очень тяжело. Я рядом. Если когда-нибудь станет невыносимо, бесплатная помощь — на расстоянии одного звонка.",
    t2Title: "Если сейчас всё кажется срочным",
    t2Footer: "Вам не нужно справляться с этим в одиночку.",
  },
  zh: {
    t1Title: "你不必独自承受这一切",
    t1Body: "听起来现在一切都很沉重。我在这里。如果什么时候觉得撑不住了，免费的援助只需一个电话。",
    t2Title: "如果现在情况紧急",
    t2Footer: "你不必独自面对这一切。",
  },
  id: {
    t1Title: "Kamu tidak harus menanggung ini sendirian",
    t1Body: "Sepertinya semuanya terasa sangat berat sekarang. Aku di sini. Kalau sewaktu-waktu terasa terlalu berat, bantuan gratis hanya sejauh satu panggilan.",
    t2Title: "Kalau saat ini terasa mendesak",
    t2Footer: "Kamu tidak harus menghadapi ini sendirian.",
  },
};

/**
 * Copy for a language, falling back to English.
 *
 * Accepts region tags ("pt-BR", "zh-Hans") by taking the part before the dash —
 * the stored preference is a bare code today, but a device locale is not, and
 * this is called from a crisis path where a near-miss must not become a blank.
 */
export function getCrisisCopy(lang?: string | null): CrisisCopy {
  const base = (lang ?? "en").toLowerCase().split(/[-_]/)[0];
  return COPY[base] ?? COPY.en;
}

/** Languages with their own crisis copy, for tests and for the KB. */
export const CRISIS_COPY_LANGS = Object.keys(COPY);
