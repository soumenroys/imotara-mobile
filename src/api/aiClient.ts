// src/api/aiClient.ts
//
// Small helper to call the Imotara AI backend from the mobile app.
// Returns a plain replyText + basic error info so ChatScreen can decide
// whether to fallback to local preview.

import { IMOTARA_API_BASE_URL } from "../config/api";
import { debugLog, debugWarn } from "../config/debug";
import {
    BN_SAD_REGEX,
    HI_STRESS_REGEX,
    isConfusedText,
} from "../lib/emotion/keywordMaps";
import {
    fetchWithTimeout,
    DEFAULT_REMOTE_TIMEOUT_MS,
} from "../lib/network/fetchWithTimeout";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mobile safety: avoid UI freezes if server returns an unexpectedly huge string.
const MAX_REMOTE_REPLY_CHARS = 5000;

// Preferred language override (mobile Settings can set this)
const PREFERRED_LANGUAGE_KEY = "imotara_preferredLanguage";

function normalizeLangCode(raw: unknown): "en" | "hi" | "bn" | undefined {
    const s = String(raw ?? "").trim().toLowerCase();
    if (!s) return undefined;
    const base = s.split(/[-_]/)[0];
    if (base === "en" || base === "hi" || base === "bn") return base;
    return undefined;
}

async function getStoredPreferredLanguage(): Promise<"en" | "hi" | "bn" | undefined> {
    try {
        const raw = await AsyncStorage.getItem(PREFERRED_LANGUAGE_KEY);
        return normalizeLangCode(raw);
    } catch {
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Language hinting (additive, non-breaking)
// Goal: if user types in Bengali/Indic scripts, ask server for same language.
// We do NOT translate locally. We only send hints via headers + body.
// ---------------------------------------------------------------------------

type ChatMessage = { role: "user" | "assistant"; content: string };

function getDeviceLocaleSafe(): string {
    // Use runtime Intl if available; fallback to English.
    try {
        // On RN Hermes, Intl is usually present; but guard anyway.
        const loc = Intl?.DateTimeFormat?.().resolvedOptions?.().locale;
        return typeof loc === "string" && loc.trim() ? loc : "en";
    } catch {
        return "en";
    }
}

/**
 * Very lightweight script-based language inference.
 * Returns a BCP-47 tag usable for Accept-Language.
 * (Non-breaking: server may ignore it, but it won't harm anything.)
 */
function inferLanguageFromText(text: string): string | undefined {
    const t = String(text || "").trim();
    if (!t) return undefined;

    // Indic scripts
    if (/[\u0980-\u09FF]/.test(t)) return "bn-IN"; // Bengali
    if (/[\u0900-\u097F]/.test(t)) return "hi-IN"; // Devanagari (Hindi/Marathi/etc.)
    if (/[\u0A00-\u0A7F]/.test(t)) return "pa-IN"; // Gurmukhi (Punjabi)
    if (/[\u0A80-\u0AFF]/.test(t)) return "gu-IN"; // Gujarati
    if (/[\u0B00-\u0B7F]/.test(t)) return "or-IN"; // Odia
    if (/[\u0B80-\u0BFF]/.test(t)) return "ta-IN"; // Tamil
    if (/[\u0C00-\u0C7F]/.test(t)) return "te-IN"; // Telugu
    if (/[\u0C80-\u0CFF]/.test(t)) return "kn-IN"; // Kannada
    if (/[\u0D00-\u0D7F]/.test(t)) return "ml-IN"; // Malayalam

    // Romanized content: we can't reliably detect language; return undefined.
    return undefined;
}

function pickPreferredLanguage(params: {
    message: string;
    recentMessages?: ChatMessage[];
}): string {
    // Prefer the current user message first
    const fromCurrent = inferLanguageFromText(params.message);
    if (fromCurrent) return fromCurrent;

    // Then scan recent user messages (from newest to oldest)
    const recent = params.recentMessages ?? [];
    for (let i = recent.length - 1; i >= 0; i--) {
        const m = recent[i];
        if (!m || m.role !== "user") continue;
        const hit = inferLanguageFromText(m.content);
        if (hit) return hit;
    }

    // Fallback to device locale base, else English.
    const device = getDeviceLocaleSafe();
    const base = device.split("-")[0] || "en";
    return base === "bn" ? "bn-IN" : base === "hi" ? "hi-IN" : device || "en";
}

export type AnalyzeResponse = {
    ok: boolean;
    replyText: string;
    reflectionSeed?: any;
    followUp?: string | null;
    errorMessage?: string;

    // ✅ optional diagnostics / parity fields (additive)
    analysisSource?: "cloud" | "local";
    meta?: unknown;

    // ✅ NEW: transport diagnostics (additive)
    remoteUrl?: string;
    remoteStatus?: number;
    remoteError?: string;

    // ✅ carry emotion through so UI doesn't default to neutral
    emotion?: string;
    intensity?: number;
};

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

        // ✅ parity with web: ageTone preferred, ageRange legacy fallback
        ageTone?: ToneAgeRange;
        ageRange?: ToneAgeRange;

        gender?: ToneGender;
        relationship?: ToneRelationship;
    };
    companion?: {
        enabled?: boolean;
        name?: string;

        // ✅ parity with web: ageTone preferred, ageRange legacy fallback
        ageTone?: ToneAgeRange;
        ageRange?: ToneAgeRange;

        gender?: ToneGender;
        relationship?: ToneRelationship;
    };
};

