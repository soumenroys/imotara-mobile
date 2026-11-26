// latinLang.ts — which LATIN-script language is this: es / fr / de / pt / id, or none?
//
// #48 (27 Nov 2026): the crisis card picks its language from the script of what the person
// wrote. Spanish, French, German, Portuguese and Indonesian all use Latin letters, so a
// visitor who never chose a language and wrote "ya no quiero vivir" got the card — and its
// helpline wording — in ENGLISH. Both repos recorded it as "a known gap".
//
// 🔑 CAUTIOUS BY DESIGN: it answers only on clear evidence — at least two marker words of one
// language, more than any other language AND more than English — and returns null otherwise.
// A wrong guess would show a crisis card in a language the person cannot read; null keeps
// the old behaviour (the next fallback decides). ⛔ Identical file in imotaraapp and imotara-mobile.

export type LatinLang = "es" | "fr" | "de" | "pt" | "id";

const MARKERS: Record<LatinLang | "en", readonly string[]> = {
    es: ["quiero", "estoy", "siento", "vivir", "morir", "nadie", "tengo", "porque", "muy", "ya", "yo", "mi", "vida", "matarme", "quitarme", "puedo", "más", "solo", "sola", "triste", "hoy", "aquí", "nada", "qué", "pensando", "suicidarme", "ganas", "estar"],
    fr: ["je", "ne", "veux", "plus", "pas", "suis", "moi", "vivre", "mourir", "rien", "envie", "personne", "tuer", "aujourd'hui", "très", "seul", "seule", "triste", "j'ai", "c'est", "mon", "ma", "pense", "au", "suicider", "me", "sens"],
    de: ["ich", "nicht", "mehr", "will", "bin", "mich", "leben", "sterben", "kann", "mir", "keine", "niemand", "umbringen", "heute", "allein", "traurig", "und", "das", "ist", "mein", "denke", "selbstmord", "fühle"],
    pt: ["não", "nao", "quero", "mais", "estou", "eu", "viver", "morrer", "minha", "ninguém", "você", "matar", "tirar", "hoje", "sozinho", "sozinha", "triste", "muito", "aqui", "sinto"],
    id: ["aku", "saya", "tidak", "ingin", "mau", "hidup", "mati", "bunuh", "diri", "lagi", "sangat", "sedih", "nggak", "gak", "ga", "hari", "ini", "sendiri", "kesepian", "pengen", "rasanya"],
    en: ["i", "i'm", "im", "want", "to", "the", "don't", "dont", "my", "me", "myself", "live", "die", "feel", "anymore", "and", "is", "it", "so", "can't", "no", "one", "today", "thinking", "about", "ending", "life", "everyone", "would", "be", "better", "off", "without", "going", "kill", "cut", "again", "tonight", "of", "have", "nobody", "lonely"],
};

export function detectLatinLang(text: string): LatinLang | null {
    const words = String(text ?? "").toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
    if (words.length === 0) return null;
    const score = (l: keyof typeof MARKERS) => words.filter((w) => MARKERS[l].includes(w)).length;
    const en = score("en");
    let best: LatinLang | null = null;
    let bestScore = 0;
    let tie = false;
    for (const l of ["es", "fr", "de", "pt", "id"] as const) {
        const s = score(l);
        if (s > bestScore) { best = l; bestScore = s; tie = false; }
        else if (s === bestScore && s > 0) tie = true;
    }
    if (!best || tie || bestScore < 2 || bestScore <= en) return null;
    return best;
}

/**
 * Clearly English (≥2 English marker words, more than any of the five languages above)?
 * The crisis card uses it so that someone WRITING English on a Hindi- or Spanish-language
 * phone keeps an English card — the phone's language decides only when the text cannot.
 */
export function looksEnglish(text: string): boolean {
    const words = String(text ?? "").toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
    const score = (l: keyof typeof MARKERS) => words.filter((w) => MARKERS[l].includes(w)).length;
    const en = score("en");
    if (en < 2) return false;
    return (["es", "fr", "de", "pt", "id"] as const).every((l) => score(l) < en);
}
