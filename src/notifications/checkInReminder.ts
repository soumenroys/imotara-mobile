// src/notifications/checkInReminder.ts
// Schedules / cancels a daily "How are you feeling?" check-in reminder.
// Uses expo-notifications with a lazy require so the app doesn't crash
// in Expo Go / Simulator builds where the native module isn't linked yet.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHECKIN_NOTIFICATION_ID_KEY = "imotara.checkin.notif.id";
const CHECKIN_ENABLED_KEY = "imotara.checkin.enabled";
/** Language the scheduled reminder should speak. Written when rescheduling. */
const CHECKIN_LANG_KEY = "imotara.checkin.lang";
const CHECKIN_HOUR_KEY = "imotara.checkin.hour";
const CHECKIN_MINUTE_KEY = "imotara.checkin.minute";
const INACTIVITY_NOTIF_ID_KEY = "imotara.checkin.inactivity.id";
const CHECKIN_SOUND_KEY = "imotara.checkin.sound";
const CHECKIN_BADGE_KEY = "imotara.checkin.badge";
const INACTIVITY_HOURS_KEY = "imotara.checkin.inactivity.hours";
// The companion's chosen name, kept here so a notification scheduled for
// tomorrow morning says what the app says today.
const COMPANION_NAME_KEY = "imotara.checkin.companionName";

/**
 * Speak as the companion. Every notification string in this file was written
 * with the default name in it — 67 lines across ~20 languages — and the
 * on-device reply engine already proves that substituting the name onto
 * finished text is the durable way to do this (localReplyEngine.ts does the
 * same replaceAll at the very end). The default name leaves the text untouched.
 */
export function withCompanionName(text: string, name?: string | null): string {
    const n = (name ?? "").trim();
    if (!n || n === "Imotara") return text;
    return text.replaceAll("Imotara", n);
}

async function getSavedCompanionName(): Promise<string | null> {
    try { return await AsyncStorage.getItem(COMPANION_NAME_KEY); } catch { return null; }
}

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

/**
 * Why a scheduling attempt failed — the three cases a person can act on very
 * differently:
 *
 *   unavailable — no notifications module in this build, or web. Nothing the
 *                 person can do; sending them to device settings is a wild goose chase.
 *   permission  — the OS refused or they declined. Device settings DO fix this.
 *   failed      — module present, permission granted, and it still threw.
 *
 * The distinction is not theoretical. On 2026-09-16 a fault deep inside
 * expo-notifications (R8 had stripped its Serializable hooks — see app.json's
 * extraProguardRules) surfaced to the owner as "Permission needed" and sent an
 * investigation at device settings for an hour, while POST_NOTIFICATIONS had
 * been granted the whole time.
 */
export type ReminderFailureReason = "unavailable" | "permission" | "failed";
export type ReminderScheduleResult = { ok: true } | { ok: false; reason: ReminderFailureReason };

export async function scheduleCheckInReminderWithReason(
    hour = DEFAULT_HOUR,
    minute = DEFAULT_MINUTE,
    sound = false,
    badge = false,
): Promise<ReminderScheduleResult> {
    const Notifications = getNotifications();
    if (!Notifications || Platform.OS === "web") return { ok: false, reason: "unavailable" };

    const granted = await requestNotificationPermission();
    if (!granted) return { ok: false, reason: "permission" };

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

        const companionName = await getSavedCompanionName();
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: withCompanionName("Imotara is here for you 💙", companionName),
                // ⛔ No longer one static line. buildCheckInBody picks copy in
                // the person's language and, when there is something to refer
                // back to, names the DAY of the last conversation — never what
                // was said. A lock screen is read by whoever picks the phone up.
                body: await buildCheckInBody(),
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
        return { ok: true };
    } catch (e) {
        // Never swallow this silently again. A bare `catch {}` here is what
        // left the R8 NotSerializableException invisible to JS: the only trace
        // was a native logcat line nobody was looking at yet.
        console.warn("[checkInReminder] could not schedule the daily reminder:", e);
        return { ok: false, reason: "failed" };
    }
}

/**
 * Boolean form, for the callers that only re-arm an already-enabled reminder
 * and have nothing to tell the user.
 *
 * ⚠️ Keep the boolean. Four call sites do `.catch(() => {})` on this and one
 * did `if (ok)`; returning the result object here instead would read as
 * TRUTHY at that site — reporting success for every single failure.
 */
