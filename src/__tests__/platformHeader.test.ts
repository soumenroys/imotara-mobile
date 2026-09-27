// Every API call from the app must announce which platform it came from, or
// the web-vs-app split on /admin/analytics reads as though the app has no
// users. There are TWO live fetch helpers and ~18 call sites; the header is
// set inside the helpers precisely so no call site can forget. These tests
// exist to catch someone removing it from one helper and not noticing,
// because the resulting dashboard would look plausible and be wrong.

import { fetchWithTimeout as simpleFetch } from "../lib/fetchWithTimeout";
import { fetchWithTimeout as networkFetch } from "../lib/network/fetchWithTimeout";
import { APP_VERSION, UNKNOWN_VERSION } from "../config/appVersion";

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
const versionOf = (init: RequestInit) =>
    (init.headers as Record<string, string> | undefined)?.["X-Imotara-Version"];

describe.each([
    ["lib/fetchWithTimeout", simpleFetch],
    ["lib/network/fetchWithTimeout", networkFetch],
])("%s", (_name, doFetch) => {
    it("attaches the platform header", async () => {
        const seen = mockFetch();
        await doFetch("https://api.example.com/x", {});
        expect(headerOf(seen[0])).toMatch(/^(ios|android)$/);
    });

    // 🔴 WHY THIS IS PINNED. Retiring pro_* and repricing left 1.4.1 and 1.3.2
    // rendering prices we could not correct, and nothing could be done because
    // no client told the server its version. The header is set inside the
    // helpers so no call site can forget; this test is what stops it being
    // dropped from one helper and not the other — which is exactly how the
    // platform header would have rotted.
    it("attaches the app version header", async () => {
        const seen = mockFetch();
        await doFetch("https://api.example.com/x", {});
        expect(versionOf(seen[0])).toBe(APP_VERSION);
        expect(versionOf(seen[0])).toBeTruthy();
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
        expect(h["X-Imotara-Version"]).toBe(APP_VERSION);
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

// The version is read on the path of EVERY request, including /api/chat-reply.
// A reply must never fail because a version string could not be resolved.
describe("the version can never break a request", () => {
    it("resolves to a non-empty string, falling back rather than throwing", () => {
        expect(typeof APP_VERSION).toBe("string");
        expect(APP_VERSION.length).toBeGreaterThan(0);
    });

    it("exports an explicit fallback rather than undefined or empty", () => {
        expect(UNKNOWN_VERSION).toBe("unknown");
    });
});
