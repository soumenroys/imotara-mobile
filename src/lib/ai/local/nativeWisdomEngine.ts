// src/lib/ai/local/nativeWisdomEngine.ts
//
// Offline native-language wisdom fragments for emotional support.
// Original Imotara-authored lines — not attributed quotes — in the spirit of each language's tradition.
// Fires ~1 in 4 emotional turns for non-English languages (quotesEngine handles English).
// Bit-window >>>15 avoids collision with: story >>>7, mythology >>>9, quotes >>>11.

export type WisdomSignal = "sad" | "anxious" | "angry" | "tired";

type WisdomBank = Record<WisdomSignal, readonly string[]>;

// ─── Hindi (Devanagari + Romanized mixed) ────────────────────────────────────
const WISDOM_HI: WisdomBank = {
    sad: [
        "दर्द वो आवाज़ है जो दिल अंदर से बोलना चाहता है — उसे सुनना ज़रूरी है, दबाना नहीं।",
        "Toot jaana kamzori nahi hoti — kabhi yahi rasta hota hai andar ki roshni bahar aane ka.",
        "जो बात मन पर बोझ बनी हुई है, उसे शायद बस एक बार ज़ोर से महसूस करने की ज़रूरत है।",
        "Udaasi bhi ek sach hai — isse bhagne ki zaroorat nahi, sirf samajhne ki.",
    ],
    anxious: [
        "मन जो डरता है, वो अक्सर असल ख़तरे से बड़ा होता है। बस इस पल में रहो।",
        "Ghabrahat ka matlab yeh nahi ki kuch galat hone wala hai — bas mann bahut zyada soch raha hai.",
        "एक क़दम — बस एक क़दम। पूरा रास्ता एक साथ नहीं चलना होता।",
        "Jo abhi hai, woh sambhalne layak hai. Jo abhi nahi hai, uski chinta baad mein.",
    ],
    angry: [
        "गुस्सा सच बोलता है — पर हमेशा सही राह नहीं दिखाता। थोड़ा रुको, फिर सुनो।",
        "Jo baat chubhi, woh zaroor kuch matter karti thi — gussa us dard ka jawab hai, dushman nahi.",
        "जो इंसान ज़्यादा परवाह करते हैं, वही सबसे ज़्यादा तकलीफ़ पाते हैं — यह परवाह ही असल है।",
        "Kuch chodna bhi ek hisaab ki baat hai — sab kuch pakde rehna theek nahi hota.",
    ],
    tired: [
        "थके हुए को आराम की ज़रूरत होती है, माफ़ी की नहीं।",
        "Roz uthna, roz chalna — yeh akela kaam bahut bada hai. Iska hisaab koi nahi rakhta, par hona chahiye.",
        "जब सब कुछ भारी लगे, तो शायद यही वक़्त है ख़ुद के लिए कुछ होने का।",
        "Thakaan ka matlab haar nahi hoti — matlab hai tum bahut kuch uthate aa rahe ho.",
    ],
};

// ─── Bengali (Bengali script + Romanized mixed) ───────────────────────────────
const WISDOM_BN: WisdomBank = {
    sad: [
        "যে ব্যথা বুকে ভারী লাগে, সেখানে একটা কথা লুকিয়ে আছে — সেটা শুনতে হবে।",
        "Bhenge porar mane haara noy — kabhar kabhar ei-i tar mane bhitor-er alo baaire aashte dewa.",
        "চোখের জল সেই সব কথার জন্য মুক্ত, যেগুলো মুখে আসতে পারেনি।",
        "Mon kharap thaka manush howar chihno — eta kono dosh noy, ei-i satya.",
    ],
    anxious: [
        "মন যেখানে যায়, সেখানে এখনও কিছু হয়নি। শুধু এই মুহূর্তে থাকো।",
        "Bhaabaa shomoshya asol shomoshyar cheye beshi bhari laage. Eikhon ja aachhe, seta-i boro kotho.",
        "একটা কাজ — শুধু একটা কাজ। সব একসাথে করতে হয় না।",
        "Chinta-r shomoy moner shukhake nijer dike tano — chintaar dike noy.",
    ],
    angry: [
        "রাগ সত্যি কথা বলে — কিন্তু সবসময় ঠিক রাস্তা দেখায় না। একটু থামো, তারপর শোনো।",
        "Je kotha dil-ke chuiyechhe sheta nishshoyo kono maaney rakhto — raag shei koshtorr uttor, shatru noy.",
        "যার কাছে যত বেশি আশা রাখি, সেখান থেকে তত বেশি কষ্ট পাই — ওই আশাটাই আসল।",
        "Kichhu choriye dewa-o ekta kaajer naam. Sab dharey rakha jaay na.",
    ],
    tired: [
        "ক্লান্ত মানুষের দরকার বিশ্রামের, মাফির নয়।",
        "Protidin uthba, protidin chola — shudhui ei-i onek boro khaaj. Keu hishab raakhe na, kintu rakha uchit.",
        "যখন সব কিছু ভারী লাগে, মানে সময় এসেছে নিজের জন্য একটু হওয়ার।",
        "Thaka mane haar noy — mane tumi onek kichhu bohe esho.",
    ],
};