type CallAIOptions = {
    // Optional tone guidance for the remote AI (server supports this)
    toneContext?: ToneContextPayload;

    // ✅ allow mobile settings + light history to reach /api/respond
    analysisMode?: "auto" | "cloud" | "local";
    emotionInsightsEnabled?: boolean;

    // ✅ Non-breaking: network timeout override (ms)
    timeoutMs?: number;

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

function normalizeToneContext(
    input?: ToneContextPayload
): ToneContextPayload | undefined {
    if (!input || typeof input !== "object") return undefined;

    const next: ToneContextPayload = {
        user: input.user ? { ...input.user } : undefined,
        companion: input.companion ? { ...input.companion } : undefined,
    };

    // ✅ Parity bridge (minimal + non-redundant):
    // Treat ageTone as canonical. Only derive ageTone from ageRange (legacy input),
    // but do NOT auto-fill ageRange from ageTone (avoids redundant payload).
    if (next.user) {
        if (!next.user.ageTone && next.user.ageRange)
            next.user.ageTone = next.user.ageRange;
    }

    if (next.companion) {
        if (!next.companion.ageTone && next.companion.ageRange) {
            next.companion.ageTone = next.companion.ageRange;
        }

        // ✅ Critical: if companion tone is enabled, require a stable name
        const enabled = !!next.companion.enabled;
        const name =
            typeof next.companion.name === "string" ? next.companion.name.trim() : "";

        if (enabled && !name) {
            next.companion.name = "Imotara";
        }
    }

    return next;
}

export async function callImotaraAI(
    message: string,
    opts?: CallAIOptions
): Promise<AnalyzeResponse> {
    try {
        const toneContext = normalizeToneContext(opts?.toneContext);

        // ✅ Mobile parity with web:
        // If the caller provided `settings` but did not include matching fields in toneContext, fill them in (additive only).
        // Cleanup: prefer ageTone as the canonical field.
        if (toneContext?.companion?.enabled && opts?.settings) {
            if (!toneContext.companion.ageTone && opts.settings.ageTone) {
                toneContext.companion.ageTone = opts.settings.ageTone;
            }

            // Back-compat bridge: only populate ageRange when it is already present on the object
            if (
                !toneContext.companion.ageRange &&
                opts.settings.ageTone &&
                ("ageRange" in toneContext.companion)
            ) {
                toneContext.companion.ageRange = opts.settings.ageTone;
            }

            if (!toneContext.companion.relationship && opts.settings.relationshipTone) {
                toneContext.companion.relationship = opts.settings.relationshipTone;
            }
            if (!toneContext.companion.gender && opts.settings.genderTone) {
                toneContext.companion.gender = opts.settings.genderTone;
            }
        }

        // ✅ language hint for server (additive)
        // 1) If user selected a language in Settings, honor it strictly.
        // 2) Else, fall back to script/device inference (current behavior).
        const storedPreferred = await getStoredPreferredLanguage();
        const inferred = pickPreferredLanguage({
            message,
            recentMessages: opts?.recentMessages,
        });

        // Base language (from Settings) is "en" | "hi" | "bn"
        const preferredBase = storedPreferred ?? normalizeLangCode(inferred) ?? "en";

        // Server-facing BCP-47 tag (more reliable for backend routing)
        const preferredLanguage =
            preferredBase === "hi"
                ? "hi-IN"
                : preferredBase === "bn"
                    ? "bn-IN"
                    : "en";

        debugLog(
            `[imotara] aiClient preferredLanguage: stored=${String(storedPreferred)} inferred=${String(
                inferred
            )} base=${preferredBase} final=${preferredLanguage}`
        );

        // ✅ Unique per-call requestId (helps the server avoid accidental dedupe / repeats)
        const requestId = `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        debugLog("[imotara] outbound request", {
            requestId,
            analysisMode: opts?.analysisMode,
            preferredLanguage,
            messageLen: typeof message === "string" ? message.length : -1,
            messagePreview:
                typeof message === "string" ? message.slice(0, 120) : String(message),
            companion: {
                enabled: toneContext?.companion?.enabled,
                name: toneContext?.companion?.name,
                relationship: toneContext?.companion?.relationship,
                ageTone: toneContext?.companion?.ageTone,
                ageRange: toneContext?.companion?.ageRange,
                gender: toneContext?.companion?.gender,
            },
        });

        const remoteUrl = `${IMOTARA_API_BASE_URL}/api/respond`;

        const res = await fetchWithTimeout(
            remoteUrl,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",

                    // ✅ Send base + region for maximum backend compatibility
                    // Example: "hi,hi-IN;q=0.9,en;q=0.8"
                    "Accept-Language":
                        preferredBase === "hi"
                            ? "hi,hi-IN;q=0.9,en;q=0.8"
                            : preferredBase === "bn"
                                ? "bn,bn-IN;q=0.9,en;q=0.8"
                                : "en,en-IN;q=0.9",
                },
                body: JSON.stringify({
                    requestId,
                    message,

                    // ✅ Back-compat: many servers expect base language codes in JSON ("hi" | "bn" | "en")
                    preferredLanguage: preferredBase,

                    // ✅ Additive: also send the BCP-47 tag explicitly
                    preferredLanguageTag: preferredLanguage,

                    // ✅ Additive aliases (safe if ignored; helps older parsers)
                    language: preferredBase,
                    locale: preferredLanguage,

                    // ✅ Additive: also send analysisMode at top-level (server/web parity)
                    ...(opts?.analysisMode ? { analysisMode: opts.analysisMode } : {}),

                    // ✅ IMPORTANT: send toneContext at the TOP LEVEL (server contract)
                    ...(toneContext ? { toneContext } : {}),

                    // ✅ Keep context payload too (additive / backward compatible)
                    context: {
                        source: "mobile",
                        analysisMode: opts?.analysisMode,
                        emotionInsightsEnabled: opts?.emotionInsightsEnabled,

                        // ✅ Keep BOTH forms in context as well
                        preferredLanguage: preferredBase,
                        preferredLanguageTag: preferredLanguage,
                        language: preferredBase,
                        locale: preferredLanguage,

                        // keep this for older server parsing / debugging (non-breaking)
                        ...(toneContext ? { toneContext } : {}),

                        // soft persona hints (do NOT roleplay; just wording guidance)
                        persona: opts?.settings
                            ? {
                                relationshipTone: opts.settings.relationshipTone,
                                ageTone: opts.settings.ageTone,
                                genderTone: opts.settings.genderTone,
                            }
                            : undefined,

                        // last few messages for continuity (send both keys for max compatibility)
                        recentMessages: opts?.recentMessages ?? undefined,

                        // back-compat (older servers/clients might look for `recent`)
                        recent: opts?.recentMessages ?? undefined,
                    },
                }),
            },
            opts?.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS
        );

        if (!res.ok) {
            const bodyText = await res.text().catch(() => "");
            return {
                ok: false,
                replyText: "",
                errorMessage: `HTTP ${res.status}`,
                analysisSource: "cloud",
                remoteUrl,
                remoteStatus: res.status,
                remoteError: bodyText ? bodyText.slice(0, 200) : `HTTP ${res.status}`,
            };
        }

        const rawText = await res.text().catch(() => "");
        let data: any = null;

        try {
            data = rawText ? JSON.parse(rawText) : {};

            debugLog(
                `[imotara] /api/respond languageUsed=${String(data?.meta?.languageUsed)} preferredLanguageSent=${preferredLanguage}`
            );
        } catch (e) {
            debugWarn("[imotara] cloud response was not valid JSON", {
                status: res.status,
                body: rawText.slice(0, 200),
            });

            return {
                ok: false,
                replyText: "",
                errorMessage: "Invalid server response",
                analysisSource: "cloud",
                remoteUrl,
                remoteStatus: res.status,
                remoteError: rawText ? rawText.slice(0, 200) : "Invalid JSON",
            };
        }

        // Compact debug (keeps signal, avoids huge logs / UI freezes)
        debugLog("[imotara] cloud response summary", {
            requestId: data?.requestId,
            messageLen: typeof data?.message === "string" ? data.message.length : undefined,
            followUpLen: typeof data?.followUp === "string" ? data.followUp.length : undefined,
            analysisSource: data?.meta?.analysisSource,
            languageUsed: data?.meta?.languageUsed,
            emotionLabel: data?.meta?.emotionLabel ?? data?.meta?.emotion?.primary,
            metaKeys:
                data?.meta && typeof data.meta === "object"
                    ? Object.keys(data.meta)
                    : undefined,
        });

        // 1) Try common "direct reply" fields first
        // Backend contract (strict):
        // { message: string, reflectionSeed?: {...}, followUp?: string }
        let replyText = String(data?.message ?? "").trim();

        if (replyText.length > MAX_REMOTE_REPLY_CHARS) {
            debugWarn("[imotara] cloud reply too long; truncating for mobile safety", {
                len: replyText.length,
                cap: MAX_REMOTE_REPLY_CHARS,
            });
            replyText = replyText.slice(0, MAX_REMOTE_REPLY_CHARS).trimEnd() + "…";
        }

        // Single, clear validation (covers "", whitespace-only, missing message)
        if (!replyText) {
            return {
                ok: false,
                replyText: "",
                errorMessage: "Invalid /api/respond response: missing message",
            };
        }

        // ✅ Preserve server emotion signal (cloud often nests it under meta)
        const meta = data?.meta;

        const metaEmotionObj =
            meta &&
                typeof meta === "object" &&
                (meta as any).emotion &&
                typeof (meta as any).emotion === "object"
                ? (meta as any).emotion
                : undefined;

        const emotionRaw =
            data?.emotion ??
            (meta && typeof meta === "object" ? (meta as any).emotionLabel : undefined) ??
            metaEmotionObj?.primary;

        let emotion =
            typeof emotionRaw === "string" && emotionRaw.trim()
                ? emotionRaw.trim()
                : undefined;

        // ✅ If server doesn't send emotion, derive a safe fallback from the input message
        if (!emotion) {
            const raw = String(message || "").trim();

            if (HI_STRESS_REGEX.test(raw)) emotion = "stressed";
            else if (BN_SAD_REGEX.test(raw)) emotion = "sad";
            else if (isConfusedText(raw)) emotion = "confused";
            else {
                // ✅ Extra safety: romanized Hindi confused (common user inputs)
                const t = raw.toLowerCase().replace(/\s+/g, " ");
                if (
                    /\bsamajh nahi aa raha\b/.test(t) ||
                    /\bsamajh nahi aa rahi\b/.test(t) ||
                    /\bkya karu\b/.test(t) ||
                    /\bwhat should i do\b/.test(t)
                ) {
                    emotion = "confused";
                }
            }
        }

        // intensity can be numeric or (in meta.emotion) a string level
        const intensityRaw =
            data?.intensity ??
            (meta && typeof meta === "object" ? (meta as any).intensity : undefined) ??
            metaEmotionObj?.intensity;

        const intensity =
            typeof intensityRaw === "number" && Number.isFinite(intensityRaw)
                ? intensityRaw
                : typeof intensityRaw === "string"
                    ? intensityRaw === "high"
                        ? 1
                        : intensityRaw === "medium"
                            ? 0.66
                            : intensityRaw === "low"
                                ? 0.33
                                : undefined
                    : undefined;

        return {
            ok: true,
            replyText,

            // ✅ carry through parity fields if server provides them
            reflectionSeed: data?.reflectionSeed,
            followUp: typeof data?.followUp === "string" ? data.followUp : undefined,

            // ✅ preserve server meta for mobile ↔ web parity (FIX: was being dropped)
            meta,

            // ✅ used by ChatScreen to show correct mood chip
            emotion,
            intensity,

            // ✅ explicit source + diagnostics
            analysisSource: "cloud",
            remoteUrl,
            remoteStatus: res.status,
        };
    } catch (error: any) {
        debugWarn("Imotara mobile AI fetch error:", error);

        const remoteUrl = `${IMOTARA_API_BASE_URL}/api/respond`;
        const isTimeout =
            error?.name === "AbortError" ||
            String(error?.message ?? "").toLowerCase().includes("aborted");

        return {
            ok: false,
            replyText: "",
            errorMessage: isTimeout
                ? "Request timed out"
                : error?.message ?? "Network error",
            analysisSource: "cloud",
            remoteUrl,
            remoteError: isTimeout ? "timeout" : error?.message ?? String(error),
        };
    }
}

// ---------------------------------------------------------------------------
// Chat persistence (mobile ↔ web parity)
// Server: /api/chat/messages
// Identity: x-imotara-user (Option 1: server-side scoped user id)
// ---------------------------------------------------------------------------

export type RemoteChatMessage = {
    id: string;
    userScope: string;
    threadId: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
};

export type GetChatMessagesResponse = {
    messages: RemoteChatMessage[];
    serverTs?: number;
};

function buildChatMessagesUrl(params?: {
    threadId?: string;
    since?: number;
}): string {
    const base = `${IMOTARA_API_BASE_URL}/api/chat/messages`;
    const q = new URLSearchParams();

    if (params?.threadId) q.set("threadId", params.threadId);
    if (typeof params?.since === "number") q.set("since", String(params.since));

    // DEV-only cache-bypass to avoid stale CDN responses during deployments
    if (__DEV__) q.set("ts", String(Date.now()));

    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
}

export async function fetchRemoteChatMessages(args: {
    userScope: string;
    threadId?: string;
    since?: number;
}): Promise<GetChatMessagesResponse> {
    const remoteUrl = buildChatMessagesUrl({
        threadId: args.threadId,
        since: args.since,
    });

    try {
        const res = await fetch(remoteUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-imotara-user": args.userScope,
            },
        });

        if (!res.ok) {
            const bodyText = await res.text().catch(() => "");
            debugWarn("[imotara] fetchRemoteChatMessages failed", {
                status: res.status,
                body: bodyText.slice(0, 200),
            });
            return { messages: [] };
        }

        const rawText = await res.text().catch(() => "");
        let data: any = null;

        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch (e) {
            debugWarn("[imotara] fetchRemoteChatMessages: invalid JSON", {
                status: res.status,
                body: rawText.slice(0, 200),
            });
            return { messages: [] };
        }

        const messages = Array.isArray(data?.messages)
            ? (data.messages as RemoteChatMessage[])
            : [];
        return {
            messages,
            serverTs: typeof data?.serverTs === "number" ? data.serverTs : undefined,
        };
    } catch (err: any) {
        debugWarn("[imotara] fetchRemoteChatMessages error", err);
        return { messages: [] };
    }
}

export async function pushRemoteChatMessages(args: {
    userScope: string;
    messages: Array<{
        id: string;
        threadId: string;
        role: "user" | "assistant";
        content: string;
        createdAt: number;
    }>;
}): Promise<{ ok: boolean; errorMessage?: string }> {
    const remoteUrl = `${IMOTARA_API_BASE_URL}/api/chat/messages`;

    try {
        const res = await fetch(remoteUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-imotara-user": args.userScope,
            },
            body: JSON.stringify({ messages: args.messages }),
        });

        if (!res.ok) {
            const bodyText = await res.text().catch(() => "");
            debugWarn("[imotara] pushRemoteChatMessages failed", {
                status: res.status,
                body: bodyText.slice(0, 200),
            });
            return { ok: false, errorMessage: `HTTP ${res.status}` };
        }

        return { ok: true };
    } catch (err: any) {
        debugWarn("[imotara] pushRemoteChatMessages error", err);
        return { ok: false, errorMessage: err?.message ?? "Network error" };
    }
}