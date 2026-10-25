// src/notifications/checkInInvite.ts
// "Shall I check in with you tomorrow?" — asked ONCE, after a first real
// conversation — and the fix for a daily reminder that never fired.
//
// 🔴 MEASURED 25 Oct 2026: of 30 people who chatted after signing up in
// Sep–Oct, 4 came back within a week. The daily check-in is ON by default
// (owner, 10 Oct), but it was only ever SCHEDULED when someone touched the
// switch in Settings — so almost nobody received it. The switch read ON and
// nothing happened: the setup-≠-outcome trap again.
//
// Owner, 25 Oct: build all three — the launch fix, a one-time invite card, and
// its text in all 22 languages.
//
// ⛔ THE INVITE NEVER TOUCHES A REPLY. It is a card the screen draws after a
//    reply; the prompt, the model and the words Imotara says are unchanged.
// ⛔ It is never shown on or after a crisis turn, and never again after an
//    answer — "Not now" included.
// ⛔ Mirrored on the web in imotaraapp/src/lib/imotara/checkInInviteStrings.ts —
//    change the two together.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    DEFAULT_HOUR,
    DEFAULT_MINUTE,
    getSavedNotifPrefs,
    getSavedReminderTime,
    isCheckInReminderEnabled,
    isSnoozed,
    scheduleCheckInReminderWithReason,
} from "./checkInReminder";

export type InviteStrings = {
    q: string;
    sub: string;
    choose: string;
    later: string;
    done: (time: string) => string;
    blocked: string;
};

/**
 * Formality follows each language's existing reminder copy in checkInReminder.ts
 * (Hindi आप, Bengali আপনি, French vous, German du, Spanish tú, Russian вы, …).
 * Imotara speaks of itself in the feminine where the language marks it (Hindi,
 * Urdu, Punjabi), as the existing nudges do.
 */
