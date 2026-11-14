// src/licensing/graceNoticeText.ts
// "Your last payment for Imotara Plus didn't go through" — the billing grace
// banner and its button in all 22 languages (#85, 11 Nov 2026).
//
// ⚠️ MIRROR of imotaraapp src/lib/imotara/graceNoticeText.ts — byte-for-byte
// from the GRACE_LANGS line down (test on both sides). Edit the web file first,
// then copy. English is the owner-approved text of 6 Nov, word for word.

export const GRACE_LANGS = ["en", "hi", "bn", "mr", "ta", "te", "gu", "kn", "ml", "pa", "or", "ur", "ar", "ru", "zh", "ja", "es", "fr", "de", "pt", "id", "he"] as const;

export type GraceStore = "apple" | "google_play";
type By = Record<GraceStore, string>;
/** What every sentence may use: the store key, its name, and the date already written in the language. */
export type GraceCtx = { k: GraceStore; store: string; when: string };

type GraceText = {
    subject: string;
    banner: (c: GraceCtx) => string;
    button: (c: GraceCtx) => string;
    greet: string;
    /** "didn't go through … Nothing is lost: Plus stays on until … while the store tries again." */
    lost: (c: GraceCtx) => string;
    /** "To keep it, please check the card or payment method in your … subscriptions:" */
    check: (c: GraceCtx) => string;
    /** "If you meant to stop Plus, you don't need to do anything — Imotara stays free to use." */
    stop: string;
    sign: string;
};

const STORE_NAME: By = { apple: "App Store", google_play: "Google Play" };

const EN_ON: By = { apple: "in the App Store", google_play: "on Google Play" };
const EN_THE: By = { apple: "the App Store", google_play: "Google Play" };
const EN_BTN: By = { apple: "Update payment in the App Store", google_play: "Update payment in Google Play" };
const BN_ON: By = { apple: "App Store-এ", google_play: "Google Play-তে" };
const ML_ON: By = { apple: "App Store-ൽ", google_play: "Google Play-ൽ" };
const AR_ON: By = { apple: "عبر App Store", google_play: "عبر Google Play" };
const RU_ON: By = { apple: "в App Store", google_play: "в Google Play" };
const ZH_ON: By = { apple: "在 App Store 上", google_play: "在 Google Play 上" };
const ES_ON: By = { apple: "a través de App Store", google_play: "a través de Google Play" };
const FR_ON: By = { apple: "via l'App Store", google_play: "via Google Play" };
const FR_IN: By = { apple: "dans l'App Store", google_play: "dans Google Play" };
const FR_THE: By = { apple: "l'App Store", google_play: "Google Play" };
const DE_ON: By = { apple: "im App Store", google_play: "bei Google Play" };
const DE_THE: By = { apple: "der App Store", google_play: "Google Play" };
const PT_ON: By = { apple: "na App Store", google_play: "no Google Play" };
const PT_THE: By = { apple: "a App Store", google_play: "o Google Play" };
const HE_ON: By = { apple: "ב-App Store", google_play: "ב-Google Play" };