// ─── Marathi ──────────────────────────────────────────────────────────────────
const WISDOM_MR: WisdomBank = {
    sad: [
        "दुखाला पळवून लावता येत नाही — त्याला ऐकायला हवे.",
        "Tut jaane mhanje haar nahi — kabhar kabhar yachach watewarun aatli ujed yete.",
        "मन जड वाटते तेव्हा कुठेतरी महत्त्वाचं काहीतरी जपलेलं असतं.",
        "Udaas waatat aste tewha swatahsaathi thoda wela hava — dhabhadsaathi nahi.",
    ],
    anxious: [
        "मन जिथे जाते, तिथे अजून काही घडलेलं नसतं. फक्त या क्षणात राहा.",
        "Bhaiti sachat thakto — ata jo aahe, tyat hotte sambhalata yete.",
        "एक पाऊल — फक्त एक पाऊल. सगळं एकत्र चालायचं नसतं.",
        "Kaaljeechi gahi aahe — yaachach arth aahe ki tum tumhala zapta.",
    ],
    angry: [
        "राग खरं सांगतो — पण नेहमी बरोबर वाट दाखवत नाही. थांबा, मग ऐका.",
        "Jo goshta dukhavli, ti nakki kuni mahattvachi hoti — raag tya dukhaacha uttar aahe.",
        "जिथे जास्त आपुलकी, तिथे जास्त जड वाटते — ती आपुलकीच खरी आहे.",
        "Kaahi shodun denyaatach shanti aste — sab dharu lagat nahi.",
    ],
    tired: [
        "थकलेल्याला विश्रांती लागते, माफी नाही.",
        "Roj uthne, roj chalane — hey eka kaam khup mothe aahe. Koni hisob thevat nahi, pan thevayala hava.",
        "Sab kahi jaad vaatate tewha, swathasaathi kahi honey chi velach aahe.",
        "Thakane mhanje haar nahi — tum anekaan goshti uthavat aala aahat.",
    ],
};

// ─── Tamil ───────────────────────────────────────────────────────────────────
const WISDOM_TA: WisdomBank = {
    sad: [
        "வலி என்பது மனசு சொல்ல நினைக்கும் வார்த்தை — அதை கேட்கணும், அடக்கக்கூடாது.",
        "Mudiyaadha maadhiri thonum, adhu thodakkam dhaan — adhil irukkum velicham dhan veliye varum.",
        "கண்ணீர் சொல்ல முடியாதவைகளுக்காக — மொழி கண்டுபிடிக்காதவைகளுக்காக.",
        "Manasu kuppurai thudaippathil thappillai — idhu manidhanaagirathoda kurichu.",
    ],
    anxious: [
        "மனசு போகும் இடத்தில் இன்னும் எதுவும் நடக்கலை. இந்த நிமிடத்திலயே இரு.",
        "Bayam asalyaividam paaraayirukkum. Ippovae irukkirathu pothum.",
        "ஒரு கடமை மட்டும் — எல்லாத்தையும் ஒரே நேரத்தில் செய்யணும்னு இல்ல.",
        "Kalaiveri varum neram — unne unnoda paakkanum.",
    ],
    angry: [
        "கோபம் உண்மை சொல்லும் — ஆனா எப்பவும் சரியான வழி காட்டாது. கொஞ்சம் நிறுத்து, கேளு.",
        "Enna valikkiratho adhu nirchayamaa oru matter irundhuchu — kopam adha valiyoda pathil.",
        "அதிகம் நம்பிக்கை வைச்சிருக்கிற இடத்தில்தான் அதிகம் hurt ஆவோம் — அந்த நம்பிக்கையே உண்மை.",
        "Saila vidalum oru velaiya — ellatthaiyum pidichukke irukkumu dhaan mudiyaathu.",
    ],
    tired: [
        "களைத்தவர்களுக்கு ஓய்வு வேணும், மன்னிப்பு வேண்டாம்.",
        "Thinathorum ezhuvadhu, thinathorum nadakkadhu — idhe oru periya kaaryam. Yarum kanakku pannalai, aanaa pannanum.",
        "Ellam pondra irukum pothae, unakkaaga kona neram vandhurukkunu arththam.",
        "Kalichathu thozhal illai — nee neraya sutthu thookki vandhen nu arththam.",
    ],
};

