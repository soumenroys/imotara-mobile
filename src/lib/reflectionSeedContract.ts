// src/lib/reflectionSeedContract.ts

export type ReflectionIntent = "reflect" | "clarify" | "reframe";

export interface ReflectionSeed {
    title: string;
    prompt: string;
    intent: ReflectionIntent;
}

export interface ImotaraResponse {
    reflectionSeed?: ReflectionSeed;
    message: string;
    followUp?: string;
}

export type ReflectionSeedLabel = "Reflect" | "Clarify" | "Reframe";

export function intentToLabel(intent: ReflectionIntent): ReflectionSeedLabel {
    switch (intent) {
        case "clarify":
            return "Clarify";
        case "reframe":
            return "Reframe";
        case "reflect":
        default:
            return "Reflect";
    }
}

export type NormalizedReflectionSeed = ReflectionSeed & {
    label: ReflectionSeedLabel;
    title: string;
    prompt: string;
};

export const REFLECTION_SEED_LIMITS = {
    titleMax: 42,
    promptMax: 120,
} as const;

function stripMarkdownAndNewlines(s: string): string {
    const noMd = s
        .replace(/[*_`>#]/g, "")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1");
    return noMd.replace(/\s+/g, " ").trim();
}

function cap(s: string, max: number): string {
    const t = s.trim();
    if (t.length <= max) return t;
    return t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export function normalizeReflectionSeed(
    seed: unknown
): NormalizedReflectionSeed | null {
    if (!seed || typeof seed !== "object") return null;

    const s = seed as any;
    const intent: ReflectionIntent =
        s.intent === "clarify" || s.intent === "reframe" || s.intent === "reflect"
            ? s.intent
            : "reflect";

    const rawTitle = typeof s.title === "string" ? s.title : "";
    const rawPrompt = typeof s.prompt === "string" ? s.prompt : "";

    const title = cap(stripMarkdownAndNewlines(rawTitle), REFLECTION_SEED_LIMITS.titleMax);
    const prompt = cap(stripMarkdownAndNewlines(rawPrompt), REFLECTION_SEED_LIMITS.promptMax);

    if (!prompt) return null;

    return {
        intent,
        label: intentToLabel(intent),
        title: title || "Reflection seed",
        prompt,
    };
}

export function getReflectionSeedCard(
    response: ImotaraResponse
): NormalizedReflectionSeed | null {
    return normalizeReflectionSeed(response?.reflectionSeed);
}

export function shouldShowReflectionSeedCard(response: ImotaraResponse): boolean {
    return !!getReflectionSeedCard(response);
}
