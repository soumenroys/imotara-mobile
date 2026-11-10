// src/lib/welcome/welcomeBackTopic.ts
// "Welcome back. Last time we talked about: <topic>. Pick up where we left off?"
// — #16 C / #77c (owner, 10 Nov 2026: TOPIC ONLY, 17 topics, more later).
//
// ⛔ MIRROR of imotaraapp/src/lib/imotara/welcomeBackTopic.ts — from the topic
// list down, the two files are IDENTICAL; the web's
// test welcomeBackNamesOnlyAClosedTopic pins it when both repos sit side by side.
//
// 🔑 The topic is chosen from this closed list by the server (/api/session-topic),
// never written by a model; anything else ⇒ the plain card. ⛔ Never after a
// crisis; never sensitive subjects; never the person's words. The reply is
// never touched — this is a card above the message box.

export const SESSION_TOPICS = [
    "work", "studies", "family", "close_person", "alone", "sleep", "health", "money", "loss",
    "self_worth", "worry", "good_news", "overthinking", "stuck", "argument", "caring", "big_change",
] as const;
export type SessionTopic = (typeof SESSION_TOPICS)[number];

export function isSessionTopic(v: unknown): v is SessionTopic {
    return typeof v === "string" && (SESSION_TOPICS as readonly string[]).includes(v);
}

type Labels = Record<SessionTopic, string>;
export type WelcomeStrings = { lead: string; topic: (t: string) => string; ask: string; pick: string; fresh: string };