// ─── Telugu ───────────────────────────────────────────────────────────────────
const WISDOM_TE: WisdomBank = {
    sad: [
        "Bedhana manasu lopala cheppaalanukune maata — adi vinyali, dabayicha veyyakudadu.",
        "విరిగిపోయినట్లనిపించినా, అదే తొడగ్గం — అందులో ఉన్న వెలుతురు వెలుపలకొస్తుంది.",
        "కన్నీళ్ళు మాటలు చేయలేని విషయాల కోసం — చెప్పలేనిది కోసం.",
        "Manasu bhaaragaa anipistundi ante adi emi matladataando cheppaleni vidhangaa undi.",
    ],
    anxious: [
        "Manasu poyina chota ippudu eevum jaraagaledu. Ee nimisamlo undo.",
        "Bayam asali kante peddhaga anipistundi. Ippudu unnattu undo.",
        "ఒక్క అడుగు మాత్రమే — అన్నీ ఒకేసారి నడిపించడం అవ్వదు.",
        "Kalavara samayamlo — ninne neevu chaaddam aadhatam.",
    ],
    angry: [
        "Kopam nijaani chepputu undi — kaani eapudu sari dharinchadu. Konjam aago, vimu.",
        "Emi nopisteundo adi nirchayamaga evaro maatlaadindi — kopam aa noppikee jawaabudi, satruvu kaadu.",
        "ఎక్కువ ఆశ ఉన్న చోట ఎక్కువ నొప్పి ఉంటుంది — ఆ ఆశే నిజమైనది.",
        "Kaadhi vadilaadam kaadhu — anni patukunte cheyalemu.",
    ],
    tired: [
        "Adintavariki vistharantu kaavali, kshama kaadu.",
        "Prathiroju leavadamu, prathiroju nadavadamu — idi okate peddha kaarayadamu. Evarum hiaabu raayaru, raayali.",
        "Anni bhaaragaa anipistunnappudu, ninnu ninnu pattinchukune velah idhi.",
        "Thimiru ante odalipote kaadu — nuvvu neraya bhaaranu mottukununnav ane arttham.",
    ],
};

// ─── Gujarati ─────────────────────────────────────────────────────────────────
const WISDOM_GU: WisdomBank = {
    sad: [
        "Dard jo dil par bhaari hoy, tyaa ek vaat chhupayeli hoy — tene saambalavani zaroori hoy.",
        "Tod jaavanu matlab haar nahi — kabhar aa j raste andar-ni ujvas bahar aave chhe.",
        "Aakho maan bhaari laage tyaare kainchuk mahattvanu jalavayelu hoy chhe.",
        "Udaas hovu ek sach chhe — tethhi bhagavaani zaroorat nahi, saamajavani chhe.",
    ],
    anxious: [
        "Mann jyaa jaay chhe, tyaa have kainchuk naathi banyu. Bas aa kshan maa raho.",
        "Ghabrahat-no matlab nathi ke kainchuk kharab thavaayu — mann vadhare vichare chhe.",
        "Ek paaglu — bas ek paaglu. Badhuj ekasaathe chalava nathi.",
        "Kaaljini gati chhe — yaano arth chhe ke tum sanbhali rahya chho.",
    ],
    angry: [
        "Gusse sachu kahe chhe — pan hamesha saari vaatni dekhbhaal nathi karti. Thodo ruko, pachi sano.",
        "Jo vaat dukhavli, te zaroor koinchuk matter kartii hati — gusse te dukhano uttar chhe.",
        "Jyaa vadhare laagni, tyaa vadhare dard — e laagni j asali chhe.",
        "Kaahi chodvamaaj shanti chhe — badhu pakadvu theek nathi.",
    ],
    tired: [
        "Thakyu che ene vishraami jaroorat chhe, maafi nahi.",
        "Roz uthvun, roz chalvu — aa ek kaaj khub motan chhe. Koi hishab nathi rakhatu, pan rakhaava joie.",
        "Jyaare badhu bhaari laage, to shaayad aa j samay chhe potaane maate kainchuk honey no.",
        "Thaak matlab haar nahi — matlab chhe ke tum ghanu kainchuk uhtavata aavya chho.",
    ],
};

// ─── Punjabi ──────────────────────────────────────────────────────────────────
const WISDOM_PA: WisdomBank = {
    sad: [
        "Dard jo dil te bhaari lagda hai, othe ek gall chhupi hundi hai — usse sunna zaroori hai.",
        "Tut jaana kamzori nahi — kabhi kabhi isi waaton andar di roshni bahar aundi hai.",
        "Jado maan bhaari laage, aas paas zaroori kuch sambhalyaa hunda hai.",
        "Udaas hona ik sach hai — tethon bhaajne di lod nahi, samjhne di hai.",
    ],
    anxious: [
        "Mann jahaan jaanda hai, ota aho kuch nahin hoya. Bas es pal mein raho.",
        "Darr asali khatra ton vadda hunda hai. Jado aye, bas ik vaari saas lo.",
        "Ik kadam — bas ik kadam. Sab kuch ek vaari mein nahi chalda.",
        "Chinta de waqt apne aap nu apni taraf khecho — chinta di taraf nahi.",
    ],
    angry: [
        "Gussa sach bolta hai — par hamesha sahi raah nahi dikhaanda. Thodo ruko, phir suno.",
        "Jo gall chubhi, oo zaroor kuch matter kardi si — gussa us dard da jawab hai, dushman nahi.",
        "Jehde zyaada umeed rakhde haan, ode zyaada dard hunda hai — oi umeed hi asli hai.",
        "Kuch chhod dena vi ek hisab di gall hai.",
    ],
    tired: [
        "Thake nu aaram di lod hai, maafi di nahi.",
        "Roz uthna, roz chalna — ih ik kaam bada vadda hai. Koyi hisaab nahi rakhdaa, par rakhna chahida hai.",
        "Jado sab bhaari laage, shaayad aihi velaa hai apne liye kuch hon di.",
        "Thakaan matlab haar nahi — matlab hai tu bahut kuch chukke aa raha hai.",
    ],
};

