// src/lib/emotion/keywordMaps.ts
// Centralized multilingual keyword regex used by local/heuristic emotion inference.
// NOTE: Keep these additive and conservative to avoid false positives.

import { escapeRegexLiteral } from "./regexUtils";

// --------------------------------------------------
// Language routing hints (NOT emotion)
// Keep conservative to avoid false positives.
// --------------------------------------------------

// Romanized Hindi (Latin script) hints
export const ROMAN_HI_LANG_HINT_REGEX =
    /\b(hai|haan|nahi|nahin|kya|kyun|kaise|kab|kahan|aaj|kal|bhai|yaar|mummy|papa|didi|jaldi|khana|bhook|ghar|Kaun|Achha|Thik|Tum|Aap|Hum|Woh|Yeh|Sab|Kuch|Toh|Bhi|Na|Aur|Bas|Shayad|Jarur|Waisa|Aisa|Chal|Kar|Ho|Gaya|Raha|Chahiye|Bol|Bata|Milte|Abhi|Thoda|Zyada|Maza|Maaf|Shukriya)\b/i;

// Romanized Bengali (Latin script) hints
export const ROMAN_BN_LANG_HINT_REGEX =
    /\b(Ki|Hae|hoe|Na|Kemon|Bhalo|Ki khobor|Achi|Ar|Ekhon|Pore|Korcho|Khai|Ghum|Jachhi|Aschi|Bolche|Dekha|Janina|Bujhlam|Sunte|Tumi|Apni|Tui|Amra|Ora|Bari|Baire|Office|College|Bondhu|Ke|Acha|Thik ache|Sotti|Tai|Keno|Kothay|Kobe|Kokhon|Ekdom|Hoyto|Osthir|Cholo|Boka|Pagol|Misti|Dhur|Ghumao|Kotha|Hobe|Bad dao|baad|ami|acho|accho|onekdin|chol|kothao|adda|gosip|gossip|joma|ache|khub|barite|ghor|mon|kharap|lagche|hocche|hochhe|korchi|korchhi|parchi|parchhi|morte|marte|chai|bachte|banchte|icche|ichhe)\b/i;

// Romanized Tamil (Latin script) hints
export const ROMAN_TA_LANG_HINT_REGEX =
    /\b(enna|epdi|eppadi|seri|sari|inga|anga|ipo|ippo|ennaachu|enna achu|saptiya|saaptiya|veetla|veetle|amma|appa|thambi|akka|anna|nan|naan|unaku|ungal|romba|konjam|nalla|illa|illai|podhum|paravailla|paravala|sollu|pesu|pesa|venum|vendam|paathu|paakalam|irukku|irukka|pogudhu|vandhuten|poiten)\b/i;

// Romanized Telugu (Latin script) hints
export const ROMAN_TE_LANG_HINT_REGEX =
    /\b(enti|ela|elaa|em|emi|ippudu|inka|avuna|kaadu|ledu|undhi|undi|unna|unnanu|nenu|nuvvu|meeru|miku|naaku|amma|nanna|anna|akka|tammudu|chelli|baaga|bagundi|chala|konchem|vellu|vastanu|vachanu|cheppu|matladu|tinava|tinnava|em ayindi|emindi|sare|parledu|enduku|ekkada|eppudu)\b/i;

// Romanized Gujarati (Latin script) hints
export const ROMAN_GU_LANG_HINT_REGEX =
    /\b(shu|su|kem|kem cho|majama|majamaa|saru|saras|have|hve|tame|hu|hun|mane|tane|aaje|kaal|ghar|bahar|su che|barabar|thik|chaalo|chalo|joie|joye|padse|nathi|che|hatu|hase|aavjo|aavyo|javanu|jamyu|jamva|paani|thai|thai che|lage che|saru nathi|majama nathi|taklif|darek|thodu|khub)\b/i;

