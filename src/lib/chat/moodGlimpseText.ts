// src/lib/chat/moodGlimpseText.ts
// The "Mood glimpse" card in the conversation's language (#121b, 11 Nov 2026).
//
// 🔴 DISPLAY ONLY. getLocalMoodHint() still returns its English sentence: that
// string is stored on messages and feeds the reply's context
// (trap_mobile_emotion_label_loops_into_prompt) and picks the card's tint.
// ⛔ Translating it at the source could change replies — so the English
// sentence is matched here and only the words on the card change.
// Any sentence not recognised is shown exactly as before (English).

export type MoodKey = "stuck" | "low" | "tense" | "upset" | "joy" | "hope" | "listen";

type Lines = { label: string; stuck: string; low: (name: string) => string; tense: string; upset: string; joy: string; hope: string; listen: string };

/** The English sentences getLocalMoodHint() returns ⇒ which one it is. */
export function moodKeyOf(englishHint: string): MoodKey | null {
  const h = englishHint.trim();
  if (h.startsWith("You sound a bit stuck or unsure.")) return "stuck";
  if (h.startsWith("You seem a bit low.")) return "low";
  if (h.startsWith("It sounds like something is making you feel tense or worried.")) return "tense";
  if (h.startsWith("It sounds like something has really upset or frustrated you.")) return "upset";
  if (h.startsWith("I can sense some joy or lightness")) return "joy";
  if (h.startsWith("I can sense a little bit of light or hope")) return "hope";
  if (h.startsWith("I'm listening closely.")) return "listen";
  return null;
}

