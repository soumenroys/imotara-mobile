// #169 — native Google sign-in, with the old web flow as the only fallback.
import fs from "fs";
import path from "path";

const root = path.join(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");

function loadWith(os: string, google: any) {
    jest.resetModules();
    jest.doMock("react-native", () => ({ Platform: { OS: os } }), { virtual: true });
    jest.doMock("@react-native-google-signin/google-signin", () => google, { virtual: true });
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "web-id";
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "ios-id";
    return require("../auth/nativeGoogle") as typeof import("../auth/nativeGoogle");
}

function fakeGoogle(signIn: () => Promise<any>, extra: any = {}) {
    const statusCodes = { SIGN_IN_CANCELLED: "-5", IN_PROGRESS: "-6", PLAY_SERVICES_NOT_AVAILABLE: "-7" };
    return {
        statusCodes,
        isErrorWithCode: (e: any) => !!e && typeof e.code === "string",
        GoogleSignin: {
            configure: jest.fn(),
            hasPlayServices: jest.fn(async () => true),
            signIn: jest.fn(signIn),
            signOut: jest.fn(async () => null),
            ...extra,
        },
    };
}

describe("canTryNativeGoogle", () => {
    const { canTryNativeGoogle } = loadWith("android", fakeGoogle(async () => ({})));
    it("android needs the web client id; iOS needs both; web never", () => {
        expect(canTryNativeGoogle("android", "w", undefined)).toBe(true);
        expect(canTryNativeGoogle("android", undefined, "i")).toBe(false);
        expect(canTryNativeGoogle("ios", "w", "i")).toBe(true);
        expect(canTryNativeGoogle("ios", "w", undefined)).toBe(false);
        expect(canTryNativeGoogle("web", "w", "i")).toBe(false);
    });
});

describe("getGoogleIdToken", () => {
    it("success ⇒ the id token", async () => {
        const m = loadWith("android", fakeGoogle(async () => ({ type: "success", data: { idToken: "tok" } })));
        expect(await m.getGoogleIdToken()).toEqual({ kind: "token", idToken: "tok" });
    });

    it("the person cancelling is a cancel — never a fallback to another sign-in page", async () => {
        const a = loadWith("android", fakeGoogle(async () => ({ type: "cancelled", data: null })));
        expect((await a.getGoogleIdToken()).kind).toBe("cancelled");
        const b = loadWith("ios", fakeGoogle(async () => { throw Object.assign(new Error("x"), { code: "-5" }); }));
        expect((await b.getGoogleIdToken()).kind).toBe("cancelled");
    });

    it("any other failure is 'unavailable' (⇒ old web flow), never a throw", async () => {
        const noPlay = loadWith("android", fakeGoogle(async () => ({}), {
            hasPlayServices: jest.fn(async () => { throw Object.assign(new Error("np"), { code: "-7" }); }),
        }));
        expect((await noPlay.getGoogleIdToken()).kind).toBe("unavailable");
        const devErr = loadWith("android", fakeGoogle(async () => { throw Object.assign(new Error("DEVELOPER_ERROR"), { code: "10" }); }));
        expect((await devErr.getGoogleIdToken()).kind).toBe("unavailable");
        const noToken = loadWith("ios", fakeGoogle(async () => ({ type: "success", data: { idToken: null } })));
        expect((await noToken.getGoogleIdToken()).kind).toBe("unavailable");
    });

    it("never pushes a Play-services update dialog", async () => {
        const g = fakeGoogle(async () => ({ type: "success", data: { idToken: "t" } }));
        const m = loadWith("android", g);
        await m.getGoogleIdToken();
        expect(g.GoogleSignin.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: false });
    });

    it("asks for email + profile only", async () => {
        const g = fakeGoogle(async () => ({ type: "success", data: { idToken: "t" } }));
        await loadWith("ios", g).getGoogleIdToken();
        expect(g.GoogleSignin.configure).toHaveBeenCalledWith(expect.objectContaining({ scopes: ["email", "profile"], webClientId: "web-id", iosClientId: "ios-id" }));
    });
});

describe("wiring", () => {
    const auth = read("src/auth/AuthContext.tsx");
    const fn = auth.slice(auth.indexOf("const signInWithGoogle"), auth.indexOf("const signInWithApple"));

    it("native comes FIRST, a cancel returns, and the web flow stays as the fallback", () => {
        const native = fn.indexOf("getGoogleIdToken()");
        const cancel = fn.indexOf('native.kind === "cancelled") return');
        const web = fn.indexOf("signInWithOAuth(");
        expect(native).toBeGreaterThan(-1);
        expect(cancel).toBeGreaterThan(native);
        expect(web).toBeGreaterThan(cancel);
        expect(fn).toMatch(/signInWithIdToken\(\{ provider: "google"/);
    });

    it("sign-out forgets the Google account too", () => {
        const so = auth.slice(auth.indexOf("const signOut"));
        expect(so).toMatch(/signOutNativeGoogle\(\)/);
    });

    it("no optional chaining on process.env (Expo inlining)", () => {
        expect(read("src/auth/nativeGoogle.ts")).not.toMatch(/process\?\.env|env\?\./);
    });

    it("the iOS URL scheme is the reversed iOS client id that every build profile ships", () => {
        const app = JSON.parse(read("app.json"));
        const entry = app.expo.plugins.find((p: any) => Array.isArray(p) && p[0] === "@react-native-google-signin/google-signin");
        expect(entry).toBeTruthy();
        const eas = JSON.parse(read("eas.json"));
        const ids = new Set(
            Object.values(eas.build as Record<string, any>)
                .map((p) => p?.env?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID)
                .filter(Boolean),
        );
        expect(ids.size).toBe(1);
        const iosId = [...ids][0] as string;
        expect(entry[1].iosUrlScheme).toBe("com.googleusercontent.apps." + iosId.replace(".apps.googleusercontent.com", ""));
    });
});
