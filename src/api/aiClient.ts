// src/api/aiClient.ts
//
// Small helper to call the Imotara AI backend from the mobile app.
// Returns a plain replyText + basic error info so ChatScreen can decide
// whether to fallback to local preview.

import { IMOTARA_API_BASE_URL } from "../config/api";

export type AnalyzeResponse = {
    ok: boolean;
    replyText: string;
    errorMessage?: string;
};

export async function callImotaraAI(
    message: string
): Promise<AnalyzeResponse> {
    try {
        const res = await fetch(`${IMOTARA_API_BASE_URL}/api/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message,
                source: "mobile-app",
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

        // Debug log – see in Metro console
        console.log("Imotara mobile AI raw response:", data);

        // 1) Try common "direct reply" fields first
        let candidate: unknown =
            data?.replyText ??
            data?.reply_text ??
            data?.text ??
            data?.message ??
            data?.content;

        // 2) Nested "reply" object
        if (!isNonEmptyString(candidate)) {
            candidate =
                data?.reply?.text ??
                data?.reply?.content ??
                data?.reply?.message;
        }

        // 3) OpenAI-style chat completions
        if (!isNonEmptyString(candidate)) {
            candidate =
                data?.choices?.[0]?.message?.content ??
                data?.choices?.[0]?.text;
        }

        // 4) Rich emotional reply from Imotara analysis JSON (Option B)
        let richFromAnalysis: string | null = null;
        if (!isNonEmptyString(candidate)) {
            richFromAnalysis = buildRichReplyFromAnalysis(data);
        }

        // 5) If the whole data is itself a string
        if (!isNonEmptyString(candidate) && typeof data === "string") {
            candidate = data;
        }

        // Decide final reply text
        let replyText: string;
        if (richFromAnalysis && richFromAnalysis.trim().length > 0) {
            replyText = richFromAnalysis;
        } else if (isNonEmptyString(candidate)) {
            replyText = String(candidate);
        } else {
            // 6) Last resort: stringify the JSON so we see *something*
            replyText = JSON.stringify(data);
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
        };
    } catch (error: any) {
        console.warn("Imotara mobile AI fetch error:", error);
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
 */
function buildRichReplyFromAnalysis(data: any): string | null {
    if (!data || typeof data !== "object") return null;

    const summary = data.summary ?? {};
    const snapshot = data.snapshot ?? {};
    const windowInfo = snapshot.window ?? {};
    const averages = snapshot.averages ?? {};
    const reflections = Array.isArray(data.reflections)
        ? data.reflections
        : [];

    const headline: string | undefined = summary.headline;
    const details: string | undefined = summary.details;
    const dominant: string | undefined = snapshot.dominant;
    const reflectionText: string | undefined = reflections[0]?.text;

    const pieces: string[] = [];

    // 1) Main emotional summary
    if (isNonEmptyString(headline) || isNonEmptyString(details)) {
        const h = headline?.trim();
        const d = details?.trim();
        if (h && d) {
            pieces.push(`${h}. ${d}`);
        } else if (h) {
            pieces.push(h);
        } else if (d) {
            pieces.push(d);
        }
    }

    // 2) Dominant emotion hint
    if (isNonEmptyString(dominant)) {
        const dom = dominant.toLowerCase();
        if (dom === "neutral") {
            pieces.push(
                "Emotionally, you’re coming across fairly steady and neutral right now."
            );
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
