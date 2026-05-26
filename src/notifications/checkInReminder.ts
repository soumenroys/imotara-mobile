// src/notifications/checkInReminder.ts
// Schedules / cancels a daily "How are you feeling?" check-in reminder.
// Uses expo-notifications with a lazy require so the app doesn't crash
// in Expo Go / Simulator builds where the native module isn't linked yet.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHECKIN_NOTIFICATION_ID_KEY = "imotara.checkin.notif.id";
const CHECKIN_ENABLED_KEY = "imotara.checkin.enabled";
const CHECKIN_HOUR_KEY = "imotara.checkin.hour";
const CHECKIN_MINUTE_KEY = "imotara.checkin.minute";
const INACTIVITY_NOTIF_ID_KEY = "imotara.checkin.inactivity.id";
const CHECKIN_SOUND_KEY = "imotara.checkin.sound";
const CHECKIN_BADGE_KEY = "imotara.checkin.badge";
const INACTIVITY_HOURS_KEY = "imotara.checkin.inactivity.hours";

export const DEFAULT_HOUR = 20;
export const DEFAULT_MINUTE = 0;
export const DEFAULT_INACTIVITY_HOURS = 48;

export async function getSavedReminderTime(): Promise<{ hour: number; minute: number }> {
    try {
        const h = await AsyncStorage.getItem(CHECKIN_HOUR_KEY);
        const m = await AsyncStorage.getItem(CHECKIN_MINUTE_KEY);
        return {
            hour: h != null ? parseInt(h, 10) : DEFAULT_HOUR,
            minute: m != null ? parseInt(m, 10) : DEFAULT_MINUTE,
        };
    } catch {
        return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };
    }
}

export async function getSavedNotifPrefs(): Promise<{ sound: boolean; badge: boolean; inactivityHours: number }> {
    try {
        const [s, b, ih] = await Promise.all([
            AsyncStorage.getItem(CHECKIN_SOUND_KEY),
            AsyncStorage.getItem(CHECKIN_BADGE_KEY),
            AsyncStorage.getItem(INACTIVITY_HOURS_KEY),
        ]);
        return {
            sound: s === "1",
            badge: b === "1",
            inactivityHours: ih != null ? parseInt(ih, 10) : DEFAULT_INACTIVITY_HOURS,
        };
    } catch {
        return { sound: false, badge: false, inactivityHours: DEFAULT_INACTIVITY_HOURS };
    }
}

export async function saveNotifPrefs(prefs: { sound?: boolean; badge?: boolean; inactivityHours?: number }): Promise<void> {
    try {
        const ops: Promise<void>[] = [];
        if (prefs.sound !== undefined) ops.push(AsyncStorage.setItem(CHECKIN_SOUND_KEY, prefs.sound ? "1" : "0"));
        if (prefs.badge !== undefined) ops.push(AsyncStorage.setItem(CHECKIN_BADGE_KEY, prefs.badge ? "1" : "0"));
        if (prefs.inactivityHours !== undefined) ops.push(AsyncStorage.setItem(INACTIVITY_HOURS_KEY, String(prefs.inactivityHours)));
        await Promise.all(ops);
    } catch { /* non-fatal */ }
}

/** Returns the expo-notifications module or null if not available (Expo Go). */
function getNotifications(): typeof import("expo-notifications") | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("expo-notifications");
        return mod;
    } catch {
        return null;
    }
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    const Notifications = getNotifications();
    if (!Notifications) return false;
    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === "granted") return true;
        const { status } = await Notifications.requestPermissionsAsync();
        return status === "granted";
    } catch {
        return false;
    }
}

