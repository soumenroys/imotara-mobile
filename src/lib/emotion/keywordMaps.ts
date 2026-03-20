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
    /\b(hai|haan|nahi|nahin|kya|kyun|kyunki|kyonki|kaise|kab|kahan|aaj|kal|bhai|yaar|mummy|papa|didi|jaldi|khana|bhook|ghar|Kaun|Achha|Thik|Tum|Aap|Hum|Woh|Yeh|Sab|Kuch|Toh|Bhi|Na|Aur|Bas|Shayad|Jarur|Waisa|Aisa|Chal|Kar|Ho|Gaya|Raha|Chahiye|Bol|Bata|Milte|Abhi|Thoda|Zyada|Maza|Maaf|Shukriya|bahut|bohot|mujhe|mujhse|tumhe|tumhare|apna|apni|apne|matlab|lekin|agar|phir|sochna|socha|karo|karta|karti|samajh|samajhna|hona|hone|wahi|wohi|unhe|unko|humne|dono|rehna|sunna|theek hai|kuch nahi|pata nahi|kya hua|kya hoga|isliye|isiliye|mujhe lagta|lag raha)\b/i;

// Romanized Bengali (Latin script) hints
export const ROMAN_BN_LANG_HINT_REGEX =
    /\b(Ki|Hae|hoe|Na|Kemon|Bhalo|Ki khobor|Achi|Ar|Ekhon|Pore|Korcho|Khai|Ghum|Jachhi|Aschi|Bolche|Dekha|Janina|Bujhlam|Sunte|Tumi|Apni|Tui|Amra|Ora|Bari|Baire|Office|College|Bondhu|Ke|Acha|Thik ache|Sotti|Tai|Keno|Kothay|Kobe|Kokhon|Ekdom|Hoyto|Osthir|Cholo|Boka|Pagol|Misti|Dhur|Ghumao|Kotha|Hobe|Bad dao|baad|ami|acho|accho|onekdin|chol|kothao|adda|gosip|gossip|joma|ache|khub|barite|ghor|mon|kharap|lagche|hocche|hochhe|korchi|korchhi|parchi|parchhi|morte|marte|chai|bachte|banchte|icche|ichhe|bujhte|bujhchi|bujhtesi|kaz|kaaj|kajer|kazer|korbo|korba|korbe|bolbo|bolba|bolbe|jabo|jabe|ashbo|ashbe|asbo|asbe|nebo|debo|khabo|khabe|parbo|parbe|thakbo|thakbe|shunbo|shunbe|dekbo|dekbe|vabchi|vabchhi|bhabchi|vabtachi|vabte|bhabte|shunchi|shunchis|boddo|bodo|boro|chap|chaap|onek|ektu|shob|ke jane|janina)\b/i;

// Romanized Tamil (Latin script) hints
export const ROMAN_TA_LANG_HINT_REGEX =
    /\b(enna|epdi|eppadi|seri|sari|inga|anga|ipo|ippo|ennaachu|enna achu|saptiya|saaptiya|veetla|veetle|amma|appa|thambi|akka|anna|nan|naan|unaku|ungal|romba|konjam|nalla|illa|illai|podhum|paravailla|paravala|sollu|pesu|pesa|venum|vendam|paathu|paakalam|irukku|irukka|pogudhu|vandhuten|poiten|theriyum|theriyathu|mudiyum|mudiyathu|pannuven|pannitten|panna|solluven|sonnen|saptom|thinnom|parkalam|ketka|macha|machan|da|di|naanga|unga|avar|avanga|enna panrom|nadakkudhu|nadakkudu|sollunga|pesalam|paakalam|vaanga|vaanga da)\b/i;

// Romanized Telugu (Latin script) hints
export const ROMAN_TE_LANG_HINT_REGEX =
    /\b(enti|ela|elaa|em|emi|ippudu|inka|avuna|kaadu|ledu|undhi|undi|unna|unnanu|nenu|nuvvu|meeru|miku|naaku|amma|nanna|anna|akka|tammudu|chelli|baaga|bagundi|chala|konchem|vellu|vastanu|vachanu|cheppu|matladu|tinava|tinnava|em ayindi|emindi|sare|parledu|enduku|ekkada|eppudu|cheppandi|cheyandi|chesanu|chestanu|telidu|aipoindi|chusanu|chudandi|velthanu|veltanu|chestha|chestham|meeru antara|naaku telidu|emanna|emundhi|elaundi|baagunnara|bagunnava|cheppara|cheyyamani)\b/i;

