// src/lib/safety/emergencyLabel.ts
// The word in front of the emergency number ("Emergency: 112") in the person's language.
//
// 🔑 Dec release check (26 Nov 2026): every one of the 59 countries in crisisResources
// labels its emergency line "Emergency" — so the welcome screen and the under-13 stop
// screen showed that one word in English inside Hindi, Bengali, Tamil… text. Named
// services (Tele-MANAS, Samaritans, 988) stay as they are: they are names.
//
// The standard public term for emergency services in each language. ⚠️ Change a word
// only after checking a dictionary AND the rendered screen (feedback rule).

const LABEL: Record<string, string> = {
    en: "Emergency",
    hi: "आपातकालीन सेवा",
    mr: "आपत्कालीन सेवा",
    bn: "জরুরি পরিষেবা",
    ta: "அவசர சேவை",
    te: "అత్యవసర సేవ",
    kn: "ತುರ್ತು ಸೇವೆ",
    ml: "അടിയന്തര സേവനം",
    gu: "કટોકટી સેવા",
    pa: "ਐਮਰਜੈਂਸੀ ਸੇਵਾ",
    or: "ଜରୁରୀକାଳୀନ ସେବା",
    he: "חירום",
    ar: "الطوارئ",
    de: "Notruf",
    ja: "緊急通報",
    ur: "ہنگامی سروس",
    es: "Emergencias",
    fr: "Urgences",
    pt: "Emergência",
    ru: "Экстренные службы",
    zh: "紧急求助",
    id: "Darurat",
};

/** The localized label for the EMERGENCY line; any other line keeps its own name. */
export function emergencyLabel(lang?: string | null): string {
    const k = String(lang ?? "").toLowerCase().split(/[-_]/)[0];
    return LABEL[k] ?? LABEL.en;
}

export const EMERGENCY_LABEL_LANGS = Object.keys(LABEL);