// ─── Kannada ──────────────────────────────────────────────────────────────────
const WISDOM_KN: WisdomBank = {
    sad: [
        "Novu aatmakke mathaduvudu anistiruvudu — adannu keLabeeku, dabhayisabaaradhu.",
        "Muridante anisuttade, aduve aadige — andharali iruvudhu beLakkaagirutte.",
        "ಕಣ್ಣೀರು ಮಾತಾಡಲಾಗದ ವಿಷಯಗಳಿಗಾಗಿ — ಹೇಳಲಾಗದ್ದಕ್ಕಾಗಿ.",
        "Manassu bhaaragaaguvudu manushyanaaguvudu sanketha — idhu tennanilla.",
    ],
    anxious: [
        "Manassu hoguvalli illi idduu eenu aagalilla. Ee gaNTeyalli iro.",
        "Bhaya nijakkintah dhoda anisuttade. Ippaga iruvudu saakaaguttade.",
        "ಒಂದು ಕಾಲಿಡಿ — ಸುಮ್ಮನೆ ಒಂದು ಕಾಲಿಡಿ. ಎಲ್ಲವನ್ನು ಒಂದೇ ಸಲ ಮಾಡಬೇಕಾಗಿಲ್ಲ.",
        "Chinta baruvaga — ninnu neen noDikoLLuvudu aadhatam.",
    ],
    angry: [
        "Kopa nijavanu heLuttade — aadare yaavagaluu sari daari tOruvudhilla. Kondaviduu, aada kelo.",
        "Enu noppisitoideyo adu nirChayavaagi yarudroo vishayavaagittittu — kopa aa noppige uttara.",
        "ಹೆಚ್ಚು ಆಶೆ ಇಟ್ಟ ಜಾಗದಲ್ಲಿ ಹೆಚ್ಚು ನೋಯುತ್ತದೆ — ಆ ಆಶೆಯೇ ನಿಜವಾದದ್ದು.",
        "Kaledu bittaruu oru kaarada maathu — ellakkuu aaDuthironu aagalilla.",
    ],
    tired: [
        "Dakkavanige vishraantige aavashyaka, kshamisi illade.",
        "Pratidinaa eḷuvudu, pratidinaa naḍeyuvudu — idoNdhu kaajave doḍḍadu. YaaraadaRU hisaabu iDuvudhilla, aadare iDabeeku.",
        "ಎಲ್ಲ ಭಾರವಾಗಿ ಅನಿಸಿದಾಗ, ನಿನಗಾಗಿ ಒಂದು ಸಮಯ ಬಂದಿದೆ ಎಂದರ್ಥ.",
        "Dhakku anta sanghatane illade — nimma hegu toombaanu hoDkondhu baruttiddiri anta artha.",
    ],
};

// ─── Malayalam ────────────────────────────────────────────────────────────────
const WISDOM_ML: WisdomBank = {
    sad: [
        "Vedanakku ottipidikkaan pattumo? Athinu kaatheerkkanam, manassil pooTTaan paadilla.",
        "Ithrayum vedanikkaanathu ethu manasammaayirunnu ennathinte cheyyunnundo — adhu thanne unmaayirunnu.",
        "കണ്ണീർ മിണ്ടാടാൻ കഴിയാത്ത കാര്യങ്ങൾക്കുവേണ്ടി — പറയാനാകാത്തതിനുവേണ്ടി.",
        "Manassu bhaaramaayi thoannumbol, athinte artham enthengkilum rakshikkappedukaayundennanu.",
    ],
    anxious: [
        "Manassu pokunnidata ippol eetteyum onnum nadannitilla. Ee nimeesham maatramennum iro.",
        "Bhayam asalinte athaavath dooshyamaanuvathalla. Ippozhullatha kaaryam mathy.",
        "ഒരു കാൽ‌വയ്പ് — ഒരൊറ്റ കാൽ‌വയ്പ് മതി. എല്ലാം ഒറ്റ പ്രാവശ്യം ആകേണ്ടതില്ല.",
        "Verupaad varum neeram — ninne nee thedukaayirikkuka.",
    ],
    angry: [
        "Kopam sathyam parannund — enthu enginum sari vazhikkaattatho enna. Orukkaadu, pinne ketKoo.",
        "Etu nokichchatho athe nishchayamaayi mathamaayirunnu — kopam aa vedanayude utharamaanu, shathruvalla.",
        "ആഗ്രഹിച്ച ഇടത്ത് ഏറ്റവുമധികം വേദനിക്കുന്നു — ആ ആഗ്രഹമാണ് ശരിക്കുള്ളത്.",
        "KaLayukaanum oru kaaryamaanu — ellakku aaDuthironu aagalilla.",
    ],
    tired: [
        "Kalyappetavannu vistraanthy veenum, pakshamallallo.",
        "Etta oru naal ivide nikkuka, oru naal nadakuka — idu mattum oru valiya kaaryam thanneyaanu. Hisaabu paaril aarum vaykkarilla, vaykkanam.",
        "എല്ലാം ഭാരമായി തോന്നുമ്പോൾ, നിനക്കായി ഒരു നേരം വന്നിരിക്കുന്നു എന്നർഥം.",
        "Thellumum illathathe oru shakthi thaaghattethol — nee vaLare thookkam vaahichirikkunnathinuLLa thuLLal.",
    ],
};