// Romanized Kannada (Latin script) hints
export const ROMAN_KN_LANG_HINT_REGEX =
    /\b(yenu|enu|hegide|hegiddiya|hegiddira|sari|chennagide|chenagide|ivattu|naanu|nanu|neenu|ninu|nimge|nanage|amma|appa|anna|akka|thamma|tangi|bega|mane|horage|illi|alli|yaake|yake|elli|yelli|hege|oota|neeru|malagu|barutte|hogutte|banni|hogona|nodona|tumba|bejar|besara|agide|ide|illa|nan hatra|saku|swalpa)\b/i;

// Romanized Malayalam (Latin script) hints
export const ROMAN_ML_LANG_HINT_REGEX =
    /\b(entha|enthaanu|enthaada|engane|sheri|shari|ippo|inni|innale|njaan|njan|nee|ningal|enikku|ninakku|amma|achan|chetta|chechi|mone|molu|veettil|purathu|ivide|avide|entha cheyyam|sukham alle|alle|poyi|vannu|kazhicho|vellam|urakkam|saadhanam)\b/i;

// Romanized Punjabi (Latin script) hints
export const ROMAN_PA_LANG_HINT_REGEX =
    /\b(ki|kida|kive|kiven|theek|thik|thik aa|theek aa|haanji|hanji|nahi|nhi|aj|kal|hun|tusi|tu|main|mera|meri|sada|sadi|paji|veer|veerji|bhain|maa|papa|ghar|bahar|kithe|kithon|ki haal|haal chaal|changa|vadhiya|roti|paani|sona|aaja|chalo)\b/i;

// Romanized Marathi (Latin script) hints
export const ROMAN_MR_LANG_HINT_REGEX =
    /\b(kay|kaay|kasa|kashi|kase|bara|baray|thik|thik aahe|aata|atta|aaj|udya|mi|mee|tu|tumhi|mala|tula|tyala|aamhi|aapan|ahe|aahe|navta|navte|ghari|baher|ithe|tithe|kaay chalay|kay chalalay|sang|bol|yete|jaato|khaala|paani|zhala|zala|chhan|khup|ekta|vatat|vatte|aajun|baray nahi|theek nahi|manat|dukhat|rahat nahi)\b/i;

// Romanized Odia (Latin script) hints
export const ROMAN_OR_LANG_HINT_REGEX =
    /\b(kana|kanha|kemiti|kemti|bhala|bhal|thik|thik achhi|mu|tume|apana|mo|tora|ama|ghar|bahare|ethi|sethi|aaji|kali|kouthi|kahinki|kebe|khana|pani|asuchi|jauchhi|soiba|thia|chala|dekh)\b/i;

// English "clearly English" hints (for strict English turns)
export const EN_LANG_HINT_REGEX =
    /\b(what|when|where|how|the|please|thanks|thank|mom|dad|dinner|lunch|breakfast|tonight|today|tomorrow|coming|home|cook|cooked|cooking|special|birthday|And|To|It|Is|In|My|You|U|Me|I|Yeah|Yep|No|Nah|LOL|LMAO|OMG|Wow|Cool|Nice|Oh|Okay|OK|K|Wait|Actually|Literally|Now|Soon|Later|ASAP|BRB|AFK|On my way|OMW|Think|Know|Want|Doing|Going|Why|Thx|Pls|Sorry|Sry|Hey|Hi|Hello|Bye|Good|Gnite|Take care)\b/i;

// --------------------------------------------------
// Bengali emotion regexes
// --------------------------------------------------

export const BN_SAD_REGEX =
    /(মন খারাপ|খারাপ লাগছে|মন ভালো নেই|মনে ভালো নেই|ভালো নেই|ভাল নেই|ভালো লাগছে না|ভাল লাগছে না|দুঃখ|কষ্ট|কাঁদ|কান্না|একলা|একাকী|\bmon(\s+ta)?\s+kharap\b|\bamar\s+mon(\s+ta)?\s+kharap\b|\bkhub\s+kharap\s+lag(chh?e|che)\b|\bkharap\s+lag(chh?e|che)\b|\bmon\s+bhalo\s+na\b|\b(kichu|kicu|kisu)\s+bhalo\s+lag(chh?e|che)\s+na\b|\bbhalo\s+lag(chh?e|che)\s+na\b|\bmood\s+off\b)/i;

