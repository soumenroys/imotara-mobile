// src/lib/network/fetchWithTimeout.ts

export const DEFAULT_REMOTE_TIMEOUT_MS = 20000;

export async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number = DEFAULT_REMOTE_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

    // If a signal was passed in, abort our controller when it fires too
    if (init?.signal) {
        (init.signal as AbortSignal).addEventListener("abort", () => controller.abort());
    }

    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}