export const GRACE: Record<string, GraceText> = {
    en: {
        subject: "Your Imotara Plus payment didn't go through",
        banner: (c) => `Your last payment for Imotara Plus didn't go through ${EN_ON[c.k]}. Plus stays on until ${c.when} — update your payment method to keep it.`,
        button: (c) => EN_BTN[c.k],
        greet: "Hi,",
        lost: (c) => `Your last payment for Imotara Plus didn't go through ${EN_ON[c.k]}. Nothing is lost: Plus stays on until ${c.when} while ${EN_THE[c.k]} tries again.`,
        check: (c) => `To keep it, please check the card or payment method in your ${c.store} subscriptions:`,
        stop: "If you meant to stop Plus, you don't need to do anything — Imotara stays free to use.",
        sign: "— The Imotara team",
    },
    hi: {
        subject: "आपका Imotara Plus भुगतान नहीं हो पाया",
        banner: (c) => `Imotara Plus के लिए आपका पिछला भुगतान ${c.store} पर नहीं हो पाया। Plus ${c.when} तक चालू रहेगा — इसे जारी रखने के लिए अपने भुगतान का तरीका अपडेट करें।`,
        button: (c) => `${c.store} में भुगतान अपडेट करें`,
        greet: "नमस्ते,",
        lost: (c) => `Imotara Plus के लिए आपका पिछला भुगतान ${c.store} पर नहीं हो पाया। कुछ भी खोया नहीं है: जब तक ${c.store} दोबारा कोशिश करता है, Plus ${c.when} तक चालू रहेगा।`,
        check: (c) => `इसे जारी रखने के लिए, कृपया अपने ${c.store} सब्सक्रिप्शन में कार्ड या भुगतान का तरीका जाँच लें:`,
        stop: "अगर आप Plus बंद करना चाहते थे, तो आपको कुछ भी करने की ज़रूरत नहीं है — Imotara मुफ़्त में इस्तेमाल होता रहेगा।",
        sign: "— Imotara टीम",
    },
    bn: {
        subject: "আপনার Imotara Plus-এর পেমেন্ট সম্পন্ন হয়নি",
        banner: (c) => `Imotara Plus-এর জন্য আপনার শেষ পেমেন্টটি ${BN_ON[c.k]} সম্পন্ন হয়নি। ${c.when} পর্যন্ত Plus চালু থাকবে — এটি চালু রাখতে আপনার পেমেন্টের পদ্ধতি আপডেট করুন।`,
        button: (c) => `${BN_ON[c.k]} পেমেন্ট আপডেট করুন`,
        greet: "নমস্কার,",
        lost: (c) => `Imotara Plus-এর জন্য আপনার শেষ পেমেন্টটি ${BN_ON[c.k]} সম্পন্ন হয়নি। কিছুই হারায়নি: ${c.store} আবার চেষ্টা করার সময় ${c.when} পর্যন্ত Plus চালু থাকবে।`,
        check: (c) => `এটি চালু রাখতে, অনুগ্রহ করে আপনার ${c.store} সাবস্ক্রিপশনে কার্ড বা পেমেন্টের পদ্ধতিটি দেখে নিন:`,
        stop: "আপনি যদি Plus বন্ধ করতে চেয়ে থাকেন, তাহলে কিছুই করতে হবে না — Imotara বিনামূল্যে ব্যবহার করা যাবে।",
        sign: "— Imotara টিম",
    },
    mr: {
        subject: "तुमचे Imotara Plus पेमेंट पूर्ण झाले नाही",
        banner: (c) => `Imotara Plus साठी तुमचे मागील पेमेंट ${c.store} वर पूर्ण झाले नाही. Plus ${c.when} पर्यंत सुरू राहील — ते सुरू ठेवण्यासाठी तुमची पेमेंट पद्धत अपडेट करा.`,
        button: (c) => `${c.store} मध्ये पेमेंट अपडेट करा`,
        greet: "नमस्कार,",
        lost: (c) => `Imotara Plus साठी तुमचे मागील पेमेंट ${c.store} वर पूर्ण झाले नाही. काहीही गमावलेले नाही: ${c.store} पुन्हा प्रयत्न करत असताना Plus ${c.when} पर्यंत सुरू राहील.`,
        check: (c) => `ते सुरू ठेवण्यासाठी, कृपया तुमच्या ${c.store} सबस्क्रिप्शनमध्ये कार्ड किंवा पेमेंट पद्धत तपासा:`,
        stop: "तुम्हाला Plus बंद करायचे असल्यास, काहीही करण्याची गरज नाही — Imotara मोफत वापरता येत राहील.",
        sign: "— Imotara टीम",
    },
    ta: {
        subject: "உங்கள் Imotara Plus கட்டணம் செலுத்தப்படவில்லை",
        banner: (c) => `Imotara Plus-க்கான உங்கள் கடைசி கட்டணம் ${c.store}-இல் செலுத்தப்படவில்லை. ${c.when} வரை Plus தொடரும் — அதைத் தொடர உங்கள் கட்டண முறையைப் புதுப்பிக்கவும்.`,
        button: (c) => `${c.store}-இல் கட்டணத்தைப் புதுப்பிக்கவும்`,
        greet: "வணக்கம்,",
        lost: (c) => `Imotara Plus-க்கான உங்கள் கடைசி கட்டணம் ${c.store}-இல் செலுத்தப்படவில்லை. எதுவும் இழக்கப்படவில்லை: ${c.store} மீண்டும் முயற்சிக்கும்போது, ${c.when} வரை Plus தொடரும்.`,
        check: (c) => `அதைத் தொடர, உங்கள் ${c.store} சந்தாக்களில் கார்டு அல்லது கட்டண முறையைச் சரிபார்க்கவும்:`,
        stop: "நீங்கள் Plus-ஐ நிறுத்த விரும்பியிருந்தால், எதுவும் செய்ய வேண்டியதில்லை — Imotara இலவசமாகவே பயன்படுத்தலாம்.",
        sign: "— Imotara குழு",
    },
    te: {
        subject: "మీ Imotara Plus చెల్లింపు పూర్తి కాలేదు",
        banner: (c) => `Imotara Plus కోసం మీ చివరి చెల్లింపు ${c.store} లో పూర్తి కాలేదు. ${c.when} వరకు Plus కొనసాగుతుంది — దాన్ని కొనసాగించడానికి మీ చెల్లింపు పద్ధతిని అప్‌డేట్ చేయండి.`,
        button: (c) => `${c.store} లో చెల్లింపును అప్‌డేట్ చేయండి`,
        greet: "నమస్కారం,",
        lost: (c) => `Imotara Plus కోసం మీ చివరి చెల్లింపు ${c.store} లో పూర్తి కాలేదు. ఏదీ పోలేదు: ${c.store} మళ్ళీ ప్రయత్నిస్తున్నప్పుడు ${c.when} వరకు Plus కొనసాగుతుంది.`,
        check: (c) => `దాన్ని కొనసాగించడానికి, దయచేసి మీ ${c.store} సబ్‌స్క్రిప్షన్‌లలో కార్డ్ లేదా చెల్లింపు పద్ధతిని తనిఖీ చేయండి:`,
        stop: "మీరు Plus ఆపాలనుకుంటే, ఏమీ చేయనవసరం లేదు — Imotara ఉచితంగానే ఉపయోగించవచ్చు.",
        sign: "— Imotara బృందం",
    },
    gu: {
        subject: "તમારું Imotara Plus પેમેન્ટ પૂર્ણ થયું નથી",
        banner: (c) => `Imotara Plus માટે તમારું છેલ્લું પેમેન્ટ ${c.store} પર પૂર્ણ થયું નથી. Plus ${c.when} સુધી ચાલુ રહેશે — તેને ચાલુ રાખવા માટે તમારી પેમેન્ટ પદ્ધતિ અપડેટ કરો.`,
        button: (c) => `${c.store} માં પેમેન્ટ અપડેટ કરો`,
        greet: "નમસ્તે,",
        lost: (c) => `Imotara Plus માટે તમારું છેલ્લું પેમેન્ટ ${c.store} પર પૂર્ણ થયું નથી. કંઈ ગુમાવ્યું નથી: ${c.store} ફરી પ્રયાસ કરે ત્યાં સુધી Plus ${c.when} સુધી ચાલુ રહેશે.`,
        check: (c) => `તેને ચાલુ રાખવા માટે, કૃપા કરીને તમારા ${c.store} સબ્સ્ક્રિપ્શનમાં કાર્ડ અથવા પેમેન્ટ પદ્ધતિ તપાસો:`,
        stop: "જો તમે Plus બંધ કરવા માંગતા હતા, તો તમારે કંઈ કરવાની જરૂર નથી — Imotara મફતમાં વાપરી શકાય છે.",
        sign: "— Imotara ટીમ",
    },
    kn: {
        subject: "ನಿಮ್ಮ Imotara Plus ಪಾವತಿ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ",
        banner: (c) => `Imotara Plus ಗಾಗಿ ನಿಮ್ಮ ಕೊನೆಯ ಪಾವತಿ ${c.store} ನಲ್ಲಿ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ. ${c.when} ರವರೆಗೆ Plus ಮುಂದುವರಿಯುತ್ತದೆ — ಅದನ್ನು ಉಳಿಸಿಕೊಳ್ಳಲು ನಿಮ್ಮ ಪಾವತಿ ವಿಧಾನವನ್ನು ನವೀಕರಿಸಿ.`,
        button: (c) => `${c.store} ನಲ್ಲಿ ಪಾವತಿಯನ್ನು ನವೀಕರಿಸಿ`,
        greet: "ನಮಸ್ಕಾರ,",
        lost: (c) => `Imotara Plus ಗಾಗಿ ನಿಮ್ಮ ಕೊನೆಯ ಪಾವತಿ ${c.store} ನಲ್ಲಿ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ. ಏನೂ ಕಳೆದುಹೋಗಿಲ್ಲ: ${c.store} ಮತ್ತೆ ಪ್ರಯತ್ನಿಸುವಾಗ ${c.when} ರವರೆಗೆ Plus ಮುಂದುವರಿಯುತ್ತದೆ.`,
        check: (c) => `ಅದನ್ನು ಉಳಿಸಿಕೊಳ್ಳಲು, ದಯವಿಟ್ಟು ನಿಮ್ಮ ${c.store} ಚಂದಾದಾರಿಕೆಗಳಲ್ಲಿ ಕಾರ್ಡ್ ಅಥವಾ ಪಾವತಿ ವಿಧಾನವನ್ನು ಪರಿಶೀಲಿಸಿ:`,
        stop: "ನೀವು Plus ನಿಲ್ಲಿಸಲು ಬಯಸಿದ್ದರೆ, ಏನೂ ಮಾಡಬೇಕಾಗಿಲ್ಲ — Imotara ಉಚಿತವಾಗಿ ಬಳಸಬಹುದು.",
        sign: "— Imotara ತಂಡ",
    },
    ml: {
        subject: "നിങ്ങളുടെ Imotara Plus പേയ്‌മെന്റ് പൂർത്തിയായില്ല",
        banner: (c) => `Imotara Plus-നുള്ള നിങ്ങളുടെ അവസാന പേയ്‌മെന്റ് ${ML_ON[c.k]} പൂർത്തിയായില്ല. ${c.when} വരെ Plus തുടരും — അത് നിലനിർത്താൻ നിങ്ങളുടെ പേയ്‌മെന്റ് രീതി അപ്‌ഡേറ്റ് ചെയ്യുക.`,
        button: (c) => `${ML_ON[c.k]} പേയ്‌മെന്റ് അപ്‌ഡേറ്റ് ചെയ്യുക`,
        greet: "നമസ്കാരം,",
        lost: (c) => `Imotara Plus-നുള്ള നിങ്ങളുടെ അവസാന പേയ്‌മെന്റ് ${ML_ON[c.k]} പൂർത്തിയായില്ല. ഒന്നും നഷ്ടമായിട്ടില്ല: ${c.store} വീണ്ടും ശ്രമിക്കുന്നതിനിടെ ${c.when} വരെ Plus തുടരും.`,
        check: (c) => `അത് നിലനിർത്താൻ, ദയവായി നിങ്ങളുടെ ${c.store} സബ്‌സ്‌ക്രിപ്‌ഷനുകളിൽ കാർഡോ പേയ്‌മെന്റ് രീതിയോ പരിശോധിക്കുക:`,
        stop: "നിങ്ങൾ Plus നിർത്താൻ ഉദ്ദേശിച്ചിരുന്നെങ്കിൽ, ഒന്നും ചെയ്യേണ്ടതില്ല — Imotara സൗജന്യമായി ഉപയോഗിക്കാം.",
        sign: "— Imotara ടീം",
    },
    pa: {
        subject: "ਤੁਹਾਡਾ Imotara Plus ਭੁਗਤਾਨ ਨਹੀਂ ਹੋ ਸਕਿਆ",
        banner: (c) => `Imotara Plus ਲਈ ਤੁਹਾਡਾ ਪਿਛਲਾ ਭੁਗਤਾਨ ${c.store} 'ਤੇ ਨਹੀਂ ਹੋ ਸਕਿਆ। Plus ${c.when} ਤੱਕ ਚਾਲੂ ਰਹੇਗਾ — ਇਸਨੂੰ ਜਾਰੀ ਰੱਖਣ ਲਈ ਆਪਣੇ ਭੁਗਤਾਨ ਦਾ ਤਰੀਕਾ ਅੱਪਡੇਟ ਕਰੋ।`,
        button: (c) => `${c.store} ਵਿੱਚ ਭੁਗਤਾਨ ਅੱਪਡੇਟ ਕਰੋ`,
        greet: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ,",
        lost: (c) => `Imotara Plus ਲਈ ਤੁਹਾਡਾ ਪਿਛਲਾ ਭੁਗਤਾਨ ${c.store} 'ਤੇ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਕੁਝ ਵੀ ਗੁਆਚਿਆ ਨਹੀਂ: ਜਦੋਂ ਤੱਕ ${c.store} ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰਦਾ ਹੈ, Plus ${c.when} ਤੱਕ ਚਾਲੂ ਰਹੇਗਾ।`,
        check: (c) => `ਇਸਨੂੰ ਜਾਰੀ ਰੱਖਣ ਲਈ, ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀਆਂ ${c.store} ਸਬਸਕ੍ਰਿਪਸ਼ਨਾਂ ਵਿੱਚ ਕਾਰਡ ਜਾਂ ਭੁਗਤਾਨ ਦਾ ਤਰੀਕਾ ਜਾਂਚੋ:`,
        stop: "ਜੇ ਤੁਸੀਂ Plus ਬੰਦ ਕਰਨਾ ਚਾਹੁੰਦੇ ਸੀ, ਤਾਂ ਤੁਹਾਨੂੰ ਕੁਝ ਵੀ ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ — Imotara ਮੁਫ਼ਤ ਵਰਤਿਆ ਜਾ ਸਕਦਾ ਹੈ।",
        sign: "— Imotara ਟੀਮ",
    },
    or: {
        subject: "ଆପଣଙ୍କ Imotara Plus ପେମେଣ୍ଟ ସମ୍ପୂର୍ଣ୍ଣ ହୋଇନାହିଁ",
        banner: (c) => `Imotara Plus ପାଇଁ ଆପଣଙ୍କ ଶେଷ ପେମେଣ୍ଟ ${c.store} ରେ ସମ୍ପୂର୍ଣ୍ଣ ହୋଇନାହିଁ। ${c.when} ପର୍ଯ୍ୟନ୍ତ Plus ଚାଲୁ ରହିବ — ଏହାକୁ ଚାଲୁ ରଖିବା ପାଇଁ ଆପଣଙ୍କ ପେମେଣ୍ଟ ପଦ୍ଧତି ଅପଡେଟ୍ କରନ୍ତୁ।`,
        button: (c) => `${c.store} ରେ ପେମେଣ୍ଟ ଅପଡେଟ୍ କରନ୍ତୁ`,
        greet: "ନମସ୍କାର,",
        lost: (c) => `Imotara Plus ପାଇଁ ଆପଣଙ୍କ ଶେଷ ପେମେଣ୍ଟ ${c.store} ରେ ସମ୍ପୂର୍ଣ୍ଣ ହୋଇନାହିଁ। କିଛି ହଜିନାହିଁ: ${c.store} ପୁଣି ଚେଷ୍ଟା କରୁଥିବା ସମୟରେ ${c.when} ପର୍ଯ୍ୟନ୍ତ Plus ଚାଲୁ ରହିବ।`,
        check: (c) => `ଏହାକୁ ଚାଲୁ ରଖିବା ପାଇଁ, ଦୟାକରି ଆପଣଙ୍କ ${c.store} ସବସ୍କ୍ରିପସନରେ କାର୍ଡ କିମ୍ବା ପେମେଣ୍ଟ ପଦ୍ଧତି ଯାଞ୍ଚ କରନ୍ତୁ:`,
        stop: "ଯଦି ଆପଣ Plus ବନ୍ଦ କରିବାକୁ ଚାହୁଁଥିଲେ, ତେବେ କିଛି କରିବାକୁ ପଡ଼ିବ ନାହିଁ — Imotara ମାଗଣାରେ ବ୍ୟବହାର କରିହେବ।",
        sign: "— Imotara ଟିମ୍",
    },
    ur: {
        subject: "آپ کی Imotara Plus ادائیگی مکمل نہیں ہو سکی",
        banner: (c) => `Imotara Plus کے لیے آپ کی پچھلی ادائیگی ${c.store} پر مکمل نہیں ہو سکی۔ Plus ${c.when} تک چلتا رہے گا — اسے جاری رکھنے کے لیے اپنی ادائیگی کا طریقہ اپ ڈیٹ کریں۔`,
        button: (c) => `${c.store} میں ادائیگی اپ ڈیٹ کریں`,
        greet: "ہیلو،",
        lost: (c) => `Imotara Plus کے لیے آپ کی پچھلی ادائیگی ${c.store} پر مکمل نہیں ہو سکی۔ کچھ ضائع نہیں ہوا: جب تک ${c.store} دوبارہ کوشش کرتا ہے، Plus ${c.when} تک چلتا رہے گا۔`,
        check: (c) => `اسے جاری رکھنے کے لیے، براہ کرم اپنی ${c.store} سبسکرپشنز میں کارڈ یا ادائیگی کا طریقہ چیک کریں:`,
        stop: "اگر آپ Plus بند کرنا چاہتے تھے تو آپ کو کچھ کرنے کی ضرورت نہیں — Imotara مفت استعمال کیا جا سکتا ہے۔",
        sign: "— Imotara ٹیم",
    },
    ar: {
        subject: "لم تكتمل دفعة Imotara Plus الخاصة بك",
        banner: (c) => `لم تكتمل دفعتك الأخيرة لاشتراك Imotara Plus ${AR_ON[c.k]}. سيبقى Plus مفعّلًا حتى ${c.when} — حدّث طريقة الدفع للاحتفاظ به.`,
        button: (c) => `تحديث الدفع في ${c.store}`,
        greet: "مرحبًا،",
        lost: (c) => `لم تكتمل دفعتك الأخيرة لاشتراك Imotara Plus ${AR_ON[c.k]}. لم تفقد شيئًا: سيبقى Plus مفعّلًا حتى ${c.when} بينما يعيد ${c.store} المحاولة.`,
        check: (c) => `للاحتفاظ به، يُرجى التحقق من البطاقة أو طريقة الدفع في اشتراكاتك على ${c.store}:`,
        stop: "إذا كنت تقصد إيقاف Plus، فلا داعي لفعل أي شيء — يبقى Imotara مجانيًا للاستخدام.",
        sign: "— فريق Imotara",
    },
    ru: {
        subject: "Платёж за Imotara Plus не прошёл",
        banner: (c) => `Ваш последний платёж за Imotara Plus ${RU_ON[c.k]} не прошёл. Plus будет работать до ${c.when} — обновите способ оплаты, чтобы сохранить подписку.`,
        button: (c) => `Обновить оплату ${RU_ON[c.k]}`,
        greet: "Здравствуйте!",
        lost: (c) => `Ваш последний платёж за Imotara Plus ${RU_ON[c.k]} не прошёл. Ничего не потеряно: Plus будет работать до ${c.when}, пока ${c.store} пробует провести оплату снова.`,
        check: (c) => `Чтобы сохранить подписку, проверьте карту или способ оплаты в подписках ${c.store}:`,
        stop: "Если вы хотели отключить Plus, ничего делать не нужно — Imotara остаётся бесплатным.",
        sign: "— Команда Imotara",
    },
    zh: {
        subject: "您的 Imotara Plus 付款未成功",
        banner: (c) => `您${ZH_ON[c.k]}为 Imotara Plus 支付的最近一笔款项未成功。Plus 将保持开通至${c.when}——请更新付款方式以继续使用。`,
        button: (c) => `在 ${c.store} 中更新付款方式`,
        greet: "您好，",
        lost: (c) => `您${ZH_ON[c.k]}为 Imotara Plus 支付的最近一笔款项未成功。您不会失去任何内容：在 ${c.store} 重新尝试扣款期间，Plus 将保持开通至${c.when}。`,
        check: (c) => `如需继续使用，请在 ${c.store} 的订阅中检查银行卡或付款方式：`,
        stop: "如果您本来就想停用 Plus，则无需任何操作——Imotara 仍可免费使用。",
        sign: "—— Imotara 团队",
    },
    ja: {
        subject: "Imotara Plus のお支払いが完了しませんでした",
        banner: (c) => `前回の Imotara Plus のお支払いが ${c.store} で完了しませんでした。Plus は${c.when}までご利用いただけます。継続するには、お支払い方法を更新してください。`,
        button: (c) => `${c.store} でお支払い方法を更新`,
        greet: "こんにちは。",
        lost: (c) => `前回の Imotara Plus のお支払いが ${c.store} で完了しませんでした。何も失われていません。${c.store} が再度お支払いを試みる間、Plus は${c.when}までご利用いただけます。`,
        check: (c) => `継続するには、${c.store} のサブスクリプションでカードまたはお支払い方法をご確認ください：`,
        stop: "Plus を停止するおつもりだった場合は、何もする必要はありません。Imotara は引き続き無料でご利用いただけます。",
        sign: "— Imotara チーム",
    },
    es: {
        subject: "No se pudo completar tu pago de Imotara Plus",
        banner: (c) => `No se pudo completar tu último pago de Imotara Plus ${ES_ON[c.k]}. Plus sigue activo hasta el ${c.when}: actualiza tu método de pago para conservarlo.`,
        button: (c) => `Actualizar el pago en ${c.store}`,
        greet: "Hola:",
        lost: (c) => `No se pudo completar tu último pago de Imotara Plus ${ES_ON[c.k]}. No se pierde nada: Plus sigue activo hasta el ${c.when} mientras ${c.store} lo vuelve a intentar.`,
        check: (c) => `Para conservarlo, revisa la tarjeta o el método de pago en tus suscripciones de ${c.store}:`,
        stop: "Si querías cancelar Plus, no tienes que hacer nada: Imotara sigue siendo gratis.",
        sign: "— El equipo de Imotara",
    },
    fr: {
        subject: "Votre paiement Imotara Plus n'a pas abouti",
        banner: (c) => `Votre dernier paiement pour Imotara Plus ${FR_ON[c.k]} n'a pas abouti. Plus reste actif jusqu'au ${c.when} — mettez à jour votre moyen de paiement pour le conserver.`,
        button: (c) => `Mettre à jour le paiement ${FR_IN[c.k]}`,
        greet: "Bonjour,",
        lost: (c) => `Votre dernier paiement pour Imotara Plus ${FR_ON[c.k]} n'a pas abouti. Rien n'est perdu : Plus reste actif jusqu'au ${c.when} pendant que ${FR_THE[c.k]} réessaie.`,
        check: (c) => `Pour le conserver, vérifiez la carte ou le moyen de paiement dans vos abonnements ${c.store} :`,
        stop: "Si vous vouliez arrêter Plus, vous n'avez rien à faire — Imotara reste gratuit.",
        sign: "— L'équipe Imotara",
    },
    de: {
        subject: "Deine Zahlung für Imotara Plus ist nicht durchgegangen",
        banner: (c) => `Deine letzte Zahlung für Imotara Plus ${DE_ON[c.k]} ist nicht durchgegangen. Plus bleibt bis zum ${c.when} aktiv – aktualisiere deine Zahlungsmethode, um es zu behalten.`,
        button: (c) => `Zahlung ${DE_ON[c.k]} aktualisieren`,
        greet: "Hallo,",
        lost: (c) => `Deine letzte Zahlung für Imotara Plus ${DE_ON[c.k]} ist nicht durchgegangen. Nichts geht verloren: Plus bleibt bis zum ${c.when} aktiv, während ${DE_THE[c.k]} es erneut versucht.`,
        check: (c) => `Um es zu behalten, prüfe bitte die Karte oder Zahlungsmethode in deinen ${c.store}-Abos:`,
        stop: "Wenn du Plus beenden wolltest, musst du nichts tun – Imotara bleibt kostenlos nutzbar.",
        sign: "– Das Imotara-Team",
    },
    pt: {
        subject: "Seu pagamento do Imotara Plus não foi concluído",
        banner: (c) => `Seu último pagamento do Imotara Plus ${PT_ON[c.k]} não foi concluído. O Plus continua ativo até ${c.when} — atualize sua forma de pagamento para mantê-lo.`,
        button: (c) => `Atualizar pagamento ${PT_ON[c.k]}`,
        greet: "Olá,",
        lost: (c) => `Seu último pagamento do Imotara Plus ${PT_ON[c.k]} não foi concluído. Nada foi perdido: o Plus continua ativo até ${c.when} enquanto ${PT_THE[c.k]} tenta novamente.`,
        check: (c) => `Para mantê-lo, confira o cartão ou a forma de pagamento nas suas assinaturas ${PT_ON[c.k]}:`,
        stop: "Se você queria cancelar o Plus, não precisa fazer nada — o Imotara continua gratuito.",
        sign: "— Equipe Imotara",
    },
    id: {
        subject: "Pembayaran Imotara Plus Anda tidak berhasil",
        banner: (c) => `Pembayaran terakhir Anda untuk Imotara Plus di ${c.store} tidak berhasil. Plus tetap aktif hingga ${c.when} — perbarui metode pembayaran Anda untuk mempertahankannya.`,
        button: (c) => `Perbarui pembayaran di ${c.store}`,
        greet: "Halo,",
        lost: (c) => `Pembayaran terakhir Anda untuk Imotara Plus di ${c.store} tidak berhasil. Tidak ada yang hilang: Plus tetap aktif hingga ${c.when} selagi ${c.store} mencoba lagi.`,
        check: (c) => `Agar tetap aktif, silakan periksa kartu atau metode pembayaran di langganan ${c.store} Anda:`,
        stop: "Jika Anda memang ingin berhenti dari Plus, Anda tidak perlu melakukan apa pun — Imotara tetap gratis digunakan.",
        sign: "— Tim Imotara",
    },
    he: {
        subject: "התשלום שלך על Imotara Plus לא עבר",
        banner: (c) => `התשלום האחרון שלך על Imotara Plus ${HE_ON[c.k]} לא עבר. Plus ימשיך לפעול עד ${c.when} — כדי לשמור עליו, יש לעדכן את אמצעי התשלום.`,
        button: (c) => `עדכון התשלום ${HE_ON[c.k]}`,
        greet: "שלום,",
        lost: (c) => `התשלום האחרון שלך על Imotara Plus ${HE_ON[c.k]} לא עבר. שום דבר לא אבד: Plus ימשיך לפעול עד ${c.when} בזמן ש-${c.store} מנסה שוב.`,
        check: (c) => `כדי לשמור עליו, יש לבדוק את הכרטיס או את אמצעי התשלום במינויים שלך ${HE_ON[c.k]}:`,
        stop: "אם רצית להפסיק את Plus, אין צורך לעשות דבר — Imotara נשאר בחינם.",
        sign: "— צוות Imotara",
    },
};