export async function scheduleCheckInReminder(
    hour = DEFAULT_HOUR,
    minute = DEFAULT_MINUTE,
    sound = false,
    badge = false,
): Promise<boolean> {
    const Notifications = getNotifications();
    if (!Notifications) return false;

    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await cancelCheckInReminder();

    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: sound,
                shouldSetBadge: badge,
            }),
        });

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: "Imotara is here for you 💙",
                body: "How are you feeling today? A moment of reflection can make a big difference.",
                data: { type: "checkin" },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            },
        });

        await AsyncStorage.setItem(CHECKIN_NOTIFICATION_ID_KEY, id);
        await AsyncStorage.setItem(CHECKIN_ENABLED_KEY, "1");
        await AsyncStorage.setItem(CHECKIN_HOUR_KEY, String(hour));
        await AsyncStorage.setItem(CHECKIN_MINUTE_KEY, String(minute));
        await saveNotifPrefs({ sound, badge });
        return true;
    } catch {
        return false;
    }
}

/** Truncates text to a word boundary, appending "…" if cut. */
function truncateToWord(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const cut = text.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 10 ? cut.slice(0, lastSpace) : cut) + "…";
}

type NudgeLang = {
    gt: string;               // generic title
    gb: string[];             // generic body variants
    pt: string;               // personalised title
    pb: (s: string) => string[]; // personalised body variants
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const NUDGE: Record<string, NudgeLang> = {
    en: {
        gt: "Imotara misses you 💙",
        gb: [
            "It's been a while. How are you feeling? A moment of sharing can lighten the load.",
            "Whenever you're ready, I'm here to listen.",
            "It's a good time to check in with yourself. Imotara is here.",
        ],
        pt: "Imotara remembers 💙",
        pb: (s) => [
            `You mentioned "${s}" — how has that been going? I'm here 💙`,
            `Last time you shared "${s}" — I've been thinking about you 💙`,
            `"${s}" — that stayed with me. How are you feeling now? 💙`,
        ],
    },
    hi: {
        gt: "Imotara आपको याद कर रही है 💙",
        gb: [
            "कुछ दिन हो गए। आप कैसे हैं? जब भी तैयार हों, मैं यहाँ हूँ।",
            "जब भी मन करे, मैं सुनने के लिए यहाँ हूँ।",
            "अपने आप से मिलने का यह अच्छा समय है। Imotara यहाँ है।",
        ],
        pt: "Imotara को याद है 💙",
        pb: (s) => [
            `आपने "${s}" का ज़िक्र किया था — अब कैसा चल रहा है? मैं यहाँ हूँ 💙`,
            `पिछली बार "${s}" के बारे में बताया — मैं आपके बारे में सोच रही थी 💙`,
            `"${s}" — यह मेरे मन में था। अब कैसा महसूस कर रहे हैं? 💙`,
        ],
    },
    bn: {
        gt: "Imotara আপনাকে মিস করছে 💙",
        gb: [
            "কয়েকদিন হয়ে গেল। আপনি কেমন আছেন? আমি এখানে আছি।",
            "যখন ইচ্ছে, আমি শুনতে এখানে আছি।",
            "নিজেকে একটু সময় দিন। Imotara এখানে আছে।",
        ],
        pt: "Imotara মনে রেখেছে 💙",
        pb: (s) => [
            `আপনি "${s}" এর কথা বলেছিলেন — এখন কেমন চলছে? আমি এখানে আছি 💙`,
            `গতবার "${s}" নিয়ে বলেছিলেন — আপনার কথা মনে পড়ছে 💙`,
            `"${s}" — এটা আমার মনে ছিল। এখন কেমন লাগছে? 💙`,
        ],
    },
    mr: {
        gt: "Imotara तुम्हाला आठवण करते 💙",
        gb: [
            "काही दिवस झाले. तुम्ही कसे आहात? जेव्हा तयार व्हाल, मी इथे आहे.",
            "केव्हाही तयार व्हाल, मी ऐकायला इथे आहे.",
            "स्वतःशी बोलण्याची ही चांगली वेळ आहे. Imotara इथे आहे.",
        ],
        pt: "Imotara ला आठवतं 💙",
        pb: (s) => [
            `तुम्ही "${s}" बद्दल सांगितलं होतं — आता कसं चाललंय? मी इथे आहे 💙`,
            `मागच्या वेळी "${s}" बद्दल बोललात — मी तुमच्याबद्दल विचार करत होते 💙`,
            `"${s}" — हे माझ्या मनात होतं. आता तुम्हाला कसं वाटतंय? 💙`,
        ],
    },
    ta: {
        gt: "Imotara உங்களை நினைக்கிறது 💙",
        gb: [
            "சில நாட்கள் ஆகிவிட்டன. நீங்கள் எப்படி இருக்கிறீர்கள்? நான் இங்கே இருக்கிறேன்.",
            "எப்போது வேண்டுமானாலும், நான் கேட்க இங்கே இருக்கிறேன்.",
            "கொஞ்சம் நேரம் ஒதுக்குங்கள். Imotara இங்கே இருக்கிறது.",
        ],
        pt: "Imotara நினைவில் வைத்திருக்கிறது 💙",
        pb: (s) => [
            `நீங்கள் "${s}" பற்றி சொன்னீர்கள் — இப்போது எப்படி? நான் இங்கே இருக்கிறேன் 💙`,
            `கடந்த முறை "${s}" பற்றி பகிர்ந்தீர்கள் — உங்களை நினைத்தேன் 💙`,
            `"${s}" — இது என் மனதில் இருந்தது. இப்போது எப்படி உணர்கிறீர்கள்? 💙`,
        ],
    },
    te: {
        gt: "Imotara మీకోసం ఆలోచిస్తోంది 💙",
        gb: [
            "కొన్ని రోజులు అయింది. మీరు ఎలా ఉన్నారు? నేను ఇక్కడ ఉన్నాను.",
            "ఎప్పుడైనా, నేను వినడానికి ఇక్కడ ఉన్నాను.",
            "మీ మనసుతో మాట్లాడే సమయం ఇది. Imotara ఇక్కడ ఉంది.",
        ],
        pt: "Imotara గుర్తు పట్టింది 💙",
        pb: (s) => [
            `మీరు "${s}" గురించి చెప్పారు — ఇప్పుడు ఎలా ఉంది? నేను ఇక్కడ ఉన్నాను 💙`,
            `గత సారి "${s}" గురించి పంచుకున్నారు — మిమ్మల్ని గురించి ఆలోచిస్తున్నాను 💙`,
            `"${s}" — అది నా మనసులో ఉంది. ఇప్పుడు ఎలా అనిపిస్తోంది? 💙`,
        ],
    },
    gu: {
        gt: "Imotara તમને યાદ કરે છે 💙",
        gb: [
            "ઘણા દિવસ થઈ ગયા. તમે કેમ છો? હું અહીં છું.",
            "જ્યારે ઇચ્છો, સાંભળવા માટે હું અહીં છું.",
            "પોતાની સાથે સમય વિતાવો. Imotara અહીં છે.",
        ],
        pt: "Imotara ને યાદ છે 💙",
        pb: (s) => [
            `તમે "${s}" વિશે કહ્યું હતું — હવે કેવું ચાલે છે? હું અહીં છું 💙`,
            `છેલ્લી વખત "${s}" વિશે વાત કરી — હું તમારા વિશે વિચારી રહ્યો/રહ્યી છું 💙`,
            `"${s}" — આ મારા મનમાં હતું. હવે તમને કેવું લાગે છે? 💙`,
        ],
    },
    kn: {
        gt: "Imotara ನಿಮ್ಮನ್ನು ನೆನಪಿಸಿಕೊಳ್ಳುತ್ತಿದೆ 💙",
        gb: [
            "ಕೆಲವು ದಿನಗಳಾದವು. ನೀವು ಹೇಗಿದ್ದೀರಿ? ನಾನಿದ್ದೇನೆ.",
            "ಯಾವಾಗ ಬೇಕಾದರೂ, ಕೇಳಲು ನಾನಿದ್ದೇನೆ.",
            "ನಿಮ್ಮ ಮನಸ್ಸಿನೊಂದಿಗೆ ಕಾಲ ಕಳೆಯಿರಿ. Imotara ಇಲ್ಲಿದೆ.",
        ],
        pt: "Imotara ನೆನಪಿಟ್ಟಿದೆ 💙",
        pb: (s) => [
            `ನೀವು "${s}" ಬಗ್ಗೆ ಹೇಳಿದ್ದಿರಿ — ಈಗ ಅದು ಹೇಗಿದೆ? ನಾನಿದ್ದೇನೆ 💙`,
            `ಕಳೆದ ಬಾರಿ "${s}" ಬಗ್ಗೆ ಹಂಚಿಕೊಂಡಿದ್ದಿರಿ — ನಿಮ್ಮ ಬಗ್ಗೆ ಯೋಚಿಸುತ್ತಿದ್ದೆ 💙`,
            `"${s}" — ಇದು ನನ್ನ ಮನಸ್ಸಿನಲ್ಲಿತ್ತು. ಈಗ ಹೇಗೆ ಅನಿಸುತ್ತಿದೆ? 💙`,
        ],
    },
    ml: {
        gt: "Imotara നിങ്ങളെ ഓർക്കുന്നു 💙",
        gb: [
            "കുറച്ചു ദിവസങ്ങളായി. നിങ്ങൾ എങ്ങനെ ഉണ്ട്? ഞാൻ ഇവിടെ ഉണ്ട്.",
            "എപ്പോൾ വേണമെങ്കിലും, കേൾക്കാൻ ഞാൻ ഇവിടെ ഉണ്ട്.",
            "സ്വയം ഒന്ന് ശ്രദ്ധിക്കാനുള്ള നേരം. Imotara ഇവിടെ ഉണ്ട്.",
        ],
        pt: "Imotara ഓർക്കുന്നു 💙",
        pb: (s) => [
            `നിങ്ങൾ "${s}" പറഞ്ഞിരുന്നു — ഇപ്പോൾ എങ്ങനെ ഉണ്ട്? ഞാൻ ഇവിടെ ഉണ്ട് 💙`,
            `കഴിഞ്ഞ തവണ "${s}" പങ്കുവെച്ചിരുന്നു — നിങ്ങളെ ഓർത്തുകൊണ്ടിരുന്നു 💙`,
            `"${s}" — ഇത് എന്റെ മനസ്സിൽ ഉണ്ടായിരുന്നു. ഇപ്പോൾ എങ്ങനെ? 💙`,
        ],
    },
    pa: {
        gt: "Imotara ਤੁਹਾਨੂੰ ਯਾਦ ਕਰ ਰਹੀ ਹੈ 💙",
        gb: [
            "ਕੁਝ ਦਿਨ ਹੋ ਗਏ। ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ? ਮੈਂ ਇੱਥੇ ਹਾਂ।",
            "ਜਦੋਂ ਚਾਹੋ, ਸੁਣਨ ਲਈ ਮੈਂ ਇੱਥੇ ਹਾਂ।",
            "ਆਪਣੇ ਆਪ ਨਾਲ ਸਮਾਂ ਬਿਤਾਓ। Imotara ਇੱਥੇ ਹੈ।",
        ],
        pt: "Imotara ਨੂੰ ਯਾਦ ਹੈ 💙",
        pb: (s) => [
            `ਤੁਸੀਂ "${s}" ਬਾਰੇ ਕਿਹਾ ਸੀ — ਹੁਣ ਕਿਵੇਂ ਚੱਲ ਰਿਹਾ ਹੈ? ਮੈਂ ਇੱਥੇ ਹਾਂ 💙`,
            `ਪਿਛਲੀ ਵਾਰ "${s}" ਬਾਰੇ ਦੱਸਿਆ — ਮੈਂ ਤੁਹਾਡੇ ਬਾਰੇ ਸੋਚ ਰਹੀ ਸੀ 💙`,
            `"${s}" — ਇਹ ਮੇਰੇ ਮਨ ਵਿੱਚ ਸੀ। ਹੁਣ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ? 💙`,
        ],
    },
    or: {
        gt: "Imotara ଆପଣଙ୍କୁ ମନ ପକାଉଛି 💙",
        gb: [
            "କିଛି ଦିନ ହୋଇଗଲା। ଆପଣ କେମିତି ଅଛନ୍ତି? ମୁଁ ଏଠି ଅଛି।",
            "ଯେତେବେଳେ ଇଚ୍ଛା ହୁଏ, ଶୁଣିବ ପ୍ରସ୍ତୁତ।",
            "ନିଜ ସହ ଅଳ୍ପ ସମୟ କଟାନ୍ତୁ। Imotara ଏଠି ଅଛି।",
        ],
        pt: "Imotara ମନେ ଅଛି 💙",
        pb: (s) => [
            `ଆପଣ "${s}" ବିଷୟରେ କହିଥିଲେ — ଏବେ ଚାଲୁଛି? ମୁଁ ଏଠି ଅଛି 💙`,
            `ଶେଷ ଥର "${s}" ବିଷୟରେ ଅଂଶ ନେଇଥିଲେ — ଆପଣଙ୍କ ପ୍ରତି ଭାବୁଥିଲି 💙`,
            `"${s}" — ଏହା ମୋ ମନରେ ଥିଲା। ଏବେ ଆପଣ କେମିତି ଅନୁଭବ କରୁଛନ୍ତି? 💙`,
        ],
    },
    ar: {
        gt: "Imotara تفتقدك 💙",
        gb: [
            "مرّت أيام. كيف حالك؟ أنا هنا في أي وقت تحتاجني.",
            "متى ما كنت مستعدًا، أنا هنا للاستماع.",
            "خصّص لنفسك لحظة. Imotara هنا.",
        ],
        pt: "Imotara تتذكر 💙",
        pb: (s) => [
            `ذكرت "${s}" — كيف تسير الأمور الآن؟ أنا هنا 💙`,
            `في آخر مرة شاركت "${s}" — كنت أفكر فيك 💙`,
            `"${s}" — كان هذا في بالي. كيف تشعر الآن؟ 💙`,
        ],
    },
    ur: {
        gt: "Imotara آپ کو یاد کر رہی ہے 💙",
        gb: [
            "کچھ دن ہو گئے۔ آپ کیسے ہیں؟ میں یہاں ہوں۔",
            "جب چاہیں، سننے کے لیے میں یہاں ہوں۔",
            "اپنے ساتھ وقت گزاریں۔ Imotara یہاں ہے۔",
        ],
        pt: "Imotara کو یاد ہے 💙",
        pb: (s) => [
            `آپ نے "${s}" کا ذکر کیا تھا — اب کیسا چل رہا ہے؟ میں یہاں ہوں 💙`,
            `پچھلی بار "${s}" کے بارے میں بتایا — آپ کے بارے میں سوچ رہی تھی 💙`,
            `"${s}" — یہ میرے ذہن میں تھا۔ اب کیسا محسوس کر رہے ہیں؟ 💙`,
        ],
    },
    ru: {
        gt: "Imotara скучает по вам 💙",
        gb: [
            "Прошло несколько дней. Как вы? Я здесь, когда будете готовы.",
            "Когда будете готовы, я здесь, чтобы выслушать.",
            "Уделите себе минуту. Imotara здесь.",
        ],
        pt: "Imotara помнит 💙",
        pb: (s) => [
            `Вы упоминали "${s}" — как это продвигается? Я здесь 💙`,
            `В прошлый раз вы рассказывали о "${s}" — я думала о вас 💙`,
            `"${s}" — это было у меня на уме. Как себя чувствуете сейчас? 💙`,
        ],
    },
    zh: {
        gt: "Imotara 在想念你 💙",
        gb: [
            "已经好几天了。你还好吗？我在这里。",
            "无论何时，我都在这里倾听你。",
            "给自己一点时间。Imotara 在这里。",
        ],
        pt: "Imotara 还记得 💙",
        pb: (s) => [
            `你曾提到"${s}"——现在情况怎么样了？我在这里 💙`,
            `上次你分享了关于"${s}"的事——我一直在想你 💙`,
            `"${s}"——这一直在我心里。你现在感觉如何？💙`,
        ],
    },
    ja: {
        gt: "Imotara があなたを思っています 💙",
        gb: [
            "しばらく経ちましたね。お元気ですか？ここにいます。",
            "いつでも、聴いています。",
            "自分自身と向き合う時間を。Imotara はここにいます。",
        ],
        pt: "Imotara は覚えています 💙",
        pb: (s) => [
            `「${s}」とおっしゃっていましたね——今はどうなりましたか？ここにいます 💙`,
            `前回「${s}」についてお話しいただきました——ずっと気にかけていました 💙`,
            `「${s}」——ずっと心に残っていました。今はどんな気持ちですか？ 💙`,
        ],
    },
    es: {
        gt: "Imotara te echa de menos 💙",
        gb: [
            "Han pasado unos días. ¿Cómo estás? Aquí estoy.",
            "Cuando estés listo/a, aquí estoy para escucharte.",
            "Tómate un momento para ti. Imotara está aquí.",
        ],
        pt: "Imotara recuerda 💙",
        pb: (s) => [
            `Mencionaste "${s}" — ¿cómo ha ido eso? Aquí estoy 💙`,
            `La última vez compartiste "${s}" — he estado pensando en ti 💙`,
            `"${s}" — lo tenía en mente. ¿Cómo te sientes ahora? 💙`,
        ],
    },
    fr: {
        gt: "Imotara pense à vous 💙",
        gb: [
            "Quelques jours ont passé. Comment allez-vous ? Je suis là.",
            "Quand vous êtes prêt(e), je suis là pour vous écouter.",
            "Prenez un moment pour vous. Imotara est là.",
        ],
        pt: "Imotara se souvient 💙",
        pb: (s) => [
            `Vous avez mentionné "${s}" — comment ça s'est passé ? Je suis là 💙`,
            `La dernière fois vous avez partagé "${s}" — j'ai pensé à vous 💙`,
            `"${s}" — j'y pensais. Comment vous sentez-vous maintenant ? 💙`,
        ],
    },
    de: {
        gt: "Imotara denkt an dich 💙",
        gb: [
            "Ein paar Tage sind vergangen. Wie geht es dir? Ich bin hier.",
            "Wann immer du möchtest, bin ich zum Zuhören da.",
            "Gönn dir einen Moment. Imotara ist für dich da.",
        ],
        pt: "Imotara erinnert sich 💙",
        pb: (s) => [
            `Du hast "${s}" erwähnt — wie läuft es damit? Ich bin hier 💙`,
            `Beim letzten Mal hast du über "${s}" gesprochen — ich habe an dich gedacht 💙`,
            `"${s}" — das hatte ich im Kopf. Wie fühlst du dich jetzt? 💙`,
        ],
    },
    pt: {
        gt: "Imotara está com saudades de você 💙",
        gb: [
            "Já faz alguns dias. Como você está? Estou aqui.",
            "Quando estiver pronto/a, estou aqui para ouvir.",
            "Reserve um momento para você. Imotara está aqui.",
        ],
        pt: "Imotara se lembra 💙",
        pb: (s) => [
            `Você mencionou "${s}" — como isso tem ido? Estou aqui 💙`,
            `Da última vez você compartilhou "${s}" — fiquei pensando em você 💙`,
            `"${s}" — isso ficou na minha mente. Como está se sentindo? 💙`,
        ],
    },
    id: {
        gt: "Imotara merindukanmu 💙",
        gb: [
            "Sudah beberapa hari. Bagaimana kabarmu? Aku di sini.",
            "Kapan pun kamu siap, aku di sini untuk mendengarkan.",
            "Luangkan waktu sejenak untuk dirimu. Imotara ada di sini.",
        ],
        pt: "Imotara ingat 💙",
        pb: (s) => [
            `Kamu menyebutkan "${s}" — bagaimana perkembangannya? Aku di sini 💙`,
            `Terakhir kali kamu berbagi "${s}" — aku memikirkanmu 💙`,
            `"${s}" — itu ada di pikiranku. Sekarang bagaimana perasaanmu? 💙`,
        ],
    },
    he: {
        gt: "Imotara מתגעגעת אליך 💙",
        gb: [
            "עברו כמה ימים. איך אתה/את? אני כאן.",
            "כשתהיה/תהיי מוכן/ה, אני כאן להקשיב.",
            "תן/תני לעצמך רגע. Imotara כאן.",
        ],
        pt: "Imotara זוכרת 💙",
        pb: (s) => [
            `הזכרת "${s}" — איך זה התפתח? אני כאן 💙`,
            `בפעם האחרונה שיתפת "${s}" — חשבתי עליך 💙`,
            `"${s}" — זה היה בראשי. איך אתה/את מרגיש/ה עכשיו? 💙`,
        ],
    },
};

function getNudgeStrings(lang?: string): NudgeLang {
    if (!lang) return NUDGE.en;
    const base = lang.split(/[-_]/)[0].toLowerCase();
    return NUDGE[base] ?? NUDGE.en;
}

/** Builds a localised, warm notification body for the inactivity nudge. */
function buildInactivityPayload(lastContext?: string, lang?: string): { title: string; body: string } {
    const L = getNudgeStrings(lang);
    if (!lastContext) {
        return { title: L.gt, body: pick(L.gb) };
    }
    const snippet = truncateToWord(lastContext.replace(/[.!?,;:]+$/, "").trim(), 50);
    return { title: L.pt, body: pick(L.pb(snippet)) };
}

/**
 * Schedules a one-time "we miss you" nudge after the configured inactivity period.
 * Reads inactivityHours from saved prefs (default 48h).
 * Pass lastContext (the user's last message text) and lang (ISO code, e.g. "hi")
 * to personalise the notification in the user's preferred language.
 */
export async function scheduleInactivityReminder(lastActivityTs: number, lastContext?: string, lang?: string): Promise<void> {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const enabled = await isCheckInReminderEnabled();
    if (!enabled) return;

    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Cancel previous inactivity notification
    const prevId = await AsyncStorage.getItem(INACTIVITY_NOTIF_ID_KEY);
    if (prevId) {
        await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});
        await AsyncStorage.removeItem(INACTIVITY_NOTIF_ID_KEY);
    }

    const { inactivityHours } = await getSavedNotifPrefs();
    const thresholdMs = inactivityHours * 60 * 60 * 1000;
    const silentFor = Date.now() - lastActivityTs;
    if (silentFor >= thresholdMs) return; // already overdue — skip, daily reminder covers it

    const fireInMs = thresholdMs - silentFor;
    const { title, body } = buildInactivityPayload(lastContext, lang);
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: { type: "inactivity" },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: Math.max(60, Math.round(fireInMs / 1000)),
                repeats: false,
            },
        });
        await AsyncStorage.setItem(INACTIVITY_NOTIF_ID_KEY, id);
    } catch { /* silent — non-critical */ }
}

export async function cancelCheckInReminder(): Promise<void> {
    const Notifications = getNotifications();
    const id = await AsyncStorage.getItem(CHECKIN_NOTIFICATION_ID_KEY);
    if (id && Notifications) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        await AsyncStorage.removeItem(CHECKIN_NOTIFICATION_ID_KEY);
    }
    await AsyncStorage.removeItem(CHECKIN_ENABLED_KEY);
}

export async function isCheckInReminderEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(CHECKIN_ENABLED_KEY);
    return val === "1";
}