export const MOOD_GLIMPSE: Record<string, Lines> = {
  hi: {
    label: "मन की झलक",
    stuck: "लगता है आप थोड़ा उलझे हुए या असमंजस में हैं। चीज़ों को सुलझाने के लिए समय लेना ठीक है।",
    low: (n) => `लगता है आपका मन थोड़ा उदास है। ऐसा महसूस करना ठीक है — ${n} आपके साथ है।`,
    tense: "लगता है कोई बात आपको तनाव या चिंता में डाल रही है।",
    upset: "लगता है किसी बात ने आपको सच में परेशान या नाराज़ किया है।",
    joy: "आपकी बातों में थोड़ी खुशी या हल्कापन महसूस हो रहा है।",
    hope: "आपकी बातों में थोड़ी रोशनी या उम्मीद महसूस हो रही है।",
    listen: "यहाँ आपकी हर बात ध्यान से सुनी जा रही है। आप जैसा भी महसूस करें, उसकी यहाँ अहमियत है।",
  },
  bn: {
    label: "মনের ঝলক",
    stuck: "মনে হচ্ছে তুমি একটু আটকে গেছ বা দ্বিধায় আছ। সবকিছু গুছিয়ে নিতে সময় নেওয়াই ঠিক।",
    low: (n) => `মনে হচ্ছে তোমার মনটা একটু খারাপ। এমন লাগাটা স্বাভাবিক — ${n} তোমার পাশে আছে।`,
    tense: "মনে হচ্ছে কিছু একটা তোমাকে চিন্তায় বা টেনশনে ফেলেছে।",
    upset: "মনে হচ্ছে কোনো কিছু তোমাকে সত্যিই কষ্ট দিয়েছে বা বিরক্ত করেছে।",
    joy: "তোমার কথায় একটু আনন্দ বা হালকা ভাব টের পাচ্ছি।",
    hope: "তোমার কথায় একটু আলো বা আশা টের পাচ্ছি।",
    listen: "মন দিয়ে শুনছি। তুমি যেমনই অনুভব করো, এখানে তার মূল্য আছে।",
  },
  mr: {
    label: "मनाची झलक",
    stuck: "तुम्ही थोडे अडकल्यासारखे किंवा संभ्रमात वाटता. गोष्टी उलगडायला वेळ घेणं ठीक आहे.",
    low: (n) => `तुमचं मन थोडं उदास वाटतं. असं वाटणं ठीक आहे — ${n} तुमच्यासोबत आहे.`,
    tense: "काहीतरी तुम्हाला ताण किंवा काळजी देत आहे असं वाटतं.",
    upset: "काहीतरी तुम्हाला खरंच अस्वस्थ किंवा नाराज करून गेलं आहे असं वाटतं.",
    joy: "तुमच्या बोलण्यात थोडा आनंद किंवा हलकेपणा जाणवतो.",
    hope: "तुमच्या बोलण्यात थोडा प्रकाश किंवा आशा जाणवते.",
    listen: "मी लक्षपूर्वक ऐकत आहे. तुम्हाला कसंही वाटत असलं तरी इथे त्याला महत्त्व आहे.",
  },
  ta: {
    label: "மனநிலை ஒரு பார்வை",
    stuck: "நீங்கள் கொஞ்சம் குழப்பத்தில் அல்லது தயக்கத்தில் இருப்பது போல் தெரிகிறது. விஷயங்களைத் தெளிவுபடுத்த நேரம் எடுத்துக்கொள்வது பரவாயில்லை.",
    low: (n) => `நீங்கள் கொஞ்சம் சோர்வாக இருப்பது போல் தெரிகிறது. இப்படி உணர்வது பரவாயில்லை — ${n} உங்களுடன் இருக்கிறார்.`,
    tense: "ஏதோ ஒன்று உங்களுக்குப் பதற்றம் அல்லது கவலை தருவது போல் தெரிகிறது.",
    upset: "ஏதோ ஒன்று உங்களை உண்மையிலேயே வருத்தப்படுத்தியது அல்லது எரிச்சலூட்டியது போல் தெரிகிறது.",
    joy: "நீங்கள் பகிர்வதில் கொஞ்சம் மகிழ்ச்சி அல்லது இலகுவான உணர்வு தெரிகிறது.",
    hope: "நீங்கள் சொல்வதில் கொஞ்சம் ஒளி அல்லது நம்பிக்கை தெரிகிறது.",
    listen: "கவனமாகக் கேட்டுக்கொண்டிருக்கிறேன். நீங்கள் எப்படி உணர்ந்தாலும், அது இங்கே முக்கியம்.",
  },
  te: {
    label: "మనసు తీరు",
    stuck: "మీరు కొంచెం చిక్కుకుపోయినట్లు లేదా అయోమయంలో ఉన్నట్లు అనిపిస్తోంది. విషయాలను నెమ్మదిగా విప్పుకోవడానికి సమయం తీసుకోవడం పర్వాలేదు.",
    low: (n) => `మీ మనసు కొంచెం బాధగా ఉన్నట్లు అనిపిస్తోంది. ఇలా అనిపించడం సహజమే — ${n} మీతో ఉన్నారు.`,
    tense: "ఏదో విషయం మీకు ఒత్తిడి లేదా ఆందోళన కలిగిస్తున్నట్లు అనిపిస్తోంది.",
    upset: "ఏదో విషయం మిమ్మల్ని నిజంగా బాధపెట్టినట్లు లేదా చిరాకు కలిగించినట్లు అనిపిస్తోంది.",
    joy: "మీరు పంచుకుంటున్న దాంట్లో కొంచెం సంతోషం లేదా తేలికదనం కనిపిస్తోంది.",
    hope: "మీరు చెబుతున్న దాంట్లో కొంచెం వెలుగు లేదా ఆశ కనిపిస్తోంది.",
    listen: "శ్రద్ధగా వింటున్నాను. మీకు ఎలా అనిపించినా, అది ఇక్కడ ముఖ్యమే.",
  },
  gu: {
    label: "મનની ઝલક",
    stuck: "તમે થોડા ગૂંચવાયેલા કે અચોક્કસ લાગો છો. બાબતો ઉકેલવા માટે સમય લેવો બરાબર છે.",
    low: (n) => `તમારું મન થોડું ઉદાસ લાગે છે. આવું અનુભવવું બરાબર છે — ${n} તમારી સાથે છે.`,
    tense: "લાગે છે કે કોઈ વાત તમને તણાવ કે ચિંતામાં મૂકી રહી છે.",
    upset: "લાગે છે કે કોઈ વાતે તમને ખરેખર દુઃખી કે નારાજ કર્યા છે.",
    joy: "તમારી વાતમાં થોડો આનંદ કે હળવાશ અનુભવાય છે.",
    hope: "તમારી વાતમાં થોડો પ્રકાશ કે આશા અનુભવાય છે.",
    listen: "અહીં તમારી દરેક વાત ધ્યાનથી સંભળાય છે. તમે જેવું પણ અનુભવો, તેનું અહીં મહત્ત્વ છે.",
  },
  kn: {
    label: "ಮನಸ್ಸಿನ ಒಂದು ನೋಟ",
    stuck: "ನೀವು ಸ್ವಲ್ಪ ಗೊಂದಲದಲ್ಲಿ ಅಥವಾ ಅನಿಶ್ಚಿತತೆಯಲ್ಲಿ ಇರುವಂತೆ ಅನಿಸುತ್ತದೆ. ವಿಷಯಗಳನ್ನು ಬಿಡಿಸಿಕೊಳ್ಳಲು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುವುದು ಸರಿ.",
    low: (n) => `ನಿಮ್ಮ ಮನಸ್ಸು ಸ್ವಲ್ಪ ಬೇಸರದಲ್ಲಿರುವಂತೆ ಅನಿಸುತ್ತದೆ. ಹೀಗೆ ಅನಿಸುವುದು ಸಹಜ — ${n} ನಿಮ್ಮ ಜೊತೆಗಿದ್ದಾರೆ.`,
    tense: "ಯಾವುದೋ ವಿಷಯ ನಿಮಗೆ ಒತ್ತಡ ಅಥವಾ ಚಿಂತೆ ಉಂಟುಮಾಡುತ್ತಿರುವಂತೆ ಅನಿಸುತ್ತದೆ.",
    upset: "ಯಾವುದೋ ವಿಷಯ ನಿಮ್ಮನ್ನು ನಿಜವಾಗಿಯೂ ನೋಯಿಸಿದಂತೆ ಅಥವಾ ಕಿರಿಕಿರಿಗೊಳಿಸಿದಂತೆ ಅನಿಸುತ್ತದೆ.",
    joy: "ನೀವು ಹಂಚಿಕೊಳ್ಳುತ್ತಿರುವುದರಲ್ಲಿ ಸ್ವಲ್ಪ ಸಂತೋಷ ಅಥವಾ ಹಗುರತೆ ಕಾಣುತ್ತಿದೆ.",
    hope: "ನೀವು ಹೇಳುತ್ತಿರುವುದರಲ್ಲಿ ಸ್ವಲ್ಪ ಬೆಳಕು ಅಥವಾ ಭರವಸೆ ಕಾಣುತ್ತಿದೆ.",
    listen: "ಗಮನವಿಟ್ಟು ಕೇಳುತ್ತಿದ್ದೇನೆ. ನಿಮಗೆ ಹೇಗೇ ಅನಿಸಿದರೂ, ಅದು ಇಲ್ಲಿ ಮುಖ್ಯ.",
  },
  ml: {
    label: "മനസ്സിന്റെ ഒരു നോട്ടം",
    stuck: "നിങ്ങൾ അൽപ്പം കുരുങ്ങിയതുപോലെയോ ആശയക്കുഴപ്പത്തിലോ ആണെന്ന് തോന്നുന്നു. കാര്യങ്ങൾ അഴിച്ചെടുക്കാൻ സമയമെടുക്കുന്നതിൽ കുഴപ്പമില്ല.",
    low: (n) => `നിങ്ങളുടെ മനസ്സ് അൽപ്പം വിഷമത്തിലാണെന്ന് തോന്നുന്നു. ഇങ്ങനെ തോന്നുന്നത് സ്വാഭാവികമാണ് — ${n} നിങ്ങളോടൊപ്പമുണ്ട്.`,
    tense: "എന്തോ ഒന്ന് നിങ്ങളെ സമ്മർദ്ദത്തിലോ ആശങ്കയിലോ ആക്കുന്നതുപോലെ തോന്നുന്നു.",
    upset: "എന്തോ ഒന്ന് നിങ്ങളെ ശരിക്കും വിഷമിപ്പിക്കുകയോ അലോസരപ്പെടുത്തുകയോ ചെയ്തതുപോലെ തോന്നുന്നു.",
    joy: "നിങ്ങൾ പങ്കുവെക്കുന്നതിൽ അൽപ്പം സന്തോഷമോ ലാഘവമോ അനുഭവപ്പെടുന്നു.",
    hope: "നിങ്ങൾ പറയുന്നതിൽ അൽപ്പം വെളിച്ചമോ പ്രതീക്ഷയോ അനുഭവപ്പെടുന്നു.",
    listen: "ശ്രദ്ധയോടെ കേൾക്കുന്നുണ്ട്. നിങ്ങൾക്ക് എങ്ങനെ തോന്നിയാലും, അത് ഇവിടെ പ്രധാനമാണ്.",
  },
  pa: {
    label: "ਮਨ ਦੀ ਝਲਕ",
    stuck: "ਲੱਗਦਾ ਹੈ ਤੁਸੀਂ ਥੋੜ੍ਹਾ ਉਲਝੇ ਹੋਏ ਜਾਂ ਦੁਚਿੱਤੀ ਵਿੱਚ ਹੋ। ਗੱਲਾਂ ਸੁਲਝਾਉਣ ਲਈ ਸਮਾਂ ਲੈਣਾ ਠੀਕ ਹੈ।",
    low: (n) => `ਲੱਗਦਾ ਹੈ ਤੁਹਾਡਾ ਮਨ ਥੋੜ੍ਹਾ ਉਦਾਸ ਹੈ। ਇਸ ਤਰ੍ਹਾਂ ਮਹਿਸੂਸ ਕਰਨਾ ਠੀਕ ਹੈ — ${n} ਤੁਹਾਡੇ ਨਾਲ ਹੈ।`,
    tense: "ਲੱਗਦਾ ਹੈ ਕੋਈ ਗੱਲ ਤੁਹਾਨੂੰ ਤਣਾਅ ਜਾਂ ਚਿੰਤਾ ਵਿੱਚ ਪਾ ਰਹੀ ਹੈ।",
    upset: "ਲੱਗਦਾ ਹੈ ਕਿਸੇ ਗੱਲ ਨੇ ਤੁਹਾਨੂੰ ਸੱਚਮੁੱਚ ਪਰੇਸ਼ਾਨ ਜਾਂ ਨਾਰਾਜ਼ ਕੀਤਾ ਹੈ।",
    joy: "ਤੁਹਾਡੀਆਂ ਗੱਲਾਂ ਵਿੱਚ ਥੋੜ੍ਹੀ ਖੁਸ਼ੀ ਜਾਂ ਹਲਕਾਪਣ ਮਹਿਸੂਸ ਹੁੰਦਾ ਹੈ।",
    hope: "ਤੁਹਾਡੀਆਂ ਗੱਲਾਂ ਵਿੱਚ ਥੋੜ੍ਹੀ ਰੌਸ਼ਨੀ ਜਾਂ ਉਮੀਦ ਮਹਿਸੂਸ ਹੁੰਦੀ ਹੈ।",
    listen: "ਇੱਥੇ ਤੁਹਾਡੀ ਹਰ ਗੱਲ ਧਿਆਨ ਨਾਲ ਸੁਣੀ ਜਾ ਰਹੀ ਹੈ। ਤੁਸੀਂ ਜਿਵੇਂ ਵੀ ਮਹਿਸੂਸ ਕਰੋ, ਉਸਦੀ ਇੱਥੇ ਅਹਿਮੀਅਤ ਹੈ।",
  },
  or: {
    label: "ମନର ଝଲକ",
    stuck: "ଲାଗୁଛି ଆପଣ ଟିକେ ଦ୍ୱିଧାରେ ବା ଅନିଶ୍ଚିତତାରେ ଅଛନ୍ତି। କଥାଗୁଡ଼ିକୁ ସଜାଡ଼ିବା ପାଇଁ ସମୟ ନେବା ଠିକ୍।",
    low: (n) => `ଲାଗୁଛି ଆପଣଙ୍କ ମନ ଟିକେ ଦୁଃଖୀ ଅଛି। ଏମିତି ଅନୁଭବ କରିବା ଠିକ୍ — ${n} ଆପଣଙ୍କ ସହିତ ଅଛି।`,
    tense: "ଲାଗୁଛି କିଛି କଥା ଆପଣଙ୍କୁ ଚାପ ବା ଚିନ୍ତାରେ ପକାଉଛି।",
    upset: "ଲାଗୁଛି କିଛି କଥା ଆପଣଙ୍କୁ ସତରେ ଦୁଃଖ ବା ବିରକ୍ତି ଦେଇଛି।",
    joy: "ଆପଣଙ୍କ କଥାରେ ଟିକେ ଆନନ୍ଦ ବା ହାଲୁକା ଭାବ ଅନୁଭବ ହେଉଛି।",
    hope: "ଆପଣଙ୍କ କଥାରେ ଟିକେ ଆଲୋକ ବା ଆଶା ଅନୁଭବ ହେଉଛି।",
    listen: "ଧ୍ୟାନ ଦେଇ ଶୁଣୁଛି। ଆପଣ ଯେମିତି ବି ଅନୁଭବ କରନ୍ତୁ, ତାହା ଏଠାରେ ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ।",
  },
  ur: {
    label: "مزاج کی جھلک",
    stuck: "لگتا ہے آپ تھوڑا الجھے ہوئے یا شش و پنج میں ہیں۔ چیزوں کو سلجھانے کے لیے وقت لینا ٹھیک ہے۔",
    low: (n) => `لگتا ہے آپ کا دل تھوڑا اداس ہے۔ ایسا محسوس کرنا ٹھیک ہے — ${n} آپ کے ساتھ ہے۔`,
    tense: "لگتا ہے کوئی بات آپ کو تناؤ یا فکر میں ڈال رہی ہے۔",
    upset: "لگتا ہے کسی بات نے آپ کو واقعی پریشان یا ناراض کیا ہے۔",
    joy: "آپ کی باتوں میں تھوڑی خوشی یا ہلکا پن محسوس ہو رہا ہے۔",
    hope: "آپ کی باتوں میں تھوڑی روشنی یا امید محسوس ہو رہی ہے۔",
    listen: "یہاں آپ کی ہر بات توجہ سے سنی جا رہی ہے۔ آپ جیسا بھی محسوس کریں، یہاں اس کی اہمیت ہے۔",
  },
  ar: {
    label: "لمحة عن مزاجك",
    stuck: "يبدو أنك عالق قليلًا أو غير متأكد. لا بأس أن تأخذ وقتك لترتيب الأمور.",
    low: (n) => `يبدو أنك حزين قليلًا. لا بأس أن تشعر بذلك — ${n} هنا معك.`,
    tense: "يبدو أن شيئًا ما يجعلك متوترًا أو قلقًا.",
    upset: "يبدو أن شيئًا ما قد أزعجك أو أحبطك حقًا.",
    joy: "أشعر بشيء من الفرح أو الخفّة فيما تشاركه.",
    hope: "أشعر بقليل من النور أو الأمل فيما تقوله.",
    listen: "أستمع إليك باهتمام. مهما كان شعورك، فهو مهم هنا.",
  },
  he: {
    label: "הצצה למצב הרוח",
    stuck: "נשמע שיש קצת בלבול או חוסר ודאות. זה בסדר לקחת זמן כדי לסדר את הדברים.",
    low: (n) => `נשמע שמצב הרוח קצת ירוד. זה בסדר להרגיש כך — ${n} כאן איתך.`,
    tense: "נשמע שמשהו גורם למתח או לדאגה.",
    upset: "נשמע שמשהו ממש הרגיז או תסכל.",
    joy: "יש קצת שמחה או קלילות במה שנכתב כאן.",
    hope: "יש קצת אור או תקווה במה שנכתב כאן.",
    listen: "מקשיבים לך כאן בתשומת לב. כל מה שמרגישים — חשוב כאן.",
  },
  ru: {
    label: "Настроение",
    stuck: "Похоже, вы немного запутались или не уверены. Это нормально — не торопиться и разобраться.",
    low: (n) => `Похоже, вам сейчас немного грустно. Так чувствовать нормально — ${n} рядом с вами.`,
    tense: "Похоже, что-то вызывает у вас напряжение или тревогу.",
    upset: "Похоже, что-то вас по-настоящему расстроило или разозлило.",
    joy: "В том, чем вы делитесь, чувствуется немного радости или лёгкости.",
    hope: "В ваших словах чувствуется немного света или надежды.",
    listen: "Я внимательно слушаю. Что бы вы ни чувствовали, здесь это важно.",
  },
  zh: {
    label: "心情速览",
    stuck: "你似乎有点卡住或拿不定主意。慢慢来，花点时间理清思绪也没关系。",
    low: (n) => `你似乎有点低落。有这样的感受没关系——${n}在这里陪着你。`,
    tense: "似乎有什么事让你感到紧张或担心。",
    upset: "似乎有什么事真的让你难过或沮丧。",
    joy: "我能从你的分享中感受到一些喜悦或轻松。",
    hope: "我能从你的话里感受到一点光亮或希望。",
    listen: "我在认真听。无论你现在是什么感受，在这里都很重要。",
  },
  ja: {
    label: "気分のようす",
    stuck: "少し行き詰まっていたり、迷っていたりするようですね。ゆっくり時間をかけて整理しても大丈夫です。",
    low: (n) => `少し気分が沈んでいるようですね。そう感じても大丈夫です — ${n}がそばにいます。`,
    tense: "何かが緊張や不安の原因になっているようですね。",
    upset: "何かに本当に傷ついたり、イライラしたりしたようですね。",
    joy: "お話から、少し喜びや軽やかさが感じられます。",
    hope: "お話から、少し光や希望が感じられます。",
    listen: "しっかり聞いています。どんな気持ちでも、ここでは大切です。",
  },
  es: {
    label: "Tu ánimo",
    stuck: "Parece que hay algo de confusión o duda. Está bien tomarte tu tiempo para ordenar las cosas.",
    low: (n) => `Parece que estás pasando un momento un poco bajo. Está bien sentirse así: ${n} está aquí contigo.`,
    tense: "Parece que algo te está causando tensión o preocupación.",
    upset: "Parece que algo te ha molestado o frustrado de verdad.",
    joy: "Noto algo de alegría o ligereza en lo que compartes.",
    hope: "Noto un poco de luz o esperanza en lo que dices.",
    listen: "Te escucho con atención. Sientas lo que sientas, aquí importa.",
  },
  fr: {
    label: "Votre humeur",
    stuck: "On dirait qu'il y a un peu de confusion ou d'hésitation. Prendre le temps de démêler les choses, c'est normal.",
    low: (n) => `On dirait que le moral est un peu bas. C'est normal de ressentir cela — ${n} est là avec vous.`,
    tense: "On dirait que quelque chose vous cause de la tension ou de l'inquiétude.",
    upset: "On dirait que quelque chose a vraiment été contrariant ou frustrant pour vous.",
    joy: "Je sens un peu de joie ou de légèreté dans ce que vous partagez.",
    hope: "Je sens un peu de lumière ou d'espoir dans ce que vous dites.",
    listen: "Je vous écoute attentivement. Quoi que vous ressentiez, cela compte ici.",
  },
  de: {
    label: "Stimmungsbild",
    stuck: "Es klingt, als würdest du gerade etwas feststecken oder unsicher sein. Es ist okay, dir Zeit zu nehmen, um die Dinge zu sortieren.",
    low: (n) => `Du wirkst etwas niedergeschlagen. Es ist okay, so zu fühlen — ${n} ist für dich da.`,
    tense: "Es klingt, als würde dich etwas anspannen oder dir Sorgen machen.",
    upset: "Es klingt, als hätte dich etwas wirklich verletzt oder frustriert.",
    joy: "Ich spüre etwas Freude oder Leichtigkeit in dem, was du teilst.",
    hope: "Ich spüre ein bisschen Licht oder Hoffnung in deinen Worten.",
    listen: "Ich höre dir aufmerksam zu. Wie auch immer du dich fühlst, hier zählt es.",
  },
  pt: {
    label: "Seu humor",
    stuck: "Parece que há um pouco de confusão ou dúvida. Tudo bem levar um tempo para organizar as coisas.",
    low: (n) => `Parece que você está num momento um pouco para baixo. Tudo bem se sentir assim — ${n} está aqui com você.`,
    tense: "Parece que algo está trazendo tensão ou preocupação para você.",
    upset: "Parece que algo realmente te chateou ou frustrou.",
    joy: "Sinto um pouco de alegria ou leveza no que você compartilha.",
    hope: "Sinto um pouco de luz ou esperança no que você diz.",
    listen: "Estou ouvindo com atenção. Seja o que for que você sente, aqui isso importa.",
  },
  id: {
    label: "Sekilas suasana hati",
    stuck: "Sepertinya Anda sedang sedikit buntu atau ragu. Tidak apa-apa meluangkan waktu untuk mengurai semuanya.",
    low: (n) => `Sepertinya Anda sedang sedikit murung. Tidak apa-apa merasa begini — ${n} ada di sini bersama Anda.`,
    tense: "Sepertinya ada sesuatu yang membuat Anda tegang atau cemas.",
    upset: "Sepertinya ada sesuatu yang benar-benar membuat Anda kesal atau frustrasi.",
    joy: "Saya merasakan sedikit kebahagiaan atau kelegaan dalam apa yang Anda bagikan.",
    hope: "Saya merasakan sedikit cahaya atau harapan dalam kata-kata Anda.",
    listen: "Saya mendengarkan dengan saksama. Apa pun yang Anda rasakan, itu penting di sini.",
  },
};

/** The language this chat is in: the person's choice, else the script of what they last wrote, else English. */
export function chatSurfaceLang(preferredLang: string | null | undefined, scriptLang: string | null | undefined): string {
  const pick = (l: string | null | undefined) => {
    const b = String(l ?? "").toLowerCase().split(/[-_]/)[0];
    return b && b !== "auto" ? b : null;
  };
  return pick(preferredLang) ?? pick(scriptLang) ?? "en";
}

/** What the card shows: its title and the sentence, in `lang`. Unknown language or sentence ⇒ English, unchanged. */
export function moodGlimpseDisplay(englishHint: string, lang: string, companionName: string): { label: string; text: string } {
  const t = MOOD_GLIMPSE[lang];
  const key = moodKeyOf(englishHint);
  if (!t || !key) return { label: "Mood glimpse", text: englishHint };
  return { label: t.label, text: key === "low" ? t.low(companionName) : t[key] };
}