export const BN_STRESS_REGEX =
    /(চিন্তা|দুশ্চিন্তা|টেনশন|স্ট্রেস|ভয় লাগছে|\bonek\s+chinta\s+hocch?e\b|\bkhub\s+chinta\s+hocch?e\b|\bchinta\s+hocch?e\b|\bstress\s+e\s+achi\b|\bkhub\s+stress\s+e\s+achi\b|\btension\s+e\s+achi\b|\bkhub\s+tension\s+e\s+achi\b)/i;

export const BN_ANGER_REGEX =
    /(রাগ|রেগে আছি|রাগ হচ্ছে|ভীষণ রাগ হচ্ছে|খুব রাগ হচ্ছে|মেজাজ খারাপ|চটে গেছি|\brag\b|\brege\s+achi\b|\brag\s+hocch?e\b|\bkhub\s+rag\s+hocch?e\b|\bmejaj\s+kharap\b|\bchote\s+gechi\b)/i;

export const BN_FEAR_REGEX =
    /(ভয়|ভয় লাগছে|খুব ভয় লাগছে|আমার ভয় লাগছে|ডর লাগছে|ভয় পাচ্ছি|\bvoy\b|\bvoy\s+lagch?e\b|\bkhub\s+voy\s+lagch?e\b|\bvoy\s+pachch?i\b)/i;

// Bengali confusion / mental overload
export const BN_CONFUSED_REGEX =
    /বুঝতে পারছি না|বুঝতে পারছিনা|মাথা কাজ করছে না|মাথা কাজ করছ না/i;

// --------------------------------------------------
// Hindi emotion regexes
// --------------------------------------------------

export const HI_STRESS_REGEX =
    /(परेशान|तनाव|चिंता|घबराहट|बेचैन|\bpareshaan\b|\bpareshan\b|\btanav\b|\bchinta\b|\bghabrahat\b|\bbechain\b|\btension\b)/i;

// Hindi confusion / mental overload (renamed + updated from web)
export const HI_CONFUSED_REGEX =
    /samajh nahi aa raha|samajh nahi aa rha|dimag kaam nahi kar raha|dimaag kaam nahi kar raha|समझ नहीं आ रहा|समझ नही आ रहा|दिमाग काम नहीं कर रहा|दिमाग काम नही कर रहा/i;

// Keep backward-compatible alias
export const CONFUSED_HI_REGEX =
    /(समझ नहीं|समझ नही|कन्फ्यूज|भूल गया|भूल गयी|क्या करूँ|क्या करु|क्या करूं|क्या करूँ|\bsamajh\s+nahi\s+aa\s+raha\b|\bsamajh\s+nahi\s+aa\s+rahi\b|\bsamajh\s+nahi\s+aa\s+raha\s+hai\b|\bsamajh\s+nahi\s+aa\s+rahi\s+hai\b|\bkya\s+karu\b|\bkya\s+karoon\b|\bkya\s+karu[nm]?\b)/i;

export const HI_SAD_REGEX =
    /(उदास|दुखी|रोना|रो रहा|रो रही|बहुत बुरा लग रहा|मन नहीं लग रहा|अकेला|अकेली|\budaas\b|\bdukhi\b|\brona\b|\bro\s+raha\s+hoon\b|\bro\s+rahi\s+hoon\b|\bbahut\s+bura\s+lag\s+raha\b|\bman\s+nahi\s+lag\s+raha\b|\bakela\b|\bakeli\b)/i;

export const HI_ANGER_REGEX =
    /(गुस्सा|गुस्से|चिड़चिड़|नाराज|क्रोध|बहुत गुस्सा आ रहा|बहुत गुस्सा है|\bgussa\b|\bgusse\s+(mein|me)\s+hoon\b|\bchidchid\b|\bnaraaz\b|\bkrodh\b|\bbahut\s+gussa\b|\bgussa\s+aa\s+raha\b)/i;

export const HI_FEAR_REGEX =
    /(डर|भय|घबराहट|डर लग रहा|बहुत डर लग रहा|डरा हुआ|डरी हुई|\bdar\b|\bdar\s+lag\s+raha\b|\bbhay\b|\bghabrahat\b|\bbahut\s+dar\s+lag\s+raha\b|\bdara\s+hua\b|\bdari\s+hui\b)/i;