// Romanized Gujarati (Latin script) hints
export const ROMAN_GU_LANG_HINT_REGEX =
    /\b(shu|su|kem|kem cho|majama|majamaa|saru|saras|have|hve|tame|hu|hun|mane|tane|aaje|kaal|ghar|bahar|su che|barabar|thik|chaalo|chalo|joie|joye|padse|nathi|che|hatu|hase|aavjo|aavyo|javanu|jamyu|jamva|paani|thai|thai che|lage che|saru nathi|majama nathi|taklif|darek|thodu|khub)\b/i;

// Romanized Kannada (Latin script) hints
export const ROMAN_KN_LANG_HINT_REGEX =
    /\b(yenu|enu|hegide|hegiddiya|hegiddira|sari|chennagide|chenagide|ivattu|naanu|nanu|neenu|ninu|nimge|nanage|amma|appa|anna|akka|thamma|tangi|bega|mane|horage|illi|alli|yaake|yake|elli|yelli|hege|oota|neeru|malagu|barutte|hogutte|banni|hogona|nodona|tumba|bejar|besara|agide|ide|illa|nan hatra|saku|swalpa)\b/i;

// Romanized Malayalam (Latin script) hints
export const ROMAN_ML_LANG_HINT_REGEX =
    /\b(entha|enthaanu|enthaada|engane|sheri|shari|ippo|inni|innale|njaan|njan|nee|ningal|enikku|ninakku|amma|achan|chetta|chechi|mone|molu|veettil|purathu|ivide|avide|entha cheyyam|sukham alle|alle|poyi|vannu|kazhicho|vellam|urakkam|saadhanam|sheriyanu|ente|ninne|ayiyo|paranjath|aarkkan|chollam|parayam|shariyanu|manasilaayi|sheriyalla|okke|ninne|enthinanu|ethinu|evideyanu|njan parayam|njan paranjath|parayanda|theernnu)\b/i;

// Romanized Punjabi (Latin script) hints
// NOTE: Removed Hindi-overlapping words (ki, nahi, tu, main, mera, meri, maa, papa, ghar, bahar,
// kal, roti, paani, chalo, aaja, theek, thik) to prevent false positives on Hindi Roman text.
// Punjabi detection relies on exclusively Punjabi words.
export const ROMAN_PA_LANG_HINT_REGEX =
    /\b(kida|kive|kiven|haanji|hanji|thik aa|theek aa|aj|hun|tusi|sada|sadi|paji|veer|veerji|bhain|kithe|kithon|ki haal|haal chaal|changa|vadhiya|sona|ethe|othe|ohna|enha|dass|dasso|kiddan|rabb|shukar|kuri|munda|lagda|lagdi|janda|aunda|challda|gall|tussi|ki gall|sat sri akal|waheguru|hor dasso|ki halchal|chaddi|ki pata|tu thik|mere naal|teri gall)\b/i;

// Romanized Marathi (Latin script) hints
export const ROMAN_MR_LANG_HINT_REGEX =
    /\b(kay|kaay|kasa|kashi|kase|bara|baray|thik|thik aahe|aata|atta|aaj|udya|mi|mee|tu|tumhi|mala|tula|tyala|aamhi|aapan|ahe|aahe|navta|navte|ghari|baher|ithe|tithe|kaay chalay|kay chalalay|sang|bol|yete|jaato|khaala|paani|zhala|zala|chhan|khup|ekta|vatat|vatte|aajun|baray nahi|theek nahi|manat|dukhat|rahat nahi|vallagche|vallagtech|dhur na|dhur|nako|naako|yaar re|jevla|jevlas|karu|karuyat|saang|baghtoy|baghtye|aavdta|aavdtay)\b/i;

// Romanized Odia (Latin script) hints
export const ROMAN_OR_LANG_HINT_REGEX =
    /\b(kana|kanha|kemiti|kemti|bhala|bhal|thik achhi|mu|tume|apana|mo|tora|ama|bahare|ethi|sethi|aaji|kouthi|kahinki|kebe|asuchi|jauchhi|soiba|thia|deba|neba|jibe|asibe|rahibe|khaiba|khauchhi|dekhuchhi|bujhilani|thare|aasiba|jaiba|paein|picha)\b/i;

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

