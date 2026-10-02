// src/auth/SignInPrompt.tsx
// Non-intrusive one-time sign-in prompt shown after the user's first message.
// Appears as a bottom sheet — user can dismiss it permanently.
// No username or password required: only Google and Apple OAuth.

import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Animated,
    Platform,
    Pressable,
    Linking,
    ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

const DISMISSED_KEY = "imotara.auth.prompt.dismissed.v1";

// Number of messages to wait before showing the prompt
const SHOW_AFTER_MESSAGES = 1;

type Props = {
    messageCount: number;
};

export function SignInPrompt({ messageCount }: Props) {
    const { status, signInWithGoogle, signInWithApple, appleSignInAvailable } =
        useAuth();
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(true); // start hidden until loaded
    const [signingInGoogle, setSigningInGoogle] = useState(false);
    const [signingInApple, setSigningInApple] = useState(false);
    const signingIn = signingInGoogle || signingInApple;
    const slideAnim = React.useRef(new Animated.Value(300)).current;

    // Load dismissed flag
    useEffect(() => {
        AsyncStorage.getItem(DISMISSED_KEY).then((val) => {
            setDismissed(val === "true");
        });
    }, []);

    // Show when threshold reached, user is not signed in, and not dismissed
    useEffect(() => {
        if (
            !dismissed &&
            status === "unauthenticated" &&
            messageCount >= SHOW_AFTER_MESSAGES
        ) {
            setVisible(true);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        }
    }, [dismissed, status, messageCount, slideAnim]);

    const handleDismiss = async () => {
        Animated.timing(slideAnim, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setVisible(false));
        setDismissed(true);
        await AsyncStorage.setItem(DISMISSED_KEY, "true");
    };

    /**
     * 🔴 THE SESSION ARRIVES OUT-OF-BAND — do not wait on the OAuth promise.
     *
     * Observed on Android 2026-10-02: this sheet sat on "Signing in…" for over
     * five minutes while the user was, in fact, **already signed in**. Force-
     * quitting and relaunching came up authenticated with history synced.
     *
     * The logs show exactly what happened:
     *     12:21:56  CustomTabActivity -> supabase OAuth
     *     12:22:01  MainActivity resumed (the redirect came back)
     *     12:22:02  the session was written to SecureStore
     *     (…then nothing at all for five minutes, spinner still turning)
     *
     * On Android the OAuth redirect arrives as a system deep-link intent, so
     * `WebBrowser.openAuthSessionAsync` resolves as `dismiss` — or never settles
     * at all. The old code was `await signInWithGoogle(); await handleDismiss();`
     * which meant **if that promise never settled, the sheet never closed and
     * `finally` never ran.** The spinner outlived the thing it was waiting for.
     *
     * 🔑 `UpgradeSheet` already knew this and guards against it by subscribing to
     * `onAuthStateChange` before opening OAuth. This component did not — the
     * knowledge existed in the codebase but had not reached here.
     *
     * The fix: watch the app's OWN auth state, which is the thing that actually
     * becomes true. The promise is still awaited for the happy path and for real
     * errors, but it is no longer what dismissal depends on.
     */
    useEffect(() => {
        if (!signingIn) return;
        if (status !== "authenticated") return;
        setSigningInGoogle(false);
        setSigningInApple(false);
        void handleDismiss();
    }, [signingIn, status]);   // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * ⚠️ LAST-RESORT UNSTICK. If neither the promise nor the auth state ever
     * arrives — no network, the user wandered off in the browser, OAuth failed
     * silently — the spinner must still stop. A stuck spinner reads as "broken",
     * and the only cure the user can find is force-quitting the app.
     *
     * Deliberately generous: a slow OAuth round-trip on a poor connection is
     * normal, and cutting it short would turn a slow success into a visible
     * failure. This only catches the case where nothing is coming at all.
     */
    useEffect(() => {
        if (!signingIn) return;
        const t = setTimeout(() => {
            setSigningInGoogle(false);
            setSigningInApple(false);
        }, 90_000);
        return () => clearTimeout(t);
    }, [signingIn]);

    const handleGoogle = async () => {
        if (signingIn) return;
        setSigningInGoogle(true);
        // ⚠️ No `finally` that clears the spinner: on Android this promise may
        // never settle. The effects above own the spinner's lifetime now.
        try {
            await signInWithGoogle();
            // Resolved cleanly (iOS, and Android when the browser returns
            // normally). If the session is already live the effect has dismissed
            // us; otherwise it will the moment auth state flips.
        } catch {
            setSigningInGoogle(false);
        }
    };

    const handleApple = async () => {
        if (signingIn) return;
        setSigningInApple(true);
        try {
            await signInWithApple();
        } catch {
            setSigningInApple(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleDismiss}
        >
            <Pressable style={styles.backdrop} onPress={handleDismiss}>
                <Animated.View
                    style={[
                        styles.sheet,
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* Stop backdrop press propagating into the sheet */}
                    <Pressable>
                        <View style={styles.handle} />

                        <Text style={styles.title}>Remember you, always</Text>
                        <Text style={styles.subtitle}>
                            Sign in once so Imotara can remember how you feel over time —
                            even if you switch devices. No account creation needed.
                        </Text>

                        {/* Google button */}
                        <TouchableOpacity
                            style={[styles.googleBtn, signingInApple && { opacity: 0.45 }]}
                            onPress={handleGoogle}
                            disabled={signingIn}
                            activeOpacity={0.8}
                        >
                            {signingInGoogle ? (
                                <ActivityIndicator size="small" color="#1a1a2e" style={{ marginRight: 8 }} />
                            ) : (
                                <MaterialCommunityIcons name="google" size={20} color="#4285F4" style={{ marginRight: 8 }} />
                            )}
                            <Text style={styles.googleBtnText}>{signingInGoogle ? "Signing in…" : "Continue with Google"}</Text>
                        </TouchableOpacity>

                        {/* Apple button — iOS only */}
                        {Platform.OS === "ios" && appleSignInAvailable && (
                            <TouchableOpacity
                                style={[styles.appleBtn, signingInGoogle && { opacity: 0.45 }]}
                                onPress={handleApple}
                                disabled={signingIn}
                                activeOpacity={0.8}
                            >
                                {signingInApple ? (
                                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                                ) : (
                                    <MaterialCommunityIcons name="apple" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                                )}
                                <Text style={styles.appleBtnText}>{signingInApple ? "Signing in…" : "Continue with Apple"}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Not now */}
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={handleDismiss}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.skipText}>Not now</Text>
                        </TouchableOpacity>

                        {/* Privacy & Terms links — required by Apple & Google */}
                        <View style={styles.legalRow}>
                            <TouchableOpacity onPress={() => Linking.openURL("https://imotara.com/privacy").catch(() => {})}>
                                <Text style={styles.legalLink}>Privacy Policy</Text>
                            </TouchableOpacity>
                            <Text style={styles.legalSep}>·</Text>
                            <TouchableOpacity onPress={() => Linking.openURL("https://imotara.com/terms").catch(() => {})}>
                                <Text style={styles.legalLink}>Terms of Use</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: "#1a1a2e",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === "ios" ? 40 : 28,
        paddingTop: 12,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 20,
    },
    title: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 8,
        textAlign: "center",
    },
    subtitle: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
        marginBottom: 28,
    },
    googleBtn: {
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    googleBtnText: {
        color: "#1a1a2e",
        fontWeight: "600",
        fontSize: 16,
    },
    appleBtn: {
        backgroundColor: "#000",
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    appleBtnText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    skipBtn: {
        paddingVertical: 10,
        alignItems: "center",
    },
    skipText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
    },
    legalRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
        gap: 6,
    },
    legalLink: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 12,
        textDecorationLine: "underline",
    },
    legalSep: {
        color: "rgba(255,255,255,0.2)",
        fontSize: 12,
    },
});
