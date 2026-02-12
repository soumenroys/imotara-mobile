// src/lib/ai/local/localReplyEngine.ts
import type { ToneContextPayload } from "../../../api/aiClient";
import { BN_SAD_REGEX, HI_STRESS_REGEX, isConfusedText } from "../../emotion/keywordMaps";


type ToneContext = ToneContextPayload;

// ✅ DEV-only: handy local-mode prompt set for quick manual verification (safe if unused)
export const LOCAL_DEV_TEST_PROMPTS: string[] = [
    "I cannot focus today",
    "I can’t focus today. Work is piling up.",
    "I feel very sad today",
    "I’m anxious and can’t calm down",
    "I’m angry at everyone",
    "😂😂😂",
    "👍",
];


export type LocalReplyResult = {
    message: string;
    reflectionSeed?: {
        intent: "reflect" | "clarify" | "reframe";
        title: string; // ✅ must always exist to match ReflectionSeed
        prompt: string;
    };
};

function hash32(input: string): number {
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h >>> 0;
}

function pick<T>(arr: T[], seed: number) {
    return arr[seed % arr.length];
}

function detectSignal(
    text: string
): "sad" | "anxious" | "angry" | "tired" | "confused" | "okay" {
    const t = (text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");


    // ✅ Explicit neutral emoji-only acknowledgement (future-proof parity with web)
    // Thumbs-up is acknowledgement, not an emotional state
    if (/^[\s👍]+$/.test(text || "")) return "okay";

    // ✅ Confusion / mental overload (parity with keywordMaps)
    if (isConfusedText(text || "")) return "confused";


    if (BN_SAD_REGEX.test(text || "") || /(sad|down|depressed|hopeless|cry)/.test(t)) return "sad";
    if (HI_STRESS_REGEX.test(text || "") || /(anxious|worried|panic|overwhelm|stress)/.test(t)) return "anxious";

    if (/(angry|mad|furious|irritated|annoyed)/.test(t)) return "angry";
    if (/(tired|exhausted|drained|sleepy|burnt)/.test(t)) return "tired";
    return "okay";
}



export function buildLocalReply(message: string, toneContext?: ToneContext): LocalReplyResult {
    const seed = hash32(
        `${message}::${toneContext?.companion?.relationship ?? ""}::${(toneContext?.companion?.ageTone ?? toneContext?.companion?.ageRange) ?? ""}`
    );
    const signal = detectSignal(message);

    const name = String(toneContext?.user?.name ?? "").trim();
    const rel =
        (toneContext?.companion?.enabled ? toneContext?.companion?.relationship : undefined) ??
        toneContext?.user?.relationship ??
        "prefer_not";

    // Relationship-aware openers (preserves your existing tone, adds safe variety)
    const friendOpeners = name
        ? [
            `Got you, ${name}.`,
            `I’m here with you, ${name}.`,
            `I hear you, ${name}.`,
            `Okay — I’m with you, ${name}.`,
        ]
        : [`Got you.`, `I’m here with you.`, `I hear you.`, `Okay — I’m with you.`];

    const mentorOpeners = name
        ? [
            `I’m listening, ${name}.`,
            `Let’s slow this down, ${name}.`,
            `We can take this one piece at a time, ${name}.`,
        ]
        : [`I’m listening.`, `Let’s slow this down.`, `We can take this one piece at a time.`];

    const coachOpeners = name
        ? [`Okay, ${name}.`, `Alright, ${name}.`, `Let’s focus, ${name}.`]
        : [`Okay.`, `Alright.`, `Let’s focus.`];

    // Keep your original openers as default fallback so we don’t lose any current behavior
    const defaultOpeners = [
        `I’m here with you.`,
        `I hear you.`,
        `Thanks for telling me.`,
        `Okay — I’m with you.`,
        `Got it. I’m listening.`,
        `Mm. Tell me more.`,
        `I’m glad you said that.`,
        `Alright — let’s slow this down together.`,
        `Okay. Let’s take this one piece at a time.`,
    ];

    const openers =
        rel === "friend"
            ? friendOpeners
            : rel === "mentor"
                ? mentorOpeners
                : rel === "coach"
                    ? coachOpeners
                    : defaultOpeners;

    const validations: Record<typeof signal, string[]> = {
        sad: [`That sounds heavy.`, `That can really hurt.`, `I’m sorry you’re carrying that.`, `That’s a lot to sit with.`],
        anxious: [
            `That sounds like your mind is running fast.`,
            `That kind of pressure can feel loud.`,
            `It makes sense you’d feel tense with that.`,
            `That overwhelm feeling is real.`,
        ],
        confused: [
            `That sounds foggy and hard to hold in your head.`,
            `It makes sense you’d feel scattered right now.`,
            `That “can’t focus” feeling can be really frustrating.`,
            `Okay — sounds like your thoughts are tangled.`,
        ],
        angry: [
            `That sounds frustrating.`,
            `I can see how that would irritate you.`,
            `That would get under anyone’s skin.`,
            `Yeah — that’s a rough feeling.`,
        ],
        tired: [`That sounds draining.`, `No wonder you feel worn out.`, `That kind of tired can build up.`, `That’s a lot of load for one day.`],
        okay: [
            `Tell me a little more.`,
            `I’m with you — what’s going on?`,
            `I’m listening. What’s sitting with you right now?`,
            `Okay. What’s the main thing on your mind?`,
        ],
    };


    const reflectLines = [
        `When you say “${(message || "").trim().slice(0, 120)}${(message || "").length > 120 ? "…" : ""}”, what part feels strongest right now?`,
        `What’s the part of this that feels most uncomfortable?`,
        `If we zoom in: what’s the one detail that’s bothering you most?`,
        `What do you wish was different about this situation?`,
    ];

    const nextStepLines = [
        `Want comfort, clarity, or a next step?`,
        `Do you want to talk it out, or want something practical to do next?`,
        `Would it help to unpack it, or to pick one small action?`,
        `Should we focus on what you’re feeling, or what you can do next?`,
    ];

    const intent = pick(["clarify", "reflect", "reframe"] as const, seed >>> 3);

    const prompt =
        intent === "clarify"
            ? pick(nextStepLines, seed >>> 4)
            : intent === "reflect"
                ? pick(reflectLines, seed >>> 4)
                : `If we reframe this gently: what’s one kinder explanation that could also be true?`;

    const extra = pick(
        [
            ``,
            `We can go gently.`,
            `No rush — we’ll take it step by step.`,
            `You’re not alone in this.`,
            `I’m staying with you.`,
        ],
        seed >>> 5
    );

    const base = `${pick(openers, seed)} ${pick(validations[signal], seed >>> 1)}`.trim();
    const finalMsg = `${base}${extra ? " " + extra : ""}`.trim();

    return {
        message: finalMsg,
        reflectionSeed: { intent, title: "", prompt },
    };
}
