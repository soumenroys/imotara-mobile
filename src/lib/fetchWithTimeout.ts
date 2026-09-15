// src/lib/fetchWithTimeout.ts
// AbortSignal.timeout() is NOT available on Hermes (React Native production engine).
// Use this everywhere instead of AbortSignal.timeout() or bare fetch().

import { Platform } from "react-native";
import { isDefinitelyOffline } from "./network/online";
import { OfflineError } from "./network/fetchWithTimeout";


// Every request from this app says so, in one header, so the server can tell
// app traffic from website traffic without guessing at User-Agent strings.
// It names the SOFTWARE ("ios" / "android"), never the device or the person —
// there is no identifier here, and there must not be one: Imotara's store
// declarations and its own in-app copy both promise no usage tracking, and
// this is only allowed to stay true because the header carries nothing that
// could identify anybody.
//
// Set here rather than at each call site because there are ~18 of those across
// screens, Connect, Trends and the AI clients, and a header added in only some
// of them produces a split that is silently wrong rather than obviously wrong.
function withPlatformHeader(init: RequestInit = {}): RequestInit {
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown";
    return {
        ...init,
        headers: { ...(init.headers ?? {}), "X-Imotara-Platform": platform },
    };
}

export function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs: number = 15_000,
): Promise<Response> {
    // Same guard as the sibling in lib/network. There are two of these files
    // and both are live — this one serves the screens, that one serves the AI
    // calls — so a check in only one would leave half the app waiting out a
    // timeout it cannot win (UX-10).
    if (isDefinitelyOffline()) return Promise.reject(new OfflineError());

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { ...withPlatformHeader(init), signal: ctrl.signal }).finally(() => clearTimeout(timer));
}