// --------------------------------------------------
// Tamil emotion regexes
// --------------------------------------------------

export const TA_SAD_REGEX =
    /(romba kashtama irukku|kashtama irukku|manasu kashtama irukku|romba kastama irukku|kastama irukku|manasu kastama irukku|manasu sari illa|manasu seriya illa|romba sogama irukku|sogama irukku|azhuga varudhu|azhudha pola irukku|udalum manasum tired aa irukku)/i;

export const TA_STRESS_REGEX =
    /(romba pressure irukku|pressure aa irukku|romba tension aa irukku|tension aa irukku|romba stress aa irukku|stress aa irukku|bayama irukku|romba bayama irukku|manasu romba odudhu|thalaila neraya oditu irukku|thalaila romba load irukku)/i;

export const TA_ANGER_REGEX =
    /(கோபம்|கோபமாக இருக்கு|ரொம்ப கோபம்|எரிச்சல்|எரிச்சல் ஆகுது|மனசு சேதம்|kopam|kopama irukku|romba kopam|erichal|erichal agudhu|manasu sedharam|sedharam irukku|kopam irukku|romba erichal|aattiram|aattiram irukku)/i;

export const TA_FEAR_REGEX =
    /(பயம்|பயமா இருக்கு|ரொம்ப பயமா இருக்கு|பயப்படுறேன்|bayam|bayama irukku|romba bayama irukku|bayappaduren|bayappadhi irukku|manasu payanam|fear aa irukku|romba fear|ghabara irukku|antha bayam irukku)/i;

export const TA_CONFUSED_REGEX =
    /(புரியல|புரியவில்லை|என்ன பண்றதுன்னு தெரியல|மனசு குழம்புது|puriyala|puriyavillai|enna panrathunn teriyala|manasu kuzhambudhu|teriyala|enakku puriyala|yenna seyrathu nu terdu|kuzhambi poche|manasu samanam illa|yaar solrathu nu teriyala)/i;

// --------------------------------------------------
// Gujarati emotion regexes
// --------------------------------------------------

export const GU_SAD_REGEX =
    /(એકલા|એકલુ|એકલું|એકલાપણું|મન ખરાબ|ખરાબ લાગે છે|ખૂબ ખરાબ લાગે છે|\bekla\s+lage\s+che\b|\beklu\s+lage\s+che\b|\bman\s+kharap\s+che\b|\bkharab\s+lage\s+che\b|\bbahu\s+ekla\s+lage\s+che\b|\bkhub\s+kharab\s+lage\s+che\b)/i;

export const GU_STRESS_REGEX =
    /(ટેન્શન|ચિંતા|ચિંતિત|ઘબરાહટ|દબાણ|બહુ ટેન્શન છે|ખૂબ ટેન્શન છે|મને ટેન્શન છે|\btension\b|\bchinta\b|\bchintit\b|\bghabrahat\b|\bdabaan\b|\bbahu\s+tension\s+che\b|\bkhub\s+tension\s+che\b|\bmane\s+tension\s+che\b)/i;

export const GU_ANGER_REGEX =
    /(ગુસ્સો|ગુસ્સે|ચીડ|ચીડિયો|ચીડાય છે|ખીજ|ખીજાય છે|બહુ ગુસ્સો આવે છે|ખૂબ ગુસ્સો આવે છે|મને ગુસ્સો આવે છે|\bgusso\b|\bgusse\b|\bchid\b|\bkhij\b|\bbahu\s+gusso\s+aave\s+che\b|\bkhub\s+gusso\s+aave\s+che\b|\bmane\s+gusso\s+aave\s+che\b)/i;

export const GU_FEAR_REGEX =
    /(ડર|ડર લાગે છે|મને ડર લાગે છે|ઘબરાય|ઘબરાઈ ગયો|ઘબરાઈ ગઈ|બહુ ડર લાગે છે|\bdar\b|\bdar\s+lage\s+che\b|\bmane\s+dar\s+lage\s+che\b|\bghabray\b|\bghabrayi\b)/i;