export const GU_CONFUSED_REGEX =
    /(સમજાતું નથી|માથું ચકરાય છે|શું કરવું|ગૂંચવણ|ગૂંચવાઈ ગયો|ગૂંચવાઈ ગઈ|\bsamjhay na\b|\bsamjatu nathi\b|\bshu karvu\b|\bmathu chakray\b|\bgoonchan\b|\bgumchdvayu\b|\bkya karu\b|\bsamjhay nathi\b)/i;

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

export const KN_CONFUSED_REGEX =
    /(ತಿಳಿಯುತ್ತಿಲ್ಲ|ಅರ್ಥ ಆಗುತ್ತಿಲ್ಲ|ಏನು ಮಾಡಬೇಕು|ತಲೆ ಗೊಂದಲ|ಮನಸ್ಸು ಗೊಂದಲ|\barthu aaguvudilla\b|\bsamje kuda illa\b|\benu maadabeku\b|\btala gondala\b|\bmanasu gondala\b|\btumba confused\b|\byana maadali\b)/i;

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

export const ML_CONFUSED_REGEX =
    /(മനസ്സിലാകുന്നില്ല|എന്ത് ചെയ്യണം|ആശയക്കുഴപ്പം|\bmanassil aakunnilla\b|\benthu cheyyanum\b|\baashayakuzhappam\b|\bconfused aanu\b|\bsamshayam undu\b|\bbudhimuttundu\b|\benthu cheyyano ariyilla\b)/i;

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

export const PA_CONFUSED_REGEX =
    /(ਸਮਝ ਨਹੀਂ ਆਉਂਦਾ|ਮੱਥਾ ਖਾਲੀ|ਕੀ ਕਰਾਂ|ਮਨ ਗੁੰਮਿਆ|\bsamajh nahi aunda\b|\bmatha kaali\b|\bkya karan\b|\bman gumiya\b|\bconfused haan\b|\bsochna band\b|\bkuch samajh nahi\b)/i;

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

export const OR_CONFUSED_REGEX =
    /(ବୁଝିବି ନାହିଁ|ମୁଣ୍ଡ ଗୁଡ଼ୁଥାଏ|କଣ କରିବି|\bbujibi nahi\b|\bmunda guduthahe\b|\bkana karibi\b|\bsamajhila nahi\b|\bconfused laguchhi\b|\bkichi bujhapadi nahi\b)/i;

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

export const MR_CONFUSED_REGEX =
    /(समजत नाही|काय करावं|डोक्यात गोंधळ|काय करू|\bsamjat nahi\b|\bkay karave\b|\bkay karu\b|\bdokyat gondhal\b|\bconfused aahe\b|\bkahi samajh nahi\b|\bgondhal laglay\b)/i;

// --------------------------------------------------
// Japanese emotion regexes
// --------------------------------------------------

export const JP_SAD_REGEX =
    /(悲しい|悲しみ|泣く|泣いて|孤独|一人|寂しい|寂しみ|落ち込む|落ち込んでいる|絶望|絶望的|うつ|憂鬱)/;

export const JP_STRESS_REGEX =
    /(ストレス|疲れた|疲労|焦る|焦り|不安|心配|緊張|プレッシャー|余裕がない|追い詰められる|しんどい|つらい)/;

export const JP_ANGER_REGEX =
    /(怒る|怒り|イライラ|むかつく|腹が立つ|頭にくる|うんざり|我慢できない|嫌い|嫌になる|苛立ち)/;

export const JP_FEAR_REGEX =
    /(怖い|恐怖|恐ろしい|不安|こわい|びっくり|パニック|心配|どうしよう|危ない)/;

export const JP_CONFUSED_REGEX =
    /(混乱|わからない|理解できない|どうしたらいい|迷う|途方に暮れる|頭が混乱|何をすればいいかわからない|困惑)/;

// --------------------------------------------------
// Hebrew emotion regexes
// --------------------------------------------------

export const HE_SAD_REGEX =
    /(עצוב|עצובה|בוכה|בכי|לבד|בודד|מדוכא|מדוכאת|עצבות|ייאוש)/i;