export const INVITE: Record<string, InviteStrings> = {
    en: {
        q: "Shall I check in with you tomorrow?",
        sub: "A gentle reminder at a time you choose. It never shows what you wrote.",
        choose: "Choose a time",
        later: "Not now",
        done: (t) => `Done. I'll check in at ${t}.`,
        blocked: "Notifications are turned off for Imotara. You can allow them in Settings.",
    },
    hi: {
        q: "क्या मैं कल आपका हाल पूछूँ?",
        sub: "आपके चुने हुए समय पर एक हल्का-सा रिमाइंडर। इसमें आपकी लिखी बात कभी नहीं दिखेगी।",
        choose: "समय चुनें",
        later: "अभी नहीं",
        done: (t) => `ठीक है। मैं ${t} पर आपका हाल पूछूँगी।`,
        blocked: "Imotara के लिए नोटिफ़िकेशन बंद हैं। आप इन्हें सेटिंग्स में चालू कर सकते हैं।",
    },
    bn: {
        q: "কাল কি আমি আপনার খোঁজ নেব?",
        sub: "আপনার বেছে নেওয়া সময়ে একটা ছোট্ট রিমাইন্ডার। এতে আপনার লেখা কখনও দেখা যাবে না।",
        choose: "সময় বেছে নিন",
        later: "এখন নয়",
        done: (t) => `ঠিক আছে। আমি ${t}-এ আপনার খোঁজ নেব।`,
        blocked: "Imotara-র নোটিফিকেশন বন্ধ আছে। সেটিংসে গিয়ে চালু করতে পারেন।",
    },
    mr: {
        q: "उद्या मी तुमची विचारपूस करू का?",
        sub: "तुम्ही निवडलेल्या वेळी एक हलकीशी आठवण. त्यात तुम्ही लिहिलेले कधीच दिसणार नाही.",
        choose: "वेळ निवडा",
        later: "आत्ता नको",
        done: (t) => `ठीक आहे. मी ${t} ला तुमची विचारपूस करेन.`,
        blocked: "Imotara साठी सूचना बंद आहेत. तुम्ही त्या सेटिंग्जमध्ये सुरू करू शकता.",
    },
    ta: {
        q: "நாளை நான் உங்களை விசாரிக்கட்டுமா?",
        sub: "நீங்கள் தேர்ந்தெடுக்கும் நேரத்தில் ஒரு மென்மையான நினைவூட்டல். நீங்கள் எழுதியது அதில் ஒருபோதும் தெரியாது.",
        choose: "நேரத்தைத் தேர்ந்தெடுக்கவும்",
        later: "இப்போது வேண்டாம்",
        done: (t) => `சரி. ${t}-க்கு உங்களை விசாரிக்கிறேன்.`,
        blocked: "Imotara-க்கான அறிவிப்புகள் அணைக்கப்பட்டுள்ளன. அமைப்புகளில் அவற்றை இயக்கலாம்.",
    },
    te: {
        q: "రేపు నేను మిమ్మల్ని పలకరించనా?",
        sub: "మీరు ఎంచుకున్న సమయానికి ఒక చిన్న గుర్తుచేత. మీరు రాసినది అందులో ఎప్పుడూ కనిపించదు.",
        choose: "సమయం ఎంచుకోండి",
        later: "ఇప్పుడు కాదు",
        done: (t) => `సరే. ${t}కి మిమ్మల్ని పలకరిస్తాను.`,
        blocked: "Imotara నోటిఫికేషన్లు ఆఫ్‌లో ఉన్నాయి. సెట్టింగ్స్‌లో వాటిని ఆన్ చేయవచ్చు.",
    },
    gu: {
        q: "શું હું કાલે તમારા હાલચાલ પૂછું?",
        sub: "તમે પસંદ કરેલા સમયે એક હળવું રીમાઇન્ડર. તેમાં તમે લખેલું ક્યારેય દેખાશે નહીં.",
        choose: "સમય પસંદ કરો",
        later: "હમણાં નહીં",
        done: (t) => `ઠીક છે. હું ${t}એ તમારા હાલચાલ પૂછીશ.`,
        blocked: "Imotara માટે સૂચનાઓ બંધ છે. તમે તેને સેટિંગ્સમાં ચાલુ કરી શકો છો.",
    },
    kn: {
        q: "ನಾಳೆ ನಾನು ನಿಮ್ಮನ್ನು ವಿಚಾರಿಸಲೇ?",
        sub: "ನೀವು ಆಯ್ಕೆ ಮಾಡಿದ ಸಮಯಕ್ಕೆ ಒಂದು ಸೌಮ್ಯ ಜ್ಞಾಪನೆ. ನೀವು ಬರೆದದ್ದು ಅದರಲ್ಲಿ ಎಂದಿಗೂ ಕಾಣಿಸುವುದಿಲ್ಲ.",
        choose: "ಸಮಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        later: "ಈಗ ಬೇಡ",
        done: (t) => `ಸರಿ. ${t}ಕ್ಕೆ ನಿಮ್ಮನ್ನು ವಿಚಾರಿಸುತ್ತೇನೆ.`,
        blocked: "Imotara ಅಧಿಸೂಚನೆಗಳು ಆಫ್ ಆಗಿವೆ. ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಅವನ್ನು ಆನ್ ಮಾಡಬಹುದು.",
    },
    ml: {
        q: "നാളെ ഞാൻ നിങ്ങളുടെ വിശേഷം തിരക്കട്ടെ?",
        sub: "നിങ്ങൾ തിരഞ്ഞെടുക്കുന്ന സമയത്ത് ഒരു ചെറിയ ഓർമ്മപ്പെടുത്തൽ. നിങ്ങൾ എഴുതിയത് അതിൽ ഒരിക്കലും കാണില്ല.",
        choose: "സമയം തിരഞ്ഞെടുക്കുക",
        later: "ഇപ്പോൾ വേണ്ട",
        done: (t) => `ശരി. ${t}-ന് ഞാൻ നിങ്ങളുടെ വിശേഷം തിരക്കാം.`,
        blocked: "Imotara-യുടെ അറിയിപ്പുകൾ ഓഫാണ്. ക്രമീകരണങ്ങളിൽ അവ ഓണാക്കാം.",
    },
    pa: {
        q: "ਕੀ ਮੈਂ ਕੱਲ੍ਹ ਤੁਹਾਡਾ ਹਾਲ ਪੁੱਛਾਂ?",
        sub: "ਤੁਹਾਡੇ ਚੁਣੇ ਸਮੇਂ 'ਤੇ ਇੱਕ ਹਲਕੀ ਜਿਹੀ ਯਾਦ-ਦਹਾਨੀ। ਇਸ ਵਿੱਚ ਤੁਹਾਡਾ ਲਿਖਿਆ ਕਦੇ ਨਹੀਂ ਦਿਖੇਗਾ।",
        choose: "ਸਮਾਂ ਚੁਣੋ",
        later: "ਹੁਣ ਨਹੀਂ",
        done: (t) => `ਠੀਕ ਹੈ। ਮੈਂ ${t} 'ਤੇ ਤੁਹਾਡਾ ਹਾਲ ਪੁੱਛਾਂਗੀ।`,
        blocked: "Imotara ਲਈ ਸੂਚਨਾਵਾਂ ਬੰਦ ਹਨ। ਤੁਸੀਂ ਇਹਨਾਂ ਨੂੰ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਚਾਲੂ ਕਰ ਸਕਦੇ ਹੋ।",
    },
    or: {
        q: "କାଲି ମୁଁ ଆପଣଙ୍କ ଖବର ବୁଝିବି କି?",
        sub: "ଆପଣ ବାଛିଥିବା ସମୟରେ ଏକ ଛୋଟ ସ୍ମାରକ। ଏଥିରେ ଆପଣ ଲେଖିଥିବା କଥା କେବେ ଦେଖାଯିବ ନାହିଁ।",
        choose: "ସମୟ ବାଛନ୍ତୁ",
        later: "ଏବେ ନୁହେଁ",
        done: (t) => `ଠିକ ଅଛି। ମୁଁ ${t}ରେ ଆପଣଙ୍କ ଖବର ବୁଝିବି।`,
        blocked: "Imotara ପାଇଁ ବିଜ୍ଞପ୍ତି ବନ୍ଦ ଅଛି। ସେଟିଂସରେ ଆପଣ ଏହାକୁ ଚାଲୁ କରିପାରିବେ।",
    },
    ur: {
        q: "کیا میں کل آپ کا حال پوچھوں؟",
        sub: "آپ کے چنے ہوئے وقت پر ایک ہلکی سی یاد دہانی۔ اس میں آپ کی لکھی ہوئی بات کبھی نظر نہیں آئے گی۔",
        choose: "وقت چنیں",
        later: "ابھی نہیں",
        done: (t) => `ٹھیک ہے۔ میں ${t} پر آپ کا حال پوچھوں گی۔`,
        blocked: "Imotara کی اطلاعات بند ہیں۔ آپ انہیں سیٹنگز میں آن کر سکتے ہیں۔",
    },
    ar: {
        q: "هل أطمئن عليك غدًا؟",
        sub: "تذكير لطيف في الوقت الذي تختاره. لن يظهر فيه أبدًا ما كتبته.",
        choose: "اختر وقتًا",
        later: "ليس الآن",
        done: (t) => `حسنًا. سأطمئن عليك في ${t}.`,
        blocked: "الإشعارات متوقفة لتطبيق Imotara. يمكنك تفعيلها من الإعدادات.",
    },
    ru: {
        q: "Можно я загляну к вам завтра?",
        sub: "Мягкое напоминание в удобное вам время. В нём никогда не видно, что вы написали.",
        choose: "Выбрать время",
        later: "Не сейчас",
        done: (t) => `Хорошо. Загляну к вам в ${t}.`,
        blocked: "Уведомления Imotara отключены. Их можно включить в настройках.",
    },
    zh: {
        q: "明天我来问候你一下，好吗？",
        sub: "在你选择的时间轻轻提醒一下。提醒里绝不会显示你写过的内容。",
        choose: "选择时间",
        later: "暂时不用",
        done: (t) => `好的，我会在${t}来问候你。`,
        blocked: "Imotara 的通知已关闭。你可以在设置中开启。",
    },
    ja: {
        q: "明日、様子をうかがってもいいですか？",
        sub: "あなたが選んだ時間に、そっとお知らせします。書いた内容が表示されることはありません。",
        choose: "時間を選ぶ",
        later: "今はしない",
        done: (t) => `わかりました。${t}にお声がけしますね。`,
        blocked: "Imotara の通知がオフになっています。設定からオンにできます。",
    },
    es: {
        q: "¿Quieres que mañana te pregunte cómo estás?",
        sub: "Un recordatorio suave a la hora que elijas. Nunca muestra lo que escribiste.",
        choose: "Elegir una hora",
        later: "Ahora no",
        done: (t) => `Listo. Te preguntaré cómo estás a las ${t}.`,
        blocked: "Las notificaciones de Imotara están desactivadas. Puedes activarlas en Ajustes.",
    },
    fr: {
        q: "Voulez-vous que je prenne de vos nouvelles demain ?",
        sub: "Un petit rappel à l'heure de votre choix. Il n'affiche jamais ce que vous avez écrit.",
        choose: "Choisir une heure",
        later: "Pas maintenant",
        done: (t) => `C'est noté. Je prendrai de vos nouvelles à ${t}.`,
        blocked: "Les notifications d'Imotara sont désactivées. Vous pouvez les activer dans les réglages.",
    },
    de: {
        q: "Soll ich mich morgen bei dir melden?",
        sub: "Eine sanfte Erinnerung zu einer Zeit deiner Wahl. Sie zeigt nie, was du geschrieben hast.",
        choose: "Zeit wählen",
        later: "Jetzt nicht",
        done: (t) => `Gut. Ich melde mich um ${t} bei dir.`,
        blocked: "Benachrichtigungen für Imotara sind aus. Du kannst sie in den Einstellungen einschalten.",
    },
    pt: {
        q: "Posso perguntar como você está amanhã?",
        sub: "Um lembrete gentil no horário que você escolher. Ele nunca mostra o que você escreveu.",
        choose: "Escolher horário",
        later: "Agora não",
        done: (t) => `Combinado. Vou perguntar como você está às ${t}.`,
        blocked: "As notificações do Imotara estão desativadas. Você pode ativá-las nos Ajustes.",
    },
    id: {
        q: "Boleh aku menanyakan kabarmu besok?",
        sub: "Pengingat lembut di waktu yang kamu pilih. Tidak pernah menampilkan apa yang kamu tulis.",
        choose: "Pilih waktu",
        later: "Nanti saja",
        done: (t) => `Oke. Aku akan menanyakan kabarmu pukul ${t}.`,
        blocked: "Notifikasi Imotara sedang nonaktif. Kamu bisa mengaktifkannya di Pengaturan.",
    },
    he: {
        q: "לבדוק מה שלומך מחר?",
        sub: "תזכורת עדינה בשעה שתבחר/י. היא אף פעם לא מציגה את מה שכתבת.",
        choose: "לבחור שעה",
        later: "לא עכשיו",
        done: (t) => `בסדר. אבדוק מה שלומך ב-${t}.`,
        blocked: "ההתראות של Imotara כבויות. אפשר להפעיל אותן בהגדרות.",
    },
};

