// src/lib/update/updatePrompt.ts
// "A new version of Imotara is available — Update / Not now" (owner, 7 Nov 2026).
//
// 🔑 RULES (owner):
//  • only for people who have used the app before — ⛔ NEVER on the first open;
//  • shown when the app opens and the store has a newer version; "Not now"
//    hides it until the next open.
//
// 🔑 WHERE "NEWER" COMES FROM: www.imotara.com/api/app/latest-version, which
// reads two numbers set by hand only AFTER each store shows the version live
// (imotaraapp lib/imotara/latestAppVersion.ts). Unset ⇒ null ⇒ nothing shows.
// We never compare against our own release number: it moves before review.
//
// ⚠️ PURE except the fetch helper at the bottom ⇒ src/__tests__/updatePrompt.test.ts.

import { INVITE } from "../../notifications/checkInInvite";

export type StorePlatform = "ios" | "android";

/** "1.6.5" or "1.6.5+165" ⇒ [1,6,5]; anything else ⇒ null. */
export function parseVersion(raw: unknown): [number, number, number] | null {
    if (typeof raw !== "string") return null;
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(raw.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function isNewer(latest: unknown, installed: unknown): boolean {
    const a = parseVersion(latest);
    const b = parseVersion(installed);
    if (!a || !b) return false; // ⛔ not sure ⇒ never nag
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
}

export function shouldOfferUpdate(p: {
    firstOpen: boolean;
    installed: string | null | undefined;
    latest: unknown;
}): boolean {
    if (p.firstOpen) return false;
    return isNewer(p.latest, p.installed);
}

/** The store's own page for Imotara — the app opens it, the store does the rest. */
export const STORE_URL: Record<StorePlatform, { app: string; web: string }> = {
    ios: {
        app: "itms-apps://apps.apple.com/app/id6756697569",
        web: "https://apps.apple.com/app/id6756697569",
    },
    android: {
        app: "market://details?id=com.imotara.imotara",
        web: "https://play.google.com/store/apps/details?id=com.imotara.imotara",
    },
};

/** Re-check when the app comes back after this long — "when they open it", not on every app switch. */
export const RECHECK_AFTER_MS = 30 * 60 * 1000;

type UpdateStrings = { lang: string; title: string; update: string; later: string };

const TEXT: Record<string, { title: string; update: string }> = {
    en: { title: "A new version of Imotara is available.", update: "Update" },
    hi: { title: "Imotara का नया वर्ज़न उपलब्ध है।", update: "अपडेट करें" },
    bn: { title: "Imotara-র নতুন ভার্সন এসেছে।", update: "আপডেট করুন" },
    mr: { title: "Imotara ची नवीन आवृत्ती उपलब्ध आहे.", update: "अपडेट करा" },
    ta: { title: "Imotara-வின் புதிய பதிப்பு கிடைக்கிறது.", update: "புதுப்பிக்கவும்" },
    te: { title: "Imotara కొత్త వెర్షన్ అందుబాటులో ఉంది.", update: "అప్‌డేట్ చేయండి" },
    gu: { title: "Imotara નું નવું વર્ઝન ઉપલબ્ધ છે.", update: "અપડેટ કરો" },
    kn: { title: "Imotara ಹೊಸ ಆವೃತ್ತಿ ಲಭ್ಯವಿದೆ.", update: "ಅಪ್‌ಡೇಟ್ ಮಾಡಿ" },
    ml: { title: "Imotara-യുടെ പുതിയ പതിപ്പ് ലഭ്യമാണ്.", update: "അപ്ഡേറ്റ് ചെയ്യുക" },
    pa: { title: "Imotara ਦਾ ਨਵਾਂ ਵਰਜ਼ਨ ਉਪਲਬਧ ਹੈ।", update: "ਅੱਪਡੇਟ ਕਰੋ" },
    or: { title: "Imotaraର ନୂଆ ସଂସ୍କରଣ ଉପଲବ୍ଧ।", update: "ଅପଡେଟ୍ କରନ୍ତୁ" },
    ur: { title: "Imotara کا نیا ورژن دستیاب ہے۔", update: "اپڈیٹ کریں" },
    ar: { title: "يتوفر إصدار جديد من Imotara.", update: "تحديث" },
    ru: { title: "Доступна новая версия Imotara.", update: "Обновить" },
    zh: { title: "Imotara 有新版本可用。", update: "更新" },
    ja: { title: "Imotara の新しいバージョンがあります。", update: "アップデート" },
    es: { title: "Hay una nueva versión de Imotara disponible.", update: "Actualizar" },
    fr: { title: "Une nouvelle version d'Imotara est disponible.", update: "Mettre à jour" },
    de: { title: "Eine neue Version von Imotara ist verfügbar.", update: "Aktualisieren" },
    pt: { title: "Uma nova versão do Imotara está disponível.", update: "Atualizar" },
    id: { title: "Versi baru Imotara sudah tersedia.", update: "Perbarui" },
    he: { title: "גרסה חדשה של Imotara זמינה.", update: "עדכון" },
};

export const UPDATE_LANGS = Object.keys(TEXT);

/**
 * The words, in the person's language: their chosen chat language if they set
 * one, otherwise the phone's language, otherwise English. "Not now" is the same
 * words the check-in card already uses.
 */
export function updateStrings(preferredLang?: string | null, deviceLocale?: string | null): UpdateStrings {
    const base = (v?: string | null) => (v ?? "").split(/[-_]/)[0].toLowerCase();
    const pref = base(preferredLang);
    const lang = pref && pref !== "auto" && TEXT[pref] ? pref : TEXT[base(deviceLocale)] ? base(deviceLocale) : "en";
    return { lang, ...TEXT[lang], later: (INVITE[lang] ?? INVITE.en).later };
}

export function deviceLocale(): string | null {
    try {
        return Intl.DateTimeFormat().resolvedOptions().locale ?? null;
    } catch {
        return null;
    }
}
