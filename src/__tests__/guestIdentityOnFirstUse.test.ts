// The guest identity is made on FIRST USE, not on app open (owner, 27 Nov 2026).
//
// Admin ⇒ Licenses showed hundreds of guest accounts with nothing in them: the app made an
// anonymous account every time it was opened without a session — fresh installs that never typed,
// the stores' test robots, our own simulator runs. Now it is made by ensureGuestToken() when the
// person first types, presses the mic, asks for read-aloud, or sends.
//
// ⚖️ Nothing a guest does may get worse: the first message waits for the identity at most
// GUEST_TOKEN_WAIT_MS (normally it is ready already — started while typing), never when the phone is
// definitely offline, and read-aloud gets the identity before it asks for the voice.
//
// Source checks, like authCallbackDeadlock.test.ts: the real behaviour needs a device (simulated
// on the iOS simulator and the Android emulator before release).

import fs from "fs";
import path from "path";

const AUTH = fs.readFileSync(path.join(process.cwd(), "src/auth/AuthContext.tsx"), "utf8");
const CHAT = fs.readFileSync(path.join(process.cwd(), "src/screens/ChatScreen.tsx"), "utf8");

function block(src: string, startMarker: string, endMarker: string): string {
    const a = src.indexOf(startMarker);
    const b = src.indexOf(endMarker, a + startMarker.length);
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    return src.slice(a, b);
}

describe("opening the app makes no guest account", () => {
    it("the old create-on-open path is switched off", () => {
        expect(AUTH).toMatch(/export const CREATE_GUEST_ON_OPEN = false;/);
        expect(AUTH).toMatch(/if \(CREATE_GUEST_ON_OPEN && !s && !anonymousSignInInFlight\.current\)/);
    });

    it("ensureGuestToken never replaces a session that exists — reads it first, then signs in", () => {
        const fn = block(AUTH, "const ensureGuestToken = useCallback(", "}, []);");
        const read = fn.indexOf("supabase.auth.getSession()");
        const make = fn.indexOf("supabase.auth.signInAnonymously()");
        expect(read).toBeGreaterThan(-1);
        expect(make).toBeGreaterThan(read);
        expect(fn.slice(read, make)).toMatch(/if \(existing\) return existing\.user\?\.is_anonymous \? existing\.access_token : null;/);
        // one at a time
        expect(fn).toMatch(/if \(guestSignInRef\.current\) return guestSignInRef\.current;/);
    });

    it("ensureGuestToken is outside the onAuthStateChange callback (auth-lock deadlock)", () => {
        const cb = AUTH.indexOf("supabase.auth.onAuthStateChange(");
        const fn = AUTH.indexOf("const ensureGuestToken = useCallback(");
        const cbEnd = AUTH.indexOf("listener.subscription.unsubscribe()", cb);
        expect(fn < cb || fn > cbEnd).toBe(true);
    });

    it("the context offers it", () => {
        expect(AUTH).toMatch(/ensureGuestToken: \(\) => Promise<string \| null>;/);
        expect(AUTH).toMatch(/anonymousAccessToken: anonymousToken,\n\s+ensureGuestToken,/);
    });
});

describe("first use makes it — and nothing waits longer than it did", () => {
    it("typing and the mic start it in the background", () => {
        expect(CHAT).toMatch(/const handleInputChange = \(text: string\) => \{\n\s+if \(text\.trim\(\)\) warmGuestTokenRef\.current\(\);/);
        expect(CHAT).toMatch(/if \(voiceStateRef\.current === "idle"\) \{\n\s+warmGuestTokenRef\.current\(\);/);
    });

    it("sending: bounded wait, and never when definitely offline", () => {
        expect(CHAT).toMatch(/const GUEST_TOKEN_WAIT_MS = 2500;/);
        expect(CHAT).toMatch(/new Promise<null>\(\(r\) => setTimeout\(\(\) => r\(null\), GUEST_TOKEN_WAIT_MS\)\)/);
        expect(CHAT).toMatch(/const sendToken = wantsCloud && !isDefinitelyOffline\(\) \? await guestTokenNow\(\) : currentGuestToken\(\);/);
    });

    it("both cloud paths (stream and fallback) send that token", () => {
        expect(CHAT).toMatch(/streamChatReply\(\n\s+cloudPayload,\n\s+sendToken,/);
        expect(CHAT).toMatch(/accessToken: sendToken, \/\/ same reason as the stream above/);
        // ⛔ the stale render value is no longer what a chat sends
        expect(CHAT).not.toMatch(/streamChatReply\(\n\s+cloudPayload,\n\s+guestAccessToken,/);
    });

    it("read-aloud: tapping speak gets the identity first; auto-read uses the one made on send", () => {
        expect(CHAT.match(/ttsRate, ttsPitch, await guestTokenNow\(\),/g)?.length).toBe(2);
        expect(CHAT).toMatch(/ttsRate, ttsPitch, currentGuestToken\(\),\n\s+\(\) => \{ setPreparingSpeechId\(null\); setSpeakingMessageId\(botMessage\.id\); \}/);
        expect(CHAT).not.toMatch(/ttsRate, ttsPitch, guestAccessToken,/);
    });

    it("a real account always wins over a guest token", () => {
        expect(CHAT).toMatch(/const guestAccessToken = accessToken \?\? anonymousAccessToken \?\? undefined;/);
        expect(CHAT).toMatch(/const currentGuestToken = \(\): string \| undefined => guestAccessToken \?\? guestTokenRef\.current \?\? undefined;/);
        expect(CHAT).toMatch(/useEffect\(\(\) => \{ guestTokenRef\.current = null; \}, \[accessToken\]\);/);
    });
});