export const TOPIC_LABELS: Record<string, Labels> = {
    en: { work: "work", studies: "your studies", family: "family", close_person: "someone close to you", alone: "feeling alone", sleep: "sleep", health: "your health", money: "money worries", loss: "a loss", self_worth: "how you see yourself", worry: "what's been worrying you", good_news: "something good that happened", overthinking: "overthinking", stuck: "feeling stuck", argument: "an argument", caring: "looking after someone", big_change: "a big change" },
    hi: { work: "काम", studies: "आपकी पढ़ाई", family: "परिवार", close_person: "आपका कोई करीबी", alone: "अकेलापन", sleep: "नींद", health: "आपकी सेहत", money: "पैसों की चिंता", loss: "किसी को खोने का दुख", self_worth: "आप खुद को कैसे देखते हैं", worry: "जो बात आपको परेशान कर रही थी", good_news: "कुछ अच्छा जो हुआ", overthinking: "ज़रूरत से ज़्यादा सोचना", stuck: "अटका हुआ महसूस करना", argument: "एक बहस", caring: "किसी की देखभाल", big_change: "एक बड़ा बदलाव" },
    bn: { work: "কাজ", studies: "আপনার পড়াশোনা", family: "পরিবার", close_person: "আপনার কাছের কেউ", alone: "একা লাগা", sleep: "ঘুম", health: "আপনার শরীর-স্বাস্থ্য", money: "টাকাপয়সার চিন্তা", loss: "কাউকে হারানোর কষ্ট", self_worth: "নিজেকে আপনি কীভাবে দেখেন", worry: "যা নিয়ে আপনি চিন্তায় ছিলেন", good_news: "ভালো কিছু, যা ঘটেছে", overthinking: "বেশি ভাবা", stuck: "আটকে থাকার অনুভূতি", argument: "একটা ঝগড়া", caring: "কারও দেখাশোনা", big_change: "একটা বড় পরিবর্তন" },
    mr: { work: "काम", studies: "तुमचा अभ्यास", family: "कुटुंब", close_person: "तुमच्या जवळची व्यक्ती", alone: "एकटेपणा", sleep: "झोप", health: "तुमची तब्येत", money: "पैशांची काळजी", loss: "कोणाला तरी गमावल्याचं दुःख", self_worth: "तुम्ही स्वतःकडे कसं पाहता", worry: "ज्याची तुम्हाला काळजी वाटत होती", good_news: "काहीतरी चांगलं जे घडलं", overthinking: "अति विचार", stuck: "अडकल्यासारखं वाटणं", argument: "एक वाद", caring: "कोणाची तरी काळजी घेणं", big_change: "एक मोठा बदल" },
    ta: { work: "வேலை", studies: "உங்கள் படிப்பு", family: "குடும்பம்", close_person: "உங்களுக்கு நெருக்கமான ஒருவர்", alone: "தனிமை", sleep: "தூக்கம்", health: "உங்கள் உடல்நலம்", money: "பணக் கவலை", loss: "ஓர் இழப்பு", self_worth: "நீங்கள் உங்களை எப்படிப் பார்க்கிறீர்கள்", worry: "உங்களைக் கவலைப்படுத்திய விஷயம்", good_news: "நடந்த ஒரு நல்ல விஷயம்", overthinking: "அதிகமாக யோசிப்பது", stuck: "சிக்கிக்கொண்ட உணர்வு", argument: "ஒரு வாக்குவாதம்", caring: "ஒருவரைக் கவனித்துக்கொள்வது", big_change: "ஒரு பெரிய மாற்றம்" },
    te: { work: "పని", studies: "మీ చదువు", family: "కుటుంబం", close_person: "మీకు దగ్గరైన ఒకరు", alone: "ఒంటరితనం", sleep: "నిద్ర", health: "మీ ఆరోగ్యం", money: "డబ్బు గురించిన ఆందోళన", loss: "ఒక నష్టం", self_worth: "మిమ్మల్ని మీరు ఎలా చూసుకుంటున్నారు", worry: "మిమ్మల్ని ఆందోళనపెట్టిన విషయం", good_news: "జరిగిన ఒక మంచి విషయం", overthinking: "అతిగా ఆలోచించడం", stuck: "ఇరుక్కుపోయిన భావన", argument: "ఒక వాదన", caring: "ఒకరిని చూసుకోవడం", big_change: "ఒక పెద్ద మార్పు" },
    gu: { work: "કામ", studies: "તમારો અભ્યાસ", family: "પરિવાર", close_person: "તમારી નજીકની વ્યક્તિ", alone: "એકલતા", sleep: "ઊંઘ", health: "તમારું સ્વાસ્થ્ય", money: "પૈસાની ચિંતા", loss: "કોઈને ગુમાવવાનું દુઃખ", self_worth: "તમે પોતાને કેવી રીતે જુઓ છો", worry: "જે વાત તમને ચિંતા કરાવતી હતી", good_news: "કંઈક સારું જે બન્યું", overthinking: "વધુ પડતું વિચારવું", stuck: "અટવાઈ ગયાની લાગણી", argument: "એક ઝઘડો", caring: "કોઈની સંભાળ", big_change: "એક મોટો બદલાવ" },
    kn: { work: "ಕೆಲಸ", studies: "ನಿಮ್ಮ ಓದು", family: "ಕುಟುಂಬ", close_person: "ನಿಮಗೆ ಹತ್ತಿರದವರು", alone: "ಒಂಟಿತನ", sleep: "ನಿದ್ದೆ", health: "ನಿಮ್ಮ ಆರೋಗ್ಯ", money: "ಹಣದ ಚಿಂತೆ", loss: "ಒಂದು ನಷ್ಟ", self_worth: "ನೀವು ನಿಮ್ಮನ್ನು ಹೇಗೆ ನೋಡುತ್ತೀರಿ", worry: "ನಿಮ್ಮನ್ನು ಚಿಂತೆಗೀಡು ಮಾಡಿದ ವಿಷಯ", good_news: "ನಡೆದ ಒಂದು ಒಳ್ಳೆಯ ವಿಷಯ", overthinking: "ಅತಿಯಾಗಿ ಯೋಚಿಸುವುದು", stuck: "ಸಿಲುಕಿಕೊಂಡ ಭಾವನೆ", argument: "ಒಂದು ವಾಗ್ವಾದ", caring: "ಯಾರನ್ನಾದರೂ ನೋಡಿಕೊಳ್ಳುವುದು", big_change: "ಒಂದು ದೊಡ್ಡ ಬದಲಾವಣೆ" },
    ml: { work: "ജോലി", studies: "നിങ്ങളുടെ പഠനം", family: "കുടുംബം", close_person: "നിങ്ങളോട് അടുപ്പമുള്ള ഒരാൾ", alone: "ഒറ്റപ്പെടൽ", sleep: "ഉറക്കം", health: "നിങ്ങളുടെ ആരോഗ്യം", money: "പണത്തെക്കുറിച്ചുള്ള ആധി", loss: "ഒരു നഷ്ടം", self_worth: "നിങ്ങൾ നിങ്ങളെ എങ്ങനെ കാണുന്നു", worry: "നിങ്ങളെ ആശങ്കപ്പെടുത്തിയ കാര്യം", good_news: "സംഭവിച്ച ഒരു നല്ല കാര്യം", overthinking: "അമിതമായ ചിന്ത", stuck: "കുടുങ്ങിപ്പോയ തോന്നൽ", argument: "ഒരു വഴക്ക്", caring: "ഒരാളെ പരിചരിക്കുന്നത്", big_change: "ഒരു വലിയ മാറ്റം" },
    pa: { work: "ਕੰਮ", studies: "ਤੁਹਾਡੀ ਪੜ੍ਹਾਈ", family: "ਪਰਿਵਾਰ", close_person: "ਤੁਹਾਡਾ ਕੋਈ ਨੇੜਲਾ", alone: "ਇਕੱਲਾਪਣ", sleep: "ਨੀਂਦ", health: "ਤੁਹਾਡੀ ਸਿਹਤ", money: "ਪੈਸੇ ਦੀ ਚਿੰਤਾ", loss: "ਕਿਸੇ ਨੂੰ ਗੁਆਉਣ ਦਾ ਦੁੱਖ", self_worth: "ਤੁਸੀਂ ਆਪਣੇ ਆਪ ਨੂੰ ਕਿਵੇਂ ਦੇਖਦੇ ਹੋ", worry: "ਜਿਸ ਗੱਲ ਦੀ ਤੁਹਾਨੂੰ ਚਿੰਤਾ ਸੀ", good_news: "ਕੁਝ ਚੰਗਾ ਜੋ ਹੋਇਆ", overthinking: "ਬਹੁਤ ਜ਼ਿਆਦਾ ਸੋਚਣਾ", stuck: "ਫਸੇ ਹੋਣ ਦਾ ਅਹਿਸਾਸ", argument: "ਇੱਕ ਬਹਿਸ", caring: "ਕਿਸੇ ਦੀ ਦੇਖਭਾਲ", big_change: "ਇੱਕ ਵੱਡੀ ਤਬਦੀਲੀ" },
    or: { work: "କାମ", studies: "ଆପଣଙ୍କ ପଢ଼ାପଢ଼ି", family: "ପରିବାର", close_person: "ଆପଣଙ୍କ ନିକଟର କେହି", alone: "ଏକାକୀପଣ", sleep: "ନିଦ", health: "ଆପଣଙ୍କ ସ୍ୱାସ୍ଥ୍ୟ", money: "ଟଙ୍କାପଇସାର ଚିନ୍ତା", loss: "କାହାକୁ ହରାଇବାର ଦୁଃଖ", self_worth: "ଆପଣ ନିଜକୁ କିପରି ଦେଖନ୍ତି", worry: "ଯାହା ଆପଣଙ୍କୁ ଚିନ୍ତାରେ ପକାଉଥିଲା", good_news: "କିଛି ଭଲ ଯାହା ଘଟିଲା", overthinking: "ଅଧିକ ଭାବିବା", stuck: "ଅଟକି ରହିଥିବା ଭଳି ଲାଗିବା", argument: "ଗୋଟିଏ ଯୁକ୍ତିତର୍କ", caring: "କାହାର ଯତ୍ନ ନେବା", big_change: "ଏକ ବଡ଼ ପରିବର୍ତ୍ତନ" },
    ur: { work: "کام", studies: "آپ کی پڑھائی", family: "گھر والے", close_person: "آپ کا کوئی قریبی", alone: "تنہائی", sleep: "نیند", health: "آپ کی صحت", money: "پیسوں کی فکر", loss: "کسی کو کھونے کا دکھ", self_worth: "آپ خود کو کیسے دیکھتے ہیں", worry: "جو بات آپ کو پریشان کر رہی تھی", good_news: "کچھ اچھا جو ہوا", overthinking: "حد سے زیادہ سوچنا", stuck: "پھنسے ہونے کا احساس", argument: "ایک بحث", caring: "کسی کی دیکھ بھال", big_change: "ایک بڑی تبدیلی" },
    ar: { work: "العمل", studies: "دراستك", family: "العائلة", close_person: "شخص قريب منك", alone: "الشعور بالوحدة", sleep: "النوم", health: "صحتك", money: "همّ المال", loss: "فقدان", self_worth: "نظرتك إلى نفسك", worry: "ما كان يقلقك", good_news: "شيء جميل حدث", overthinking: "كثرة التفكير", stuck: "الشعور بالجمود", argument: "خلاف", caring: "رعاية شخص ما", big_change: "تغيير كبير" },
    ru: { work: "работа", studies: "ваша учёба", family: "семья", close_person: "близкий вам человек", alone: "одиночество", sleep: "сон", health: "ваше здоровье", money: "денежные заботы", loss: "утрата", self_worth: "как вы видите себя", worry: "то, что вас тревожило", good_news: "что-то хорошее, что случилось", overthinking: "навязчивые мысли", stuck: "ощущение тупика", argument: "ссора", caring: "забота о ком-то", big_change: "большая перемена" },
    zh: { work: "工作", studies: "你的学业", family: "家人", close_person: "你身边亲近的人", alone: "孤独感", sleep: "睡眠", health: "你的健康", money: "钱的烦恼", loss: "一次失去", self_worth: "你怎么看待自己", worry: "让你担心的事", good_news: "一件好事", overthinking: "想太多", stuck: "卡住的感觉", argument: "一次争吵", caring: "照顾某个人", big_change: "一个大变化" },
    ja: { work: "仕事", studies: "勉強のこと", family: "家族", close_person: "身近な人", alone: "孤独な気持ち", sleep: "眠り", health: "体調", money: "お金の心配", loss: "大切なものを失ったこと", self_worth: "自分のことをどう見ているか", worry: "気がかりだったこと", good_news: "うれしい出来事", overthinking: "考えすぎ", stuck: "行き詰まった気持ち", argument: "言い争い", caring: "誰かのお世話", big_change: "大きな変化" },
    es: { work: "el trabajo", studies: "tus estudios", family: "la familia", close_person: "alguien cercano a ti", alone: "sentirte solo/a", sleep: "el sueño", health: "tu salud", money: "preocupaciones de dinero", loss: "una pérdida", self_worth: "cómo te ves a ti mismo/a", worry: "lo que te preocupaba", good_news: "algo bueno que pasó", overthinking: "pensar demasiado", stuck: "sentirte estancado/a", argument: "una discusión", caring: "cuidar de alguien", big_change: "un gran cambio" },
    fr: { work: "le travail", studies: "vos études", family: "la famille", close_person: "une personne proche", alone: "le sentiment de solitude", sleep: "le sommeil", health: "votre santé", money: "les soucis d'argent", loss: "une perte", self_worth: "votre regard sur vous-même", worry: "ce qui vous inquiétait", good_news: "une bonne nouvelle", overthinking: "les pensées qui tournent en boucle", stuck: "le sentiment d'être bloqué·e", argument: "une dispute", caring: "prendre soin de quelqu'un", big_change: "un grand changement" },
    de: { work: "die Arbeit", studies: "dein Studium oder deine Schule", family: "die Familie", close_person: "ein Mensch, der dir nahesteht", alone: "das Gefühl, allein zu sein", sleep: "der Schlaf", health: "deine Gesundheit", money: "Geldsorgen", loss: "ein Verlust", self_worth: "wie du dich selbst siehst", worry: "was dich beschäftigt hat", good_news: "etwas Schönes, das passiert ist", overthinking: "Grübeln", stuck: "das Gefühl, festzustecken", argument: "ein Streit", caring: "die Sorge für jemanden", big_change: "eine große Veränderung" },
    pt: { work: "o trabalho", studies: "seus estudos", family: "a família", close_person: "alguém próximo de você", alone: "a solidão", sleep: "o sono", health: "sua saúde", money: "preocupações com dinheiro", loss: "uma perda", self_worth: "como você se vê", worry: "o que estava te preocupando", good_news: "algo bom que aconteceu", overthinking: "pensar demais", stuck: "a sensação de estar travado/a", argument: "uma discussão", caring: "cuidar de alguém", big_change: "uma grande mudança" },
    id: { work: "pekerjaan", studies: "sekolah atau kuliahmu", family: "keluarga", close_person: "seseorang yang dekat denganmu", alone: "rasa sendiri", sleep: "tidur", health: "kesehatanmu", money: "kekhawatiran soal uang", loss: "sebuah kehilangan", self_worth: "caramu memandang diri sendiri", worry: "hal yang membuatmu khawatir", good_news: "hal baik yang terjadi", overthinking: "terlalu banyak berpikir", stuck: "rasa buntu", argument: "sebuah pertengkaran", caring: "merawat seseorang", big_change: "sebuah perubahan besar" },
    he: { work: "העבודה", studies: "הלימודים שלך", family: "המשפחה", close_person: "מישהו קרוב אליך", alone: "תחושת בדידות", sleep: "שינה", health: "הבריאות שלך", money: "דאגות כסף", loss: "אובדן", self_worth: "איך את/ה רואה את עצמך", worry: "מה שהדאיג אותך", good_news: "משהו טוב שקרה", overthinking: "מחשבות שלא מרפות", stuck: "תחושת תקיעות", argument: "ויכוח", caring: "טיפול במישהו", big_change: "שינוי גדול" },
};

