// src/lib/fetchWithTimeout.ts
// AbortSignal.timeout() is NOT available on Hermes (React Native production engine).
// Use this everywhere instead of AbortSignal.timeout() or bare fetch().

export function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs: number = 15_000,
): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}