// ─── Odia ─────────────────────────────────────────────────────────────────────
const WISDOM_OR: WisdomBank = {
    sad: [
        "Dukha se kathaa boliba chaahuchhi — taake suniba darkara, dhabaai deiba nahi.",
        "Bhaanji jaani parani haraaibaa nahi — kaahinkaa kahinkaa sei rasataa bhitara aleeka aaliaa udaaye aasie.",
        "ଆଖିଯାଇ ଯାହା ଉଚ୍ଚାରଣ ହୋଇ ନ ପାରେ, ତାହার ନ‌ଇ ଜଳ ପ୍ରବଳ ହୁଏ।",
        "Mana bhaari lagile eka mahattvapurna kathaa luka thae.",
    ],
    anxious: [
        "Mana je jaagae jai, seithae ekhana kichu ghaTieni. Shudhu ei muhuurtare rahu.",
        "Bhaya asali bhaya thaarun besi boro laahe. Ekhanar kathaa sambhalibaa chahe.",
        "Eka kadam — shudhui eka kadam. Saba eki saangare chalibaa padeni.",
        "Chintaa hobaa bele nijaku nijer dike dakaa — chintaar dike nahi.",
    ],
    angry: [
        "Raaga sachha kahe — kintu sari rasataa sadabesabada dekhaaedeinai. Thoda thamu, pahile shuno.",
        "Jahi dukhaaila, sei nishchitarupe kaainchika matter karutaa — raaga sei dukhara uttar.",
        "ଯେଉଁଠୁ ଅଧିକ ଆଶା, ସେଠୁ ଅଧିକ ଦୁଖ — ସେ ଆଶାଟି ସତ।",
        "Kinchita chhaadi deibaa au ekta kama — saba dhari rakhaa thik nahi.",
    ],
    tired: [
        "Thaakale bishramara darkara, ksamar nahi.",
        "Pratidin uthiba, pratidin chaliba — ei eka kama bahut boro. Kehi hisaab raakhanti naahi, kintu rakhaa uchita.",
        "Sabe bhaari laagilaa bele, nija paaine kichu heibaa samaya aasichhi.",
        "Thakaa maane haara nahi — maane tume bahuta kichu bahai aasuchha.",
    ],
};

// ─── Urdu ─────────────────────────────────────────────────────────────────────
const WISDOM_UR: WisdomBank = {
    sad: [
        "Dard jo dil pe bhaari hota hai, woh kuch kehna chahta hai — sunna zaroori hai, dabaana nahi.",
        "Toot jaana kamzori nahi — kabhi kabhi yahi rasta hota hai andar ki roshni bahar aane ka.",
        "آنسو ان باتوں کے لیے ہیں جو زبان تک نہیں پہنچ پائیں۔",
        "Udaas hona insaan hone ki alaami nishani hai — koi kharabi nahi.",
    ],
    anxious: [
        "Mann jahan bhaagta hai, wahan ab bhi kuch hua nahi. Sirf is pal mein raho.",
        "Ghabrahat ka matlab yeh nahi ki kuch bura hone wala hai — bas zehan zyada soch raha hai.",
        "Ek qadam — sirf ek qadam. Poora safar ek saath nahin chalna.",
        "Chinta ke waqt apne aap ko apni taraf moDo — chinta ki taraf nahi.",
    ],
    angry: [
        "Gussa sach bolta hai — par hamesha sahi raah nahi dikhata. Thoda ruko, phir suno.",
        "Jo baat chubhi, woh zaroor kuch matter karti thi — gussa us dard ka jawab hai, dushman nahi.",
        "جہاں زیادہ امید رکھی، وہاں سب سے زیادہ تکلیف ہوئی — وہی امید اصل ہے۔",
        "Kuch chhod dena bhi ek kaam hai — sab pakde rehna theek nahi.",
    ],
    tired: [
        "Thake hue ko aaram chahiye, maafi nahi.",
        "Roz uthna, roz chalna — yeh akela kaam bahut bada hai. Koi hisaab nahi rakhta, par hona chahiye.",
        "Jab sab kuch bhaari laage, to yahi waqt hai khud ke liye kuch hone ka.",
        "Thakaan ka matlab haar nahi — matlab hai tum bahut kuch uthate aa rahe ho.",
    ],
};

// ─── Arabic ───────────────────────────────────────────────────────────────────
const WISDOM_AR: WisdomBank = {
    sad: [
        "الألم رسالة من القلب — تحتاج أن تُسمع، لا أن تُكبت.",
        "التكسّر ليس هزيمة — أحياناً هو الطريق الوحيد لخروج النور من الداخل.",
        "الدموع كلمات لم تجد طريقها إلى اللسان.",
        "الحزن دليل على أنك تهتم — وليس فيه عيب.",
    ],
    anxious: [
        "عقلك يذهب إلى ما لم يحدث بعد. ابق في هذه اللحظة فقط.",
        "الخوف دائماً أكبر مما سيحدث فعلاً — ما هو موجود الآن يكفي.",
        "خطوة واحدة فقط — ليس كل الطريق دفعة واحدة.",
        "حين يأتي القلق — أعد نفسك إليك، لا إليه.",
    ],
    angry: [
        "الغضب يقول الحقيقة — لكنه لا يُريك الطريق الصحيح دائماً. انتظر، ثم استمع.",
        "ما آلمك كان يعني لك شيئاً — الغضب رد على ذلك الألم، وليس عدواً له.",
        "أكثر الناس غضباً هم من يهتمون أكثر — هذا الاهتمام هو الحقيقي.",
        "ثمة راحة في التخلي عن بعض الأشياء — لا يمكن الإمساك بكل شيء.",
    ],
    tired: [
        "المتعب يحتاج راحة، لا اعتذاراً.",
        "النهوض كل يوم، المضي قدماً — هذا وحده إنجاز كبير. لا يُسجّله أحد، لكنه يستحق.",
        "حين يثقل كل شيء — ذلك قد يكون الوقت الذي تحتاج فيه أن تكون لنفسك.",
        "التعب لا يعني الاستسلام — بل يعني أنك تحمل الكثير منذ وقت طويل.",
    ],
};