export const WELCOME: Record<string, WelcomeStrings> = {
    en: { lead: "Welcome back.", topic: (t) => `Last time we talked about: ${t}.`, ask: "Want to pick up where we left off?", pick: "Pick up", fresh: "Start fresh" },
    hi: { lead: "आपका फिर से स्वागत है।", topic: (t) => `पिछली बार हमने इस बारे में बात की थी: ${t}।`, ask: "क्या वहीं से आगे बात करें?", pick: "वहीं से आगे", fresh: "नई शुरुआत" },
    bn: { lead: "আবার দেখা হলো।", topic: (t) => `গতবার আমরা কথা বলেছিলাম: ${t}।`, ask: "যেখানে থেমেছিলাম, সেখান থেকে শুরু করবেন?", pick: "সেখান থেকে শুরু", fresh: "নতুন করে শুরু" },
    mr: { lead: "पुन्हा स्वागत आहे.", topic: (t) => `मागच्या वेळी आपण याबद्दल बोललो होतो: ${t}.`, ask: "तिथूनच पुढे बोलूया का?", pick: "तिथूनच पुढे", fresh: "नवी सुरुवात" },
    ta: { lead: "மீண்டும் வருக.", topic: (t) => `கடந்த முறை நாம் பேசியது: ${t}.`, ask: "நிறுத்திய இடத்திலிருந்து தொடரலாமா?", pick: "அங்கிருந்து தொடர்", fresh: "புதிதாகத் தொடங்கு" },
    te: { lead: "మళ్ళీ స్వాగతం.", topic: (t) => `గతసారి మనం మాట్లాడింది: ${t}.`, ask: "ఆపిన చోటు నుండి కొనసాగిద్దామా?", pick: "అక్కడి నుండి కొనసాగించు", fresh: "కొత్తగా మొదలుపెట్టు" },
    gu: { lead: "ફરી સ્વાગત છે.", topic: (t) => `ગયા વખતે આપણે આ વિશે વાત કરી હતી: ${t}.`, ask: "જ્યાં અટક્યા હતા ત્યાંથી આગળ વધીએ?", pick: "ત્યાંથી આગળ", fresh: "નવી શરૂઆત" },
    kn: { lead: "ಮತ್ತೆ ಸ್ವಾಗತ.", topic: (t) => `ಕಳೆದ ಬಾರಿ ನಾವು ಮಾತನಾಡಿದ್ದು: ${t}.`, ask: "ನಿಲ್ಲಿಸಿದಲ್ಲಿಂದ ಮುಂದುವರಿಸೋಣವೇ?", pick: "ಅಲ್ಲಿಂದ ಮುಂದುವರಿಸಿ", fresh: "ಹೊಸದಾಗಿ ಆರಂಭಿಸಿ" },
    ml: { lead: "വീണ്ടും സ്വാഗതം.", topic: (t) => `കഴിഞ്ഞ തവണ നമ്മൾ സംസാരിച്ചത്: ${t}.`, ask: "നിർത്തിയിടത്തുനിന്ന് തുടരാമോ?", pick: "അവിടെനിന്ന് തുടരാം", fresh: "പുതുതായി തുടങ്ങാം" },
    pa: { lead: "ਫਿਰ ਤੋਂ ਜੀ ਆਇਆਂ ਨੂੰ।", topic: (t) => `ਪਿਛਲੀ ਵਾਰ ਅਸੀਂ ਇਸ ਬਾਰੇ ਗੱਲ ਕੀਤੀ ਸੀ: ${t}।`, ask: "ਕੀ ਉੱਥੋਂ ਹੀ ਅੱਗੇ ਗੱਲ ਕਰੀਏ?", pick: "ਉੱਥੋਂ ਅੱਗੇ", fresh: "ਨਵੀਂ ਸ਼ੁਰੂਆਤ" },
    or: { lead: "ପୁଣି ସ୍ୱାଗତ।", topic: (t) => `ଗତ ଥର ଆମେ କଥା ହୋଇଥିଲୁ: ${t}।`, ask: "ଯେଉଁଠି ଅଟକିଥିଲୁ, ସେଠାରୁ ଆଗକୁ ବଢ଼ିବା କି?", pick: "ସେଠାରୁ ଆଗକୁ", fresh: "ନୂଆ ଆରମ୍ଭ" },
    ur: { lead: "دوبارہ خوش آمدید۔", topic: (t) => `پچھلی بار ہم نے اس بارے میں بات کی تھی: ${t}۔`, ask: "کیا وہیں سے آگے بات کریں؟", pick: "وہیں سے آگے", fresh: "نئی شروعات" },
    ar: { lead: "أهلًا بعودتك.", topic: (t) => `تحدثنا في المرة الماضية عن: ${t}.`, ask: "هل نكمل من حيث توقفنا؟", pick: "نكمل من هناك", fresh: "بداية جديدة" },
    ru: { lead: "С возвращением.", topic: (t) => `В прошлый раз мы говорили на тему: ${t}.`, ask: "Продолжим с того места, где остановились?", pick: "Продолжить", fresh: "Начать заново" },
    zh: { lead: "欢迎回来。", topic: (t) => `上次我们聊到：${t}。`, ask: "要接着上次的话题聊吗？", pick: "接着聊", fresh: "重新开始" },
    ja: { lead: "おかえりなさい。", topic: (t) => `前回お話ししたこと：${t}。`, ask: "前回の続きから話しますか？", pick: "続きから", fresh: "新しく始める" },
    es: { lead: "Qué bueno verte de nuevo.", topic: (t) => `La última vez hablamos de: ${t}.`, ask: "¿Seguimos donde lo dejamos?", pick: "Seguir", fresh: "Empezar de nuevo" },
    fr: { lead: "Bon retour.", topic: (t) => `La dernière fois, nous avons parlé de : ${t}.`, ask: "Voulez-vous reprendre là où nous nous sommes arrêtés ?", pick: "Reprendre", fresh: "Repartir de zéro" },
    de: { lead: "Schön, dass du wieder da bist.", topic: (t) => `Letztes Mal ging es um: ${t}.`, ask: "Willst du da weitermachen, wo wir aufgehört haben?", pick: "Weitermachen", fresh: "Neu anfangen" },
    pt: { lead: "Que bom ter você de volta.", topic: (t) => `Da última vez, conversamos sobre: ${t}.`, ask: "Quer continuar de onde paramos?", pick: "Continuar", fresh: "Começar do zero" },
    id: { lead: "Selamat datang kembali.", topic: (t) => `Terakhir kali kita membicarakan: ${t}.`, ask: "Mau lanjut dari bagian terakhir?", pick: "Lanjutkan", fresh: "Mulai baru" },
    he: { lead: "טוב שחזרת.", topic: (t) => `בפעם הקודמת דיברנו על: ${t}.`, ask: "להמשיך מאיפה שעצרנו?", pick: "להמשיך", fresh: "להתחיל מחדש" },
};

