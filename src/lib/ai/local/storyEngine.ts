// src/lib/ai/local/storyEngine.ts
//
// Combinatorial micro-story engine.
// Each story = framing + situation + insight, picked with independent seed offsets.
// 4 × 4 × 4 = 64 unique combinations per signal per language.
// No LLM call, no hardcoded full sentences.

export type StorySignal = "sad" | "anxious" | "angry" | "tired";

interface StoryParts {
    readonly framings: readonly string[];    // "Someone once told me —"
    readonly situations: readonly string[];  // "…they were carrying something they couldn't name…"
    readonly insights: readonly string[];    // "The moment they named it, something loosened."
}

type SignalMap = Record<StorySignal, Pick<StoryParts, "situations" | "insights">>;
type LangEntry = { framings: readonly string[] } & SignalMap;

// ─────────────────────────────────────────────────────────────────────────────
// English
// ─────────────────────────────────────────────────────────────────────────────
const EN: LangEntry = {
    framings: [
        "Someone once told me —",
        "A while back, someone shared something that stayed with me:",
        "I've seen people go through this. One of them described it as —",
        "There was a conversation I still think about —",
    ],
    sad: {
        situations: [
            "they were carrying something they couldn't name, and didn't realise how heavy it had gotten until they stopped",
            "they kept going through the day with something quietly heavy inside, showing up for everyone while dragging",
            "they cried when they were alone — not because things got worse, just because they finally had a moment to feel it",
            "in front of others everything looked fine, but alone they felt like they were barely holding together",
        ],
        insights: [
            "The moment they named what was inside, something quietly loosened.",
            "They didn't fix it — they just let themselves feel it for one moment. That turned out to be enough.",
            "One small acknowledgment — just to themselves — made things a little more bearable.",
            "They stopped pretending it wasn't there. That was the first thing that actually helped.",
        ],
    },
    anxious: {
        situations: [
            "their mind kept running the same loops — preparing for something that hadn't even happened yet",
            "everything felt urgent at once and they couldn't find which thing actually needed attention",
            "there were too many threads moving at the same time and none felt like they were in their hands",
            "even small decisions felt impossibly heavy, and they couldn't explain why",
        ],
        insights: [
            "What helped wasn't solving everything — it was choosing just one thread to hold.",
            "They started asking: 'Is this happening right now, or is my mind rehearsing?' That one question slowed things down.",
            "Separating the alarm from the actual danger changed something.",
            "They gave themselves permission to only deal with what was actually in front of them, right now.",
        ],
    },
    angry: {
        situations: [
            "they had been holding things in for a long time, and one small thing finally tipped it over",
            "they kept things polite, kept things contained — until something quietly cracked",
            "the anger wasn't really about what had just happened — it was older, something from much further back",
            "they felt guilty for being angry, which only made the anger heavier and harder to move",
        ],
        insights: [
            "Naming it out loud — not to fix it, just to stop carrying it alone — made a real difference.",
            "What was underneath wasn't really anger. It was hurt that had nowhere to go.",
            "They said what they felt — not expecting it to change things, but because holding it alone was heavier.",
            "The anger had been protecting something softer. Once they saw that, it shifted.",
        ],
    },
    tired: {
        situations: [
            "they weren't tired from doing too much — they were tired from holding too many things together for too long",
            "they were running on empty, but didn't know how to stop without something falling apart",
            "their body would rest, but their mind never did",
            "they kept showing up every day even when they had nothing left to give",
        ],
        insights: [
            "It wasn't about sleep or rest. It was about being allowed to put things down for a while.",
            "They gave themselves permission to stop holding everything up — just for one hour. That was the start.",
            "Something shifted when they stopped asking 'how do I keep going' and started asking 'what do I actually need.'",
            "They let themselves be tired instead of fighting it. That turned out to be the gentler path.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Hindi
// ─────────────────────────────────────────────────────────────────────────────
const HI: LangEntry = {
    framings: [
        "Ek baar kisi ne mujhe bataya —",
        "Kuch samay pehle ek insaan ne kuch aisa kaha jo yaad reh gaya:",
        "Maine logon ko isse guzarte dekha hai. Ek baar kisi ne ise kuch yun samjhaya —",
        "Ek baat hai jo mujhe abhi bhi yaad hai —",
    ],
    sad: {
        situations: [
            "woh kuch aisa utha rahe they jo naam hi nahi le paa rahe they — aur pata hi nahi chala kab itna bhaari ho gaya",
            "din bhar sab kuch theek lagta tha, par andar se kuch dhire-dhire bhaari hota jaa raha tha",
            "woh akele they jab ro pare — isliye nahi ki kuch aur bura hua, balki isliye ki pehli baar feel karne ka waqt mila",
            "baaharon ke liye sab theek tha, par khud ke liye ek bojh tha jo hata hi nahi raha tha",
        ],
        insights: [
            "Jis pal unhone uska naam rakha, kuch halka hua.",
            "Unhone kuch theek nahi kiya — sirf ek pal mehsoos karne diya khud ko. Itna hi kaafi tha.",
            "Ek chhhoti si iqraar ne hi sab kuch thoda halka kar diya.",
            "Yeh maan lena ki yeh hai — wohi pehla asli qadam tha.",
        ],
    },
    anxious: {
        situations: [
            "dimaag baar baar wohi cheezein soch raha tha — woh jo hue hi nahi abhi tak",
            "sab kuch ek saath urgent laga, aur pata nahi chal raha tha pehle kaun si cheez chahiye dhyaan",
            "bahut saari cheezein ek saath chal rahi thin, aur koi bhi unke kaaboo mein nahi lagi",
            "chhhoti si baat bhi bahut bhaari lag rahi thi, bina kisi khaas wajah ke",
        ],
        insights: [
            "Kaam aaya ek hi cheez — ek single thread pakadna. Sab kuch solve karna zaroori nahi tha.",
            "Unhone poochha: 'Kya yeh abhi ho raha hai, ya main soch raha hoon kya ho sakta hai?' Iss sawaal ne sab kuch dheela kar diya.",
            "Alarm ko asli danger se alag karna — bas yahi kaam aaya.",
            "Sirf jo saamne tha usi ka dhyaan rakhne ki ijazat unhone khud ko di.",
        ],
    },
    angry: {
        situations: [
            "woh bahut samay se roke huye they — aur ek chhhoti si cheez ne poora tilak diya",
            "sab theek rakhte rahe, sab sambhale rahe — jab tak kuch toot nahi gaya",
            "gussa us baat ka nahi tha jo abhi hua tha — yeh kuch purana tha, kuch andar ka",
            "gussa aane par khud par bhi gussa aata tha, jisse gussa aur gehri ho jaati thi",
        ],
        insights: [
            "Use naam dena — theek karne ke liye nahi, sirf akele utha na pade isliye — kaafi tha.",
            "Gusse ke neeche jo tha woh gussa hi nahi tha. Woh dard tha jise kahin jaane ki jagah nahi mili thi.",
            "Jo mehsoos ho raha tha woh bol diya — kuch badalne ki umeed mein nahi, bas isliye ki akele rakhna zyada bhaari tha.",
            "Gussa kuch naram ko bachaane ki koshish kar raha tha. Yeh dekhte hi, sab kuch badal gaya.",
        ],
    },
    tired: {
        situations: [
            "unhe zyada kaam ki thakan nahi thi — bahut saari cheezein bahut samay se ek saath sambhaalne ki thakan thi",
            "woh khali the, par kuch girne ke dar se rok nahi paa rahe the khud ko",
            "body aaram karti, par dimaag kabhi nahi",
            "roz aate rahe, roz sambhaalte rahe — chahe andar kuch bacha ho ya nahi",
        ],
        insights: [
            "Neend ya aaraam ki baat nahi thi. Baat thi — kuch pal ke liye cheezein rakh dene ki ijazat milna.",
            "Unhone khud ko sirf ek ghante ke liye sab kuch thaamna band karne ki ijazat di. Wahi shuruat thi.",
            "Kuch badla jab unhone 'kaise chalate rahun' ki jagah 'mujhe kya chahiye' poochha.",
            "Thake hone ko maan lena — na ladna — zyada naram rasta nikla.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Bengali
// ─────────────────────────────────────────────────────────────────────────────
const BN: LangEntry = {
    framings: [
        "Ekjon ekbaar aamake bolechhilo —",
        "Kichhudin aaage ekjon ekta kotha boleche je amar manay rye gechhe:",
        "Ami onek manushke ei path die jayte dekhechi. Taader ekjon ekbaar emon boleche —",
        "Ekta kotha ache je ami akhono bhuli ni —",
    ],
    sad: {
        situations: [
            "shey kichhu ekta bochhe cholchhhilo jetar naam-o janta na — ar kakhon eta itota bhaarotto hoyechhhe ta bujhte-i pareni",
            "shoradindin bairer dikke thik-i thakto, kintu bhitore dheere dheere kichhu ekta bhaari hoye uthchhhilo",
            "shey ekla thakle kadte — kaaron kharaap hoye giyechhhe bole noy, kaaron prothombar feel korar shomoy peyechhhe bole",
            "shobar kachhe sab thik-thak lagto, kintu nijeke nijee bhaarotto mone hoto je sorate paarchhhilona",
        ],
        insights: [
            "Jokhhoni shey oi betha-r ekta naam dilo, kichhu ekta shunte pawa gelo.",
            "Shey kichu thik koreni — shudhu nijeke ekta momente feel korte dilo. Shetai kafi chhilo.",
            "Nijeke ekta chhhoto sweekar — shetai kichhu ektu haafka kore dilo.",
            "Bola je 'hyan, etai ache' — shetai prothom kajer kaaj chhilo.",
        ],
    },
    anxious: {
        situations: [
            "mon baar baar ek-i loop chalchhhilo — jeta ekhono hoyni tar jonyo prepare korchhhilo",
            "shob kichhu ek shathe urgent laagchhhilo ar bujhte parche na prothome ki-te mনোযোগ debo",
            "onek thread ek shathe cholchhhilo, kono-taki nijeer hatey laagchhhilo na",
            "chhhoto chhhoto biшояও onek bhaari laagchhhilo, kono kaaran chhaara",
        ],
        insights: [
            "Je kaaj koreche ta shob solve kora noy — shudhu ekta thread dharaar.",
            "Shey nijekei jiggesh korlo: 'Eta ki ekhoni hochhhe, na amar mon rehearsal korchhe?' Oi ekta proshno shobi dheela kore dilo.",
            "Alarm-ke asol bিপদ theke alag kora — shetai kaaj dilo.",
            "Shudhu akhon ja shaamne ache shudhu shetuku dekhbaar ijazot nijeke dilo.",
        ],
    },
    angry: {
        situations: [
            "onek kkhon dhore rokhe rakhchhhilo — aar ekta chhhoto kichhu shetaa uriye dilo",
            "shob ঠিক rakhte thaklo, shob shaambhaalo — jokhhon kichhu ekta venge gelo",
            "rag ta asholei je enning hochhhilo tar jonyo chhilo na — eta purano, antorey thakaa kichhu chhilo",
            "rag aashtey nijeer upore-o rag aashto, jete rag aaro bhaari hoyee jaato",
        ],
        insights: [
            "Mukhe bola — thik korte noy, shudhu ekaake baahte na hoy bolei — asol tofarot kore dilo.",
            "Raaager niche je chhilo sheta rag chhilo na. Sheta chhhilo betha jekhane jawar jaayga chhilo na.",
            "Je laagchhhilo sheta bollo — kichhu badalabe bole noy, shudhu ekaake baahte thakaa khoob bhaari chhilo bole.",
            "Raaag kichhu naram ke bachhaachhhilo. Shetaa bujhte paarar sathe shob kichhu shoreye gelo.",
        ],
    },
    tired: {
        situations: [
            "shey beshi kaaj kore thakeni — onek kichhu onek samay dhore ek shathe shaambhaalte shaambhaalte thakeni",
            "shey khaalee chhilo, kintu kichhu pore jaabe bole thaamte paarche na",
            "sharir biShram nito, kintu mon kabhu-i noy",
            "protidin aasto, protidin shaambhaalto — bhitore kichhu thakuk aar na thakuk",
        ],
        insights: [
            "Ghumaano ba biShram er ktha chhilo na. Ktha chhilo — kichhukhaner janyo জিনিশপত্র neeme rakhaar ijazot paoa.",
            "Nijeke শুধু ek ghanter janyo shob thaamaa band rakhaar ijazot dilo. Shetai shuuru chhilo.",
            "'Kirokom chaliye jaabo' er badle 'aamar ki dorkar' jiggesh korte sharuু korle kichhu paltey gelo.",
            "Klanto hoeছি mene neoa — laRai na kora — sheta thhikata pothe ber kore dilo.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Marathi
// ─────────────────────────────────────────────────────────────────────────────
const MR: LangEntry = {
    framings: [
        "Ekda kunaatari mala sangitle —",
        "Kahi diwsaanpurvi ek mansane ase kahi sangitle je abhi paryant aathavte:",
        "Maine lokanna yaatuun jaatana pahile aahe. Ek jana ne te asa varnayle —",
        "Ek sanvad aahe jo mala aajun aathavto —",
    ],
    sad: {
        situations: [
            "te kahi tari vahat hote je tyanna naav deta yet nahi — ani te kiti bhaari zale te samajlech nahi",
            "dinabhar baher sab theek disat hote, pan aatun kahi tari dhire dhire jad hoye jaat hote",
            "te ekate aslya war radlet — karan gosht kharaab zali mhanun nahi, tar karan pahilyanda feel karnyacha vel milala",
            "dusryansathi sab theek hote, pan ektya vel ek bojh hota jo sutena",
        ],
        insights: [
            "Jya ghadi tyanni tyala naav dile, kahi tari nishchal zale.",
            "Tyanni kahi theek kele nahi — fakt ek pal swata la feel karu dile. Tevdhe puresar hote.",
            "Ek chhhoti si manun ghene — tyach goshtine kahi thoda halke zale.",
            "He aahe he manun ghene — hach pehla khari useful step hota.",
        ],
    },
    anxious: {
        situations: [
            "man baar baar teyach goshtincha loop chalvat hote — jo aadhi zale-ch navhate tyasathi",
            "sab kahi ek velela urgent watle ani konti gosht aadhi pahaychi te samjat navhate",
            "khup threads ek velela chalat hote, ani tyatla ekahi tyanchya hat mein nahi watte",
            "chhhoti gosht pann khup jad watle, konatya khaas karanashivay",
        ],
        insights: [
            "Kaam aale ek goshticha — ek single thread dharanyacha. Sab kahi solve karne garejeche navhate.",
            "Tyanni swatala vicharla: 'He abhi hoaay aahe ka, ki mazha man kaay hoil ache rehearsal karto aahe?' Tya eka prashnaane sab kahi dhile zale.",
            "Alarm la asalya dhokyapasun vegale karne — tevdhyach kaami aale.",
            "Fakt jo samor hote tyachach vichaarat karaychi ijazat swatala dili.",
        ],
    },
    angry: {
        situations: [
            "te khup vel rok dharon bsale hote — ani eka chhhota gosht ne sab kahi tiplun takale",
            "sab shant thevle, sab sambhalle — joparyant kahi krachin zale",
            "raaag ashlya goshticha navhata jo aata zala — to kahi juna, aatla hote",
            "raaag aalyavar swatavarchahee raag yeto, jyane raag aajun jad hoto",
        ],
        insights: [
            "Tyacha naav ghene — theek karnya karita nahi, fakt ekate na bhalane mhanun — farkacha tharla.",
            "Raagachya khali jo hote te raag navhate. Te dukh hote jyala jaychi jagach navhati.",
            "Jo watte te bolun takle — kahi badlail mhanun nahi, fakt ekate uthavne jad hote mhanun.",
            "Raag kahi narm surakshit karnya saathi hota. He samajle ki sab kahi badlayle.",
        ],
    },
    tired: {
        situations: [
            "tyanna zyaast kaamachee thakan navhati — khup kahi khup vel ek velela sambalaychi thakan hoti",
            "te rikame hote, pan kahi padel mhanun thambta yet navhte",
            "sharir aaraam karat hote, pan man kabhi nahi",
            "rozroj yete raahile, sambhalte raahile — aatun kahi uralay ki nahi te pahun",
        ],
        insights: [
            "Zop kinva aaramachi gosht navhati. Gosht hoti — kaahi vel sab khai thevaaychi anumati milane.",
            "Tyanni swatala fakt ek taasasathi sab kahi thambayla parvanagi dili. Techi suruvaat hoti.",
            "'Kase chaalavanaar' yachya aivaaji 'mala nakhi kaay' vicharale tevha kahi badalayle.",
            "Thaklelyo manane ghene — na ladhane — zyaast narm wata nikala.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Gujarati
// ─────────────────────────────────────────────────────────────────────────────
const GU: LangEntry = {
    framings: [
        "Ekwar kuniek mane kahyu —",
        "Kuch samay pahela ek janaiye kuch evi vaat kahi je yaad rahi gai:",
        "Maine logone aanthi pasaar thataa joyaa chhe. Ekaiye te kuch yun varnavyu —",
        "Ek vaat chhe jo mane abhi pan yaad chhe —",
    ],
    sad: {
        situations: [
            "te kuch uthavi rahyaa hataa jeenu naam ne-i jaantaa — ane te kyaare itnu bhaari thayun te samajyuu ne-i",
            "divas bhar baaharthi sab theek lagtuu hatu, pan andarathi kuch dhire dhire bhaari thatu hatuu",
            "te ekala hataa tyaare radyaa — kaaran badhu kharaab thayun bole nahi, kaaran peheli baar feel karvaano samay aavyo bole",
            "baakina maate sab theek hatu, pan aatmaa maate ek bojh hatu je hattu ne-i",
        ],
        insights: [
            "Je ghade tene naam aapu, kuch halku thayuu.",
            "Tene kuch theek na karyu — faqt ek pal khud ne feel karva deedhu. Evu-j purtu hatu.",
            "Ek chhhotu maani levuu — tene j kuch thoda halku kari deedhu.",
            "Aa chhe ne manvi levuu — e j pahelu khari kaam nu kaadam hatu.",
        ],
    },
    anxious: {
        situations: [
            "man baar baar e-j loop chalavatu hatu — je abhi thayuu ne-i tena maate",
            "sab kuch ek sathe urgent lagtuu hatu ane samjhatuu ne-i ke pahela shu dhyan rakhvu",
            "ghannaa threads ek sathe chalata hataa, ane koi-e tenaa haath mein lagtuu ne-i",
            "naani vaat pann khub bhaari lagti hati, koi khaas kaaran vagarr",
        ],
        insights: [
            "Kaam aavyu ek j vastu — ek single thread pakadvaano. Badhu solve karvu zaroori ne-i hatu.",
            "Tene potaane j poochyu: 'Aa abhi thayi rahyu chhe ke, maro man shu thashe tenu rehearsal kare chhe?' Ae ek prashne badhu dheelu kari deedhu.",
            "Alarm ne asali khatare thi alag karvuu — ae j kaam aavyu.",
            "Faqt jo samksh hatu tenu-j dhyan rakhvani ijazat potaane aapi.",
        ],
    },
    angry: {
        situations: [
            "te ghannaa samay thi rokine besthaa hataa — ane ek naani vaat e sab tiplavi deedhu",
            "sab shaant rakhyu, sab sambhaalyu — jaare kuch atak-e-atak thayuu",
            "gusse aa vaat maate ne-i hato jo abhi thayuu — e kuch junu, andar nu hatu",
            "gusse aavtaa potaa par pan gusse aavto, jethee gusse aur bhaari thato",
        ],
        insights: [
            "Tenu naam levuu — theek karva maate nahi, faqt akela na uthavvaa maate — farkaanu padyu.",
            "Gusse ni neeche jo hatu te gusse ne-i hatu. Te dard hatu jene jaavaa ni jagah ne-i hati.",
            "Jo lagtu hatu te boli deedhu — kuch badalashe mani ne nahi, faqt aeklu uthavvuu vadhare bhaaru hatu bole.",
            "Gusse kuch narma ne bachavatu hatu. Aa joyaa thi sab kuch badlayi gayu.",
        ],
    },
    tired: {
        situations: [
            "tene zyaada kaam ni thakan ne-i hati — ghannaa kahu ghannaa samay thi ek saath sambhaalvaa ni thakan hati",
            "te khaali hata, pan kuch padi jashe ni dare atakta ne-i hata",
            "sharir aaraam karto, pan man kabhi nahi",
            "roj aavtaa rahyaa, roj sambhaaltu rahyaa — andar kuch bachyu hoy ke nahi",
        ],
        insights: [
            "Undi ke aaraam ni vaat ne-i hati. Vaat hati — thodi vaar maate cheezein muki devaani ijazat malavii.",
            "Tene potaane faqt ek kaak maate sab kuch thamvaani parvanagi aapi. Aa-j shuruaat hati.",
            "'Kaise chalii shakuu' ni jagaaye 'mane shu joi-e' poochyu tyaare kuch badalyuu.",
            "Thakela hovanu maani levuu — na ladhvuu — vaddhu narmu rasto niklyo.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Punjabi
// ─────────────────────────────────────────────────────────────────────────────
const PA: LangEntry = {
    framings: [
        "Ikware kinne mujhe dassia —",
        "Kuch samay pehlan ik bande ne kuch aehi gall kahi jo yaad rahi gayi:",
        "Maine lokaan nu isson lukhan laangda vekhya hai. Ikware kinne ise kuch yon darsa-ia —",
        "Ik gall hai jo mujhe abhi vi yaad hai —",
    ],
    sad: {
        situations: [
            "oh kuch aisa chuk raha si jisda naam nahi jaanda si — te pata hi nahi chalda ki oh kinna bhaari ho gaya si",
            "saara din baaharon sab theek lagda si, par andar kuch dhire dhire bhaari hunda jaa raha si",
            "oh akele hunde ronde si — isliye nahi ki sab kuch aur kharaab ho gaya, balki isliye ki pehli baar feel karan da samaa milia",
            "doojean layi sab theek si, par apne aap layi ik bojh si jo hutta hi nahi si",
        ],
        insights: [
            "Jis pal unne uska naam rakkhya, kuch halka hoya.",
            "Unne kuch theek nahi kita — faqt ik pal khud nu feel karan ditta. Aehi kaafi si.",
            "Ik chhhoti ji mannti — usi ne hi kuch thoda halka kar ditta.",
            "Eh mannna ki eh hai — aehi pehla asli kadam si.",
        ],
    },
    anxious: {
        situations: [
            "dimaag baar baar ohee loop chala raha si — jo abhi hoya hi nahi si uslai layi",
            "sab kuch ik saath urgent lagda si te samajh nahi aa raha si pehlan kee dhyan deyni hai",
            "kaafi saari cheezaan ik saath chal rahi si te koi-vi unhe haath wich nahi laggdi si",
            "chhhoti gall vi bahut bhaari lagdi si, kisi khaas wajah bina",
        ],
        insights: [
            "Kaam aaya ik hi gall — ik single thread pakadna. Sab kuch solve karna zaroori nahi si.",
            "Unne khud nu poochha: 'Kya eh abhi ho raha hai, ya mera dimaag sochda hai kya ho sakda hai?' Uss sawaal ne sab kuch dheela kar ditta.",
            "Alarm nu asali khatre ton alag karna — aehi kaami aaya.",
            "Faqt jo samne si usi da hi dhyan rakhhan di ijazat khud nu ditti.",
        ],
    },
    angry: {
        situations: [
            "oh kaafi chiranjoivi rok ke baithe si — te ik chhhoti gall ne sab kuch tulaa ditta",
            "sab theek rakkhya, sab sambhaalya — jado tak kuch tootta nahi",
            "gussa us gall da nahi si jo abhi hoya si — eh kuch purana, andarla si",
            "gussa aunda te khud te vi gussa aanda, jisde naal gussa aur bhaari ho jaanda si",
        ],
        insights: [
            "Usda naam lena — theek karan layi nahi, faqt akele na uthaan layi — faraak paya.",
            "Gusse de neeche jo si oh gussa nahi si. Oh dukh si jisnu jaavan di jagah nahi si.",
            "Jo laggda si oh bolia ditta — kuch badlaan di umeed wich nahi, faqt isliye ki ikalle rakhna bhaara si.",
            "Gussa kuch naram nu bachaan di koshish kar raha si. Eh dekhde hi sab kuch badal gaya.",
        ],
    },
    tired: {
        situations: [
            "unhe zyada kaam di thakaan nahi si — kaafi saari cheezaan kaafi chiranjoivi ik saath sambhaalte rehne di thakaan si",
            "oh khaali si, par kuch deya girkaan di dar ton roke nahi si",
            "sharir aaram karda si, par dimaag kabhi nahi",
            "roz aande rahe, roz sambhaalte rahe — andar kuch bacha hove ya nahi",
        ],
        insights: [
            "Neend ya aaram di gall nahi si. Gall si — kuch pal layi cheezaan rakh devan di ijazat milni.",
            "Unne khud nu faqt ik ghante layi sab kuch thaamna band karan di ijazat ditti. Aaehi shuruat si.",
            "'Kiwein challda rehan' di jagah 'mujhe ki chahida' poochheya ta kuch badal giya.",
            "Thakke hone nu manni lena — na ladna — zyada naram raasta niklia.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tamil (romanized)
// ─────────────────────────────────────────────────────────────────────────────
const TA: LangEntry = {
    framings: [
        "Oruvar oru naal soninaanga —",
        "Kochcha neram munnadi, oruvar oru katha solnaanga, adhu inna nenaivula irukku:",
        "Nan oruvalai indha vazhilaye paathurukkein. Avanga idha ippadi varnavichhaanga —",
        "Oru conversation irukku, adhu innumm nenaivula irukkku —",
    ],
    sad: {
        situations: [
            "avanga enna carry panraangaanu theriyaama carry pannaanga — enna neram idhu ivvalavu weight aachunu theriyalaanga",
            "naal muzhuthum velila paakka sari aa irundhum, ullaye kochcha kochcha something bhaara aagikitte irundhidhu",
            "avanga oru naal ekka irundhappo kanda — things worse aachunu alla, mudhal oru thadavai feel panna time kidaichadhu ada",
            "ellarukkum sari aa thoandu, aana thanha irukkaappo bayangara drag aagira maadiri irundhidhu",
        ],
        insights: [
            "Avanga idha oru peyar sollidapoodu, kochcha kochcha tharaladhu.",
            "Avanga enna theek pannala — ore oru nimidam feel panna vittaanga. Adhu mattum podhum.",
            "Ore oru chinna awareness — adhuve kochchu halka aachunu vaichu.",
            "Idhu irukku nu accept pannidhu — adhudhaan udhavaana mudhal step.",
        ],
    },
    anxious: {
        situations: [
            "manasu eppovum same loop odudhunu — nda aagalai nda vishayathukku",
            "ellame oru naerathula urgent aa thoandu, entha vishayathukku mudhal dhyaanam kunrenunu theriyalaanga",
            "romba threads ek naramum nadudhunu, edhuvum kai-la irukkunu thoandalaanga",
            "chinna decision kooda romba weight-aa laagidhu, enna kaaranam endru theriyala",
        ],
        insights: [
            "Helpful anadhu ennanu solvadhu alla — ore oru thread pidipadhudhaan.",
            "Avanga ketta: 'Idhu ippo nadakudha, illai en manasu rehearsal panudha?' Adhe oru kelvi mellam aachunu.",
            "Alarm-aa irukkadhai actual danger-aa irukkadhai pirichu paakkaradhu — adhuve maaththam.",
            "Ippo samne irukkadhu maattum paakka mattum thannekku anumadhi kudutthaanga.",
        ],
    },
    angry: {
        situations: [
            "avanga romba neram vachhukondu irundhanga — oru chinna vishayam adhai tiluppi vittidhu",
            "ellame controlled vaichhaanga, ellame sarakku poda — onnu crack aagum varei",
            "kopamaana ippo nadandhathukku alla — adhu palaadhu, ullae irundhadu",
            "kopam vaandha thannakku kooda kopam varum, adhanaal kopam koottam aagum",
        ],
        insights: [
            "Avanga peyar sollividhaanga — theek panra mattu alla, thanhaa thookkaama irukkadhu maattu — adhu difference panna.",
            "Kopamathin keezhula irunnadhu kopame alla. Pohramadum idam il·laadha thollai.",
            "Laagidhadha sollitta — ennalum maraikka mattan, thanhaa kaakkaadhu heavy-aa irundhathaal.",
            "Kopam kochcha soft-aa irukkadhai thaankittu irundhidhu. Adhai paaradhum ellame kochcha shift aagidhu.",
        ],
    },
    tired: {
        situations: [
            "avanga romba kaariyam seidhu thungadhilla — romba vishayam romba neram pidichu vachhu thungadhilla",
            "avanga empty-aa irundhanga, aana ennalum vizhundhidume-nu peyi thadutthu niruththadhilla",
            "udambu rest pannum, aana manasu eppovume alla",
            "naal naal varaanga, naal naal sambhaallaanga — ullae onnum irukkadhu illandaalum",
        ],
        insights: [
            "Thookam illai, resthaan. Vishayam indhidhu — kochcha nerathukku edhaiyadhu kazhathukku anumadhi kidaikkaradhu.",
            "Thannekku ore oru mani nerathukku ellame thaangaadhu niruththa anumadhi kudutthaanga. Adhudhaan thudakkam.",
            "'Eppadi thodarlaanga' nnnu ketkaadha, 'enakku enna venum' nnnu ketta — onnu marainju.",
            "Thungipponathai accept pannidhu — paadhukkaadha — adhu gentle-aa irundhadu.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Telugu (romanized)
// ─────────────────────────────────────────────────────────────────────────────
const TE: LangEntry = {
    framings: [
        "Okaru naku chepparu —",
        "Kochcha rojula mundu, okaru oka vishayam chepparu, adhi naaku ippatti ki gurunga undi:",
        "Naanu chaalaa mandini idi experience cheyyadam chooshaanu. Okarini idi ippadi annaru —",
        "Oka conversation undi, adhi naaku ippattiki gurunga undi —",
    ],
    sad: {
        situations: [
            "vaLLu enti carry chestunnaro teliyadanidi carry chestunnaru — idi enta heavy ayyindho kuda teliyadam ledu",
            "roju baita chooste sare ga undi, kaani lopo emi dheetaga bhaaranga perigipotundi",
            "vaLLu okkaruga unnapudu edustunnaru — things worse ayyayi ante kaadu, modatisaari feel cheyyataniki samayam dorikindi ante",
            "andarikeena sare ga anipinchindi, kaani okkaru undi ante bhaaranga anipistundi",
        ],
        insights: [
            "Vaallaki daniki peru pedinadapudu, kochcha naimetam aindi.",
            "Vaallaki emi solve cheyyaledu — ore oka nimisham feel cheyyataniki vyavadhi ichhaaru. Adhi saripoyindi.",
            "Ore okka chinna accept chessukovadam — adhe kochcha halvaa ayyindi.",
            "Idi unnadi ani accept cheyyatam — adhe nijamaina modati adugamu.",
        ],
    },
    anxious: {
        situations: [
            "manas appudu ippudu same loop loni odutundi — jarigipoyinadaniki prepare avutundi",
            "anni okkaesaari urgent ga anipinchindi, entha vishayam ki mundhu dirghanochhinchi ardham kaaledu",
            "chaalee threads okkaesaari naduputhunnayi, evarikaina vaalla chethulo unnayani anipiyyadam ledu",
            "chinna decisions kooda chaalaa bhaaranga anipinchindi, karana artha kaaledu",
        ],
        insights: [
            "Useful aindhi okate — ore okka thread matram pattukodaaniki. Anni solve cheyyatam avasaram ledu.",
            "Vaallaki oka prashna: 'Idi ippudu jarugatundaa, leda naanu jarugedanidaniki prepare avutunnaanaa?' Oka prashna anni mellaga ayyindi.",
            "Alarm ni nijam ga jarigindi anavataniki birdigistham — adhe maarupunu teesindi.",
            "Ippudu samne unnadi maatrame choodataniki tammakku anumati ichhaaru.",
        ],
    },
    angry: {
        situations: [
            "vaLLu chaalaa kaalam rokipetti unnaaru — oka chinna vishayam anni tuluchindi",
            "anni shanti ga pettukunnaaru, anni handle chessukunnaaru — okati crack ayyevaraku",
            "kopam abhi jarigindi daniki kaadu — adhi pata, lopala unna emi",
            "kopam vasthe tammameeda kooda kopam vasthundi, jedavalli kopam inchuka bhaaragaa avutundi",
        ],
        insights: [
            "Peru pedinadapudu — solve cheyyatam anukune kaadu, okkadiga baaravvakunda unnadinuki — nijamaina farku chesindi.",
            "Kopam lopo unnadhi kopam kaadu. Adi poleyataniki chotu lekunda baadhagaa unna.",
            "Anipinchindi ante — emi maarutundi ani kadu, okkadiga baaravvataniki load avutundi ante cheppaaaru.",
            "Kopam kochcha soft daaninni kaapaaduthundi. Adhi choosinadapudu emi shift ayyindi.",
        ],
    },
    tired: {
        situations: [
            "vaLLaki chaalaa pani chesi aakali anipinchaledu — chaalaa vishayaalu chaalaa kaalam okkaesaari pattukuni unchukovadam valla aakali anipinchindi",
            "vaLLu empty ga undaaru, kaani emi padi vastundani bhayamtho aapukoleekapoyyaaru",
            "sharir vistraantu chestundi, kaani manas eppudu kaadu",
            "roju vasthunnaaru, roju sambaalukskunnaaru — lopa emi unna kapoina",
        ],
        insights: [
            "Nidra leda vistranti kaadu. Vishayam — kochcha samayam paaatu vaatini padipovadam anumati ivvataniki.",
            "Tammaku ore oka gunte maatram anni thammaapettataniki anumati ichhaaru. Adhe mahodayam.",
            "'Ela continue avvadam' kaadu, 'naaku enti kaavaali' ani adigite — emi marchipoyindi.",
            "Aakali undanidi aaginkovadam — daanitho poraadadam kaadu — adi gentle ga anipinchindi.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Kannada (romanized)
// ─────────────────────────────────────────────────────────────────────────────
const KN: LangEntry = {
    framings: [
        "Obbaru nange heltaaru —",
        "Konjam hinde, obbaru ondu vishaya heltaru, adhu inna nanna manassalli ide:",
        "Naanu janaranu idara madhye hogaduvannu noodideene. Obbaru idannu heegte varnisutt —",
        "Ondu matukatha ide, adhu inna nanna nenapalli ide —",
    ],
    sad: {
        situations: [
            "avaru enyanu hotti hogi iddeero anta teeyalla hotti iddaaru — idu yaavaaga ivvallu bhaara aayitu anta gottage aagalilla",
            "dina muzhuvanu horthat nodidare sari ide anta ondu, kaana loplloo elli dheettu bhaara peraguttaa hoytu",
            "avaru ekkaragi iddaaga kaandaaru — ella kelage hoyitu anta alla, mudalu saari feel maaduvudu sadhyavaagutte anta time sikiitu anta",
            "ullinirigoo sari ide anta ondu, aadare obbaru iruvaagle tumba bhaara anisuttide anta",
        ],
        insights: [
            "Avaru adaruvu hesaru idaaga, kochchu aaddu aayitu.",
            "Avaru ella theek maadle alla — ore ondu nimisha feel maadisikondaru. Adhu saalade.",
            "Ore ondu chikka sweekarisi koLLuvaadhu — adhuva kochchu halka aayitu.",
            "Idu ide anta mannikkoLLodu — adhuva nijavaada modala hejje aayitu.",
        ],
    },
    anxious: {
        situations: [
            "manassu baar baar same loop oaduttu hoytu — aaagilla vishayakku ready aaguttu",
            "ella okkaesaari urgent anta ondu, yaava vishayakku mundhe dodhugu anta arthamaagle",
            "tumba threads okkaesaari naaduttu hoytu, yaavudu tamaage ide anta anisalilla",
            "chikka vishayavuu tumba bhaara anistide, yaake anta gottaagadu",
        ],
        insights: [
            "Upayoga aadadu ondate — ore ondu thread hidiyodu. Ella solve maadodu avasara iralilla.",
            "Avaru keTTaru: 'Idu ippudu aaguttideya, illadre naanu rehearsal maaduttideena?' Aa ondu prashne ella dheela maaditu.",
            "Alarm antu nijavaada aapade aaguttide antu, ondu bittale bere maadodu — adhe kaajake banditu.",
            "Ippudu samne iruvaduva maatrana nodikkoLLabeka anta tammage anumati koDtaaru.",
        ],
    },
    angry: {
        situations: [
            "avaru tumba kaala tokkoNdiddaaru — ondu chikka vishaya ella tiLisitu",
            "ella shaantagiddaru, ella sambaaliddaru — ondu crack aaguvavarei",
            "kopa ippudu aadadu vishayakku iralilla — adhu junu, loplloo iruva enu",
            "kopa band aagutta tammaguu kopa banthu, adharinda kopa innu bhaara aayitu",
        ],
        insights: [
            "Adara hesaru heLuvaadu — theek maadakke alla, obbane hotti hoga bedakendu — nijavaada faraka maaditu.",
            "Kopaada adaaLada iruvaadhu kopa iralilla. Adhu novu, yaavude jaagalillaada.",
            "Anistide anta heLidru — enu bahaladhaagi alla, obbane hotti hogadu tumba bhaara aayitu anta.",
            "Kopa yaavanno soft-anaannu kaapaadutha hoytu. Adha nodidaaga ella shift aayitu.",
        ],
    },
    tired: {
        situations: [
            "avaruge tumba kaadda thakavaga iralilla — tumba vishayavannu tumba kaala okkaesaari hotti hoguttaa thakavagitta",
            "avaru khaali iddaaru, aadare enu biduttutte anta bhayaavinda tokkoNda niLLalilla",
            "sharir aaaraamgottitu, aadare manassu yaaavaagallu alla",
            "pratidinav bantaaru, pratidinav sambaaLidaaru — loplloo enu uLidhu anta",
        ],
        insights: [
            "Nidde leda aaraama alla. Vishaya — konjam hotte vishayaannu heeLoo beku anta anumati sigguvudu.",
            "Tammage ore ondu gante maatra ella thammeL beda anta anumati koDtaru. Adhuva shuruvaaGu.",
            "'Heegte hogobardu' allade 'naage yeNu bekku' keLidaaga — enu bahaladhaagitu.",
            "Thakavaagi iroNu anta manikoLLodu — hOradadu alla — adhu gentle maarga aayitu.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Malayalam (romanized)
// ─────────────────────────────────────────────────────────────────────────────
const ML: LangEntry = {
    framings: [
        "Orukkaarannu ennodu parayuka cheydhu —",
        "Kochcha kaalam mundhe, orukkaarannu oru vishayam parayuka cheydhu, adhu ippozhu kayyil irikkunnundu:",
        "Naanu orupadhu peeple idha kandu, orukkaarannu idha ippadi varnichu —",
        "Oru samsaaraM undi, adhu ente manasil ippozhuM irikkunnundu —",
    ],
    sad: {
        situations: [
            "avaru ento carry cheythu kondu pokkunnu, athu entaane ennaariyathe — idi enthu neram ithrathu bhaaramayi ennaariyathe",
            "dina muzhuvanum nannaayi kannum, kaani ullil oru bhaaram meelle meelle koodivarunnu",
            "avaru oru naal thaniyaayi irinnappol karayuka cheydhu — kaaryangal maaree analla, adyamaayit feel cheyyuvaan samayam kittiyadhu kondu",
            "ellaavarkkum sari aanu ennappol, kaani thaniyaayi irinnappol oru bhaaram konduvarikaanaagathu",
        ],
        insights: [
            "Avaradu adinu oru peru ittu koeradhu, kochchu tharaladhu.",
            "Avaru oru kaaryavum theek cheyyile — ore oka nimisham feel cheyyaan avasaramundi kodukathu. Athu mathi.",
            "Ore okka chinna awaaratham — adhu mathi halvaa aakkuvaan.",
            "Idi undu enn manassilaakunathu — adhe nijammaaya modal adugaanu.",
        ],
    },
    anxious: {
        situations: [
            "manassu baar baar same loop oadunnu — aakaatha vishayathinayi prepare cheyyunnu",
            "ella oru naerthinnu urgent aayum, enthu vishayathinayi mundhe dhyaanam kondu pokaanum ariyathe",
            "nereyya threads okkaesaari nadakunnu, evaraana tammil undenn anipiyye",
            "chinna kaaryavum valare bhaaramayi thonnunnu, kaaran ariyunnille",
        ],
        insights: [
            "Upakaaramayadhu okkaate — ore okka thread pidinnathu. Ella solve cheyyaanum avasaryamillathu.",
            "Avaru chodyichu: 'Idi ippol aakunnathinaa, ente manassu rehearsal cheyyukayinoo?' Aa oru chodyam ella dheelakki.",
            "Alarm nn nijammaaya aapathil ninnu maarikkani nokkunnathu — adhe prayojanamayadhu.",
            "Ippol samne irikkunnath maatrame kaanavaan tammekku anumati koDthu.",
        ],
    },
    angry: {
        situations: [
            "avaru valare neram thadanjhu irunnhu — oru chinna kaaryam ella thiruppi vitthu",
            "ella shanthiyaayi vachchu, ella sambhaaliyaai — oru crack aagumvarei",
            "kopam ippol jarichathinnay allathu — adhu palaadhu, ulpolm irunnath",
            "kopam vandhu thaanu kku kooda kopam varum, adhinaal kopam koottam aakum",
        ],
        insights: [
            "Adinu peru paranjathu — theek cheyyaan alla, thaniyaayi kaanaama irikkaan — nijammaaya vethyaasam undakkhi.",
            "Kopathin ullile iru nnath kopam allathu. Adhu dukham aanu, pookuvaan idam illaathathu.",
            "Anippichu ennath paranjhu — engilum maaratti keeraadhu, thaniyaayi vaahinji thaakatham aayathinaal.",
            "Kopam oru narm dhipadambhathe kaakunnundaayirunnu. Adhu kandathu, ella tharakku maarji.",
        ],
    },
    tired: {
        situations: [
            "avarku koottam kaaryam cheythu thakarchha illathu — koottam kaaryangal koottam neram okkaesaari sambhaalicchu kondirunnathinal thakarchha undu",
            "avaru khaali aannu, kaani oru kaaryam vizhu umbol enna ennoru bhayathal niruththaan kazhiyunne illathu",
            "sharir vishrami kkunnu, kaani manassu eppozhuM kaanu",
            "prati dinaM vaarunnu, prati dinaM sambhaalikkunnu — ullil enu undenna",
        ],
        insights: [
            "Uranguvath allathu vistraanti. Vishayam — oru chil naeratthinnu kaaryangal veekki vaikkaanulla anumati kittanam.",
            "Tammekku ore okka manikku ella thammaapikkaanulla anumati koDthu. Adhe thudakkam.",
            "'Eppadi thudararnam' enkil alla, 'naakk enthanu vendum' chodyichu appol — enu maarji.",
            "Thakarchha manasilaakkunathu — pori kottaathe — adhu moLLiyaaya vazhiyaanu.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Odia (romanized)
// ─────────────────────────────────────────────────────────────────────────────
const OR: LangEntry = {
    framings: [
        "Ekajana mote kahila —",
        "Kichhi samay agaru, ekajana eka kotha kahila je ebe bi mana re ache:",
        "Mun onek manankuu ita pathare jaibaa dekhichhi. Ekajana eitaaku eman varnaila —",
        "Eka galpa ache je mote ebe bi mana pade —",
    ],
    sad: {
        situations: [
            "se kichhi bahi chaluchhhila jete naama de-i pare nahi — ebe kete bhari hoiyachhhi ta bujhipare nahi",
            "saara dina baahare theek laaguchhhila, kintu bhitare kichhu dhire dhire bhaari hoite thhila",
            "se ekela thile kaaindila — sabu kharaab hoila karana nahi, prothom baar feel karibara samaya milila karana",
            "sabanka paain theek thhila, kintu ekela thile eka bojh thhila je hatibaa jane nahi thhila",
        ],
        insights: [
            "Jebe se taahe naam dila, kichhu thaada hoila.",
            "Se kichu theek karila nahi — gotaa nimisha feel karibaa dila nijaku. Seta-i pari thhila.",
            "Gotaa chhota sweekar — seta-i kichhu thaada karila.",
            "Eta ache boli manibaa — seta-i satya kaar prothom kadam thhila.",
        ],
    },
    anxious: {
        situations: [
            "mana baar baar same loop chaluchhhila — hoi nathiba kahinee paain",
            "sab kichhu eka samare urgent laaguchhhila aar prothome kuhire dhyan debaaku bujhipare nahi",
            "onek thread eka sathe chaluchhhila aar koita taahe hatha re achi boli laaguchhhi naahi",
            "chhhota kaaj bhi khoob bhari laaguchhhila, kana karana nahi bole bujhipare naahi",
        ],
        insights: [
            "Kaajire aaila gotaa katha — gotaa thread dharaibaa. Sab solve karibaa lagibaa nahi.",
            "Se nija ku puchhhila: 'Eta ebe hoichhi ki, mun kahin hoye jaibaa kahinee practice karuchhhhi?' Se prashna sab shante karila.",
            "Alarm ku asali biplaba ru alag karaa — seta-i kaajire aaila.",
            "Ebe saamne thhiba kahinee maatra dekhibaakuu nijaku anumati dila.",
        ],
    },
    angry: {
        situations: [
            "se khubi samay dhori rokhibaa thile — eka chhota baat sab tiplibaa dila",
            "sab shaant rakhile, sab sambhaalile — jabe tak kichhu tuta nahi",
            "raaag ebe hoi thiba kaahinee nahi thhila — ta purana, bhitare thhiba kichhu",
            "raaag aasile nija upare bhi raaag aasuthila, jahi raaag aaru bhari kari dithila",
        ],
        insights: [
            "Taahe naam deba — theek karibaa kahinee nahi, faqt ekala na bhabaa kahinee — satya pharak karila.",
            "Raagara bhitare thhiba seta raaag nahi thila. Se dukha thhila jenaku jaibaa jagah nahi thila.",
            "Jo laaguchhhila ta kahi dila — kichhi badalaibaa pratikhsyaa re nahi, faqt ekala bahiba bhari thhila karana.",
            "Raaag kichhi naram ke bachhaibaa koshish karuchhhila. Eta bujhibaa mattre sab badali gala.",
        ],
    },
    tired: {
        situations: [
            "se adhika kaamara thakaa nahi thila — onek kichhu onek samay dhori eka sathe sambhaalibaa thakaa thhila",
            "se khaali thhila, kintu kichhu paribaare bhayare roki para nahi thila",
            "sharir aaraam kare thila, kintu mana kabhi nahi",
            "pratidin aasuthile, pratidin sambhaaluthile — bhitare kichhu achhi ki naahi",
        ],
        insights: [
            "Ghuma ba aaraam nahi. Kotha thila — kichhu samay paain sambaalpi rakhibaa anumati maLaibaa.",
            "Nija ku faqt eka ghantaa paain sab thambaibaa anumati dila. Seta-i shuruaat thhila.",
            "'Kebe chalibaa' puchhhibaa chhari 'mora ki darkaar' puchhile, kichhi badalaila.",
            "Thakaa achi boli mani nibaa — na ladhaa — seta komal rasta nikila.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Urdu (Roman script)
// ─────────────────────────────────────────────────────────────────────────────
const UR: LangEntry = {
    framings: [
        "Kisi ne mujhe ek baar bataya —",
        "Kuch waqt pehle, kisi ne kuch aisa kaha jo mere zehan mein reh gaya:",
        "Maine logo ko aise haalaat se guzarte dekha hai. Ek ne aise bayan kiya —",
        "Ek baat-cheet hai jo mujhe abhi bhi yaad hai —",
    ],
    sad: {
        situations: [
            "woh kuch aisa uthaye chal rahe the jiska naam bhi nahi jaante the — kab itna bhaari ho gaya, pata hi nahi chala",
            "din bhar sab ke liye haazir rahe, lekin andar se kuch khamooshi se bhaari hota ja raha tha",
            "akele the to ro pade — haalaat bure nahi hue the, bas itna tha ke mehsoos karne ka waqt mila",
            "baahir se sab theek lagta tha, lekin andar se khud ko sambhale hue the",
        ],
        insights: [
            "Jab unhone usse naam diya, toh kuch dheela pada.",
            "Koi hal nahi dhundna tha — bas ek pal mehsoos karne ki izazat di. Wahi kaafi tha.",
            "Ek choti si qubooliyat — wahi thoda halka kar gayi.",
            "Jo hai use maan lena — wahi pehla asli qadam tha.",
        ],
    },
    anxious: {
        situations: [
            "zehan baar baar wohi sochta rehta — us cheez ki tayyari kar raha tha jo abhi toh aayi nahi",
            "sab kuch ek saath zaroori lagne laga, kisi bhi ek cheez ko pehle rakhna mushkil tha",
            "kaafi silsilay ek saath chal rahe the, kisi ko bhi khatam nahi kar pa rahe the",
            "choti si baat bhi bhaari lagti thi, wajah samajh nahi aati thi",
        ],
        insights: [
            "Kaam aaya ek cheez — bas ek silsila pakadna. Sab hal karna zaroori nahi.",
            "Unhone khud se poocha: 'Kya ye abhi ho raha hai, ya main sirf dar raha hoon?' Ek sawaal ne sab kuch thoda aasaan kar diya.",
            "Alarm ko sachchi baat maanna — wahi badlaav laya.",
            "Bas abhi jo saamne hai, wahi dekhne ki ijazat di apne aap ko.",
        ],
    },
    angry: {
        situations: [
            "kaafi dair se roka hua tha — ek chhoti si baat ne sab bahar nikaal diya",
            "sab sambhala hua tha, sab handle kiya tha — jab tak ek cheez toot gayi",
            "gussa us waqt ka nahi tha — woh purana tha, andar ka kuch",
            "gussa aaya aur apne aap par bhi gussa aaya, jo sirf bhaari ho gaya",
        ],
        insights: [
            "Naam dene se — kuch hal karna nahi tha, sirf akela nahi rehna tha — sach mein farq pada.",
            "Gusse ke andar gussa nahi tha. Woh tha jo bahar nahi nikal pa raha tha.",
            "Kehna tha — kuch nahi badlega, sirf uthaaye hue bojh se nahi — ye tha.",
            "Gusse ke andar kuch naram tha. Jab dekha, kuch badla.",
        ],
    },
    tired: {
        situations: [
            "kaafi kaam ke baad bhi thakaan mehsoos nahi hui — bohat kuch bohat dair tak ek saath sambhala tha",
            "khali the, lekin kuch gir jayega ke darr se rukna mumkin nahi tha",
            "jism aaram karta tha, lekin zehan kabhi nahi",
            "roz aate rahe, roz sambhalte rahe — andar kuch ho ya na ho",
        ],
        insights: [
            "Neend nahi, aaram tha. Baat ye thi — kuch waqt ke liye khud ko ruk jaane ki ijazat dena.",
            "Khud ko sirf ek ghante ke liye sab rokne ki ijazat di. Wahi shuruaat thi.",
            "'Kab tak chalega' nahi poocha, 'mujhe kya chahiye' poocha — kuch badal gaya.",
            "Thakaan ko maan lena — larna nahi — wahi narm rasta tha.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Chinese Simplified
// ─────────────────────────────────────────────────────────────────────────────
const ZH: LangEntry = {
    framings: [
        "曾经有人告诉我——",
        "不久前，有人分享了一件让我一直记得的事：",
        "我见过很多人经历这些。其中一个人这样描述——",
        "有一段对话，我到现在还会想起——",
    ],
    sad: {
        situations: [
            "他们一直背负着什么，却连名字都叫不出来，直到停下来才发现有多重",
            "每天照常前行，内心深处有什么悄悄变得沉重",
            "独处时哭了出来——不是因为事情变得更糟，而是终于有了一刻去感受",
            "在别人面前一切看起来都好，只有一个人的时候才感到快要撑不住",
        ],
        insights: [
            "当他们给那种感受起了个名字，有什么松动了。",
            "不需要解决什么——只是给自己一刻去感受。这就够了。",
            "一点点接纳，让一切轻了一些。",
            "承认它的存在——那才是真正的第一步。",
        ],
    },
    anxious: {
        situations: [
            "脑子不停地转着同一个圈——在为还没发生的事做准备",
            "一切突然都变得紧迫，不知道该先抓哪一件",
            "很多线索同时在脑子里跑，觉得没有一条能被拉住",
            "连小决定也觉得很重，却说不清为什么",
        ],
        insights: [
            "有用的只有一件事——只抓住一条线。不需要解决所有的。",
            "他们问了自己一个问题：「这件事现在真的在发生吗，还是我在提前担心？」一个问题让一切慢慢平静了。",
            "承认那个警报是真实的——这本身就带来了变化。",
            "让自己只看此刻眼前的事。",
        ],
    },
    angry: {
        situations: [
            "憋了很久——一件小事让一切都涌了出来",
            "什么都妥妥处理着，什么都撑着——直到有什么裂开了",
            "那股怒气不是那一刻的——那是旧的，是里面的什么",
            "愤怒来了，对自己也愤怒，只是越压越重",
        ],
        insights: [
            "说出来——不是为了解决，而是不再一个人扛——真的不一样了。",
            "愤怒里面装的不是愤怒，是没地方去的东西。",
            "不是说什么会改变，而是说出了那个重量。",
            "愤怒里有什么柔软的。看见它的时候，有什么变了。",
        ],
    },
    tired: {
        situations: [
            "做了很多却不觉得累——是太多事情太长时间同时撑着",
            "内心空了，但怕什么会倒塌，停不下来",
            "身体在休息，脑子却从来没有",
            "每天来，每天撑，不管里面有没有什么",
        ],
        insights: [
            "不是睡眠，是休息。问题在这里——允许自己一段时间内放下。",
            "他们给了自己一小时，允许一切停下来。那就是开始。",
            "不问「还能撑多久」，而是问「我需要什么」——有什么变了。",
            "承认累了——不是去对抗——那是一条温柔的路。",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Spanish
// ─────────────────────────────────────────────────────────────────────────────
const ES: LangEntry = {
    framings: [
        "Alguien me dijo una vez —",
        "Hace un tiempo, alguien compartió algo que me quedó grabado:",
        "He visto a personas pasar por esto. Una de ellas lo describió así —",
        "Hubo una conversación que aún recuerdo —",
    ],
    sad: {
        situations: [
            "cargaban con algo que no podían nombrar, y no se dieron cuenta de cuánto pesaba hasta que se detuvieron",
            "seguían su día con algo calladamente pesado adentro, estando ahí para todos mientras se arrastraban",
            "lloraron cuando estaban solos — no porque las cosas empeoraran, sino porque finalmente tuvieron un momento para sentirlo",
            "ante los demás todo parecía estar bien, pero solos sentían que apenas se sostenían",
        ],
        insights: [
            "Cuando le pusieron nombre a eso, algo se aflojó.",
            "No tenían que resolver nada — solo darse un momento para sentirlo. Con eso bastó.",
            "Una pequeña aceptación — y algo se alivió un poco.",
            "Reconocer que estaba ahí — ese fue el primer paso real.",
        ],
    },
    anxious: {
        situations: [
            "la mente daba vueltas en el mismo círculo una y otra vez — preparándose para algo que aún no había llegado",
            "de repente todo parecía urgente, sin saber qué poner primero",
            "varios hilos corrían al mismo tiempo y sentían que no podían sostener ninguno",
            "hasta las decisiones pequeñas se sentían pesadas, sin saber bien por qué",
        ],
        insights: [
            "Lo único que ayudó fue sostener solo un hilo. No había que resolverlo todo.",
            "Se hicieron una pregunta: '¿Esto está pasando ahora, o me estoy preparando para algo que quizás no pase?' Una pregunta aflojó todo un poco.",
            "Aceptar que la alarma era real — eso mismo trajo el cambio.",
            "Se dieron permiso de ver solo lo que estaba frente a ellos en ese momento.",
        ],
    },
    angry: {
        situations: [
            "habían aguantado mucho tiempo — algo pequeño sacó todo",
            "todo estaba bajo control, todo se manejaba — hasta que algo se rompió",
            "la rabia no era de ese momento — era antigua, era algo de adentro",
            "llegó el enojo, y también el enojo consigo mismos, que solo se volvía más pesado",
        ],
        insights: [
            "Nombrarlo — no para resolverlo, sino para no cargarlo solos — marcó una diferencia real.",
            "Dentro de la rabia no había rabia. Era lo que no tenía adónde ir.",
            "No era que algo fuera a cambiar — era soltar el peso que cargaban.",
            "Dentro de la rabia había algo suave. Cuando lo vieron, algo cambió.",
        ],
    },
    tired: {
        situations: [
            "habían hecho mucho y no se sentían cansados — era demasiado durante demasiado tiempo a la vez",
            "estaban vacíos, pero el miedo a que algo se cayera no los dejaba parar",
            "el cuerpo descansaba, pero la mente nunca",
            "seguían viniendo, seguían sosteniendo — hubiera o no algo adentro",
        ],
        insights: [
            "No era sueño, era descanso. El punto era ese — darse permiso de soltar algo por un rato.",
            "Se dieron una hora para parar todo. Ahí empezó.",
            "En lugar de preguntar '¿cuánto más aguanto?', preguntaron '¿qué necesito?' — algo cambió.",
            "Reconocer el cansancio — sin pelear con él — esa fue la vía suave.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Arabic
// ─────────────────────────────────────────────────────────────────────────────
const AR: LangEntry = {
    framings: [
        "قال لي شخصٌ ذات مرة —",
        "منذ فترة، شارك معي شخصٌ شيئاً لا يزال عالقاً في ذهني:",
        "رأيتُ كثيراً من الناس يمرون بهذا. وصفه أحدهم هكذا —",
        "كانت هناك محادثة لا أزال أتذكرها —",
    ],
    sad: {
        situations: [
            "كانوا يحملون شيئاً لا يعرفون له اسماً، ولم يدركوا كم ثَقُل حتى توقفوا",
            "كانوا يمضون يومهم بشيء ثقيل في الداخل بصمت، يكونون حاضرين للجميع وهم يتعبون",
            "بكوا حين كانوا وحدهم — ليس لأن الأمور ساءت، بل لأنهم وجدوا لحظة ليشعروا أخيراً",
            "أمام الآخرين كان كل شيء يبدو بخير، لكنهم حين كانوا وحدهم شعروا أنهم بالكاد يصمدون",
        ],
        insights: [
            "حين أطلقوا على ذلك الشعور اسماً، انفكّ شيء ما.",
            "لم يكن عليهم حل أي شيء — فقط أن يمنحوا أنفسهم لحظة للشعور. كفى ذلك.",
            "قبول صغير — وخفّ شيء ما قليلاً.",
            "الاعتراف بوجوده — كان ذلك الخطوة الأولى الحقيقية.",
        ],
    },
    anxious: {
        situations: [
            "كان العقل يدور في نفس الحلقة مراراً — يستعد لشيء لم يأتِ بعد",
            "بدا فجأة كل شيء عاجلاً، دون أن يعرفوا ماذا يضعون أولاً",
            "خيوط كثيرة تجري في آنٍ واحد، وشعروا أنهم لا يستطيعون الإمساك بأيٍّ منها",
            "حتى القرارات الصغيرة بدت ثقيلة، دون أن يعرفوا السبب",
        ],
        insights: [
            "ما أفاد شيئٌ واحد فقط — الإمساك بخيط واحد فقط. لم يكن عليهم حل كل شيء.",
            "سألوا أنفسهم: 'هل يحدث هذا الآن، أم أنني أستعد لشيء ربما لن يقع؟' سؤال واحد لطّف كل شيء.",
            "الاعتراف بأن الإنذار كان حقيقياً — ذلك بحد ذاته أحدث تغييراً.",
            "أذِنوا لأنفسهم برؤية ما أمامهم فقط في تلك اللحظة.",
        ],
    },
    angry: {
        situations: [
            "ظلوا يكبتون طويلاً — شيء صغير أخرج كل شيء",
            "كان كل شيء تحت السيطرة، كل شيء محتملاً — حتى انكسر شيء ما",
            "الغضب لم يكن من تلك اللحظة — كان قديماً، كان شيئاً من الداخل",
            "جاء الغضب، وجاء الغضب من أنفسهم أيضاً، وما زاد إلا ثقلاً",
        ],
        insights: [
            "تسميته — ليس لحله، بل لعدم حمله وحيدين — أحدث فارقاً حقيقياً.",
            "داخل الغضب لم يكن هناك غضب. كان ما لم يجد له مكاناً.",
            "لم يكن الأمر أن شيئاً سيتغير — بل كان إلقاء الثقل الذي كانوا يحملونه.",
            "كان داخل الغضب شيء ناعم. حين رأوه، تغيّر شيء ما.",
        ],
    },
    tired: {
        situations: [
            "فعلوا الكثير ولم يشعروا بالتعب — كان الأمر أشياءً كثيرة لوقت طويل في آنٍ واحد",
            "كانوا فارغين، لكن الخوف من أن يسقط شيء ما لم يتركهم يتوقفون",
            "الجسد كان يستريح، لكن العقل لم يفعل أبداً",
            "كانوا يأتون كل يوم، يصمدون كل يوم — سواء كان هناك شيء في الداخل أم لا",
        ],
        insights: [
            "لم يكن الأمر نوماً، بل راحة. النقطة كانت هذه — السماح لأنفسهم بإنزال شيء ما لبعض الوقت.",
            "أعطوا أنفسهم ساعة واحدة لإيقاف كل شيء. كان ذلك البداية.",
            "بدلاً من سؤال 'إلى متى أتحمل؟' سألوا 'ماذا أحتاج؟' — تغيّر شيء ما.",
            "الاعتراف بالتعب — دون قتاله — كان الطريق اللطيف.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// French
// ─────────────────────────────────────────────────────────────────────────────
const FR: LangEntry = {
    framings: [
        "Quelqu'un m'a dit un jour —",
        "Il y a quelque temps, quelqu'un a partagé quelque chose qui m'est resté :",
        "J'ai vu des gens traverser ça. L'un d'eux l'a décrit ainsi —",
        "Il y a une conversation dont je me souviens encore —",
    ],
    sad: {
        situations: [
            "ils portaient quelque chose qu'ils ne savaient pas nommer, sans réaliser à quel point ça pesait, jusqu'à ce qu'ils s'arrêtent",
            "ils traversaient la journée avec quelque chose de pesant, présents pour tout le monde tout en traînant",
            "ils ont pleuré quand ils étaient seuls — pas parce que les choses allaient plus mal, juste parce qu'ils avaient enfin un moment pour ressentir",
            "devant les autres tout semblait aller, mais seuls ils avaient l'impression de tenir à peine",
        ],
        insights: [
            "Quand ils ont mis un mot dessus, quelque chose s'est desserré.",
            "Pas besoin de résoudre quoi que ce soit — juste se donner un moment pour ressentir. C'était suffisant.",
            "Une petite acceptation — et quelque chose s'est allégé.",
            "Reconnaître que c'était là — c'était le vrai premier pas.",
        ],
    },
    anxious: {
        situations: [
            "l'esprit tournait encore et encore dans le même cercle — se préparant à quelque chose qui n'était pas encore là",
            "tout semblait soudainement urgent, sans savoir quoi mettre en premier",
            "plusieurs fils couraient en même temps, avec le sentiment de ne pouvoir en tenir aucun",
            "même les petites décisions semblaient lourdes, sans vraiment savoir pourquoi",
        ],
        insights: [
            "Une seule chose a aidé — tenir un seul fil. Pas besoin de tout résoudre.",
            "Ils se sont posé une question : 'Est-ce que ça se passe maintenant, ou est-ce que je me prépare à quelque chose qui n'arrivera peut-être pas ?' Une question a desserré tout ça.",
            "Accepter que l'alarme était réelle — ça seul a apporté un changement.",
            "Ils se sont permis de ne voir que ce qui était devant eux à cet instant.",
        ],
    },
    angry: {
        situations: [
            "ils avaient retenu longtemps — quelque chose de petit a tout fait sortir",
            "tout était sous contrôle, tout était géré — jusqu'à ce que quelque chose craque",
            "la colère n'était pas de ce moment-là — elle était ancienne, quelque chose de l'intérieur",
            "la colère est arrivée, et la colère contre soi-même aussi, qui ne faisait que s'alourdir",
        ],
        insights: [
            "Le nommer — pas pour le résoudre, mais pour ne plus le porter seul — a vraiment fait une différence.",
            "Dans la colère, il n'y avait pas de colère. C'était ce qui n'avait nulle part où aller.",
            "Ce n'était pas que quelque chose allait changer — c'était poser le poids qu'ils portaient.",
            "Dans la colère, il y avait quelque chose de doux. En le voyant, quelque chose a changé.",
        ],
    },
    tired: {
        situations: [
            "ils en avaient fait beaucoup et ne se sentaient pas fatigués — c'était trop de choses pendant trop longtemps en même temps",
            "ils étaient vides, mais la peur que quelque chose s'effondre les empêchait de s'arrêter",
            "le corps se reposait, mais l'esprit jamais",
            "ils continuaient à venir, à tenir — qu'il y ait quelque chose à l'intérieur ou non",
        ],
        insights: [
            "Ce n'était pas du sommeil, c'était du repos. C'était ça le point — se permettre de poser quelque chose pour un moment.",
            "Ils se sont accordé une heure pour tout arrêter. C'était le début.",
            "Au lieu de demander 'combien de temps encore ?' ils ont demandé 'de quoi j'ai besoin ?' — quelque chose a changé.",
            "Reconnaître la fatigue — sans la combattre — c'était le chemin doux.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Portuguese
// ─────────────────────────────────────────────────────────────────────────────
const PT: LangEntry = {
    framings: [
        "Alguém me disse uma vez —",
        "Há algum tempo, alguém compartilhou algo que ficou comigo:",
        "Já vi pessoas passarem por isso. Uma delas descreveu assim —",
        "Houve uma conversa que ainda me lembro —",
    ],
    sad: {
        situations: [
            "carregavam algo que não conseguiam nomear, e não perceberam o quanto pesava até pararem",
            "passavam o dia com algo silenciosamente pesado por dentro, estando presentes para todos enquanto se arrastavam",
            "choraram quando estavam sozinhos — não porque as coisas pioraram, só porque finalmente tiveram um momento para sentir",
            "na frente dos outros tudo parecia bem, mas sozinhos sentiam que mal se sustentavam",
        ],
        insights: [
            "Quando colocaram um nome nisso, algo se afrouxou.",
            "Não precisavam resolver nada — só se dar um momento para sentir. Isso bastou.",
            "Uma pequena aceitação — e algo aliviou um pouco.",
            "Reconhecer que estava lá — esse foi o primeiro passo real.",
        ],
    },
    anxious: {
        situations: [
            "a mente ficava rodando no mesmo círculo — se preparando para algo que ainda não tinha chegado",
            "de repente tudo parecia urgente, sem saber o que colocar primeiro",
            "vários fios corriam ao mesmo tempo e sentiam que não conseguiam segurar nenhum",
            "até as pequenas decisões pareciam pesadas, sem saber bem por quê",
        ],
        insights: [
            "Só uma coisa ajudou — segurar um único fio. Não precisava resolver tudo.",
            "Fizeram uma pergunta a si mesmos: 'Isso está acontecendo agora, ou estou me preparando para algo que talvez não aconteça?' Uma pergunta suavizou tudo.",
            "Aceitar que o alarme era real — isso por si só trouxe mudança.",
            "Deram a si mesmos permissão de ver só o que estava na frente no momento.",
        ],
    },
    angry: {
        situations: [
            "tinham guardado por muito tempo — algo pequeno fez tudo sair",
            "tudo estava sob controle, tudo estava sendo gerenciado — até que algo quebrou",
            "a raiva não era daquele momento — era antiga, era algo de dentro",
            "a raiva chegou, e a raiva consigo mesmos também, que só ficava mais pesada",
        ],
        insights: [
            "Nomear — não para resolver, mas para não carregar sozinhos — fez uma diferença real.",
            "Dentro da raiva não havia raiva. Era o que não tinha para onde ir.",
            "Não era que algo fosse mudar — era largar o peso que carregavam.",
            "Dentro da raiva havia algo suave. Quando viram, algo mudou.",
        ],
    },
    tired: {
        situations: [
            "tinham feito muito e não se sentiam cansados — eram muitas coisas por muito tempo ao mesmo tempo",
            "estavam vazios, mas o medo de que algo caísse não os deixava parar",
            "o corpo descansava, mas a mente nunca",
            "continuavam chegando, continuavam sustentando — houvesse ou não algo por dentro",
        ],
        insights: [
            "Não era sono, era descanso. O ponto era esse — se dar permissão de largar algo por um tempo.",
            "Deram a si mesmos uma hora para parar tudo. Foi aí que começou.",
            "Em vez de perguntar 'quanto mais aguento?', perguntaram 'o que eu preciso?' — algo mudou.",
            "Reconhecer o cansaço — sem lutar contra ele — esse foi o caminho suave.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Russian
// ─────────────────────────────────────────────────────────────────────────────
const RU: LangEntry = {
    framings: [
        "Однажды мне кто-то сказал —",
        "Какое-то время назад один человек поделился тем, что осталось со мной:",
        "Я видел, как люди проходят через это. Один из них описал так —",
        "Был разговор, который я до сих пор помню —",
    ],
    sad: {
        situations: [
            "они несли что-то, чему не могли дать название, и не замечали, насколько это стало тяжёлым, пока не остановились",
            "они проходили день с чем-то тихо тяжёлым внутри, оставаясь для всех, пока тащились сами",
            "они заплакали, когда остались одни — не потому что стало хуже, просто наконец появился момент это почувствовать",
            "перед другими всё казалось нормальным, но наедине с собой они едва держались",
        ],
        insights: [
            "Когда они назвали это словом, что-то ослабло.",
            "Не нужно было ничего решать — просто дать себе момент почувствовать. Этого хватило.",
            "Маленькое принятие — и стало немного легче.",
            "Признать, что это есть — это был настоящий первый шаг.",
        ],
    },
    anxious: {
        situations: [
            "ум снова и снова бежал по одному кругу — готовясь к тому, чего ещё не было",
            "вдруг всё стало срочным, и непонятно было, что поставить вперёд",
            "несколько нитей тянулись одновременно, и казалось, ни одну не удержать",
            "даже маленькие решения казались тяжёлыми, и непонятно было, почему",
        ],
        insights: [
            "Помогло только одно — держаться за одну нить. Решать всё не нужно было.",
            "Они задали себе вопрос: «Это происходит прямо сейчас или я готовлюсь к тому, чего, может, не будет?» Один вопрос смягчил всё.",
            "Признать, что тревога была настоящей — это само по себе что-то изменило.",
            "Они позволили себе видеть только то, что было перед ними прямо сейчас.",
        ],
    },
    angry: {
        situations: [
            "они долго сдерживались — и что-то маленькое выпустило всё наружу",
            "всё было под контролем, всё держалось — пока что-то не треснуло",
            "злость была не того момента — она была старой, чем-то из глубины",
            "пришёл гнев, и злость на себя тоже, которая только становилась тяжелее",
        ],
        insights: [
            "Назвать это — не чтобы решить, а чтобы не нести одному — действительно изменило что-то.",
            "Внутри злости не было злости. Там было то, чему некуда было деться.",
            "Дело было не в том, что что-то изменится — а в том, чтобы отпустить груз, который они несли.",
            "Внутри злости было что-то мягкое. Когда они это увидели, что-то сдвинулось.",
        ],
    },
    tired: {
        situations: [
            "они много делали и не чувствовали усталости — слишком многое слишком долго одновременно",
            "они были пусты, но страх, что что-то рухнет, не давал остановиться",
            "тело отдыхало, но ум — никогда",
            "они продолжали приходить, продолжали держаться — было ли что-то внутри или нет",
        ],
        insights: [
            "Это был не сон, а отдых. В этом и был смысл — позволить себе ненадолго отпустить что-то.",
            "Они дали себе один час, чтобы всё остановить. Вот с чего началось.",
            "Вместо «как долго ещё?» они спросили «что мне нужно?» — что-то изменилось.",
            "Признать усталость — не бороться с ней — это и был мягкий путь.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Indonesian
// ─────────────────────────────────────────────────────────────────────────────
const ID: LangEntry = {
    framings: [
        "Seseorang pernah berkata padaku —",
        "Beberapa waktu lalu, seseorang berbagi sesuatu yang masih kuingat:",
        "Aku pernah melihat orang-orang melewati ini. Salah satu dari mereka menggambarkannya begini —",
        "Ada sebuah percakapan yang masih kupikirkan —",
    ],
    sad: {
        situations: [
            "mereka membawa sesuatu yang tidak bisa mereka beri nama, dan tidak sadar betapa beratnya sampai mereka berhenti",
            "mereka menjalani hari dengan sesuatu yang diam-diam berat di dalam, hadir untuk semua orang sambil menyeret diri sendiri",
            "mereka menangis saat sendiri — bukan karena segalanya memburuk, hanya karena akhirnya ada waktu untuk merasakannya",
            "di depan orang lain semuanya terlihat baik-baik saja, tapi sendirian mereka merasa hampir tidak bisa bertahan",
        ],
        insights: [
            "Ketika mereka memberi nama pada itu, sesuatu mengendur.",
            "Tidak perlu menyelesaikan apa pun — cukup memberi diri sendiri waktu sebentar untuk merasakan. Itu sudah cukup.",
            "Sedikit penerimaan — dan sesuatu terasa sedikit lebih ringan.",
            "Mengakui bahwa itu ada — itulah langkah pertama yang nyata.",
        ],
    },
    anxious: {
        situations: [
            "pikiran berputar-putar dalam lingkaran yang sama — mempersiapkan diri untuk sesuatu yang belum datang",
            "tiba-tiba semuanya terasa mendesak, tanpa tahu harus mendahulukan yang mana",
            "banyak benang berjalan bersamaan dan mereka merasa tidak bisa memegang satu pun",
            "keputusan kecil pun terasa berat, tanpa tahu kenapa",
        ],
        insights: [
            "Hanya satu yang membantu — memegang satu benang saja. Tidak perlu menyelesaikan semuanya.",
            "Mereka bertanya pada diri sendiri: 'Apakah ini sedang terjadi sekarang, atau aku sedang mempersiapkan diri untuk sesuatu yang mungkin tidak akan terjadi?' Satu pertanyaan melunakkan segalanya.",
            "Mengakui bahwa kekhawatiran itu nyata — itu sendiri membawa perubahan.",
            "Mereka memberi izin pada diri sendiri untuk hanya melihat apa yang ada di depan saat itu.",
        ],
    },
    angry: {
        situations: [
            "mereka sudah menahan lama — sesuatu yang kecil mengeluarkan semuanya",
            "semuanya terkendali, semuanya ditangani — sampai sesuatu retak",
            "amarah itu bukan dari saat itu — itu lama, sesuatu dari dalam",
            "amarah datang, dan amarah pada diri sendiri juga datang, yang hanya semakin berat",
        ],
        insights: [
            "Menamainya — bukan untuk menyelesaikannya, tapi agar tidak menanggungnya sendirian — benar-benar membuat perbedaan.",
            "Di dalam amarah tidak ada amarah. Itu adalah apa yang tidak punya tempat untuk pergi.",
            "Bukan karena sesuatu akan berubah — tapi karena meletakkan beban yang selama ini mereka bawa.",
            "Di dalam amarah ada sesuatu yang lembut. Ketika mereka melihatnya, sesuatu berubah.",
        ],
    },
    tired: {
        situations: [
            "mereka sudah melakukan banyak hal dan tidak merasa lelah — terlalu banyak hal terlalu lama sekaligus",
            "mereka kosong, tapi rasa takut sesuatu akan runtuh tidak membiarkan mereka berhenti",
            "tubuh beristirahat, tapi pikiran tidak pernah",
            "mereka terus datang, terus bertahan — ada atau tidak ada sesuatu di dalam",
        ],
        insights: [
            "Bukan tidur, tapi istirahat. Itulah intinya — memberi diri sendiri izin untuk meletakkan sesuatu sebentar.",
            "Mereka memberi diri sendiri satu jam untuk menghentikan segalanya. Itulah awalnya.",
            "Alih-alih bertanya 'sampai kapan aku bisa bertahan?', mereka bertanya 'apa yang aku butuhkan?' — sesuatu berubah.",
            "Mengakui kelelahan — tanpa melawannya — itulah jalan yang lembut.",
        ],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────
const STORY_DATA: Record<string, LangEntry> = {
    en: EN, hi: HI, bn: BN, mr: MR, gu: GU, pa: PA,
    ta: TA, te: TE, kn: KN, ml: ML, or: OR,
    ur: UR, zh: ZH, es: ES, ar: AR, fr: FR, pt: PT, ru: RU, id: ID,
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a micro-story by independently selecting framing + situation + insight
 * from three separate pools using different bit-offsets of `seed`.
 * Yields 4×4×4 = 64 unique combinations per signal per language.
 *
 * Returns null when signal is unknown or story data is missing.
 */
export function buildMicroStory(
    signal: string,
    lang: string,
    seed: number,
): string | null {
    const entry = STORY_DATA[lang] ?? STORY_DATA["en"]!;
    const parts = (entry as any)[signal] as Pick<StoryParts, "situations" | "insights"> | undefined;
    if (!parts) return null;

    const framings = entry.framings;
    const { situations, insights } = parts;

    const framing  = framings[   seed         % framings.length]!;
    const situation = situations[(seed >>> 3)  % situations.length]!;
    const insight   = insights[  (seed >>> 6)  % insights.length]!;

    return `${framing} ${situation} ${insight}`;
}