// ─── Chinese ──────────────────────────────────────────────────────────────────
const WISDOM_ZH: WisdomBank = {
    sad: [
        "让你心里沉重的东西，也许正在等你去听懂它。",
        "碎掉不是失败——有时候，光是从那些裂缝里透进来的。",
        "眼泪是那些说不出口的话所流出的。",
        "难过是一个信号，不是弱点——它说明你在乎。",
    ],
    anxious: [
        "你担心的事还没发生。先待在这一刻就好。",
        "你脑子里的压力，往往比实际情况更重。现在能处理的，就已经够了。",
        "一步就好——不需要一次走完整条路。",
        "焦虑来的时候，把注意力拉回自己这边。",
    ],
    angry: [
        "生气在说真话——但不总是指对方向。先停一停，再听。",
        "让你心烦的事情，一定曾经对你有意义——愤怒是那份痛的回应，不是敌人。",
        "越在乎，越容易受伤——那份在乎才是真实的。",
        "有些东西放手了反而更轻——不是所有的都要攥着。",
    ],
    tired: [
        "累了就需要休息，不需要理由。",
        "每天起来，每天继续——这一件事本身就很大。没人记录，但值得被记录。",
        "当一切都变得沉重时，也许正是给自己一些空间的时候。",
        "疲倦不是失败——它说明你一直在扛着很多事。",
    ],
};

// ─── Spanish ──────────────────────────────────────────────────────────────────
const WISDOM_ES: WisdomBank = {
    sad: [
        "El dolor que pesa en el pecho tiene algo que decir — hay que escucharlo, no suprimirlo.",
        "Romperse no es fracasar — a veces es justo por donde entra la luz.",
        "Las lágrimas son para lo que las palabras no pueden decir.",
        "La tristeza es señal de que te importa algo — no hay nada malo en eso.",
    ],
    anxious: [
        "Tu mente va a donde todavía no ha pasado nada. Quédate en este momento.",
        "Lo que imaginás suele pesar más que lo real. Con lo de ahora ya alcanza.",
        "Un paso — solo un paso. No hay que recorrer todo el camino de una vez.",
        "Cuando llega la ansiedad, volvete hacia vos, no hacia ella.",
    ],
    angry: [
        "El enojo dice verdad — pero no siempre señala el camino correcto. Esperá, después escuchá.",
        "Lo que te lastimó importaba — el enojo es la respuesta a ese dolor, no su enemigo.",
        "Donde más esperás, más duele — esa espera misma es lo real.",
        "Hay cierta paz en soltar — no todo puede sostenerse a la vez.",
    ],
    tired: [
        "El que está cansado necesita descanso, no disculpas.",
        "Levantarse cada día, seguir cada día — eso solo ya es mucho. Nadie lo anota, pero merece que se anote.",
        "Cuando todo pesa, quizás es el momento de darle algo a vos.",
        "El cansancio no es rendición — es que llevás mucho desde hace tiempo.",
    ],
};

// ─── French ───────────────────────────────────────────────────────────────────
const WISDOM_FR: WisdomBank = {
    sad: [
        "Ce qui pèse dans la poitrine cherche à être entendu — pas étouffé.",
        "Se briser n'est pas échouer — parfois c'est exactement par là que la lumière entre.",
        "Les larmes sont pour ce que les mots ne peuvent pas dire.",
        "La tristesse est un signal, pas une faiblesse — elle dit que quelque chose compte pour toi.",
    ],
    anxious: [
        "Ton esprit va là où rien n'a encore eu lieu. Reste dans cet instant.",
        "Ce qu'on imagine pèse souvent plus lourd que la réalité. Ce qui est là maintenant suffit.",
        "Un pas — juste un pas. Tout le chemin ne se parcourt pas en une fois.",
        "Quand l'anxiété arrive, ramène-toi à toi-même, pas à elle.",
    ],
    angry: [
        "La colère dit la vérité — mais elle ne montre pas toujours le bon chemin. Attends, puis écoute.",
        "Ce qui t'a blessé avait de l'importance — la colère est la réponse à cette douleur, pas son ennemi.",
        "Là où on espère le plus, c'est là qu'on souffre le plus — cet espoir, c'est ce qui est réel.",
        "Il y a une paix dans le lâcher-prise — on ne peut pas tout tenir en même temps.",
    ],
    tired: [
        "Celui qui est fatigué a besoin de repos, pas d'excuses.",
        "Se lever chaque jour, continuer chaque jour — ça seul, c'est déjà beaucoup. Personne ne le note, mais ça mérite de l'être.",
        "Quand tout pèse lourd, c'est peut-être le moment de te donner quelque chose, à toi.",
        "La fatigue n'est pas une défaite — c'est la preuve que tu portes beaucoup depuis longtemps.",
    ],
};

