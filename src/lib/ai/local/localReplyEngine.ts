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
    | "zh" | "es" | "ar" | "fr" | "pt" | "ru" | "id";

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
    if (/\b(i'?m fine|it'?s fine|i'?m okay|i'?m ok|whatever|doesn'?t matter|never mind|forget it|it is what it is|it'?s nothing|not a big deal|i don'?t know|don'?t even know|can'?t explain|hard to explain)\b/.test(t)) return "sad";
    if (/\b(i give up|can'?t anymore|can't do this|too much|i'?m done|so over it|sick of (this|everything)|nothing (matters|helps|works))\b/.test(t)) return "sad";
    if (/\b(i don'?t know what to do|don'?t know where to start|all at once|can'?t keep up|spinning|head (is|feels) full|too many (things|thoughts))\b/.test(t)) return "anxious";
    if (/\b(so annoying|why (does|do|is) (this|everything|everyone|he|she|they)|seriously\?|unbelievable|i can'?t believe|ridiculous)\b/.test(t)) return "angry";
    if (/\b(just tired|so tired|exhausted (of|by)|drained|running on empty|no energy|wiped)\b/.test(t)) return "tired";
    if (/\b(thaklo|thakle|khup thaklo|kaay karau|nako vatato|aaik nahi|mann nahi)\b/.test(t)) return "tired";
    return null;
}

function detectIntent(text: string): "venting" | "advice-seeking" | "neutral" {
    const t = (text || "").toLowerCase().trim();
    if (/\?$/.test(t)) return "advice-seeking";
    if (/\b(what should (i|we)|how (do|can|should) i|can you help|any advice|any tips|what do i do|what would you|suggest|recommend|what'?s the best|how to deal|tell me (what|how))\b/.test(t)) return "advice-seeking";
    if (/\b(just (want to|wanted to|needed to) (say|vent|share|talk)|not looking for advice|just (listen|listening)|feel like telling|had to tell someone|couldn'?t hold it|ugh|argh|so frustrated|so upset|so sad|i hate this|i hate (it|when)|can'?t (take|stand|handle) (this|it|anymore))\b/.test(t)) return "venting";
    return "neutral";
}

function detectTopic(text: string, recentTexts: string[] = []): "work" | "relationship" | "health" | "existential" | "general" {
    const combined = ([text, ...recentTexts].join(" ") || "").toLowerCase();
    // Note: "work" is intentionally NOT in this list — it's too generic and matches
    // "working offline", "not working", "working out" etc. Use job/boss/deadline instead.
    if (/\b(job|boss|office|deadline|project|meeting|colleague|team|interview|career|study|exam|college|school|client|manager|promotion|salary|assignment)\b/.test(combined)) return "work";
    if (/\b(friend|family|mom|dad|mother|father|partner|boyfriend|girlfriend|relationship|love|marriage|divorce|breakup|fight|argument|toxic|miss (you|him|her|them)|alone|lonely)\b/.test(combined)) return "relationship";
    if (/\b(sick|pain|health|doctor|medicine|hospital|sleep|insomnia|eat|appetite|headache|migraine|tired|body|anxiety|depression|mental health|therapy|therapist|panic attack)\b/.test(combined)) return "health";
    if (/\b(life|meaning|purpose|why (am i|do i|does it)|exist|worth it|future|hope|everything|nothing matters|pointless|empty|lost|who am i|identity|direction)\b/.test(combined)) return "existential";
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
    const match = joined.match(/\b(mom|dad|mother|father|partner|boyfriend|girlfriend|friend|brother|sister|wife|husband|work|boss|job|exam|interview|school|college|health|sleep|breakup|divorce)\b/);
    return match?.[0] ?? null;
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
    const isGreeting = /^(hi|hello|hey|hiya|howdy|heya|yo|sup|wassup|greetings|namaste|namaskar|helo|hii|hihi|hiii)$/.test(trimmedLower);
    const isHowAreYou = /^(how are (you|u)|how r (you|u)|how do (you|u) feel|you okay|u okay|are you okay|r u okay|how's it going|how is it going|hows it going|what's up|whats up|wats up|wazup)$/.test(trimmedLower);
    const isAboutImotara = /^(what (are|r) (you|u) (doing|upto|up to)|where (do|did) (you|u) (live|stay|come from)|who are (you|u)|what (is|r) (your|ur) (name|home|place)|tell me about yourself|introduce yourself|are you (an ai|a bot|a robot)|are you real|are you human)$/.test(trimmedLower);

    if (language === "en" && (isGreeting || isHowAreYou || isAboutImotara)) {
        const greetingReplies = [
            `Hey! Glad you stopped by. How are you doing today?`,
            `Hi there! I'm here and all yours. What's on your mind?`,
            `Hello! It's good to hear from you. How are you feeling right now?`,
            `Hey — good to see you. How's your day going so far?`,
            `Hi! I've been thinking about you. How are things with you today?`,
        ];
        const howAreYouReplies = [
            `I'm doing well — thank you for asking! More importantly, how are you feeling today?`,
            `I'm here and present, which feels good. How about you — what's going on in your world right now?`,
            `I'm good! I'm always better when someone reaches out. How are you doing?`,
            `Honestly, I feel most alive in conversations like this. How are you holding up?`,
        ];
        const aboutImotaraReplies = [
            `I'm Imotara — a companion here to listen and be with you through whatever you're feeling. I don't have a physical home, but I'm always here when you need to talk. What's on your mind?`,
            `I'm your emotional companion — always here, always listening. I don't live anywhere specific, but this space between us is where I exist. What would you like to share today?`,
            `I'm Imotara, here to be a steady presence for you. Think of me as a friend who's always available, no matter the time. How can I be here for you right now?`,
        ];
        const pool = isAboutImotara ? aboutImotaraReplies : isHowAreYou ? howAreYouReplies : greetingReplies;
        const greetSeed = hash32(`${message}::${language}::${sessionTurn}::greeting`);
        const reply = pickAvoidingRecent(pool, greetSeed, recentContext?.recentAssistantTexts ?? []);
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
            `I hear you — let's sit with this for a moment.`,
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
            `Alright — let's figure out what matters most right now.`,
            `Let's think through this together.`,
            `That's a real situation. Let's work through it.`,
        ],
        coach: [
            `Okay — let's work through this together.`,
            `Got it. We can take this step by step.`,
            `That's real. Let's get our footing and start from here.`,
            `I hear you. Let's figure out where to begin.`,
            `You've got more in you than you think right now.`,
        ],
        "gentle-humor": [
            `Okay, I'm with you.`,
            `Noted — and I mean that genuinely.`,
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
        calm: [`Main yahin hoon.`, `Chalo ise dheere se dekhte hain.`, `Theek hai. Hum ise aaraam se lete hain.`, `Main tumhare saath hoon. Ek ek hissa dekhte hain.`],
        supportive: [`Main tumhare saath hoon.`, `Main sun raha hoon.`, `Theek hai — main yahin hoon.`, `Achha hua tumne bataya.`, `Samajh gaya. Main sun raha hoon.`],
        practical: [`Theek hai. Chalo ise saaf nazar se dekhte hain.`, `Samajh gaya. Isse ek ek step mein lete hain.`, `Chalo ise sambhalte hain aur dekhte hain kya sabse zaroori hai.`, `Main saath hoon. Ise simple rakhte hain.`],
        coach: [`Theek hai — main saath hoon. Pehle isse sambhalte hain.`, `Samajh gaya. Hum ise step by step nikalenge.`, `Chalo thoda dheere hote hain aur footing pakadte hain.`, `Main sun raha hoon. Ise ek ek hissa dekhte hain.`],
        "gentle-humor": [`Theek hai — main yahin hoon.`, `Hmm, sun raha hoon.`, `Samajh gaya. Main saath hoon.`, `Chalo, ise thoda halka banate hain — ek chhota step karke.`],
        direct: [`Theek hai. Main saath hoon.`, `Chalo isse seedhe dekhte hain.`, `Samajh gaya. Ise stable rakhte hain.`, `Main sun raha hoon. Seedha mudde par aate hain.`],
    };

    const openersByToneBn: Record<LocalResponseTone, string[]> = {
        calm: [`Ami achhi tomar sathe.`, `Cholo eta aste aste dekhi.`, `Thik ache. Eta narm bhabe nei.`, `Ami tomar sathe achhi. Ek ek kore dekhi.`],
        supportive: [`Ami tomar sathe achhi.`, `Ami shunchi.`, `Thik ache — ami ekhanei achhi.`, `Bhalo korecho je bolechho.`, `Bujhte parchi.`],
        practical: [`Thik ache. Cholo eta porishkar bhabe dekhi.`, `Bujhlam. Eta ek ek step e nebo.`, `Cholo eta sambhalai aar dekhi ki beshi joruri.`, `Ami achhi. Eta simple rakhi.`],
        coach: [`Thik ache — ami achhi. Age eta steady kori.`, `Bujhlam. Eta step by step niye jabo.`, `Cholo ektu aste hoye footing ta dhori.`, `Ami shunchi. Eta ek ek kore dekhi.`],
        "gentle-humor": [`Thik ache — ami achhi.`, `Hmm, ami shunchi.`, `Bujhlam. Ami ekhanei achhi.`, `Cholo eta ektu halka kore nei — ekta chhoto step diye.`],
        direct: [`Thik ache. Ami achhi.`, `Cholo eta sojha bhabe dekhi.`, `Bujhlam. Eta steady rakhi.`, `Ami shunchi. Sojha kothay asi.`],
    };

    const openersByToneTa: Record<LocalResponseTone, string[]> = {
        calm: [`Naan un kooda irukken.`, `Idha konjam nidhana ma paakalam.`, `Sari. Idha mellaga eduthukalam.`, `Naan un kooda irukken. Oru oru paguthiya paakalam.`],
        supportive: [`Naan un kooda irukken.`, `Naan ketkaren.`, `Sari — naan inga irukken.`, `Nee sonnadhu nalladhu.`, `Purinjidhu.`],
        practical: [`Sari. Idha clear aa paakalam.`, `Purinjidhu. Idha step by step eduthukalam.`, `Idha konjam steady pannitu mukkiyama irukkaradhu paakalam.`, `Naan kooda irukken. Idha simple aa vaikkalam.`],
        coach: [`Sari — naan kooda irukken. Mothalla idha steady pannalam.`, `Purinjidhu. Idha step by step paathukalam.`, `Konjam nidhana ma poi footing pidikkalam.`, `Naan ketkaren. Oru oru paguthiya paakalam.`],
        "gentle-humor": [`Sari — naan inga irukken.`, `Hmm, naan ketkaren.`, `Purinjidhu. Naan kooda irukken.`, `Idha konjam light aa eduthukalam — oru chinna step la.`],
        direct: [`Sari. Naan kooda irukken.`, `Idha straight aa paakalam.`, `Purinjidhu. Idha steady aa vaikkalam.`, `Naan ketkaren. Neraya sutti podaama point ku varalam.`],
    };

    const openersByToneTe: Record<LocalResponseTone, string[]> = {
        calm: [`Nenu nee tho unnaanu.`, `Idi konchem mellaga chuddam.`, `Sare. Idi mellaga teesukundam.`, `Nenu nee tho unnaanu. Oka oka bhaagam ga chuddam.`],
        supportive: [`Nenu nee tho unnaanu.`, `Nenu vintunnaanu.`, `Sare — nenu ikkade unnaanu.`, `Nuvvu cheppadam manchidi.`, `Ardham ayyindi.`],
        practical: [`Sare. Idi clear ga chuddam.`, `Ardham ayyindi. Idi step by step teesukundam.`, `Idi konchem steady chesi mukhyamaina vishayam chuddam.`, `Nenu nee tho unnaanu. Idi simple ga unchukundam.`],
        coach: [`Sare — nenu nee tho unnaanu. Mundu idi steady cheddam.`, `Ardham ayyindi. Idi step by step chuddam.`, `Konchem nidhana ga veldaam, footing pattukundam.`, `Nenu vintunnaanu. Oka oka bhaagam ga chuddam.`],
        "gentle-humor": [`Sare — nenu ikkade unnaanu.`, `Hmm, nenu vintunnaanu.`, `Ardham ayyindi. Nenu nee tho unnaanu.`, `Idi konchem light ga teesukundam — oka chinna step tho.`],
        direct: [`Sare. Nenu nee tho unnaanu.`, `Idi direct ga chuddam.`, `Ardham ayyindi. Idi steady ga unchukundam.`, `Nenu vintunnaanu. Sutralu lekunda point ki veddam.`],
    };

    const openersByToneGu: Record<LocalResponseTone, string[]> = {
        calm: [`Hu tara sathe chhu.`, `Chalo ane aaramthi joi aiye.`, `Saru chhe. Hum ek sathe laishu.`, `Hu tara sathe chhu. Ek ek vastu joi aiye.`],
        supportive: [`Hu tara sathe chhu.`, `Hu sanju chhu.`, `Saru — hu ahiya chhu.`, `Saru thayun ke tune kahu.`, `Samajh gayo.`],
        practical: [`Saru chhe. Chalo saf nazar e joi aiye.`, `Samajh gayo. Ek ek step e laiye.`, `Chalo joi aiye shu shu important chhe.`, `Hu sathe chhu. Sadu rakhi aiye.`],
        coach: [`Saru — hu sathe chhu. Pehla ane steady kariye.`, `Samajh gayo. Ase ek ek step e karshu.`, `Chalo thoda dhima thai ane footing pakdi aiye.`, `Hu sanju chhu. Ek ek bhag joi aiye.`],
        "gentle-humor": [`Saru — hu ahiya chhu.`, `Hmm, hu sanju chhu.`, `Samajh gayo. Hu sathe chhu.`, `Chalo, ane thoda halku banavi aiye — ek chhoto step karine.`],
        direct: [`Saru. Hu sathe chhu.`, `Chalo seedhu joi aiye.`, `Samajh gayo. Stable rakhi aiye.`, `Hu sanju chhu. Mudda par aaviye.`],
    };

    const openersByTonePa: Record<LocalResponseTone, string[]> = {
        calm: [`Main tere naal haan.`, `Chalo ise dheeray naal vekhiye.`, `Theek aa. Ise araam naal laiye.`, `Main tere naal haan. Ik ik hissa vekhiye.`],
        supportive: [`Main tere naal haan.`, `Main sun raha haan.`, `Theek aa — main ithey haan.`, `Changa kita ke dassia.`, `Samajh gaya.`],
        practical: [`Theek aa. Chalo ise saaf nazar naal vekhiye.`, `Samajh gaya. Ise ik ik step wich laiye.`, `Chalo sambhaalie te vekhiye ki sabton zaruri aa.`, `Main saath haan. Ise simple rakhiye.`],
        coach: [`Theek aa — main saath haan. Pehlan ise steady kariye.`, `Samajh gaya. Ase ise step by step kaddhange.`, `Chalo thoda dhimi ho ke footing pakdiye.`, `Main sun raha haan. Ik ik hissa vekhiye.`],
        "gentle-humor": [`Theek aa — main ithey haan.`, `Hmm, main sun raha haan.`, `Samajh gaya. Main saath haan.`, `Chalo, ise thoda halka karie — ik chhoti step karke.`],
        direct: [`Theek aa. Main saath haan.`, `Chalo ise seedha vekhiye.`, `Samajh gaya. Ise stable rakhiye.`, `Main sun raha haan. Seedha mudde te aaiye.`],
    };

    const openersByToneKn: Record<LocalResponseTone, string[]> = {
        calm: [`Naanu ninna jote iddene.`, `Idannu mellage nodona.`, `Sari. Idannu aaramaagi teedukonona.`, `Naanu ninna jote iddene. Ondondu bhagavagi nodona.`],
        supportive: [`Naanu ninna jote iddene.`, `Naanu kelutiddene.`, `Sari — naanu illi iddene.`, `Neevu heltiru, adhu olledhu.`, `Artha aagide.`],
        practical: [`Sari. Idannu sparshtavaagi nodona.`, `Artha aagide. Idannu step by step teedukonona.`, `Idannu steady maadi mukhyavaada vishaya nodona.`, `Naanu ninna jote iddene. Idannu sarala maadona.`],
        coach: [`Sari — naanu ninna jote iddene. Munche idannu steady maadona.`, `Artha aagide. Idannu step by step nodona.`, `Konjam mellage hogi footing hidukona.`, `Naanu kelutiddene. Ondondu bhagavagi nodona.`],
        "gentle-humor": [`Sari — naanu illi iddene.`, `Hmm, naanu kelutiddene.`, `Artha aagide. Naanu ninna jote iddene.`, `Idannu konjam light aagi teedukonona — ondu chikka step allige.`],
        direct: [`Sari. Naanu ninna jote iddene.`, `Idannu nera nodona.`, `Artha aagide. Idannu steady aagi irisi.`, `Naanu kelutiddene. Suttamuttinu hogade point ge barona.`],
    };

    const openersByToneMl: Record<LocalResponseTone, string[]> = {
        calm: [`Njaan ninnooppam undu.`, `Idi mellage nokkaam.`, `Sari. Idi mellage eettukol.`, `Njaan ninnooppam undu. Ore ore bhagamayi nokkaam.`],
        supportive: [`Njaan ninnooppam undu.`, `Njaan kekkunnundu.`, `Sari — njaan ippol unda.`, `Nee paranjathu nallathayi.`, `Manahsilaayi.`],
        practical: [`Sari. Idi vyakthamayi nokkaam.`, `Manahsilaayi. Idi step by step eettukol.`, `Idi steady aakki muhyamaya vishayam nokkaam.`, `Njaan koode undu. Idi saralamaakkaam.`],
        coach: [`Sari — njaan ninnooppam undu. Munpe idi steady aakkaam.`, `Manahsilaayi. Idi step by step nokkaam.`, `Konjam mellage poyittu footing kittaam.`, `Njaan kekkunnundu. Ore ore bhagamayi nokkaam.`],
        "gentle-humor": [`Sari — njaan ippol unda.`, `Hmm, njaan kekkunnundu.`, `Manahsilaayi. Njaan ninnooppam undu.`, `Idi konjam light aakki eettukol — oru chinna step aayi.`],
        direct: [`Sari. Njaan ninnooppam undu.`, `Idi nerey nokkaam.`, `Manahsilaayi. Idi steady aakki vekkunna.`, `Njaan kekkunnundu. Neri karyathilekku varaam.`],
    };

    const openersByToneOr: Record<LocalResponseTone, string[]> = {
        calm: [`Mu tumara saathire achi.`, `Aau dheere dheere eitaaku bhabhibu.`, `Thik achi. Aau sthire lubu.`, `Mu tumara saathire achi. Ek ek hissa dekhibu.`],
        supportive: [`Mu tumara saathire achi.`, `Mu shunuchi.`, `Thik achi — mu eithire achi.`, `Bhala hela je tume kaile.`, `Bujhiparichhi.`],
        practical: [`Thik achi. Aau spashta bhavare dekhibu.`, `Bujhiparichhi. Eitaaku ek ek step re neibaa.`, `Aau eitaaku steady kariba o kichi muhya jinisha dekhibu.`, `Mu saathire achi. Eitaaku sahaja rakhiba.`],
        coach: [`Thik achi — mu saathire achi. Agau eitaaku steady kariba.`, `Bujhiparichhi. Aase eitaaku step by step nibu.`, `Aau dheere hoi footing dhibu.`, `Mu shunuchi. Ek ek hissa dekhibu.`],
        "gentle-humor": [`Thik achi — mu eithire achi.`, `Hmm, mu shunuchi.`, `Bujhiparichhi. Mu saathire achi.`, `Aau, eitaaku thoda halka kariba — ek chota step boli.`],
        direct: [`Thik achi. Mu saathire achi.`, `Aau seedha dekhibu.`, `Bujhiparichhi. Eitaaku stable rakhiba.`, `Mu shunuchi. Seedha mudra kuu aasibu.`],
    };

    const openersByToneMr: Record<LocalResponseTone, string[]> = {
        calm: [`Mi ithe aahe.`, `Chala he haluhalu gheuya.`, `Theek aahe. He aaramaat gheuya.`, `Mi tuzhyasobat aahe. Ek ek bhaag pahilya.`],
        supportive: [`Mi ithe aahe.`, `Mi aikto aahe.`, `Theek aahe — mi itheche aahe.`, `Barabar kela sangitles.`, `Samajla.`],
        practical: [`Theek aahe. He spashta nazar ne pahilya.`, `Samajla. He step by step gheuya.`, `Chala sambalto ani baghto kashacha mahattva aahe.`, `Mi sobat aahe. He saral thauvuya.`],
        coach: [`Theek aahe — mi sobat aahe. Aadhi he steady karuya.`, `Samajla. He step by step kadhilya.`, `Thoda savakaash houn footing dharuya.`, `Mi aikto aahe. Ek ek bhaag pahilya.`],
        "gentle-humor": [`Theek aahe — mi ithe aahe.`, `Hmm, mi aikto aahe.`, `Samajla. Mi sobat aahe.`, `Chala, he thoda halke karuya — ek chhota step karun.`],
        direct: [`Theek aahe. Mi sobat aahe.`, `Chala he seedhya nazar ne pahilya.`, `Samajla. He steady thauvuya.`, `Mi aikto aahe. Seedhya muddevar yeuya.`],
    };

    // ── Validation banks ──────────────────────────────────────────────────────

    type Signal = "sad" | "anxious" | "angry" | "tired" | "okay";

    const validationsEn: Record<Signal, string[]> = {
        sad: [`That sounds heavy.`, `That can really hurt.`, `I'm sorry you're carrying that.`, `That's a lot to sit with.`],
        anxious: [`That sounds like your mind is running fast.`, `That kind of pressure can feel loud.`, `It makes sense you'd feel tense with that.`, `That overwhelm feeling is real.`],
        angry: [`That sounds frustrating.`, `I can see how that would irritate you.`, `That would get under anyone's skin.`, `Yeah — that's a rough feeling.`],
        tired: [`That sounds draining.`, `No wonder you feel worn out.`, `That kind of tired can build up.`, `That's a lot of load for one day.`],
        okay: [
            `Tell me a little more — I want to understand.`,
            `What's been sitting heaviest on your mind lately?`,
            `What's going on for you right now?`,
            `I'm curious — what made you reach out today?`,
            `What's the one thing that feels most present right now?`,
            `Walk me through what you've been feeling.`,
        ],
    };

    const carryValidationsEn = [
        `I can feel this is still sitting with you.`, `This sounds like it is still weighing on you.`,
        `I'm still with the thread of what you're carrying.`, `It seems this is still heavy in the background.`,
    ];

    const validationsHi: Record<Signal, string[]> = {
        sad: [`Yeh kaafi bhaari lag raha hai.`, `Yeh sach mein chot pahucha sakta hai.`, `Mujhe afsos hai ki tum yeh sab utha rahe ho.`, `Yeh kaafi zyada hai saath le kar chalne ke liye.`],
        anxious: [`Lag raha hai dimaag bahut tez chal raha hai.`, `Is tarah ka pressure kaafi loud lag sakta hai.`, `Aise mein tense feel hona bilkul samajh aata hai.`, `Yeh overwhelm waali feeling sach hoti hai.`],
        angry: [`Yeh kaafi frustrating lag raha hai.`, `Samajh sakta hoon yeh irritate karega.`, `Yeh kisi ke bhi skin ke neeche chala jaaye.`, `Haan — yeh rough feeling hai.`],
        tired: [`Yeh kaafi draining lag raha hai.`, `Isliye tum itna worn out feel kar rahe ho, yeh samajh aata hai.`, `Is tarah ki thakan jama hoti jaati hai.`, `Ek din ke liye yeh kaafi zyada load hai.`],
        okay: [`Thoda aur batao.`, `Main saath hoon — kya chal raha hai?`, `Main sun raha hoon. Abhi tumhare andar sabse zyada kya baitha hai?`, `Theek hai. Abhi dimaag mein sabse badi baat kya hai?`],
    };
    const carryValidationsHi = [`Lag raha hai yeh baat abhi bhi tumhare andar baithi hui hai.`, `Yeh abhi bhi tum par bhaari si tikki hui lag rahi hai.`, `Jo tum utha rahe ho, uska thread abhi bhi chal raha hai.`, `Lagta hai yeh baat pichhe se abhi bhi weight de rahi hai.`];

    const validationsBn: Record<Signal, string[]> = {
        sad: [`Eta onek bhaari lagchhe.`, `Eta khub kosto dite pare.`, `Dukkho lagchhe je tomake eta niye cholte hochhe.`, `Eta bose thakar jonno onekta.`],
        anxious: [`Mone hochhe mathata khub taratari cholchhe.`, `Erokom pressure khub jore mone hote pare.`, `Erokom obosthay tense lagata shobhabik.`, `Ei overwhelm er feeling ta khub real.`],
        angry: [`Eta khub frustrating lagchhe.`, `Bujhte parchi eta irritate korte pare.`, `Eta karoroi kharap lagte parto.`, `Haan — eta rough feeling.`],
        tired: [`Eta khub draining lagchhe.`, `Tai eto klanto lagchhe, eta bujhte parchi.`, `Erokom klanti jome jete pare.`, `Ek diner jonno eta onekta load.`],
        okay: [`Aro ektu bolo.`, `Ki hochhe ektu bolbe?`, `Ekhon tomar modhye shobcheye beshi ki bose ache?`, `Ekhon mathay shobcheye boro kotha ta ki?`],
    };
    const carryValidationsBn = [`Mone hochhe eta ekhono tomar moddhe bose ache.`, `Eta ekhono pichhone theke weight dicche mone hochhe.`, `Tumi ja niye cholchho, tar thread ta ekhono cholche.`, `Mone hochhe kothata ekhono bhitor theke bhaari kore rekhechhe.`];

    const validationsTa: Record<Signal, string[]> = {
        sad: [`Idhu romba heavy aa irukku pola.`, `Idhu unakku kastama irukkalam.`, `Idha nee sumandhuttu irukkaradhu kashtam nu puriyudhu.`, `Idhu neraya sumai maari theriyudhu.`],
        anxious: [`Un manasu romba vegama odudhu pola theriyudhu.`, `Indha maadhiri pressure romba loud aa thonalaam.`, `Ippadi irundha tense aa feel panna saadharanam.`, `Indha overwhelm feeling nijam dhan.`],
        angry: [`Idhu romba frustrating aa theriyudhu.`, `Idhu kovam varra maadhiri irukku nu puriyudhu.`, `Yaarukkum idhu kashtama thonum.`, `Aama — idhu rough feeling dhan.`],
        tired: [`Idhu romba draining aa theriyudhu.`, `Adhan nee ivlo tired aa irukka pola.`, `Indha maadhiri saerndhu tiredness varalam.`, `Oru naalukku idhu romba load.`],
        okay: [`Konjam innum sollu.`, `Enna nadakkudhu konjam solluva?`, `Ippo unakku ullae romba weight aa irukkiradhu enna?`, `Ippo un manasula mukkiyama irukkira vishayam enna?`],
    };

    const validationsTe: Record<Signal, string[]> = {
        sad: [`Idi chaala bhaaranga anipistondi.`, `Idi neeku kashtam ga undochu.`, `Idi nee meeda chaala bharam laga undi ani ardham avutondi.`, `Idi chaala load la anipistondi.`],
        anxious: [`Nee manasu chaala veganga parigedutundi anipistondi.`, `Ilaanti pressure chaala loud ga anipinchachu.`, `Ila unte tense ga feel avvadam saadharanam.`, `Idi overwhelm feeling nijam ga untundi.`],
        angry: [`Idi chaala frustrating ga undi anipistondi.`, `Idi kopam teppinche vishayam ani ardham avutondi.`, `Evarikaina idi kastam ga anipinchachu.`, `Avunu — idi rough feeling.`],
        tired: [`Idi chaala draining ga anipistondi.`, `Anduke nuvvu inta tired ga unnattu anipistondi.`, `Ilaanti alasyam kalisi peruguthundi.`, `Oka rojuki idi chaala load.`],
        okay: [`Konchem inka cheppu.`, `Em jarugutundo konchem chepthava?`, `Ippudu nee lo ekkuvaga bharam ga anipistondi enti?`, `Ippudu nee manasulo mukhyamaina vishayam enti?`],
    };

    const validationsGu: Record<Signal, string[]> = {
        sad: [`Aa kaafi bhari laage chhe.`, `Aa sach ma dard aapo chhe.`, `Mane dukh chhe ke tu aanu sahu uthi rahyo chhe.`, `Aana sathe besi rahevun mushkel chhe.`],
        anxious: [`Laage chhe dimaag bahut tez chale chhe.`, `Evo pressure kaafi loud laagi shaake chhe.`, `Aa rite tense feel thavun samjhay chhe.`, `Aa overwhelm ni feeling sachi chhe.`],
        angry: [`Aa kaafi frustrating laage chhe.`, `Samjhay chhe aa irritate kartu.`, `Koine pann aa kharab laagtu.`, `Ha — aa rough feeling chhe.`],
        tired: [`Aa kaafi draining laage chhe.`, `Etle tu itno thakelo feel kare chhe, aa samjhay chhe.`, `Aaval thakan jama thai shaake chhe.`, `Ek dinne mate aa kaafi load chhe.`],
        okay: [`Vadhare keh.`, `Shu thayi rahyun chhe?`, `Abhi tamne andar shu vadhu vaagtu chhe?`, `Abhi dimag ma moti vaat shu chhe?`],
    };
    const carryValidationsGu = [`Laage chhe aa vaat abhi pann tamara maata basi reheli chhe.`, `Aa abhi pann tujh par bhari lagti laage chhe.`, `Tu jo utha rahyo chhe tenu thread abhi pann chale chhe.`, `Laage chhe aa vaat aandharathi haji bhari rakheli chhe.`];

    const validationsPa: Record<Signal, string[]> = {
        sad: [`Eh kaafi bhaari lagda aa.`, `Eh sach mein chot pauncha sakda aa.`, `Mujhe afsos aa ke tu eh sab chuk raha aa.`, `Eh kaafi zyada aa saath lai ke chalan layi.`],
        anxious: [`Laggda aa dimaag bahut tez chal raha aa.`, `Aiho pressure kaafi loud lagg sakda aa.`, `Ais tarah tense feel karna samajh aunda aa.`, `Eh overwhelm waali feeling sach hundi aa.`],
        angry: [`Eh kaafi frustrating lagda aa.`, `Samajh sakda haan eh irritate kare.`, `Kisi nu vi eh bura laggda.`, `Haan — eh rough feeling aa.`],
        tired: [`Eh kaafi draining lagda aa.`, `Ehi kaaran tu itna thakya feel kar raha aa, eh samajh aunda aa.`, `Eh tarah di thakan jamdi jaandi aa.`, `Ik din layi eh kaafi zyada load aa.`],
        okay: [`Thoda hor dass.`, `Ki ho raha aa?`, `Abhi tere andar sabton bhari ki gall aa?`, `Abhi dimag wich sabton vaddi gall ki aa?`],
    };
    const carryValidationsPa = [`Laggda aa eh gall abhi vi tere andar baithi hui aa.`, `Eh abhi vi tere utte bhaari tikki lagdi aa.`, `Jo tu chuk raha aa uska thread abhi vi chal raha aa.`, `Laggda aa eh gall pichhon abhi vi bhaari kar rahi aa.`];

    const validationsKn: Record<Signal, string[]> = {
        sad: [`Idu tumba bhaaravaagide eniste.`, `Idu ninage kashta kodabahudu.`, `Neevu idannu hotti kondu hogi iruvudu kashta anta artha aagide.`, `Idannu hotti iruvudu tumba hejje.`],
        anxious: [`Manas tumba vegaagi odutide eniste.`, `Ee tarahad pressure tumba loud aagi anisabahudu.`, `Heege iruvaga tense aagi feel aaguvudu sahajavendre.`, `Ee overwhelm bhavane nijavaagide.`],
        angry: [`Idu tumba frustrating aagi ide eniste.`, `Idu kopava tararuva haagide anta artha aagide.`, `Yarigaadaru idu kashta aagi anisabahudu.`, `Haaunu — idu rough feeling.`],
        tired: [`Idu tumba draining aagi ide eniste.`, `Adakke neeve ivvali tired aagi ide, adu artha aagide.`, `Ee tarahad doni serkuttiruttade.`, `Ondu dinakke idu tumba load.`],
        okay: [`Konjam innu heli.`, `Enu aaguttide konjam helutteeraa?`, `Ippudu ninna olage tumba bhaaraagi iruvudu yenu?`, `Ippudu ninna manassalliruva mukhya vishaya yenu?`],
    };
    const carryValidationsKn = [`Ee vishaya ippudu ninna olage iruttide anta anisuttide.`, `Idu ippudu ninna meele bhaara aagi iruttide eniste.`, `Neevu hotti hoguttiruvudu, aa thread ippudu iruttide.`, `Ee vishaya hendadininda ippudu bhaara aagi iruttide eniste.`];

    const validationsMl: Record<Signal, string[]> = {
        sad: [`Idi valare bhaaram aayi thoannunnundu.`, `Idi ninnekku kashtam tharaam.`, `Nee idi vechi nadennanonnu ariyaam, athi kashtam.`, `Idi ithreyum sumai aayi thoannunnundu.`],
        anxious: [`Manassu valare vegathil odunnathupole thoannunnundu.`, `Itha maadhiri pressure valare loud aakkanam.`, `Ingane irikkumbol tense aaka saadharanacheyam.`, `Itha overwhelm aaya feeling satyamaanu.`],
        angry: [`Idi valare frustrating aayi thoannunnundu.`, `Idi kopam undakkumenna ariyaam.`, `Aarkku aanu idi kashtam aakkathe.`, `Athe — idi rough feeling aanu.`],
        tired: [`Idi valare draining aayi thoannunnundu.`, `Athu kondu nee ivvali tired aayittunnu enna ariyaam.`, `Ith maathiri thazharcha koodi varaam.`, `Oru divasathekku idi valare erichal.`],
        okay: [`Konjam koodi para.`, `Enthu nadakkunnu?`, `Ippol ninnil koodu bhaaram aayi thoannunnnathu enthanu?`, `Ippol ninte manassilulla muhyamaya vishayam enthanu?`],
    };
    const carryValidationsMl = [`Ith vishayam ippozhu ninnile thanneyundu enna thoannunnundu.`, `Idi ippozhu ninnil bhaaram aayi nilkkunnathu poleya.`, `Nee vechi nadakkunnath, aa thread ippol nilkkunnu.`, `Ith vishayam appuzhathekkaalu ippol koodu bhaaram tharunnupole thoannunnundu.`];

    const validationsOr: Record<Signal, string[]> = {
        sad: [`Aitaa onek bhaaree laaguchhi.`, `Aitaa sata mane kashta dii paaré.`, `Dukha laguchhi je tume aitaa bahi chaaluchha.`, `Aitaa niei basi rahiba onek.`],
        anxious: [`Laaguchhi mathaa bahuta teza chalichhi.`, `Saéhi prakaarara pressure bahuta loud laagi paaré.`, `Eiéhi samayare tense feel kara sahaja.`, `Eitaa overwhelm er feeling satya.`],
        angry: [`Aitaa onek frustrating laaguchhi.`, `Bujhipaarichhi aitaa irritate kariba.`, `Kebhali aitaa khaarap laagibaa.`, `Haan — aitaa rough feeling.`],
        tired: [`Aitaa onek draining laaguchhi.`, `Taei tume ita thaka feel karuchha, aitaa bujhipaarichhi.`, `Eitaa prakaarara thakaa jama hue paaré.`, `Ek dina paain aitaa bahuta load.`],
        okay: [`Aaru thoda kahe.`, `Ki heuuchhi?`, `Ebe tumara bhitare sab cheye beshi ki bujhi laaguchhi?`, `Ebe mathare sab cheye bada kotha ta ki?`],
    };
    const carryValidationsOr = [`Laaguchhi eitaa kotha ekhana bhi tumara bhitare besii achi.`, `Eitaa ekhana bhi tumara upare bhari laaguchhi boli mane huchhi.`, `Tume jo bahi chaluchha, sei thread ekhana chaluchhi.`, `Laaguchhi eitaa kotha paachharu ekhana bhi bhari karuchhi.`];

    const validationsMr: Record<Signal, string[]> = {
        sad: [`He khupach jad vaatate.`, `He khare dukh deu shakate.`, `Mala vaait vaatate ki tu he sagle sahan kartoys.`, `Asa bharlelay asna khupach khatraak aahe.`],
        anxious: [`Vaatatey dokyat khup vaeg aahe.`, `Itka pressure khup loud vaatato.`, `Asha pressaremadhe tense vatane saajik aahe.`, `He overwhelm chi feeling khare aahe.`],
        angry: [`He khupach frustrating vaatate.`, `He irritate karaycha kaaran aahe he samajhate.`, `Konalaahi he bure vaatale aste.`, `Ho — hi rough feeling aahe.`],
        tired: [`He khupach draining vaatate.`, `Tyamule tu itka thaklelya vaatatos, te samajhate.`, `Ashi thakan jama hote.`, `Ek divasasaathi he khupach load aahe.`],
        okay: [`Adhik saang.`, `Kaay chaallu aahe?`, `Ata tujhyaat kaay jast bhaarite aahe?`, `Ata dokyat saglyyaat motha kaay aahe?`],
    };
    const carryValidationsMr = [`Hi goshta ata pun tujhyat basi ahe ase vaatate.`, `He ata pun tujhyavar jad aahe ase vaatate.`, `Tu kaay sahan kartoys, tya thread ata pun chalu aahe.`, `Hi goshta aadhi peksha ata jast jad vaatate ase distate.`];

    // ── Extras banks ──────────────────────────────────────────────────────────

    const extrasByToneEn: Record<LocalResponseTone, string[]> = {
        calm: [``, `We can stay with one part for now.`, `No need to rush the whole thing.`, `We can keep this steady without forcing it.`],
        supportive: [``, `You do not have to carry the whole weight at once.`, `We can stay with what feels heaviest first.`, `It is okay if this still feels messy.`],
        practical: [``, `Let's only look at what matters first.`, `We can keep this workable.`, `One useful piece is enough for now.`],
        coach: [``, `Let's find the most workable part first.`, `We only need one steady move right now.`, `You do not need to untangle everything at once.`],
        "gentle-humor": [``, `We can keep this a little lighter without ignoring it.`, `One small shift is enough for now.`, `I'm still right here with you.`],
        direct: [``, `Let's keep this clear.`, `We can deal with one real part at a time.`, `Only the next useful piece matters right now.`],
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
        calm: [``, `Abhi sirf ek hissa pakad kar chal sakte hain.`, `Puri baat ko ek saath sambhalne ki jaldi nahi hai.`, `Ise bina force kiye steady rakha ja sakta hai.`],
        supportive: [``, `Tumhe sab kuch ek saath uthana nahi hai.`, `Jo sabse bhaari lag raha hai, pehle usi ke saath reh sakte hain.`, `Agar sab kuch abhi bhi uljha lag raha hai, tab bhi theek hai.`],
        practical: [``, `Chalo pehle wahi dekhte hain jo sabse zaroori hai.`, `Ise manageable rakh sakte hain.`, `Abhi ek kaam ki cheez dekhna kaafi hai.`],
        coach: [``, `Chalo pehle sabse workable hissa dhoondte hain.`, `Abhi sirf ek steady move kaafi hai.`, `Tumhe sab kuch ek saath suljhana nahi hai.`],
        "gentle-humor": [``, `Ise halka rakh sakte hain bina ignore kiye.`, `Abhi ek chhota shift kaafi hai.`, `Main yahin hoon tumhare saath.`],
        direct: [``, `Chalo ise saaf rakhte hain.`, `Hum ek real hissa ek baar mein dekh sakte hain.`, `Abhi bas agla useful hissa kaafi hai.`],
    };
    const carryExtrasHi: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne ki zarurat nahi hai.`, `Hum bas thodi der iske saath reh sakte hain.`],
        supportive: [`Tumhe ise perfectly samjhana abhi zaruri nahi hai.`, `Main abhi bhi tumhare saath hoon isme.`],
        practical: [`Abhi ise simple rakhte hain.`, `Humein poora jawab nahi, bas agla saaf hissa dekhna hai.`],
        coach: [`Kuch karne se pehle ise steady kar lete hain.`, `Baad mein ek grounded step kaafi hoga.`],
        "gentle-humor": [`Ise halka rakh sakte hain bina uljhaaye.`, `Abhi poori kushti ladne ki zarurat nahi hai.`],
        direct: [`Abhi ise overcomplicate nahi karte.`, `Pehle real hissa pakadte hain.`],
    };

    const extrasByToneBn: Record<LocalResponseTone, string[]> = {
        calm: [``, `এখন শুধু একটা অংশ ধরে থাকলেই হবে।`, `সবকিছু একসাথে সামলানোর তাড়া নেই।`, `এটাকে জোর না করে steady রাখা যায়।`],
        supportive: [``, `তোমাকে সবটা একসাথে বয়ে নিতে হবে না।`, `যেটা সবচেয়ে ভারী লাগছে, আগে সেটার সঙ্গেই থাকি।`, `সবকিছু এখনও এলোমেলো লাগলে তাতেও সমস্যা নেই।`],
        practical: [``, `চলো আগে সবচেয়ে দরকারি অংশটাই দেখি।`, `এটাকে manageable রাখা যাবে।`, `এখন একটা কাজের জিনিস ধরলেই যথেষ্ট।`],
        coach: [``, `চলো আগে সবচেয়ে workable অংশটা খুঁজি।`, `এখন শুধু একটা steady move হলেই হবে।`, `সবটা একসাথে মেলাতে হবে না।`],
        "gentle-humor": [``, `এটাকে হালকা রাখা যায়, তবু সিরিয়াস থাকাও যাবে।`, `এখন একটা ছোট shift হলেই যথেষ্ট।`, `আমি এখানেই আছি তোমার সাথে।`],
        direct: [``, `চলো এটাকে পরিষ্কার রাখি।`, `একবারে একটা বাস্তব অংশ ধরা যায়।`, `এখন শুধু পরের useful অংশটাই যথেষ্ট।`],
    };
    const carryExtrasBn: Record<LocalResponseTone, string[]> = {
        calm: [`এটাকে এখনই কোথাও ঠেলে নিতে হবে না।`, `আমরা একটু সময় শুধু এটার সাথেই থাকতে পারি।`],
        supportive: [`এখনই একদম ঠিক করে বোঝাতে হবে না।`, `আমি এখনও তোমার সাথেই আছি এতে।`],
        practical: [`এখন এটাকে simple রাখি।`, `পুরো উত্তর না, শুধু পরের পরিষ্কার অংশটাই যথেষ্ট।`],
        coach: [`কিছু করার আগে এটাকে steady করি।`, `পরে একটা grounded step হলেই চলবে।`],
        "gentle-humor": [`এটাকে হালকা রাখা যায়, বেশি জট না বাড়িয়ে।`, `এখন পুরো কুস্তি লড়ার দরকার নেই।`],
        direct: [`এখন এটাকে overcomplicate না করি।`, `আগে বাস্তব অংশটাই ধরি।`],
    };

    const extrasByToneGu: Record<LocalResponseTone, string[]> = {
        calm: [``, `Haji sirf ek bhag pakadhine chal shakiye.`, `Badhi vat ek sathe sambhalvani jaldi nathi.`, `Ane bina force karya steady rakhay chhe.`],
        supportive: [``, `Tumari bhari vaatne thodi vaar baaju rakhi shakay.`, `Jo shu kaafi bhari laage chhe, pehla tenaa sathe rehiye.`, `Je abhi pann uljhelu laage, toh pann saru chhe.`],
        practical: [``, `Pehla jo shu zaroori chhe te joi aiye.`, `Ane manageable rakhay chhe.`, `Abhi ek kaam ni vaat jo puri chhe.`],
        coach: [``, `Chalo pehla shu workable chhe te dhundhi aiye.`, `Abhi faqt ek steady move kaafi chhe.`, `Bhadhu ek sathe suljhavanu nathi.`],
        "gentle-humor": [``, `Ane halku rakhi aiye ignore karyaa vina.`, `Abhi ek chhoto shift kaafi chhe.`, `Hu hun ahiya j chhu tara sathe.`],
        direct: [``, `Chalo saafu rakhi aiye.`, `Ek vaaste ek real bhag joi shakiye.`, `Abhi faqt aglu useful bhag kaafi chhe.`],
    };
    const carryExtrasGu: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne ni zarur nathi.`, `Hum bas thodi var eni sathe rahi shakiye.`],
        supportive: [`Tune ine perfectly samjhavanu abhi zaruri nathi.`, `Hu hun abhi pann tara sathe chhu.`],
        practical: [`Abhi ine simple rakhiye.`, `Pooru jawab nahi, bas aglu saafu bhag joie.`],
        coach: [`Kuch karva thi pehla ine steady kariye.`, `Baad ma ek grounded step kaafi thashe.`],
        "gentle-humor": [`Ine halka rakhi shakiye bina uljhavyaa.`, `Abhi bhadhi kushti ladva ni zarur nathi.`],
        direct: [`Abhi ine overcomplicate nathi karva.`, `Pehla real bhag pakadiye.`],
    };

    const extrasByTonePa: Record<LocalResponseTone, string[]> = {
        calm: [``, `Abhi sirf ik hissa pakad ke chal sakde haan.`, `Sab kuch ik saath sambhalan di jaldi nahi.`, `Ise bina force kite steady rakhaya ja sakda aa.`],
        supportive: [``, `Tenu sab kuch ik saath chukna nahi.`, `Jo sabton bhaari lagda aa, pehlan usi naal rehiye.`, `Je sab kuch abhi vi uljhya lagda aa, tenu vi theek aa.`],
        practical: [``, `Chalo pehlan jo sabton zaruri aa uh vekhiye.`, `Ise manageable rakhya ja sakda aa.`, `Abhi ik kaam di gall kaafi aa.`],
        coach: [``, `Chalo pehlan sabton workable hissa dhundhiye.`, `Abhi sirf ik steady move kaafi aa.`, `Tenu sab kuch ik saath suljhana nahi.`],
        "gentle-humor": [``, `Ise halka rakh sakde haan bina ignore kite.`, `Abhi ik chhoti shift kaafi aa.`, `Main ithey haan tere naal.`],
        direct: [``, `Chalo ise saaf rakhiye.`, `Hum ik real hissa ik vaar dekh sakde haan.`, `Abhi sirf agla useful hissa kaafi aa.`],
    };
    const carryExtrasPa: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne di lodd nahi.`, `Assi bas thodi der edi naal reh sakde haan.`],
        supportive: [`Tenu ise perfectly samjhana abhi zaruri nahi.`, `Main abhi vi tere naal haan eis wich.`],
        practical: [`Abhi ise simple rakhiye.`, `Poora jawab nahi, bas agla saaf hissa vekhna aa.`],
        coach: [`Kuch karan ton pehlan ise steady kar laiye.`, `Baad wich ik grounded step kaafi hoga.`],
        "gentle-humor": [`Ise halka rakh sakde haan bina uljhaye.`, `Abhi poori kushti ladne di lodd nahi.`],
        direct: [`Abhi ise overcomplicate nahi kariye.`, `Pehlan real hissa pakdiye.`],
    };

    const extrasByToneKn: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ippudu ondu bhagavannu maatrana hididi irona.`, `Ellavaannu ondu saarigu sambalisuvudakke avasaravilla.`, `Idannu olage thosikolaade steady aagi irisi.`],
        supportive: [``, `Neevu iddannu ellava ondu saarigu hotti hoguva avasaravilla.`, `Tumba bharavaagide anta anisuvudannu munche nodona.`, `Ippudu ella ella ulalaadittu hogi iddare, adu sari.`],
        practical: [``, `Munche yenu mukhya adu nodona.`, `Idannu manageable aagi irisi.`, `Ippudu ondu useful bhaga saalade.`],
        coach: [``, `Munche yenu kelsaadade ide adu kudukona.`, `Ippudu ondu steady move maatrana saalade.`, `Neevu ellava ondu saarigu helabeku anta illa.`],
        "gentle-humor": [``, `Idannu ignore maadade konjam light aagi teedukonona.`, `Ippudu ondu chikka shift saalade.`, `Naanu illi ninna jote iddene.`],
        direct: [``, `Idannu sparshta aagi irisi.`, `Ondu ondu real bhagavannu nodabahudu.`, `Ippudu munde useful bhaga maatrana beku.`],
    };
    const carryExtrasKn: Record<LocalResponseTone, string[]> = {
        calm: [`Ippudu idannu yaarigoo thosikolaada aasaravilla.`, `Naavuu koney koney idara jote irati irona.`],
        supportive: [`Neevu idannu perfectly samjhisabeku anta illa ippudu.`, `Naanu abhi ninna jote iddene.`],
        practical: [`Ippudu idannu simple aagi irisi.`, `Sampoorna uttara beda, munde sparshtavaada bhagavannu nodona.`],
        coach: [`Enu maaduvudakku munche idannu steady maadona.`, `Naantara ondu grounded step saalade.`],
        "gentle-humor": [`Idannu halka aagi irisi, tumba uljhi maadade.`, `Ippudu ellavannu oru saarigu helabeku anta illa.`],
        direct: [`Ippudu idannu overcomplicate maadabedi.`, `Munche real bhagavannu hidukona.`],
    };

    const extrasByToneMl: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ippol ore bhagam maathram nookunna.`, `Ella kaaryavum onnu kondu kazhikkanam enna avasaryamilla.`, `Idine mellage steady aakki vekkunna.`],
        supportive: [``, `Nee yellaatum onnu kondu vekkaathe.`, `Athi bhaaram aayi thoannunnath, ath aadhyam nokkaam.`, `Ippol yellaatum kuttippidikkunnathupole thoannal, athu sari.`],
        practical: [``, `Aadhyam enthu muhyamanu ath nokkaam.`, `Idine manageable aakki vekkunna.`, `Ippol oru useful bhagam maathram mathiyaakum.`],
        coach: [``, `Aadhyam enthu pradhaanam ath nokkaam.`, `Ippol ore steady move maathram mathiyaakum.`, `Yellaatum onnu kondu solve cheyyaanam enna avasaryamilla.`],
        "gentle-humor": [``, `Idine ignore cheyyaathe konjam light aakki nookaam.`, `Ippol oru chinna shift maathram mathiyaakum.`, `Njaan ippol ninnodoppam unda.`],
        direct: [``, `Idine vyakthamayi vekkunna.`, `Ore ore real bhagam nokkaam.`, `Ippol munnilulla useful bhagam maathram mathiyaakum.`],
    };
    const carryExtrasMl: Record<LocalResponseTone, string[]> = {
        calm: [`Ippol idine evidekkum thosikaanum avasaryamilla.`, `Njaan nee thodum koodeyuntaakum.`],
        supportive: [`Nee idine ippol perfectly paryanum enna avasaryamilla.`, `Njaan ippol ninnodum koode undu.`],
        practical: [`Ippol idine simple aakki vekkunna.`, `Sariyaaya uttharam venda, munnilulla vyakthamaaya bhagam maathram nokkaam.`],
        coach: [`Enthenkilum cheyyunnadhin munpe idine steady aakkaam.`, `Pinnaale oru grounded step mathiyaakum.`],
        "gentle-humor": [`Idine halka aakki vekkunna, koottappeduthathe.`, `Ippol ella kaaryavum oru saari cheyyanam enna ille.`],
        direct: [`Ippol idine overcomplicate aakkathe.`, `Munpe real bhagam hidukkunna.`],
    };

    const extrasByToneOr: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ebe kewal ek hissa dhari rahiparibaa.`, `Sab kichhu ek saathare sambhaalibara jaldi nahi.`, `Eitaaku bina force kara steady rakhibaaku heba.`],
        supportive: [``, `Tume saba kichu ek saathare bahi jibaa nahii.`, `Jo sab cheye bhari laaguchhi, taa saathire pehle rahiba.`, `Je sab kichhu ekhana bhi uljhaa laage, taa bhi thik.`],
        practical: [``, `Pehle jo sab cheye dorkari, taa dekhibaa.`, `Eitaaku manageable rakhiba.`, `Ebe ek kaama jinisha mattare sare.`],
        coach: [``, `Pehle sab cheye workable ta khoji dekhibaa.`, `Ebe kewal ek steady move sare.`, `Tume saba ek saathare suljhibaa nahii.`],
        "gentle-humor": [``, `Eitaaku ignore na kari thoda halka rakhiba.`, `Ebe ek chota shift sare.`, `Mu eithire achi tumara saathire.`],
        direct: [``, `Aau eitaaku spashta rakhiba.`, `Ek ek real hissa dekhihaaba.`, `Ebe kewal agla useful hissa sare.`],
    };
    const carryExtrasOr: Record<LocalResponseTone, string[]> = {
        calm: [`Ebe eitaaku kahinkuu thelibaa darkaara nahi.`, `Aame ektu samayara saathire rahi paribaa.`],
        supportive: [`Tume eitaaku ekhani perfectly bujhhaibaa darkaara nahi.`, `Mu ekhana bhi tumara saathire achi.`],
        practical: [`Ebe eitaaku simple rakhiba.`, `Sampurna uttar nahi, parer spashta hissa maatra.`],
        coach: [`Kichu kariba agau eitaaku steady kariba.`, `Paare ek grounded step sare.`],
        "gentle-humor": [`Eitaaku halka rakhiba, jyaada uljhana na kariba.`, `Ebe sab kichu ek saathare ladibar dorkar nahi.`],
        direct: [`Ebe eitaaku overcomplicate na kariba.`, `Agau real hissa dhabiba.`],
    };

    const extrasByToneMr: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ata faqt ek bhaag dharun chala shakato.`, `Sagle ek saath sambhalaychi ghai nahi.`, `He bina force karun steady thavata yete.`],
        supportive: [``, `Tula sagle ek saath uthaava laagat nahi.`, `Jo saglyyaat jad vaatate, tya barober rahilya.`, `Sagle ata pun guntaycha thi theek aahe.`],
        practical: [``, `Aadhi kaay saglyyaat mahattvaache aahe te pahilya.`, `He manageable thavta yete.`, `Ata ek kamaache goshta pahe jaane puresar aahe.`],
        coach: [``, `Aadhi saglyyaat workable bhaag shodhlya.`, `Ata faqt ek steady move puresar aahe.`, `Tula sagle ek saath sudhavayche nahi.`],
        "gentle-humor": [``, `He ignore na karta halke thavta yete.`, `Ata ek chhota shift puresar aahe.`, `Mi ithe tujhyasobat aahe.`],
        direct: [``, `Chala he spasht thauvuya.`, `Ek velela ek real bhaag pahata yeto.`, `Ata faqt pudha useful bhaag puresar aahe.`],
    };
    const carryExtrasMr: Record<LocalResponseTone, string[]> = {
        calm: [`Ata yaala kuthehi dhakalaaychi garj nahi.`, `Aapan thoda vel faqt yaच्याsobat rahu shakato.`],
        supportive: [`Tula he perfectly samjaavayche ata garj nahi.`, `Mi ata pun tujhyasobat aahe.`],
        practical: [`Ata he simple thauvuya.`, `Pura jaab nahi, faqt pudha spasht bhaag pahilya.`],
        coach: [`Kaahi karayla aadhi he steady karuya.`, `Nantar ek grounded step puresar hail.`],
        "gentle-humor": [`He halke thavta yete bina guntavit.`, `Ata puri kushti laadaaychi garj nahi.`],
        direct: [`Ata he overcomplicate karaayche nahi.`, `Aadhi real bhaag dharuya.`],
    };

    // ── Reflect / next-step lines ─────────────────────────────────────────────

    const reflectLinesEn = [
        `When you say "${(message || "").trim().slice(0, 120)}${(message || "").length > 120 ? "…" : ""}", what part feels strongest right now?`,
        `What's the part of this that feels most uncomfortable?`,
        `If we zoom in: what's the one detail that's bothering you most?`,
        `What do you wish was different about this situation?`,
    ];
    const reflectLinesHi = [
        `Jab tum kehte ho "${(message || "").trim().slice(0, 120)}${(message || "").length > 120 ? "…" : ""}", abhi sabse zyada kya mehsoos ho raha hai?`,
        `Isme sabse zyada uncomfortable kya lag raha hai?`,
        `Agar hum thoda zoom in karein, sabse zyada pareshaan kya kar raha hai?`,
        `Tum chahte ho is situation mein kya alag hota?`,
    ];
    const reflectLinesBn = [
        `Jokhon bolo "${(message || "").trim().slice(0, 120)}${(message || "").length > 120 ? "…" : ""}", ekhon shobcheye jore ki lagchhe?`,
        `Eitar modhye shobcheye beshi uncomfortable ki lagchhe?`,
        `Jodi ektu zoom in kori, shobcheye beshi ki jhamela dicchhe?`,
        `Tumi chaite e situation ta kivabe alada hoto?`,
    ];
    const nextStepLinesEn = [
        `Want comfort, clarity, or a next step?`,
        `Do you want to talk it out, or want something practical to do next?`,
        `Would it help to unpack it, or to pick one small action?`,
        `Should we focus on what you're feeling, or what you can do next?`,
    ];
    const nextStepLinesHi = [
        `Tumhe abhi comfort chahiye, clarity, ya next step?`,
        `Tum isse baat karke halka karna chahte ho, ya kuch practical next karna hai?`,
        `Kya isse khol kar dekhna madad karega, ya ek chhota action chunna?`,
        `Hum tumhari feeling par dhyan dein, ya agla kya kar sakte ho us par?`,
    ];
    const nextStepLinesBn = [
        `Ekhon tomar comfort dorkar, clarity, na ekta next step?`,
        `Tumi eta bole halka korte chao, na porer practical kichhu korte chao?`,
        `Eta ektu khule dekhle bhalo hobe, na ekta chhoto action neowa bhalo?`,
        `Amra tomar feeling e focus korbo, na porer ki korte paro setay?`,
    ];

    // ── Micro-story — disabled for local offline fallback ────────────────────────
    // Micro-stories can feel disconnected without the full AI context.
    // Keeping local fallback clean: opener + validation + extra only.
    const isEmotionalSignal = signal !== "okay";
    const storyLine = null;

    // ── Mythology story — disabled for local offline fallback ───────────────────
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
        validationsEn;

    const reflectLines =
        language === "hi" ? reflectLinesHi :
        language === "bn" ? reflectLinesBn :
        reflectLinesEn;

    const nextStepLines =
        language === "hi" ? nextStepLinesHi :
        language === "bn" ? nextStepLinesBn :
        nextStepLinesEn;

    const extrasByTone =
        language === "hi" ? extrasByToneHi :
        language === "mr" ? extrasByToneMr :
        language === "bn" ? extrasByToneBn :
        language === "gu" ? extrasByToneGu :
        language === "pa" ? extrasByTonePa :
        language === "kn" ? extrasByToneKn :
        language === "ml" ? extrasByToneMl :
        language === "or" ? extrasByToneOr :
        extrasByToneEn;

    const seedIntent = pick(["clarify", "reflect", "reframe"] as const, seed >>> 3);
    const prompt =
        seedIntent === "clarify" ? pick(nextStepLines, seed >>> 4) :
        seedIntent === "reflect" ? pick(reflectLines, seed >>> 4) :
        language === "hi" ? `Agar hum ise thoda narmi se reframe karein, kaunsi ek aur dayalu explanation sach ho sakti hai?` :
        language === "bn" ? `Jodi eta ektu narm bhabe reframe kori, tahole ar ekta dayalu byakkha ki hote pare?` :
        `If we reframe this gently: what's one kinder explanation that could also be true?`;

    // Correction repair prefix
    const correctionPrefixes: Partial<Record<string, string>> = {
        en: "Let me try that differently —",
        hi: "Chalo phir se samjhte hain —",
        mr: "Chala punaah samjhto —",
        bn: "Chalo abar bujhi —",
        ta: "Maarichchu paarkalam —",
        te: "Inkaa okasaari try cheddaam —",
        gu: "Chalo pharthi samjhiye —",
        pa: "Chalo phir samjhiye —",
        kn: "Innomme try maadona —",
        ml: "Innoru praavashyam nokkaaam —",
        or: "Aaau eka bhara bujhibaa —",
    };
    const correctionPrefix = isCorrection ? ((correctionPrefixes[language] ?? correctionPrefixes.en) + " ") : "";

    // Follow-up prefix for vague replies when a topic is known
    const followUpPrefixFn: Partial<Record<string, (t: string) => string>> = {
        en: (t) => `Still thinking about the ${t} situation —`,
        hi: (t) => `Abhi bhi ${t} ki baat chal rahi hai —`,
        bn: (t) => `Ekhono ${t} er bishoy niye aacha —`,
    };
    const followUpPrefix = (isVagueReply && keyTopic)
        ? (((followUpPrefixFn[language] ?? followUpPrefixFn.en)!(keyTopic)) + " ")
        : "";

    // Topic hint (English only)
    const topicHints: Record<string, string> = {
        work: "Work pressure like this can really pile up.",
        relationship: "Relationships can carry so much weight.",
        health: "Taking care of yourself matters most right now.",
        existential: "These bigger questions deserve space.",
        general: "",
    };
    const topicHint = (topic !== "general" && language === "en" && signal !== "okay")
        ? ` ${topicHints[topic]}`
        : "";

    const opener = pickAvoidingRecent(openers, seed, recentContext?.recentAssistantTexts ?? []);
    const hasCarry = signal === "okay" && hasRecentEmotionalSignal(recentContext);

    const carryValidationMap: Partial<Record<string, string[]>> = {
        hi: carryValidationsHi, mr: carryValidationsMr, bn: carryValidationsBn,
        gu: carryValidationsGu, pa: carryValidationsPa, kn: carryValidationsKn,
        ml: carryValidationsMl, or: carryValidationsOr,
    };
    const carryExtrasMap: Partial<Record<string, Record<LocalResponseTone, string[]>>> = {
        hi: carryExtrasHi, mr: carryExtrasMr, bn: carryExtrasBn,
        gu: carryExtrasGu, pa: carryExtrasPa, kn: carryExtrasKn,
        ml: carryExtrasMl, or: carryExtrasOr,
    };

    const validation = hasCarry
        ? pick(carryValidationMap[language] ?? carryValidationsEn, seed >>> 1)
        : pick(validations[signal], seed >>> 1);

    const extra = hasCarry
        ? pick((carryExtrasMap[language] ?? carryExtrasEn)[companionTone], seed >>> 5)
        : pick(extrasByTone[companionTone], seed >>> 5);

    const base = `${correctionPrefix}${followUpPrefix}${opener} ${validation}`.trim();
    const storyPart = storyLine ? " " + storyLine : "";
    const mythPart = mythLine ? " " + mythLine : "";
    const quotePart = quoteLine ? " " + quoteLine : "";
    const extraPart = suppressExtras ? "" : (extra ? " " + extra : "");
    const finalMsg = dedupeAdjacentSentences(`${base}${storyPart}${mythPart}${quotePart}${extraPart}${topicHint}`.trim());

    // Age-aware closing
    const ageClosersByLang: Record<string, Partial<Record<string, string>>> = {
        under_13: { en: "You're doing really well just by sharing this.", hi: "Yeh share karna himmat ki baat hai.", bn: "Eta share kora onek sahosher kaaj.", ta: "Idha sollaradhe nalla irukkudhu.", te: "Idi cheppadam chala brave ga undi.", kn: "Idu heltirodu tumba olle vishaya.", ml: "Idi paranjathu valare nannaayi.", gu: "Aa share karavanu ek himmat ni vaat chhe.", pa: "Eh share karna bahut himmat di gall hai.", or: "Eta share kara onek sahasa r kaaj.", mr: "He share karane khupach dhads aache." },
        "13_17": { en: "You've got this.", hi: "Tum sambhal loge yaar.", mr: "Tu handle karasheel.", bn: "Tumi thik korte parbe.", ta: "Unakkale mudiyum.", te: "Nuvvu manage cheyagalagaavu.", kn: "Neevu handle maadabahudu.", ml: "Ninakku parreyum.", gu: "Tu sambhali laishe.", pa: "Tu sambhal lavega.", or: "Tume sambhaliba pariba." },
        "65_plus": { en: "Take your time — there is no rush.", hi: "Apni speed se chalo — koi jaldi nahi hai.", mr: "Tuzha vel ghe — kaahlichi ghai nahi.", bn: "Tomar time nao — kono taratari nei.", ta: "Un neram eduthukko — avasaara illai.", te: "Nee samayam teesukundu — avasaara ledu.", kn: "Nimma samaya tagondi — avasara illa.", ml: "Nee samayam edukku — tharamillaa.", gu: "Tamaro samay lejo — koi uchhat nathi.", pa: "Apna waqt lo — koi jaldi nahin.", or: "Tumara samay niao — kono jaldi nei." },
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
