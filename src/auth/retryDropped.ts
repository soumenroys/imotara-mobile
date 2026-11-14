// src/auth/retryDropped.ts — #134, seen in the simulator 12 Nov 2026 (CFNetwork log):
// a sign-in POST/PUT to the auth server failed with -1005 "The network connection was lost" after the
// app sat idle a minute or two (the server had closed the kept-alive connection). iOS retries a GET on
// its own but NOT a POST ("could retry(N)") ⇒ the person saw "No connection just now" on the first tap,
// typically right after switching to their mail app to read the code. One quiet retry fixes it.

/** True for a request that never got an answer (dropped/stale connection), not for an answer that said no. */
export function isDroppedConnection(err: unknown): boolean {
    if (!err) return false;
    const e = err as { name?: string; message?: string; status?: number };
    if (e.name === "AuthRetryableFetchError") return true;
    return /network request failed|network connection was lost|failed to fetch/i.test(e.message ?? String(err));
}

/** Run `call`; if it came back as a dropped connection, wait a moment and run it exactly once more. */
export async function onceMoreIfDropped<T extends { error: unknown }>(call: () => Promise<T>, waitMs = 400): Promise<T> {
    let first: T;
    try {
        first = await call();
    } catch (err) {
        if (!isDroppedConnection(err)) throw err;
        await new Promise((r) => setTimeout(r, waitMs));
        return call();
    }
    if (!isDroppedConnection(first.error)) return first;
    await new Promise((r) => setTimeout(r, waitMs));
    return call();
}
