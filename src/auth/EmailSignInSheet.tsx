// src/auth/EmailSignInSheet.tsx — #134 (owner, 12 Nov 2026): sign in with ANY email address, on the
// phone, exactly as on the website:
//   · Email me a code — our server emails a code from imotara.com; type it and you are in
//   · Use a password  — sign in; "Create an account" and "Forgot password?" are a code first,
//                       then choose a password (the code proves the address is yours)
// Opened from every sign-in place via openEmailSignIn() (src/auth/emailSignInBus.ts).
// ⛔ Never sends anything for the person; never shows an outside service's name.
// The guest's chats on this phone join the account automatically on sign-in (AuthContext, #135).
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useAuth } from "./AuthContext";
import { onOpenEmailSignIn, type EmailIntent } from "./emailSignInBus";
import { sheetTitle, type Step } from "./emailSheetSteps";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const CODE_MIN = 6;
export const CODE_MAX = 10;
export const MIN_PASSWORD = 8;


export default function EmailSignInSheet() {
    const { requestEmailCode, verifyEmailCode, signInWithEmailPassword, setAccountPassword, status } = useAuth();
    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState<Step>({ kind: "choose" });
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const awaitingPasswordRef = useRef(false);

    useEffect(() => onOpenEmailSignIn(({ intent }) => {
        setError(""); setCode(""); setPassword(""); setBusy(false);
        awaitingPasswordRef.current = false;
        setStep(intent ? { kind: "code-email", intent } : { kind: "choose" });
        setVisible(true);
    }), []);

    // Signed in by a plain code ⇒ done. (After a create/reset code we stay open to set the password.)
    useEffect(() => {
        if (visible && status === "authenticated" && !awaitingPasswordRef.current && step.kind !== "set-password") setVisible(false);
    }, [status, visible, step.kind]);

    const close = () => { if (!busy) { Keyboard.dismiss(); setVisible(false); } };

    async function sendCode() {
        Keyboard.dismiss();
        if (step.kind !== "code-email") return;
        const em = email.trim().toLowerCase();
        if (!EMAIL_RX.test(em)) { setError("Please enter a valid email address."); return; }
        setBusy(true); setError("");
        const r = await requestEmailCode(em, step.intent === "reset" ? "reset" : "signin");
        setBusy(false);
        if (r === "sent") { setCode(""); setStep({ kind: "code-enter", email: em, intent: step.intent }); return; }
        setError(r === "rate_limited"
            ? "You've asked for several codes already. Please use the latest code we sent, or wait up to an hour before asking again."
            : r === "invalid_email" ? "Please enter a valid email address."
            : "We couldn't send the code just now. Please try again in a minute.");
    }

    async function verifyCode() {
        Keyboard.dismiss();
        if (step.kind !== "code-enter") return;
        const digits = code.replace(/\D/g, "");
        if (digits.length < CODE_MIN || digits.length > CODE_MAX) { setError("Please type the whole code from the email."); return; }
        setBusy(true); setError("");
        awaitingPasswordRef.current = step.intent !== "signin";
        const r = await verifyEmailCode(step.email, digits);
        setBusy(false);
        if (!r.ok) { awaitingPasswordRef.current = false; setError(r.message); return; }
        if (step.intent !== "signin") { setPassword(""); setStep({ kind: "set-password", intent: step.intent }); return; }
        setVisible(false);
    }

    async function savePassword() {
        Keyboard.dismiss();
        if (step.kind !== "set-password") return;
        if (password.length < MIN_PASSWORD) { setError(`Please use a password of at least ${MIN_PASSWORD} characters.`); return; }
        setBusy(true); setError("");
        const r = await setAccountPassword(password);
        setBusy(false);
        if (!r.ok) { setError(r.message); return; }
        awaitingPasswordRef.current = false;
        setVisible(false);
    }

    async function withPassword() {
        Keyboard.dismiss();
        const em = email.trim().toLowerCase();
        if (!EMAIL_RX.test(em)) { setError("Please enter a valid email address."); return; }
        if (!password) { setError("Please enter your password."); return; }
        setBusy(true); setError("");
        const r = await signInWithEmailPassword(em, password);
        setBusy(false);
        if (!r.ok) { setError(r.message); return; }
        setVisible(false);
    }

    if (!visible) return null;

    const back = (
        <TouchableOpacity onPress={() => { setError(""); setStep({ kind: "choose" }); }} style={styles.linkBtn} accessibilityRole="button">
            <Text style={styles.linkMuted}>← Other ways</Text>
        </TouchableOpacity>
    );

    return (
        <Modal transparent visible animationType="slide" onRequestClose={close}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <Pressable style={styles.backdrop} onPress={close}>
                    <Pressable style={styles.sheet} accessibilityViewIsModal>
                        {/* "always", not "handled": seen in the simulator (12 Nov) — with a field focused, the
                            FIRST tap on Send / Sign in / Not now was swallowed and only a second tap worked.
                            Each action dismisses the keyboard itself instead. */}
                        <ScrollView keyboardShouldPersistTaps="always" bounces={false}>
                            <View style={styles.handle} />
                            {/* Each field below has its own `key`: without it React reuses ONE native field across steps and
                                iOS keeps a removed style — the password box inherited the code box's letter-spacing
                                (simulator, 12 Nov). */}
                            <Text style={styles.title} accessibilityRole="header">{sheetTitle(step)}</Text>

                            {step.kind === "choose" && (
                                <>
                                    <Text style={styles.subtitle}>Any address works — personal, work or school.</Text>
                                    <TouchableOpacity style={styles.primary} onPress={() => { setError(""); setStep({ kind: "code-email", intent: "signin" }); }} accessibilityRole="button">
                                        <Text style={styles.primaryText}>Email me a code</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.secondary} onPress={() => { setError(""); setStep({ kind: "password" }); }} accessibilityRole="button">
                                        <Text style={styles.secondaryText}>Use a password</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {step.kind === "code-email" && (
                                <>
                                    <Text style={styles.subtitle}>
                                        {step.intent === "create" ? "We'll send a code to confirm your email, then you choose a password."
                                            : step.intent === "reset" ? "We'll send a code, then you choose a new password."
                                            : "We'll send you a code. No password needed."}
                                    </Text>
                                    <TextInput
                                        key="in-code-email" style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com"
                                        placeholderTextColor="rgba(255,255,255,0.35)" keyboardType="email-address" autoCapitalize="none"
                                        autoCorrect={false} autoComplete="email" textContentType="emailAddress" autoFocus
                                        returnKeyType="send" onSubmitEditing={() => void sendCode()} accessibilityLabel="Your email"
                                    />
                                    <TouchableOpacity style={styles.primary} onPress={() => void sendCode()} disabled={busy} accessibilityRole="button">
                                        {busy ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.primaryText}>Send me a code</Text>}
                                    </TouchableOpacity>
                                    {back}
                                </>
                            )}

                            {step.kind === "code-enter" && (
                                <>
                                    <Text style={styles.subtitle}>We sent a code to {step.email}. It can take a minute — check spam too.</Text>
                                    <TextInput
                                        key="in-code" style={[styles.input, styles.codeInput]} value={code} onChangeText={setCode} placeholder="12345678"
                                        placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" autoComplete="one-time-code"
                                        textContentType="oneTimeCode" maxLength={CODE_MAX + 2} autoFocus
                                        returnKeyType="done" onSubmitEditing={() => void verifyCode()} accessibilityLabel="The code from the email"
                                    />
                                    <TouchableOpacity style={styles.primary} onPress={() => void verifyCode()} disabled={busy} accessibilityRole="button">
                                        {busy ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.primaryText}>{step.intent === "signin" ? "Sign in" : "Continue"}</Text>}
                                    </TouchableOpacity>
                                    <View style={styles.row}>
                                        <TouchableOpacity onPress={() => { setError(""); setStep({ kind: "code-email", intent: step.intent }); }} style={styles.linkBtn} accessibilityRole="button">
                                            <Text style={styles.linkMuted}>Send a new code</Text>
                                        </TouchableOpacity>
                                        {back}
                                    </View>
                                </>
                            )}

                            {step.kind === "set-password" && (
                                <>
                                    <Text style={styles.subtitle}>{step.intent === "reset" ? "You're in. Choose a new password:" : "Your email is confirmed. Choose a password:"}</Text>
                                    <TextInput
                                        key="in-new-password" style={styles.input} value={password} onChangeText={setPassword} placeholder={`At least ${MIN_PASSWORD} characters`}
                                        placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry autoComplete="password-new" textContentType="newPassword"
                                        autoFocus returnKeyType="done" onSubmitEditing={() => void savePassword()} accessibilityLabel="New password"
                                    />
                                    <TouchableOpacity style={styles.primary} onPress={() => void savePassword()} disabled={busy} accessibilityRole="button">
                                        {busy ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.primaryText}>Save and continue</Text>}
                                    </TouchableOpacity>
                                </>
                            )}

                            {step.kind === "password" && (
                                <>
                                    <TextInput
                                        key="in-pw-email" style={styles.input} value={email} onChangeText={setEmail} placeholder="Email — any address"
                                        placeholderTextColor="rgba(255,255,255,0.35)" keyboardType="email-address" autoCapitalize="none"
                                        autoCorrect={false} autoComplete="email" textContentType="emailAddress" autoFocus accessibilityLabel="Email"
                                    />
                                    <TextInput
                                        key="in-pw-password" style={styles.input} value={password} onChangeText={setPassword} placeholder="Password"
                                        placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry autoComplete="password" textContentType="password"
                                        returnKeyType="go" onSubmitEditing={() => void withPassword()} accessibilityLabel="Password"
                                    />
                                    <TouchableOpacity style={styles.primary} onPress={() => void withPassword()} disabled={busy} accessibilityRole="button">
                                        {busy ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.primaryText}>Sign in</Text>}
                                    </TouchableOpacity>
                                    <View style={styles.row}>
                                        <TouchableOpacity onPress={() => { setError(""); setPassword(""); setStep({ kind: "code-email", intent: "create" }); }} style={styles.linkBtn} accessibilityRole="button">
                                            <Text style={styles.link}>New here? Create an account</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => { setError(""); setPassword(""); setStep({ kind: "code-email", intent: "reset" }); }} style={styles.linkBtn} accessibilityRole="button">
                                            <Text style={styles.linkMuted}>Forgot password?</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {back}
                                </>
                            )}

                            {!!error && <Text style={styles.error} accessibilityRole="alert">⚠️ {error}</Text>}

                            <TouchableOpacity style={styles.skipBtn} onPress={close} accessibilityRole="button">
                                <Text style={styles.skipText}>Not now</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
        backgroundColor: "#1a1a2e", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 40 : 28, paddingTop: 12, maxHeight: "90%",
    },
    handle: { width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
    title: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
    subtitle: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 20 },
    input: {
        backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderRadius: 12,
        color: "#fff", fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
        // ⛔ keep these explicit: iOS reuses native text fields (view recycling) and a style that is merely
        // ABSENT is not reset — the email/password boxes came back letter-spaced and centred after the
        // code box (simulator, 12 Nov). Keys alone did not cure it.
        letterSpacing: 0, textAlign: "left",
    },
    // ⛔ no letterSpacing / textAlign on ANY TextInput: iOS recycles native text fields across the whole app,
    // and the code box's spacing turned up in Settings' search box after a sign-in (simulator, 12 Nov).
    codeInput: { fontSize: 20 },
    primary: { backgroundColor: "#fff", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12, minHeight: 50, justifyContent: "center" },
    primaryText: { color: "#1a1a2e", fontWeight: "600", fontSize: 16 },
    secondary: { borderColor: "rgba(255,255,255,0.3)", borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12 },
    secondaryText: { color: "#fff", fontWeight: "600", fontSize: 16 },
    row: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" },
    linkBtn: { paddingVertical: 8 },
    // Always a dark sheet (like SignInPrompt) — white text only, so no dark-only accent hex.
    link: { color: "#fff", fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
    linkMuted: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
    error: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 8 },
    skipBtn: { paddingVertical: 10, alignItems: "center", marginTop: 4 },
    skipText: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
});