export function getInviteStrings(lang?: string | null): InviteStrings {
    const base = (lang ?? "").split(/[-_]/)[0].toLowerCase();
    return INVITE[base] ?? INVITE.en;
}

/** "8 pm" / "20:00" / "下午8点" — the hour in the person's own language's clock. */
export function formatHour(hour: number, lang?: string | null): string {
    try {
        const d = new Date(2000, 0, 1, hour, 0, 0);
        return new Intl.DateTimeFormat(lang || undefined, { hour: "numeric", minute: "2-digit" }).format(d);
    } catch {
        return `${String(hour).padStart(2, "0")}:00`;
    }
}

/** The two quick choices on the card. Evening matches the existing default (20:00). */
export const INVITE_HOURS = { evening: DEFAULT_HOUR, morning: 9 } as const;

// ── Shown once, ever ──────────────────────────────────────────────────────────
const INVITE_STATE_KEY = "imotara.checkin.invite.v1";
export type InviteState = "unseen" | "accepted" | "declined";

export async function getInviteState(): Promise<InviteState> {
    try {
        const v = await AsyncStorage.getItem(INVITE_STATE_KEY);
        return v === "accepted" || v === "declined" ? v : "unseen";
    } catch {
        return "declined"; // ⛔ when in doubt, do not show it
    }
}

