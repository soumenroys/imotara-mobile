// src/auth/nativeGoogle.ts
//
// #169 — Google sign-in WITHOUT the web page that showed "supabase.co".
//
//   Android: Google's own account sheet (Play services) — no browser at all.
//   iOS:     Google's SDK. iOS still shows its system "wants to use google.com
//            to sign in" box (Apple requires it for any web sign-in), but it now
//            names google.com, not our database host.
//
// The ID token Google returns goes to supabase.auth.signInWithIdToken, the same
// way Apple sign-in already works — the session, guest-chat move and everything
// after it are unchanged.
//
// ⛔ NEVER WORSE THAN BEFORE: every failure except the person cancelling returns
// "unavailable", and the caller falls back to the old web sign-in. A phone
// without Play services, a dev client without the native module, or a client-ID
// setup mistake therefore costs nothing but the old box.
//
// Client IDs (Google Cloud project "imotara", Supabase Google provider lists the
// web + iOS ones as accepted audiences):
//   web      …980pi64… — the token audience on Android
//   iOS      …aou5kog… — the token audience on iOS
//   Android  …44m0m6… (debug key) and …fduefg0… (Play app-signing key, 21 Nov) —
//            not sent from code; Google matches them by package + signing key.

import { Platform } from "react-native";

export type NativeGoogleResult =
    | { kind: "token"; idToken: string }
    | { kind: "cancelled" }
    | { kind: "unavailable"; reason: string };

// ⚠️ No optional chaining on process.env — it defeats Expo's inlining in release builds.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

let mod: GoogleModule | null | undefined;
let configured = false;

function load(): GoogleModule | null {
    if (mod !== undefined) return mod;
    try {
        mod = require("@react-native-google-signin/google-signin") as GoogleModule;
    } catch {
        mod = null; // old dev client / Expo Go — fall back to the web flow
    }
    return mod;
}

/** Pure: is this platform + config able to try the native route at all? */
export function canTryNativeGoogle(os: string, webId?: string, iosId?: string): boolean {
    if (os === "android") return !!webId;
    if (os === "ios") return !!webId && !!iosId;
    return false;
}

export async function getGoogleIdToken(): Promise<NativeGoogleResult> {
    if (!canTryNativeGoogle(Platform.OS, WEB_CLIENT_ID, IOS_CLIENT_ID)) {
        return { kind: "unavailable", reason: "not configured" };
    }
    const g = load();
    if (!g) return { kind: "unavailable", reason: "module missing" };
    const { GoogleSignin, statusCodes, isErrorWithCode } = g;

    try {
        if (!configured) {
            GoogleSignin.configure({
                webClientId: WEB_CLIENT_ID,
                iosClientId: IOS_CLIENT_ID,
                // email + profile only — the same as the web sign-in asks for.
                scopes: ["email", "profile"],
            });
            configured = true;
        }
        if (Platform.OS === "android") {
            // false: never push a Play-services update dialog at someone who just
            // wants to sign in — fall back to the web flow instead.
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
        }
        const res = await GoogleSignin.signIn();
        if (res.type === "cancelled") return { kind: "cancelled" };
        const idToken = res.data?.idToken;
        if (!idToken) return { kind: "unavailable", reason: "no id token" };
        return { kind: "token", idToken };
    } catch (e) {
        if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return { kind: "cancelled" };
        if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return { kind: "cancelled" };
        const reason = isErrorWithCode(e) ? String(e.code) : String((e as Error)?.message ?? e);
        return { kind: "unavailable", reason };
    }
}

/** Sign the Google side out too, so the next sign-in offers the account picker again. */
export async function signOutNativeGoogle(): Promise<void> {
    const g = load();
    if (!g || !configured) return;
    try {
        await g.GoogleSignin.signOut();
    } catch {
        // nothing to undo
    }
}