export async function scheduleCheckInReminder(
    hour = DEFAULT_HOUR,
    minute = DEFAULT_MINUTE,
    sound = false,
    badge = false,
): Promise<boolean> {
    return (await scheduleCheckInReminderWithReason(hour, minute, sound, badge)).ok;
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
    /**
     * Personalised body variants — call with the LOCALISED WEEKDAY of the last
     * conversation.
     *
     * ⛔ Never the person's own words. A lock-screen notification is read by
     * whoever picks the phone up: a partner, a parent, a colleague. Quoting
     * someone's message about their marriage or their diagnosis can out their
     * use of a mental-health app to the person they are trying to get away
     * from. Mirrors imotaraapp/src/lib/imotara/nudgeStrings.ts.
     */
    rb: (day: string) => string[];
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
        rb: (d) => [
            `There\u2019s something from ${d} I\u2019ve been wondering about.`,
            `Something from ${d} has stayed with me. How are you now?`,
            `I\u2019ve been thinking about ${d}. Want to pick it up?`,
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
        rb: (d) => [
            `${d} की एक बात मेरे मन में है।`,
            `${d} की बात मुझे याद है। अब कैसा लग रहा है?`,
            `${d} के बारे में सोच रही थी। बात करें?`,
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
        rb: (d) => [
            `${d}-এর একটা কথা আমার মনে আছে।`,
            `${d}-এ যা বলেছিলে, মনে রয়ে গেছে। এখন কেমন লাগছে?`,
            `${d}-এর কথা ভাবছিলাম। একটু বলবে?`,
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
        rb: (d) => [
            `${d}ची एक गोष्ट माझ्या मनात आहे.`,
            `${d}चं बोलणं लक्षात राहिलं. आता कसं वाटतंय?`,
            `${d}बद्दल विचार करत होते. बोलूया?`,
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
        rb: (d) => [
            `${d} அன்று பேசியது மனதில் இருக்கிறது.`,
            `${d} அன்றைய விஷயம் நினைவில் உள்ளது. இப்போது எப்படி இருக்கிறீர்கள்?`,
            `${d} பற்றி யோசித்துக் கொண்டிருந்தேன். பேசலாமா?`,
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
        rb: (d) => [
            `${d} నాటి ఒక విషయం నా మనసులో ఉంది.`,
            `${d} నాడు చెప్పినది గుర్తుంది. ఇప్పుడు ఎలా ఉంది?`,
            `${d} గురించి ఆలోచిస్తున్నాను. మాట్లాడదామా?`,
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
        rb: (d) => [
            `${d}ની એક વાત મારા મનમાં છે.`,
            `${d}ની વાત યાદ રહી ગઈ. અત્યારે કેવું લાગે છે?`,
            `${d} વિશે વિચારતી હતી. વાત કરીએ?`,
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
        rb: (d) => [
            `${d} ದಿನದ ಒಂದು ವಿಷಯ ನನ್ನ ಮನಸ್ಸಿನಲ್ಲಿದೆ.`,
            `${d} ಹೇಳಿದ್ದು ನೆನಪಿದೆ. ಈಗ ಹೇಗನಿಸುತ್ತಿದೆ?`,
            `${d} ಬಗ್ಗೆ ಯೋಚಿಸುತ್ತಿದ್ದೆ. ಮಾತಾಡೋಣವೇ?`,
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
        rb: (d) => [
            `${d} പറഞ്ഞ ഒരു കാര്യം മനസ്സിലുണ്ട്.`,
            `${d} പറഞ്ഞത് ഓർമ്മയിലുണ്ട്. ഇപ്പോൾ എങ്ങനെയുണ്ട്?`,
            `${d} കുറിച്ച് ആലോചിക്കുകയായിരുന്നു. സംസാരിക്കാമോ?`,
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
        rb: (d) => [
            `${d} ਦੀ ਇੱਕ ਗੱਲ ਮੇਰੇ ਮਨ ਵਿੱਚ ਹੈ।`,
            `${d} ਦੀ ਗੱਲ ਯਾਦ ਰਹੀ। ਹੁਣ ਕਿਵੇਂ ਲੱਗ ਰਿਹਾ ਹੈ?`,
            `${d} ਬਾਰੇ ਸੋਚ ਰਹੀ ਸੀ। ਗੱਲ ਕਰੀਏ?`,
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
        rb: (d) => [
            `${d} ର ଗୋଟିଏ କଥା ମୋ ମନରେ ଅଛି।`,
            `${d} ରେ କହିଥିବା କଥା ମନେ ଅଛି। ଏବେ କେମିତି ଲାଗୁଛି?`,
            `${d} ବିଷୟରେ ଭାବୁଥିଲି। କଥା ହେବା?`,
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
        rb: (d) => [
            `هناك شيء من يوم ${d} ما زلت أفكر فيه.`,
            `ما قلته يوم ${d} بقي في بالي. كيف حالك الآن؟`,
            `كنت أفكر في يوم ${d}. نتحدث؟`,
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
        rb: (d) => [
            `${d} کی ایک بات میرے ذہن میں ہے۔`,
            `${d} کو جو کہا تھا، یاد رہ گیا۔ اب کیسا لگ رہا ہے؟`,
            `${d} کے بارے میں سوچ رہی تھی۔ بات کریں؟`,
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
        rb: (d) => [
            `Есть кое-что с ${d}, о чём я думаю.`,
            `То, что вы сказали в ${d}, осталось со мной. Как вы сейчас?`,
            `Я думала о ${d}. Поговорим?`,
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
        rb: (d) => [
            `${d}的一件事我一直记着。`,
            `${d}你说的话我还记得。现在感觉怎么样？`,
            `我一直在想${d}的事。要聊聊吗？`,
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
        rb: (d) => [
            `${d}のことが、ずっと心に残っています。`,
            `${d}に話してくれたこと、覚えています。今はどうですか？`,
            `${d}のこと、考えていました。少し話しませんか。`,
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
        rb: (d) => [
            `Hay algo del ${d} en lo que he estado pensando.`,
            `Algo del ${d} se me quedó. ¿Cómo estás ahora?`,
            `He estado pensando en el ${d}. ¿Hablamos?`,
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
        rb: (d) => [
            `Il y a quelque chose de ${d} auquel je repense.`,
            `Quelque chose de ${d} m\u2019est resté. Comment allez-vous maintenant ?`,
            `Je repensais à ${d}. On en parle ?`,
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
        rb: (d) => [
            `Da ist etwas von ${d}, worüber ich nachgedacht habe.`,
            `Etwas von ${d} ist mir geblieben. Wie geht es Ihnen jetzt?`,
            `Ich habe an ${d} gedacht. Wollen wir reden?`,
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
        rb: (d) => [
            `Há algo de ${d} em que tenho pensado.`,
            `Algo de ${d} ficou comigo. Como está agora?`,
            `Tenho pensado em ${d}. Conversamos?`,
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
        rb: (d) => [
            `Ada sesuatu dari hari ${d} yang masih saya pikirkan.`,
            `Sesuatu dari ${d} masih terasa. Bagaimana kabarmu sekarang?`,
            `Saya memikirkan ${d}. Mau cerita?`,
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
        rb: (d) => [
            `יש משהו מ${d} שאני עדיין חושבת עליו.`,
            `משהו מ${d} נשאר איתי. איך את/ה מרגיש/ה עכשיו?`,
            `חשבתי על ${d}. רוצה לדבר?`,
        ],
    },
};

export function getNudgeStrings(lang?: string): NudgeLang {
    if (!lang) return NUDGE.en;
    const base = lang.split(/[-_]/)[0].toLowerCase();
    return NUDGE[base] ?? NUDGE.en;
}

/** Builds a localised, warm notification body for the inactivity nudge. */
/**
 * The localised weekday of a conversation, e.g. "বৃহস্পতিবার" for bn.
 *
 * Verified 2026-10-13 that ICU resolves a native weekday for all 22 supported
 * languages, Odia and Malayalam included. Returns null on failure so the caller
 * falls back to the generic copy rather than shipping a half-built sentence.
 */
export function localisedWeekday(at: Date, lang?: string | null): string | null {
    try {
        const base = String(lang ?? "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
        const w = new Intl.DateTimeFormat(base, { weekday: "long" }).format(at);
        return w && w.trim() ? w : null;
    } catch {
        return null;
    }
}

/**
 * Body for the inactivity nudge.
 *
 * ⛔ `lastActivityAt` replaced the old `lastContext` string on purpose: the
 * payload now references WHEN the conversation happened, never WHAT was said.
 * Taking a Date rather than text makes it impossible to pass a message in by
 * accident — the type no longer allows it.
 */
export function buildInactivityPayload(
    lastActivityAt?: Date | null,
    lang?: string,
    companionName?: string | null,
): { title: string; body: string } {
    const L = getNudgeStrings(lang);
    const say = (t: string) => withCompanionName(t, companionName);
    const generic = { title: say(L.gt), body: say(pick(L.gb)) };
    if (!lastActivityAt) return generic;
    const day = localisedWeekday(lastActivityAt, lang);
    if (!day) return generic;
    return { title: say(L.pt), body: say(pick(L.rb(day))) };
}

/**
 * Body for the DAILY check-in reminder, in the person's language.
 *
 * ⚠️ Local notifications are scheduled with FIXED TEXT at schedule time, so
 * this cannot ask about a conversation that has not happened yet — the text is
 * at best one session stale. That is why ChatScreen reschedules after each
 * session rather than scheduling once and forgetting.
 */
export async function buildCheckInBody(): Promise<string> {
    try {
        const [lang, companionName] = await Promise.all([
            AsyncStorage.getItem(CHECKIN_LANG_KEY),
            getSavedCompanionName(),
        ]);
        const L = getNudgeStrings(lang ?? undefined);
        return withCompanionName(pick(L.gb), companionName);
    } catch {
        return "How are you feeling today? A moment of reflection can make a big difference.";
    }
}

/**
 * Schedules a one-time "we miss you" nudge after the configured inactivity period.
 * Reads inactivityHours from saved prefs (default 48h).
 * Pass lastContext (the user's last message text) and lang (ISO code, e.g. "hi")
 * to personalise the notification in the user's preferred language.
 */
/**
 * ⚠️ `lastContext` was REMOVED from this signature on purpose (2026-10-13).
 * It used to carry the person's last message so the nudge could quote it. The
 * nudge now names the day instead, and taking the text at all would invite
 * someone to put it back on a lock screen.
 */
export async function scheduleInactivityReminder(lastActivityTs: number, lang?: string): Promise<void> {
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
    // ⛔ lastActivityTs, NOT lastContext. The payload references when the
    // conversation happened, never what was said.
    const { title, body } = buildInactivityPayload(
        new Date(lastActivityTs), lang, await getSavedCompanionName());
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

/**
 * Called when the companion is renamed in Settings.
 *
 * The daily reminder is scheduled with a REPEATING trigger and its title is
 * baked in at schedule time, so without this a person who renames their
 * companion keeps being greeted by the old name every morning until they
 * happen to toggle the reminder. Saves the name, then — only if the reminder is
 * on — reschedules it with the saved time and preferences so nothing else
 * about it changes.
 */
export async function setCompanionNameForReminders(name: string | null | undefined): Promise<void> {
    const n = (name ?? "").trim();
    try {
        if (n) await AsyncStorage.setItem(COMPANION_NAME_KEY, n);
        else await AsyncStorage.removeItem(COMPANION_NAME_KEY);
    } catch { /* non-critical */ }
    if (!(await isCheckInReminderEnabled())) return;
    const { hour, minute } = await getSavedReminderTime();
    const { sound, badge } = await getSavedNotifPrefs();
    await scheduleCheckInReminder(hour, minute, sound, badge).catch(() => {});
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

/**
 * Cancels a pending inactivity ("we miss you") nudge, if one is scheduled.
 *
 * Deliberately NOT folded into cancelCheckInReminder(): that also runs before
 * every re-arm of the daily reminder (a time change, a rename), and dropping
 * the nudge on each of those would lose it until the person's next message.
 * Only "reminders off" should take the nudge with it — found on a real device,
 * where a nudge stayed armed for 48h after the reminder had been switched off.
 */
export async function cancelInactivityReminder(): Promise<void> {
    const Notifications = getNotifications();
    const id = await AsyncStorage.getItem(INACTIVITY_NOTIF_ID_KEY);
    if (!id) return;
    if (Notifications) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(INACTIVITY_NOTIF_ID_KEY);
}

export async function isCheckInReminderEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(CHECKIN_ENABLED_KEY);
    // ⚠️ DEFAULT ON (owner requirement 2026-10-10). This used to be
    // `val === "1"`, so an unset key meant OFF and the reminder only existed
    // for people who went looking for it.
    //
    // ⛔ "0" is the only way to be off. An unset key is a person who has never
    // expressed a preference, and the product's default for them is on — not a
    // silent opt-out they never chose.
    //
    // 🔑 This flag is the SETTING, not the outcome: iOS delivers nothing without
    // the permission prompt and Android 13+ needs POST_NOTIFICATIONS. A toggle
    // reading ON while the OS refuses is the setup-≠-outcome trap, which is why
    // scheduleCheckInReminderWithReason reports a reason rather than a boolean.
    return val !== "0";
}

// ─── Snooze ──────────────────────────────────────────────────────────────────
//
// Owner decision 2026-10-13, option (a): Free may pause for 3 or 5 days; paid
// tiers may turn reminders off for good.
//
// ⛔ On mobile the reminder is a LOCAL notification, so a stored date alone
// suppresses nothing — the OS would still fire what is already scheduled. A
// snooze must therefore CANCEL the scheduled notification and re-arm it when
// the pause ends. A flag that changes nothing is the setup-≠-outcome trap.

/** ISO instant the current pause ends. Absent when not paused. */
const CHECKIN_SNOOZED_UNTIL_KEY = "imotara.checkin.snoozedUntil";

/** Pause lengths offered. Mirrors SNOOZE_DAYS in the web repo. */
export const SNOOZE_DAYS = [3, 5] as const;
export type SnoozeDays = (typeof SNOOZE_DAYS)[number];

/**
 * When the pause ends, or null.
 *
 * ⚠️ Junk must NOT read as "paused forever": that would silence someone's
 * reminders permanently with no way for them to notice.
 */
export async function getSnoozedUntil(now: Date = new Date()): Promise<Date | null> {
    try {
        const raw = await AsyncStorage.getItem(CHECKIN_SNOOZED_UNTIL_KEY);
        if (!raw) return null;
        const t = Date.parse(raw);
        if (!Number.isFinite(t) || t <= now.getTime()) return null;
        return new Date(t);
    } catch {
        return null;
    }
}

/** True while a pause is running. */
export async function isSnoozed(now: Date = new Date()): Promise<boolean> {
    return (await getSnoozedUntil(now)) !== null;
}

/**
 * Pauses the daily reminder for `days`, cancelling what is already scheduled.
 * Returns when it will resume, so the caller can SAY so — silent resumption is
 * what produces "this app won't stop notifying me".
 */
export async function snoozeCheckInReminder(
    days: SnoozeDays,
    now: Date = new Date(),
): Promise<Date | null> {
    if (!(SNOOZE_DAYS as readonly number[]).includes(days)) return null;
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    try {
        await AsyncStorage.setItem(CHECKIN_SNOOZED_UNTIL_KEY, until.toISOString());
        // ⛔ The cancel is the part that actually works. Without it the OS keeps
        // firing the already-scheduled reminder and the control is theatre.
        await cancelCheckInReminder();
        await cancelInactivityReminder();
        return until;
    } catch {
        return null;
    }
}

/** Clears a pause. ⚠️ Always permitted — only turning reminders OFF is a paid control. */
export async function resumeCheckInReminder(): Promise<void> {
    try {
        await AsyncStorage.removeItem(CHECKIN_SNOOZED_UNTIL_KEY);
    } catch {
        /* ignore */
    }
}

/**
 * Re-arms the reminder once a pause has expired.
 *
 * Call on app open. ⚠️ Nothing else will: the notification was cancelled, so
 * there is no scheduled event to wake us up and put it back. Without this a
 * 3-day pause would be permanent, which is exactly the free-tier trap the
 * owner's option (a) is meant not to be.
 */
export async function rearmAfterSnooze(now: Date = new Date()): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(CHECKIN_SNOOZED_UNTIL_KEY);
        if (!raw) return false;
        const t = Date.parse(raw);
        if (Number.isFinite(t) && t > now.getTime()) return false; // still paused
        await AsyncStorage.removeItem(CHECKIN_SNOOZED_UNTIL_KEY);
        if (!(await isCheckInReminderEnabled())) return false;
        const { hour, minute } = await getSavedReminderTime();
        const res = await scheduleCheckInReminderWithReason(hour, minute);
        return res.ok;
    } catch {
        return false;
    }
}
