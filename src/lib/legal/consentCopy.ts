// ⛔ MIRROR OF imotaraapp/src/lib/legal/consentCopy.ts
//
// This file is copied VERBATIM from the web repo below the header. The consent
// gate must say exactly the same thing on web, iOS and Android — a person who
// accepted "18 or older" on their phone must have accepted the same sentence
// they would have on the web. Two catalogues that are meant to match have
// drifted in this codebase before.
//
// ⇒ When you change one, change BOTH, and run the tests in both repos.
//    Web:    src/__tests__/consentGateCoversEveryLanguage.test.ts
//    Mobile: src/__tests__/consentGateMirrorsWeb.test.ts

// src/lib/legal/consentCopy.ts
//
// Copy for the first-use acceptance gate, in all 22 supported languages.
//
// ⚠️ THE ENGLISH IS THE ORIGINAL. Every other entry is a translation of it, and
// the acceptance record stores WHICH locale was shown (see termsVersion.ts), so
// that it is always knowable what a given person actually read.
//
// ⛔ Do NOT put helpline numbers in here. The emergency numbers come from
// src/lib/safety/crisisResources.ts via getCrisisResourcesForCountry(), so the
// gate and the crisis card can never drift apart. This file holds only the
// sentence that introduces them.
//
// ⚠️ The non-English copy is machine-assisted and needs a native read before it
// is relied on — the Bengali especially, which the owner has corrected before.

export type ConsentCopy = {
    /** Screen title. */
    title: string;
    /**
     * The warm line. Owner decision 2026-10-13: the gate leads with what
     * Imotara IS before what it is not, so the first thing a person in distress
     * reads is not a legal shield. Rendered larger than `body`.
     */
    warm: string;
    /**
     * What Imotara is and is not. The load-bearing disclaimer.
     * ⛔ Demoted in VISUAL WEIGHT only — never in clarity. It stays explicit and
     * above the fold.
     */
    body: string;
    /** Sentence introducing the helpline numbers. */
    emergencyLead: string;
    /** Checkbox label. Contains the {terms} and {privacy} placeholders. */
    agree: string;
    /** Link text substituted into {terms}. */
    termsLabel: string;
    /** Link text substituted into {privacy}. */
    privacyLabel: string;
    /** Primary button. */
    cta: string;
};

