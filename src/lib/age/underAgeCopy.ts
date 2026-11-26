// src/lib/age/underAgeCopy.ts
//
// #159 — words for the under-13 stop screen. Gentle, never scolding: the
// person reading it is a child, and may be a child in trouble.
//
// The HELP part of the screen does not live here: it reuses the consent gate's
// `emergencyLead` (all 22 languages) and getCrisisResourcesForCountry(), so the
// line that matters most is never left in English.
//
// ⚠️ Only en / hi / bn are written so far; other languages fall back to English
// for these two lines until a native reader checks them (board #159 follow-up).

// `emergencyLead` (optional): the help line in the SAME register as `body`. The consent
// gate's line is written for adults (Bengali আপনি) — on a child's screen it read cold
// next to the তুমি body (Dec release check, 26 Nov 2026). Hindi uses आप in both, so it
// needs none.
export type UnderAgeCopy = { title: string; body: string; emergencyLead?: string };

const COPY: Record<string, UnderAgeCopy> = {
    en: {
        title: "Imotara is for people 13 and older",
        body: "It isn't the right place for you just yet. If something is worrying you, please talk to a grown-up you trust — a parent, a teacher, or someone in your family. You can also reach the people below.",
    },
    hi: {
        title: "इमोतारा 13 साल और उससे बड़े लोगों के लिए है",
        body: "अभी यह आपके लिए सही जगह नहीं है। अगर कोई बात आपको परेशान कर रही है, तो किसी ऐसे बड़े से बात करें जिस पर आपको भरोसा हो — माता-पिता, शिक्षक या परिवार का कोई सदस्य। आप नीचे दिए गए नंबरों पर भी संपर्क कर सकते हैं।",
    },
    bn: {
        title: "ইমোতারা ১৩ বছর বা তার বেশি বয়সীদের জন্য",
        body: "এখনও এটা তোমার জন্য ঠিক জায়গা নয়। যদি কিছু নিয়ে চিন্তা হয়, তাহলে এমন একজন বড় মানুষের সঙ্গে কথা বলো যাকে তুমি বিশ্বাস করো — মা-বাবা, শিক্ষক বা পরিবারের কেউ। নিচের নম্বরগুলোতেও যোগাযোগ করতে পারো।",
        emergencyLead: "তুমি যদি বিপদে থাকো, বা নিজের ক্ষতি করার কথা ভাবছ, এখনই সাহায্য নাও।",
    },
};

export function getUnderAgeCopy(lang?: string | null): UnderAgeCopy {
    const k = String(lang ?? "").toLowerCase().split(/[-_]/)[0];
    return COPY[k] ?? COPY.en;
}
