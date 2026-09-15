// Every API call from the app must announce which platform it came from, or
// the web-vs-app split on /admin/analytics reads as though the app has no
// users. There are TWO live fetch helpers and ~18 call sites; the header is
// set inside the helpers precisely so no call site can forget. These tests
// exist to catch someone removing it from one helper and not noticing,
// because the resulting dashboard would look plausible and be wrong.

import { fetchWithTimeout as simpleFetch } from "../lib/fetchWithTimeout";
import { fetchWithTimeout as networkFetch } from "../lib/network/fetchWithTimeout";

// react-native is NOT mocked here. Mocking the whole module replaces
// NativeModules, which netinfo reaches for at import time through
// lib/network/online — so the mock breaks the very helpers under test.
// jest-expo already supplies a real Platform, so the assertions below check
// the header is one of the allowed values rather than pinning a single OS.

const realFetch = (global as any).fetch;

function mockFetch() {
    const seen: RequestInit[] = [];
    const mock = jest.fn((_url: string, init?: RequestInit) => {
        seen.push(init ?? {});
        return Promise.resolve({ ok: true } as Response);
    });
    (global as any).fetch = mock;
    return seen;
}

afterEach(() => { (global as any).fetch = realFetch; jest.clearAllMocks(); });

const headerOf = (init: RequestInit) =>
    (init.headers as Record<string, string> | undefined)?.["X-Imotara-Platform"];

describe.each([
    ["lib/fetchWithTimeout", simpleFetch],
    ["lib/network/fetchWithTimeout", networkFetch],
])("%s", (_name, doFetch) => {
    it("attaches the platform header", async () => {
        const seen = mockFetch();
        await doFetch("https://api.example.com/x", {});
        expect(headerOf(seen[0])).toMatch(/^(ios|android)$/);
    });

    it("keeps the caller's own headers", async () => {
        const seen = mockFetch();
        await doFetch("https://api.example.com/x", {
            headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
        });
        const h = seen[0].headers as Record<string, string>;
        expect(h["Content-Type"]).toBe("application/json");
        expect(h.Authorization).toBe("Bearer t");
        expect(h["X-Imotara-Platform"]).toMatch(/^(ios|android)$/);
    });

    it("does not disturb the body or method", async () => {
        const seen = mockFetch();
        await doFetch("https://api.example.com/x", { method: "POST", body: "{\"a\":1}" });
        expect(seen[0].method).toBe("POST");
        expect(seen[0].body).toBe("{\"a\":1}");
    });

    it("carries no identifier — the header names the OS and nothing else", async () => {
        const seen = mockFetch();
        await doFetch("https://api.example.com/x", {});
        // The privacy promise depends on this staying a fixed enum. If someone
        // appends a device id or install uuid, this fails.
        expect(headerOf(seen[0])).toMatch(/^(ios|android|unknown)$/);
    });
});