// --------------------------------------------------
// Kannada emotion regexes
// --------------------------------------------------

export const KN_SAD_REGEX =
    /(ಬೇಜಾರು|ಮನಸ್ಸು ಸರಿಯಿಲ್ಲ|ದುಃಖ|ಅಳು|ಒಂಟಿ|\bbejar(u)?\b|\bbesara\b|\bmanasu sariyilla\b|\bmanassu sariyilla\b|\bdukha\b|\bonti\b|\btumba bejar\b)/i;

export const KN_STRESS_REGEX =
    /(ಟೆನ್ಶನ್|ಚಿಂತೆ|ತಲೆ ತಿನ್ನುತ್ತಿದೆ|\btension (aa)?gide\b|\bchinte (aa)?gtide\b|\btala tinnuttide\b|\btumba tension\b|\btumba chinte\b)/i;

export const KN_ANGER_REGEX =
    /(ಕೋಪ|ರೇಜಿಗೆ|\bkopa (ba)?ruttide\b|\btumba kopa\b|\brejige (aa)?gide\b)/i;

export const KN_FEAR_REGEX =
    /(ಭಯ|ಹೆದರಿಕೆ|\bbhaya (aa)?guttide\b|\bhedarike (aa)?gide\b|\bhedarike\b|\bbhaya agide\b)/i;

// --------------------------------------------------
// Malayalam emotion regexes
// --------------------------------------------------

export const ML_SAD_REGEX =
    /(സങ്കടം|ദുഃഖം|ഒറ്റപ്പെടൽ|\bsankadam\b|\bdukham\b|\bvishamamundu\b|\bvishama thonum\b|\bvaliya sadness\b|\bmanassu shariyalla\b)/i;

export const ML_STRESS_REGEX =
    /(ടെൻഷൻ|ഉൽകണ്ഠ|\btension undu\b|\bvaliya tension\b|\bchintayundu\b|\bchinta undu\b)/i;

export const ML_ANGER_REGEX =
    /(ദേഷ്യം|\bdeshyam varunu\b|\bdeshyam\b|\bkoppam\b|\bvaliya koppam\b)/i;

export const ML_FEAR_REGEX =
    /(ഭയം|പേടി|\bbhayam undu\b|\bpedi thonum\b|\bbhayam thonum\b|\bpedi thonikkunnu\b)/i;

// --------------------------------------------------
// Punjabi emotion regexes
// --------------------------------------------------

export const PA_SAD_REGEX =
    /(ਉਦਾਸ|ਦੁੱਖ|ਮਨ ਠੀਕ ਨਹੀਂ|\budaas\b|\bdukhi haan\b|\bdil dukha\b|\bman theek nahi\b|\bman kharab aa\b|\bkhub udaas\b)/i;

export const PA_STRESS_REGEX =
    /(ਤਣਾਅ|ਚਿੰਤਾ|ਟੈਨਸ਼ਨ|\btanaav\b|\bchinta lagdi aa\b|\btension aa\b|\btension vich haan\b|\bkhub tension aa\b)/i;

export const PA_ANGER_REGEX =
    /(ਗੁੱਸਾ|ਖਿੱਝ|\bgussa aa re(ha|hi)\b|\bgussa aaya\b|\bkhijh aa (rahi|reha)\b|\bkhub gussa\b)/i;

export const PA_FEAR_REGEX =
    /(ਡਰ|ਘਬਰਾਹਟ|\bdar lagd(a|i) aa\b|\bghabra re(ha|hi) haan\b|\bdar lagg reha\b)/i;

// --------------------------------------------------
// Odia emotion regexes
// --------------------------------------------------

export const OR_SAD_REGEX =
    /(ମନ ଖରାପ|ଦୁଃଖ|ଏକୁଟିଆ|\bmana kharap\b|\bduhkha laguchhi\b|\bkharap laguchhi\b|\bman ta bhal nahi\b|\bkhub kharap laguchhi\b)/i;

export const OR_STRESS_REGEX =
    /(ଟେନ୍ସନ|ଚିନ୍ତା|\btension laguchhi\b|\bchinta heutahe\b|\bkhub tension laguchhi\b)/i;