// ─── Portuguese ───────────────────────────────────────────────────────────────
const WISDOM_PT: WisdomBank = {
    sad: [
        "O que pesa no peito tem algo a dizer — precisa ser ouvido, não suprimido.",
        "Quebrar não é falhar — às vezes é exatamente por onde a luz entra.",
        "As lágrimas são para o que as palavras não conseguem dizer.",
        "A tristeza é um sinal, não fraqueza — ela diz que algo importa.",
    ],
    anxious: [
        "A sua mente vai pra onde ainda não aconteceu nada. Fique nesse momento.",
        "O que imaginamos pesa mais que o real. O que está aqui agora já basta.",
        "Um passo — só um passo. Não dá pra caminhar tudo de uma vez.",
        "Quando a ansiedade chega, traga-se de volta a você, não a ela.",
    ],
    angry: [
        "A raiva diz a verdade — mas nem sempre aponta o caminho certo. Espere, depois escute.",
        "O que te machucou importava — a raiva é a resposta a essa dor, não seu inimigo.",
        "Onde mais esperamos, mais dói — essa espera em si é o que é real.",
        "Tem uma paz em soltar — não dá pra segurar tudo ao mesmo tempo.",
    ],
    tired: [
        "Quem está cansado precisa de descanso, não de desculpas.",
        "Levantar todo dia, continuar todo dia — só isso já é muito. Ninguém anota, mas merecia ser anotado.",
        "Quando tudo pesa, talvez seja a hora de se dar algo, a você mesmo.",
        "O cansaço não é derrota — é que você carrega muito há muito tempo.",
    ],
};

// ─── Russian ──────────────────────────────────────────────────────────────────
const WISDOM_RU: WisdomBank = {
    sad: [
        "То, что давит на грудь, хочет быть услышанным — не подавленным.",
        "Сломаться — это не провал: иногда именно так внутри появляется свет.",
        "Слёзы — для того, что слова не могут сказать.",
        "Грусть — это сигнал, не слабость: она говорит, что тебе небезразлично.",
    ],
    anxious: [
        "Твои мысли уходят туда, где ещё ничего не случилось. Оставайся в этом моменте.",
        "То, что ты представляешь, часто тяжелее реальности. Того, что есть сейчас, достаточно.",
        "Один шаг — только один шаг. Весь путь не нужно проходить сразу.",
        "Когда тревога приходит — возвращайся к себе, а не к ней.",
    ],
    angry: [
        "Злость говорит правду — но не всегда указывает правильный путь. Подожди, потом послушай.",
        "То, что тебя задело, для тебя имело значение — злость — это ответ на боль, не враг.",
        "Там, где больше всего ждёшь, там больше всего больно — эта надежда и есть настоящее.",
        "В том, чтобы отпустить, есть покой — нельзя держаться за всё одновременно.",
    ],
    tired: [
        "Уставший нуждается в отдыхе, а не в оправданиях.",
        "Вставать каждый день, продолжать каждый день — только это уже очень много. Никто не записывает, но стоило бы.",
        "Когда всё тяжело, возможно, самое время дать что-то себе.",
        "Усталость — не поражение: это значит, что ты давно несёшь слишком много.",
    ],
};

// ─── Indonesian ───────────────────────────────────────────────────────────────
const WISDOM_ID: WisdomBank = {
    sad: [
        "Apa yang memberat di dada punya sesuatu untuk disampaikan — perlu didengar, bukan ditekan.",
        "Retak bukan berarti gagal — terkadang dari situlah cahaya masuk.",
        "Air mata adalah untuk apa yang tidak bisa dikatakan dengan kata-kata.",
        "Sedih itu tanda bahwa kamu peduli — bukan kelemahan.",
    ],
    anxious: [
        "Pikiranmu pergi ke tempat yang belum terjadi. Tetap di momen ini.",
        "Yang kamu bayangkan sering lebih berat dari kenyataan. Yang ada sekarang sudah cukup.",
        "Satu langkah — hanya satu langkah. Tidak perlu menapaki semua jalan sekaligus.",
        "Saat kecemasan datang — bawa dirimu kembali ke dirimu, bukan ke kecemasannya.",
    ],
    angry: [
        "Marah itu bicara kebenaran — tapi tidak selalu menunjukkan jalan yang tepat. Tunggu, lalu dengarkan.",
        "Apa yang menyakitimu berarti bagimu — marah adalah respons terhadap rasa sakit itu, bukan musuhnya.",
        "Di tempat kamu paling berharap, di situ paling sakit — harapan itulah yang nyata.",
        "Ada ketenangan dalam melepaskan — tidak semua hal bisa dipegang bersamaan.",
    ],
    tired: [
        "Yang lelah butuh istirahat, bukan permintaan maaf.",
        "Bangun setiap hari, terus melangkah — itu saja sudah banyak. Tidak ada yang mencatatnya, tapi layak dicatat.",
        "Saat semuanya terasa berat, mungkin inilah saatnya memberi sesuatu untuk dirimu sendiri.",
        "Kelelahan bukan kekalahan — artinya kamu sudah menanggung banyak hal sejak lama.",
    ],
};