export async function setInviteState(s: Exclude<InviteState, "unseen">): Promise<void> {
    try { await AsyncStorage.setItem(INVITE_STATE_KEY, s); } catch { /* best effort */ }
}

/**
 * Should the card appear under this reply?
 * ⛔ Never on/after a crisis turn; never once answered; only after a real
 * exchange (3+ messages from the person); never when reminders are off or paused.
 */
export function shouldOfferInvite(args: {
    state: InviteState;
    userMessageCount: number;
    crisisInThread: boolean;
    remindersOn: boolean;
    paused: boolean;
}): boolean {
    return args.state === "unseen" && !args.crisisInThread && args.userMessageCount >= 3 && args.remindersOn && !args.paused;
}

/** Accept: ask the OS (only now, after a tap), then schedule at the chosen hour. */
export async function acceptInvite(hour: number, minute = 0) {
    // ⚠️ The person's own sound/badge choices — the defaults would switch them off.
    const { sound, badge } = await getSavedNotifPrefs();
    const r = await scheduleCheckInReminderWithReason(hour, minute, sound, badge);
    if (r.ok) await setInviteState("accepted");
    return r;
}

// ── 1. The launch fix ─────────────────────────────────────────────────────────
/**
 * The reminder is ON by default, so schedule it — but ONLY when the OS already
 * allows notifications. ⛔ Never raises the permission prompt at launch: asking
 * cold, before any conversation, is how a person learns to say no. The invite
 * card asks at the right moment instead.
 */
export async function ensureDailyReminderScheduled(): Promise<boolean> {
    try {
        if (!(await isCheckInReminderEnabled())) return false;
        if (await isSnoozed()) return false;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Notifications = require("expo-notifications");
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") return false;
        const { hour, minute } = await getSavedReminderTime();
        const { sound, badge } = await getSavedNotifPrefs();
        const r = await scheduleCheckInReminderWithReason(hour ?? DEFAULT_HOUR, minute ?? DEFAULT_MINUTE, sound, badge);
        return r.ok;
    } catch {
        return false;
    }
}
