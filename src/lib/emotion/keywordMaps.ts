// src/lib/emotion/keywordMaps.ts
// Centralized multilingual keyword regex used by local/heuristic emotion inference.
// Keep these conservative to avoid false positives.

import { escapeRegexLiteral } from "./regexUtils";


export const BN_SAD_REGEX =
    /(মন খারাপ|খারাপ লাগছে|মন ভালো নেই|মনে ভালো নেই|ভালো নেই|ভাল নেই|ভালো লাগছে না|ভাল লাগছে না|দুঃখ|কষ্ট|কাঁদ|কান্না|একলা|একাকী|\bmon\s+bhalo\s+na\b|\b(kichu|kicu|kisu)\s+bhalo\s+lag(chh?e|che)\s+na\b|\bbhalo\s+lag(chh?e|che)\s+na\b|\bmood\s+off\b)/i;


// Bengali confusion / mental overload
export const BN_CONFUSED_REGEX =
    /বুঝতে পারছি না|বুঝতে পারছিনা|মাথা কাজ করছে না|মাথা কাজ করছ না/i;


export const HI_STRESS_REGEX =
    /(परेशान|तनाव|चिंता|घबराहट|बेचैन)/;

// Hindi confusion / mental overload
export const CONFUSED_HI_REGEX =
    /(समझ नहीं|समझ नही|कन्फ्यूज|भूल गया|भूल गयी|क्या करूँ|क्या करु|क्या करूं|क्या करूँ|\bsamajh\s+nahi\s+aa\s+raha\b|\bsamajh\s+nahi\s+aa\s+rahi\b|\bsamajh\s+nahi\s+aa\s+raha\s+hai\b|\bsamajh\s+nahi\s+aa\s+rahi\s+hai\b|\bkya\s+karu\b|\bkya\s+karoon\b|\bkya\s+karu[nm]?\b)/i;

// English confusion / mental overload
const CONFUSED_EN_TERMS = [
    "cannot focus",
    "can not focus",
    "can't focus",
    "cant focus",
    "can’t focus",
    "can't concentrate",
    "cant concentrate",
    "can’t concentrate",
    "can't think",
    "cant think",
    "can’t think",
    "scattered",
    "mind is all over",
    "all over the place",
    "not sure what to do",
    "unsure what to do",
    "don’t know what to do",
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

    if (HI_STRESS_REGEX.test(input)) return "stressed";
    if (BN_SAD_REGEX.test(input)) return "sad";

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
    CONFUSED_HI_REGEX.lastIndex = 0;
    BN_CONFUSED_REGEX.lastIndex = 0;

    return (
        CONFUSED_EN_REGEX.test(input) ||
        CONFUSED_HI_REGEX.test(input) ||
        BN_CONFUSED_REGEX.test(input)
    );
}