/** "hi-IN", "HI", null ⇒ one of the 22, English when we do not have it. */
export function graceLang(lang: string | null | undefined): string {
    const base = String(lang ?? "en").toLowerCase().split(/[-_]/)[0];
    return GRACE[base] ? base : "en";
}

/**
 * The date in the person's own language ("22 November", "22 नवंबर", "11月22日").
 * ⚠️ UTC, like the store's own date. Any engine without that locale ⇒ the English form, never a blank.
 */
export function graceDate(iso: string, lang: string | null | undefined): string {
    const l = graceLang(lang);
    const d = new Date(iso);
    try {
        return new Intl.DateTimeFormat(l === "en" ? "en-GB" : l, { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
    } catch {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
    }
}

function ctx(store: GraceStore, until: string, lang: string | null | undefined): GraceCtx {
    return { k: store, store: STORE_NAME[store], when: graceDate(until, lang) };
}

/** The banner sentence and its one button, in the person's language. */
export function graceBanner(store: GraceStore, until: string, lang?: string | null): { text: string; button: string } {
    const t = GRACE[graceLang(lang)];
    const c = ctx(store, until, lang);
    return { text: t.banner(c), button: t.button(c) };
}

/** The one email's subject and lines (the store's link goes after `check`). */
export function graceEmailLines(store: GraceStore, until: string, url: string, lang?: string | null): { subject: string; lines: string[] } {
    const t = GRACE[graceLang(lang)];
    const c = ctx(store, until, lang);
    return { subject: t.subject, lines: [t.greet, "", t.lost(c), "", t.check(c), url, "", t.stop, "", t.sign] };
}
