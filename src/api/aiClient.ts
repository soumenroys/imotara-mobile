// src/api/aiClient.ts
//
// Small helper to call the Imotara AI backend from the mobile app.
// Returns a plain replyText + basic error info so ChatScreen can decide
// whether to fallback to local preview.

import { IMOTARA_API_BASE_URL } from "../config/api";
import { DEBUG_UI_ENABLED } from "../config/debug";

export type AnalyzeResponse = {
    ok: boolean;
    replyText: string;

    // ✅ NEW: parity metadata from /api/respond
    reflectionSeed?: any;
    followUp?: string;

    errorMessage?: string;
};

function debugLog(...args: any[]) {
    if (DEBUG_UI_ENABLED) console.log(...args);
}

function debugWarn(...args: any[]) {
    if (DEBUG_UI_ENABLED) console.warn(...args);
}

// Keep this local to mobile; mirrors server payload structure (tone only)
export type ToneAgeRange =
    | "prefer_not"
    | "under_13"
    | "13_17"
    | "18_24"
    | "25_34"
    | "35_44"
    | "45_54"
    | "55_64"
    | "65_plus";

export type ToneGender =
    | "prefer_not"
    | "female"
    | "male"
    | "nonbinary"
    | "other";

// Mirrors web “Relationship vibe”
export type ToneRelationship =
    | "prefer_not"
    | "mentor"
    | "elder"
    | "friend"
    | "coach"
    | "sibling"
    | "junior_buddy"
    | "parent_like"
    | "partner_like";

export type ToneContextPayload = {
    user?: {
        name?: string;
        ageRange?: ToneAgeRange;
        gender?: ToneGender;
        relationship?: ToneRelationship;
    };
    companion?: {
        enabled?: boolean;
        name?: string;
        ageRange?: ToneAgeRange;
        gender?: ToneGender;
        relationship?: ToneRelationship;
    };
};

type CallAIOptions = {
    // Optional tone guidance for the remote AI (server supports this)
    toneContext?: ToneContextPayload;

    // ✅ NEW: allow mobile settings + light history to reach /api/respond
    analysisMode?: "auto" | "cloud" | "local";
    emotionInsightsEnabled?: boolean;

    settings?: {
        relationshipTone?: ToneRelationship;
        ageTone?: ToneAgeRange;
        genderTone?: ToneGender;
    };

    // lightweight last-N messages
    recentMessages?: Array<{
        role: "user" | "assistant";
        content: string;
    }>;
};

export async function callImotaraAI(
    message: string,
    opts?: CallAIOptions
): Promise<AnalyzeResponse> {
    try {
        const toneContext = opts?.toneContext;

        const res = await fetch(`${IMOTARA_API_BASE_URL}/api/respond`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message,
                context: {
                    source: "mobile",
                    analysisMode: opts?.analysisMode,
                    emotionInsightsEnabled: opts?.emotionInsightsEnabled,

                    // tone-only guidance (existing)
                    ...(toneContext ? { toneContext } : {}),

                    // soft persona hints (do NOT roleplay; just wording guidance)
                    persona: opts?.settings
                        ? {
                            relationshipTone: opts.settings.relationshipTone,
                            ageTone: opts.settings.ageTone,
                            genderTone: opts.settings.genderTone,
                        }
                        : undefined,

                    // last few messages for continuity
                    recent: opts?.recentMessages ?? undefined,
                },
            }),
        });

        if (!res.ok) {
            return {
                ok: false,
                replyText: "",
                errorMessage: `HTTP ${res.status}`,
            };
        }

        const data: any = await res.json();

        // Debug log – see in Metro console (gated for QA/prod cleanliness)
        debugLog("Imotara mobile AI raw response:", data);

        // 1) Try common "direct reply" fields first
        // ✅ /api/respond contract (strict):
        // { message: string, reflectionSeed?: {...}, followUp?: string }
        const replyText = String(data?.message ?? "").trim();

        if (!replyText) {
            return {
                ok: false,
                replyText: "",
                errorMessage: "Invalid /api/respond response: missing message",
            };
        }

        if (!replyText.trim()) {
            return {
                ok: false,
                replyText: "",
                errorMessage: "No reply text returned from server",
            };
        }

        return {
            ok: true,
            replyText,

            // ✅ carry through parity fields if server provides them
            reflectionSeed: data?.reflectionSeed,
            followUp: typeof data?.followUp === "string" ? data.followUp : undefined,
        };
    } catch (error: any) {
        debugWarn("Imotara mobile AI fetch error:", error);
        return {
            ok: false,
            replyText: "",
            errorMessage: error?.message ?? "Network error",
        };
    }
}

// ---------- Helpers ----------

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

/**
 * Build a warm, emotional reply from the analysis JSON structure:
 * {
 *   summary: { headline, details },
 *   snapshot: { dominant, averages: { ... } },
 *   reflections: [{ text }, ...]
 * }
 *
 * We also strip out our own internal stub phrases so they never show
 * in the user-facing reply.
 */
function buildRichReplyFromAnalysis(data: any): string | null {
    if (!data || typeof data !== "object") return null;

    const summary = data.summary ?? {};
    const snapshot = data.snapshot ?? {};
    const reflections = Array.isArray(data.reflections) ? data.reflections : [];

    // More robust stub detection (covers slight punctuation / spacing differences)
    const isStubDetails = (s?: unknown) =>
        typeof s === "string" &&
        s.toLowerCase().includes("remote analysis stub served by /api/respond");

    const isStubReflection = (s?: unknown) => {
        if (typeof s !== "string") return false;
        const lower = s.toLowerCase();
        return lower.includes("no messages were provided") && lower.includes("neutral baseline");
    };

    const headline: string | undefined = summary.headline;

    let details: string | undefined = summary.details;
    if (isStubDetails(details)) details = undefined;

    let reflectionText: string | undefined = reflections[0]?.text;
    if (isStubReflection(reflectionText)) reflectionText = undefined;

    const dominant: string | undefined = snapshot.dominant;

    const pieces: string[] = [];

    // 1) Main emotional summary
    if (isNonEmptyString(headline) || isNonEmptyString(details)) {
        const h = headline?.trim();
        const d = details?.trim();
        if (h && d) pieces.push(`${h}. ${d}`);
        else if (h) pieces.push(h);
        else if (d) pieces.push(d);
    }

    // 2) Dominant emotion hint
    if (isNonEmptyString(dominant)) {
        const dom = dominant.toLowerCase();
        if (dom === "neutral") {
            pieces.push("Emotionally, you’re coming across fairly steady and neutral right now.");
        } else {
            pieces.push(
                `Emotionally, it seems like “${dom}” is the strongest note in what you’re sharing.`
            );
        }
    }

    // 3) Additional reflection from the engine
    if (isNonEmptyString(reflectionText)) {
        pieces.push(reflectionText.trim());
    }

    // 4) Soft closing line if we got *something*
    if (pieces.length > 0) {
        pieces.push(
            "If you’d like to go deeper, you can keep talking and we’ll explore it step by step together."
        );
    }

    const combined = pieces.join(" ");
    return combined.trim().length > 0 ? combined.trim() : null;
}
