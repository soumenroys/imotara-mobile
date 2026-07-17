// Tests for BOTH fetch-timeout helpers. The repo currently has two parallel
// implementations with different defaults and semantics:
//   - src/lib/fetchWithTimeout.ts          (default 15s, no external-signal support)
//   - src/lib/network/fetchWithTimeout.ts  (default 20s, forwards an external AbortSignal)
// Call sites import one or the other — these tests pin down each one's contract
// so a future consolidation preserves behavior.

import { fetchWithTimeout as simpleFetchWithTimeout } from "../lib/fetchWithTimeout";
import {
    fetchWithTimeout as networkFetchWithTimeout,
    DEFAULT_REMOTE_TIMEOUT_MS,
} from "../lib/network/fetchWithTimeout";

// A fetch mock that resolves/rejects based on the AbortSignal it receives,
// mimicking whatwg-fetch abort semantics on Hermes.
function installFetchMock(opts: { resolveAfterMs?: number } = {}) {
    const seenSignals: AbortSignal[] = [];
    const mock = jest.fn((_url: string, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) seenSignals.push(signal);
        return new Promise<Response>((resolve, reject) => {
            const onAbort = () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
            if (signal?.aborted) return onAbort();
            signal?.addEventListener("abort", onAbort);
            if (opts.resolveAfterMs !== undefined) {
                setTimeout(() => resolve({ ok: true } as Response), opts.resolveAfterMs);
            }
            // otherwise: hang forever unless aborted
        });
    });
    (global as any).fetch = mock;
    return { mock, seenSignals };
}

const realFetch = (global as any).fetch;

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
    (global as any).fetch = realFetch;
});

describe("lib/fetchWithTimeout (simple, 15s default)", () => {
    test("aborts the request when the timeout elapses", async () => {
        const { seenSignals } = installFetchMock(); // hangs forever
        const p = simpleFetchWithTimeout("https://example.com/api", {}, 5000);
        const assertion = expect(p).rejects.toMatchObject({ name: "AbortError" });
        jest.advanceTimersByTime(5001);
        await assertion;
        expect(seenSignals[0]?.aborted).toBe(true);
    });

    test("resolves normally before the timeout and does not abort afterwards", async () => {
        const { seenSignals } = installFetchMock({ resolveAfterMs: 100 });
        const p = simpleFetchWithTimeout("https://example.com/api", {}, 5000);
        jest.advanceTimersByTime(150);
        await expect(p).resolves.toMatchObject({ ok: true });
        // Timer was cleared on settle — advancing past the timeout must not abort.
        jest.advanceTimersByTime(10_000);
        expect(seenSignals[0]?.aborted).toBe(false);
    });

    test("uses the 15s default timeout", async () => {
        const { seenSignals } = installFetchMock();
        const p = simpleFetchWithTimeout("https://example.com/api");
        p.catch(() => {}); // avoid unhandled rejection noise
        jest.advanceTimersByTime(14_999);
        expect(seenSignals[0]?.aborted).toBe(false);
        jest.advanceTimersByTime(2);
        expect(seenSignals[0]?.aborted).toBe(true);
    });
});

describe("lib/network/fetchWithTimeout (20s default, external signal)", () => {
    test("exports a 20s default", () => {
        expect(DEFAULT_REMOTE_TIMEOUT_MS).toBe(20_000);
    });

    test("aborts when the timeout elapses", async () => {
        const { seenSignals } = installFetchMock();
        const p = networkFetchWithTimeout("https://example.com/api", {}, 3000);
        const assertion = expect(p).rejects.toMatchObject({ name: "AbortError" });
        jest.advanceTimersByTime(3001);
        await assertion;
        expect(seenSignals[0]?.aborted).toBe(true);
    });

    test("forwards an external AbortSignal (caller cancel wins before timeout)", async () => {
        const { seenSignals } = installFetchMock();
        const external = new AbortController();
        const p = networkFetchWithTimeout(
            "https://example.com/api",
            { signal: external.signal },
            60_000
        );
        const assertion = expect(p).rejects.toMatchObject({ name: "AbortError" });
        external.abort();
        await assertion;
        expect(seenSignals[0]?.aborted).toBe(true);
    });

    test("clamps non-positive timeouts to at least 1ms instead of never firing", async () => {
        const { seenSignals } = installFetchMock();
        const p = networkFetchWithTimeout("https://example.com/api", {}, 0);
        const assertion = expect(p).rejects.toMatchObject({ name: "AbortError" });
        jest.advanceTimersByTime(2);
        await assertion;
        expect(seenSignals[0]?.aborted).toBe(true);
    });

    test("resolves normally before the timeout", async () => {
        installFetchMock({ resolveAfterMs: 50 });
        const p = networkFetchWithTimeout("https://example.com/api", {}, 5000);
        jest.advanceTimersByTime(60);
        await expect(p).resolves.toMatchObject({ ok: true });
    });
});
