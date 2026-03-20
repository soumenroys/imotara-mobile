// src/lib/ai/local/localReplyEngine.ts
import { buildMicroStory } from "./storyEngine";
import { buildMythologyStory } from "./mythologyEngine";
import { buildOfflineQuote } from "./quotesEngine";
import type { ToneContextPayload } from "../../../api/aiClient";
import {
    BN_SAD_REGEX, BN_STRESS_REGEX,
    EN_LANG_HINT_REGEX,
    HI_STRESS_REGEX,
    ROMAN_BN_LANG_HINT_REGEX, ROMAN_HI_LANG_HINT_REGEX,
    ROMAN_TA_LANG_HINT_REGEX, ROMAN_TE_LANG_HINT_REGEX,
    TA_SAD_REGEX, TA_STRESS_REGEX,
    isConfusedText,
} from "../../emotion/keywordMaps";

type ToneContext = ToneContextPayload;

type LocalResponseTone = "calm" | "supportive" | "practical" | "coach" | "gentle-humor" | "direct";

type LocalLanguage =
    | "en" | "hi" | "mr" | "bn" | "ta" | "te" | "gu" | "pa" | "kn" | "ml" | "or" | "ur"
    | "zh" | "es" | "ar" | "fr" | "pt" | "ru" | "id" | "de";

export type LocalRecentContext = {
    recentUserTexts?: string[];
    recentAssistantTexts?: string[];
    lastDetectedLanguage?: string;
    emotionMemory?: string;
};

export type LocalReplyResult = {
    message: string;
    reflectionSeed?: {
        intent: "reflect" | "clarify" | "reframe";
        title: string;
        prompt: string;
    };
};

// ✅ DEV-only test prompts
export const LOCAL_DEV_TEST_PROMPTS: string[] = [
    "I cannot focus today",
    "I feel very sad today",
    "I'm anxious and can't calm down",
    "mon kharap lagche",
    "main bahut pareshan hoon",
    "😂😂😂",
    "👍",
];

function hash32(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
    return arr[seed % arr.length];
}

// Extract meaningful words (3+ chars, skip stopwords) for overlap detection
function keyWords(text: string): Set<string> {
    const stop = new Set(["the", "and", "for", "you", "are", "this", "with", "have", "that", "its", "not", "but"]);
    return new Set(
        text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)
            .filter((w) => w.length >= 3 && !stop.has(w))
    );
}

// Picks from arr but skips options that are too similar to recentTexts,
// falling back to the plain pick if all options are exhausted.
function pickAvoidingRecent(arr: string[], seed: number, recentTexts: string[]): string {
    if (!recentTexts.length) return pick(arr, seed);
    const recentLower = recentTexts.map((t) => t.toLowerCase());
    const recentWords = recentTexts.map(keyWords);
    const filtered = arr.filter((opt) => {
        if (!opt) return true; // keep empty strings (used as "no extra" sentinel)
        const optLower = opt.toLowerCase();
        const optWords = keyWords(opt);
        return !recentLower.some((r, i) => {
            // exact substring check
            if (r.includes(optLower) || optLower.includes(r.slice(0, 30))) return true;
            // word overlap check: if >50% of opt's key words appear in recent reply, skip it
            if (optWords.size === 0) return false;
            let overlap = 0;
            for (const w of optWords) { if (recentWords[i].has(w)) overlap++; }
            return overlap / optWords.size >= 0.5;
        });
    });
    const pool = filtered.length > 0 ? filtered : arr;
    return pick(pool, seed);
}

function dedupeAdjacentSentences(text: string): string {
    const parts = text
        .split(/(?<=[.!?।])\s+/)
        .map((p) => p.trim())
        .filter(Boolean);
    const deduped: string[] = [];
    for (const part of parts) {
        const normalized = part.toLowerCase();
        const prev = deduped[deduped.length - 1]?.toLowerCase();
        if (normalized !== prev) deduped.push(part);
    }
    return deduped.join(" ").trim();
}

function countMatches(text: string, regex: RegExp): number {
    const m = text.match(regex);
    return m ? m.length : 0;
}

function relationshipToTone(relationship?: string): LocalResponseTone {
    switch (relationship) {
        case "mentor": return "calm";
        case "elder": return "calm";
        case "coach": return "coach";
        case "sibling": return "gentle-humor";
        case "junior_buddy": return "gentle-humor";
        case "friend": return "supportive";
        case "parent_like": return "supportive";
        case "partner_like": return "supportive";
        default: return "supportive";
    }
}

function buildRecentSignature(recentContext?: LocalRecentContext): string {
    return (recentContext?.recentUserTexts ?? [])
        .map((t) => String(t || "").trim().toLowerCase())
        .filter(Boolean)
        .slice(-2)
        .join(" || ");
}

function hasRecentEmotionalSignal(recentContext?: LocalRecentContext): boolean {
    const recent = (recentContext?.recentUserTexts ?? [])
        .map((t) => String(t || "").trim())
        .filter(Boolean)
        .slice(-3);
    if (recent.length === 0) return false;
    return recent.some((text) => {
        const lang = detectLanguage(text, recentContext);
        return detectSignal(text, lang) !== "okay";
    });
}

function detectLanguage(text: string, recentContext?: LocalRecentContext): LocalLanguage {
    const raw = text || "";
    const t = raw.toLowerCase();

    if (/[\u0980-\u09ff]/.test(raw)) return "bn";
    const mrScore = countMatches(t, /\b(mala|majhya|aahe|naahi|karu|kasa|kiti|aaj|khup|baru|nahi ka|kay karu|kay zala|kaay zhala|ho ka|ahes ka|baru nahi|majha|mazha|tuzha|tyacha|ticha|aahet|nasto|naste|aamhi|apan|bara|thaklo|dukh zala|mann jad)\b/g);
    if (mrScore >= 2) return "mr";
    if (/[\u0900-\u097f]/.test(raw)) return "hi";
    if (/[\u0B80-\u0BFF]/.test(raw)) return "ta";
    if (/[\u0C00-\u0C7F]/.test(raw)) return "te";
    if (/[\u0A80-\u0AFF]/.test(raw)) return "gu";
    if (/[\u0A00-\u0A7F]/.test(raw)) return "pa";
    if (/[\u0C80-\u0CFF]/.test(raw)) return "kn";
    if (/[\u0D00-\u0D7F]/.test(raw)) return "ml";
    if (/[\u0B00-\u0B7F]/.test(raw)) return "or";
    // Urdu-specific chars (ں پ چ ڈ ٹ گ ک ے ۓ) before generic Arabic block to avoid misclassification
    if (/[\u067E\u0686\u0688\u0691\u0679\u06AF\u06A9\u06BA\u06D2\u06D3]/.test(raw)) return "ur";
    if (/[\u0600-\u06FF]/.test(raw)) return "ar";            // Arabic script
    if (/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(raw)) return "zh"; // CJK / Chinese
    if (/[\u0400-\u04FF]/.test(raw)) return "ru";            // Cyrillic / Russian

    const sharedBn = ROMAN_BN_LANG_HINT_REGEX.test(t) ? 2 : 0;
    const sharedHi = ROMAN_HI_LANG_HINT_REGEX.test(t) ? 2 : 0;
    const sharedTa = ROMAN_TA_LANG_HINT_REGEX.test(t) ? 2 : 0;
    const sharedTe = ROMAN_TE_LANG_HINT_REGEX.test(t) ? 2 : 0;
    const sharedEn = EN_LANG_HINT_REGEX.test(t) ? 1 : 0;

    const bnScore = sharedBn + countMatches(t, /\b(ami|amar|amake|tumi|tomar|amaro|mon|khub|bhalo|valo|kharap|onek|lagche|lagchhe|korbo|korchi|korcho|korchho|ki|ki korbo|ki khabo|ki korcho|ekhon|ekhono|achhi|achi|nao|nei|valo na|bhalo na|mon ta)\b/g);
    const hiScore = sharedHi + countMatches(t, /\b(mera|meri|mujhe|mujhse|main|mai|hum|tum|kya|kyu|kyon|nahi|nahin|acha|accha|thik|theek|bahut|zyada|yar|yaar|karu|karoon|kaise|dimag|dil|mera dil|mujhe lag raha|ho raha hai)\b/g);
    const taScore = sharedTa;
    const teScore = sharedTe;

    if (bnScore >= 2 && bnScore > hiScore && bnScore > taScore && bnScore > teScore) return "bn";
    if (hiScore >= 2 && hiScore > bnScore && hiScore > taScore && hiScore > teScore) return "hi";
    if (taScore >= 2 && taScore > bnScore && taScore > hiScore && taScore >= teScore) return "ta";
    if (teScore >= 2 && teScore > bnScore && teScore > hiScore && teScore >= taScore) return "te";
    if (bnScore >= 2) return "bn";
    if (hiScore >= 2) return "hi";
    if (taScore >= 2) return "ta";
    if (teScore >= 2) return "te";
    if (sharedEn > 0) return "en";

    const recentTexts = recentContext?.recentUserTexts ?? [];
    for (let i = recentTexts.length - 1; i >= 0; i--) {
        const prev = (recentTexts[i] || "").trim();
        if (!prev) continue;
        const prevLower = prev.toLowerCase();
        if (/[\u0980-\u09ff]/.test(prev) || ROMAN_BN_LANG_HINT_REGEX.test(prevLower)) return "bn";
        if (/[\u0900-\u097f]/.test(prev) || ROMAN_HI_LANG_HINT_REGEX.test(prevLower)) return "hi";
        if (ROMAN_TA_LANG_HINT_REGEX.test(prevLower)) return "ta";
        if (ROMAN_TE_LANG_HINT_REGEX.test(prevLower)) return "te";
    }

    const hintLang = recentContext?.lastDetectedLanguage;
    if (hintLang && hintLang !== "en") return hintLang as LocalLanguage;
    return "en";
}

function detectIndirectSignal(text: string): "sad" | "anxious" | "angry" | "tired" | null {
    const t = (text || "").toLowerCase().trim();
    // English
    if (/\b(i'?m fine|it'?s fine|i'?m okay|i'?m ok|whatever|doesn'?t matter|never mind|forget it|it is what it is|it'?s nothing|not a big deal|i don'?t know|don'?t even know|can'?t explain|hard to explain)\b/.test(t)) return "sad";
    if (/\b(i give up|can'?t anymore|can't do this|too much|i'?m done|so over it|sick of (this|everything)|nothing (matters|helps|works))\b/.test(t)) return "sad";
    if (/\b(i don'?t know what to do|don'?t know where to start|all at once|can'?t keep up|spinning|head (is|feels) full|too many (things|thoughts))\b/.test(t)) return "anxious";
    if (/\b(so annoying|why (does|do|is) (this|everything|everyone|he|she|they)|seriously\?|unbelievable|i can'?t believe|ridiculous)\b/.test(t)) return "angry";
    if (/\b(just tired|so tired|exhausted (of|by)|drained|running on empty|no energy|wiped)\b/.test(t)) return "tired";
    // Hindi / Marathi Roman
    if (/\b(theek hoon|sab theek|kuch nahi|chhodo|chod do|bas yahi|jo bhi ho|kya farak|koi baat nahi|nahi pata|samajh nahi)\b/.test(t)) return "sad";
    if (/\b(haar gaya|haar gayi|thak gaya|thak gayi|chalta hai|kuch nahi hoga|sab bekaar)\b/.test(t)) return "sad";
    if (/\b(thaklo|thakle|khup thaklo|kaay karau|nako vatato|aaik nahi|mann nahi|sod de|soDun de)\b/.test(t)) return "tired";
    // Bengali Roman
    if (/\b(ami thik achi|kichhu na|chharo|jaak|thak gechhi|ki hobe|ki dorkaar|bujhte parchi na)\b/.test(t)) return "sad";
    // Spanish
    if (/\b(estoy bien|no es nada|da igual|no importa|qué más da|no sé|imposible explicar|me rindo|ya fue)\b/.test(t)) return "sad";
    if (/\b(no sé qué hacer|demasiado|estoy harto|estoy harta)\b/.test(t)) return "anxious";
    // French
    if (/\b(je vais bien|c'?est rien|peu importe|laisse tomber|tant pis|j'?en sais rien|je m'?en fous|à quoi bon)\b/.test(t)) return "sad";
    if (/\b(j'?abandonne|c'?est trop|je suis épuisé)\b/.test(t)) return "tired";
    // Portuguese
    if (/\b(tô bem|estou bem|não é nada|tanto faz|deixa pra lá|não sei|desisti|é demais)\b/.test(t)) return "sad";
    // Russian
    if (/\b(я в порядке|всё нормально|ладно|неважно|забудь|не знаю|сдался|сдалась|слишком много)\b/.test(t)) return "sad";
    if (/\b(я устал|я устала|нет сил|больше не могу)\b/.test(t)) return "tired";
    // Indonesian
    if (/\b(aku baik|gak apa-apa|gak papa|biarin|terserah|nggak tau|udah menyerah|terlalu banyak)\b/.test(t)) return "sad";
    if (/\b(aku lelah|capek banget|udah gak kuat)\b/.test(t)) return "tired";
    // Arabic / Urdu / Chinese native script
    if (/(أنا بخير|لا شيء|مهما|لا يهم|اتركني|لا أعرف|استسلمت)/.test(text)) return "sad";
    if (/(أنا متعب|أنا متعبة|لا طاقة لي)/.test(text)) return "tired";
    if (/(میں ٹھیک ہوں|کچھ نہیں|جانے دو|پتہ نہیں|ہار گیا|ہار گئی)/.test(text)) return "sad";
    if (/(我很好|没什么|算了|无所谓|不知道|随便|放弃了|太多了)/.test(text)) return "sad";
    if (/(太累了|没劲|撑不住了|不想动)/.test(text)) return "tired";
    return null;
}

function detectIntent(text: string): "venting" | "advice-seeking" | "neutral" {
    const t = (text || "").toLowerCase().trim();
    if (/\?$/.test(t)) return "advice-seeking";
    // English advice
    if (/\b(what should (i|we)|how (do|can|should) i|can you help|any advice|any tips|what do i do|what would you|suggest|recommend|what'?s the best|how to deal|tell me (what|how))\b/.test(t)) return "advice-seeking";
    // Hindi/Roman advice
    if (/\b(kya karna chahiye|kya karun|kaise karun|koi advice|koi tips|mujhe batao|kya sahi rahega|kaise deal karoon)\b/.test(t)) return "advice-seeking";
    // Spanish/French/Portuguese/Indonesian advice
    if (/\b(qué debo hacer|qué hago|cómo puedo|algún consejo|que dois-je faire|comment puis-je|des conseils|o que devo fazer|como posso|algum conselho|apa yang harus aku lakukan|bagaimana caranya|ada saran)\b/.test(t)) return "advice-seeking";
    // English venting
    if (/\b(just (want to|wanted to|needed to) (say|vent|share|talk)|not looking for advice|just (listen|listening)|feel like telling|had to tell someone|couldn'?t hold it|ugh|argh|so frustrated|so upset|so sad|i hate this|i hate (it|when)|can'?t (take|stand|handle) (this|it|anymore))\b/.test(t)) return "venting";
    // Hindi / Roman venting
    if (/\b(bas suno|sirf suno|sunna tha|vent karna tha|kisi ko batana tha|advice nahi chahiye|dil halka karna|baat karni thi)\b/.test(t)) return "venting";
    // Bengali Roman venting
    if (/\b(shudhu shono|kothaa boltey cheyechhi|mon halka kortey cheyechhi|upodesh dorkar na)\b/.test(t)) return "venting";
    // Spanish / French / Portuguese / Russian / Indonesian venting
    if (/\b(solo quiero hablar|solo escúchame|no busco consejos|odio esto|no aguanto más|j'?avais juste besoin de parler|écoute-moi|pas de conseils|trop c'?est trop|só quero falar|não quero conselhos|odeio isso|não aguento mais|просто хочу поговорить|просто послушай|не ищу советов|ненавижу это|больше не могу|mau cerita aja|gak butuh saran|benci ini|udah gak tahan)\b/.test(t)) return "venting";
    // Arabic / Urdu / Chinese native script venting
    if (/(أريد فقط أن أتحدث|فقط اسمعني|لا أريد نصيحة|صرف سننا ہے|بس دل کا بوجھ اتارنا تھا|只想说说|只是想倾诉|你就听着|不需要建议|烦死了|受不了了)/.test(text)) return "venting";
    return "neutral";
}

function detectTopic(text: string, recentTexts: string[] = []): "work" | "relationship" | "health" | "existential" | "general" {
    const combined = ([text, ...recentTexts].join(" ") || "").toLowerCase();
    // Work  -  English (intentionally no bare "work"  -  too generic)
    if (/\b(job|boss|office|deadline|project|meeting|colleague|team|interview|career|study|exam|college|school|client|manager|promotion|salary|assignment)\b/.test(combined)) return "work";
    if (/\b(kaam|naukri|daftar|padhai|interview|salary|promotion)\b/.test(combined)) return "work";
    if (/\b(trabajo|jefe|oficina|reunión|entrevista|carrera|estudio|examen|salario|proyecto)\b/.test(combined)) return "work";
    if (/\b(travail|patron|bureau|réunion|entretien|études|examen|salaire|projet)\b/.test(combined)) return "work";
    if (/\b(trabalho|chefe|escritório|reunião|entrevista|carreira|estudo|exame|salário|projeto)\b/.test(combined)) return "work";
    if (/\b(работа|начальник|офис|дедлайн|собеседование|карьера|учёба|экзамен|зарплата)\b/.test(combined)) return "work";
    if (/\b(kerja|bos|kantor|deadline|wawancara|karir|belajar|ujian|sekolah|gaji|proyek)\b/.test(combined)) return "work";
    if (/(工作|老板|公司|截止|面试|职业|学习|考试|学校|工资|项目|上班|同事|仕事|上司|会社|締め切り|面接|試験|عمل|رئيس|مكتب|مقابلة عمل|دراسة|امتحان|راتب)/.test(combined)) return "work";
    // Relationship  -  English
    if (/\b(friend|family|mom|dad|mother|father|partner|boyfriend|girlfriend|relationship|love|marriage|divorce|breakup|fight|argument|toxic|miss (you|him|her|them)|alone|lonely)\b/.test(combined)) return "relationship";
    if (/\b(dost|yaar|maa|papa|boyfriend|girlfriend|rishta|pyaar|shaadi|talaak|breakup|jhagda|akela)\b/.test(combined)) return "relationship";
    if (/\b(amigo|familia|mamá|papá|novio|novia|relación|amor|matrimonio|divorcio|ruptura|pelea|soledad)\b/.test(combined)) return "relationship";
    if (/\b(famille|maman|papa|petit ami|petite amie|relation|amour|mariage|divorce|rupture|dispute|solitude)\b/.test(combined)) return "relationship";
    if (/\b(amigo|família|mãe|pai|namorado|namorada|relacionamento|amor|casamento|divórcio|término|briga|solidão)\b/.test(combined)) return "relationship";
    if (/\b(друг|семья|мама|папа|парень|девушка|отношения|любовь|брак|развод|расставание|ссора|одинокий)\b/.test(combined)) return "relationship";
    if (/\b(teman|keluarga|ibu|ayah|pacar|hubungan|cinta|pernikahan|cerai|putus|pertengkaran|kesepian)\b/.test(combined)) return "relationship";
    if (/(朋友|家人|妈妈|爸爸|男友|女友|关系|爱情|婚姻|离婚|分手|争吵|孤独|想念|友達|家族|お母さん|お父さん|彼氏|彼女|関係|愛情|結婚|離婚|別れ|喧嘩|صديق|عائلة|أم|أب|حبيب|حبيبة|علاقة|حب|زواج|طلاق|انفصال)/.test(combined)) return "relationship";
    // Health  -  English
    if (/\b(sick|pain|health|doctor|medicine|hospital|sleep|insomnia|eat|appetite|headache|migraine|tired|body|anxiety|depression|mental health|therapy|therapist|panic attack)\b/.test(combined)) return "health";
    if (/\b(bimaar|dard|doctor|dawai|hospital|neend|bhookh|sir dard|therapy|panic)\b/.test(combined)) return "health";
    if (/\b(enfermo|dolor|salud|médico|medicina|hospital|sueño|insomnio|apetito|depresión|ansiedad|terapia)\b/.test(combined)) return "health";
    if (/\b(malade|douleur|santé|médecin|médicament|hôpital|sommeil|insomnie|appétit|dépression|anxiété|thérapie)\b/.test(combined)) return "health";
    if (/\b(doente|dor|saúde|médico|remédio|hospital|sono|insônia|apetite|depressão|ansiedade|terapia)\b/.test(combined)) return "health";
    if (/\b(болен|больна|боль|здоровье|врач|лекарство|больница|сон|депрессия|тревога|терапия)\b/.test(combined)) return "health";
    if (/\b(sakit|nyeri|kesehatan|dokter|obat|rumah sakit|tidur|insomnia|nafsu makan|depresi|kecemasan|terapi)\b/.test(combined)) return "health";
    if (/(生病|疼痛|健康|医生|药|医院|睡眠|失眠|食欲|抑郁|焦虑|治疗|身体|病気|痛み|医者|薬|病院|不眠|うつ|不安|療法|مريض|مريضة|ألم|صحة|طبيب|دواء|مستشفى|نوم|أرق|اكتئاب|قلق|علاج)/.test(combined)) return "health";
    // Existential  -  English
    if (/\b(life|meaning|purpose|why (am i|do i|does it)|exist|worth it|future|hope|everything|nothing matters|pointless|empty|lost|who am i|identity|direction)\b/.test(combined)) return "existential";
    if (/\b(zindagi|matlab|purpose|kyun hoon|future|umeed|kuch nahi|bekaar|khoya|kaun hoon)\b/.test(combined)) return "existential";
    if (/\b(vida|sentido|propósito|futuro|esperanza|nada importa|sin sentido|vacío|perdido|quién soy)\b/.test(combined)) return "existential";
    if (/\b(vie|sens|but|avenir|espoir|rien n'a de sens|vide|perdu|qui suis-je|identité)\b/.test(combined)) return "existential";
    if (/\b(vida|sentido|propósito|futuro|esperança|nada importa|vazio|perdido|quem sou)\b/.test(combined)) return "existential";
    if (/\b(жизнь|смысл|цель|будущее|надежда|ничего не важно|пустота|потерян|кто я)\b/.test(combined)) return "existential";
    if (/\b(hidup|makna|tujuan|masa depan|harapan|tidak ada artinya|hampa|tersesat|siapa aku)\b/.test(combined)) return "existential";
    if (/(人生|意义|目的|为什么活着|未来|希望|什么都没意义|空虚|迷失|我是谁|仕事|意味|なぜ生きる|何も意味がない|虚ろ|自分が誰|الحياة|المعنى|الهدف|المستقبل|الأمل|لا شيء يهم|فراغ|ضائع|من أنا)/.test(combined)) return "existential";
    return "general";
}

function detectCorrection(text: string): boolean {
    const t = (text || "").toLowerCase().trim();
    // Must be an explicit correction of Imotara's reply, not just a negative answer.
    // "No not really" / "no no" / "no that's fine" are answers, not corrections.
    // Only flag when the intent is clearly to correct a misunderstanding.
    return /\b(you misunderstood|i didn'?t mean|not what i meant|that'?s not (it|what|right)|i meant|what i (said|meant) was|let me rephrase|to clarify|no[,.]?\s+(that'?s not|you got|you misunderstood|that is not))\b/.test(t);
}

function extractKeyTopic(recentTexts: string[]): string | null {
    const joined = (recentTexts || []).join(" ").toLowerCase();
    // English + multilingual keywords  -  relationship/work/health anchors
    const match = joined.match(/\b(mom|dad|mother|father|partner|boyfriend|girlfriend|friend|brother|sister|wife|husband|work|boss|job|exam|interview|school|college|health|sleep|breakup|divorce|maa|papa|bhai|behen|dost|yaar|naukri|kaam|pariksha|shaadi|talaak|rishta|amigo|jefe|trabajo|novio|novia|examen|mama|ami|tumi|baba|kakima|bondhu|kaaj|travail|patron|examen|trabalho|chefe|namorado|namorada|saúde|sono|работа|начальник|друг|здоровье|сон|друзья|kerja|bos|teman|kesehatan|tidur|pacar)\b/);
    if (match) return match[0];
    // Non-Latin script anchors  -  relationship terms
    const nativeMatch = joined.match(/(妈妈|爸爸|朋友|男友|女友|工作|老板|考试|健康|睡眠|мама|папа|друг|работа|お母さん|お父さん|友達|仕事|試験|أم|أب|صديق|حبيب|عمل|امتحان|ما|با|دوست|کام)/);
    return nativeMatch?.[0] ?? null;
}

function detectSignal(text: string, lang: LocalLanguage): "sad" | "anxious" | "angry" | "tired" | "okay" {
    const raw = text || "";
    const t = raw.toLowerCase();

    if (/^[\s👍]+$/.test(raw)) return "okay";
    if (isConfusedText(raw)) return "okay"; // confused → handled separately upstream

    if (BN_SAD_REGEX.test(raw) || TA_SAD_REGEX.test(raw)) return "sad";
    if (HI_STRESS_REGEX.test(raw) || BN_STRESS_REGEX.test(raw) || TA_STRESS_REGEX.test(raw) || /\b(tension|stress|stressed|overwhelm|overwhelmed|pressure)\b/i.test(raw)) return "anxious";

    if (lang === "mr") {
        if (/(sad|down|depressed|hopeless|cry|dukh|udaas|radu|mann jad|baru nahi|nako vatata)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|chinta|ghabra|bhiti|dara|pressure)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|rag|chidchid|kopavla|ras)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|thaklo|thakle|shakti nahi|kami pado)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "hi") {
        if (/(sad|down|depressed|hopeless|cry|udaas|udas|dukhi|bura lag|rona|ro raha|ro rahi)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|ghabra|pareshan|pressure|bojh)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|gussa|gussa aa raha|chidh|chidha)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|sleepy|burnt|thak|thaka|thaki|thak gaya|thak gayi)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "bn") {
        if (/(sad|down|depressed|hopeless|cry|mon kharap|kharap lagche|dukho|dukkho|kosto|koshto|kanna|valo nei|bhalo nei)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|chinta|tension|chap|pressure|bhoy|voy|ghabra)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|rag|rosh|khub rag|raeg)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|sleepy|burnt|klanto|ghum pachche|shokti nei)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "ta") {
        if (TA_SAD_REGEX.test(raw) || /(sogama|kashtama|kastama|manasu sari illa|manasu seriya illa)/.test(t)) return "sad";
        if (TA_STRESS_REGEX.test(raw) || /(pressure|stress|tension|bayama|manasu romba odudhu)/.test(t)) return "anxious";
        if (/(kovam|erichal|frustrating|annoyed|irritated)/.test(t)) return "angry";
        if (/(tired|drained|burnt|sorvu|saerndhu tiredness|romba tired)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "te") {
        if (/(kashtam|baadha|bharam|chaala bhaaranga|edustunna|baadha ga undi)/.test(t)) return "sad";
        if (/(pressure|stress|tension|bayam|bhayam|chaala pressure|manasu veganga)/.test(t)) return "anxious";
        if (/(kopam|frustrating|annoyed|irritated|mad)/.test(t)) return "angry";
        if (/(tired|drained|burnt|alasata|chaala tired|aayasam)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "gu") {
        if (/(sad|down|depressed|hopeless|cry|dukh|udaas|man kharap|rovu|dard|haar|dukhi)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|dara|ghabra|chinta|anxiety)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|gusse|krodh|chidha)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|thakelo|thak|shakti nathi)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "pa") {
        if (/(sad|down|depressed|hopeless|cry|dukhi|udaas|man kharap|rona|bura lagg|toot)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|chinta|ghabra|pareshaan|dara lagg)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|gussa|krodh|chidha)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|thakka|thakke|shakti nahi)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "kn") {
        if (/(sad|down|depressed|hopeless|cry|dukha|badha|novu|alavotti|kanniru)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|bayabhiti|chinta|ghabra)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|kopa|frustrating)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|dakkavase|shakti illa|alasata)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "ml") {
        if (/(sad|down|depressed|hopeless|cry|dukham|vishamam|kashtam|kanneer)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|bhayam|verupu|anxiety)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|kopam|frustrated)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|thurannu|shakti illa)/.test(t)) return "tired";
        return "okay";
    }
    if (lang === "or") {
        if (/(sad|down|depressed|hopeless|cry|dukha|manakhana|kanna|udaas|dukhit)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|chinta|ghabara|bhaya)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|raga|kopita|frustrated)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|thaka|shakti nahi)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "zh") {
        if (/(难过|伤心|哭|悲伤|难受|心疼|失落|绝望|sad|cry|hopeless)/.test(t)) return "sad";
        if (/(焦虑|紧张|害怕|担心|恐惧|慌|anxious|worried|panic|stress)/.test(t)) return "anxious";
        if (/(愤怒|生气|烦|愤|恼|气死|mad|angry|frustrated)/.test(t)) return "angry";
        if (/(疲惫|累|没劲|精疲力|倦|sleepy|tired|exhausted|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "ar") {
        if (/(حزين|حزينة|بكاء|أبكي|حزن|مؤلم|sad|cry|hazeen|mota'alam)/.test(t)) return "sad";
        if (/(قلق|قلقة|خائف|خائفة|يأس|اكتئاب|توتر|anxious|panic|qalaq|tawatar)/.test(t)) return "anxious";
        if (/(غاضب|غاضبة|غضب|متضايق|مستاء|mad|angry|frustrated|ghadib)/.test(t)) return "angry";
        if (/(متعب|متعبة|مرهق|مرهقة|إرهاق|tired|exhausted|drained|mut'ab)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "es") {
        if (/(triste|tristeza|llorar|llorando|deprimido|deprimida|desesperado|desesperada|sad|cry)/.test(t)) return "sad";
        if (/(ansioso|ansiosa|ansiedad|nervioso|nerviosa|angustia|pánico|panico|estresado|anxious|stressed)/.test(t)) return "anxious";
        if (/(enojado|enojada|enojo|furioso|furiosa|irritado|frustrado|frustrada|mad|angry)/.test(t)) return "angry";
        if (/(cansado|cansada|agotado|agotada|sin energía|exhausto|tired|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "fr") {
        if (/(triste|tristesse|pleurer|pleurs|déprimé|déprimée|désespéré|désespérée|sad|cry)/.test(t)) return "sad";
        if (/(anxieux|anxieuse|angoissé|angoissée|stressé|stressée|panique|anxious|stressed)/.test(t)) return "anxious";
        if (/(en colère|énervé|énervée|frustré|frustrée|furieux|furieuse|mad|angry)/.test(t)) return "angry";
        if (/(fatigué|fatiguée|épuisé|épuisée|crevé|crevée|tired|exhausted)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "pt") {
        if (/(triste|tristeza|chorar|chorando|deprimido|deprimida|desesperado|desesperada|sad|cry)/.test(t)) return "sad";
        if (/(ansioso|ansiosa|ansiedade|nervoso|nervosa|angustiado|pânico|panico|estressado|anxious|stressed)/.test(t)) return "anxious";
        if (/(com raiva|irritado|irritada|furioso|furiosa|frustrado|frustrada|mad|angry)/.test(t)) return "angry";
        if (/(cansado|cansada|exausto|exausta|esgotado|esgotada|tired|exhausted)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "ru") {
        if (/(грустно|грустный|грустная|плачу|плакать|депрессия|безнадёжно|sad|cry|hopeless)/.test(t)) return "sad";
        if (/(тревога|тревожно|боюсь|страх|паника|стресс|anxious|panic|stressed)/.test(t)) return "anxious";
        if (/(злой|злая|злюсь|гнев|бесит|раздражён|раздражена|frustrated|angry|mad)/.test(t)) return "angry";
        if (/(устал|устала|уставший|измотан|измотана|нет сил|tired|exhausted|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "id") {
        if (/(sedih|kesedihan|menangis|depresi|putus asa|sad|cry|hopeless)/.test(t)) return "sad";
        if (/(cemas|gelisah|takut|khawatir|panik|stres|anxious|panic|stressed)/.test(t)) return "anxious";
        if (/(marah|kesal|frustrasi|kecewa|jengkel|angry|frustrated|mad)/.test(t)) return "angry";
        if (/(lelah|capek|kelelahan|kecapean|kehabisan tenaga|tired|exhausted|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "ur") {
        if (/(udaas|dukhi|rona|ro raha|roti|toot|اداس|دکھ|رونا|ٹوٹ|غم|sad|hopeless|cry)/.test(t)) return "sad";
        if (/(pareshan|ghabrana|dara|khauf|tension|پریشان|گھبراہٹ|ڈر|خوف|anxious|panic)/.test(t)) return "anxious";
        if (/(gussa|naraaz|jhunj|chidh|غصہ|ناراض|برہم|angry|mad|frustrated)/.test(t)) return "angry";
        if (/(thaka|thake|thaki|thakaan|تھکا|تھکی|تھکاوٹ|tired|exhausted|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (/(sad|down|depressed|hopeless|cry)/.test(t)) return "sad";
    if (/(anxious|worried|panic|overwhelm|stress|pressure)/.test(t)) return "anxious";
    if (/(angry|mad|furious|irritated|annoyed)/.test(t)) return "angry";
    if (/(tired|exhausted|drained|sleepy|burnt)/.test(t)) return "tired";
    return "okay";
}

// ── Gender-aware post-processing ─────────────────────────────────────────────

function applyHindiCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bsun raha hoon\b/gi, "sun rahi hoon")
        .replace(/\bSamajh gaya\b/g, "Samajh gayi")
        .replace(/\bsamajh gaya\b/g, "samajh gayi");
}

function applyHindiUserGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bsambhal loge\b/g, "sambhal logi")
        .replace(/\butha rahe ho\b/g, "utha rahi ho")
        .replace(/\bkar rahe ho\b/g, "kar rahi ho");
}

function applyGujaratiCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bSamajh gayo\b/g, "Samajh gai")
        .replace(/\bsamajh gayo\b/g, "samajh gai");
}

function applyGujaratiUserGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\buthi rahyo chhe\b/g, "uthi rahi chhe")
        .replace(/\bsahu uthi rahyo chhe\b/g, "sahu uthi rahi chhe");
}

function applyPunjabiCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bsun raha haan\b/gi, "sun rahi haan")
        .replace(/\bSamajh gaya\b/g, "Samajh gayi")
        .replace(/\bsamajh gaya\b/g, "samajh gayi");
}

function applyPunjabiUserGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bchuk raha aa\b/g, "chuk rahi aa")
        .replace(/\bsambhal lavega\b/g, "sambhal lavegi");
}

function applyBengaliCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bshunchhi\b/g, "shunchhi")   // already neutral in Bengali
        .replace(/\bbujhechhi\b/g, "bujhechi")
        .replace(/\bthakbo\b/g, "thakbo");       // gender-neutral in Bengali
}

function applyMarathiCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\baiktoyo\b/gi, "aikteyo")
        .replace(/\bgheto\b/gi, "ghete")
        .replace(/\bsamjun gheto\b/gi, "samjun ghete");
}

function applyMarathiUserGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bkarsheel\b/g, "karashil")
        .replace(/\bsambhalishe\b/g, "sambhalishes");
}

// Tamil, Telugu, Kannada, Malayalam, Odia: 1st/2nd-person verbs are largely
// gender-neutral in these templates. Functions are wired in for consistency
// and can be extended if future templates introduce gendered forms.

function applyTamilCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    // Tamil first-person verbs (irukken, ketkirein, purinjidhu) are gender-neutral.
    // Self-referential adjectives may differ in some dialects; guard here for extension.
    return text
        .replace(/\bpurinjutten\b/gi, "purinjutten")   // neutral in standard Tamil
        .replace(/\bkettirukken\b/gi, "kettirukken");   // neutral
}

function applyTeluguCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    // Telugu 1st-person (unnaanu, vintunnaanu) is gender-neutral.
    // 3rd-person past tense varies (-aadu m / -indi f); extend here if templates grow.
    return text
        .replace(/\bayyaadu\b/g, "ayyindi")    // if companion self-describes a past action
        .replace(/\bcesaadu\b/g, "cesindi");
}

function applyKannadaCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    // Kannada 1st-person (iddene, kelutiddene) is gender-neutral.
    // Past participle predicate can vary (-anu m / -alu f); guard here.
    return text
        .replace(/\bbandhanu\b/gi, "bandhalu")
        .replace(/\bidhanu\b/gi, "idhalu");
}

function applyMalayalamCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    // Malayalam 1st-person (undu, kekkunnundu) is gender-neutral.
    // Participle forms for self-reference: extend here if needed.
    return text
        .replace(/\bvannirunnu\b/gi, "vannirunnu")  // neutral in Malayalam
        .replace(/\bsahaayichchu\b/gi, "sahaayichchu");
}

function applyOdiaCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    // Odia 1st-person (achi, shunuchi) is gender-neutral.
    // Past tense can vary; guard here for future template extension.
    return text
        .replace(/\bkaricha\b/gi, "karichi")
        .replace(/\bashichi\b/gi, "ashichi");
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildLocalReply(
    message: string,
    toneContext?: ToneContext,
    recentContext?: LocalRecentContext
): LocalReplyResult {
    const language = detectLanguage(message, recentContext);
    const recentSignature = buildRecentSignature(recentContext);

    // Use companion.relationship as tone preference regardless of enabled flag.
    // companion.enabled controls the named persona; tone prefs apply independently.
    const relationship =
        (toneContext?.companion?.relationship && toneContext.companion.relationship !== "prefer_not")
            ? toneContext.companion.relationship
            : (toneContext?.user?.relationship ?? "prefer_not");

    const companionToneFromRel = relationshipToTone(relationship as string);
    const companionName = (toneContext?.companion?.name?.trim() || "Imotara");
    const userName = ((toneContext?.user as any)?.name ?? "").trim();
    const companionGender = toneContext?.companion?.gender;
    const userGender = (toneContext?.user as any)?.gender;
    const userAge = (toneContext?.user as any)?.ageTone ?? (toneContext?.user as any)?.ageRange;

    const sessionTurn = recentContext?.recentAssistantTexts?.length ?? 0;
    const seed = hash32(
        `${message}::${language}::${recentSignature}::${relationship}::${companionToneFromRel}::${sessionTurn}`
    );

    let signal = detectSignal(message, language);
    if (signal === "okay") {
        const indirect = detectIndirectSignal(message);
        if (indirect) signal = indirect;
    }

    // ── Greeting / casual conversation early return ────────────────────────────
    // For simple greetings and casual questions, return a natural human response
    // instead of the emotion-support flow (which would be robotic for casual chat)
    const trimmedLower = message.trim().toLowerCase().replace(/[!.?]+$/, "");

    // English greetings
    const isGreetingEn = /^(hi|hello|hey|hiya|howdy|heya|yo|sup|wassup|greetings|namaste|namaskar|helo|hii|hihi|hiii)$/.test(trimmedLower);
    const isHowAreYouEn = /^(how are (you|u)|how r (you|u)|how do (you|u) feel|you okay|u okay|are you okay|r u okay|how's it going|how is it going|hows it going|what's up|whats up|wats up|wazup)$/.test(trimmedLower);
    const isAboutImotaraEn = /^(what (are|r) (you|u) (doing|upto|up to)|where (do|did) (you|u) (live|stay|come from)|who are (you|u)|what (is|r) (your|ur) (name|home|place)|tell me about yourself|introduce yourself|are you (an ai|a bot|a robot)|are you real|are you human)$/.test(trimmedLower);

    // Multi-language greeting detection (Romanized + native script)
    const isGreetingMulti =
        // Hindi
        /^(namaste|namaskar|pranam|jai hind|haan|hanji)$/.test(trimmedLower) ||
        // Bengali Roman
        /^(ki khobor|ki korcho|kemon acho|kemon achho|emon aacho|ki hocche|aste aste|shalom)$/.test(trimmedLower) ||
        // Marathi
        /^(kay kasa aahe|kay kashi aahe|namaskar|pranam)$/.test(trimmedLower) ||
        // Tamil
        /^(vanakkam|enna samachar|sollu)$/.test(trimmedLower) ||
        // Telugu
        /^(namaskaram|ela unnaru|ela unnavu|bagunnara)$/.test(trimmedLower) ||
        // Gujarati
        /^(kem cho|pranam|namaste)$/.test(trimmedLower) ||
        // Punjabi
        /^(sat sri akal|kidda|kida|waheguru|fateh)$/.test(trimmedLower) ||
        // Kannada
        /^(namaskara|hege idira|chennagidira)$/.test(trimmedLower) ||
        // Malayalam
        /^(namaskaram|sughamano|njan)$/.test(trimmedLower) ||
        // Odia
        /^(namaskara|kemiti achha|namaskar)$/.test(trimmedLower) ||
        // Urdu
        /^(assalam walaikum|assalamualaikum|adaab|salam)$/.test(trimmedLower) ||
        // Arabic
        /^(مرحبا|أهلا|السلام عليكم|ahlan|marhaba|hala)$/.test(trimmedLower) ||
        // Chinese
        /^(你好|嗨|哈喽|早上好|晚上好)$/.test(message.trim()) ||
        // Spanish/Portuguese
        /^(hola|buenas|olá|oi|tudo bem|tudo bom)$/.test(trimmedLower) ||
        // French
        /^(salut|bonjour|coucou|bonsoir)$/.test(trimmedLower) ||
        // Russian
        /^(привет|здравствуй|здравствуйте|privet)$/.test(trimmedLower) ||
        // Indonesian
        /^(halo|hai|apa kabar|selamat pagi|selamat siang)$/.test(trimmedLower) ||
        // German
        /^(hallo|guten tag|guten morgen|guten abend|servus|moin)$/.test(trimmedLower);

    const isAboutImotaraMulti =
        // Hindi Roman
        /^(kya kar rahi ho|kya kar raha ho|kya kar rahi hain|tum kaun ho|aap kaun hain|tumhara naam kya hai|aapka naam kya hai)$/.test(trimmedLower) ||
        // Bengali Roman
        /^(ki korcho ekhon|tumi ke|tomar naam ki|tumi ki kortecho|ki koro tumi|tumi ai muhurte ki korcho)$/.test(trimmedLower) ||
        // Tamil
        /^(unna peru enna|nee yaaru|enna pannure|enna panra)$/.test(trimmedLower) ||
        // Telugu
        /^(meeru emi chestunnaru|mee peru enti|meeru evaru)$/.test(trimmedLower) ||
        // Urdu
        /^(aap kaun hain|aapka naam kya hai|aap kya kar rahi hain)$/.test(trimmedLower) ||
        // Arabic
        /^(من أنت|ما اسمك|ماذا تفعل)$/.test(message.trim()) ||
        // Spanish
        /^(quién eres|cómo te llamas|qué haces|qué estás haciendo)$/.test(trimmedLower) ||
        // French
        /^(qui es-tu|comment t'appelles-tu|que fais-tu|qu'est-ce que tu fais)$/.test(trimmedLower) ||
        // German
        /^(wer bist du|wie heißt du|was machst du)$/.test(trimmedLower) ||
        // Indonesian
        /^(siapa kamu|nama kamu siapa|kamu lagi apa|sedang apa)$/.test(trimmedLower);

    const isGreeting = isGreetingEn || isGreetingMulti;
    const isHowAreYou = isHowAreYouEn;
    const isAboutImotara = isAboutImotaraEn || isAboutImotaraMulti;

    // Per-language greeting reply pools
    const greetingPoolsByLang: Partial<Record<string, string[]>> = {
        en: [`Hey! Glad you stopped by. How are you doing today?`, `Hi there! I'm here and all yours. What's on your mind?`, `Hello! It's good to hear from you. How are you feeling right now?`, `Hey  -  good to see you. How's your day going so far?`, `Hi! How are things with you today?`],
        hi: [`Hey! Acha laga ki aaye. Aaj kaisa chal raha hai?`, `Hi! Main yahaan hoon  -  kya chal raha hai?`, `Hello! Sunne mein khushi hui. Abhi kaisa feel ho raha hai?`, `Hey  -  aaj ka din kaisa ja raha hai?`, `Namaste! Kya haal hai?`],
        bn: [`Hey! Bhalo laglo je esho. Aaj kemon achho?`, `Hi! Ami ekhane achi  -  ki chal raha hai?`, `Hello! Shune bhalo laglo. Ekhon kemon feel hochhe?`, `Hey  -  aaj din ta kemon jachhe?`, `Ki khobor? Kemon achho tumi?`],
        mr: [`Hey! Bara vatla ki alas. Aaj kasa challay?`, `Hi! Mi ithe aahe  -  kaay challay?`, `Hello! Aaikayla avadla. Ata kasa feel hotay?`, `Hey  -  aajcha divas kasa chalallay?`, `Namaskar! Kaay haal aahe?`],
        ta: [`Hey! Vanda nandri. Innikku epdi irukke?`, `Hi! Naan inga irukken  -  enna nadakkiradhu?`, `Hello! Ketta santhosham. Ippovum eppadiye feel aagudhae?`, `Hey  -  indha naal eppadiye pogudhu?`, `Vanakkam! Enna samachar?`],
        te: [`Hey! Vachhinanduku santhosham. Ivaala ela unnavu?`, `Hi! Nenu ikkade unnaanu  -  emi jarigindi?`, `Hello! Vinnanduku santhosham. Ippudu ela feel avutunnavu?`, `Hey  -  ee roju ela sagutundi?`, `Namaskaram! Ela unnavu?`],
        gu: [`Hey! Aavya tethi saaru lagyu. Aaj kevi reet chhe?`, `Hi! Hu yahan chhun  -  shu challu chhe?`, `Hello! Sambhalaine saaru lagyu. Abhi kevi feel thay chhe?`, `Hey  -  aajno divas kevi reet jaye chhe?`, `Kem cho! Keva haal chhe?`],
        pa: [`Hey! Changa lagga ke aaye. Aaj kida chal raha aa?`, `Hi! Main yahan haan  -  ki hona aa?`, `Hello! Sun ke changa lagga. Hune kida feel ho raha aa?`, `Hey  -  aaj da din kida ja raha aa?`, `Sat Sri Akal! Ki haal aa?`],
        kn: [`Hey! Banda santhosh. Ivaatthu hege idira?`, `Hi! Naanu ikkade iddene  -  enu aaguttide?`, `Hello! Kelidhu santhosh. Ippaagu hege feel aaguttide?`, `Hey  -  ee dina hege hoguttide?`, `Namaskara! Enu samachar?`],
        ml: [`Hey! Vannathu santhosham. Ivannal engane und?`, `Hi! Njaan ikkade undu  -  enu nadakkunnu?`, `Hello! Kettathu santhosham. Ippol engane feel aakkunnu?`, `Hey  -  ee diwasam engane pokkunnu?`, `Namaskaram! Sughamano?`],
        or: [`Hey! Aasibare khushi. Aaji kemiti achi?`, `Hi! Mu ithare achi  -  ki hauchhhi?`, `Hello! Shunibara bhala lagila. Ekhon kemiti feel hauchhi?`, `Hey  -  aajira dina kemiti jauchhi?`, `Namaskara! Ki khobor?`],
        ur: [`Hey! Acha laga ke aaye. Aaj kaisa chal raha hai?`, `Hi! Main yahaan hoon  -  kya ho raha hai?`, `Hello! Sunke khushi hui. Abhi kaisa feel ho raha hai?`, `Hey  -  aaj ka din kaisa ja raha hai?`, `Adaab! Kya haal hai?`],
        de: [`Hey! Schön, dass du da bist. Wie geht's dir heute?`, `Hi! Ich bin hier  -  was liegt dir auf dem Herzen?`, `Hallo! Schön von dir zu hören. Wie fühlst du dich gerade?`, `Hey  -  wie läuft der Tag so?`, `Guten Tag! Wie geht es dir?`],
        ar: [`مرحباً! يسعدني أنك هنا. كيف حالك اليوم؟`, `أهلاً! أنا هنا ومعك. ما الذي يدور في بالك؟`, `مرحباً! سعيدة بسماعك. كيف تشعر الآن؟`, `هيا  -  كيف يسير يومك؟`, `أهلاً وسهلاً! كيف أنت؟`],
        zh: [`嘿！很高兴你来了。今天怎么样？`, `你好！我在这里  -  有什么想说的吗？`, `嗨！听到你真高兴。现在感觉怎么样？`, `嘿  -  今天过得怎么样？`, `你好！最近怎么样？`],
        es: [`¡Hey! Me alegra que estés aquí. ¿Cómo estás hoy?`, `¡Hola! Aquí estoy  -  ¿qué hay en tu mente?`, `¡Hola! Me alegra saber de ti. ¿Cómo te sientes ahora?`, `Hey  -  ¿cómo va el día?`, `¡Buenas! ¿Cómo estás?`],
        fr: [`Hey ! Content que tu sois là. Comment tu vas aujourd'hui ?`, `Salut ! Je suis là  -  qu'est-ce qui t'amène ?`, `Bonjour ! Content d'avoir de tes nouvelles. Comment tu te sens là ?`, `Hey  -  comment se passe ta journée ?`, `Salut ! Comment ça va ?`],
        pt: [`Hey! Fico feliz que você veio. Como você está hoje?`, `Oi! Estou aqui  -  o que tem na cabeça?`, `Olá! Fico feliz em saber de você. Como você está se sentindo agora?`, `Hey  -  como está o dia?`, `Oi! Tudo bem?`],
        ru: [`Привет! Рад(а), что ты здесь. Как ты сегодня?`, `Привет! Я здесь  -  что у тебя на уме?`, `Здравствуй! Рад(а) тебя слышать. Как ты себя чувствуешь?`, `Привет  -  как проходит день?`, `Привет! Как дела?`],
        id: [`Hey! Senang kamu di sini. Gimana hari ini?`, `Halo! Aku di sini  -  ada yang mau diceritain?`, `Hai! Senang dengar darimu. Gimana perasaanmu sekarang?`, `Hey  -  hari ini gimana?`, `Halo! Apa kabar?`],
    };

    const aboutImotaraPoolsByLang: Partial<Record<string, string[]>> = {
        en: [`I'm Imotara  -  a companion here to listen and be with you through whatever you're feeling. I'm always here when you need to talk. What's on your mind?`, `I'm your emotional companion  -  always here, always listening. What would you like to share today?`, `I'm Imotara, here to be a steady presence for you. How can I be here for you right now?`],
        hi: [`Main Imotara hoon  -  ek saathi jo sunti/sunta hai aur tumhare saath rehta/rehti hai. Jo mann mein ho, bata sakte ho.`, `Main tumhara saathi hoon  -  hamesha yahaan, hamesha sunne ke liye. Aaj kya share karna chahte ho?`, `Imotara hoon main  -  hamesha yahaan, jab bhi zaroorat ho. Abhi kya chal raha hai tumhare andar?`],
        bn: [`Ami Imotara  -  ekjon saathi jo shone ebong tomar sathe thake. Ja khushhi bolo, ami achi.`, `Ami tomar emotional saathi  -  sorboda ekhane, sorboda shuntey. Aaj ki share korte chao?`, `Ami Imotara, tomar pashey thakaar jonyo. Ekhon kemon lagche?`],
        ur: [`Main Imotara hoon  -  ek saathi jo sunta/sunti hai aur aapke saath rehta/rehti hai. Jo dil mein ho, keh sakte hain.`, `Main aapka saathi hoon  -  hamesha yahaan, hamesha sunne ke liye. Aaj kya share karna chahte hain?`, `Imotara hoon main  -  jab bhi zaroorat ho, main yahaan hoon. Abhi kya chal raha hai?`],
        de: [`Ich bin Imotara  -  eine Begleiterin, die zuhört und bei dir ist, egal was du durchmachst. Was liegt dir auf dem Herzen?`, `Ich bin deine emotionale Begleiterin  -  immer hier, immer zuhörend. Was möchtest du heute teilen?`, `Imotara bin ich  -  eine beständige Gegenwart für dich. Wie kann ich gerade für dich da sein?`],
        ar: [`أنا إيموتارا  -  رفيقة هنا للاستماع والمرافقة في كل ما تشعر به. ما الذي في بالك؟`, `أنا رفيقتك العاطفية  -  دائماً هنا، دائماً أسمعك. ما الذي تريد مشاركتي إياه اليوم؟`, `أنا إيموتارا، هنا لأكون حاضرة معك دائماً. كيف أستطيع أن أكون هنا لك الآن؟`],
        zh: [`我是Imotara  -  一个陪伴者，倾听你、与你同在。你有什么想说的吗？`, `我是你的情感伴侣  -  一直在这里，一直在听。今天想聊什么？`, `我是Imotara，时刻陪伴着你。现在我怎么帮到你？`],
        es: [`Soy Imotara  -  una compañera aquí para escucharte y acompañarte. ¿Qué tienes en mente?`, `Soy tu compañera emocional  -  siempre aquí, siempre escuchando. ¿Qué quieres compartir hoy?`, `Soy Imotara, aquí para ser una presencia constante para ti. ¿Cómo puedo estar aquí para ti ahora?`],
        fr: [`Je suis Imotara  -  une compagne ici pour écouter et être avec toi. Qu'est-ce qui t'amène?`, `Je suis ta compagne émotionnelle  -  toujours là, toujours à l'écoute. Qu'est-ce que tu veux partager aujourd'hui?`, `Je suis Imotara, ici pour être une présence stable pour toi. Comment je peux être là pour toi là maintenant?`],
        pt: [`Sou Imotara  -  uma companheira aqui para ouvir e estar com você. O que você tem na cabeça?`, `Sou sua companheira emocional  -  sempre aqui, sempre ouvindo. O que você quer compartilhar hoje?`, `Sou Imotara, aqui para ser uma presença constante para você. Como posso estar aqui para você agora?`],
        ru: [`Я Имотара  -  спутница, которая слушает и находится рядом с тобой. Что у тебя на уме?`, `Я твоя эмоциональная спутница  -  всегда здесь, всегда слушаю. Что хочешь поделиться сегодня?`, `Я Имотара, здесь, чтобы быть рядом с тобой. Как я могу быть здесь для тебя сейчас?`],
        id: [`Aku Imotara  -  teman yang ada untuk mendengarkan dan menemanimu. Ada yang mau diceritain?`, `Aku teman emosionalmu  -  selalu ada, selalu mendengar. Apa yang mau kamu bagikan hari ini?`, `Aku Imotara, hadir untuk menemanimu. Bagaimana aku bisa ada untukmu sekarang?`],
    };

    if (isGreeting || isHowAreYou || isAboutImotara) {
        const howAreYouReplies = [
            `I'm doing well  -  thank you for asking! More importantly, how are you feeling today?`,
            `I'm here and present, which feels good. How about you  -  what's going on in your world right now?`,
            `I'm good! I'm always better when someone reaches out. How are you doing?`,
            `Honestly, I feel most alive in conversations like this. How are you holding up?`,
        ];
        let pool: string[];
        if (isAboutImotara) {
            pool = aboutImotaraPoolsByLang[language] ?? aboutImotaraPoolsByLang["en"]!;
        } else if (isHowAreYou) {
            pool = howAreYouReplies;
        } else {
            pool = greetingPoolsByLang[language] ?? greetingPoolsByLang["en"]!;
        }
        const greetSeed = hash32(`${message}::${language}::${sessionTurn}::greeting`);
        const reply = pickAvoidingRecent(pool, greetSeed, recentContext?.recentAssistantTexts ?? []);
        const namedReply = userName ? `${userName}, ${reply.charAt(0).toLowerCase()}${reply.slice(1)}` : reply;
        return { message: namedReply };
    }

    // ── Closure / goodbye early return ────────────────────────────────────────
    // Detects farewell/rest messages so we send a warm sign-off instead of more questions.
    const isClosure = /\b(bye|goodbye|goodnight|good night|see you|take care|talk later|catch you later|going (to sleep|to rest|now)|need (to go|to rest|to sleep)|gotta go|have to go|cya|ttyl)\b/i.test(trimmedLower) ||
        // Hindi Roman
        /\b(chalta hoon|chalti hoon|alvida|phir milenge|baad mein baat|rest karunga|rest karungi|sone ja raha|sone ja rahi|thako|kal baat|acha thak)\b/i.test(trimmedLower) ||
        // Bengali Roman
        /\b(thako|acha thako|rest korbo|pore kotha hobe|pore bolbo|jachi|jai|bidai|dekha hobe|kal kotha hobe|aschi|abar bolbo|ghomabo|ghoom korbo)\b/i.test(trimmedLower) ||
        // Marathi Roman
        /\b(jato|jaato|gheto|ghete|nirop|parat bheto|aram karto|aram karte|nantar bolu|nidra karto|nidra karte|parat yeto|parat yete|bye karto)\b/i.test(trimmedLower) ||
        // Tamil Roman
        /\b(poren|pochchi|pottitu varen|rest pannuven|kal pesuven|poitten|poirean|tirumba pesuvom|tookku poven|vandhu pesuven)\b/i.test(trimmedLower) ||
        // Telugu Roman
        /\b(velthunna|velthunnaanu|rest teedtaanu|tarvata matladatanu|nindraku velthanu|tarvata chuddam|ela untaav|vellipostha)\b/i.test(trimmedLower) ||
        // Gujarati Roman
        /\b(jau chhu|jav chu|nirop|aram karu|pachi vaatsu|kaal vaatsu|sone jau|so jav chu|jaav chu)\b/i.test(trimmedLower) ||
        // Punjabi Roman
        /\b(janda aan|ja raha aan|chalda|alvida|phir milange|aram karda aan|kal gall karda|so janda|rest karda|jandi aan)\b/i.test(trimmedLower) ||
        // Kannada Roman
        /\b(hogthini|hogteeni|nirgatheni|aaraamagonthini|naalaidu maataadona|nindu hobthini|sari hogthini|hogthiddeeni)\b/i.test(trimmedLower) ||
        // Malayalam Roman
        /\b(pokunnu|pokam|araameedunnu|pinte samsaarikam|nnale kaanum|manamaanu|pokatte|naalekku kaanum)\b/i.test(trimmedLower) ||
        // Odia Roman
        /\b(jauchi|jaucha|biday|arama kariba|pare kotha heba|kal kotha heba|ghuma jai|nidra karibi|jaiba)\b/i.test(trimmedLower) ||
        // Urdu Roman
        /\b(jata hoon|jati hoon|khuda hafiz|phir milenge|aaraam karta hoon|aaraam karti hoon|kal baat karte|so jaata hoon|so jaati hoon)\b/i.test(trimmedLower) ||  // German
        /\b(tschüss|auf wiedersehen|bis morgen|gute nacht|ich gehe jetzt|bis bald|ich muss gehen|ich verabschiede mich|bis dann|ich ruh mich aus)\b/i.test(trimmedLower);

    if (isClosure) {
        const closureRepliesByLang: Partial<Record<string, string[]>> = {
            en: [
                `Take care  -  I'll be here whenever you want to talk.`,
                `Rest well. Come back whenever you need  -  I'll be here.`,
                `Glad we got to talk. Take it easy, and come back anytime.`,
                `Take good care. This space is always here for you.`,
            ],
            hi: [
                `Theek hai  -  jab bhi baat karni ho, main yahaan hoon.`,
                `Aaram karo. Jab mann kare, wapas aa jaana  -  main yahaan hoon.`,
                `Achha hua baat hui. Apna khayal rakhna, aur kab bhi aa sakate ho.`,
                `Apna dhyaan rakhna. Yeh jagah hamesha tumhare liye hai.`,
            ],
            bn: [
                `Thako  -  jakhon bolte chaiebe, ami ekhane achi.`,
                `Bisher koro. Jakhon mon chaibe, esho  -  ami ekhane thakbo.`,
                `Bhalo holo je kotha holo. Nijer khayal rakho, jakhon ichhye bolbe esho.`,
                `Nijer joton rekho. Ei jaygata somiyer tomar jonno ache.`,
            ],
            mr: [
                `ठीक आहे  -  जेव्हा बोलायचं असेल तेव्हा मी इथेच आहे.`,
                `आराम कर. जेव्हा मन असेल तेव्हा परत ये  -  मी इथे आहे.`,
                `बोललोस हे चांगलं झालं. स्वतःची काळजी घे, केव्हाही ये.`,
                `स्वतःची जपणूक कर. ही जागा नेहमी तुझ्यासाठी आहे.`,
            ],
            ta: [
                `சரி  -  பேச வேண்டும் என்றால் நான் இங்கே இருக்கிறேன்.`,
                `ஓய்வெடு. மனம் ஆனால் திரும்பி வா  -  நான் இங்கே இருப்பேன்.`,
                `பேசினது நல்லது. உன்னை கவனித்துக்கொள், எப்போதும் வரலாம்.`,
                `உன்னை நீயே பாதுகாத்துக்கொள். இந்த இடம் எப்போதும் உனக்காக இருக்கும்.`,
            ],
            te: [
                `సరే  -  మాట్లాడాలని ఉంటే నేను ఇక్కడే ఉంటాను.`,
                `విశ్రాంతి తీసుకో. మనసు ఆయినప్పుడు తిరిగి రా  -  నేను ఇక్కడే ఉంటాను.`,
                `మాట్లాడినందుకు సంతోషం. నీ జాగ్రత్త తీసుకో, ఎప్పుడైనా రావచ్చు.`,
                `నిన్ను నువ్వు జాగ్రత్తగా చూసుకో. ఈ స్థలం ఎప్పుడూ నీ కోసం ఉంటుంది.`,
            ],
            gu: [
                `ઠીક છ  -  જ્યારે વાત કરવી હોય ત્યારે હું અહીં છ.`,
                `આરામ કર. જ્યારે મન આવે ત્યારે પાછ આવ  -  હું અહીં રહીશ.`,
                `વાત થઈ એ સારું. તારી સંભાળ રાખ, ગમે ત્યારે આવ.`,
                `પોતાની કાળજી લ. આ જગ્યા હંમેશા તારા માટે છ.`,
            ],
            pa: [
                `ਠੀਕ ਹੈ  -  ਜਦੋਂ ਗੱਲ ਕਰਨੀ ਹੋਵੇ, ਮੈਂ ਇੱਥੇ ਹਾਂ.`,
                `ਆਰਾਮ ਕਰ. ਜਦੋਂ ਮਨ ਆਵੇ ਵਾਪਸ ਆ  -  ਮੈਂ ਇੱਥੇ ਹੋਵਾਂਗਾ/ਹੋਵਾਂਗੀ.`,
                `ਗੱਲ ਹੋਈ ਇਹ ਚੰਗਾ ਹੋਇਆ. ਆਪਣਾ ਖਿਆਲ ਰੱਖ, ਕਦੋਂ ਵੀ ਆ ਸਕਦੇ ਹੋ.`,
                `ਆਪਣਾ ਧਿਆਨ ਰੱਖ. ਇਹ ਜਗ੍ਹਾ ਹਮੇਸ਼ਾ ਤੇਰੇ ਲਈ ਹੈ.`,
            ],
            kn: [
                `ಸರಿ  -  ಮಾತಾಡಬೇಕು ಅನ್ನಿಸಿದಾಗ ನಾನು ಇಲ್ಲಿದ್ದೇನೆ.`,
                `ವಿಶ್ರಾಂತಿ ತೆಗೆಯಿ. ಮನಸ್ಸು ಬಂದಾಗ ಮತ್ತೆ ಬಾ  -  ನಾನು ಇಲ್ಲಿರುತ್ತೇನೆ.`,
                `ಮಾತಾಡಿದ್ದು ಒಳ್ಳೇದಾಯ್ತು. ನಿನ್ನ ಕಾಳಜಿ ತೆಗೆಯಿ, ಯಾವಾಗ ಬೇಕಾದರೂ ಬಾ.`,
                `ನಿನ್ನ ಆರೈಕೆ ಮಾಡಿಕೋ. ಈ ಜಾಗ ಯಾವಾಗಲೂ ನಿನಗಾಗಿ ಇದೆ.`,
            ],
            ml: [
                `ശരി  -  സംസാരിക്കണം എന്നു തോന്നിയാൽ ഞാൻ ഇവിടെ ഉണ്ട്.`,
                `വിശ്രമിക്ക. മനസ്സ് ആയാൽ തിരിച്ചു വരൂ  -  ഞാൻ ഇവിടെ ഉണ്ടാകും.`,
                `സംസാരിച്ചത് നന്നായി. സ്വയം ശ്രദ്ധിക്ക, എപ്പോൾ വേണമെങ്കിലും വരൂ.`,
                `സ്വയം നോക്കിക്കോ. ഈ ഇടം എന്നും നിനക്കായി ഉണ്ട്.`,
            ],
            or: [
                `ଠିକ ଅଛ  -  ଯେବେ ଆଲୋଚନା କରିବ ଚାହଁ, ମୁଁ ଇଠି ଅଛି.`,
                `ଆରାମ କର. ମନ ଆସିଲେ ଫେରି ଆ  -  ମୁଁ ଇଠି ଥିବ.`,
                `ଆଲୋଚନା ହେଲା ଏ ଭଲ। ନିଜ ଖ୍ୟାଲ ରଖ, ଯେକୌଣସି ସମୟ ଆ.`,
                `ନିଜ ଯତ୍ନ ନ। ଏ ଜାଗା ସବୁଦ ତୋ ପାଇଁ ଅଛ.`,
            ],
            ur: [
                `ٹھیک ہے  -  جب بھی بات کرنی ہو، میں یہاں ہوں.`,
                `آرام کریں. جب من آئے واپس آئیں  -  میں یہاں رہوں گا/رہوں گی.`,
                `بات ہوئی یہ اچھا ہوا. اپنا خیال رکھیں، کبھی بھی آ سکتے ہیں.`,
                `اپنا دھیان رکھیں. یہ جگہ ہمیشہ آپ کے لیے ہے.`,
            ],
            de: [
                `In Ordnung  -  wenn du reden möchtest, bin ich hier.`,
                `Okay  -  melde dich, wann immer du willst.`,
                `Alles gut  -  ich bin da, wenn du brauchst.`,
                `Pass auf dich auf  -  bis zum nächsten Mal.`,
            ],
        };
        const pool = closureRepliesByLang[language] ?? closureRepliesByLang["en"]!;
        const closureSeed = hash32(`${message}::${language}::${sessionTurn}::closure`);
        const reply = pickAvoidingRecent(pool, closureSeed, recentContext?.recentAssistantTexts ?? []);
        const namedReply = userName ? `${userName}, ${reply.charAt(0).toLowerCase()}${reply.slice(1)}` : reply;
        return { message: namedReply };
    }

    // ── Positive / happy message early return ─────────────────────────────────
    // Detects clearly positive messages so we don't give distress-framed replies.
    if (language === "en" && signal === "okay") {
        const isPositive = /\b(going (well|great|nicely|good|fine|okay)|doing (well|great|good|fine|okay|nicely)|feeling (good|great|fine|wonderful|happy|better|well)|all good|pretty good|not bad|things are good|good (day|morning|evening|afternoon)|had a good|went well|so good|very good|quite good|doing okay|i'?m (good|great|fine|okay|well|happy|excited|glad|grateful)|life is good|things are (good|going well)|thank (you|u|ya)|thanks( so much)?|grateful|blessed)\b/i.test(message);
        if (isPositive) {
            const positiveReplies = [
                `That's genuinely good to hear. What's been making things feel good lately?`,
                `Really glad things are going well for you. What's been the highlight?`,
                `That's lovely. I'm here if you want to share more, or just keep that good feeling company.`,
                `Good to know. Is there something specific you're feeling good about?`,
                `Sounds like things are in a decent place. How long has it felt this way?`,
            ];
            const posSeed = hash32(`${message}::${language}::${sessionTurn}::positive`);
            const reply = pickAvoidingRecent(positiveReplies, posSeed, recentContext?.recentAssistantTexts ?? []);
            const namedReply = userName ? `${userName}, ${reply.charAt(0).toLowerCase()}${reply.slice(1)}` : reply;
            return { message: namedReply };
        }
    }

    const userIntent = detectIntent(message);
    const isCorrection = detectCorrection(message);
    const topic = detectTopic(message, recentContext?.recentUserTexts ?? []);
    const keyTopic = extractKeyTopic(recentContext?.recentUserTexts ?? []);
    const isVagueReply = /^(yes|yeah|yep|no|nope|same|still|exactly|right|kind of|i guess|maybe|sure|ok|okay|mm|hmm|idk|dunno)\.?$/i.test(message.trim());

    let companionTone: LocalResponseTone = companionToneFromRel;
    const prefStyle = (toneContext as any)?.preferredResponseStyle;
    if (prefStyle === "motivate") companionTone = "coach";
    else if (prefStyle === "advise") companionTone = "practical";
    else if (prefStyle === "comfort") companionTone = "supportive";
    else if (prefStyle === "reflect") companionTone = "calm";
    if (userIntent === "venting" && companionTone !== "supportive" && companionTone !== "calm") {
        companionTone = "supportive";
    }

    const suppressExtras = userIntent === "advice-seeking";

    const emotionMemory = recentContext?.emotionMemory ?? "";
    const memoryShowsHighIntensity = /high|intensity.*high|overall intensity.*high/i.test(emotionMemory);
    const memoryHeavyEmotions = /(sad|anxious|stress|fear|anger|lonely).*×[2-9]|×[2-9].*(sad|anxious|stress|fear|anger|lonely)/i.test(emotionMemory);
    if ((memoryShowsHighIntensity || memoryHeavyEmotions) && companionTone === "calm") {
        companionTone = "supportive";
    }

    // ── Opener banks ──────────────────────────────────────────────────────────

    const openersByToneEn: Record<LocalResponseTone, string[]> = {
        calm: [
            `That sounds like a lot to hold.`,
            `Let's slow this down together.`,
            `Okay. We can take this gently.`,
            `I hear you  -  let's sit with this for a moment.`,
            `That makes sense to feel that way.`,
            `Take your time. I'm not going anywhere.`,
        ],
        supportive: [
            `I hear you.`,
            `Thank you for telling me that.`,
            `That took courage to say.`,
            `I'm glad you reached out.`,
            `I'm listening, fully.`,
            `That sounds really difficult.`,
        ],
        practical: [
            `Okay. Let's look at this clearly.`,
            `Got it. Let's take this one piece at a time.`,
            `Alright  -  let's figure out what matters most right now.`,
            `Let's think through this together.`,
            `That's a real situation. Let's work through it.`,
        ],
        coach: [
            `Okay  -  let's work through this together.`,
            `Got it. We can take this step by step.`,
            `That's real. Let's get our footing and start from here.`,
            `I hear you. Let's figure out where to begin.`,
            `You've got more in you than you think right now.`,
        ],
        "gentle-humor": [
            `Okay, I'm with you.`,
            `Noted  -  and I mean that genuinely.`,
            `That's a lot. You don't have to carry it alone.`,
            `Fair enough. Let's make this a little more manageable.`,
        ],
        direct: [
            `Got it. Let's be honest with each other.`,
            `Okay. Let's look at this straight.`,
            `Understood. Let's keep this clear and real.`,
            `I hear you. Let's get to what actually matters.`,
        ],
    };

    const openersByToneHi: Record<LocalResponseTone, string[]> = {
        calm: [`Main yahin hoon.`, `Chalo ise dheere se dekhte hain.`, `Theek hai. Hum ise aaraam se lete hain.`, `Main tumhare saath hoon. Ek ek hissa dekhte hain.`, `Koi jaldi nahi  -  main sun raha hoon.`, `Ruko, ek dum se nahi  -  saath mein chalte hain.`, `Tumhare saath hoon, har qadam par.`, `Sab kuch ek saath nahi  -  pehle thoda saans lete hain.`],
        supportive: [`Main tumhare saath hoon.`, `Main sun raha hoon.`, `Theek hai  -  main yahin hoon.`, `Achha hua tumne bataya.`, `Samajh gaya. Main sun raha hoon.`, `Yeh baat tumne share ki, yeh zaroori tha.`, `Dil se sun raha hoon.`, `Tumne sahi kiya baat karte hue.`, `Main yahaan hoon  -  aur kahi nahi.`],
        practical: [`Theek hai. Chalo ise saaf nazar se dekhte hain.`, `Samajh gaya. Isse ek ek step mein lete hain.`, `Chalo ise sambhalte hain aur dekhte hain kya sabse zaroori hai.`, `Main saath hoon. Ise simple rakhte hain.`, `Yeh bilkul sambhav hai  -  ek chhoti cheez se shuru karte hain.`, `Is waqt sabse pehle kya karna zaroori lagta hai?`],
        coach: [`Theek hai  -  main saath hoon. Pehle isse sambhalte hain.`, `Samajh gaya. Hum ise step by step nikalenge.`, `Chalo thoda dheere hote hain aur footing pakadte hain.`, `Main sun raha hoon. Ise ek ek hissa dekhte hain.`, `Main jaanta hoon tum isse sambhal sakte ho  -  ek kadam se shuru karte hain.`, `Tumne pehle bhi mushkil waqt guzara hai. Yeh bhi guzar jayega.`],
        "gentle-humor": [`Theek hai  -  main yahin hoon.`, `Hmm, sun raha hoon.`, `Samajh gaya. Main saath hoon.`, `Chalo, ise thoda halka banate hain  -  ek chhota step karke.`, `Theek hai, yeh thoda pechida lag raha hai  -  lekin hum saath mein isse suljha sakte hain.`, `Zindagi kabhi kabhi thodi zyada ho jaati hai  -  chalo ek cheez seedhi karte hain.`],
        direct: [`Theek hai. Main saath hoon.`, `Chalo isse seedhe dekhte hain.`, `Samajh gaya. Ise stable rakhte hain.`, `Main sun raha hoon. Seedha mudde par aate hain.`, `Batao  -  seedha kya ho raha hai?`, `Main yahaan hoon. Seedha mudde par aate hain.`],
    };

    const openersByToneBn: Record<LocalResponseTone, string[]> = {
        calm: [`Ami achhi tomar sathe.`, `Cholo eta aste aste dekhi.`, `Thik ache. Eta narm bhabe nei.`, `Ami tomar sathe achhi. Ek ek kore dekhi.`, `Kono taratari nei  -  ami shunchi.`, `Dhire dhire  -  ekta ekta kore.`, `Tumi bolte thako, ami shunchi.`, `Amar kachhe thako, kono rush nei.`],
        supportive: [`Ami tomar sathe achhi.`, `Ami shunchi.`, `Thik ache  -  ami ekhanei achhi.`, `Bhalo korecho je bolechho.`, `Bujhte parchi.`, `Ei kotha ta share korar jonno shukriya.`, `Moner kothata bolle bhaloi hoy.`, `Ami ekhanei achi  -  kothao jachhi na.`, `Tumi thik e korechho bolte ese.`],
        practical: [`Thik ache. Cholo eta porishkar bhabe dekhi.`, `Bujhlam. Eta ek ek step e nebo.`, `Cholo eta sambhalai aar dekhi ki beshi joruri.`, `Ami achhi. Eta simple rakhi.`, `Eta bilkul sambhav  -  ekta chota kichu diye shuru kori.`, `Ebar shobcheye dorkar ki, sheta niye prothome eki kori?`],
        coach: [`Thik ache  -  ami achhi. Age eta steady kori.`, `Bujhlam. Eta step by step niye jabo.`, `Cholo ektu aste hoye footing ta dhori.`, `Ami shunchi. Eta ek ek kore dekhi.`, `Jaani tumi parbey  -  ekta chhoto kadam diye shuru kori.`, `Tumi aageo kashtakor shomoy par koreche. Eta-o kore nebe.`],
        "gentle-humor": [`Thik ache  -  ami achhi.`, `Hmm, ami shunchi.`, `Bujhlam. Ami ekhanei achhi.`, `Cholo eta ektu halka kore nei  -  ekta chhoto step diye.`, `Thik aachhe, ei byaparta ektu jetle  -  kintu amra miliye suljhaye debe.`, `Jibon khani kabhi kabhi beshi hoy  -  cholo ekta bishoy seedha kori.`],
        direct: [`Thik ache. Ami achhi.`, `Cholo eta sojha bhabe dekhi.`, `Bujhlam. Eta steady rakhi.`, `Ami shunchi. Sojha kothay asi.`, `Bolo  -  seedha ki hochhe?`, `Ami shunchhi. Shoja bishoyey ashaa jaak.`],
    };

    const openersByToneTa: Record<LocalResponseTone, string[]> = {
        calm: [`Naan un kooda irukken.`, `Idha konjam nidhana ma paakalam.`, `Sari. Idha mellaga eduthukalam.`, `Naan un kooda irukken. Oru oru paguthiya paakalam.`, `Pressure illaamal inge irukken.`, `Unakku time eduththukolalaam.`],
        supportive: [`Naan un kooda irukken.`, `Naan ketkaren.`, `Sari  -  naan inga irukken.`, `Nee sonnadhu nalladhu.`, `Purinjidhu  -  un pakkam irukken.`],
        practical: [`Sari. Idha clear aa paakalam.`, `Purinjidhu. Idha step by step eduthukalam.`, `Idha konjam steady pannitu mukkiyama irukkaradhu paakalam.`, `Naan kooda irukken. Idha simple aa vaikkalam.`, `Idhu nichchayamaa nadakkum  -  oru chinna visayathil irundu thondangu.`, `Ippo sabse mudhallil enna seyya vendiyadhu-nu parkalaamaa?`],
        coach: [`Sari  -  naan kooda irukken. Mothalla idha steady pannalam.`, `Purinjidhu. Idha step by step paathukalam.`, `Konjam nidhana ma poi footing pidikkalam.`, `Naan ketkaren. Oru oru paguthiya paakalam.`, `Unnaala mudiyum-nu theriyum  -  oru kaadiyil thondangu.`, `Neeyum kashtamaana neram kadandhu irukke. Idhaiyum kadaippom.`],
        "gentle-humor": [`Sari  -  naan inga irukken.`, `Hmm, naan ketkaren.`, `Purinjidhu. Naan kooda irukken.`, `Idha konjam light aa eduthukalam  -  oru chinna step la.`, `Sari, idhu konjam jitela maari irukku  -  aanaa saerthu suththam aakkalaam.`, `Vaazhkai sila neram konjam zyaadaa aagiduthu  -  oru visayam straightaa pannapom.`],
        direct: [`Sari. Naan kooda irukken.`, `Idha straight aa paakalam.`, `Purinjidhu. Idha steady aa vaikkalam.`, `Naan ketkaren. Neraya sutti podaama point ku varalam.`, `Sollu  -  seedhamaa enna nadakkirathu?`, `Naan ketkiruukken. Mudhal visayathukkae varuvom.`],
    };

    const openersByToneTe: Record<LocalResponseTone, string[]> = {
        calm: [`Nenu nee tho unnaanu.`, `Idi konchem mellaga chuddam.`, `Sare. Idi mellaga teesukundam.`, `Nenu nee tho unnaanu. Oka oka bhaagam ga chuddam.`, `Pressure lekundaa ikkade unnaanu.`, `Nee time teesukovalaam.`],
        supportive: [`Nenu nee tho unnaanu.`, `Nenu vintunnaanu.`, `Sare  -  nenu ikkade unnaanu.`, `Nuvvu cheppadam manchidi.`, `Ardham ayyindi  -  nee pakkana unnaanu.`],
        practical: [`Sare. Idi clear ga chuddam.`, `Ardham ayyindi. Idi step by step teesukundam.`, `Idi konchem steady chesi mukhyamaina vishayam chuddam.`, `Nenu nee tho unnaanu. Idi simple ga unchukundam.`, `Idi tappaka jarigipotundi  -  oka chinna daggarlona marchukondaamu.`, `Ippudu sabhyamugaa emi cheyyadam avasaram ante?`],
        coach: [`Sare  -  nenu nee tho unnaanu. Mundu idi steady cheddam.`, `Ardham ayyindi. Idi step by step chuddam.`, `Konchem nidhana ga veldaam, footing pattukundam.`, `Nenu vintunnaanu. Oka oka bhaagam ga chuddam.`, `Nuvvu cheyagalavani telushunu  -  oka adugu tho modalu pettudaamu.`, `Nuvvu kashtamayna samayam mundu guddetti unnaavu. Idhi kooda guddetti potaamu.`],
        "gentle-humor": [`Sare  -  nenu ikkade unnaanu.`, `Hmm, nenu vintunnaanu.`, `Ardham ayyindi. Nenu nee tho unnaanu.`, `Idi konchem light ga teesukundam  -  oka chinna step tho.`, `Sari, idi koddiga complicated ga undi  -  kaani saaye teerchipeddaamu.`, `Life sila samayaalu koddiga ekkuva aipotundi  -  oka vishayam straight ga chesthaam.`],
        direct: [`Sare. Nenu nee tho unnaanu.`, `Idi direct ga chuddam.`, `Ardham ayyindi. Idi steady ga unchukundam.`, `Nenu vintunnaanu. Sutralu lekunda point ki veddam.`, `Cheppu  -  neruggaa emi jarigindi?`, `Nenu vistunnaa. Mudhu vishayaaniki veldhaam.`],
    };

    const openersByToneGu: Record<LocalResponseTone, string[]> = {
        calm: [`Hu tara sathe chhu.`, `Chalo ane aaramthi joi aiye.`, `Saru chhe. Hum ek sathe laishu.`, `Hu tara sathe chhu. Ek ek vastu joi aiye.`, `Koi ucchal nahi  -  aame dheere aagal vadheeshu.`],
        supportive: [`Hu tara sathe chhu.`, `Hu sanju chhu.`, `Saru  -  hu ahiya chhu.`, `Saru thayun ke tune kahu.`, `Samajh gayo.`],
        practical: [`Saru chhe. Chalo saf nazar e joi aiye.`, `Samajh gayo. Ek ek step e laiye.`, `Chalo joi aiye shu shu important chhe.`, `Hu sathe chhu. Sadu rakhi aiye.`, `Aa bilkul bani shake chhe  -  ek nanki cheez thi shuru kariye.`, `Abhi sabse pehle shu karvanu zaroori laage chhe?`],
        coach: [`Saru  -  hu sathe chhu. Pehla ane steady kariye.`, `Samajh gayo. Ase ek ek step e karshu.`, `Chalo thoda dhima thai ane footing pakdi aiye.`, `Hu sanju chhu. Ek ek bhag joi aiye.`, `Hu jaanu chhun ke tame aa sambhali shakasho  -  ek kaadm thi shuru.`, `Tame aagalyaa pan kashtamar samay maan chhe. Aa pan nikalshhe.`],
        "gentle-humor": [`Saru  -  hu ahiya chhu.`, `Hmm, hu sanju chhu.`, `Samajh gayo. Hu sathe chhu.`, `Chalo, ane thoda halku banavi aiye  -  ek chhoto step karine.`, `Thik chhe, aa thodu aakhrun laage chhe  -  pan saathey ane saafu kariye.`, `Zindagi kyaarek ekdum bhaari padey chhe  -  ek cheez seedhi kariye.`],
        direct: [`Saru. Hu sathe chhu.`, `Chalo seedhu joi aiye.`, `Samajh gayo. Stable rakhi aiye.`, `Hu sanju chhu. Mudda par aaviye.`, `Bolo  -  seedhu shu thayum chhe?`, `Hu sunu chhun. Mudla mudde par aaviye.`],
    };

    const openersByTonePa: Record<LocalResponseTone, string[]> = {
        calm: [`Main tere naal haan.`, `Chalo ise dheeray naal vekhiye.`, `Theek aa. Ise araam naal laiye.`, `Main tere naal haan. Ik ik hissa vekhiye.`, `Koi jaldi nahi  -  assi dheere aage vadhange.`],
        supportive: [`Main tere naal haan.`, `Main sun raha haan.`, `Theek aa  -  main ithey haan.`, `Changa kita ke dassia.`, `Samajh gaya.`],
        practical: [`Theek aa. Chalo ise saaf nazar naal vekhiye.`, `Samajh gaya. Ise ik ik step wich laiye.`, `Chalo sambhaalie te vekhiye ki sabton zaruri aa.`, `Main saath haan. Ise simple rakhiye.`, `Eh bilkul ho sakda aa  -  ik chhoti cheez toh shuru kariye.`, `Hune pehle ki karna zaroori lagda aa?`],
        coach: [`Theek aa  -  main saath haan. Pehlan ise steady kariye.`, `Samajh gaya. Ase ise step by step kaddhange.`, `Chalo thoda dhimi ho ke footing pakdiye.`, `Main sun raha haan. Ik ik hissa vekhiye.`, `Mainu pata aa tu eh sambhal sakda aa  -  ik kadam toh shuru karte.`, `Tu pehle vi airi mushkil langhi aa. Eh vi lang jaayegi.`],
        "gentle-humor": [`Theek aa  -  main ithey haan.`, `Hmm, main sun raha haan.`, `Samajh gaya. Main saath haan.`, `Chalo, ise thoda halka karie  -  ik chhoti step karke.`, `Thik aa, eh thoda pechida lagda aa  -  par assi milke suljha laange.`, `Zindagi kadey kadey thodi bhari ho jaandi aa  -  ik cheez seedhi karte.`],
        direct: [`Theek aa. Main saath haan.`, `Chalo ise seedha vekhiye.`, `Samajh gaya. Ise stable rakhiye.`, `Main sun raha haan. Seedha mudde te aaiye.`, `Das  -  seedha ki ho raha aa?`, `Main sun raha haan. Seedhe mudde te aate haan.`],
    };

    const openersByToneKn: Record<LocalResponseTone, string[]> = {
        calm: [`Naanu ninna jote iddene.`, `Idannu mellage nodona.`, `Sari. Idannu aaramaagi teedukonona.`, `Naanu ninna jote iddene. Ondondu bhagavagi nodona.`, `Aatagalu illa  -  naavilliru munde hogona.`],
        supportive: [`Naanu ninna jote iddene.`, `Naanu kelutiddene.`, `Sari  -  naanu illi iddene.`, `Neevu heltiru, adhu olledhu.`, `Artha aagide.`],
        practical: [`Sari. Idannu sparshtavaagi nodona.`, `Artha aagide. Idannu step by step teedukonona.`, `Idannu steady maadi mukhyavaada vishaya nodona.`, `Naanu ninna jote iddene. Idannu sarala maadona.`, `Idu bilkul saadha  -  ond chikka kaaryatinda suru maadona.`, `Ippaagu mudalluu yaavudu maadabeku anta anistide?`],
        coach: [`Sari  -  naanu ninna jote iddene. Munche idannu steady maadona.`, `Artha aagide. Idannu step by step nodona.`, `Konjam mellage hogi footing hidukona.`, `Naanu kelutiddene. Ondondu bhagavagi nodona.`, `Ninage gottu, neevu idannu sambaalisi koLabahudu  -  ond adugina suru maadona.`, `Neevu munneyuu kashtakaramaada hola kaDediddeere. Idannu kooda kaDeyutteeraa.`],
        "gentle-humor": [`Sari  -  naanu illi iddene.`, `Hmm, naanu kelutiddene.`, `Artha aagide. Naanu ninna jote iddene.`, `Idannu konjam light aagi teedukonona  -  ondu chikka step allige.`, `Thika, idu thoda jatila aagide  -  aadruu nanage neevu iruveera, saaye teerisona.`, `Jeevanada kaaye swalpa zyaada haagtide  -  ond vishaya straightaa maadona.`],
        direct: [`Sari. Naanu ninna jote iddene.`, `Idannu nera nodona.`, `Artha aagide. Idannu steady aagi irisi.`, `Naanu kelutiddene. Suttamuttinu hogade point ge barona.`, `Heluu  -  neruggaagi yen aagide?`, `Naanu keluttiddene. Mukhya vishayakke barona.`],
    };

    const openersByToneMl: Record<LocalResponseTone, string[]> = {
        calm: [`Njaan ninnooppam undu.`, `Idi mellage nokkaam.`, `Sari. Idi mellage eettukol.`, `Njaan ninnooppam undu. Ore ore bhagamayi nokkaam.`, `Tharakkilla  -  naamukal pathukkke munnoottam pokaam.`],
        supportive: [`Njaan ninnooppam undu.`, `Njaan kekkunnundu.`, `Sari  -  njaan ippol unda.`, `Nee paranjathu nallathayi.`, `Manahsilaayi.`],
        practical: [`Sari. Idi vyakthamayi nokkaam.`, `Manahsilaayi. Idi step by step eettukol.`, `Idi steady aakki muhyamaya vishayam nokkaam.`, `Njaan koode undu. Idi saralamaakkaam.`, `Idi tappaathe nadakkum  -  oru chinna kaaryyathil ninnum thudangu.`, `Ippol mudhalukon enu cheyyaanano?`],
        coach: [`Sari  -  njaan ninnooppam undu. Munpe idi steady aakkaam.`, `Manahsilaayi. Idi step by step nokkaam.`, `Konjam mellage poyittu footing kittaam.`, `Njaan kekkunnundu. Ore ore bhagamayi nokkaam.`, `Ninakku idhu cheyyan kazhiyumennu ariyaam  -  oru adiyil thudangu.`, `Nee munpeyo kashtamaana samanambaduthi. Idhu koode kadakkanam.`],
        "gentle-humor": [`Sari  -  njaan ippol unda.`, `Hmm, njaan kekkunnundu.`, `Manahsilaayi. Njaan ninnooppam undu.`, `Idi konjam light aakki eettukol  -  oru chinna step aayi.`, `Sari, idi konjam kuppikalaanu  -  pakshe koottaay theerkkaana.`, `Jeevanam chila neratthu aane aniyaanu  -  oru vishayam straightaakku.`],
        direct: [`Sari. Njaan ninnooppam undu.`, `Idi nerey nokkaam.`, `Manahsilaayi. Idi steady aakki vekkunna.`, `Njaan kekkunnundu. Neri karyathilekku varaam.`, `Paryu  -  nerugunna enu nadakkunnu?`, `Njaan kettundu. Mukhya vishayathilekku varanu.`],
    };

    const openersByToneOr: Record<LocalResponseTone, string[]> = {
        calm: [`Mu tumara saathire achi.`, `Aau dheere dheere eitaaku bhabhibu.`, `Thik achi. Aau sthire lubu.`, `Mu tumara saathire achi. Ek ek hissa dekhibu.`, `Kona tara nahi  -  aame dheere aagaku badhibu.`],
        supportive: [`Mu tumara saathire achi.`, `Mu shunuchi.`, `Thik achi  -  mu eithire achi.`, `Bhala hela je tume kaile.`, `Bujhiparichhi.`],
        practical: [`Thik achi. Aau spashta bhavare dekhibu.`, `Bujhiparichhi. Eitaaku ek ek step re neibaa.`, `Aau eitaaku steady kariba o kichi muhya jinisha dekhibu.`, `Mu saathire achi. Eitaaku sahaja rakhiba.`, `Eta bilkul sampav  -  ek chhoto kichhu thi suru kari.`, `Ebe prottomey ki karibaa darkar laaguchhi?`],
        coach: [`Thik achi  -  mu saathire achi. Agau eitaaku steady kariba.`, `Bujhiparichhi. Aase eitaaku step by step nibu.`, `Aau dheere hoi footing dhibu.`, `Mu shunuchi. Ek ek hissa dekhibu.`, `Mu jaanichi tu sambhali paariba  -  ek kaadama thi suru kari.`, `Tu aage i kashtakar samay par karichi. Eha-bi par karibei.`],
        "gentle-humor": [`Thik achi  -  mu eithire achi.`, `Hmm, mu shunuchi.`, `Bujhiparichhi. Mu saathire achi.`, `Aau, eitaaku thoda halka kariba  -  ek chota step boli.`, `Thik achhi, eha thoda jatil laaguchi  -  kintu asee saathey saaf karibaa.`, `Jeeban kabhi kabhi thoda bhari hoi jaay  -  eka ta bisaya sidha kariba.`],
        direct: [`Thik achi. Mu saathire achi.`, `Aau seedha dekhibu.`, `Bujhiparichhi. Eitaaku stable rakhiba.`, `Mu shunuchi. Seedha mudra kuu aasibu.`, `Kahu  -  seedha ki hauchhi?`, `Mu shunuchhi. Mudha bisayakku aasiba.`],
    };

    const openersByToneMr: Record<LocalResponseTone, string[]> = {
        calm: [`Mi ithe aahe.`, `Chala he haluhalu gheuya.`, `Theek aahe. He aaramaat gheuya.`, `Mi tuzhyasobat aahe. Ek ek bhaag pahilya.`, `Ghaaee nahi  -  aapan savakaash pudhe jaau.`],
        supportive: [`Mi ithe aahe.`, `Mi aikto aahe.`, `Theek aahe  -  mi itheche aahe.`, `Barabar kela sangitles.`, `Samajla.`],
        practical: [`Theek aahe. He spashta nazar ne pahilya.`, `Samajla. He step by step gheuya.`, `Chala sambalto ani baghto kashacha mahattva aahe.`, `Mi sobat aahe. He saral thauvuya.`, `He bilkul shakya aahe  -  ek chhoti goshta karu ani suru karu.`, `Aata aadhi kaay karna zaroori aahe?`],
        coach: [`Theek aahe  -  mi sobat aahe. Aadhi he steady karuya.`, `Samajla. He step by step kadhilya.`, `Thoda savakaash houn footing dharuya.`, `Mi aikto aahe. Ek ek bhaag pahilya.`, `Mala maahit aahe tu he sambhalu shaktos  -  ek chota kadam.`, `Tu aadhi hi kashtamakar wela kundli kelis. He hi kundlein.`],
        "gentle-humor": [`Theek aahe  -  mi ithe aahe.`, `Hmm, mi aikto aahe.`, `Samajla. Mi sobat aahe.`, `Chala, he thoda halke karuya  -  ek chhota step karun.`, `Thik aahe, ha thoda goond-aavnara watle  -  pan aapan milun sodvuya.`, `Jeevan kabhi kabhi thoda zaasti hote  -  ek goshta straight karu.`],
        direct: [`Theek aahe. Mi sobat aahe.`, `Chala he seedhya nazar ne pahilya.`, `Samajla. He steady thauvuya.`, `Mi aikto aahe. Seedhya muddevar yeuya.`, `Saang  -  seedha kaay challu aahe?`, `Mi aikat aahey. Mukhya mudyavar yeuya.`],
    };

    // ── Validation banks ──────────────────────────────────────────────────────

    type Signal = "sad" | "anxious" | "angry" | "tired" | "okay";

    const validationsEn: Record<Signal, string[]> = {
        sad: [
            `That sounds really painful.`,
            `That kind of hurt doesn't just go away on its own.`,
            `I'm sorry you're going through this.`,
            `That's genuinely hard  -  not just a little hard.`,
            `What you're feeling makes complete sense.`,
            `That kind of pain stays with you  -  I can hear it.`,
        ],
        anxious: [
            `That sounds like your mind is running at full speed.`,
            `That kind of pressure is exhausting to live inside.`,
            `It makes complete sense you'd feel on edge with that.`,
            `That's a lot of uncertainty to hold at once.`,
            `Anxiety about this is a very human response.`,
            `Your body is picking up on something that actually matters.`,
        ],
        angry: [
            `That anger makes a lot of sense.`,
            `Something real happened here  -  that frustration is valid.`,
            `I'd feel that way too.`,
            `Yeah  -  that's genuinely unfair.`,
            `That kind of thing gets under anyone's skin.`,
            `It's okay to be angry about this.`,
        ],
        tired: [
            `That kind of exhaustion goes deeper than sleep can fix.`,
            `You've been holding a lot for a long time.`,
            `No wonder your energy is low  -  this is a lot.`,
            `That kind of tired builds up quietly and then hits all at once.`,
            `You're allowed to be worn out by this.`,
            `That's a real kind of depletion, not just tiredness.`,
        ],
        okay: [
            `Tell me a little more  -  I want to understand.`,
            `What's been on your mind?`,
            `What's going on for you right now?`,
            `I'm curious  -  what made you reach out today?`,
            `What's the one thing that feels most present right now?`,
            `Walk me through what you've been feeling.`,
        ],
    };

    const carryValidationsEn = [
        `This is still with you  -  I can feel that.`,
        `It sounds like this hasn't settled yet, and that makes sense.`,
        `You're still in the middle of this, aren't you.`,
        `This hasn't left you. Let's stay with it a little longer.`,
        `Something about this keeps coming back up for you.`,
    ];

    const validationsHi: Record<Signal, string[]> = {
        sad: [`Yeh sach mein bahut dard deta hai.`, `Yeh aisa dard nahi hota jo apne aap theek ho jaaye.`, `Mujhe afsos hai ki tum isse guzar rahe ho.`, `Yeh sach mein mushkil hai  -  sirf thodi nahi, bahut zyada.`, `Jo tum feel kar rahe ho, woh bilkul samajh mein aata hai.`, `Yeh dard andar tak baithta hai  -  main samajh sakta hoon.`],
        anxious: [`Lagta hai dimaag poori speed mein chal raha hai.`, `Is tarah ka pressure andar se bahut thaka deta hai.`, `Yeh sab hote hue edge par rehna bilkul samajh mein aata hai.`, `Ek saath itni saari uncertainty sambhalna bahut bhaari hota hai.`, `Is par anxious rehna ek bilkul insaani response hai.`, `Tumhara dil kisi sachchi baat ko mehsoos kar raha hai.`],
        angry: [`Yeh gussa bilkul samajh mein aata hai.`, `Kuch asal mein hua hai  -  yeh frustration bilkul sahi hai.`, `Main bhi aisa hi feel karta.`, `Haan  -  yeh sach mein ghalat hai.`, `Iss tarah ki baat kisi ko bhi andar tak jalati hai.`, `Is par gussa hona bilkul theek hai.`],
        tired: [`Yeh thakan sirf neend se theek nahi hoti.`, `Tum bahut lamba waqt se bahut kuch sambhal rahe ho.`, `Is sab mein energy kam hona toh banta hi hai.`, `Yeh thakan dheere dheere jama hoti hai, phir ek saath hit karti hai.`, `Tumhe isse thake rehne ka poora haq hai.`, `Yeh sach mein khatam ho jaane ki feeling hai, sirf thakaan nahi.`],
        okay: [`Thoda aur batao.`, `Main saath hoon  -  kya chal raha hai?`, `Main sun raha hoon. Abhi tumhare andar sabse zyada kya baitha hai?`, `Theek hai. Abhi dimaag mein sabse badi baat kya hai?`, `Aaj kaisa lag raha hai?`, `Jo bhi ho  -  main yahan hoon.`],
    };
    const carryValidationsHi = [`Yeh abhi bhi tumhare saath hai  -  yeh main mehsoos kar sakta hoon.`, `Lagta hai yeh baat abhi bhi settle nahi hui hai, aur yeh samajh mein aata hai.`, `Tum abhi bhi iske beech mein ho, nahi?`, `Yeh tumhe chhoodne nahi de raha. Thodi der aur iske saath rehte hain.`, `Kuch is baarein baar baar saamne aa jaata hai tumhare liye.`];

    const validationsBn: Record<Signal, string[]> = {
        sad: [`Eta shotti khub betha dicche.`, `Ei rokhom koshto nijey nijey thik hoe jae na.`, `Kharap lagche je tumi eta diye jachho.`, `Eta shotti kashtakar  -  ektu noy, onek beshi.`, `Tumi je feel korcho sheta khub sadharon.`, `Eta koto gabheer, sheta tomar buke anubhav hocche.`],
        anxious: [`Mone hocche mathata khub jaag chale.`, `Ei tarah pressure andar theke khub klanto kore.`, `Eta niye edge feel kora mote khub sadharon.`, `Ek sathe eto uncertainty sambhalna khub kashtaker.`, `Eta niey anxious thaka ekta manobik protikriya.`, `Tomar mon kono asol bishoy niye ektu o shant hote pare na.`],
        angry: [`Ei raag ta mote khub bujha jaay.`, `Asol kichu ghotechhe  -  eta frustration ta mathik.`, `Ami o oi rokhom feel kortam.`, `Haan  -  eta shotti onjay.`, `Ei rokhom byapaar konar na konar ga jhaliye diite pare.`, `Eta niey ragee howa bilkul thik.`],
        tired: [`Ei klanti shudhu ghum theke thik hoy na.`, `Tumi onek dhin dhore onek kichu sambhalacho.`, `Eto shab niey energy kom hobe eita to bujhaa jaay.`, `Ei rokhom thakaa aaste aaste joma hoy, tarpor ekdine laage.`, `Tumi eta niey thaka thakte paro  -  seta thik.`, `Eta asol rokhom nik hoe jaoa, shudhu thakaan noy.`],
        okay: [`Aro ektu bolo.`, `Ki hochhe ektu bolbe?`, `Ekhon tomar modhye shobcheye beshi ki bose ache?`, `Ekhon mathay shobcheye boro kotha ta ki?`, `Aaj kemon acho?`, `Ja-i hok  -  aami ekhane aachi.`],
    };
    const carryValidationsBn = [`Eta ekhono tomar shathe ache  -  ami sheta anubhob korte parchi.`, `Mone hocche eta ekhono settle hoyeni, ar sheta bujhaa jaay.`, `Tumi ekhono eta r maazhkhane aacho, tai na?`, `Eta tomar chorhte diche na. Aro ektu ei shathe thaki.`, `Eta niey kichhu baar baar phire aase tomar kachhe.`];

    const validationsTa: Record<Signal, string[]> = {
        sad: [`Idhu romba vedanayaa irukku.`, `Indha maadhiri vali thane thane thedhi kidaikkaadhu.`, `Nee idha vedutthukittu irukkaayaa, enna dukham.`, `Idhu nijamaa kashtam  -  konjam illai, romba.`, `Nee feel panradhu romba natural.`, `Idhai vaaydhu irukkiraayaa, appadi feel aagudhae  -  naan purinjukiren.`],
        anxious: [`Un manas romba vegama paravikalamma irukku.`, `Indha maadhiri pressure orey kashtam.`, `Ippadi irundha edge aa feel panna romba saadharanam.`, `Orey nerathula indha uncertainty teesukovadam kashtam.`, `Idhai pathi anxious aa irukka romba manidhana prathikiriyai.`, `Un ullam nijama nadhakkara visayathai pathi unarvuppadudhu.`],
        angry: [`Indha koabam romba puriyudhu.`, `Idhu nija visayam  -  indha frustration theveeyam.`, `Naanum adhey maari feel pannirupen.`, `Aama  -  idhu nijamaa anjaabu.`, `Indha maadhiri vishayam yaarkum kovam varum.`, `Idhai pathi kovam padadhu okay.`],
        tired: [`Indha thezippu thookkathaal maatrum sari aagaadhu.`, `Nee nalla kaalam dhara edhayum vaithu vandhai.`, `Itho daiyaa energy kumayudhe  -  enna panna poruvai.`, `Indha maadhiri thalivam mella jama aagi oru saariley varudhu.`, `Indha visayatthal thezittu irukkam okay.`, `Idhu asala reethi thadaipattadhu, vaazhkaiyil thezippu maatrum illai.`],
        okay: [`Konjam innum sollu.`, `Enna nadakkudhu konjam solluva?`, `Ippo unakku ullae romba weight aa irukkiradhu enna?`, `Ippo un manasula mukkiyama irukkira vishayam enna?`, `Indha naal eppadi irukke?`, `Enna venaalum  -  naan inga irukken.`],
    };
    const carryValidationsTa = [`Idhu ekhanum unnoduye irukku  -  enakku theriyudhu.`, `Idhu innam settle aagala pola theriyudhu, adhu saradhaan.`, `Nee innam indha naduvile irukke, illaiya.`, `Idhu unnai vidalai. Konjam nera idhuoduve irundiduvom.`, `Indha vishayathal oru vidam baar baar thirumbi varudhu.`];

    const validationsTe: Record<Signal, string[]> = {
        sad: [`Idi nijamga chaala noppiga undi.`, `Ee rakamaina noppi tananukune thaggadu.`, `Nuvvu idi vedutunnanduku naaku dukkhanga undi.`, `Idi nijamga kashtam  -  konjam kaadu, chaala.`, `Nuvvu feel avutunnattu nijamgane artham avutondi.`, `Idi enta gaadha ga anipistundo  -  nenu ardham chesukuntaanu.`],
        anxious: [`Manas chaala veganga parigettunnattu anipistundi.`, `Ee rakamaina tension inside nundi chaala ashaantiga untundi.`, `Ee saaye edge ga feel aavadaniki reason undi.`, `Okasaari inta uncertainty teesukovadam chaala kashtam.`, `Deenikosam anxious ga undadam chaala manavadam.`, `Nee manassu nijamaina vishayaaniki respond avutundi.`],
        angry: [`Ee kopam nijamga artham avutondi.`, `Ikkade nijamayna vishayam jarigindi  -  ee frustration valid.`, `Nenu kuda ala feel ayye vaadini.`, `Avunu  -  idi nijamga anyaayam.`, `Ee rakamaina vishayam evarikaina kashtam ga anipistundi.`, `Deekosam kopanga undadam okay.`],
        tired: [`Ee ayaasam nidra tho maatrame poledhu.`, `Nuvvu chaala kaalam nundi chaala meeru moshteesaaredi.`, `Inta load undaga energy thaggadanikee artham undi.`, `Ee tiredness mellaga perugutundi, apudu okkaasaari gelustundi.`, `Idani vaalla ayyipoyindu  -  adhi okay.`, `Idi nijamaina depletion, kevaalam nidra raakapovadam kaadu.`],
        okay: [`Konchem inka cheppu.`, `Em jarugutundo konchem chepthava?`, `Ippudu nee lo ekkuvaga bharam ga anipistondi enti?`, `Ippudu nee manasulo mukhyamaina vishayam enti?`, `Nee ee roju ela unnav?`, `Em ayyina  -  nenu ikkade unnaanu.`],
    };
    const carryValidationsTe = [`Idi ippudu kuda nee tho undi  -  naaku ardham avutondi.`, `Idi ippudu settle kaaledu ani anipistundi, adhi sahajanme.`, `Nuvvu ippudu kuda idhi madhyalo unnav, kaadu aa?`, `Idi nee vaadalaadaa. Inkaa konjam sepu deenitho uundama.`, `Oka vidhanga idi nee daggara marchikochheenu.`];

    const validationsGu: Record<Signal, string[]> = {
        sad: [`Aa sach mein khub dard aape chhe.`, `Aa tarah no dard pote pote thik nathi thaato.`, `Mane dukh chhe ke tu aana maanthi passo thay chhe.`, `Aa sach mein kashthu chhe  -  thodu nahi, bahut.`, `Tu je feel kare chhe, tenu pooru karan chhe.`, `Ae dard andar tak bese chhe  -  ae main samjhu chhu.`],
        anxious: [`Lage chhe dimaag puri speed mae chale chhe.`, `Aa tarah nu pressure andarathi khub thakavnaru chhe.`, `Aa sab mae edge feel karavun bilkul samjhay chhe.`, `Ek saate etni badhi uncertainty sambhalvun khub aakhrun chhe.`, `Aa baraama anxious rehvun mananviy pratikriya chhe.`, `Taro andar koik sachi cheez prati react kari raheyo chhe.`],
        angry: [`Aa gusse bilkul samjhay chhe.`, `Koi asali cheez thai chhe  -  aa frustration yogya chhe.`, `Hoon pann evi feel kart.`, `Haa  -  aa sach mein anyaay chhe.`, `Aa tarah ni vaat koneyne bhi andar tak lagti chhe.`, `Aa maTe gusse thavun bilkul theek chhe.`],
        tired: [`Aa thakan sirf nindathi thik nathi thavati.`, `Tu onek samay thi ghanu badhu sambhali rahyo chhe.`, `Aa badha sathe energy ghatti hoy tenu karan samjhay chhe.`, `Aa thakan aaste aaste jami jaay chhe, pachhi ek saath laage chhe.`, `Tu athi thaki jaay tenu pooru haq chhe.`, `Aa sach mein ni shaktinu khaali thavun chhe, sirf thakan nahi.`],
        okay: [`Vadhare keh.`, `Shu thayi rahyun chhe?`, `Abhi tamne andar shu vadhu vaagtu chhe?`, `Abhi dimag ma moti vaat shu chhe?`, `Aaj kaisa laag rahi chhe?`, `Jem hoy  -  hu yahan chhu.`],
    };
    const carryValidationsGu = [`Aa hua tara sathe chhe  -  hoon mahesus kari shakun chhu.`, `Lage chhe aa hun ye settle nathi thayun, ane aa samjhay chhe.`, `Tu hun pann aa ni vaach mein chhe, nahi?`, `Aa tane chhodte nathi. Thodi var ane sathe rahiye.`, `Aam kaik aa tara mate baar baar pachi aave chhe.`];

    const validationsPa: Record<Signal, string[]> = {
        sad: [`Eh sach mein bahut takleef denda aa.`, `Iss tarah di takleef apne aap theek nahi hundi.`, `Afsos aa ke tu iss chon lann raha aa.`, `Eh sach mein kaafi mushkil hai  -  thoda nahi, bahut zyada.`, `Jo tu feel kar raha aa, oh bilkul samajh aunda aa.`, `Eh dard andar tak jamm janda aa  -  main samajh sakda haan.`],
        anxious: [`Laggda aa dimaag poori speed wich chal raha aa.`, `Iss tarah da pressure andarun khub thaka denda aa.`, `Iss sab wich edge feel karna bilkul sadharan aa.`, `Ikko saath itni uncertainty sambhalna bahut aakhda aa.`, `Is baaray anxious rehna manikhee pratikriya aa.`, `Tera andar koi asli gall nu respond kar raha aa.`],
        angry: [`Eh gussa bilkul samajh aunda aa.`, `Koi asli gall hoi aa  -  eh frustration sahih aa.`, `Mainu vi ohi feel hunda.`, `Haan  -  eh sach mein nainsaafi aa.`, `Iss tarah di gall kisi di vi skin de neeche jaa sakdi aa.`, `Is te gusse hona bilkul theek aa.`],
        tired: [`Eh thakaan sirf neend naal theek nahi hundi.`, `Tu kaafi chirsay ton bahut kuch sambhaal raha aa.`, `Ete sab nachche energy ghatt hona samajh aunda aa.`, `Eh thakan dhirey dhirey jama hundi aa, phir ik saath laggdi aa.`, `Tenu isse thakeyan da poora haq aa.`, `Eh sach mein shakti khatam hona aa, sirf thakaan nahi.`],
        okay: [`Thoda hor dass.`, `Ki ho raha aa?`, `Abhi tere andar sabton bhari ki gall aa?`, `Abhi dimag wich sabton vaddi gall ki aa?`, `Aaj kaida lag raha aa?`, `Jo vi hove  -  main ithey haan.`],
    };
    const carryValidationsPa = [`Eh hali vi tere naal aa  -  main mehsoos kar sakda haan.`, `Laggda aa eh hali settle nahi hoi, te eh samajh aunda aa.`, `Tu hali vi iss de vich hain, nahi?`, `Eh tenu chhadde nahi. Thodi der hor ede naal rahiye.`, `Iss baaray kuch baar baar piche aaunda aa tere layi.`];

    const validationsKn: Record<Signal, string[]> = {
        sad: [`Idu nijavaagiyoo novu kodutte.`, `Ee tarahad novu thanage thanage hogi hoguvadiilla.`, `Neevu iddannu hegediruvudakku naakku dukha aagide.`, `Idu nijavaadanu kashta  -  swalee alla, tumba.`, `Neevu feel aagattiruvadudu sahajavendra.`, `Ee novu thanage tanage neleegolthade  -  naanu artha maadikolluttene.`],
        anxious: [`Manas tumba vegaadi parigeduttide anisutte.`, `Ee tarahad pressure olagininda tumba ashaantiga maaduttade.`, `Ella nodu edde meele feel aaguvadudu tumba sahajavendra.`, `Ondu saarigu ivvali uncertainty hididiruvadudu kashtavaagide.`, `Iddakkaagi anxious aaguvadudu manujara pratikriye.`, `Nina manadaali yaavudo nijavada vishayakke respond aaguttide.`],
        angry: [`Ee kopa nijavaagi arthagoopatte.`, `Illi nijavaada vishaya nadittu  -  ee frustration sari.`, `Naanuoo haagehii feel aaguttiidde.`, `Haudu  -  idu nijavaagi anyaaya.`, `Ee tarahad vishaya yaarigaadaru maidina keliyannu jaggutte.`, `Iddakkaagi kopagouvudadu okay.`],
        tired: [`Ee doni kevalavagiu nidreynda saraaguvudilla.`, `Neevu kaafi kaaladinda tumba yeladannu hidididhiri.`, `Iddella iruvaaga energy kumiduvadudu sahajavendra.`, `Ee thara doni melliga serkutte, naantara ondu saarigu adiresite.`, `Iddannu dhakkaagi iruvudakku nimage hakkide.`, `Idu nijavaagi bala kumiduvadudu, keval omme barada novu alla.`],
        okay: [`Konjam innu heli.`, `Enu aaguttide konjam helutteeraa?`, `Ippudu ninna olage tumba bhaaraagi iruvudu yenu?`, `Ippudu ninna manassalliruva mukhya vishaya yenu?`, `Ivattu hege iddeera?`, `Enadeee irulee  -  naanu iddene.`],
    };
    const carryValidationsKn = [`Idu ippudu ninna jote ide  -  naanu adu mahisuttiddene.`, `Idu ippudu settle aagillavaada eniste, aduu sahajavendre.`, `Neevu ippudu kuda iddara madhyeyalli idiraa.`, `Idu ninnanu bidaladilla. Konjam ine yella idara jote irona.`, `Iddara bagge yaavudo ondu baraabar baruttiruttade.`];

    const validationsMl: Record<Signal, string[]> = {
        sad: [`Idi nijamaayi valare veedhanadaaniyaanu.`, `Ee maadhiri novu thanaaye thane maaru milla.`, `Nee idi vedutthikkondirukkunnathu ennikku dukhamundu.`, `Idi nijamaayi kashtamaanu  -  konjam alla, valare.`, `Nee feel aakunnath saadharanamaaanu.`, `Ee dukhham ullil thangippokkunnu  -  njaan artha maakkunnu.`],
        anxious: [`Manassu valare vegathil paayunnathu pola.`, `Ee maadhiri tension ollilninnu valare ashaanthi undaakkunnu.`, `Ithallelam edge feel aavunnathu sahajamaaanu.`, `Onnu kondoru uncertainty pidichhuvekkunnath kashtamaanu.`, `Idi kurichu anxious aakunnath manushyate prathikria.`, `Ninne manassu entho nijamayullathinu prathikarikkunnu.`],
        angry: [`Ee koppam nijamaayi artham varunnu.`, `Ithil nijamaayi oru visayam nannayi  -  ee frustration sari.`, `Njaaanum athupole feel aakumayirunnu.`, `Athe  -  idi nijamaayi anyaayam.`, `Ee maadhiri karyam aarkku aanu ullilekk kidakkaathe?`, `Iddathinu kooppadunnathu okay.`],
        tired: [`Ee madi nidra kondamatram maaru milla.`, `Nee nalla kaalam dhara orupaadu vechi nadinnittu.`, `Ithrallelam ondu energy thazhathil anubhavikkunnathu sahajam.`, `Ee maadhiri thallal padi padi koriyum, pinne okkaasaarattu adikkunnu.`, `Ithinal maribikkunathu ninnekku avakashamundu.`, `Idi nijamaayi shakthi theerunnathu, kevalavum urakkam varaathe alla.`],
        okay: [`Konjam koodi para.`, `Enthu nadakkunnu?`, `Ippol ninnil koodu bhaaram aayi thoannunnnathu enthanu?`, `Ippol ninte manassilulla muhyamaya vishayam enthanu?`, `Innu ethaayi undo?`, `Enthu aayaalum  -  njaan ithu undo.`],
    };
    const carryValidationsMl = [`Idi ippoluthe ninnoodu unde  -  njaan anubhavikkunnu.`, `Idi ippol settle aayilla ennaniisunnunu, adhu sahajamaanu.`, `Nee ippol kuda eedathu naduvillee, alla?`, `Idi ninne vittu pokunn illa. Oru nimisham koodi eedathu koode irikkaam.`, `Iddathi kurachu oru karyam baar baar ninakku thiriche varunnu.`];

    const validationsOr: Record<Signal, string[]> = {
        sad: [`Aitaa sachchi onek vedanaa dichhe.`, `Ee prakara kosto nijey nijey theek hue paaré naa.`, `Duhkha laguchhi je tume aitaa diey jauchha.`, `Aitaa sachchi kashtakar  -  thoda noy, onek.`, `Tume je feel karuchha seta khub sahaja.`, `Ee betha bhitare ghunu jaay  -  mu bujhuchi.`],
        anxious: [`Laaguchhi mathaa poori speed e chali achhi.`, `Ee prakara tension bhitaruthaa onek thakaa dey.`, `Ei samaye edge feel karibaa khub sahaja.`, `Ek saathere eta uncertainty sambhalibaa kashtaker.`, `Ei bisayare anxious thaaibaa manabik pratikriyaa.`, `Tumara mana kono asali bisayare respond karuchhi.`],
        angry: [`Ei raaga sachchi arthaparna.`, `Ithey asali kichha ghatichhi  -  ei frustration theek.`, `Mun bhi osei feel karibi.`, `Haan  -  aitaa sachchi aanjayapurna.`, `Ee prakara bisayara kona na kona lokan kehi bhi galat laagibaa.`, `Eitaa baabade raagibaa theek aahe.`],
        tired: [`Ee thaakaa kebal nindara karan theek hue naa.`, `Tume onek dinru onek kichhu sambhaaluchi aas.`, `Ete sab thilaa energy kame hoibaa bujhaa jaay.`, `Ee thaakaaa aaste aaste jaama hue jaay, pachhe ek saathere laage.`, `Eitaa niye thaakii thaaibaa tumara adhikar.`, `Aitaa sachchi nik hue jaabaa, kebal thakaan noy.`],
        okay: [`Aaru thoda kahe.`, `Ki heuuchhi?`, `Ebe tumara bhitare sab cheye beshi ki bujhi laaguchhi?`, `Ebe mathare sab cheye bada kotha ta ki?`, `Aaji kemiti laaguchhi?`, `Jaha heu  -  mu ehithey achi.`],
    };
    const carryValidationsOr = [`Aitaa ebe bhi tum aara sathe achi  -  mu shunugalaa.`, `Aitaa ebe bhi settle hue naahi lagen aahe, seta bujhaa jaay.`, `Tume ebe bhi eitaar madhyare aacha, naa?`, `Aitaa tum ku chadei naahi. Thoda samay eitaa sathe rahihibu.`, `Ei bisayare kichu baar baar tumara kachhe phiri aasuchhi.`];

    const validationsMr: Record<Signal, string[]> = {
        sad: [`He khare dukh dete.`, `Ya prakarche dard aapasap thik hoat nahi.`, `Tula ya madun jaayche aahe mhantlyavar mala vaait vaatate.`, `He kharch kashtdayak aahe  -  thode nahi, khup.`, `Tu je feel kartoys te poorn samaajhte.`, `Ha dard aandar ghusato  -  he mi samju shakto.`],
        anxious: [`Vatate dokyat poori speed aahe.`, `Ya prakarchi tension aatun khup thakavate.`, `Ya saravamedhe edge feel karane bilkul samajnyasarkhe aahe.`, `Ek saath itki uncertainty sambhalnee khupach kashtdayak aahe.`, `Yabaddal anxious rahane manawiy pratikriya aahe.`, `Tuzhe man konyatari kharyaa goshticha pratikaara kartoy.`],
        angry: [`Ha raag khup samajhnya layak aahe.`, `Ithe khary goshti ghadlyaa  -  ha frustration yogya aahe.`, `Mala pann taseech vaatale aste.`, `Ho  -  he khary mhanje anjaaypurnak aahe.`, `Asal'ya goshti konalahi aatparyant jatat.`, `Yaabaddal raagaavane theek aahe.`],
        tired: [`Hi thakaan sirf jhopet thik nahi hote.`, `Tu khup divas dhare khupach kahi sambhaltoys.`, `Ete saglya goshti niye energy kami hone banta aahe.`, `Hi thakaan halnhal jama hote ani ekdam lagte.`, `Ithle thaklyasarkhe rahaycha tula hak aahe.`, `He khary nik houne aahe, sirf thakaan nahi.`],
        okay: [`Adhik saang.`, `Kaay chaallu aahe?`, `Ata tujhyaat kaay jast bhaarite aahe?`, `Ata dokyat saglyyaat motha kaay aahe?`, `Aaj kaasa vaatate?`, `Kaahihi asel  -  mi ithe aahe.`],
    };
    const carryValidationsMr = [`He abhi pann tujhyasobat aahe  -  mi te samjhu shakto.`, `He abhi settle nahi zhale ase vaatate, ani te samajte.`, `Tu ata pun yaachya madhye aahe, ho na?`, `He tuza peeccha sodat nahi. Thodi velaa asa ika vaduye.`, `Ya vishayaabaddal kainchik baar baar tujhyakade yete.`];

    // ── International language banks (zh, es, ar, fr, pt, ru, id, ur) ────────────
    // NOTE: These banks use carefully translated content. Native speaker review
    // recommended for production accuracy  -  especially for Arabic (RTL) and
    // culturally-specific expressions. Mark reviewed with: // reviewed: [lang] [date]

    const openersByToneZh: Record<LocalResponseTone, string[]> = {
        calm: [`我在这里。`, `我听到你了。`, `好的，我们慢慢来。`, `你不是一个人。`, `没有关系，慢慢说。`, `我在 -  - 不用着急。`],
        supportive: [`这听起来真的很难熬。`, `谢谢你告诉我这些。`, `你愿意分享这些，我很感激。`, `我真的很高兴你说出来了。`, `这需要很大的勇气。`, `你能说出来，已经很不容易了。`],
        practical: [`好，我们来看看这个。`, `我们来把这个理清楚。`, `让我们一步一步来。`, `我们先找到最重要的部分。`, `好，我们一起来分析一下。`, `让我们把这个变得更清晰。`],
        coach: [`你比自己想象的更有能力。`, `我们来把这个变成可以行动的事。`, `你已经走了这么远了。`, `让我们找到前进的方向。`, `你能做到 -  - 我们一起来。`, `让我们找到最稳定的那一步。`],
        "gentle-humor": [`好吧，生活有时候就是这样。`, `没有完美的时候，但我们还是可以继续。`, `有时候糟糕的一天只是糟糕的一天而已。`, `我们一起来面对这个。`, `你知道吗，这种感觉很正常。`, `即使一团糟，也可以继续的。`],
        direct: [`说吧，我在听。`, `告诉我发生了什么。`, `我们直接说吧。`, `好，接下来怎么办？`, `说清楚，我会陪你想。`, `直接说 -  - 我在。`],
    };
    const validationsZh: Record<Signal, string[]> = {
        sad: [`这真的很痛。`, `这种痛不会自己消失的。`, `我很遗憾你正在经历这些。`, `这确实很艰难 -  - 不是一点点，是真的很重。`, `你的感受完全可以理解。`, `这种痛深深扎根在你身上 -  - 我能感受到。`],
        anxious: [`感觉大脑在全速运转。`, `这种压力从内部把人压垮。`, `在这一切中感到不安是完全可以理解的。`, `一次承受这么多的不确定性真的很重。`, `对这件事感到焦虑是正常的反应。`, `你的内心在感知着某件真实而重要的事。`],
        angry: [`这种愤怒完全可以理解。`, `这里发生了真实的事情 -  - 这种沮丧是正当的。`, `我也会有同样的感受。`, `是的 -  - 这确实是不公平的。`, `这种事情会让任何人都感到受伤。`, `对这件事生气是完全没问题的。`],
        tired: [`这种疲惫不是睡一觉能解决的。`, `你扛了太久太多了。`, `在这一切中精力耗尽是可以理解的。`, `这种疲惫是慢慢积累的，然后一下子全来了。`, `你有权利感到疲惫。`, `这是真正的耗尽，不只是累。`],
        okay: [`多说一点吧。`, `我在 -  - 发生什么了？`, `现在最压着你的是什么？`, `现在脑子里最大的事是什么？`, `你今天怎么样？`, `不管是什么，我都在听。`],
    };
    const carryValidationsZh = [`这件事还跟着你 -  - 我能感受到。`, `感觉这还没有平息，这很正常。`, `你还在这件事里，对吗？`, `它还没有放开你。我们再在这里待一会儿。`, `有些关于它的东西一直在回来找你。`];
    const extrasByToneZh: Record<LocalResponseTone, string[]> = {
        calm: [``, `我们现在可以只抓住一个部分。`, `不用急着把整件事理清楚。`, `我们可以不用强迫，保持稳定。`, `一步一步来 -  - 没有压力。`, `往前走之前，可以先在这里待一会儿。`],
        supportive: [``, `你不必一次承担所有的重量。`, `我们可以先停留在最重的那部分。`, `如果一切现在还是乱的，没关系。`, `现在还觉得很重，这完全可以理解。`, `不用急着把它全想清楚。`],
        practical: [``, `我们先来看最重要的部分。`, `可以让这个保持可控。`, `现在找到一个有用的部分就够了。`, `可以把这个拆分得更小一些。`, `只需要下一个清晰的步骤 -  - 没有别的。`],
        coach: [``, `我们先找到最可行的部分。`, `现在只需要一个稳定的步骤。`, `你不必一次把所有事情理清楚。`, `一个扎实的步骤现在就够了。`, `我们可以让这件事比感觉上更简单。`],
        "gentle-humor": [``, `我们可以不忽视它，但让它轻一点。`, `现在一个小小的改变就够了。`, `我还在这里陪着你。`, `一个小小的进步也是进步。`, `今天不需要打一场全面的仗。`],
        direct: [``, `我们保持清晰。`, `一次可以处理一个真实的部分。`, `现在只需要下一个有用的部分。`, `现在最重要的是什么？`, `专注在真正有意义的那部分。`],
    };
    const carryExtrasZh: Record<LocalResponseTone, string[]> = {
        calm: [`现在不用把它推到任何地方。`, `我们可以在这里停留一会儿。`, `不必强迫这件事解决。`],
        supportive: [`你现在不需要完全理解它。`, `我还在这里陪你。`, `还没弄清楚也是完全可以的。`],
        practical: [`我们先保持简单。`, `不需要整个答案，只需要下一个清晰的部分。`, `只要下一步清晰就够了。`],
        coach: [`在做任何事之前，先把它稳定下来。`, `之后一个踏实的步骤就够了。`, `先找到稳定的一步就好。`],
        "gentle-humor": [`可以让它轻一点，不用把它搞重。`, `现在不用跟整件事较劲。`, `不用跟这件事摔跤。`],
        direct: [`现在不要把它搞复杂。`, `我们先抓住真实的部分。`, `只关注现在真正重要的那部分。`],
    };
    const reflectLinesZh = [
        keyTopic ? `你提到了${keyTopic} -  - 那里面现在最压着你的是什么？` : `这件事里现在最压着你的是什么？`,
        `这里面什么让你最难放下？`,
        `如果只能选一件最让你烦恼的事 -  - 会是什么？`,
        `你希望这个情况有什么不同？`,
        `现在身体里感觉这一切是什么感觉？`,
        `如果事情轻松一点点 -  - 最先会改变什么？`,
    ];
    const nextStepLinesZh = [`我们可以继续聊，或者找一件小事来尝试 -  - 哪个感觉对就哪个。`, `有些人需要先把一切说出来。有些人想要计划。你现在在哪里？`, `我们可以继续深入，或者找一个小的行动。现在什么更有用？`, `我在这里陪你 -  - 无论是继续聊还是找一件具体的事。`, `现在更有用的是继续聊，还是找一个小的可以动的地方？`, `被听见更真实，还是做点什么更能帮到你？`];
    const listeningOnlyExtrasZh = [`现在不需要想明白这件事。`, `我哪都不去。想说多少说多少。`, `你可以感受所有这些。`, `不需要把这件事整理得很整齐。`, `不必急着弄清楚这一切。`, `说多说少都好 -  - 我就在这里。`];

    const openersByToneEs: Record<LocalResponseTone, string[]> = {
        calm: [`Aquí estoy.`, `Te escucho.`, `Está bien, vamos despacio.`, `No estás solo en esto.`, `Tómate tu tiempo.`, `Estoy aquí  -  sin prisa.`],
        supportive: [`Eso suena realmente difícil.`, `Gracias por contarme esto.`, `Me alegra que lo hayas dicho.`, `Aprecio que lo hayas compartido.`, `Hace falta valentía para decir esto.`, `Que lo hayas dicho ya es mucho.`],
        practical: [`Bien, vamos a ver esto.`, `Aclaremos esto juntos.`, `Vamos paso a paso.`, `Encontremos lo más importante primero.`, `Bien, vamos a analizarlo juntos.`, `Pongamos esto más claro.`],
        coach: [`Eres más capaz de lo que crees.`, `Convirtamos esto en algo accionable.`, `Ya has llegado muy lejos.`, `Encontremos el camino a seguir.`, `Puedes con esto  -  lo hacemos juntos.`, `Encontremos el paso más firme.`],
        "gentle-humor": [`Bueno, la vida es así a veces.`, `No hay momento perfecto, pero seguimos.`, `A veces un mal día es solo eso.`, `Lo enfrentamos juntos.`, `Estas cosas pasan  -  no pasa nada.`, `Aunque todo esté patas arriba, se puede seguir.`],
        direct: [`Habla, te escucho.`, `Cuéntame qué pasó.`, `Seamos directos.`, `Bien, ¿qué hacemos ahora?`, `Dímelo claro  -  aquí estoy.`, `Directo al grano  -  te escucho.`],
    };
    const validationsEs: Record<Signal, string[]> = {
        sad: [`Eso realmente duele.`, `Este tipo de dolor no desaparece solo.`, `Lo siento mucho, que tengas que pasar por esto.`, `Es realmente difícil  -  no un poco, mucho.`, `Lo que sientes tiene todo el sentido.`, `Ese dolor se queda dentro  -  lo puedo escuchar.`],
        anxious: [`Parece que la mente va a toda velocidad.`, `Este tipo de presión agota por dentro.`, `Sentirse inquieto en medio de todo esto tiene sentido.`, `Cargar tanta incertidumbre a la vez es muy pesado.`, `Estar ansioso por esto es una respuesta humana.`, `Tu cuerpo está respondiendo a algo que de verdad importa.`],
        angry: [`Ese enojo tiene todo el sentido.`, `Aquí pasó algo real  -  esa frustración es válida.`, `Yo también me sentiría igual.`, `Sí  -  eso es realmente injusto.`, `Estas cosas lastiman a cualquiera por dentro.`, `Enojarse por esto está bien.`],
        tired: [`Ese cansancio no se cura con dormir.`, `Has cargado demasiado durante mucho tiempo.`, `Con todo esto, es normal que la energía se acabe.`, `Este agotamiento se va acumulando y de repente llega todo junto.`, `Tienes derecho a estar cansado de esto.`, `Es un agotamiento real, no solo cansancio.`],
        okay: [`Cuéntame más.`, `Aquí estoy  -  ¿qué pasa?`, `¿Qué es lo que más te pesa ahora mismo?`, `¿Qué es lo más importante en tu cabeza ahora?`, `¿Cómo estás hoy?`, `Sea lo que sea, te escucho.`],
    };
    const carryValidationsEs = [`Esto todavía está contigo  -  lo puedo sentir.`, `Parece que esto todavía no se ha asentado, y tiene sentido.`, `Todavía estás en medio de esto, ¿verdad?`, `Esto no te suelta. Quedémonos aquí un poco más.`, `Algo de esto sigue volviendo a ti.`];
    const extrasByToneEs: Record<LocalResponseTone, string[]> = {
        calm: [``, `Podemos quedarnos con una parte por ahora.`, `No hay prisa por resolver todo.`, `Podemos mantener esto estable sin forzarlo.`, `Vamos de a una cosa  -  sin presión.`, `Podemos quedarnos aquí un momento antes de seguir.`],
        supportive: [``, `No tienes que cargar todo el peso a la vez.`, `Podemos quedarnos primero con lo que se siente más pesado.`, `Si todo sigue siendo un lío, está bien.`, `Tiene sentido que todavía se sienta pesado.`, `No hay prisa para entenderlo todo todavía.`],
        practical: [``, `Veamos primero lo más importante.`, `Podemos mantener esto manejable.`, `Una parte útil es suficiente por ahora.`, `Podemos dividir esto en partes más pequeñas.`, `Solo el próximo paso claro  -  nada más.`],
        coach: [``, `Encontremos primero la parte más manejable.`, `Solo necesitamos un movimiento estable ahora.`, `No tienes que desenredar todo a la vez.`, `Un paso sólido es todo lo que necesitamos ahora.`, `Podemos hacer esto más simple de lo que parece.`],
        "gentle-humor": [``, `Podemos mantenerlo ligero sin ignorarlo.`, `Un pequeño cambio es suficiente por ahora.`, `Sigo aquí contigo.`, `Una pequeña victoria sigue siendo una victoria.`, `No hay que hacer una guerra completa hoy.`],
        direct: [``, `Mantengamos esto claro.`, `Podemos manejar una parte real a la vez.`, `Solo la próxima parte útil importa ahora.`, `¿Qué es lo más importante ahora mismo?`, `Vamos a enfocarnos en lo que de verdad cuenta.`],
    };
    const carryExtrasEs: Record<LocalResponseTone, string[]> = {
        calm: [`No necesitamos empujar esto a ningún lado todavía.`, `Podemos quedarnos aquí un momento.`, `No hay que forzar una resolución.`],
        supportive: [`No tienes que entenderlo perfectamente ahora.`, `Sigo aquí contigo en esto.`, `No entenderlo todo todavía está bien.`],
        practical: [`Mantengamos esto simple por ahora.`, `No necesitamos la respuesta completa, solo la próxima parte clara.`, `Solo el próximo paso claro es suficiente.`],
        coach: [`Antes de hacer algo más, estabilicemos esto.`, `Un paso sólido después es suficiente.`, `Solo busca un paso estable primero.`],
        "gentle-humor": [`Podemos mantenerlo suave sin hacerlo más pesado.`, `No hay que luchar con todo ahora mismo.`, `No hay que luchar con esto hoy.`],
        direct: [`No lo compliquemos ahora.`, `Quedémonos con la parte real primero.`, `Enfocate solo en lo que realmente importa ahora.`],
    };
    const reflectLinesEs = [
        keyTopic ? `Mencionaste ${keyTopic}  -  ¿qué parte de eso te pesa más ahora?` : `¿Qué parte de esto te pesa más ahora mismo?`,
        `¿Qué es lo que más cuesta soltar de todo esto?`,
        `Si tuvieras que elegir una cosa que más te molesta  -  ¿cuál sería?`,
        `¿Qué desearías que fuera diferente en esta situación?`,
        `¿Cómo se siente llevar todo esto en el cuerpo ahora mismo?`,
        `Si las cosas fueran un poco más ligeras  -  ¿qué cambiaría primero?`,
    ];
    const nextStepLinesEs = [`Podemos seguir hablando, o encontrar una pequeña cosa para intentar  -  lo que se sienta bien.`, `Algunas personas necesitan decirlo todo primero. Otras quieren un plan. ¿Dónde estás tú?`, `Podemos seguir desempacando esto, o encontrar un pequeño movimiento. ¿Qué se siente más útil ahora?`, `Estoy contigo  -  ya sea hablando o encontrando algo concreto para hacer.`, `¿Es más útil seguir hablando, o encontrar algo pequeño que puedas mover?`, `¿Qué sería más real ahora  -  que te escuchen, o hacer algo al respecto?`];
    const listeningOnlyExtrasEs = [`No tienes que resolver esto ahora mismo.`, `No me voy a ningún lado. Di todo lo que necesites.`, `Puedes sentir todo esto.`, `No hay que ordenar esto prolijamente.`, `No hay prisa para entender nada de esto.`, `Di todo lo que quieras o lo poco que necesites  -  aquí estoy.`];

    const openersByToneAr: Record<LocalResponseTone, string[]> = {
        calm: [`أنا هنا.`, `أسمعك.`, `بخير، سنأخذها ببطء.`, `لست وحدك في هذا.`, `خذ وقتك.`, `أنا هنا  -  لا تستعجل.`],
        supportive: [`هذا يبدو صعباً حقاً.`, `شكراً لمشاركتي هذا.`, `يسعدني أنك تكلمت.`, `أقدر أنك شاركتني هذا.`, `هذا يتطلب شجاعة.`, `أن تقول هذا أمر كبير.`],
        practical: [`حسناً، لنتعامل مع هذا.`, `لنوضح هذا معاً.`, `لنأخذ خطوة بخطوة.`, `لنجد الجزء الأهم أولاً.`, `حسناً، لنحلل هذا معاً.`, `لنجعل هذا أكثر وضوحاً.`],
        coach: [`أنت أكثر قدرة مما تعتقد.`, `لنحول هذا إلى شيء يمكن التصرف به.`, `لقد وصلت حتى الآن.`, `لنجد الطريق للمضي قدماً.`, `يمكنك ذلك  -  سنفعله معاً.`, `لنجد الخطوة الأكثر ثباتاً.`],
        "gentle-humor": [`حسناً، الحياة أحياناً هكذا.`, `لا يوجد وقت مثالي، لكننا نكمل.`, `أحياناً يوم سيء هو مجرد يوم سيء.`, `نواجه هذا معاً.`, `هذه الأمور تحدث  -  لا بأس.`, `حتى لو كان كل شيء فوضى، يمكننا المتابعة.`],
        direct: [`تكلم، أنا أسمع.`, `أخبرني بما حدث.`, `لنكن مباشرين.`, `حسناً، ماذا نفعل الآن؟`, `قلها بوضوح  -  أنا هنا.`, `مباشرة  -  أسمعك.`],
    };
    const validationsAr: Record<Signal, string[]> = {
        sad: [`هذا مؤلم حقاً.`, `هذا النوع من الألم لا يختفي من تلقاء نفسه.`, `أنا آسف لأنك تمر بهذا.`, `هذا صعب حقاً  -  ليس قليلاً، بل كثيراً.`, `ما تشعر به منطقي تماماً.`, `هذا الألم يسكن في أعماقك  -  أشعر بذلك.`],
        anxious: [`يبدو أن العقل يعمل بأقصى سرعة.`, `هذا النوع من الضغط يُنهك من الداخل.`, `الشعور بالقلق وسط كل هذا أمر مفهوم تماماً.`, `حمل كل هذا الغموض دفعة واحدة ثقيل جداً.`, `القلق من هذا هو استجابة إنسانية طبيعية.`, `قلبك يستشعر شيئاً حقيقياً ومهماً.`],
        angry: [`هذا الغضب مفهوم تماماً.`, `حدث شيء حقيقي هنا  -  هذا الإحباط مشروع.`, `كنت سأشعر بنفس الشيء.`, `نعم  -  هذا ظلم حقيقي.`, `هذه الأشياء تؤلم أي شخص من الداخل.`, `الغضب من هذا أمر مقبول تماماً.`],
        tired: [`هذا التعب لا يُشفى بالنوم.`, `لقد حملت الكثير منذ وقت طويل.`, `مع كل هذا، من الطبيعي أن تنفد الطاقة.`, `هذا التعب يتراكم ببطء ثم يضرب دفعة واحدة.`, `من حقك أن تشعر بالتعب من هذا.`, `هذا إنهاك حقيقي، وليس مجرد تعب.`],
        okay: [`أخبرني أكثر.`, `أنا هنا  -  ماذا يحدث؟`, `ما الذي يثقل كاهلك أكثر الآن؟`, `ما أكبر شيء في ذهنك الآن؟`, `كيف حالك اليوم؟`, `مهما يكن، أنا أسمع.`],
    };
    const carryValidationsAr = [`هذا لا يزال معك  -  أستطيع الشعور بذلك.`, `يبدو أن هذا لم يستقر بعد، وهذا مفهوم.`, `لا تزال في منتصف هذا، أليس كذلك؟`, `هذا لم يتركك. لنبقَ هنا قليلاً.`, `شيء من هذا يعود إليك مراراً.`];
    const extrasByToneAr: Record<LocalResponseTone, string[]> = {
        calm: [``, `يمكننا التركيز على جزء واحد فقط الآن.`, `لا داعي للتسرع في حل كل شيء.`, `يمكننا إبقاء هذا مستقراً دون إجبار.`, `خطوة واحدة في كل مرة  -  بلا ضغط.`, `يمكننا الجلوس هنا لحظة قبل المضي قدماً.`],
        supportive: [``, `لا يجب أن تحمل كل الثقل دفعة واحدة.`, `يمكننا البقاء أولاً مع ما يبدو أثقل.`, `إذا كان كل شيء لا يزال فوضوياً، فلا بأس.`, `من المنطقي أن يبدو هذا لا يزال ثقيلاً.`, `لا عجلة لفهم كل شيء بعد.`],
        practical: [``, `لنرى أولاً ما هو الأهم.`, `يمكننا إبقاء هذا قابلاً للإدارة.`, `قطعة واحدة مفيدة تكفي الآن.`, `يمكننا تقسيم هذا قليلاً أكثر.`, `الخطوة الواضحة التالية فقط  -  لا أكثر.`],
        coach: [``, `لنجد أولاً الجزء الأكثر قابلية للتطبيق.`, `نحتاج فقط خطوة واحدة ثابتة الآن.`, `لا يجب أن تفك الخيوط كلها دفعة واحدة.`, `خطوة واحدة متأصلة هي كل ما نحتاجه.`, `يمكننا جعل هذا أبسط مما يبدو.`],
        "gentle-humor": [``, `يمكننا إبقائه خفيفاً دون تجاهله.`, `تحول صغير واحد يكفي الآن.`, `أنا لا أزال هنا معك.`, `فوز صغير لا يزال فوزاً.`, `لا حاجة للمصارعة اليوم.`],
        direct: [``, `لنبقِ هذا واضحاً.`, `يمكننا التعامل مع جزء حقيقي واحد في كل مرة.`, `الجزء المفيد التالي فقط هو ما يهم الآن.`, `ما الأهم هنا والآن؟`, `لنركز على الجزء الذي يهم.`],
    };
    const carryExtrasAr: Record<LocalResponseTone, string[]> = {
        calm: [`لا نحتاج لدفع هذا إلى أي مكان الآن.`, `يمكننا البقاء هنا للحظة.`, `لا داعي لإجبار هذا على الانتهاء.`],
        supportive: [`لا يجب أن تفهمه بشكل مثالي الآن.`, `أنا لا أزال هنا معك في هذا.`, `لا بأس إن لم تفهم كل شيء الآن.`],
        practical: [`لنبقِ هذا بسيطاً الآن.`, `لا نحتاج إلى الإجابة الكاملة، فقط الجزء الواضح التالي.`, `يكفي أن تكون الخطوة التالية واضحة.`],
        coach: [`قبل القيام بأي شيء آخر، لنثبّت هذا.`, `خطوة واحدة راسخة لاحقاً تكفي.`, `ابحث فقط عن خطوة ثابتة أولاً.`],
        "gentle-humor": [`يمكننا إبقائه ناعماً دون تثقيله.`, `لا داعي للصراع مع كل شيء الآن.`, `لا داعي للصراع مع هذا اليوم.`],
        direct: [`لا نُعقّد الأمر الآن.`, `لنتمسك بالجزء الحقيقي أولاً.`, `ركز فقط على ما يهم حقاً الآن.`],
    };
    const reflectLinesAr = [
        keyTopic ? `ذكرت ${keyTopic}  -  ما الجزء الذي يثقل كاهلك أكثر الآن؟` : `ما الجزء من هذا الذي يجلس معك أكثر الآن؟`,
        `ما الذي يصعب التخلي عنه في كل هذا؟`,
        `لو اخترت شيئاً واحداً يزعجك أكثر  -  ما هو؟`,
        `ما الذي تتمنى أن يكون مختلفاً في هذا الوضع؟`,
        `كيف يشعر الجسد بحمل كل هذا الآن؟`,
        `لو كانت الأمور أخف قليلاً  -  ما أول شيء سيتغير؟`,
    ];
    const nextStepLinesAr = [`يمكننا الاستمرار في الحديث، أو إيجاد شيء صغير لتجربته  -  أيهما يبدو مناسباً.`, `بعض الناس يحتاج إلى قول كل شيء أولاً. آخرون يريدون خطة. أين أنت الآن؟`, `يمكننا الاستمرار في الاستكشاف، أو إيجاد خطوة صغيرة. ما الذي يبدو أكثر فائدة الآن؟`, `أنا معك  -  سواء في الحديث أو في إيجاد شيء ملموس للقيام به.`, `هل الأفيد الآن الاستمرار بالحديث، أم إيجاد خطوة صغيرة واحدة للتحرك؟`, `ما الذي يبدو أكثر واقعية  -  أن تُسمع فقط، أم فعل شيء حيال الأمر؟`];
    const listeningOnlyExtrasAr = [`لا يجب أن تحل هذا الآن.`, `لن أذهب إلى أي مكان. قل ما تحتاج.`, `يمكنك الشعور بكل هذا.`, `لا يجب أن ترتب هذا بشكل أنيق.`, `ليس عليك التسرع لفهم كل هذا.`, `قل ما تشاء أو ما تحتاجه  -  أنا هنا في الحالتين.`];

    const openersByToneFr: Record<LocalResponseTone, string[]> = {
        calm: [`Je suis là.`, `Je t'entends.`, `D'accord, on y va doucement.`, `Tu n'es pas seul dans ça.`, `Prends ton temps.`, `Je suis là  -  sans pression.`],
        supportive: [`Ça semble vraiment difficile.`, `Merci de m'avoir dit ça.`, `Je suis content que tu l'aies dit.`, `J'apprécie que tu aies partagé ça.`, `Il faut du courage pour dire ça.`, `Que tu l'aies dit, c'est déjà beaucoup.`],
        practical: [`Bien, voyons ça ensemble.`, `Clarifions ça ensemble.`, `On y va étape par étape.`, `Trouvons d'abord la partie la plus importante.`, `Bien, analysons ça ensemble.`, `Rendons ça plus clair.`],
        coach: [`Tu es plus capable que tu ne le crois.`, `Transformons ça en quelque chose d'actionnable.`, `Tu es déjà arrivé si loin.`, `Trouvons un chemin à suivre.`, `Tu peux y arriver  -  on le fait ensemble.`, `Trouvons l'étape la plus solide.`],
        "gentle-humor": [`Bon, la vie est parfois comme ça.`, `Il n'y a pas de moment parfait, mais on continue.`, `Parfois une mauvaise journée n'est que ça.`, `On fait face à ça ensemble.`, `Ces choses arrivent  -  c'est normal.`, `Même dans le chaos, on peut avancer.`],
        direct: [`Parle, je t'écoute.`, `Dis-moi ce qui s'est passé.`, `Soyons directs.`, `Bon, qu'est-ce qu'on fait maintenant ?`, `Dis-le clairement  -  je suis là.`, `Directement  -  je t'écoute.`],
    };
    const validationsFr: Record<Signal, string[]> = {
        sad: [`Ça fait vraiment mal.`, `Ce genre de douleur ne disparaît pas tout seul.`, `Je suis désolé que tu traverses ça.`, `C'est vraiment difficile  -  pas un peu, beaucoup.`, `Ce que tu ressens a tout son sens.`, `Cette douleur reste en toi  -  je peux l'entendre.`],
        anxious: [`L'esprit semble tourner à toute vitesse.`, `Ce genre de pression épuise de l'intérieur.`, `Se sentir anxieux au milieu de tout ça est tout à fait compréhensible.`, `Porter autant d'incertitude à la fois, c'est très lourd.`, `Être anxieux à ce sujet est une réaction humaine.`, `Ton corps répond à quelque chose de vraiment important.`],
        angry: [`Cette colère est tout à fait compréhensible.`, `Il s'est passé quelque chose de réel ici  -  cette frustration est légitime.`, `Je ressentirais la même chose.`, `Oui  -  c'est vraiment injuste.`, `Ce genre de chose blesse n'importe qui de l'intérieur.`, `Être en colère à ce sujet, c'est normal.`],
        tired: [`Cette fatigue ne se règle pas avec du sommeil.`, `Tu portes trop depuis trop longtemps.`, `Avec tout ça, perdre de l'énergie est compréhensible.`, `Cette fatigue s'accumule lentement, puis frappe d'un coup.`, `Tu as le droit d'être fatigué de ça.`, `C'est un vrai épuisement, pas juste de la fatigue.`],
        okay: [`Dis-m'en plus.`, `Je suis là  -  que se passe-t-il ?`, `Qu'est-ce qui pèse le plus sur toi maintenant ?`, `Quelle est la chose la plus importante dans ta tête en ce moment ?`, `Comment tu vas aujourd'hui ?`, `Quoi que ce soit, je t'écoute.`],
    };
    const carryValidationsFr = [`Ça t'accompagne encore  -  je le sens.`, `On dirait que ça ne s'est pas encore apaisé, et c'est compréhensible.`, `Tu es encore en plein milieu de ça, n'est-ce pas ?`, `Ça ne te lâche pas. Restons là encore un peu.`, `Quelque chose dans tout ça revient sans cesse te chercher.`];
    const extrasByToneFr: Record<LocalResponseTone, string[]> = {
        calm: [``, `On peut rester sur une partie pour l'instant.`, `Pas besoin de tout résoudre d'un coup.`, `On peut garder ça stable sans forcer.`, `Une chose à la fois  -  sans pression.`, `On peut rester là un moment avant d'avancer.`],
        supportive: [``, `Tu n'as pas à porter tout le poids d'un coup.`, `On peut d'abord rester avec ce qui semble le plus lourd.`, `Si tout semble encore en désordre, c'est normal.`, `Ça fait sens que ça semble encore lourd.`, `Pas besoin de tout comprendre maintenant.`],
        practical: [``, `Regardons d'abord ce qui est le plus important.`, `On peut garder ça gérable.`, `Une partie utile suffit pour l'instant.`, `On peut découper ça un peu plus.`, `Juste la prochaine étape claire  -  rien de plus.`],
        coach: [``, `Trouvons d'abord la partie la plus praticable.`, `On n'a besoin que d'un seul mouvement stable maintenant.`, `Tu n'as pas à démêler tout ça en même temps.`, `Un seul pas ancré, c'est tout ce qu'il faut.`, `On peut rendre ça plus simple que ça ne semble.`],
        "gentle-humor": [``, `On peut garder ça léger sans l'ignorer.`, `Un petit changement suffit pour l'instant.`, `Je suis toujours là avec toi.`, `Une petite victoire reste une victoire.`, `Pas de combat de catch requis aujourd'hui.`],
        direct: [``, `Gardons ça clair.`, `On peut gérer une vraie partie à la fois.`, `Seule la prochaine partie utile compte maintenant.`, `Qu'est-ce qui compte le plus ici, maintenant ?`, `Concentrons-nous sur ce qui compte.`],
    };
    const carryExtrasFr: Record<LocalResponseTone, string[]> = {
        calm: [`On n'a pas besoin de pousser ça quelque part pour l'instant.`, `On peut juste rester là un moment.`, `Pas besoin de forcer une résolution.`],
        supportive: [`Tu n'as pas à comprendre ça parfaitement maintenant.`, `Je suis toujours là avec toi dans ça.`, `Ne pas tout comprendre encore, c'est okay.`],
        practical: [`Gardons ça simple pour l'instant.`, `Pas besoin de la réponse complète, juste la prochaine partie claire.`, `La prochaine étape claire suffit.`],
        coach: [`Avant de faire autre chose, stabilisons ça.`, `Une étape solide plus tard suffit.`, `Trouve juste un pas stable d'abord.`],
        "gentle-humor": [`On peut garder ça doux sans l'alourdir.`, `Pas besoin de se battre avec tout ça maintenant.`, `Pas besoin de lutter avec ça aujourd'hui.`],
        direct: [`On ne complique pas ça maintenant.`, `Restons d'abord avec la vraie partie.`, `Concentre-toi juste sur ce qui compte vraiment là.`],
    };
    const reflectLinesFr = [
        keyTopic ? `Tu as mentionné ${keyTopic}  -  quelle partie de ça te pèse le plus maintenant ?` : `Quelle partie de ça est la plus présente en toi maintenant ?`,
        `Quelle est la partie la plus difficile à lâcher là-dedans ?`,
        `Si tu ne devais choisir qu'une chose qui te perturbe le plus  -  ce serait quoi ?`,
        `Qu'est-ce que tu voudrais qui soit différent dans cette situation ?`,
        `Comment ça se ressent dans le corps de porter tout ça là maintenant?`,
        `Si les choses étaient un peu plus légères  -  qu'est-ce qui changerait en premier?`,
    ];
    const nextStepLinesFr = [`On peut continuer à en parler, ou trouver une petite chose à essayer  -  ce qui te semble le mieux.`, `Certaines personnes ont besoin de tout dire d'abord. D'autres veulent un plan. Où en es-tu ?`, `On peut continuer à explorer ça, ou trouver un petit mouvement. Qu'est-ce qui te semble plus utile maintenant ?`, `Je suis avec toi  -  que ce soit pour en parler ou trouver quelque chose de concret à faire.`, `C'est quoi le plus utile là  -  continuer à parler, ou trouver un petit endroit où bouger?`, `Qu'est-ce qui semblerait plus vrai maintenant  -  être entendu, ou faire quelque chose?`];
    const listeningOnlyExtrasFr = [`Tu n'as pas à régler ça maintenant.`, `Je ne vais nulle part. Dis autant ou aussi peu que tu veux.`, `Tu as le droit de ressentir tout ça.`, `Tu n'as pas à emballer ça proprement.`, `Pas besoin de se dépêcher pour comprendre tout ça.`, `Dis autant ou aussi peu que tu veux  -  je suis là dans tous les cas.`];

    const openersByTonePt: Record<LocalResponseTone, string[]> = {
        calm: [`Estou aqui.`, `Te ouço.`, `Tudo bem, vamos devagar.`, `Você não está sozinho nisso.`, `Pode ir no seu tempo.`, `Estou aqui  -  sem pressa.`],
        supportive: [`Isso parece realmente difícil.`, `Obrigado por me contar isso.`, `Fico feliz que você falou.`, `Agradeço por compartilhar isso comigo.`, `Precisa de coragem pra falar isso.`, `Que você disse já é muito.`],
        practical: [`Certo, vamos lidar com isso.`, `Vamos esclarecer isso juntos.`, `Vamos um passo de cada vez.`, `Vamos encontrar a parte mais importante primeiro.`, `Certo, vamos analisar juntos.`, `Vamos deixar isso mais claro.`],
        coach: [`Você é mais capaz do que imagina.`, `Vamos transformar isso em algo acionável.`, `Você já chegou até aqui.`, `Vamos encontrar o caminho a seguir.`, `Você consegue  -  a gente faz junto.`, `Vamos encontrar o passo mais firme.`],
        "gentle-humor": [`Bom, a vida é assim às vezes.`, `Não há momento perfeito, mas continuamos.`, `Às vezes um dia ruim é só isso.`, `A gente enfrenta isso junto.`, `Essas coisas acontecem  -  tudo bem.`, `Mesmo no caos, dá pra continuar.`],
        direct: [`Fala, estou ouvindo.`, `Me conta o que aconteceu.`, `Vamos ser diretos.`, `Certo, o que fazemos agora?`, `Me diz claro  -  estou aqui.`, `Direto ao ponto  -  te ouço.`],
    };
    const validationsPt: Record<Signal, string[]> = {
        sad: [`Isso realmente dói.`, `Esse tipo de dor não some sozinha.`, `Sinto muito que você esteja passando por isso.`, `É realmente difícil  -  não um pouco, muito.`, `O que você sente faz todo sentido.`, `Essa dor fica dentro de você  -  consigo sentir isso.`],
        anxious: [`Parece que a mente está na velocidade máxima.`, `Esse tipo de pressão esgota por dentro.`, `Sentir-se inquieto no meio de tudo isso é completamente compreensível.`, `Carregar tanta incerteza ao mesmo tempo é muito pesado.`, `Estar ansioso com isso é uma resposta humana.`, `Seu corpo está respondendo a algo que realmente importa.`],
        angry: [`Essa raiva faz todo sentido.`, `Algo real aconteceu aqui  -  essa frustração é legítima.`, `Eu me sentiria do mesmo jeito.`, `Sim  -  isso é realmente injusto.`, `Essas coisas machucam qualquer um por dentro.`, `Ficar com raiva disso é completamente válido.`],
        tired: [`Esse cansaço não se resolve dormindo.`, `Você tem carregado demais há muito tempo.`, `Com tudo isso, a energia acabar é compreensível.`, `Esse esgotamento vai se acumulando aos poucos e de repente chega tudo junto.`, `Você tem o direito de estar cansado disso.`, `É um esgotamento real, não só cansaço.`],
        okay: [`Me conta mais.`, `Estou aqui  -  o que está acontecendo?`, `O que está pesando mais em você agora?`, `Qual é a coisa mais importante na sua cabeça agora?`, `Como você está hoje?`, `Seja o que for, estou ouvindo.`],
    };
    const carryValidationsPt = [`Isso ainda está com você  -  eu consigo sentir.`, `Parece que isso ainda não se assentou, e faz sentido.`, `Você ainda está no meio disso, certo?`, `Isso não te solta. Vamos ficar aqui mais um pouco.`, `Algo disso continua voltando para você.`];
    const extrasByTonePt: Record<LocalResponseTone, string[]> = {
        calm: [``, `Podemos ficar com uma parte por enquanto.`, `Não precisa resolver tudo de uma vez.`, `Podemos manter isso estável sem forçar.`, `Uma coisa de cada vez  -  sem pressão.`, `Podemos ficar aqui um momento antes de continuar.`],
        supportive: [``, `Você não precisa carregar todo o peso de uma vez.`, `Podemos ficar primeiro com o que parece mais pesado.`, `Se tudo ainda parece bagunçado, tudo bem.`, `Faz sentido que isso ainda pareça pesado.`, `Não precisa entender tudo agora.`],
        practical: [``, `Vamos olhar primeiro o que é mais importante.`, `Podemos manter isso gerenciável.`, `Uma parte útil é suficiente por agora.`, `Podemos dividir isso um pouco mais.`, `Só o próximo passo claro  -  nada mais.`],
        coach: [``, `Vamos encontrar primeiro a parte mais viável.`, `Só precisamos de um movimento estável agora.`, `Você não precisa desembaraçar tudo de uma vez.`, `Um passo firme é tudo que precisamos.`, `Podemos tornar isso mais simples do que parece.`],
        "gentle-humor": [``, `Podemos manter isso leve sem ignorar.`, `Uma pequena mudança é suficiente agora.`, `Ainda estou aqui com você.`, `Uma pequena vitória ainda é uma vitória.`, `Não é preciso lutar com tudo hoje.`],
        direct: [``, `Vamos manter isso claro.`, `Podemos lidar com uma parte real por vez.`, `Só a próxima parte útil importa agora.`, `O que importa mais aqui, agora?`, `Vamos focar na parte que conta.`],
    };
    const carryExtrasPt: Record<LocalResponseTone, string[]> = {
        calm: [`Não precisamos empurrar isso para nenhum lugar agora.`, `Podemos ficar aqui por um momento.`, `Não precisa forçar uma solução.`],
        supportive: [`Você não precisa entender isso perfeitamente agora.`, `Ainda estou aqui com você nisso.`, `Ainda não entender tudo tá bem.`],
        practical: [`Vamos manter isso simples por agora.`, `Não precisa da resposta completa, só da próxima parte clara.`, `Só o próximo passo claro já é suficiente.`],
        coach: [`Antes de fazer qualquer outra coisa, vamos estabilizar isso.`, `Um passo sólido depois é suficiente.`, `Só procura um passo estável primeiro.`],
        "gentle-humor": [`Podemos manter isso suave sem pesar mais.`, `Não precisa lutar com tudo agora.`, `Não precisa lutar com isso hoje.`],
        direct: [`Não complicamos isso agora.`, `Vamos ficar com a parte real primeiro.`, `Foca só no que realmente importa agora.`],
    };
    const reflectLinesPt = [
        keyTopic ? `Você mencionou ${keyTopic}  -  qual parte disso está pesando mais em você agora?` : `Qual parte disso está mais presente em você agora?`,
        `O que é mais difícil de soltar de tudo isso?`,
        `Se você tivesse que escolher uma coisa que mais te incomoda  -  qual seria?`,
        `O que você gostaria que fosse diferente nessa situação?`,
        `Como está parecendo carregar tudo isso no corpo agora?`,
        `Se as coisas fossem um pouco mais leves  -  o que mudaria primeiro?`,
    ];
    const nextStepLinesPt = [`Podemos continuar conversando, ou encontrar uma pequena coisa para tentar  -  o que parecer certo.`, `Algumas pessoas precisam dizer tudo primeiro. Outras querem um plano. Onde você está?`, `Podemos continuar desempacotando isso, ou encontrar um pequeno movimento. O que parece mais útil agora?`, `Estou com você  -  seja conversando ou encontrando algo concreto para fazer.`, `O que é mais útil agora  -  continuar conversando, ou achar um pequeno passo para mover?`, `O que seria mais real agora  -  ser ouvido, ou fazer algo a respeito?`];
    const listeningOnlyExtrasPt = [`Você não precisa resolver isso agora.`, `Não vou a lugar nenhum. Diga o quanto precisar.`, `Você pode sentir tudo isso.`, `Não precisa empacotar isso de forma organizada.`, `Não tem pressa para entender nada disso.`, `Fala quanto quiser ou quanto precisar  -  estou aqui de qualquer jeito.`];

    const openersByToneRu: Record<LocalResponseTone, string[]> = {
        calm: [`Я здесь.`, `Я слышу тебя.`, `Хорошо, идём медленно.`, `Ты не один в этом.`, `Не торопись.`, `Я здесь  -  без спешки.`],
        supportive: [`Это звучит действительно тяжело.`, `Спасибо, что поделился этим.`, `Я рад, что ты сказал об этом.`, `Ценю, что ты поделился со мной.`, `Это требует смелости  -  сказать это.`, `То, что ты сказал это  -  уже много.`],
        practical: [`Хорошо, давай разберёмся с этим.`, `Давай прояснём это вместе.`, `Идём шаг за шагом.`, `Давай сначала найдём самую важную часть.`, `Хорошо, разберём это вместе.`, `Сделаем это понятнее.`],
        coach: [`Ты способнее, чем думаешь.`, `Давай превратим это во что-то конкретное.`, `Ты уже зашёл так далеко.`, `Найдём путь вперёд.`, `Ты справишься  -  мы сделаем это вместе.`, `Найдём самый устойчивый шаг.`],
        "gentle-humor": [`Ну, жизнь иногда такая.`, `Идеального момента нет, но мы продолжаем.`, `Иногда плохой день  -  это просто плохой день.`, `Встретим это вместе.`, `Такое бывает  -  всё нормально.`, `Даже в хаосе можно двигаться дальше.`],
        direct: [`Говори, я слушаю.`, `Расскажи мне, что произошло.`, `Будем прямыми.`, `Хорошо, что делаем дальше?`, `Скажи прямо  -  я здесь.`, `Без обиняков  -  слушаю.`],
    };
    const validationsRu: Record<Signal, string[]> = {
        sad: [`Это действительно больно.`, `Такая боль не проходит сама по себе.`, `Сожалею, что ты через это проходишь.`, `Это действительно тяжело  -  не немного, а по-настоящему.`, `То, что ты чувствуешь, полностью понятно.`, `Эта боль оседает глубоко  -  я это чувствую.`],
        anxious: [`Кажется, мозг работает на полной скорости.`, `Такое давление изматывает изнутри.`, `Тревожиться посреди всего этого  -  совершенно понятно.`, `Нести столько неопределённости сразу  -  это очень тяжело.`, `Тревога об этом  -  человеческая реакция.`, `Твоё тело откликается на что-то по-настоящему важное.`],
        angry: [`Этот гнев полностью понятен.`, `Здесь произошло что-то настоящее  -  это разочарование оправдано.`, `Я бы чувствовал то же самое.`, `Да  -  это действительно несправедливо.`, `Такие вещи задевают любого изнутри.`, `Злиться на это  -  совершенно нормально.`],
        tired: [`Эта усталость не лечится сном.`, `Ты слишком долго несёшь слишком много.`, `При всём этом энергия заканчивается  -  это понятно.`, `Эта усталость накапливается медленно, а потом ударяет разом.`, `Ты имеешь право устать от этого.`, `Это настоящее истощение, а не просто усталость.`],
        okay: [`Расскажи больше.`, `Я здесь  -  что происходит?`, `Что сейчас тяготит тебя больше всего?`, `Что сейчас самое главное у тебя в голове?`, `Как ты сегодня?`, `Что бы ни было  -  я слушаю.`],
    };
    const carryValidationsRu = [`Это всё ещё с тобой  -  я чувствую это.`, `Кажется, это ещё не улеглось, и это понятно.`, `Ты всё ещё внутри этого, верно?`, `Оно тебя не отпускает. Побудем здесь ещё немного.`, `Что-то из этого снова и снова возвращается к тебе.`];
    const extrasByToneRu: Record<LocalResponseTone, string[]> = {
        calm: [``, `Пока можем держаться одной части.`, `Не нужно торопиться решать всё сразу.`, `Можем держать это стабильно, не форсируя.`, `По одному шагу  -  без спешки.`, `Можем побыть здесь минуту, прежде чем двигаться дальше.`],
        supportive: [``, `Тебе не нужно нести весь груз сразу.`, `Можем сначала остаться с тем, что кажется самым тяжёлым.`, `Если всё ещё кажется запутанным, это нормально.`, `Логично, что это всё ещё кажется тяжёлым.`, `Не нужно понимать всё это сразу.`],
        practical: [``, `Давай сначала посмотрим на самое важное.`, `Можем держать это управляемым.`, `Одна полезная часть  -  достаточно на сейчас.`, `Можем разбить это чуть подробнее.`, `Только следующий ясный шаг  -  не больше.`],
        coach: [``, `Сначала найдём самую рабочую часть.`, `Нам нужен только один устойчивый шаг сейчас.`, `Тебе не нужно распутывать всё сразу.`, `Один твёрдый шаг  -  это всё, что нужно.`, `Можем сделать это проще, чем кажется.`],
        "gentle-humor": [``, `Можем держать это лёгким, не игнорируя.`, `Одного маленького сдвига достаточно сейчас.`, `Я всё ещё здесь с тобой.`, `Маленькая победа  -  всё равно победа.`, `Не нужно бороться со всем сегодня.`],
        direct: [``, `Держим это ясным.`, `Можем работать с одной реальной частью за раз.`, `Сейчас важна только следующая полезная часть.`, `Что важнее всего здесь и сейчас?`, `Сосредоточимся на том, что имеет значение.`],
    };
    const carryExtrasRu: Record<LocalResponseTone, string[]> = {
        calm: [`Не нужно никуда толкать это прямо сейчас.`, `Можем просто побыть здесь какое-то время.`, `Не нужно заставлять это разрешиться.`],
        supportive: [`Тебе не нужно понимать это идеально прямо сейчас.`, `Я всё ещё здесь с тобой в этом.`, `Не понимать всё ещё  -  это нормально.`],
        practical: [`Пока держим это простым.`, `Не нужен полный ответ, только следующая ясная часть.`, `Достаточно следующего ясного шага.`],
        coach: [`Прежде чем делать что-то ещё, устабилизируем это.`, `Потом одного твёрдого шага будет достаточно.`, `Просто найди один устойчивый шаг сначала.`],
        "gentle-humor": [`Можем держать это мягким, не утяжеляя.`, `Не нужно бороться со всем прямо сейчас.`, `Не нужно бороться с этим сегодня.`],
        direct: [`Не будем усложнять это сейчас.`, `Сначала держимся реальной части.`, `Сосредоточься только на том, что сейчас важно.`],
    };
    const reflectLinesRu = [
        keyTopic ? `Ты упомянул ${keyTopic}  -  что в этом давит на тебя больше всего сейчас?` : `Какая часть этого сейчас давит на тебя больше всего?`,
        `Что сложнее всего отпустить в этом?`,
        `Если бы нужно было выбрать одну вещь, которая беспокоит больше всего  -  что бы это было?`,
        `Что ты хотел бы, чтобы было иначе в этой ситуации?`,
        `Как ощущается всё это в теле прямо сейчас?`,
        `Если бы стало немного легче  -  что изменилось бы первым?`,
    ];
    const nextStepLinesRu = [`Можем продолжить разговор, или найти одну маленькую вещь для попытки  -  что кажется правильным.`, `Некоторым людям нужно сначала всё высказать. Другие хотят план. Где ты сейчас?`, `Можем продолжить разбирать это, или найти небольшой шаг. Что кажется более полезным сейчас?`, `Я с тобой  -  будь то разговор или нахождение чего-то конкретного.`, `Что сейчас полезнее  -  просто говорить об этом, или найти маленький шаг вперед?`, `Что было бы более настоящим  -  просто быть услышанным, или сделать что-то?`];
    const listeningOnlyExtrasRu = [`Тебе не нужно разбираться с этим прямо сейчас.`, `Я никуда не ухожу. Говори столько, сколько нужно.`, `Ты можешь чувствовать всё это.`, `Не нужно аккуратно упаковывать это.`, `Нет никакой спешки разбираться во всём этом.`, `Говори столько, сколько хочешь  -  я здесь в любом случае.`];

    const openersByToneId: Record<LocalResponseTone, string[]> = {
        calm: [`Aku di sini.`, `Aku dengarkan.`, `Baik, kita pelan-pelan.`, `Kamu tidak sendirian.`, `Ambil waktu kamu.`, `Aku di sini  -  tidak perlu terburu-buru.`],
        supportive: [`Kedengarannya memang berat.`, `Terima kasih sudah cerita.`, `Aku senang kamu mau bicara.`, `Aku menghargai kamu berbagi ini.`, `Perlu keberanian untuk bilang ini.`, `Bahwa kamu bilang ini saja sudah banyak artinya.`],
        practical: [`Oke, mari kita lihat ini.`, `Mari kita jernihkan bersama.`, `Kita ambil satu langkah demi satu.`, `Temukan dulu bagian yang paling penting.`, `Oke, kita analisis bersama.`, `Mari kita buat ini lebih jelas.`],
        coach: [`Kamu lebih mampu dari yang kamu kira.`, `Mari kita jadikan ini sesuatu yang bisa dilakukan.`, `Kamu sudah sampai sejauh ini.`, `Mari kita temukan jalan ke depan.`, `Kamu bisa  -  kita lakukan bersama.`, `Mari kita temukan langkah yang paling mantap.`],
        "gentle-humor": [`Ya, hidup memang kadang begitu.`, `Tidak ada momen sempurna, tapi kita terus.`, `Kadang hari buruk ya memang hari buruk.`, `Kita hadapi ini bersama.`, `Hal-hal seperti ini memang terjadi  -  tidak apa-apa.`, `Meski kacau, kita bisa tetap melangkah.`],
        direct: [`Bicara, aku dengarkan.`, `Ceritakan apa yang terjadi.`, `Mari langsung saja.`, `Oke, apa yang kita lakukan sekarang?`, `Katakan dengan jelas  -  aku di sini.`, `Langsung saja  -  aku mendengarkan.`],
    };
    const validationsId: Record<Signal, string[]> = {
        sad: [`Ini memang menyakitkan.`, `Rasa sakit seperti ini tidak hilang sendiri.`, `Aku minta maaf kamu harus melewati ini.`, `Ini memang sulit  -  bukan sedikit, tapi banyak.`, `Yang kamu rasakan itu masuk akal.`, `Rasa ini duduk begitu dalam  -  aku bisa merasakan beratnya.`],
        anxious: [`Rasanya pikiran berjalan di kecepatan penuh.`, `Tekanan seperti ini menguras dari dalam.`, `Merasa gelisah di tengah semua ini sangat bisa dimengerti.`, `Menanggung begitu banyak ketidakpastian sekaligus memang berat.`, `Cemas akan hal ini adalah respons yang manusiawi.`, `Tubuhmu merespons sesuatu yang benar-benar penting.`],
        angry: [`Kemarahan itu sangat bisa dimengerti.`, `Ada sesuatu yang nyata terjadi di sini  -  frustrasi itu sah.`, `Aku juga akan merasakan hal yang sama.`, `Ya  -  ini memang tidak adil.`, `Hal-hal seperti ini menyakiti siapa pun dari dalam.`, `Marah karena ini sepenuhnya oke.`],
        tired: [`Kelelahan ini tidak sembuh hanya dengan tidur.`, `Kamu sudah menanggung terlalu banyak terlalu lama.`, `Dengan semua ini, kehabisan energi itu bisa dimengerti.`, `Kelelahan ini menumpuk perlahan lalu tiba semua sekaligus.`, `Kamu berhak merasa lelah karenanya.`, `Ini kelelahan yang nyata, bukan sekadar capek.`],
        okay: [`Ceritakan lebih banyak.`, `Aku di sini  -  ada apa?`, `Apa yang paling berat untukmu sekarang?`, `Apa yang paling besar di pikiranmu sekarang?`, `Bagaimana keadaanmu hari ini?`, `Apapun itu, aku mendengarkan.`],
    };
    const carryValidationsId = [`Ini masih bersamamu  -  aku bisa merasakannya.`, `Sepertinya ini belum benar-benar mereda, dan itu masuk akal.`, `Kamu masih di tengah ini, kan?`, `Ini belum melepaskanmu. Mari kita tetap di sini sebentar.`, `Ada sesuatu dari ini yang terus kembali padamu.`];
    const extrasByToneId: Record<LocalResponseTone, string[]> = {
        calm: [``, `Kita bisa fokus pada satu bagian dulu.`, `Tidak perlu terburu-buru menyelesaikan semuanya.`, `Kita bisa jaga ini tetap stabil tanpa memaksa.`, `Satu langkah demi satu  -  tidak perlu terburu.`, `Kita bisa tinggal sejenak di sini sebelum melanjutkan.`],
        supportive: [``, `Kamu tidak harus menanggung semua beban sekaligus.`, `Kita bisa dulu bersama bagian yang terasa paling berat.`, `Kalau semuanya masih terasa kacau, tidak apa-apa.`, `Masuk akal kalau ini masih terasa berat.`, `Tidak perlu memahami semuanya sekarang.`],
        practical: [``, `Mari lihat dulu yang paling penting.`, `Kita bisa jaga ini tetap bisa dikelola.`, `Satu bagian yang berguna sudah cukup untuk sekarang.`, `Kita bisa urai ini sedikit lagi.`, `Hanya langkah berikutnya yang jelas  -  tidak lebih.`],
        coach: [``, `Mari temukan dulu bagian yang paling bisa dilakukan.`, `Kita hanya butuh satu langkah stabil sekarang.`, `Kamu tidak perlu mengurai semuanya sekaligus.`, `Satu langkah yang mantap  -  itu yang kita butuhkan.`, `Kita bisa buat ini lebih sederhana dari yang terasa.`],
        "gentle-humor": [``, `Kita bisa jaga ini tetap ringan tanpa mengabaikan.`, `Satu perubahan kecil sudah cukup sekarang.`, `Aku masih di sini bersamamu.`, `Kemenangan kecil tetaplah kemenangan.`, `Tidak perlu gulat dengan semuanya hari ini.`],
        direct: [``, `Mari kita jaga ini tetap jelas.`, `Kita bisa tangani satu bagian nyata sekaligus.`, `Hanya bagian berikutnya yang berguna yang penting sekarang.`, `Apa yang paling penting di sini, sekarang?`, `Fokus pada bagian yang paling berarti.`],
    };
    const carryExtrasId: Record<LocalResponseTone, string[]> = {
        calm: [`Kita tidak perlu mendorong ini ke mana pun sekarang.`, `Kita bisa tinggal di sini sejenak.`, `Tidak perlu memaksanya selesai.`],
        supportive: [`Kamu tidak harus memahaminya dengan sempurna sekarang.`, `Aku masih di sini bersamamu dalam ini.`, `Belum memahami semuanya itu tidak apa-apa.`],
        practical: [`Mari kita jaga ini tetap sederhana sekarang.`, `Tidak butuh jawaban lengkap, hanya bagian berikutnya yang jelas.`, `Satu langkah kecil yang jelas sudah cukup.`],
        coach: [`Sebelum melakukan yang lain, kita stabilkan ini dulu.`, `Satu langkah yang mantap nanti sudah cukup.`, `Cari satu langkah yang stabil dulu.`],
        "gentle-humor": [`Kita bisa jaga ini tetap lembut tanpa memperberatnya.`, `Tidak perlu bergulat dengan semuanya sekarang.`, `Tidak perlu bergulat dengan ini hari ini.`],
        direct: [`Kita tidak memperumit ini sekarang.`, `Tetap pada bagian yang nyata dulu.`, `Fokus hanya pada bagian yang benar-benar penting sekarang.`],
    };
    const reflectLinesId = [
        keyTopic ? `Kamu menyebut ${keyTopic}  -  bagian mana dari itu yang paling terasa menekan sekarang?` : `Bagian mana dari ini yang paling terasa berat bagimu sekarang?`,
        `Apa yang paling sulit dilepaskan dari semua ini?`,
        `Kalau harus memilih satu hal yang paling mengganggumu  -  apa itu?`,
        `Apa yang kamu harapkan berbeda dari situasi ini?`,
        `Bagaimana rasanya menanggung semua ini di tubuh sekarang?`,
        `Kalau semuanya sedikit lebih ringan  -  apa yang akan berubah pertama?`,
    ];
    const nextStepLinesId = [`Kita bisa terus ngobrol, atau temukan satu hal kecil untuk dicoba  -  mana yang terasa tepat.`, `Beberapa orang butuh bilang semuanya dulu. Lainnya mau rencana. Kamu di mana sekarang?`, `Kita bisa terus membuka ini, atau temukan langkah kecil. Apa yang lebih berguna sekarang?`, `Aku bersamamu  -  entah itu ngobrol atau menemukan sesuatu yang konkret untuk dilakukan.`, `Apa yang lebih berguna sekarang  -  terus bicara, atau cari satu hal kecil yang bisa digerakkan?`, `Apa yang akan terasa lebih nyata  -  didengarkan, atau melakukan sesuatu tentang ini?`];
    const listeningOnlyExtrasId = [`Kamu tidak perlu mencari tahu ini sekarang.`, `Aku tidak kemana-mana. Katakan sebanyak yang kamu butuhkan.`, `Kamu boleh merasakan semua ini.`, `Tidak perlu membereskan ini dengan rapi.`, `Tidak perlu buru-buru memahami semua ini.`, `Katakan sebanyak atau sesedikit yang kamu mau  -  aku di sini.`];

    const openersByToneUr: Record<LocalResponseTone, string[]> = {
        calm: [`Main aap ke saath hoon.`, `Main sun raha hoon.`, `Theek hai, dheere chalte hain.`, `Aap is mein akele nahi hain.`, `Koi jaldi nahi  -  main yahan hoon.`, `Apna waqt lein.`],
        supportive: [`Yeh sach mein mushkil lagg raha hai.`, `Ji shukriya ke aap ne bataya.`, `Khushi hai ke aap ne kaha.`, `Shukrguza hoon ke aap ne share kiya.`, `Yeh kehna himmat ki baat thi.`],
        practical: [`Achha, dekhte hain.`, `Ise milkar samjhte hain.`, `Ek qadam ek baar.`, `Pehle sabse zaroori hissa dhoondhte hain.`, `Ise clear karte hain milkar.`],
        coach: [`Aap apni soch se zyada capable hain.`, `Ise qabil-e-amal banate hain.`, `Aap bohot aage aa chuke hain.`, `Aage ka rasta dhoondhte hain.`, `Aap kar sakte hain  -  milkar chalte hain.`],
        "gentle-humor": [`Achha, zindagi kabhi kabhi aisi hoti hai.`, `Koi perfect waqt nahi hota, lekin hum chalte hain.`, `Kabhi kabhi bura din sirf bura din hota hai.`, `Milkar is ka saamna karte hain.`, `Muskil hai  -  lekin saath mein hal ho sakta hai.`],
        direct: [`Batain, main sun raha hoon.`, `Batao kya hua.`, `Seedha baat karte hain.`, `Achha, ab kya karte hain?`, `Mujhe batao  -  seedha seedha.`],
    };
    const openersByToneDe: Record<LocalResponseTone, string[]> = {
        calm: ["Ich bin hier.", "Ich höre zu.", "Nimm dir Zeit.", "Alles gut, ich bin da.", "Kein Druck  -  ich bin einfach da.", "Wir gehen das zusammen an."],
        supportive: ["Das klingt wirklich schwer.", "Das ist viel auf einmal.", "Ich verstehe, dass das sehr belastend ist.", "Das ist wirklich nicht leicht.", "Danke, dass du mir das sagst.", "Es gehört Mut dazu, das auszusprechen."],
        practical: ["Lass uns das zusammen angehen.", "Was wäre der nächste kleine Schritt?", "Wir können das sortieren.", "Was brauchst du gerade am meisten?", "Gut, schauen wir uns das genauer an.", "Wir klären das zusammen."],
        coach: ["Du schaffst das.", "Was hält dich gerade am meisten aufrecht?", "Stärker als du denkst.", "Was hat dir schon mal geholfen in solchen Momenten?", "Du bist weiter als du glaubst.", "Lass uns den nächsten soliden Schritt finden."],
        "gentle-humor": ["Klingt anstrengend  -  gut, dass du redest.", "Das Leben ist manchmal echt nervig.", "Stell dir vor, du erzählst das einem Freund  -  was würdest du sagen?", "Manchmal ist ein schlechter Tag einfach ein schlechter Tag.", "Wir machen das zusammen  -  kein Ringkampf nötig."],
        direct: ["Was ist passiert?", "Erzähl mir mehr.", "Was beschäftigt dich?", "Womit fangen wir an?", "Sag mir direkt  -  ich höre zu."],
    };

    const validationsUr: Record<Signal, string[]> = {
        sad: [`Yeh sach mein bahut dard deta hai.`, `Is tarah ka dard apne aap theek nahi hota.`, `Mujhe afsos hai ke aap isse guzar rahe hain.`, `Yeh sach mein mushkil hai  -  thoda nahi, bahut zyada.`, `Jo aap feel kar rahe hain, woh bilkul samajh aata hai.`, `Yeh dard andar tak baithta hai  -  main samajh sakta hoon.`],
        anxious: [`Lagg raha hai dimaag poori speed mein chal raha hai.`, `Is tarah ka dabaao andar se bahut thaka deta hai.`, `In sab ke beech bechain rehna bilkul samajh aata hai.`, `Itni saari uncertainty ek saath uthana bahut bhaari hai.`, `Is par bechain rehna ek insaani response hai.`, `Aapka dil kisi sachchi baat ko mehsoos kar raha hai.`],
        angry: [`Yeh gussa bilkul samajh aata hai.`, `Yahan kuch asal mein hua hai  -  yeh frustration durust hai.`, `Main bhi aisa hi feel karta.`, `Haan  -  yeh sach mein nainsaafi hai.`, `Is tarah ki baat kisi ko bhi andar tak jalati hai.`, `Is par gussa hona theek hai.`],
        tired: [`Yeh thakaan sirf neend se theek nahi hoti.`, `Aap bahut arsay se bahut kuch uthaye hue hain.`, `In sab ke saath energy ka kam hona samajh aata hai.`, `Yeh thakaan dheere dheere jama hoti hai, phir ek saath lagg jaati hai.`, `Aapko isse thake rehne ka haq hai.`, `Yeh sach mein nik hona hai, sirf thakaan nahi.`],
        okay: [`Thoda aur bataiye.`, `Main hoon  -  kya ho raha hai?`, `Abhi aap par sabse zyada kya bhaari hai?`, `Abhi dimaag mein sabse badi baat kya hai?`, `Aaj kaisa chal raha hai?`, `Jo bhi ho  -  main yahan hoon.`],
    };
    const carryValidationsUr = [`Yeh abhi bhi aapke saath hai  -  main yeh mehsoos kar sakta hoon.`, `Lagg raha hai yeh abhi bhi settle nahi hua, aur yeh samajh aata hai.`, `Aap abhi bhi is ke beech mein hain, nahi?`, `Yeh aapko chhod nahi raha. Thodi der aur is ke saath rehte hain.`, `Kuch is ke baare mein baar baar wapas aata hai aapke liye.`];
    const extrasByToneUr: Record<LocalResponseTone, string[]> = {
        calm: [``, `Abhi sirf ek hissa pakad ke chal sakte hain.`, `Puri baat ek saath sulajhne ki jaldi nahi.`, `Bina force kiye stable rakh sakte hain.`, `Ek baar mein ek cheez  -  koi pressure nahi.`, `Aage badhne se pehle thodi der yahan baith sakte hain.`],
        supportive: [``, `Aapko sab kuch ek saath uthana nahi hai.`, `Jo sabse bhaari hai, pehle usi ke saath rehte hain.`, `Agar sab abhi bhi uljha lag raha hai, koi baat nahi.`, `Yeh sahi lagta hai ke yeh abhi bhi bhaari hai.`, `Abhi sab samajhne ki koi jaldi nahi.`],
        practical: [``, `Pehle jo sabse zaroori hai woh dekhte hain.`, `Ise sambhalne laiq rakh sakte hain.`, `Abhi ek kaam ki cheez dekhna kaafi hai.`, `Ise thoda aur tod sakte hain.`, `Sirf agla saaf qadam  -  aur kuch nahi.`],
        coach: [``, `Pehle sabse kaam ka hissa dhoondhte hain.`, `Abhi sirf ek stable move kaafi hai.`, `Aapko sab kuch ek saath suljhana nahi hai.`, `Ek grounded qadam hi kaafi hai.`, `Ise utna aasaan bana sakte hain jitna lagta nahi.`],
        "gentle-humor": [``, `Ise halka rakh sakte hain bina ignore kiye.`, `Abhi ek chhota shift kaafi hai.`, `Main abhi bhi aapke saath hoon.`, `Ek chhoti jeet abhi bhi jeet hai.`, `Aaj poori kushti ladhne ki zaroorat nahi.`],
        direct: [``, `Ise saaf rakhte hain.`, `Ek real hissa ek baar mein dekh sakte hain.`, `Abhi sirf agla useful hissa kaafi hai.`, `Yahan, abhi sabse zyada kya zaroori hai?`, `Jo cheez mayne rakhti hai, uspe focus karte hain.`],
    };
    const carryExtrasUr: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne ki zaroorat nahi.`, `Thodi der isi ke saath reh sakte hain.`, `Ise force karke khatam karne ki zaroorat nahi.`],
        supportive: [`Aapko ise ab perfectly samjhana zaruri nahi.`, `Main abhi bhi aapke saath hoon isme.`, `Abhi sab nahi samajh aaya  -  yeh theek hai.`],
        practical: [`Abhi ise simple rakhte hain.`, `Poora jawab nahi, bas agla saaf hissa dekhna hai.`, `Agla saaf qadam hi kaafi hai.`],
        coach: [`Kuch karne se pehle ise stable karte hain.`, `Baad mein ek grounded step kaafi hoga.`, `Pehle ek grounded qadam dhoondhein.`],
        "gentle-humor": [`Ise halka rakh sakte hain bina uljhaye.`, `Abhi poori kushti ladne ki zaroorat nahi.`, `Aaj isse kushti karne ki zaroorat nahi.`],
        direct: [`Abhi ise complicated nahi karte.`, `Pehle real hissa pakadte hain.`, `Sirf abhi jo sach mein zaroori hai uspar dhyaan dein.`],
    };
    const reflectLinesUr = [
        keyTopic ? `Aapne ${keyTopic} ki baat ki  -  us mein abhi sabse zyada kya daba raha hai?` : `Is mein abhi sabse zyada kya aap par bhaari hai?`,
        `Is mein sabse zyada kya uncomfortable hai?`,
        `Agar ek hi cheez chunni ho jo sabse zyada pareshaan kare  -  woh kya hogi?`,
        `Aap chahte hain is situation mein kya alag hota?`,
        `Yeh sab uthana jism mein kaise feel ho raha hai abhi?`,
        `Agar yeh thoda halka hota  -  sabse pehle kya badalta?`,
    ];
    const nextStepLinesUr = [`Hum baat karte rehte hain, ya ek chhoti cheez try karte hain  -  jo sahi lage woh.`, `Kuch logon ko pehle sab bol dena hota hai. Kuch plan chahte hain. Aap abhi kahan hain?`, `Ise aur kholte hain, ya ek chhota kadam. Abhi kya zyada useful lagta hai?`, `Main aapke saath hoon  -  chahe baat karte rehna ho ya kuch concrete karna.`, `Kya zyada kaam karega  -  baat karte rehna, ya ek chhoti cheez try karna?`, `Aap ki marzi par hai  -  sunna chahte hain, ya kuch thoda saath mein sochein?`];
    const listeningOnlyExtrasUr = [`Abhi ise figure out karne ki zaroorat nahi.`, `Main kahin nahi ja raha. Jitna chaahein utna bolein.`, `Aap yeh sab feel kar sakte hain.`, `Ise neatly wrap up karne ki koi zaroorat nahi.`, `Ise samajhne ki abhi koi jaldi nahi.`, `Jitna chahein utna bolein  -  main yahan hoon, chahe zyada ho ya kam.`];

    const validationsDe: Record<Signal, string[]> = {
        sad: ["Das tut wirklich weh.", "Dieser Schmerz ist real.", "So etwas kann sich sehr einsam anfühlen.", "Das ist schwer zu tragen.", "Das verdient mehr als nur ein kurzes Okay.", "Du musst das nicht kleinreden."],
        anxious: ["Diese Unruhe macht Sinn.", "Es ist okay, sich überfordert zu fühlen.", "Dieses Kribbeln im Bauch ist real.", "Manchmal ist alles auf einmal zu viel.", "Das klingt sehr anstrengend.", "Dein Körper spürt, dass hier etwas wirklich zählt."],
        angry: ["Diese Wut hat ihren Grund.", "Es ist okay, wütend zu sein.", "Das klingt wirklich frustrierend.", "Das würde jeden aufbringen.", "Das ist verständlich  -  da ist wirklich etwas passiert.", "Solche Dinge tun weh, egal wie stark man ist."],
        tired: ["Du bist wirklich erschöpft.", "Diese Müdigkeit ist echt.", "Du hast schon zu viel getragen.", "Manchmal ist der Körper einfach fertig.", "Das ist kein normales Müdesein  -  das ist echter Verschleiß.", "Das merkt man dem Körper an  -  das ist keine Schwäche."],
        okay: ["Erzähl mir mehr.", "Ich bin da  -  was ist los?", "Was beschäftigt dich gerade am meisten?", "Was ist das Größte, was du gerade im Kopf hast?", "Wie geht es dir heute?", "Was auch immer es ist  -  ich höre zu."],
    };
    const carryValidationsDe = ["Das ist noch bei dir  -  ich spüre es.", "Es fühlt sich an, als ob das noch nicht ganz losgelassen hat  -  das ist okay.", "Du bist noch mittendrin, oder?", "Es lässt dich noch nicht los. Lass uns noch einen Moment dabei bleiben.", "Irgendetwas davon kommt immer wieder zurück."];
    const carryExtrasDe: Record<LocalResponseTone, string[]> = {
        calm: ["Wir müssen das noch nirgendwo hinschieben.", "Wir können einfach kurz hier bleiben.", "Man muss das nicht erzwingen."],
        supportive: ["Du musst das jetzt nicht perfekt verstehen.", "Ich bin noch hier bei dir darin.", "Es ist okay, noch nicht alles zu verstehen."],
        practical: ["Wir halten das jetzt einfach.", "Wir brauchen nicht die ganze Antwort, nur den nächsten klaren Teil.", "Der nächste klare Schritt reicht aus."],
        coach: ["Wir stabilisieren das zuerst, bevor wir etwas anderes tun.", "Ein ruhiger Schritt danach reicht.", "Finde zuerst einen stabilen Schritt."],
        "gentle-humor": ["Wir können das sanft halten, ohne es schwerer zu machen.", "Wir müssen jetzt nicht das Ganze durchkämpfen.", "Kein Ringkampf damit heute nötig."],
        direct: ["Lass uns das jetzt nicht verkomplizieren.", "Wir bleiben erstmal beim Wesentlichen.", "Konzentriere dich nur auf das, was jetzt wirklich zählt."],
    };
    const extrasByToneDe: Record<LocalResponseTone, string[]> = {
        calm: [``, `Wir können jetzt bei einem Teil bleiben.`, `Keine Eile, das alles auf einmal zu klären.`, `Wir können das ruhig halten, ohne es zu erzwingen.`, `Eins nach dem anderen  -  kein Druck.`, `Wir können hier kurz innehalten, bevor wir weitermachen.`],
        supportive: [``, `Du musst nicht alles auf einmal tragen.`, `Wir können zuerst beim schwersten Teil bleiben.`, `Wenn sich das noch chaotisch anfühlt, ist das okay.`, `Es macht Sinn, dass sich das noch schwer anfühlt.`, `Kein Druck, das jetzt alles zu verstehen.`],
        practical: [``, `Schauen wir zuerst, was am wichtigsten ist.`, `Wir können das handhabbar halten.`, `Ein nützlicher Teil reicht jetzt.`, `Wir können das etwas weiter aufteilen.`, `Nur der nächste klare Schritt  -  nicht mehr.`],
        coach: [``, `Finden wir zuerst den handhabbaren Teil.`, `Wir brauchen jetzt nur einen stabilen Schritt.`, `Du musst nicht alles auf einmal entwirren.`, `Ein fundierter Schritt ist alles, was wir brauchen.`, `Wir können das einfacher machen, als es sich anfühlt.`],
        "gentle-humor": [``, `Wir können es etwas leichter nehmen, ohne es zu ignorieren.`, `Eine kleine Veränderung reicht jetzt.`, `Ich bin noch hier bei dir.`, `Ein kleiner Sieg ist immer noch ein Sieg.`, `Kein Ringkampf heute nötig.`],
        direct: [``, `Lass uns das klar halten.`, `Wir können einen echten Teil auf einmal angehen.`, `Nur der nächste nützliche Teil zählt jetzt.`, `Was zählt hier am meisten, genau jetzt?`, `Konzentrieren wir uns auf das, was wirklich wichtig ist.`],
    };
    const reflectLinesDe = [
        "Was beschäftigt dich gerade am meisten?",
        "Hilft es gerade mehr, einfach zu reden  -  oder wäre ein kleiner Schritt besser?",
        "Wir können langsam weitermachen  -  womit fangen wir an?",
        "Was hat sich in letzter Zeit verändert?",
        "Wie fühlt es sich an, das alles gerade im Körper zu tragen?",
        "Wenn es etwas leichter wäre  -  was würde sich zuerst verändern?",
    ];
    const nextStepLinesDe = ["Wir können weiter reden oder eine kleine Sache versuchen  -  was sich richtig anfühlt.", "Manche müssen erst alles raussagen. Andere wollen einen Plan. Wo bist du gerade?", "Wir können das weiter auspacken oder einen kleinen Schritt finden. Was fühlt sich jetzt nützlicher an?", "Ich bin hier  -  ob weiterreden oder etwas Konkretes angehen.", "Was wäre gerade hilfreicher  -  weiterreden, oder etwas Kleines in Bewegung setzen?", "Was wäre echter jetzt  -  einfach gehört werden, oder etwas dagegen tun?"];
    const listeningOnlyExtrasDe = ["Du musst das jetzt nicht herausfinden.", "Ich gehe nirgendwo hin. Sag so viel du brauchst.", "Du darfst das alles fühlen.", "Du musst das nicht ordentlich einpacken.", "Es gibt keine Eile, all das zu verstehen.", "Sag so viel oder so wenig du willst  -  ich bin sowieso hier."];

    // ── Extras banks ──────────────────────────────────────────────────────────

    const extrasByToneEn: Record<LocalResponseTone, string[]> = {
        calm: [``, `We can stay with one part for now.`, `No need to rush the whole thing.`, `We can keep this steady without forcing it.`, `Take one piece at a time  -  no pressure.`, `We can sit here a moment before moving on.`],
        supportive: [``, `You do not have to carry the whole weight at once.`, `We can stay with what feels heaviest first.`, `It is okay if this still feels messy.`, `It makes sense this still feels heavy.`, `No rush to make sense of all of it yet.`],
        practical: [``, `Let's only look at what matters first.`, `We can keep this workable.`, `One useful piece is enough for now.`, `We can break this down a bit more.`, `Just the next clear step  -  nothing more.`],
        coach: [``, `Let's find the most workable part first.`, `We only need one steady move right now.`, `You do not need to untangle everything at once.`, `One grounded step is all we need.`, `We can make this simpler than it feels.`],
        "gentle-humor": [``, `We can keep this a little lighter without ignoring it.`, `One small shift is enough for now.`, `I'm still right here with you.`, `One small win is still a win.`, `No wrestling match required today.`],
        direct: [``, `Let's keep this clear.`, `We can deal with one real part at a time.`, `Only the next useful piece matters right now.`, `What matters most right here, right now?`, `Let's focus on the part that counts.`],
    };
    const carryExtrasEn: Record<LocalResponseTone, string[]> = {
        calm: [`We do not have to force this anywhere yet.`, `We can just stay with it for a moment.`],
        supportive: [`You do not have to explain it perfectly right now.`, `I'm still here with you in it.`],
        practical: [`We can keep this simple for now.`, `We only need the next clear piece, not the whole answer.`],
        coach: [`We can steady this before doing anything else.`, `One grounded step later is enough.`],
        "gentle-humor": [`We can keep this soft without making it heavy-er.`, `No need to wrestle the whole thing right now.`],
        direct: [`Let's not overcomplicate it right now.`, `We can stay with the real part first.`],
    };

    const extrasByToneHi: Record<LocalResponseTone, string[]> = {
        calm: [``, `Abhi sirf ek hissa pakad kar chal sakte hain.`, `Puri baat ko ek saath sambhalne ki jaldi nahi hai.`, `Ise bina force kiye steady rakha ja sakta hai.`, `Ek ek cheez lete hain  -  koi pressure nahi.`, `Aage badne se pehle thoda yahan reh sakte hain.`],
        supportive: [``, `Tumhe sab kuch ek saath uthana nahi hai.`, `Jo sabse bhaari lag raha hai, pehle usi ke saath reh sakte hain.`, `Agar sab kuch abhi bhi uljha lag raha hai, tab bhi theek hai.`, `Samajh aata hai kyun abhi bhi bhaari lag raha hai.`, `Koi jaldi nahi ise samjhne ki.`],
        practical: [``, `Chalo pehle wahi dekhte hain jo sabse zaroori hai.`, `Ise manageable rakh sakte hain.`, `Abhi ek kaam ki cheez dekhna kaafi hai.`, `Ise thoda aur chhota kar lete hain.`, `Bas agla saaf kadam  -  kuch aur nahi.`],
        coach: [``, `Chalo pehle sabse workable hissa dhoondte hain.`, `Abhi sirf ek steady move kaafi hai.`, `Tumhe sab kuch ek saath suljhana nahi hai.`, `Ek solid kadam hi kaafi hai abhi.`, `Ise jitna lagnta hai utna mushkil nahi banana.`],
        "gentle-humor": [``, `Ise halka rakh sakte hain bina ignore kiye.`, `Abhi ek chhota shift kaafi hai.`, `Main yahin hoon tumhare saath.`, `Ek chhoti jeet bhi jeet hoti hai.`, `Aaj poori kushti ladne ki zarurat nahi.`],
        direct: [``, `Chalo ise saaf rakhte hain.`, `Hum ek real hissa ek baar mein dekh sakte hain.`, `Abhi bas agla useful hissa kaafi hai.`, `Abhi sabse zaroori kya hai?`, `Jo matter karta hai usi par focus karein.`],
    };
    const carryExtrasHi: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne ki zarurat nahi hai.`, `Hum bas thodi der iske saath reh sakte hain.`, `Koi ucchal nahi  -  ek ek kadam chalte hain.`],
        supportive: [`Tumhe ise perfectly samjhana abhi zaruri nahi hai.`, `Main abhi bhi tumhare saath hoon isme.`, `Jo bhi uthaa rahe ho  -  akele nahi ho.`],
        practical: [`Abhi ise simple rakhte hain.`, `Humein poora jawab nahi, bas agla saaf hissa dekhna hai.`, `Ek kadam kaafi hai abhi ke liye.`],
        coach: [`Kuch karne se pehle ise steady kar lete hain.`, `Baad mein ek grounded step kaafi hoga.`, `Pehle yahan tikna  -  phir aage badhenge.`],
        "gentle-humor": [`Ise halka rakh sakte hain bina uljhaaye.`, `Abhi poori kushti ladne ki zarurat nahi hai.`, `Ek chhoti jeet bhi jeet hoti hai.`],
        direct: [`Abhi ise overcomplicate nahi karte.`, `Pehle real hissa pakadte hain.`, `Jo matter karta hai  -  wahi pakdenge pehle.`],
    };

    const extrasByToneBn: Record<LocalResponseTone, string[]> = {
        calm: [``, `এখন শুধু একটা অংশ ধরে থাকলেই হবে।`, `সবকিছু একসাথে সামলানোর তাড়া নেই।`, `এটাকে জোর না করে steady রাখা যায়।`, `একটা একটা করে নেওয়া যাক  -  কোনো চাপ নেই।`, `এগিয়ে যাওয়ার আগে একটু এখানেই থাকা যায়।`],
        supportive: [``, `তোমাকে সবটা একসাথে বয়ে নিতে হবে না।`, `যেটা সবচেয়ে ভারী লাগছে, আগে সেটার সঙ্গেই থাকি।`, `সবকিছু এখনও এলোমেলো লাগলে তাতেও সমস্যা নেই।`, `বোঝা যাচ্ছে এখনও কেন ভারী লাগছে।`, `এটা বুঝতে কোনো তাড়া নেই।`],
        practical: [``, `চলো আগে সবচেয়ে দরকারি অংশটাই দেখি।`, `এটাকে manageable রাখা যাবে।`, `এখন একটা কাজের জিনিস ধরলেই যথেষ্ট।`, `এটাকে আরও ছোট করে ভাগ করা যায়।`, `শুধু পরের পরিষ্কার পদক্ষেপ  -  আর কিছু না।`],
        coach: [``, `চলো আগে সবচেয়ে workable অংশটা খুঁজি।`, `এখন শুধু একটা steady move হলেই হবে।`, `সবটা একসাথে মেলাতে হবে না।`, `একটা solid কদম এখনের জন্য যথেষ্ট।`, `এটাকে যতটা লাগছে ততটা কঠিন না করাই ভালো।`],
        "gentle-humor": [``, `এটাকে হালকা রাখা যায়, তবু সিরিয়াস থাকাও যাবে।`, `এখন একটা ছোট shift হলেই যথেষ্ট।`, `আমি এখানেই আছি তোমার সাথে।`, `একটা ছোট জয়ও জয়।`, `আজকে পুরো কুস্তি লাড়ার দরকার নেই।`],
        direct: [``, `চলো এটাকে পরিষ্কার রাখি।`, `একবারে একটা বাস্তব অংশ ধরা যায়।`, `এখন শুধু পরের useful অংশটাই যথেষ্ট।`, `এখন সবচেয়ে গুরুত্বপূর্ণ কী?`, `যেটা matter করে সেটাতে focus করি।`],
    };
    const carryExtrasBn: Record<LocalResponseTone, string[]> = {
        calm: [`এটাকে এখনই কোথাও ঠেলে নিতে হবে না।`, `আমরা একটু সময় শুধু এটার সাথেই থাকতে পারি।`, `কোনো তাড়া নেই  -  একটু একটু করে এগোনো যাবে।`],
        supportive: [`এখনই একদম ঠিক করে বোঝাতে হবে না।`, `আমি এখনও তোমার সাথেই আছি এতে।`, `যা বহন করছ  -  একা করছ না।`],
        practical: [`এখন এটাকে simple রাখি।`, `পুরো উত্তর না, শুধু পরের পরিষ্কার অংশটাই যথেষ্ট।`, `এখন একটা কাজের জিনিস ধরলেই যথেষ্ট।`],
        coach: [`কিছু করার আগে এটাকে steady করি।`, `পরে একটা grounded step হলেই চলবে।`, `আগে এখানে থাকা  -  তারপর এগোনো।`],
        "gentle-humor": [`এটাকে হালকা রাখা যায়, বেশি জট না বাড়িয়ে।`, `এখন পুরো কুস্তি লড়ার দরকার নেই।`, `একটা ছোট জয়ও জয়।`],
        direct: [`এখন এটাকে overcomplicate না করি।`, `আগে বাস্তব অংশটাই ধরি।`, `যেটা matter করে সেটাতে আগে focus করি।`],
    };

    const extrasByToneGu: Record<LocalResponseTone, string[]> = {
        calm: [``, `Haji sirf ek bhag pakadhine chal shakiye.`, `Badhi vat ek sathe sambhalvani jaldi nathi.`, `Ane bina force karya steady rakhay chhe.`, `Ek ek vaat liye  -  koi pressure nathi.`, `Aagad jaava pehla thodi der yahiya rehiye.`],
        supportive: [``, `Tumari bhari vaatne thodi vaar baaju rakhi shakay.`, `Jo shu kaafi bhari laage chhe, pehla tenaa sathe rehiye.`, `Je abhi pann uljhelu laage, toh pann saru chhe.`, `Samjhay chhe kyun abhi pann bhaari laage chhe.`, `Ene samjhvani koi jaldi nathi.`],
        practical: [``, `Pehla jo shu zaroori chhe te joi aiye.`, `Ane manageable rakhay chhe.`, `Abhi ek kaam ni vaat jo puri chhe.`, `Ene thoda nana bhago maa todi nakiye.`, `Bas aglu saaf kadam  -  biju kainchh nahi.`],
        coach: [``, `Chalo pehla shu workable chhe te dhundhi aiye.`, `Abhi faqt ek steady move kaafi chhe.`, `Bhadhu ek sathe suljhavanu nathi.`, `Ek solid kadam abhi parata chhe.`, `Ene je lagay teva mushkil nahi banana.`],
        "gentle-humor": [``, `Ane halku rakhi aiye ignore karyaa vina.`, `Abhi ek chhoto shift kaafi chhe.`, `Hu hun ahiya j chhu tara sathe.`, `Ek chhoti jeet pann jeet chhe.`, `Aaj poori kushti ni jarur nathi.`],
        direct: [``, `Chalo saafu rakhi aiye.`, `Ek vaaste ek real bhag joi shakiye.`, `Abhi faqt aglu useful bhag kaafi chhe.`, `Abhi sabse zaroori shu chhe?`, `Jo matter kare tena par dhyan rakhdhe.`],
    };
    const carryExtrasGu: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne ni zarur nathi.`, `Hum bas thodi var eni sathe rahi shakiye.`, `Koi jaldi nathi  -  dhire dhire aagad vadheeshu.`],
        supportive: [`Tune ine perfectly samjhavanu abhi zaruri nathi.`, `Hu hun abhi pann tara sathe chhu.`, `Jo bhi upadvi raha chho  -  ema tame ekla nathi.`],
        practical: [`Abhi ine simple rakhiye.`, `Pooru jawab nahi, bas aglu saafu bhag joie.`, `Abhi ek kadam kaafi chhe.`],
        coach: [`Kuch karva thi pehla ine steady kariye.`, `Baad ma ek grounded step kaafi thashe.`, `Pehla yahiya thaambva  -  pachhi aagad vadhshu.`],
        "gentle-humor": [`Ine halka rakhi shakiye bina uljhavyaa.`, `Abhi bhadhi kushti ladva ni zarur nathi.`, `Ek chhoti jeet pann jeet chhe.`],
        direct: [`Abhi ine overcomplicate nathi karva.`, `Pehla real bhag pakadiye.`, `Jo matter kare  -  tena par aagal vadhiye.`],
    };

    const extrasByTonePa: Record<LocalResponseTone, string[]> = {
        calm: [``, `Abhi sirf ik hissa pakad ke chal sakde haan.`, `Sab kuch ik saath sambhalan di jaldi nahi.`, `Ise bina force kite steady rakhaya ja sakda aa.`, `Ik ik cheez laiye  -  koi pressure nahi.`, `Aagey vadhne ton pehlan thoda ethey reh sakde haan.`],
        supportive: [``, `Tenu sab kuch ik saath chukna nahi.`, `Jo sabton bhaari lagda aa, pehlan usi naal rehiye.`, `Je sab kuch abhi vi uljhya lagda aa, tenu vi theek aa.`, `Samajh aanda hai kyun abhi vi bhaari lagda hai.`, `Ise samjhne di koi jaldi nahi.`],
        practical: [``, `Chalo pehlan jo sabton zaruri aa uh vekhiye.`, `Ise manageable rakhya ja sakda aa.`, `Abhi ik kaam di gall kaafi aa.`, `Ise thoda aur chhota kar laiye.`, `Bas agla saaf kadam  -  kuch aur nahi.`],
        coach: [``, `Chalo pehlan sabton workable hissa dhundhiye.`, `Abhi sirf ik steady move kaafi aa.`, `Tenu sab kuch ik saath suljhana nahi.`, `Ik solid kadam hi kaafi hai abhi.`, `Ise jitna lagnda aa utna mushkil nahi banana.`],
        "gentle-humor": [``, `Ise halka rakh sakde haan bina ignore kite.`, `Abhi ik chhoti shift kaafi aa.`, `Main ithey haan tere naal.`, `Ik chhoti jeet vi jeet hundi hai.`, `Aaj poori kushti ladne di lodd nahi.`],
        direct: [``, `Chalo ise saaf rakhiye.`, `Hum ik real hissa ik vaar dekh sakde haan.`, `Abhi sirf agla useful hissa kaafi aa.`, `Hune sabton zaruri kaai hai?`, `Jo matter karda aa usi te dhiaan laiye.`],
    };
    const carryExtrasPa: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne di lodd nahi.`, `Assi bas thodi der edi naal reh sakde haan.`, `Koi jaldi nahi  -  dhire dhire aage vadhange.`],
        supportive: [`Tenu ise perfectly samjhana abhi zaruri nahi.`, `Main abhi vi tere naal haan eis wich.`, `Jo vi chuk raha aa  -  eis wich tu akela nahi.`],
        practical: [`Abhi ise simple rakhiye.`, `Poora jawab nahi, bas agla saaf hissa vekhna aa.`, `Abhi ik kadam hi kaafi aa.`],
        coach: [`Kuch karan ton pehlan ise steady kar laiye.`, `Baad wich ik grounded step kaafi hoga.`, `Pehlan ithey thaamba  -  phir aage vadhange.`],
        "gentle-humor": [`Ise halka rakh sakde haan bina uljhaye.`, `Abhi poori kushti ladne di lodd nahi.`, `Ik chhoti jeet vi jeet hundi hai.`],
        direct: [`Abhi ise overcomplicate nahi kariye.`, `Pehlan real hissa pakdiye.`, `Jo matter karda aa  -  usi te dhiaan laiye.`],
    };

    const extrasByToneKn: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ippudu ondu bhagavannu maatrana hididi irona.`, `Ellavaannu ondu saarigu sambalisuvudakke avasaravilla.`, `Idannu olage thosikolaade steady aagi irisi.`, `Ondu ondu vishaya teedukonona  -  yaavudu pressure illa.`, `Munde hoguva munche koney koney illi irona.`],
        supportive: [``, `Neevu iddannu ellava ondu saarigu hotti hoguva avasaravilla.`, `Tumba bharavaagide anta anisuvudannu munche nodona.`, `Ippudu ella ella ulalaadittu hogi iddare, adu sari.`, `Yaake ippudu bhaaram anistade anta gottaaguttade.`, `Idannu arthamaadisikolaada aadudu haste illa.`],
        practical: [``, `Munche yenu mukhya adu nodona.`, `Idannu manageable aagi irisi.`, `Ippudu ondu useful bhaga saalade.`, `Idannu konjam chikka chikka maadona.`, `Mundina sparshtavaada kadam maatrana  -  baere enu beda.`],
        coach: [``, `Munche yenu kelsaadade ide adu kudukona.`, `Ippudu ondu steady move maatrana saalade.`, `Neevu ellava ondu saarigu helabeku anta illa.`, `Ondu solid kadam ippuduukke saakaguttade.`, `Idannu anistiruvudu yetla kashtavagilla anta nodona.`],
        "gentle-humor": [``, `Idannu ignore maadade konjam light aagi teedukonona.`, `Ippudu ondu chikka shift saalade.`, `Naanu illi ninna jote iddene.`, `Ondu chikka jaya kuda jaya.`, `Ivattu poorna kushti aadabeku illa.`],
        direct: [``, `Idannu sparshta aagi irisi.`, `Ondu ondu real bhagavannu nodabahudu.`, `Ippudu munde useful bhaga maatrana beku.`, `Ippudu yaavudu hechhu mukhyavaagide?`, `Yaavudu matter aaguttade adannu focus maadona.`],
    };
    const carryExtrasKn: Record<LocalResponseTone, string[]> = {
        calm: [`Ippudu idannu yaarigoo thosikolaada aasaravilla.`, `Naavuu koney koney idara jote irati irona.`, `Yaavudu adusu illa  -  naavilliru munde hogona.`],
        supportive: [`Neevu idannu perfectly samjhisabeku anta illa ippudu.`, `Naanu abhi ninna jote iddene.`, `Neevu horisikolluttiruvudu  -  adara jote akela aadavasaravilla.`],
        practical: [`Ippudu idannu simple aagi irisi.`, `Sampoorna uttara beda, munde sparshtavaada bhagavannu nodona.`, `Ippudu ondu kadam maatrana saalade.`],
        coach: [`Enu maaduvudakku munche idannu steady maadona.`, `Naantara ondu grounded step saalade.`, `Munde illi nilikona  -  naantara hogona.`],
        "gentle-humor": [`Idannu halka aagi irisi, tumba uljhi maadade.`, `Ippudu ellavannu oru saarigu helabeku anta illa.`, `Ondu chikka jaya kuda jaya.`],
        direct: [`Ippudu idannu overcomplicate maadabedi.`, `Munche real bhagavannu hidukona.`, `Yaavudu matter aaguttade  -  adannu munde teedukonona.`],
    };

    const extrasByToneMl: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ippol ore bhagam maathram nookunna.`, `Ella kaaryavum onnu kondu kazhikkanam enna avasaryamilla.`, `Idine mellage steady aakki vekkunna.`, `Onnu onnaay edukkunna  -  yaatoru pressure illa.`, `Munnotthu pokkunadhin munpe ore nazhika ikkade nookkunna.`],
        supportive: [``, `Nee yellaatum onnu kondu vekkaathe.`, `Athi bhaaram aayi thoannunnath, ath aadhyam nokkaam.`, `Ippol yellaatum kuttippidikkunnathupole thoannal, athu sari.`, `Ippozhum enthu kaashta thoanunnu ennathu manthu.`, `Idine manasilakkaan aadudu thaamasam illa.`],
        practical: [``, `Aadhyam enthu muhyamanu ath nokkaam.`, `Idine manageable aakki vekkunna.`, `Ippol oru useful bhagam maathram mathiyaakum.`, `Idine konjam kootu chhota aakki nokkunna.`, `Munnilulla vyakthamaaya kadam maathram  -  baeki onnum illa.`],
        coach: [``, `Aadhyam enthu pradhaanam ath nokkaam.`, `Ippol ore steady move maathram mathiyaakum.`, `Yellaatum onnu kondu solve cheyyaanam enna avasaryamilla.`, `Oru solid kadam ippol maathiyaakum.`, `Idine thoannunnath pole kashta aakkanam enna illa.`],
        "gentle-humor": [``, `Idine ignore cheyyaathe konjam light aakki nookaam.`, `Ippol oru chinna shift maathram mathiyaakum.`, `Njaan ippol ninnodoppam unda.`, `Oru chinna jeyavum jeyam thanne.`, `Innu poornna maraavumthi avasaryamilla.`],
        direct: [``, `Idine vyakthamayi vekkunna.`, `Ore ore real bhagam nokkaam.`, `Ippol munnilulla useful bhagam maathram mathiyaakum.`, `Ippol enthu kooduthal pradhaanam?`, `Matter aakkunnathu enthennu focus cheyyunna.`],
    };
    const carryExtrasMl: Record<LocalResponseTone, string[]> = {
        calm: [`Ippol idine evidekkum thosikaanum avasaryamilla.`, `Njaan nee thodum koodeyuntaakum.`, `Tharakkilla  -  pathukkke munnoottam pokaam.`],
        supportive: [`Nee idine ippol perfectly paryanum enna avasaryamilla.`, `Njaan ippol ninnodum koode undu.`, `Nee vahan cheyyunnath  -  athil aarum ottayilla.`],
        practical: [`Ippol idine simple aakki vekkunna.`, `Sariyaaya uttharam venda, munnilulla vyakthamaaya bhagam maathram nokkaam.`, `Ippol oru aduppam mathiyaakum.`],
        coach: [`Enthenkilum cheyyunnadhin munpe idine steady aakkaam.`, `Pinnaale oru grounded step mathiyaakum.`, `Munpe ikkade nilluka  -  appol munpottu pokaam.`],
        "gentle-humor": [`Idine halka aakki vekkunna, koottappeduthathe.`, `Ippol ella kaaryavum oru saari cheyyanam enna ille.`, `Oru chinna jeyavum jeyam thanne.`],
        direct: [`Ippol idine overcomplicate aakkathe.`, `Munpe real bhagam hidukkunna.`, `Matter aakkunnathu enthennu  -  athil aadhyam irikkaam.`],
    };

    const extrasByToneOr: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ebe kewal ek hissa dhari rahiparibaa.`, `Sab kichhu ek saathare sambhaalibara jaldi nahi.`, `Eitaaku bina force kara steady rakhibaaku heba.`, `Ek ek jinisha liba  -  kichhi pressure nahi.`, `Aagakku jaibaa aagaru khenike ithire rahi paribaa.`],
        supportive: [``, `Tume saba kichu ek saathare bahi jibaa nahii.`, `Jo sab cheye bhari laaguchhi, taa saathire pehle rahiba.`, `Je sab kichhu ekhana bhi uljhaa laage, taa bhi thik.`, `Kyun ebe bhi bhaara laguchi seita bujhaya.`, `Eita bujhibaa paain koi jaldi nahi.`],
        practical: [``, `Pehle jo sab cheye dorkari, taa dekhibaa.`, `Eitaaku manageable rakhiba.`, `Ebe ek kaama jinisha mattare sare.`, `Eitaaku aaro chhota chhota kari todi paribaa.`, `Bas agla spashta kadam  -  aaro kichu nahi.`],
        coach: [``, `Pehle sab cheye workable ta khoji dekhibaa.`, `Ebe kewal ek steady move sare.`, `Tume saba ek saathare suljhibaa nahii.`, `Ek solid kadam ebe paain sare.`, `Eitaaku jemantu laguchi teman kathin nakari.`],
        "gentle-humor": [``, `Eitaaku ignore na kari thoda halka rakhiba.`, `Ebe ek chota shift sare.`, `Mu eithire achi tumara saathire.`, `Ek chota jaya bhi jaya.`, `Aaji poora kushti ladibaa darkaara nahi.`],
        direct: [``, `Aau eitaaku spashta rakhiba.`, `Ek ek real hissa dekhihaaba.`, `Ebe kewal agla useful hissa sare.`, `Ebe kihi beshi dorkari?`, `Jo matter kare taa uparee dhyana dileba.`],
    };
    const carryExtrasOr: Record<LocalResponseTone, string[]> = {
        calm: [`Ebe eitaaku kahinkuu thelibaa darkaara nahi.`, `Aame ektu samayara saathire rahi paribaa.`, `Kona tara nahi  -  dheere dheere aagaku badhibu.`],
        supportive: [`Tume eitaaku ekhani perfectly bujhhaibaa darkaara nahi.`, `Mu ekhana bhi tumara saathire achi.`, `Tume yaha bahi nichhanti  -  ema ekali nahi.`],
        practical: [`Ebe eitaaku simple rakhiba.`, `Sampurna uttar nahi, parer spashta hissa maatra.`, `Ebe ek kadam hile sare.`],
        coach: [`Kichu kariba agau eitaaku steady kariba.`, `Paare ek grounded step sare.`, `Pehle ethire thamiba  -  tarapara aagaku badhibu.`],
        "gentle-humor": [`Eitaaku halka rakhiba, jyaada uljhana na kariba.`, `Ebe sab kichu ek saathare ladibar dorkar nahi.`, `Ek chota jaya bhi jaya.`],
        direct: [`Ebe eitaaku overcomplicate na kariba.`, `Agau real hissa dhabiba.`, `Jo matter kare  -  taa uparee aagadu badhibu.`],
    };

    const extrasByToneMr: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ata faqt ek bhaag dharun chala shakato.`, `Sagle ek saath sambhalaychi ghai nahi.`, `He bina force karun steady thavata yete.`, `Ek ek goshta gheuya  -  koni pressure nahi.`, `Pudhe jaayachy aadhi thoda ithe rahu shakato.`],
        supportive: [``, `Tula sagle ek saath uthaava laagat nahi.`, `Jo saglyyaat jad vaatate, tya barober rahilya.`, `Sagle ata pun guntaycha thi theek aahe.`, `Kyun abhi pun jad vaatate te samajhte.`, `He samajhun ghenyachi ghai nahi.`],
        practical: [``, `Aadhi kaay saglyyaat mahattvaache aahe te pahilya.`, `He manageable thavta yete.`, `Ata ek kamaache goshta pahe jaane puresar aahe.`, `Yaala thoda aur chhota karu shakato.`, `Bas pudha spasht kadam  -  baakaiche kahi nahi.`],
        coach: [``, `Aadhi saglyyaat workable bhaag shodhlya.`, `Ata faqt ek steady move puresar aahe.`, `Tula sagle ek saath sudhavayche nahi.`, `Ek solid kadam ataach puresar aahe.`, `He jitke kaste vaatate titkhe mushkil nahi karaayche.`],
        "gentle-humor": [``, `He ignore na karta halke thavta yete.`, `Ata ek chhota shift puresar aahe.`, `Mi ithe tujhyasobat aahe.`, `Ek chhoti jeet pun jeet aaste.`, `Aaj sampurna kushti laadaaychi ghai nahi.`],
        direct: [``, `Chala he spasht thauvuya.`, `Ek velela ek real bhaag pahata yeto.`, `Ata faqt pudha useful bhaag puresar aahe.`, `Ata saglyyaat zaroori kaay aahe?`, `Jo matter karte tyaavar dhyan devuya.`],
    };
    const carryExtrasTa: Record<LocalResponseTone, string[]> = {
        calm: [`Idhai ippovum ethuvum thakka venandam.`, `Oru nimisham inge irukalaam.`, `Aadudu illai  -  mella mella munnaadi pogalaam.`],
        supportive: [`Idhai perfectly purinjukka venandam ippovum.`, `Naan inga irukken  -  un kooda.`, `Nee thooguvadhai  -  adhil nee thaanaa illai.`],
        practical: [`Ippovum idhai simple aa vachhukolalaam.`, `Poora answer venandam  -  next clear part mattum.`, `Ippovum oru adippidi podhum.`],
        coach: [`Innoru enna panna munaadi idhai steady pannalaam.`, `Aparam oru grounded step podhum.`, `Munnala inge nillungal  -  apuram munnaadi pogalaam.`],
        "gentle-humor": [`Idhai halka aa veikkalaam, gumbal panna venandam.`, `Ippovum ellaa vishayathai kushti panna venandam.`, `Oru sinna vettri kuda vettri thaan.`],
        direct: [`Ippovum idhai overcomplicate panna venandam.`, `Mun real part edukalaam.`, `Matter aaguradhula  -  adha munnala paakkalaam.`],
    };
    const carryExtrasTe: Record<LocalResponseTone, string[]> = {
        calm: [`Idi ippudu ekkadiki thoyyadam avasaram ledu.`, `Oka nimisham ikkade vundadam.`, `Adupu ledu  -  mellaga munduki vellam.`],
        supportive: [`Idi ippudu perfectly artham chesukodaniki avasaram ledu.`, `Nenu inka nee tho unnaanu.`, `Nuvvu meesukuntunnadi  -  dantlo nuvvu okkadev kaadu.`],
        practical: [`Ippudu deeniki simple ga vunchukovalaam.`, `Poora jawabu kaadu  -  tarvata clear bhaagam mattum.`, `Ippudu oka adugu chaalu.`],
        coach: [`Inkaemi cheyyalanukune mundu idi steady cheddam.`, `Tarvata oka grounded adugu chaaludu.`, `Mundu ikkade nillondi  -  tarvata munduku vellam.`],
        "gentle-humor": [`Idi easy ga vunchukovalaam, pamu kudipettakunda.`, `Ippudu anni ee kushti avasaram ledu.`, `Oka chinna vijayam kuda vijayame.`],
        direct: [`Ippudu deeniki overcomplicate cheyyadam ledu.`, `Mundu real bhaagam pattukovalaam.`, `Matter ayinadhantlo  -  adhi mundu chusukondaam.`],
    };
    const carryExtrasMr: Record<LocalResponseTone, string[]> = {
        calm: [`Ata yaala kuthehi dhakalaaychi garj nahi.`, `Aapan thoda vel faqt yaach'yasobat rahu shakato.`, `Ghaaee nahi  -  ek ek paavul takuya.`],
        supportive: [`Tula he perfectly samjaavayche ata garj nahi.`, `Mi ata pun tujhyasobat aahe.`, `Tum jo vahun nele  -  tyaat tum ekate nahi.`],
        practical: [`Ata he simple thauvuya.`, `Pura jaab nahi, faqt pudha spasht bhaag pahilya.`, `Ata ek kadam puresar aahe.`],
        coach: [`Kaahi karayla aadhi he steady karuya.`, `Nantar ek grounded step puresar hail.`, `Aadhi ithe thaamba  -  mag pudhe jaaū.`],
        "gentle-humor": [`He halke thavta yete bina guntavit.`, `Ata puri kushti laadaaychi garj nahi.`, `Ek chhoti jeet pun jeet aste.`],
        direct: [`Ata he overcomplicate karaayche nahi.`, `Aadhi real bhaag dharuya.`, `Jo matter karte tyavar aadhi dhyan deū.`],
    };

    // ── Reflect / next-step lines ─────────────────────────────────────────────

    const reflectLinesEn = [
        keyTopic ? `You mentioned ${keyTopic}  -  what part of that feels the most pressing right now?` : `What part of this is sitting with you most right now?`,
        `What's the piece of this that feels hardest to let go of?`,
        `If you had to pick just one thing that's bothering you most  -  what would it be?`,
        `What do you wish felt different about this situation?`,
        `What's the part of this that's been hardest to say out loud?`,
        `What does carrying all this feel like in your body right now?`,
        `If things were a little lighter  -  what's the first thing that would change?`,
    ];
    const reflectLinesHi = [
        keyTopic ? `Tumne ${keyTopic} ki baat ki  -  abhi us mein sabse zyada kya daba raha hai?` : `Is mein abhi sabse zyada kya mehsoos ho raha hai?`,
        `Isme sabse zyada uncomfortable kya lag raha hai?`,
        `Agar ek hi cheez chunni ho jo sabse zyada pareshaan kar rahi ho  -  woh kya hogi?`,
        `Tum chahte ho is situation mein kya alag hota?`,
        `Yeh sab uthana shareer mein kaise feel ho raha hai abhi?`,
        `Agar yeh thoda halka hota  -  sabse pehle kya badalta?`,
    ];
    const reflectLinesBn = [
        keyTopic ? `Tumi ${keyTopic} er kotha bollecho  -  seta r modhye ekhon shobcheye ta ki lagchhe?` : `Ei bishoy ta r modhye ekhon shobcheye beshi ki mone hochhe?`,
        `Eitar modhye shobcheye beshi uncomfortable ki lagchhe?`,
        `Jodi ekta jinish cholte hoy je shobcheye beshi bhasachhe  -  seta ki?`,
        `Tumi chaite e obostha ta kivabe alada hoto?`,
        `Eta sharir-e ki rokhom feel hocche ekhon?`,
        `Jodi eta ektu halka hoto  -  sabcheye prottomey ki bolto?`,
    ];
    const nextStepLinesEn = [
        `We can keep talking through this, or find one small thing to try  -  whichever feels right.`,
        `Some people need to say it all out loud first. Others want a plan. Where are you at?`,
        `We can keep unpacking this, or find one small move. What feels more useful right now?`,
        `I'm with you on this  -  whether that's talking it through or finding something concrete to do next.`,
        `Is it more useful to keep talking this through, or to find one small thing to move?`,
        `What would feel more real right now  -  just being heard, or doing something about it?`,
    ];
    // Listening-only extras  -  used when the user is venting.
    // Statements only, no questions, no binary choices.
    const listeningOnlyExtrasEn = [
        `You don't have to figure this out right now.`,
        `I'm not going anywhere. Say as much or as little as you need.`,
        `You're allowed to feel all of this.`,
        `There's no right way to move through this  -  just keep going.`,
        `You don't have to wrap this up neatly.`,
        `There's no rush to make sense of any of this.`,
        `Say as much or as little as you want  -  I'm here either way.`,
    ];
    const listeningOnlyExtrasHi = [
        `Abhi ise figure out karne ki zaroorat nahi.`,
        `Main yahin hoon. Jitna chahte ho, utna bolo  -  zyada ya kam.`,
        `Tum yeh sab feel kar sakte ho  -  koi baat nahi.`,
        `Ise neatly wrap up karne ki koi zaroorat nahi.`,
        `Ise samajhne ki abhi koi jaldi nahi.`,
        `Jitna chahte ho utna kaho  -  main yahan hoon, chahe zyada ho ya kam.`,
    ];
    const listeningOnlyExtrasBn = [
        `Ekhon eta figure out korte hobe na.`,
        `Ami ekhane achi. Jotota ichha hoy bolo  -  beshi na kama.`,
        `Tumi shob kichu feel korte paro  -  kono problem nei.`,
        `Eta neat kore wrap up korte hobe na.`,
        `Eta bujhbar ekhon kono taaratari nei.`,
        `Jato khushi bolo  -  ami aachi, beshi hok ba komi.`,
    ];
    const listeningOnlyExtrasTa = [
        `Ippovum idha figure out panna vendam.`,
        `Naan engum poga matten. Venum pothu bol  -  zyada illai kammiya.`,
        `Nee feel panra yellam feel pannalam  -  paravaillai.`,
        `Idha neatly wrap up panna vendam illai.`,
        `Idhai ippove purinjukonum-nu oru avasaram illai.`,
        `Eshtam vendiyathai solunga  -  naan inga irukken, zyaadaa aa irundhaalum, kammaa aa irundhaalum.`,
    ];
    const listeningOnlyExtrasTe = [
        `Ippudu dhinni figure out cheyaalsina avasaram ledu.`,
        `Nenu ikkade unnaanu. Yekkuva alleda kammu alleda cheppukundu.`,
        `Nuvvu anni feel avvadam okay  -  tappu ledu.`,
        `Idi neat ga wrap up cheyyaalsina avasaram ledu.`,
        `Deeniki ippudu artham cheskovalanukunnna avasaram ledu.`,
        `Enta cheppaalante anta cheppu  -  nenu unnaanu, ekkuva ainaas, takkuva ainaas.`,
    ];
    const listeningOnlyExtrasGu = [
        `Aa figure out karvani abhi koi jaldhi nathi.`,
        `Hu ithey chhu. Je joiye te bol  -  vadhu ke ochhun.`,
        `Tu badhu j feel kari shake chhe  -  koi vaa nathi.`,
        `Tene neatly wrap up karvani zaroor nathi.`,
        `Ane samajhvani abhi koi utalvaadi nathi.`,
        `Jevdun bolvun hoy tevdun bolo  -  hu yahan chhun, vadhare hoy ke ochu.`,
    ];
    const listeningOnlyExtrasPa = [
        `Hune ise figure out karne di koi zaroorat nahi.`,
        `Main ithey haan. Je marzi bol  -  zyada ya thoda.`,
        `Tu sab kuch feel kar sakda aa  -  koi galat nahi.`,
        `Ise neatly wrap up karne di koi gall nahi.`,
        `Eh samajhna abhi di koi jaldi nahi.`,
        `Jivna chahunde ho utna bolo  -  main yahan haan, vadhera hove ya ghatt.`,
    ];
    const listeningOnlyExtrasKn = [
        `Idu ippudu figure out maadabekaagilla.`,
        `Naanu illi iddene. Yaarenu heli  -  koodu illa kammi.`,
        `Neevu ellavaanu feel aagabahudu  -  adhu sari.`,
        `Idannu neat aagi wrap up maadabekaagilla.`,
        `Idannu ippaagu artha maadikolluvudu avasaravilla.`,
        `Entha hejjugalu helidaru thappilla  -  naanu iddene, jaasti aagali bidi.`,
    ];
    const listeningOnlyExtrasMl = [
        `Ippol idi figure out cheyyaanulla avasaram illa.`,
        `Njaan ippol unda. Parayaan thoannunnath para  -  koodu illa kammi.`,
        `Nee ellaam feel aakaam  -  adhu kashtamilla.`,
        `Idi neat aakki wrap up cheyyaanulla avasaram illa.`,
        `Idi ippol artha maakkan oru tharathamyam illa.`,
        `Enthu parayaanum enna  -  njaan ikkade undu, etraayalum, kurayaalum.`,
    ];
    const listeningOnlyExtrasOr = [
        `Ebe eitaaku figure out karibaa dorkaar nei.`,
        `Mu eithire achi. Je ichha hue bol  -  beshi naa kama.`,
        `Tume sab kichhi feel karipaaribaa  -  seta thik.`,
        `Eitaaku neat kari wrap up karibaa dorkaar nei.`,
        `Eitaaku ekhuni bujhibaaka kono taarika nei.`,
        `Jeto bhaale laage seto kahu  -  mu achi, beshi heu naa kama.`,
    ];
    const listeningOnlyExtrasMr = [
        `Ata he figure out karayla ghai nahi.`,
        `Mi itheche aahe. Kaay vaatel te sang  -  zyada ki kami.`,
        `Tu he sab feel karayla harakhat nahi  -  bilkul theek aahe.`,
        `Yala neatly wrap up karayla nako.`,
        `Hein aadhichya samjhaychi kahi ghahi nahi.`,
        `Kitehii sang  -  mi ithe aahe, zaasti asel ki kami.`,
    ];

    const nextStepLinesHi = [
        `Abhi bas sunna chahoge, ya kuch chhota saath mein sochein?`,
        `Tum isse baat karke halka karna chahte ho, ya kuch practical next karna hai?`,
        `Kya isse khol kar dekhna madad karega, ya ek chhota action chunna?`,
        `Hum tumhari feeling par dhyan dein, ya agla kya kar sakte ho us par?`,
        `Kya abhi sirf feel karna zaroori hai, ya kuch chhota karna zyada kaam karega?`,
        `Main tumhare saath hoon  -  sunna ho ya kuch thoda sochein saath mein?`,
    ];
    const nextStepLinesBn = [
        `Ekhon ki beshir bhag bolte chai, naki ekta chhoto porer kaaj khujte chai?`,
        `Tumi eta bole halka korte chao, na porer practical kichhu korte chao?`,
        `Eta ektu khule dekhle bhalo hobe, na ekta chhoto action neowa bhalo?`,
        `Amra tomar feeling e focus korbo, na porer ki korte paro setay?`,
        `Ekhon ki shudhu feel kora dorkar, naki kichhu ekta choto kaaj kora aar kaajer?`,
        `Ami tomar sathe aachi  -  bola chai naki ektu sathe vabte chai?`,
    ];
    const reflectLinesMr = [
        keyTopic ? `Tumhi ${keyTopic} chi baat keli  -  tyaat abhi sabse zyada kaay jaanavate?` : `Yaatil konate bhaag tumhala abhi sabse zyada jaanvate?`,
        `Yaatil sabse zyada uncomfortable kaay vaatate?`,
        `Ek goshtika nibad karaaychi asel jo abhi sabse zyada traas detiye  -  ti kaay asel?`,
        `Tumhi is paristhitit kaay vegle haave asse vaatate?`,
        `He sab shariraat kase feel hoye aahe abhi?`,
        `He thoda halke asate  -  sabat pehle kaay badlale aste?`,
    ];
    const nextStepLinesMr = [
        `Aamhi baat karayla suru thevu shakato, ya ek chhoti goshta try karu  -  jo yogya vaatel te.`,
        `Kaahaanaa pehle sab saangaaychi asat. Kaahaanaa plan haavaa astaa. Tum kuthe aahat abhi?`,
        `He aankhi kholu, ki ek chhota kadam gheu. Abhi kaay jaast useful vaatate?`,
        `Mee tujhyasobat aahe  -  baat karnyasaathi ki kaahi concrete karayla.`,
        `Aata sirf feel karayla lagel, ki ek chhoti goshta try karayla  -  jo yogya vaatel te?`,
        `Mi ithe aahe  -  ekayla aikaycha aahe ki thoda saathey vichaarayla?`,
    ];
    const reflectLinesTa = [
        keyTopic ? `Nee ${keyTopic} patthi sollu  -  athula ippovum enna part romba trouble panudhu?` : `Ithula ippovum enna bhaagam romba kastam-ah irukku?`,
        `Ithula enna vidu vichaaraama irukku?`,
        `Oru vishayam mattum select panna  -  enna-na romba thoondudhu?`,
        `Indha situation la enna maari irundha nalla irukkum?`,
        `Idhai udalil eppadiye feel pannudhe ippovum?`,
        `Idhai konjam halka aa irundha  -  mudhalila enna maarirum?`,
    ];
    const nextStepLinesTa = [
        `Innnum pesikite poga mudiyum, ya oru chinna vishayam try pannalam  -  enna feel seri-nu thonudho adhu.`,
        `Sila perukku munna yellam solnum. Sila perukku plan venum. Nee ippovum enga irukkee?`,
        `Indha vishayam konjam konjam paakkalaam, ya oru chinna step edukkalaam. Ippovum enna uyirulla?`,
        `Naan un kooda irukken  -  pesikite poo-nu irukkum na, ya concrete-a enna pannuvathunu.`,
        `Ippavum feel pannanum-nu irukkaa, illaa oru small step ethaavathu mukkiyamaa?`,
        `Naan inga irukken  -  pesa venumaa, illaa serthu konjam yosipen-naa?`,
    ];
    const reflectLinesTe = [
        keyTopic ? `Nuvvu ${keyTopic} gurinchi cheppav  -  aadaanlo ippudu enta bhaaram ga anipistundi?` : `Dinthlo ippudu neetho enta bhaaram ga undi?`,
        `Dinthlo enta vudilayaleka unnav?`,
        `Okke vishayam choose cheyyalsochche  -  etta avvuttunna  -  adi enti?`,
        `Ee situation lo enti veru ga vundite baagundii anipistundi?`,
        `Ee bhaaranni mee shareeram lo ippudu ela feel aavutundi?`,
        `Idi koddiga easy ga undundi ante  -  mudhutagaa enti maaripotuundi?`,
    ];
    const nextStepLinesTe = [
        `Marinattu matladadam kaanee, okate chhota vishayam try cheyyadam  -  emaina bagundi.`,
        `Kondi manushulu mundu anni cheppukuntaaru. Kondi plan kaavaalaa antaaru. Nuvvu ippudu ekkade?`,
        `Inka ee vishayam khodalsukodam, kaanee okate chhota kadam veyyadam. Ippudu emmi useful ga undi?`,
        `Nenu ninnu follow chestunna  -  matladaadam kaanee, concrete ga emanna cheyyadam kaanee.`,
        `Ippudu feel aavadaniki time kaavaala, leda oka chinna step munduku vellaalanaa?`,
        `Nenu unnaanu  -  cheppukovadam kaavaala, leda koddiga saaye alochinchaala?`,
    ];
    const reflectLinesGu = [
        keyTopic ? `Tane ${keyTopic} ni vaat kari  -  tema abhi kyo bhaag sabse zyada dum kaade chhe?` : `Aama abhi kayo bhaag tamne sabse zyada bhaarhe laage chhe?`,
        `Aama sabse zyada uncomfortable kaay laage chhe?`,
        `Jou ek j vastu chunnivani hoy jo sabse zyada pareshaan kaare  -  shu hase?`,
        `Tame aama shu judoon zhaavyu haat aem ichhuo chho?`,
        `Aa badhu aa sharirmae kevi rite feel thay chhe abhi?`,
        `Je aa thodu haaku hotu  -  pehle shu badlaat?`,
    ];
    const nextStepLinesGu = [
        `Vaata karayla suru raahi shakiye, ya ek chhoti vastu try kariye  -  jo theek laage te.`,
        `Kaahek pehla badhu bolva joiye. Kaahekne plan joiye. Tame abhi kuye chho?`,
        `Ane aagal vadiye, ya ek nanu kadam liye. Abhi kaay zyada useful laage?`,
        `Hoon tamari sathe chhu  -  vaata karayla ke kaahi concrete karayla.`,
        `Atyaare feel karvun zaroori chhe, ke ek nanku kadam uthaavanu zyada kaam laage?`,
        `Hu tara sathe chhun  -  bolvun chhe ke thodu saathey vicharvun chhe?`,
    ];
    const reflectLinesPa = [
        keyTopic ? `Tune ${keyTopic} di gall ki  -  us mein hune kaai hissa sabse zyada bhaari lagdi?` : `Iss mein hune kaai hissa sabse zyada bhaari lagda hai?`,
        `Iss mein sabse zyada uncomfortable kaai hai?`,
        `Ek cheez chunni hoi jo sabse zyada takleef dendi  -  kaai hogi?`,
        `Is situation mein kaai alag hunda ta changa lagda?`,
        `Eh sab sharir wich kiven feel ho raha hai abhi?`,
        `Je eh thoda halka hunda  -  sab ton pehle ki badal janda?`,
    ];
    const nextStepLinesPa = [
        `Gal karte rehna sakde haan, ya koi chhoti cheez try karnaa  -  jo sahi lage.`,
        `Kuch bandhe pehle sab kuch bol lende ne. Kuch nu plan chahida hai. Tu hune kithe hai?`,
        `Ise thoda aur kholiye, ya ek chhota kadam. Hune kaai zyada useful lagda hai?`,
        `Main tere naal haan  -  gal karna ho ya kuch concrete karna.`,
        `Hune sirf mehsoos karna zaroori aa, ya ik chhota kadam chukni zyada zaroorat aa?`,
        `Main tere naal haan  -  bolna hai ya thoda saath milke sochna hai?`,
    ];
    const reflectLinesKn = [
        keyTopic ? `Neevu ${keyTopic} bagge helthu  -  adharalli ippudu yaavudu hechhu bharam aagiide?` : `Idara bagge ippudu yaavudu bhaagha nimage hechhu yochane ide?`,
        `Idara bagge yaavudu bhaagha bidoladaagi ide?`,
        `Ondu vishaya matthu aydhukondare yaavudu hechhu thondre taruthe  -  adu yaavudu?`,
        `Ee paristhithiyali yaavudu bedelidre channagi iruttithu?`,
        `Ee ella shareeradalli hege feel aagutthide ippaga?`,
        `Ide thoda halkaagidre  -  mundaagiide enthu badilaaguttide?`,
    ];
    const nextStepLinesKn = [
        `Matanaadikootu hoge bahudu, yaa ondu chhota vishaya try maadikoloke  -  yaavudu sari anistade.`,
        `Kele manushya munche ella heluttaare. Kele manushyara plan bekaguttade. Neevu ippudu elli iddeeri?`,
        `Innasht ee vishaya kholoona, yaa ondu chhota move. Ippudu yaavudu hechhu useful anistade?`,
        `Naanu nimmajjage idini  -  matanaadikoloke yaa concrete enu maadikoloke.`,
        `Ippaagu feel aagabeku anta ide, haada ond chikka haejuguli mundakke haakuvudu zyaadaa upayuktavaa?`,
        `Naanu ninna jote iddene  -  haelu beku antha ide, haada swalpa saaye alochisona antha ide?`,
    ];
    const reflectLinesMl = [
        keyTopic ? `Nee ${keyTopic} patti paranju  -  athile ippol enthu bhaaram kooduthal tonunnu?` : `Ithile ippol enthu bhaagam ninne kooduthal feel aakkunnu?`,
        `Ithile enthu bhaagam vidalannu illath?`,
        `Oru vishayam matthu thirichu  -  enthu aanu kooduthal thonarunathu?`,
        `Ee situation-il enthu veru ayirunnel nannayirunnu?`,
        `Ee bharamellam shareeram-il ippol ettaara feel aakkunnu?`,
        `Idi kurachu kaalathu aayirunnu enkil  -  muthal enthu maarimarum?`,
    ];
    const nextStepLinesMl = [
        `Iniyum koodi samsarikkam, athwa oru chinna vishayam try cheyyam  -  enthu feel aanno adhu.`,
        `Chaila perukku munpil ellam parayan venam. Chaila perukku plan venam. Nee ippol evidam?`,
        `Idi koodi thurakunnu, athwa oru chhota kadam. Ippol enthu koodi uyirullathu?`,
        `Njan ninnodoppam und  -  samsarikkanum athwa concrete aay enu cheyyanam.`,
        `Ippol feel cheyyaan sambhavam aano, allenkil oru chinna kaaryam cheyyanamo zyaadha praayojakamano?`,
        `Njaan ninnoppam undu  -  parayan aano, allenkil koottaay oru saadhanam alochikkanamo?`,
    ];
    const reflectLinesOr = [
        keyTopic ? `Tume ${keyTopic} baare kahu  -  setha ra ebe kihi bhaara laguchi?` : `Ehi baare ebe kihi tume r upar beshi bhaara laguchi?`,
        `Ehi baare ebe kihi chhadi para kaathin laguchi?`,
        `Gote kaahini go chunani pari jeba je beshi pareshaan karuche  -  se ki?`,
        `Ei paristhithi re kihi alag heu thile bhala heu thaa?`,
        `Ee sab sharire abhi kemon feel hauchhi?`,
        `Jadi ee thoda halka hota  -  sab aage ki badlata?`,
    ];
    const nextStepLinesOr = [
        `Baata karibaa jaari raakhibaa, yaa gote chhota kaam try karibaa  -  jo theek lagibe.`,
        `Kichhi loka aage sab boli deithaanti. Kichhi loka plan chaahanti. Tume ebe kuthe?`,
        `Ei bhaabake aroo kholibaa, yaa gote chhota kadam. Ebe kihi aroo useful laguchi?`,
        `Mun tumara sathe achi  -  baata karibaa pariba ki concrete kihi karibaa.`,
        `Ebe feel karibaa darkar, naa ek chhoto kaadama neba zyaada kaajaare aasibaa?`,
        `Mu tomar saathire aachi  -  bolibaa chaau, naa kichu saathire aalochanaa karibaa?`,
    ];

    const extrasByToneTa: Record<LocalResponseTone, string[]> = {
        calm: [``, `Oru pagudhiyil mattum irunga  -  ippothuku.`, `Yellaththaiyum oru saare theerkka velayilla.`, `Azhuthhu seyyaama stabilea vachhukolalaam.`, `Oru vizhaiyai mattum  -  adarvai inname aaganam.`, `Mun pogradharku munnaadi oru nimisham ingaye irukalaam.`],
        supportive: [``, `Ellaa sumbai oru saare thookka venandam.`, `Miga perumaa yaa irukkurathai mun vachhu paarkkalaam.`, `Innamum ella ezhagaa irundhaalum  -  paravaailla.`, `Indha heavy feel-u innum irukkunna seri-aana udaimaiyaana visayam.`, `Innume yellaathayum purinjikkalave thevayillai.`],
        practical: [``, `Miga mukkiyamaana visayathai munnaadi paarkkalaam.`, `Idhai thaan manage panna mudiyum nila vachhukolalaam.`, `Oru upayogamaana pagudhiyai paarththaal podhum.`, `Idhai konjam thunikkukalaam.`, `Adutha clear adiyai mattum  -  verra onnum illai.`],
        coach: [``, `Miga workable-aa irukka visayathai munnaadi kaanealaam.`, `Ippa oru steady move mattum thevai.`, `Ellaaththaiyum oru saare sulichchu therikka venandam.`, `Oru grounded adiyai mattum  -  adhai venum.`, `Idhai thonruvadhai vida simple-aana mudiyannu.`],
        "gentle-humor": [``, `Ignore pannaamal konjam ellam vachhukolalaam.`, `Oru chinna maattam ippothuku podhum.`, `Naan innamum ungaludan irukken.`, `Oru chinna vettri innamum vettri.`, `Indra day wrestling thevaiyillai.`],
        direct: [``, `Idhai clear-aa vachhukolalaam.`, `Oru real pagudhiyai onraa handle panalaam.`, `Ippathuku adutha useful pagudhiyai mattum.`, `Ingaye, ippovum enna mukkiyam?`, `Mukkiyamaana pagudhiyil focusaalaam.`],
    };
    const extrasByToneTe: Record<LocalResponseTone, string[]> = {
        calm: [``, `Oka bhaagam lone undam  -  ippudu.`, `Anni okasarike theerchadam avasaram ledu.`, `Force cheyyadam lekundaa ee stable ga vunchukovalaam.`, `Okka adugundi  -  pressure ledu.`, `Munduki velladam mundu oka nimisham ikkade vundadam.`],
        supportive: [``, `Anni bharaani oka saari mochhadam ledu.`, `Anni kaanna bhaari ga anipistundedi mundu chuddam.`, `Inka ila undi naado  -  chaala chaala sari.`, `Idi inka bhaari ga anipistunna ardhavantam.`, `Anni adharniki ardhamu cheppadam avasaram ledu.`],
        practical: [``, `Anni kaanna mukhyamaindhi mundu choodadam.`, `Deeniki manageable ga vundaaniki help avutundi.`, `Oka upayogakaramaana bhaagam ippudu chaalu.`, `Deeniki koddiga muddu koyyadam.`, `Tarvata clear adugu mattum  -  inkevaru ledu.`],
        coach: [``, `Anni kaanna workable bhaagam mundu kaanaalii.`, `Ippudu oka steady move chaaludu.`, `Anni oka saari sulichukovadam avasaram ledu.`, `Oka grounded adugu chaaludu.`, `Iddi anipistunna daanantaa simplenga cheyyadaniki.`],
        "gentle-humor": [``, `Ignore cheyyadam lekundaa kontha easy ga chusukovalaam.`, `Oka chinna shift ippudu chaalu.`, `Nenu inka neetho unna.`, `Oka chinna galam inka galam.`, `Nenu ninnu ee roju wrestling avvasaram ledu.`],
        direct: [``, `Deeniki clear ga vunchukovalaam.`, `Okka real bhaagam oka saari handle cheyyadam.`, `Ippudu tarvata upayogakaramaana bhaagam mattum.`, `Ikkade, ippudu emi mukhyam?`, `Mukhyamaindi meeda focus.`],
    };

    // ── Micro-story  -  disabled for local offline fallback ────────────────────────
    // Micro-stories can feel disconnected without the full AI context.
    // Keeping local fallback clean: opener + validation + extra only.
    const isEmotionalSignal = signal !== "okay";
    const storyLine = null;

    // ── Mythology story  -  disabled for local offline fallback ───────────────────
    // Mythology stories are long, cultural, and context-dependent. When the cloud
    // is unavailable (offline fallback path), they feel jarring and out-of-place.
    // The cloud path (AI-generated) handles story/mythology when appropriate.
    const isEnglishLang = language === "en";
    const mythLine = null;

    // ── Offline quote (~1 in 5 emotional turns, English only) ───────────────────
    // Uses seed bit-window >>>11 to avoid collision with story (>>>7) and myth (>>>9).
    // For non-English offline users, quotes are skipped (LLM online paths handle it).
    const quoteTurnCheck = (seed >>> 11) % 5 === 0;
    const shouldInsertQuote = isEmotionalSignal && isEnglishLang && !isCorrection && !isVagueReply && quoteTurnCheck && !mythLine;
    const quoteLine = shouldInsertQuote ? buildOfflineQuote(signal, seed) : null;

        // ── Assemble ──────────────────────────────────────────────────────────────

    const openers =
        language === "hi" ? openersByToneHi[companionTone] :
        language === "mr" ? openersByToneMr[companionTone] :
        language === "bn" ? openersByToneBn[companionTone] :
        language === "ta" ? openersByToneTa[companionTone] :
        language === "te" ? openersByToneTe[companionTone] :
        language === "gu" ? openersByToneGu[companionTone] :
        language === "pa" ? openersByTonePa[companionTone] :
        language === "kn" ? openersByToneKn[companionTone] :
        language === "ml" ? openersByToneMl[companionTone] :
        language === "or" ? openersByToneOr[companionTone] :
        language === "zh" ? openersByToneZh[companionTone] :
        language === "es" ? openersByToneEs[companionTone] :
        language === "ar" ? openersByToneAr[companionTone] :
        language === "fr" ? openersByToneFr[companionTone] :
        language === "pt" ? openersByTonePt[companionTone] :
        language === "ru" ? openersByToneRu[companionTone] :
        language === "id" ? openersByToneId[companionTone] :
        language === "ur" ? openersByToneUr[companionTone] :
        language === "de" ? openersByToneDe[companionTone] :
        openersByToneEn[companionTone];

    const validations =
        language === "hi" ? validationsHi :
        language === "mr" ? validationsMr :
        language === "bn" ? validationsBn :
        language === "ta" ? validationsTa :
        language === "te" ? validationsTe :
        language === "gu" ? validationsGu :
        language === "pa" ? validationsPa :
        language === "kn" ? validationsKn :
        language === "ml" ? validationsMl :
        language === "or" ? validationsOr :
        language === "zh" ? validationsZh :
        language === "es" ? validationsEs :
        language === "ar" ? validationsAr :
        language === "fr" ? validationsFr :
        language === "pt" ? validationsPt :
        language === "ru" ? validationsRu :
        language === "id" ? validationsId :
        language === "ur" ? validationsUr :
        language === "de" ? validationsDe :
        validationsEn;

    const reflectLines =
        language === "hi" ? reflectLinesHi :
        language === "bn" ? reflectLinesBn :
        language === "mr" ? reflectLinesMr :
        language === "ta" ? reflectLinesTa :
        language === "te" ? reflectLinesTe :
        language === "gu" ? reflectLinesGu :
        language === "pa" ? reflectLinesPa :
        language === "kn" ? reflectLinesKn :
        language === "ml" ? reflectLinesMl :
        language === "or" ? reflectLinesOr :
        language === "zh" ? reflectLinesZh :
        language === "es" ? reflectLinesEs :
        language === "ar" ? reflectLinesAr :
        language === "fr" ? reflectLinesFr :
        language === "pt" ? reflectLinesPt :
        language === "ru" ? reflectLinesRu :
        language === "id" ? reflectLinesId :
        language === "ur" ? reflectLinesUr :
        language === "de" ? reflectLinesDe :
        reflectLinesEn;

    const nextStepLines =
        language === "hi" ? nextStepLinesHi :
        language === "bn" ? nextStepLinesBn :
        language === "mr" ? nextStepLinesMr :
        language === "ta" ? nextStepLinesTa :
        language === "te" ? nextStepLinesTe :
        language === "gu" ? nextStepLinesGu :
        language === "pa" ? nextStepLinesPa :
        language === "kn" ? nextStepLinesKn :
        language === "ml" ? nextStepLinesMl :
        language === "or" ? nextStepLinesOr :
        language === "zh" ? nextStepLinesZh :
        language === "es" ? nextStepLinesEs :
        language === "ar" ? nextStepLinesAr :
        language === "fr" ? nextStepLinesFr :
        language === "pt" ? nextStepLinesPt :
        language === "ru" ? nextStepLinesRu :
        language === "id" ? nextStepLinesId :
        language === "ur" ? nextStepLinesUr :
        language === "de" ? nextStepLinesDe :
        nextStepLinesEn;

    const extrasByTone =
        language === "hi" ? extrasByToneHi :
        language === "mr" ? extrasByToneMr :
        language === "bn" ? extrasByToneBn :
        language === "ta" ? extrasByToneTa :
        language === "te" ? extrasByToneTe :
        language === "gu" ? extrasByToneGu :
        language === "pa" ? extrasByTonePa :
        language === "kn" ? extrasByToneKn :
        language === "ml" ? extrasByToneMl :
        language === "or" ? extrasByToneOr :
        language === "zh" ? extrasByToneZh :
        language === "es" ? extrasByToneEs :
        language === "ar" ? extrasByToneAr :
        language === "fr" ? extrasByToneFr :
        language === "pt" ? extrasByTonePt :
        language === "ru" ? extrasByToneRu :
        language === "id" ? extrasByToneId :
        language === "ur" ? extrasByToneUr :
        language === "de" ? extrasByToneDe :
        extrasByToneEn;

    const seedIntent = pick(["clarify", "reflect", "reframe"] as const, seed >>> 3);
    const prompt =
        seedIntent === "clarify" ? pick(nextStepLines, seed >>> 4) :
        seedIntent === "reflect" ? pick(reflectLines, seed >>> 4) :
        language === "hi" ? `Agar yahi baat kisi apne ke saath hoti  -  tum unhe kya kahte?` :
        language === "ur" ? `Agar yahi baat kisi azeez ke saath hoti  -  aap unhe kya kehte?` :
        language === "bn" ? `Jodi eta tomar kono priyojoner sathe hoto  -  tumi taake ki bolte?` :
        language === "gu" ? `Jadi aa vaat koi priyajanna ni saath thai hoti  -  tame tene shu kaheto?` :
        language === "pa" ? `Je eh gall tere kisi priye naal hundi  -  toon use ki kehndaa?` :
        language === "mr" ? `Jari he eka priyajanaabaddal ghadalele aste  -  tumi tyala kay sangitle aste?` :
        language === "kn" ? `Idu ninna yadyaaraadaru priyaraadavaralli nadittidrе  -  neevu avaranu enu heluttiddiri?` :
        language === "ml" ? `Idi ninnude priyapettavarumaayirunnal  -  nee avare enu paraayumayirunnu?` :
        language === "or" ? `Jadi ei kathaa tuma priyajanaanka sathe ghaTithanta  -  tume taanku ki kahanthe?` :
        language === "ta" ? `Idhu unakkku piriyamana oruvarukkku nadhanthal  -  nee avarrukku enna solvai?` :
        language === "te" ? `Idi nee priyamaina okarike jarigite  -  nuvvu vaallaki emi cheppathav?` :
        language === "zh" ? `如果同样的事情发生在你在乎的人身上，你会对他们说什么？` :
        language === "es" ? `Si esto le pasara a alguien que quieres, ¿qué le dirías?` :
        language === "ar" ? `لو حدث هذا لشخص تهتم به، ماذا كنت ستقول له؟` :
        language === "fr" ? `Si ça arrivait à quelqu'un que tu aimes, que lui dirais-tu?` :
        language === "pt" ? `Se isso acontecesse com alguém que você ama, o que você diria a essa pessoa?` :
        language === "ru" ? `Если бы это произошло с кем-то близким  -  что бы ты им сказал?` :
        language === "id" ? `Kalau ini terjadi pada orang yang kamu sayangi, apa yang akan kamu katakan padanya?` :
        `If this happened to someone you care about  -  what would you say to them?`;

    // Correction repair prefix
    const correctionPrefixes: Partial<Record<string, string>> = {
        en: "Let me try that differently  - ",
        hi: "Chalo phir se samjhte hain  - ",
        mr: "Chala punaah samjhto  - ",
        bn: "Chalo abar bujhi  - ",
        ta: "Maarichchu paarkalam  - ",
        te: "Inkaa okasaari try cheddaam  - ",
        gu: "Chalo pharthi samjhiye  - ",
        pa: "Chalo phir samjhiye  - ",
        kn: "Innomme try maadona  - ",
        ml: "Innoru praavashyam nokkaaam  - ",
        or: "Aaau eka bhara bujhibaa  - ",
        zh: "让我换个方式来说  - ",
        es: "Déjame intentarlo de otra manera  - ",
        ar: "دعني أحاول بطريقة مختلفة  - ",
        fr: "Laisse-moi essayer autrement  - ",
        pt: "Deixa eu tentar de outro jeito  - ",
        ru: "Попробую по-другому  - ",
        id: "Izinkan saya mencoba dengan cara lain  - ",
        ur: "Aane do phir se samjhane ki koshish karta hoon  - ",
        de: "Ich meinte eigentlich  -  ",
    };
    const correctionPrefix = isCorrection ? ((correctionPrefixes[language] ?? correctionPrefixes.en) + " ") : "";

    // Follow-up prefix for vague replies when a topic is known
    const followUpPrefixFn: Partial<Record<string, (t: string) => string>> = {
        en: (t) => `Still thinking about the ${t} situation  - `,
        hi: (t) => `Abhi bhi ${t} ki baat chal rahi hai  - `,
        mr: (t) => `Abhi ${t} ch goshta suru aahe  - `,
        bn: (t) => `Ekhono ${t} er bishoy niye aacha  - `,
        ta: (t) => `Ingum ${t} patthi pesrom  - `,
        te: (t) => `Ippudu ${t} vishayame  - `,
        gu: (t) => `Abhi ${t} ni vaat chal rahi chhe  - `,
        pa: (t) => `Hali ${t} di gall chal rahi aa  - `,
        kn: (t) => `Ippudu ${t} vishayakke  - `,
        ml: (t) => `Ippol ${t} kayaryathil  - `,
        or: (t) => `Ekhanu ${t} bisayare  - `,
        zh: (t) => `还在想着${t}的事  - `,
        es: (t) => `Todavía pensando en lo de ${t}  - `,
        ar: (t) => `لا أزال أفكر في موضوع ${t}  - `,
        fr: (t) => `Je pense encore à la situation ${t}  - `,
        pt: (t) => `Ainda pensando na situação de ${t}  - `,
        ru: (t) => `Всё ещё думаю о ситуации с ${t}  - `,
        id: (t) => `Masih memikirkan soal ${t}  - `,
        ur: (t) => `Abhi bhi ${t} ke baare mein soch raha hoon  - `,
        de: (t) => `Ich denke noch an das Thema ${t}  - `,
    };
    const followUpPrefix = (isVagueReply && keyTopic)
        ? (((followUpPrefixFn[language] ?? followUpPrefixFn.en)!(keyTopic)) + " ")
        : "";

    // Topic hint (multi-language)
    const topicHintsByLang: Partial<Record<string, Record<string, string>>> = {
        en: { work: "Work pressure like this can really pile up.", relationship: "Relationships can carry so much weight.", health: "Taking care of yourself matters most right now.", existential: "These bigger questions deserve space.", general: "" },
        hi: { work: "Is tarah ka kaam ka dabaao sach mein bhaari hota hai.", relationship: "Rishte bahut kuch uthate hain.", health: "Abhi apna khayal rakhna sabse zaroori hai.", existential: "Yeh bade sawaalon ko jagah milni chahiye.", general: "" },
        mr: { work: "Aasa kaamaacha dabaao khupach bhaari asato.", relationship: "Naate khup kahi sahan karat astat.", health: "Ata swatahchi kaaljee ghene saglaat mahattvaache aahe.", existential: "Ya moThya prashnaaanaa jagaa milaayla havi.", general: "" },
        bn: { work: "Ei dhoroner kajer chap sacchi onek bhari hoy.", relationship: "Sombondho onek kichhu bahan kore.", health: "Ekhon nijer joton neoa sabcheye dorkar.", existential: "Ei boro proshnogulo jaygar dabi rakhe.", general: "" },
        ta: { work: "Indha maadiri velai azhutham mela varum.", relationship: "Uravugal romba paaram vahaikkum.", health: "Ippovum unavvai paaththukkolla mudiyum.", existential: "Indha periya kelvigalukku idam theva.", general: "" },
        te: { work: "Ee taraha paani pressure nijamgaa penkutundi.", relationship: "Sambandhaalu chala bhaaram vahaistaayi.", health: "Ippudu meeru meemi chusukovalsinidi anipistundi.", existential: "Ee peddha prashnaalu jaagaa arham chestaayi.", general: "" },
        gu: { work: "Aa prakaarno kaam no dabaao sachu j vadhtu jaay che.", relationship: "Sambandho ghanu kainchuk vahe chhe.", health: "Abhi potani kaalagni rakhavi saagaman zaroori chhe.", existential: "Aa mota prashno ne jagya milavi joie.", general: "" },
        pa: { work: "Is tarah da kaam da dbaao sach mein vadhda jaanda hai.", relationship: "Rishte bahut kuch chukke hunde hain.", health: "Hun apna khayal rakhna sabto zaroor hai.", existential: "Eh vadde sawaal jagah de haqdar hain.", general: "" },
        kn: { work: "Ee tarah kaam othattada nijavaagi jaastaaguttade.", relationship: "Sambandha tumba hothtu vaahisuttave.", health: "Ippudu nimage jaghruta thegondu munduvaraguvudu mukhya.", existential: "Ee dodda prashnega jagha sigabeku.", general: "" },
        ml: { work: "Ithupola job pressure sacchi koodi varum.", relationship: "Bandhangal valare bharam vahikkunnundu.", health: "Ippol ninne sheriyaagi naakaanulla samayam idan.", existential: "Ee valiya chodyangalkku space venam.", general: "" },
        or: { work: "Ei dharan kaama r chap sachhi onek bhari.", relationship: "Sambandh bahut kichhi bahana kare.", health: "Ekhon nijakee jatna neiba sabse important.", existential: "Ei boro prashnagudi jagaa paibaara dabi rakhe.", general: "" },
        zh: { work: "这种工作压力真的会越积越重。", relationship: "感情关系可以承载很多东西。", health: "现在照顾好自己是最重要的。", existential: "这些更大的问题值得被认真对待。", general: "" },
        es: { work: "Este tipo de presión laboral realmente se acumula.", relationship: "Las relaciones pueden pesar mucho.", health: "Cuidarte es lo más importante ahora mismo.", existential: "Estas preguntas más grandes merecen espacio.", general: "" },
        ar: { work: "هذا النوع من ضغط العمل يتراكم فعلاً.", relationship: "العلاقات يمكن أن تحمل ثقلاً كبيراً.", health: "الاهتمام بنفسك هو الأهم الآن.", existential: "هذه الأسئلة الكبيرة تستحق مساحة.", general: "" },
        fr: { work: "Ce genre de pression au travail s'accumule vraiment.", relationship: "Les relations peuvent peser beaucoup.", health: "Prendre soin de toi est ce qui compte le plus maintenant.", existential: "Ces grandes questions méritent de la place.", general: "" },
        pt: { work: "Esse tipo de pressão no trabalho realmente se acumula.", relationship: "Os relacionamentos podem carregar muito peso.", health: "Cuidar de si mesmo é o mais importante agora.", existential: "Essas questões maiores merecem espaço.", general: "" },
        ru: { work: "Такое давление на работе действительно накапливается.", relationship: "Отношения могут нести в себе очень много.", health: "Прямо сейчас важнее всего позаботиться о себе.", existential: "Эти большие вопросы заслуживают пространства.", general: "" },
        id: { work: "Tekanan kerja seperti ini memang bisa menumpuk.", relationship: "Hubungan bisa membawa beban yang sangat berat.", health: "Merawat dirimu sendiri adalah hal terpenting saat ini.", existential: "Pertanyaan-pertanyaan besar ini layak mendapat ruang.", general: "" },
        ur: { work: "Kaam ka yeh bojh dil pe bhaari pad raha hoga.", relationship: "Rishtey bahut kuch sahen karte hain  -  yeh sach hai.", health: "Apna khayal rakhna abhi sabse pehli baat hai.", existential: "Yeh bade sawaal hain  -  inhe jagah milni chahiye.", general: "" },
        de: { work: "Dieser Arbeitsdruck kann sich wirklich auftürmen.", relationship: "Beziehungen können viel tragen.", health: "Jetzt ist es am wichtigsten, auf dich selbst zu achten.", existential: "Diese größeren Fragen verdienen Raum.", general: "" },
    };
    const topicHint = (topic !== "general" && signal !== "okay")
        ? ` ${(topicHintsByLang[language] ?? topicHintsByLang.en)![topic] ?? ""}`
        : "";

    const opener = pickAvoidingRecent(openers, seed, recentContext?.recentAssistantTexts ?? []);
    const hasCarry = signal === "okay" && hasRecentEmotionalSignal(recentContext);

    const carryValidationMap: Partial<Record<string, string[]>> = {
        hi: carryValidationsHi, mr: carryValidationsMr, bn: carryValidationsBn,
        ta: carryValidationsTa, te: carryValidationsTe,
        gu: carryValidationsGu, pa: carryValidationsPa, kn: carryValidationsKn,
        ml: carryValidationsMl, or: carryValidationsOr,
        zh: carryValidationsZh, es: carryValidationsEs, ar: carryValidationsAr,
        fr: carryValidationsFr, pt: carryValidationsPt, ru: carryValidationsRu,
        id: carryValidationsId, ur: carryValidationsUr, de: carryValidationsDe,
    };
    const carryExtrasMap: Partial<Record<string, Record<LocalResponseTone, string[]>>> = {
        hi: carryExtrasHi, mr: carryExtrasMr, bn: carryExtrasBn,
        ta: carryExtrasTa, te: carryExtrasTe,
        gu: carryExtrasGu, pa: carryExtrasPa, kn: carryExtrasKn,
        ml: carryExtrasMl, or: carryExtrasOr,
        zh: carryExtrasZh, es: carryExtrasEs, ar: carryExtrasAr,
        fr: carryExtrasFr, pt: carryExtrasPt, ru: carryExtrasRu,
        id: carryExtrasId, ur: carryExtrasUr, de: carryExtrasDe,
    };

    const recent = recentContext?.recentAssistantTexts ?? [];
    const validation = hasCarry
        ? pickAvoidingRecent(carryValidationMap[language] ?? carryValidationsEn, seed >>> 1, recent)
        : pickAvoidingRecent(validations[signal], seed >>> 1, recent);

    const listeningOnlyMap: Partial<Record<string, string[]>> = {
        en: listeningOnlyExtrasEn, hi: listeningOnlyExtrasHi, bn: listeningOnlyExtrasBn,
        ta: listeningOnlyExtrasTa, te: listeningOnlyExtrasTe, gu: listeningOnlyExtrasGu,
        pa: listeningOnlyExtrasPa, kn: listeningOnlyExtrasKn, ml: listeningOnlyExtrasMl,
        or: listeningOnlyExtrasOr, mr: listeningOnlyExtrasMr,
        zh: listeningOnlyExtrasZh, es: listeningOnlyExtrasEs, ar: listeningOnlyExtrasAr,
        fr: listeningOnlyExtrasFr, pt: listeningOnlyExtrasPt, ru: listeningOnlyExtrasRu,
        id: listeningOnlyExtrasId, ur: listeningOnlyExtrasUr, de: listeningOnlyExtrasDe,
    };
    const extra = hasCarry
        ? pick((carryExtrasMap[language] ?? carryExtrasEn)[companionTone], seed >>> 5)
        : userIntent === "venting"
            ? pick(listeningOnlyMap[language] ?? listeningOnlyExtrasEn, seed >>> 5)
            : pick(extrasByTone[companionTone], seed >>> 5);

    const base = `${correctionPrefix}${followUpPrefix}${opener} ${validation}`.trim();
    const storyPart = storyLine ? " " + storyLine : "";
    const mythPart = mythLine ? " " + mythLine : "";
    const quotePart = quoteLine ? " " + quoteLine : "";
    const extraPart = suppressExtras ? "" : (extra ? " " + extra : "");
    const finalMsg = dedupeAdjacentSentences(`${base}${storyPart}${mythPart}${quotePart}${extraPart}${topicHint}`.trim());

    // Age-aware closing
    const ageClosersByLang: Record<string, Partial<Record<string, string>>> = {
        under_13: { en: "You're doing really well just by sharing this.", hi: "Yeh share karna himmat ki baat hai.", bn: "Eta share kora onek sahosher kaaj.", ta: "Idha sollaradhe nalla irukkudhu.", te: "Idi cheppadam chala brave ga undi.", kn: "Idu heltirodu tumba olle vishaya.", ml: "Idi paranjathu valare nannaayi.", gu: "Aa share karavanu ek himmat ni vaat chhe.", pa: "Eh share karna bahut himmat di gall hai.", or: "Eta share kara onek sahasa r kaaj.", mr: "He share karane khupach dhads aache.", zh: "能说出来就已经很厉害了。", es: "Compartir esto ya es un gran paso.", ar: "مجرد مشاركتك هذا أمر شجاع جداً.", fr: "Le fait d'en parler montre déjà beaucoup de courage.", pt: "Só de compartilhar isso você está indo muito bem.", ru: "То, что ты поделился  -  это уже очень смело.", id: "Sudah berani berbagi seperti ini itu keren.", ur: "Yeh share karna himmat ki baat hai." },
        "13_17": { en: "You've got this.", hi: "Tum sambhal loge yaar.", mr: "Tu handle karasheel.", bn: "Tumi thik korte parbe.", ta: "Unakkale mudiyum.", te: "Nuvvu manage cheyagalagaavu.", kn: "Neevu handle maadabahudu.", ml: "Ninakku parreyum.", gu: "Tu sambhali laishe.", pa: "Tu sambhal lavega.", or: "Tume sambhaliba pariba.", zh: "你能行的。", es: "Tú puedes con esto.", ar: "أنت قادر على ذلك.", fr: "Tu vas y arriver.", pt: "Você consegue.", ru: "Ты справишься.", id: "Kamu bisa melewati ini.", ur: "Tum sambhal loge." },
        "65_plus": { en: "Take your time  -  there is no rush.", hi: "Apni speed se chalo  -  koi jaldi nahi hai.", mr: "Tuzha vel ghe  -  kaahlichi ghai nahi.", bn: "Tomar time nao  -  kono taratari nei.", ta: "Un neram eduthukko  -  avasaara illai.", te: "Nee samayam teesukundu  -  avasaara ledu.", kn: "Nimma samaya tagondi  -  avasara illa.", ml: "Nee samayam edukku  -  tharamillaa.", gu: "Tamaro samay lejo  -  koi uchhat nathi.", pa: "Apna waqt lo  -  koi jaldi nahin.", or: "Tumara samay niao  -  kono jaldi nei.", zh: "慢慢来，不用着急。", es: "Tómate tu tiempo, no hay prisa.", ar: "خذ وقتك  -  لا داعي للتسرع.", fr: "Prends ton temps  -  il n'y a aucune urgence.", pt: "Leva o tempo que precisar  -  sem pressa.", ru: "Не торопись  -  всё в порядке.", id: "Santai saja, tidak perlu buru-buru.", ur: "Apni speed se chalo  -  koi jaldi nahi." },
        "18_24": { en: "You're doing the right thing by talking about it.", hi: "Is baare mein baat karna sahi kadam hai.", mr: "Yaabaddal bolne he yogy aahe.", bn: "Eta niye kotha bola thik kaaj kara hochhe.", ta: "Idha pathi pesuradhu sari dhan.", te: "Idi gurinchi maatladatam manchidi.", kn: "Idu bagge mathaduvudu sariyaada kaelasa.", ml: "Itu kurichu samsaarikkunnathu shariyanukkaranam.", gu: "Aa baare vaat karavi yogya che.", pa: "Is baare gall karna sahi kadam hai.", or: "Ei bishayare kotha kahiba thik kaaj.", zh: "能说出来是正确的选择。", es: "Hablar de esto es lo correcto.", ar: "التحدث عن هذا هو الشيء الصحيح.", fr: "Parler de ça, c'est la bonne chose à faire.", pt: "Falar sobre isso é a coisa certa a fazer.", ru: "Ты правильно делаешь, что говоришь об этом.", id: "Kamu sudah melakukan hal yang benar dengan membicarakannya.", ur: "Is baare mein baat karna sahi kadam hai." },
        "25_34": { en: "You're not alone in this  -  a lot of people carry something like this.", hi: "Tum akele nahi ho isme  -  bahut log aise hi kuch uthate hain.", mr: "Tu ekta nahi  -  aneka lok ase kahi sahan kartat.", bn: "Tumi ekla nao  -  onek lok ai rokom kichhu bahan kore.", ta: "Nee thani illai  -  neraya pera indha maadiri oru tholai irukku.", te: "Nuvvu okkadivu kaadu  -  chala mandhi ila emi o mootukuntaaru.", kn: "Neenu ontiiya alla  -  tumba jana heegey ennuva edanno bahoosuttaare.", ml: "Nee thaaniyan alla  -  nireyaal peral ithupole entho vehikkunnundu.", gu: "Tu eklo nathi  -  ghano log aavun kainchuk vahe chhe.", pa: "Tu akela nahi  -  bahut log aisa kuch chuk de hain.", or: "Tume eka nahi  -  onek lok eidharan kichhi bahi chaluchhi.", zh: "你不是一个人 -  - 很多人都有过类似的感受。", es: "No estás solo en esto  -  mucha gente carga con algo así.", ar: "أنت لست وحدك في هذا  -  كثير من الناس يحملون شيئاً مشابهاً.", fr: "Tu n'es pas seul  -  beaucoup de gens portent quelque chose comme ça.", pt: "Você não está sozinho nisso  -  muita gente carrega algo assim.", ru: "Ты не один  -  многие люди несут в себе нечто подобное.", id: "Kamu tidak sendirian  -  banyak orang merasakan hal serupa.", ur: "Tum akele nahi ho  -  bahut log aise hi kuch uthate hain." },
        "35_44": { en: "It's okay to not have everything figured out.", hi: "Koi baat nahi agar sab kuch clear nahi hai abhi.", mr: "Sab kahi clear nasale tari chalte.", bn: "Sob ta clear na hole chalta  -  ekhon thik ache.", ta: "Ellame theriyaama irundhalum paravaillai.", te: "Anni ardham kaakunda undi ante nee ledu.", kn: "Ellavu artha aagabekilla  -  adhu sari.", ml: "Ellaam manasilaakathe paravaailla.", gu: "Sab kainchuk clear na hoy to chalse.", pa: "Sab kuch clear na hove, thik hai.", or: "Sab kichhi spashta na hole, thik achhi.", zh: "不需要什么都想明白，这没关系。", es: "Está bien no tener todo resuelto todavía.", ar: "لا بأس في أن لا يكون لديك إجابة لكل شيء.", fr: "C'est normal de ne pas avoir tout compris.", pt: "Tudo bem não ter tudo resolvido.", ru: "Нормально  -  не иметь ответов на всё.", id: "Tidak apa-apa kalau belum segalanya terpahami.", ur: "Koi baat nahi agar sab kuch clear nahi hai abhi." },
        "45_54": { en: "You're allowed to put yourself first right now.", hi: "Abhi apne aap ko pehle rakhna bilkul theek hai.", mr: "Sthaavar rahane yogya aahe  -  swatahkade lakshy dya.", bn: "Ekhon nijeke agey rakhte para  -  eta thik.", ta: "Ippovum unavvai munnu vaikka urimai irukkudhu.", te: "Ippudu meeru meemi mundu pettukovalsi inthe sari.", kn: "Ippudu nimage munnadhikarata koduvudu sari.", ml: "Ippol ninnekku mukhyata kodukkaanulla avakasham undu.", gu: "Abhi potane pahela rakhvo bilkul thik chhe.", pa: "Hun apne aap nu pehle rakhna bilkul theek hai.", or: "Ekhon nijekku age rakhiba thik.", zh: "现在把自己放在第一位是完全可以的。", es: "Está bien que te pongas a ti primero ahora mismo.", ar: "من حقك أن تضع نفسك في المقام الأول الآن.", fr: "Tu as le droit de te mettre en premier en ce moment.", pt: "Você tem permissão para se colocar em primeiro lugar agora.", ru: "Сейчас можно поставить себя на первое место.", id: "Boleh kok mendahulukan dirimu sendiri sekarang.", ur: "Abhi apne aap ko pehle rakhna bilkul theek hai." },
        "55_64": { en: "What you're feeling is completely valid  -  don't push it aside.", hi: "Jo tum feel kar rahe ho, woh bilkul sahi hai  -  ise ignore mat karo.", mr: "Tu jo feel karto te khup valid aahe  -  te baajula dhakku nako.", bn: "Tumi je feel korcho seta puroto sathik  -  eta ekpashe sarie diyo na.", ta: "Nee feel panradhu konjam um thevaiyaana  -  adha oda vidalaadhey.", te: "Mee feel avutunnaaru adi bilkul valid  -  daanini tappinchukoboddu.", kn: "Neevu feel aaguttiruvadudu sampoornavagi sariyaagide  -  adannu agalagisi bidabedi.", ml: "Nee feel aakkunnathu bilkul valid aanu  -  adhu marakkaathe.", gu: "Tu je feel kare chhe te bilkul valid chhe  -  tene ek baaju nakho.", pa: "Jo tu feel kar raha hai, bilkul sahi hai  -  ise ek passe na dhak.", or: "Tume je feel karuchha seta puro satya  -  eta ek paase thili diyo na.", zh: "你的感受是完全正当的 -  - 不要把它推开。", es: "Lo que sientes es completamente válido  -  no lo ignores.", ar: "ما تشعر به صحيح تماماً  -  لا تتجاهله.", fr: "Ce que tu ressens est tout à fait valide  -  ne le mets pas de côté.", pt: "O que você sente é completamente válido  -  não empurre isso para o lado.", ru: "Твои чувства полностью оправданы  -  не отмахивайся от них.", id: "Apa yang kamu rasakan itu sah sepenuhnya  -  jangan dikesampingkan.", ur: "Jo tum feel kar rahe ho, woh bilkul sahi hai  -  ise ignore mat karo." },
    };
    const ageCloser = userAge ? (ageClosersByLang[userAge]?.[language] ?? "") : "";
    const messageWithAge = ageCloser
        ? dedupeAdjacentSentences(`${finalMsg} ${ageCloser}`.trim())
        : finalMsg;

    // Gender adjustments
    let finalMessage = messageWithAge.replaceAll("Imotara", companionName);
    if (language === "hi") {
        finalMessage = applyHindiCompanionGender(finalMessage, companionGender);
        finalMessage = applyHindiUserGender(finalMessage, userGender);
    } else if (language === "gu") {
        finalMessage = applyGujaratiCompanionGender(finalMessage, companionGender);
        finalMessage = applyGujaratiUserGender(finalMessage, userGender);
    } else if (language === "pa") {
        finalMessage = applyPunjabiCompanionGender(finalMessage, companionGender);
        finalMessage = applyPunjabiUserGender(finalMessage, userGender);
    } else if (language === "bn") {
        finalMessage = applyBengaliCompanionGender(finalMessage, companionGender);
    } else if (language === "mr") {
        finalMessage = applyMarathiCompanionGender(finalMessage, companionGender);
        finalMessage = applyMarathiUserGender(finalMessage, userGender);
    } else if (language === "ta") {
        finalMessage = applyTamilCompanionGender(finalMessage, companionGender);
    } else if (language === "te") {
        finalMessage = applyTeluguCompanionGender(finalMessage, companionGender);
    } else if (language === "kn") {
        finalMessage = applyKannadaCompanionGender(finalMessage, companionGender);
    } else if (language === "ml") {
        finalMessage = applyMalayalamCompanionGender(finalMessage, companionGender);
    } else if (language === "or") {
        finalMessage = applyOdiaCompanionGender(finalMessage, companionGender);
    }

    // Occasionally address user by name (~1 in 3 replies)
    if (userName && seed % 3 === 0) {
        finalMessage = `${userName}, ${finalMessage}`;
    }

    return {
        message: finalMessage,
        reflectionSeed: { intent: seedIntent, title: "", prompt },
    };
}