export const HE_STRESS_REGEX =
    /(לחוץ|לחוצה|מתח|חרדה|דאגה|עצבני|עצבנית|לא יכול לנשום|לא מצליח)/i;

export const HE_ANGER_REGEX =
    /(כועס|כועסת|זועם|מרוגז|מרוגזת|התעצבנתי|נמאס לי|מתוסכל|מתוסכלת)/i;

export const HE_FEAR_REGEX =
    /(מפחד|מפחדת|פחד|מבוהל|מבוהלת|פוחד|נפחדתי|דואג)/i;

export const HE_CONFUSED_REGEX =
    /(מבולבל|מבולבלת|לא מבין|לא מבינה|לא יודע מה לעשות|אבוד|אבודה)/i;

// --------------------------------------------------
// Arabic emotion regexes
// --------------------------------------------------

export const AR_SAD_REGEX =
    /(حزين|حزينة|أبكي|وحيد|وحيدة|مكتئب|مكتئبة|أشعر بالحزن|يأس)/i;

export const AR_STRESS_REGEX =
    /(قلق|قلقة|توتر|ضغط|متوتر|متوترة|مرهق|مرهقة|لا أستطيع)/i;

export const AR_ANGER_REGEX =
    /(غاضب|غاضبة|غضب|منزعج|منزعجة|محبط|محبطة|أنا زعلان|تعبت)/i;

export const AR_FEAR_REGEX =
    /(خائف|خائفة|خوف|أشعر بالخوف|مرعوب|مرعوبة|قلق جداً)/i;

export const AR_CONFUSED_REGEX =
    /(مرتبك|مرتبكة|لا أفهم|لا أعرف ماذا أفعل|ضائع|ضائعة|محتار)/i;

// --------------------------------------------------
// German emotion regexes
// --------------------------------------------------

export const DE_SAD_REGEX =
    /\b(traurig|ich weine|allein|einsam|deprimiert|niedergeschlagen|hoffnungslos|unglücklich)\b/i;

export const DE_STRESS_REGEX =
    /\b(gestresst|Stress|überfordert|nervös|angespannt|erschöpft|ich schaffe das nicht)\b/i;

export const DE_ANGER_REGEX =
    /\b(wütend|sauer|verärgert|frustriert|genervt|ich bin so wütend|es nervt mich)\b/i;

export const DE_FEAR_REGEX =
    /\b(ich habe Angst|erschrocken|verängstigt|besorgt|ich fürchte mich)\b|(?<!\w)Angst(?!\w)/i;

export const DE_CONFUSED_REGEX =
    /\b(verwirrt|ich verstehe nicht|ich weiß nicht was ich tun soll|verloren|durcheinander)\b/i;

// --------------------------------------------------
// Gratitude detection — English + all Indian languages + Hebrew + Arabic + German
// --------------------------------------------------

export const GRATITUDE_REGEX =
    /(grateful|gratitude|thankful|thankfulness|blessed|appreciate|appreciating|appreciation|so thank(ful|ed)|thank you so much|means a lot|\bshukar\b|shukria|shukriya|aabhar|dhanyavaad|dhanyabad|dhanyawad|dhanyavad|shukriyaa|\bkritagjna\b|nanri|nandri|vandanam|\bkritajnata\b|\bkadardani\b|\bdhanyavadagalu\b|\bnandri\b|\bvanakkam\b|\bkritajnateyanu\b|\bkritajna\b|\bdhanyosmi\b|\bdhanyawadi\b|abhaari|\bshukar\s+hai\b|shukar\s+hua|bahut\s+shukriya|bahut\s+dhanyavaad|আপনার\s+কাছে\s+কৃতজ্ঞ|কৃতজ্ঞ|ধন্যবাদ|আপনাকে\s+ধন্যবাদ|நன்றி|நன்றி\s+சொல்ல|நன்றியுள்ளவர்|ధన్యవాదాలు|కృతజ్ఞత|ధన్యవాదం|ಧನ್ಯವಾದಗಳు|ಕೃತಜ್ಞತೆ|ಧನ್ಯವಾದ|ধন্যবাদ|ਧੰਨਵਾਦ|ਸ਼ੁਕਰੀਆ|ਕ੍ਰਿਤਜ੍ਞਤਾ|ধন্যবাদ|ଧନ୍ୟବାଦ|କୃତଜ୍ଞ|ଆଭାରୀ|આભાར|ધન્યવાદ|કૃતજ્ઞ|תודה|אסיר תודה|شكرا|ممتنن|\bdankbar\b|\bdanke\b|\bdankeschön\b|ありがとう|感謝|感謝します)/i;