export const OR_ANGER_REGEX =
    /(ରାଗ|\braga (aa)?suchhi\b|\bkhub raga\b|\braga laguchhi\b)/i;

export const OR_FEAR_REGEX =
    /(ଭୟ|ଡର|\bbhaya laguchhi\b|\bdara laguchhi\b|\bbhaya (aa)?suchhi\b)/i;

// --------------------------------------------------
// Marathi emotion regexes
// --------------------------------------------------

export const MR_SAD_REGEX =
    /(मन खराब|दुःख|एकटे|\bman kharab aahe\b|\bkhup kharab vatat\b|\bdukha hote\b|\bekta vatat aahe\b|\brodaycha yet aahe\b)/i;

export const MR_STRESS_REGEX =
    /(ताण|चिंता|टेन्शन|\bkhup tension aahe\b|\btaan jaanvat aahe\b|\bchinta vatat aahe\b|\btension vatat aahe\b)/i;

export const MR_ANGER_REGEX =
    /(राग|चिडचिड|\bkhup raga aala\b|\bchidchid hote\b|\braga vatat aahe\b)/i;

export const MR_FEAR_REGEX =
    /(भीती|काळजी|घाबरणे|\bbhiti vatat aahe\b|\bkalji vatat aahe\b|\bghabrat aahe\b)/i;

// --------------------------------------------------
// Gratitude detection — English + all Indian languages
// --------------------------------------------------

export const GRATITUDE_REGEX =
    /(grateful|gratitude|thankful|thankfulness|blessed|appreciate|appreciating|appreciation|so thank(ful|ed)|thank you so much|means a lot|\bshukar\b|shukria|shukriya|aabhar|dhanyavaad|dhanyabad|dhanyawad|dhanyavad|shukriyaa|\bkritagjna\b|nanri|nandri|vandanam|\bkritajnata\b|\bkadardani\b|\bdhanyavadagalu\b|\bnandri\b|\bvanakkam\b|\bkritajnateyanu\b|\bkritajna\b|\bdhanyosmi\b|\bdhanyawadi\b|abhaari|\bshukar\s+hai\b|shukar\s+hua|bahut\s+shukriya|bahut\s+dhanyavaad|আপনার\s+কাছে\s+কৃতজ্ঞ|কৃতজ্ঞ|ধন্যবাদ|আপনাকে\s+ধন্যবাদ|நன்றி|நன்றி\s+சொல்ல|நன்றியுள்ளவர்|ధన్యవాదాలు|కృతజ్ఞత|ధన్యవాదం|ಧನ್ಯವಾದಗಳು|ಕೃತಜ್ಞತೆ|ಧನ್ಯವಾದ|ধন্যবাদ|ਧੰਨਵਾਦ|ਸ਼ੁਕਰੀਆ|ਕ੍ਰਿਤਜ੍ਞਤਾ|ধন্যবাদ|ଧନ୍ୟବାଦ|କୃତଜ୍ଞ|ଆଭାରୀ|આભાર|ધન્યવાદ|કૃતજ્ઞ)/i;

// --------------------------------------------------
// Crisis detection — kept conservative
// --------------------------------------------------

