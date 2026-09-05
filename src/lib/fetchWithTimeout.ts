// src/lib/fetchWithTimeout.ts
// AbortSignal.timeout() is NOT available on Hermes (React Native production engine).
// Use this everywhere instead of AbortSignal.timeout() or bare fetch().

import { isDefinitelyOffline } from "./network/online";
import { OfflineError } from "./network/fetchWithTimeout";

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
    return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}