// --------------------------------------------------
// Crisis detection
// Covers explicit suicidal ideation, self-harm, sexual assault/danger — across all supported languages.
// NOTE: bare "die", "death", "kill" alone are intentionally excluded — too noisy without context.
// --------------------------------------------------

export const CRISIS_HINT_REGEX =
  /(i\s+want\s+to\s+die|want\s+to\s+die|kill\s+myself|killing\s+myself|going\s+to\s+kill\s+myself|plan\s+(to\s+)?kill\s+myself|end\s+my\s+life|ending\s+my\s+life|plan\s+(to\s+)?end\s+my\s+life|end\s+it\s+all|ending\s+everything|end\s+everything|i\s+feel\s+like\s+ending\s+everything|don'?t\s+want\s+to\s+live|do\s+not\s+want\s+to\s+live|don'?t\s+want\s+to\s+be\s+here(\s+anymore)?|cannot\s+go\s+on|can'?t\s+go\s+on|can'?t\s+take\s+it\s+anymore|cannot\s+take\s+it\s+anymore|life\s+has\s+no\s+meaning|life\s+feels\s+meaningless|no\s+point\s+in\s+(living|life)|no\s+reason\s+to\s+(live|keep\s+going|be\s+alive)|suicidal|feeling\s+suicidal|i('?m|\s+am)\s+suicidal|thinking\s+(about|of)\s+suicide|thoughts?\s+of\s+suicide|better\s+off\s+dead|better\s+off\s+without\s+me|everyone\s+(would\s+be\s+)?better\s+off\s+without\s+me|i\s+wish\s+i\s+(was|were)\s+dead|wish\s+i\s+was\s+dead|hurt\s+myself|hurting\s+myself|harm\s+myself|harming\s+myself|self.?harm(ing)?|cut\s+myself|cutting\s+myself|want\s+to\s+(hurt|cut|harm)\s+myself|think(ing)?\s+about\s+(hurting|cutting|harming)\s+myself|overdos(e|ing|ed)|took\s+too\s+many\s+(pills|tablets)|being\s+raped?|was\s+raped?|he\s+raped?\s+me|she\s+raped?\s+me|someone\s+raped?\s+me|sexual\s+assault(ed)?|sexually\s+assault(ed)?|being\s+(physically\s+)?abused|he('?s|\s+is)\s+hurting\s+me|she('?s|\s+is)\s+hurting\s+me|domestic\s+violence|not\s+safe\s+right\s+now|i('?m|\s+am)\s+not\s+safe|in\s+immediate\s+danger|ami\s+marte\s+chai|marte\s+chai|ami\s+morte\s+chai|morte\s+chai|ami\s+ar\s+parchi\s+na|ar\s+parchi\s+na|amar\s+bachte\s+ichcha\s+korch?e\s+na|bachte\s+ichhe\s+korch?e\s+na|bachte\s+icche\s+korch?e\s+na|more\s+jete\s+ichhe\s+korch?e|morte\s+ichhe\s+korch?e|bachbo\s+na|banchte\s+chai\s+na|mar\s+jana\s+hai|mar\s+jaana\s+chahta|mar\s+jaana\s+chahti|jeene\s+ka\s+mann\s+nahi|jeene\s+ka\s+man\s+nahi|jeena\s+nahi\s+hai|life\s+ka\s+koi\s+matlab\s+nahi(\s+lag\s+raha)?|main\s+marna\s+chahta\s+hu|main\s+marna\s+chahti\s+hu|main\s+marna\s+chahta\s+hoon|main\s+marna\s+chahti\s+hoon|marna\s+chahta\s+hu|marna\s+chahti\s+hu|marna\s+chahta\s+hoon|marna\s+chahti\s+hoon|main\s+jeena\s+nahi\s+chahta|main\s+jeena\s+nahi\s+chahti|hu\s+marva\s+mangu\s+chu|jivvu\s+nathi|nanage\s+badukalu\s+ishtavilla|khud\s+ko\s+hurt\s+karna|khud\s+ko\s+nuqsan|apne\s+aap\s+ko\s+hurt|আমি\s+মরতে\s+চাই|আমার\s+মরতে\s+ইচ্ছে\s+করছে|বাঁচতে\s+ইচ্ছে\s+করছে\s+না|আমি\s+বাঁচতে\s+চাই\s+না|আমি\s+আর\s+পারছি\s+না|আমার\s+বাঁচতে\s+ইচ্ছা\s+করছে\s+না|নিজেকে\s+কষ্ট\s+দিতে\s+চাই|আত্মহত্যা|মুझे\s+मर\s+जाना\s+है|मैं\s+मरना\s+चाहता\s+हूँ|मैं\s+मरना\s+चाहती\s+हूँ|जीने\s+का\s+मन\s+नहीं\s+है|जीना\s+नहीं\s+है|ज़िंदगी\s+का\s+कोई\s+मतलब\s+नहीं|आत्महत्या|खुद\s+को\s+नुकसान|जिंदगी\s+खत्म\s+करना|मरायचंय|जगायचं\s+नाही|आत्महत्या\s+करायची|મારે\s+મરી\s+જવું\s+છે|મને\s+જીવવું\s+નથી|હું\s+મરવા\s+માગું\s+છું|ನನಗೆ\s+ಸಾಯಬೇಕು\s+ಅನಿಸುತ್ತಿದೆ|ನನಗೆ\s+ಬದುಕಲು\s+ಇಷ್ಟವಿಲ್ಲ|ನಾನು\s+ಸಾಯಬೇಕು|வாழ\s+வேண்டாம்|தற்கொலை|இறந்துவிட|சாக\s+வேண்டும்|చనిపోవాలి|ఆత్మహత్య|బతకాలని\s+లేదు|മരിക്കണം|ആത്മഹത്യ|ജീവിക്കണ്ട|ജീവിതം\s+വേണ്ട|אני\s+רוצה\s+למות|לא\s+רוצה\s+לחיות|התאבדות|רוצה\s+למות|לפגוע\s+בעצמי|أريد\s+أن\s+أموت|لا\s+أريد\s+أن\s+أعيش|انتحار|أريد\s+إيذاء\s+نفسي|أفكر\s+في\s+الانتحار|ich\s+will\s+sterben|ich\s+will\s+nicht\s+mehr\s+leben|Selbstmord|ich\s+will\s+mir\s+selbst\s+schaden|ich\s+denke\s+an\s+Suizid|死にたい|消えたい|自殺|自分を傷つけたい|死んでしまいたい)/i;

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
    GU_CONFUSED_REGEX.lastIndex = 0;
    KN_CONFUSED_REGEX.lastIndex = 0;
    ML_CONFUSED_REGEX.lastIndex = 0;
    PA_CONFUSED_REGEX.lastIndex = 0;
    OR_CONFUSED_REGEX.lastIndex = 0;
    MR_CONFUSED_REGEX.lastIndex = 0;
    HE_CONFUSED_REGEX.lastIndex = 0;
    AR_CONFUSED_REGEX.lastIndex = 0;
    DE_CONFUSED_REGEX.lastIndex = 0;
    JP_CONFUSED_REGEX.lastIndex = 0;

    return (
        CONFUSED_EN_REGEX.test(input) ||
        HI_CONFUSED_REGEX.test(input) ||
        BN_CONFUSED_REGEX.test(input) ||
        TA_CONFUSED_REGEX.test(input) ||
        GU_CONFUSED_REGEX.test(input) ||
        KN_CONFUSED_REGEX.test(input) ||
        ML_CONFUSED_REGEX.test(input) ||
        PA_CONFUSED_REGEX.test(input) ||
        OR_CONFUSED_REGEX.test(input) ||
        MR_CONFUSED_REGEX.test(input) ||
        HE_CONFUSED_REGEX.test(input) ||
        AR_CONFUSED_REGEX.test(input) ||
        DE_CONFUSED_REGEX.test(input) ||
        JP_CONFUSED_REGEX.test(input)
    );
}