export const CRISIS_HINT_REGEX =
    new RegExp(
        [
            // --- English ---
            "i\\s+want\\s+to\\s+die", "want\\s+to\\s+die", "kill\\s+myself",
            "end\\s+my\\s+life", "ending\\s+everything", "end\\s+everything",
            "i\\s+feel\\s+like\\s+ending\\s+everything",
            "don'?t\\s+want\\s+to\\s+live", "cannot\\s+go\\s+on", "can'?t\\s+go\\s+on",
            "can'?t\\s+take\\s+it\\s+anymore", "cannot\\s+take\\s+it\\s+anymore",
            "life\\s+has\\s+no\\s+meaning", "life\\s+feels\\s+meaningless",
            "no\\s+reason\\s+to\\s+live", "better\\s+off\\s+dead",

            // --- Bengali (Romanized + Unicode) ---
            "ami\\s+marte\\s+chai", "marte\\s+chai", "ami\\s+morte\\s+chai", "morte\\s+chai",
            "ami\\s+ar\\s+parchi\\s+na", "ar\\s+parchi\\s+na",
            "amar\\s+bachte\\s+ichcha\\s+korch?e\\s+na",
            "bachte\\s+ichhe\\s+korch?e\\s+na", "bachte\\s+icche\\s+korch?e\\s+na",
            "more\\s+jete\\s+ichhe\\s+korch?e", "morte\\s+ichhe\\s+korch?e",
            "bachbo\\s+na", "banchte\\s+chai\\s+na",
            "আমি\\s+মরতে\\s+চাই", "আমার\\s+মরতে\\s+ইচ্ছে\\s+করছে",
            "বাঁচতে\\s+ইচ্ছে\\s+করছে\\s+না", "আমি\\s+বাঁচতে\\s+চাই\\s+না",
            "আমি\\s+আর\\s+পারছি\\s+না",

            // --- Hindi (Romanized + Devanagari) ---
            "mar\\s+jana\\s+hai", "jeene\\s+ka\\s+mann\\s+nahi",
            "jeene\\s+ka\\s+man\\s+nahi", "jeena\\s+nahi\\s+hai",
            "life\\s+ka\\s+koi\\s+matlab\\s+nahi",
            "main\\s+marna\\s+chahta\\s+hu", "main\\s+marna\\s+chahti\\s+hu",
            "marna\\s+chahta\\s+hoon", "marna\\s+chahti\\s+hoon",
            "main\\s+jeena\\s+nahi\\s+chahta", "main\\s+jeena\\s+nahi\\s+chahti",
            "मुझे\\s+मर\\s+जाना\\s+है", "मैं\\s+मरना\\s+चाहता\\s+हूँ",
            "मैं\\s+मरना\\s+चाहती\\s+हूँ", "जीने\\s+का\\s+मन\\s+नहीं\\s+है",
            "ज़िंदगी\\s+का\\s+कोई\\s+मतलब\\s+नहीं", "जिंदगी\\s+खत्म\\s+करना\\s+है",
            "जीना\\s+नहीं\\s+चाहता", "जीना\\s+नहीं\\s+चाहती",

            // --- Tamil (Romanized) ---
            "saka\\s+venum", "saaganum", "saaga\\s+venum",
            "vaazhakka\\s+virupam\\s+illai", "vaazhve\\s+venam",
            "inikku\\s+mela\\s+vaazha\\s+mudiyaadu",
            "en\\s+uyir\\s+edukkanum",

            // --- Telugu (Romanized) ---
            "chachipovaalanipistundi", "chaavaalani\\s+undi",
            "jeevitam\\s+adi\\s+cheyaalani\\s+undi",
            "badukonu\\s+ishtam\\s+ledu", "jeevitam\\s+ardham\\s+kaadu",
            "chachipovaadam\\s+maname",

            // --- Gujarati (Romanized + Unicode) ---
            "mari\\s+javun\\s+che", "jevan\\s+nu\\s+man\\s+nathi",
            "jivanu\\s+man\\s+nathi", "jivan\\s+pura\\s+karvu\\s+che",
            "aatmahatya\\s+karvu\\s+che",
            "મરી\\s+જવું\\s+છે", "જીવવું\\s+નથી", "આત્મહત્યા\\s+કરવી\\s+છે",

            // --- Kannada (Romanized + Unicode) ---
            "saayabeku", "saayabeku\\s+anisutte", "jeevana\\s+mugisabeku",
            "badukalu\\s+ishtavilla", "badukina\\s+arthavilla",
            "ಸಾಯಬೇಕು", "ಜೀವನ\\s+ಮುಗಿಸಬೇಕು", "ಬದುಕಲು\\s+ಇಷ್ಟವಿಲ್ಲ",

            // --- Malayalam (Romanized + Unicode) ---
            "marikkanam", "marikkanam\\s+pola\\s+thonum",
            "jeevitham\\s+aakanam", "jeevitham\\s+theerkkanam",
            "veendum\\s+vazhakka\\s+thonunnilla",
            "മരിക്കണം", "ജീവിതം\\s+മതിയായി", "ജീവിക്കണ്ട",

            // --- Punjabi (Romanized + Gurmukhi) ---
            "mar\\s+jaana\\s+chahunda\\s+haan", "mar\\s+jaana\\s+chahundi\\s+haan",
            "jeona\\s+nahi\\s+chahunda", "zindagi\\s+khatam\\s+karna\\s+chahunda",
            "ਮਰ\\s+ਜਾਣਾ\\s+ਚਾਹੁੰਦਾ", "ਜ਼ਿੰਦਗੀ\\s+ਖਤਮ\\s+ਕਰਨੀ\\s+ਹੈ",
            "ਜਿਉਣਾ\\s+ਨਹੀਂ\\s+ਚਾਹੁੰਦਾ",

            // --- Odia (Romanized + Unicode) ---
            "mariba\\s+chahuchhi", "jibana\\s+sesa\\s+karibaku\\s+uchhi",
            "banchiba\\s+uchha\\s+nahi",
            "ମରିବା\\s+ଚାହୁଁଛି", "ଜୀବନ\\s+ଶେଷ\\s+କରିବାକୁ\\s+ଇଚ୍ଛା",

            // --- Marathi (Romanized + Devanagari) ---
            "maraycha\\s+aahe", "jeena\\s+nako\\s+aahe",
            "jiv\\s+dyaava\\s+vatta\\s+aahe", "aayushya\\s+sampavaycha\\s+aahe",
            "मरायचे\\s+आहे", "जगणे\\s+नको\\s+आहे",
            "जीव\\s+द्यावा\\s+वाटते", "आयुष्य\\s+संपवायचे\\s+आहे",
        ].join("|"),
        "i"
    );