// ─── German ───────────────────────────────────────────────────────────────────
const WISDOM_DE: WisdomBank = {
    sad: [
        "Was schwer auf der Brust liegt, will gehört werden — nicht unterdrückt.",
        "Zerbrechen ist kein Versagen — manchmal kommt genau dadurch das Licht herein.",
        "Tränen sind für das, was Worte nicht sagen können.",
        "Traurigkeit ist ein Signal, keine Schwäche — sie zeigt, dass dir etwas wichtig ist.",
    ],
    anxious: [
        "Dein Verstand geht dahin, wo noch nichts passiert ist. Bleib in diesem Moment.",
        "Was du dir vorstellst, wiegt oft schwerer als die Realität. Was jetzt da ist, reicht.",
        "Ein Schritt — nur ein Schritt. Den ganzen Weg muss man nicht auf einmal gehen.",
        "Wenn Angst kommt — bringe dich zu dir zurück, nicht zu ihr.",
    ],
    angry: [
        "Ärger spricht die Wahrheit — zeigt aber nicht immer den richtigen Weg. Warte, dann hör zu.",
        "Was dich verletzt hat, war dir wichtig — Ärger ist die Antwort auf diesen Schmerz, nicht sein Feind.",
        "Wo man am meisten hofft, tut es am meisten weh — diese Hoffnung ist das Echte.",
        "Es gibt Frieden im Loslassen — nicht alles kann gleichzeitig festgehalten werden.",
    ],
    tired: [
        "Wer müde ist, braucht Erholung, keine Entschuldigungen.",
        "Jeden Tag aufstehen, jeden Tag weitermachen — das allein ist schon viel. Niemand notiert es, aber es sollte notiert werden.",
        "Wenn alles schwer ist, ist es vielleicht der Moment, dir selbst etwas zu geben.",
        "Erschöpfung ist keine Niederlage — es bedeutet, dass du schon lange viel trägst.",
    ],
};

// ─── English (included for web engine; mobile uses quotesEngine for English) ──
const WISDOM_EN: WisdomBank = {
    sad: [
        "What breaks you open often teaches you something that nothing easier could have.",
        "What you carry tonight will feel different in the morning — not lighter, but different.",
        "Grief moves on its own timetable. You don't have to rush it.",
        "Being honest about pain is a form of courage most people never practise.",
    ],
    anxious: [
        "The thing you're dreading is almost always harder in your head than in the room.",
        "One step only — not the whole staircase.",
        "Anxiety lies about urgency. Very little actually needs to be solved right now.",
        "Worry has never once made the future easier.",
    ],
    angry: [
        "What makes you angry usually tells you something about what you value most.",
        "Not every injustice needs a response tonight.",
        "The intensity of the feeling is real, even when the reaction needs waiting.",
        "Anger is information, not an instruction.",
    ],
    tired: [
        "Rest is not the absence of work — it is how you prepare to try again.",
        "You are allowed to stop and not have a reason.",
        "Tired is your body asking for something it genuinely needs.",
        "Some of the strongest people know exactly when to stop.",
    ],
};

// ─── Registry ─────────────────────────────────────────────────────────────────
const WISDOM_MAP: Partial<Record<string, WisdomBank>> = {
    en: WISDOM_EN,
    hi: WISDOM_HI,
    bn: WISDOM_BN,
    mr: WISDOM_MR,
    ta: WISDOM_TA,
    te: WISDOM_TE,
    gu: WISDOM_GU,
    pa: WISDOM_PA,
    kn: WISDOM_KN,
    ml: WISDOM_ML,
    or: WISDOM_OR,
    ur: WISDOM_UR,
    ar: WISDOM_AR,
    zh: WISDOM_ZH,
    es: WISDOM_ES,
    fr: WISDOM_FR,
    pt: WISDOM_PT,
    ru: WISDOM_RU,
    id: WISDOM_ID,
    de: WISDOM_DE,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a native-language wisdom fragment for the given signal and language, or null if:
 *   - signal is "okay" (non-emotional turns get no wisdom)
 *   - language has no bank, or
 *   - the seed hash doesn't land on a wisdom turn (~1 in 4).
 *
 * Uses bit-window (seed >>> 15) to avoid collision with:
 *   - storyEngine   (seed >>> 7)
 *   - mythologyEngine (seed >>> 9)
 *   - quotesEngine  (seed >>> 11)
 *
 * For mobile: pass skipEnglish=true so quotesEngine handles English.
 * For web: pass skipEnglish=false to include English wisdom (no quotesEngine in web).
 */
export function buildNativeWisdom(
    signal: string,
    language: string,
    seed: number,
    skipEnglish = true,
): string | null {
    if (signal === "okay") return null;
    if (skipEnglish && language === "en") return null;

    // ~1 in 4 emotional turns
    if ((seed >>> 15) % 4 !== 0) return null;

    const bank = WISDOM_MAP[language];
    if (!bank) return null;

    const pool = bank[signal as WisdomSignal];
    if (!pool?.length) return null;

    return pool[seed % pool.length] ?? null;
}