export const CONSENT_COPY_BY_LANG: Record<string, ConsentCopy> = {
    en: { title: "Welcome to Imotara", warm: "A private space for how you really feel — yours alone, at any hour.", body: "Imotara is a companion for reflection — not a therapist or a doctor. It does not give medical advice.", emergencyLead: "If you are in danger, or thinking of harming yourself, please get help now.", agree: "I am 13 or older. If I am under 18, a parent or guardian agrees to my use of Imotara. I accept the {terms} and {privacy}.", termsLabel: "Terms", privacyLabel: "Privacy Policy", cta: "Continue" },
    hi: { title: "इमोतारा में आपका स्वागत है", warm: "आप असल में कैसा महसूस करते हैं, उसके लिए एक निजी जगह — सिर्फ़ आपकी, किसी भी वक़्त।", body: "इमोतारा सोचने-समझने का एक साथी है — कोई थेरेपिस्ट या डॉक्टर नहीं। यह चिकित्सीय सलाह नहीं देता।", emergencyLead: "अगर आप ख़तरे में हैं, या ख़ुद को नुकसान पहुँचाने का ख़याल आ रहा है, तो अभी मदद लें।", agree: "मेरी उम्र 13 वर्ष या उससे अधिक है। अगर मैं 18 से कम हूँ, तो मेरे माता-पिता या अभिभावक मेरी सहमति देते हैं। मैं {terms} तथा {privacy} स्वीकार करता/करती हूँ।", termsLabel: "शर्तों", privacyLabel: "गोपनीयता नीति", cta: "आगे बढ़ें" },
    mr: { title: "इमोतारामध्ये आपले स्वागत आहे", warm: "तुम्हाला खरोखर कसं वाटतं त्यासाठी एक खाजगी जागा — फक्त तुमची, कोणत्याही वेळी.", body: "इमोतारा हा विचार करण्यासाठी एक सोबती आहे — थेरपिस्ट किंवा डॉक्टर नाही. तो वैद्यकीय सल्ला देत नाही.", emergencyLead: "तुम्ही धोक्यात असाल, किंवा स्वतःला इजा करण्याचा विचार येत असेल, तर आत्ताच मदत घ्या.", agree: "माझे वय 13 किंवा त्याहून अधिक आहे. मी 18 पेक्षा लहान असल्यास, माझे पालक संमती देतात. मी {terms} व {privacy} स्वीकारतो/स्वीकारते.", termsLabel: "अटी", privacyLabel: "गोपनीयता धोरण", cta: "पुढे जा" },
    bn: { title: "ইমোতারায় স্বাগতম", warm: "আপনি সত্যিই যেমন বোধ করেন, তার জন্য একান্ত নিজের একটি জায়গা — যখন খুশি।", body: "ইমোতারা মন খুলে ভাবার একজন সঙ্গী — কোনো থেরাপিস্ট বা ডাক্তার নয়। এটি চিকিৎসা পরামর্শ দেয় না।", emergencyLead: "আপনি যদি বিপদে থাকেন, বা নিজের ক্ষতি করার কথা ভাবছেন, এখনই সাহায্য নিন।", agree: "আমার বয়স ১৩ বা তার বেশি। আমার বয়স ১৮-র কম হলে, আমার বাবা-মা বা অভিভাবক সম্মতি দিয়েছেন। আমি {terms} ও {privacy} মেনে নিচ্ছি।", termsLabel: "শর্তাবলী", privacyLabel: "গোপনীয়তা নীতি", cta: "এগিয়ে যান" },
    ta: { title: "இமோதாராவுக்கு வரவேற்கிறோம்", warm: "நீங்கள் உண்மையில் உணர்வதற்கான ஒரு தனிப்பட்ட இடம் — உங்களுக்கே, எந்த நேரத்திலும்.", body: "இமோதாரா சிந்திக்க உதவும் ஒரு துணை — சிகிச்சையாளர் அல்லது மருத்துவர் அல்ல. இது மருத்துவ ஆலோசனை வழங்காது.", emergencyLead: "நீங்கள் ஆபத்தில் இருந்தால், அல்லது உங்களையே காயப்படுத்தும் எண்ணம் இருந்தால், இப்போதே உதவி பெறுங்கள்.", agree: "எனக்கு 13 வயது அல்லது அதற்கு மேல். 18-க்குக் குறைவாக இருந்தால், என் பெற்றோர் அல்லது பாதுகாவலர் ஒப்புதல் அளித்துள்ளார். {terms} மற்றும் {privacy} ஏற்கிறேன்.", termsLabel: "விதிமுறைகள்", privacyLabel: "தனியுரிமைக் கொள்கை", cta: "தொடரவும்" },
    te: { title: "ఇమోతారాకు స్వాగతం", warm: "మీరు నిజంగా ఎలా భావిస్తున్నారో దానికి ఒక ప్రైవేట్ స్థలం — మీదే, ఎప్పుడైనా.", body: "ఇమోతారా ఆలోచించడానికి ఒక తోడు — థెరపిస్ట్ లేదా డాక్టర్ కాదు. ఇది వైద్య సలహా ఇవ్వదు.", emergencyLead: "మీరు ప్రమాదంలో ఉంటే, లేదా మిమ్మల్ని మీరు గాయపరచుకోవాలని అనిపిస్తే, ఇప్పుడే సహాయం తీసుకోండి.", agree: "నా వయస్సు 13 లేదా అంతకంటే ఎక్కువ. 18 కంటే తక్కువైతే, నా తల్లిదండ్రులు లేదా సంరక్షకులు అంగీకరించారు. నేను {terms} మరియు {privacy} అంగీకరిస్తున్నాను.", termsLabel: "నిబంధనలు", privacyLabel: "గోప్యతా విధానం", cta: "కొనసాగించు" },
    kn: { title: "ಇಮೋತಾರಾಗೆ ಸ್ವಾಗತ", warm: "ನೀವು ನಿಜವಾಗಿ ಹೇಗೆ ಅನಿಸುತ್ತೀರೋ ಅದಕ್ಕೆ ಒಂದು ಖಾಸಗಿ ಜಾಗ — ನಿಮ್ಮದೇ, ಯಾವಾಗ ಬೇಕಾದರೂ.", body: "ಇಮೋತಾರಾ ಯೋಚಿಸಲು ಒಂದು ಸಂಗಾತಿ — ಥೆರಪಿಸ್ಟ್ ಅಥವಾ ವೈದ್ಯರಲ್ಲ. ಇದು ವೈದ್ಯಕೀಯ ಸಲಹೆ ನೀಡುವುದಿಲ್ಲ.", emergencyLead: "ನೀವು ಅಪಾಯದಲ್ಲಿದ್ದರೆ, ಅಥವಾ ನಿಮಗೆ ನೀವೇ ಹಾನಿ ಮಾಡಿಕೊಳ್ಳುವ ಯೋಚನೆ ಬಂದರೆ, ಈಗಲೇ ಸಹಾಯ ಪಡೆಯಿರಿ.", agree: "ನನ್ನ ವಯಸ್ಸು 13 ಅಥವಾ ಹೆಚ್ಚು. 18ಕ್ಕಿಂತ ಕಡಿಮೆಯಾದರೆ, ನನ್ನ ಪೋಷಕರು ಒಪ್ಪಿದ್ದಾರೆ. ನಾನು {terms} ಹಾಗೂ {privacy} ಒಪ್ಪುತ್ತೇನೆ.", termsLabel: "ನಿಯಮಗಳು", privacyLabel: "ಗೌಪ್ಯತಾ ನೀತಿ", cta: "ಮುಂದುವರಿಸಿ" },
    ml: { title: "ഇമോതാരയിലേക്ക് സ്വാഗതം", warm: "നിങ്ങൾക്ക് ശരിക്കും തോന്നുന്നത് പറയാൻ ഒരു സ്വകാര്യ ഇടം — നിങ്ങളുടേത് മാത്രം, എപ്പോൾ വേണമെങ്കിലും.", body: "ഇമോതാര ചിന്തിക്കാൻ ഒരു കൂട്ടുകാരൻ — തെറാപ്പിസ്റ്റോ ഡോക്ടറോ അല്ല. ഇത് വൈദ്യോപദേശം നൽകുന്നില്ല.", emergencyLead: "നിങ്ങൾ അപകടത്തിലാണെങ്കിൽ, അല്ലെങ്കിൽ സ്വയം ഉപദ്രവിക്കാൻ തോന്നുന്നുവെങ്കിൽ, ഇപ്പോൾ തന്നെ സഹായം തേടുക.", agree: "എനിക്ക് 13 വയസ്സോ അതിൽ കൂടുതലോ ഉണ്ട്. 18 വയസ്സിൽ താഴെയാണെങ്കിൽ, എന്റെ രക്ഷിതാവ് സമ്മതിച്ചിട്ടുണ്ട്. ഞാൻ {terms} ഉം {privacy} ഉം അംഗീകരിക്കുന്നു.", termsLabel: "നിബന്ധനകൾ", privacyLabel: "സ്വകാര്യതാ നയം", cta: "തുടരുക" },
    gu: { title: "ઇમોતારામાં આપનું સ્વાગત છે", warm: "તમે ખરેખર કેવું અનુભવો છો તેના માટે એક ખાનગી જગ્યા — ફક્ત તમારી, કોઈ પણ સમયે.", body: "ઇમોતારા વિચારવા માટેનો એક સાથી છે — થેરાપિસ્ટ કે ડૉક્ટર નહીં. તે તબીબી સલાહ આપતો નથી.", emergencyLead: "જો તમે જોખમમાં હો, અથવા પોતાને નુકસાન પહોંચાડવાનો વિચાર આવે, તો હમણાં જ મદદ લો.", agree: "મારી ઉંમર 13 કે તેથી વધુ છે. હું 18થી નાનો/નાની હોઉં તો, મારા માતા-પિતા કે વાલીની સંમતિ છે. હું {terms} તથા {privacy} સ્વીકારું છું.", termsLabel: "શરતો", privacyLabel: "ગોપનીયતા નીતિ", cta: "આગળ વધો" },
    pa: { title: "ਇਮੋਤਾਰਾ ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ", warm: "ਤੁਸੀਂ ਅਸਲ ਵਿੱਚ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ, ਉਸ ਲਈ ਇੱਕ ਨਿੱਜੀ ਥਾਂ — ਸਿਰਫ਼ ਤੁਹਾਡੀ, ਕਿਸੇ ਵੀ ਵੇਲੇ।", body: "ਇਮੋਤਾਰਾ ਸੋਚਣ ਲਈ ਇੱਕ ਸਾਥੀ ਹੈ — ਥੈਰੇਪਿਸਟ ਜਾਂ ਡਾਕਟਰ ਨਹੀਂ। ਇਹ ਡਾਕਟਰੀ ਸਲਾਹ ਨਹੀਂ ਦਿੰਦਾ।", emergencyLead: "ਜੇ ਤੁਸੀਂ ਖ਼ਤਰੇ ਵਿੱਚ ਹੋ, ਜਾਂ ਆਪਣੇ ਆਪ ਨੂੰ ਨੁਕਸਾਨ ਪਹੁੰਚਾਉਣ ਦਾ ਖ਼ਿਆਲ ਆ ਰਿਹਾ ਹੈ, ਤਾਂ ਹੁਣੇ ਮਦਦ ਲਵੋ।", agree: "ਮੇਰੀ ਉਮਰ 13 ਜਾਂ ਵੱਧ ਹੈ। ਜੇ ਮੈਂ 18 ਤੋਂ ਛੋਟਾ/ਛੋਟੀ ਹਾਂ, ਤਾਂ ਮੇਰੇ ਮਾਪੇ ਜਾਂ ਸਰਪ੍ਰਸਤ ਸਹਿਮਤ ਹਨ। ਮੈਂ {terms} ਅਤੇ {privacy} ਸਵੀਕਾਰ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ।", termsLabel: "ਸ਼ਰਤਾਂ", privacyLabel: "ਗੋਪਨੀਯਤਾ ਨੀਤੀ", cta: "ਅੱਗੇ ਵਧੋ" },
    or: { title: "ଇମୋତାରାକୁ ସ୍ୱାଗତ", warm: "ଆପଣ ପ୍ରକୃତରେ କେମିତି ଅନୁଭବ କରୁଛନ୍ତି, ସେଥିପାଇଁ ଏକ ବ୍ୟକ୍ତିଗତ ସ୍ଥାନ — କେବଳ ଆପଣଙ୍କର, ଯେକୌଣସି ସମୟରେ।", body: "ଇମୋତାରା ଚିନ୍ତା କରିବା ପାଇଁ ଜଣେ ସାଥୀ — ଥେରାପିଷ୍ଟ କିମ୍ବା ଡାକ୍ତର ନୁହେଁ। ଏହା ଚିକିତ୍ସା ପରାମର୍ଶ ଦିଏ ନାହିଁ।", emergencyLead: "ଯଦି ଆପଣ ବିପଦରେ ଅଛନ୍ତି, କିମ୍ବା ନିଜକୁ କ୍ଷତି ପହଞ୍ଚାଇବାର ଚିନ୍ତା ଆସୁଛି, ତେବେ ବର୍ତ୍ତମାନ ସାହାଯ୍ୟ ନିଅନ୍ତୁ।", agree: "ମୋର ବୟସ ୧୩ କିମ୍ବା ଅଧିକ। ଯଦି ମୁଁ ୧୮ରୁ କମ୍, ମୋ ପିତାମାତା କିମ୍ବା ଅଭିଭାବକ ସହମତ ଅଛନ୍ତି। ମୁଁ {terms} ଓ {privacy} ଗ୍ରହଣ କରୁଛି।", termsLabel: "ସର୍ତ୍ତାବଳୀ", privacyLabel: "ଗୋପନୀୟତା ନୀତି", cta: "ଆଗକୁ ଯାଆନ୍ତୁ" },
    he: { title: "ברוכים הבאים לאימוטרה", warm: "מרחב פרטי לאיך שאתם באמת מרגישים — שלכם בלבד, בכל שעה.", body: "אימוטרה היא בת לוויה למחשבה — לא מטפלת ולא רופאה. היא אינה נותנת ייעוץ רפואי.", emergencyLead: "אם אתם בסכנה, או חושבים לפגוע בעצמכם, בקשו עזרה עכשיו.", agree: "אני בן/בת 13 ומעלה. אם אני מתחת לגיל 18, הורה או אפוטרופוס מסכים לשימוש שלי. אני מקבל/ת את ה{terms} ואת ה{privacy}.", termsLabel: "תנאים", privacyLabel: "מדיניות הפרטיות", cta: "המשך" },
    ar: { title: "مرحبًا بك في إيموتارا", warm: "مساحة خاصة لما تشعر به حقًا — لك وحدك، في أي وقت.", body: "إيموتارا رفيق للتأمل — وليست معالجًا نفسيًا ولا طبيبًا. وهي لا تقدّم نصائح طبية.", emergencyLead: "إذا كنت في خطر، أو تفكر في إيذاء نفسك، فاطلب المساعدة الآن.", agree: "عمري 13 عامًا أو أكثر. وإذا كنت دون 18 عامًا، فقد وافق أحد الوالدين أو الوصي على استخدامي. أوافق على {terms} و{privacy}.", termsLabel: "الشروط", privacyLabel: "سياسة الخصوصية", cta: "متابعة" },
    de: { title: "Willkommen bei Imotara", warm: "Ein privater Raum für das, was Sie wirklich fühlen – ganz Ihrer, zu jeder Stunde.", body: "Imotara ist ein Begleiter zum Nachdenken – kein Therapeut und kein Arzt. Es gibt keine medizinischen Ratschläge.", emergencyLead: "Wenn Sie in Gefahr sind oder daran denken, sich selbst zu verletzen, holen Sie sich jetzt Hilfe.", agree: "Ich bin 13 Jahre oder älter. Unter 18 Jahren stimmt ein Elternteil oder Vormund meiner Nutzung zu. Ich akzeptiere die {terms} und die {privacy}.", termsLabel: "Nutzungsbedingungen", privacyLabel: "Datenschutzerklärung", cta: "Weiter" },
    ja: { title: "Imotara へようこそ", warm: "本当の気持ちのための、あなただけの静かな場所。いつでも。", body: "Imotara は心を整理するための話し相手です。セラピストでも医師でもなく、医療的な助言は行いません。", emergencyLead: "危険な状況にある場合、または自分を傷つけようと考えている場合は、今すぐ助けを求めてください。", agree: "私は13歳以上です。18歳未満の場合は、保護者が利用に同意しています。{terms}と{privacy}に同意します。", termsLabel: "利用規約", privacyLabel: "プライバシーポリシー", cta: "続ける" },
    ur: { title: "اموتارا میں خوش آمدید", warm: "آپ واقعی کیسا محسوس کرتے ہیں، اس کے لیے ایک نجی جگہ — صرف آپ کی، کسی بھی وقت۔", body: "اموتارا سوچنے کے لیے ایک ساتھی ہے — کوئی تھیراپسٹ یا ڈاکٹر نہیں۔ یہ طبی مشورہ نہیں دیتا۔", emergencyLead: "اگر آپ خطرے میں ہیں، یا خود کو نقصان پہنچانے کا خیال آ رہا ہے، تو ابھی مدد لیں۔", agree: "میری عمر 13 سال یا اس سے زیادہ ہے۔ اگر میں 18 سال سے کم ہوں تو میرے والدین یا سرپرست رضامند ہیں۔ میں {terms} اور {privacy} قبول کرتا/کرتی ہوں۔", termsLabel: "شرائط", privacyLabel: "رازداری کی پالیسی", cta: "جاری رکھیں" },
    es: { title: "Bienvenido a Imotara", warm: "Un espacio privado para lo que sientes de verdad: solo tuyo, a cualquier hora.", body: "Imotara es un acompañante para reflexionar, no un terapeuta ni un médico. No ofrece consejo médico.", emergencyLead: "Si estás en peligro o piensas en hacerte daño, busca ayuda ahora.", agree: "Tengo 13 años o más. Si soy menor de 18, mi padre, madre o tutor acepta mi uso de Imotara. Acepto los {terms} y la {privacy}.", termsLabel: "Términos", privacyLabel: "Política de Privacidad", cta: "Continuar" },
    fr: { title: "Bienvenue sur Imotara", warm: "Un espace privé pour ce que vous ressentez vraiment — rien qu'à vous, à toute heure.", body: "Imotara est un compagnon de réflexion — ni thérapeute, ni médecin. Il ne donne pas de conseils médicaux.", emergencyLead: "Si vous êtes en danger ou si vous pensez à vous faire du mal, demandez de l'aide maintenant.", agree: "J'ai 13 ans ou plus. Si j'ai moins de 18 ans, un parent ou tuteur accepte mon utilisation. J'accepte les {terms} et la {privacy}.", termsLabel: "Conditions", privacyLabel: "Politique de confidentialité", cta: "Continuer" },
    pt: { title: "Bem-vindo ao Imotara", warm: "Um espaço privado para o que sente de verdade — só seu, a qualquer hora.", body: "O Imotara é um companheiro para refletir — não um terapeuta nem um médico. Não dá conselhos médicos.", emergencyLead: "Se estiver em perigo ou a pensar em magoar-se, procure ajuda agora.", agree: "Tenho 13 anos ou mais. Se for menor de 18, um dos meus pais ou tutor aceita a minha utilização. Aceito os {terms} e a {privacy}.", termsLabel: "Termos", privacyLabel: "Política de Privacidade", cta: "Continuar" },
    ru: { title: "Добро пожаловать в Imotara", warm: "Личное пространство для того, что вы чувствуете на самом деле — только ваше, в любой час.", body: "Imotara — спутник для размышлений, а не психотерапевт и не врач. Он не даёт медицинских советов.", emergencyLead: "Если вы в опасности или думаете о том, чтобы навредить себе, обратитесь за помощью сейчас.", agree: "Мне 13 лет или больше. Если мне меньше 18, родитель или опекун согласен на моё использование. Я принимаю {terms} и {privacy}.", termsLabel: "Условия", privacyLabel: "Политику конфиденциальности", cta: "Продолжить" },
    zh: { title: "欢迎使用 Imotara", warm: "一个属于你自己的私密空间，随时说出真实的感受。", body: "Imotara 是陪你梳理心情的伙伴，不是心理治疗师，也不是医生，不提供医疗建议。", emergencyLead: "如果你有危险，或有伤害自己的念头，请立即寻求帮助。", agree: "我已年满 13 周岁。若未满 18 周岁，我的家长或监护人已同意我使用。我接受{terms}和{privacy}。", termsLabel: "条款", privacyLabel: "隐私政策", cta: "继续" },
    id: { title: "Selamat datang di Imotara", warm: "Ruang pribadi untuk apa yang benar-benar Anda rasakan — hanya milik Anda, kapan saja.", body: "Imotara adalah teman untuk merenung — bukan terapis atau dokter. Imotara tidak memberikan nasihat medis.", emergencyLead: "Jika Anda dalam bahaya, atau terpikir untuk menyakiti diri sendiri, carilah bantuan sekarang.", agree: "Saya berusia 13 tahun atau lebih. Jika saya di bawah 18 tahun, orang tua atau wali saya menyetujui penggunaan ini. Saya menerima {terms} dan {privacy}.", termsLabel: "Ketentuan", privacyLabel: "Kebijakan Privasi", cta: "Lanjutkan" },
};

/** The minimum age stated on the gate. Owner decision, 2026-10-13. */
export const MINIMUM_AGE = 18;

/**
 * Copy for a language, falling back to English.
 *
 * ⛔ Deliberately does NOT run the language through concreteLang(): "auto" must
 * never collapse to "en" here, for the same reason it must not for the crisis
 * card — see trap_concretelang_turns_auto_into_en. Callers pass a resolved
 * language or nothing.
 */
export function getConsentCopy(lang?: string | null): ConsentCopy {
    if (!lang) return CONSENT_COPY_BY_LANG.en;
    const base = String(lang).trim().toLowerCase().split(/[-_]/)[0];
    return CONSENT_COPY_BY_LANG[base] ?? CONSENT_COPY_BY_LANG.en;
}