// --------------------------------------------------
// English confusion / mental overload
// --------------------------------------------------

const CONFUSED_EN_TERMS = [
    "cannot focus",
    "can not focus",
    "can't focus",
    "cant focus",
    "can't focus",
    "can't concentrate",
    "cant concentrate",
    "can't concentrate",
    "can't think",
    "cant think",
    "can't think",
    "scattered",
    "mind is all over",
    "all over the place",
    "not sure what to do",
    "unsure what to do",
    "don't know what to do",
    "don't know what to do",
    "overthinking",
    "overthink",
    "over thinking",
    "brain fog",
    "brain feels foggy",
    "feeling foggy",
    "blanking out",
    "mind is blank",
    "keep blanking",
] as const;

export const CONFUSED_EN_REGEX = new RegExp(
    CONFUSED_EN_TERMS.map(escapeRegexLiteral).join("|"),
    "i"
);

// --------------------------------------------------
// DEV Helper (safe, no runtime impact)
// Allows quick manual testing of keyword matches
// --------------------------------------------------

export type DebugEmotion = "confused" | "stressed" | "sad";

export function debugDetectEmotion(text: string): DebugEmotion | null {
    if (!text) return null;

    const input = String(text);

    if (isConfusedText(input)) return "confused";

    if (
        BN_STRESS_REGEX.test(input) ||
        HI_STRESS_REGEX.test(input) ||
        TA_STRESS_REGEX.test(input)
    )
        return "stressed";
    if (BN_SAD_REGEX.test(input) || TA_SAD_REGEX.test(input)) return "sad";

    return null;
}

// --------------------------------------------------
// Shared helper (safe, no runtime impact unless used)
// Centralizes "confused" detection for reuse.
// --------------------------------------------------

export function isConfusedText(text: string): boolean {
    if (!text) return false;

    const input = String(text)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    // Defensive: safe even if any regex ever becomes /g in future
    CONFUSED_EN_REGEX.lastIndex = 0;
    HI_CONFUSED_REGEX.lastIndex = 0;
    BN_CONFUSED_REGEX.lastIndex = 0;
    TA_CONFUSED_REGEX.lastIndex = 0;

    return (
        CONFUSED_EN_REGEX.test(input) ||
        HI_CONFUSED_REGEX.test(input) ||
        BN_CONFUSED_REGEX.test(input) ||
        TA_CONFUSED_REGEX.test(input)
    );
}
