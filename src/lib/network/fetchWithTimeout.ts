// src/lib/network/fetchWithTimeout.ts

export const DEFAULT_REMOTE_TIMEOUT_MS = 20000;

export async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number = DEFAULT_REMOTE_TIMEOUT_MS
): Promise<Response> {
    // Respect existing signal if provided
    if (init?.signal) {
        return fetch(url, init);
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}
