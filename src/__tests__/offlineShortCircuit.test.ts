// src/__tests__/offlineShortCircuit.test.ts
// UX-10/UX-11. Mobile had no network awareness at all. A message sent with no
// signal went to /api/chat-reply and waited out the timeout, then to
// /api/respond and waited again, and only then reached the on-device reply
// engine — which would have answered instantly. The person watched a typing
// indicator the whole time.

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => () => {}) },
}));

import {
  getConnectivity, isDefinitelyOffline, __setConnectivityForTest,
} from "../lib/network/online";
import {
  fetchWithTimeout, OfflineError, NetworkUnavailableError,
  isNetworkFailure, DEFAULT_REMOTE_TIMEOUT_MS,
} from "../lib/network/fetchWithTimeout";

afterEach(() => { __setConnectivityForTest("unknown"); jest.restoreAllMocks(); });

describe("three states, not two", () => {
  it("starts unknown, before NetInfo has said anything", () => {
    expect(getConnectivity()).toBe("unknown");
  });

  it("unknown is NOT treated as offline", () => {
    // The two mistakes do not cost the same. Waiting a few seconds for a
    // request that would have worked is an annoyance; refusing to try when we
    // could have is a broken app.
    expect(isDefinitelyOffline()).toBe(false);
  });

  it("only a definite offline counts", () => {
    __setConnectivityForTest("offline");
    expect(isDefinitelyOffline()).toBe(true);
    __setConnectivityForTest("online");
    expect(isDefinitelyOffline()).toBe(false);
  });
});

describe("offline requests fail at once instead of waiting", () => {
  it("throws OfflineError without touching the network", async () => {
    const spy = jest.spyOn(globalThis, "fetch" as never);
    __setConnectivityForTest("offline");
    await expect(fetchWithTimeout("https://example.com", {})).rejects.toBeInstanceOf(OfflineError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fails fast — not after the timeout", async () => {
    __setConnectivityForTest("offline");
    const started = Date.now();
    await expect(fetchWithTimeout("https://example.com", {})).rejects.toThrow();
    // The point of the change: the caller gets its answer immediately and can
    // fall through to the on-device engine.
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("still attempts the request when the state is unknown", async () => {
    const fetchMock = jest.fn(() => Promise.resolve(new Response("ok")));
    jest.spyOn(globalThis, "fetch" as never).mockImplementation(fetchMock as never);
    __setConnectivityForTest("unknown");
    await fetchWithTimeout("https://example.com", {});
    expect(fetchMock).toHaveBeenCalled();
  });

  it("still attempts the request when online", async () => {
    const fetchMock = jest.fn(() => Promise.resolve(new Response("ok")));
    jest.spyOn(globalThis, "fetch" as never).mockImplementation(fetchMock as never);
    __setConnectivityForTest("online");
    await fetchWithTimeout("https://example.com", {});
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("the timeout that remains", () => {
  it("is short enough that a dead connection is not a long wait", () => {
    // NetInfo can report connected on a captive portal or a dead cell, so the
    // timeout still has to exist — it just should not be 20 seconds twice.
    expect(DEFAULT_REMOTE_TIMEOUT_MS).toBeLessThanOrEqual(12_000);
  });
});


describe("telling 'no network' apart from 'the server said no'", () => {
  // This decides whether a SECOND remote endpoint is worth trying. Getting it
  // wrong in one direction wastes another full timeout; in the other, it
  // skips a fallback that would have worked.
  it("treats our own timeout as a network failure", () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    expect(isNetworkFailure(abort)).toBe(true);
  });

  it("treats React Native's failed fetch as one", () => {
    const rn = new TypeError("Network request failed");
    expect(isNetworkFailure(rn)).toBe(true);
  });

  it("treats being offline as one", () => {
    expect(isNetworkFailure(new OfflineError())).toBe(true);
    expect(isNetworkFailure(new NetworkUnavailableError("x"))).toBe(true);
  });

  it("does NOT treat a server error as one", () => {
    // A 500 means the server was reachable and refused. The second endpoint
    // is a different server path and may well answer.
    expect(isNetworkFailure(new Error("HTTP 500 from /api/chat-reply"))).toBe(false);
    expect(isNetworkFailure(new Error("quota exceeded"))).toBe(false);
  });

  it("does not choke on junk", () => {
    expect(isNetworkFailure(null)).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
    expect(isNetworkFailure("a string")).toBe(false);
  });
});