/** The card's text for this language: the topic line only when the topic is one of ours. */
export function welcomeBackText(lang: string | null | undefined, topic: unknown): { lines: string[]; pick: string; fresh: string } {
    const base = String(lang ?? "en").toLowerCase().split(/[-_]/)[0];
    const w = WELCOME[base] ?? WELCOME.en;
    const labels = TOPIC_LABELS[base] ?? TOPIC_LABELS.en;
    const lines = [w.lead];
    if (isSessionTopic(topic)) lines.push(w.topic(labels[topic]));
    lines.push(w.ask);
    return { lines, pick: w.pick, fresh: w.fresh };
}

/** What the device keeps about the last conversation. ⛔ Never any words — only a topic key. */
export type LastSession = { threadId: string; topic: SessionTopic | null; at: number; userMessages: number; crisis: boolean };

/** A visit counts as "coming back" after this long away. */
export const WELCOME_BACK_AFTER_MS = 4 * 60 * 60 * 1000;
/** …and older than this, the last conversation is too far away to name. */
export const WELCOME_BACK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Show the card on this visit?
 * ⛔ never after a crisis signal · only after a real exchange (2+ messages) ·
 * only when the person has actually been away · never once dismissed for that conversation.
 */
export function shouldShowWelcomeBack(s: LastSession | null, now: number, dismissedFor: string | null): boolean {
    if (!s || s.crisis) return false;
    if (s.userMessages < 2) return false;
    const away = now - s.at;
    if (!(away >= WELCOME_BACK_AFTER_MS && away <= WELCOME_BACK_MAX_AGE_MS)) return false;
    return dismissedFor !== s.threadId + ":" + s.at;
}
