import fs from "fs";
import path from "path";

const withAndroidImeInsets = require("../../plugins/withAndroidImeInsets");

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

// A minimal stand-in for the Expo template's MainActivity.kt. The plugin only
// needs the import line and the super.onCreate call to anchor on.
const FIXTURE_KT = `package com.imotara.imotara

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }
}
`;

/**
 * The plugin exports its transform separately precisely so it can be tested
 * without standing up Expo's async mod pipeline (withMainActivity wraps the
 * action in an async interceptor that needs a full mod request).
 */
function applyPlugin(contents: string, language: "kt" | "java" = "kt"): string {
    return withAndroidImeInsets.transformMainActivity(contents, language);
}

it("the plugin is a real config plugin, not just a transform", () => {
    expect(typeof withAndroidImeInsets).toBe("function");
    expect(typeof withAndroidImeInsets.transformMainActivity).toBe("function");
});

describe("Android IME inset fix — the plugin", () => {
    it("is registered in app.json, after prebuild would otherwise skip it", () => {
        const app = JSON.parse(read("app.json"));
        expect(app.expo.plugins).toContain("./plugins/withAndroidImeInsets");
    });

    it("still requires edge-to-edge, which is the reason the fix exists", () => {
        // If edge-to-edge is ever turned off, adjustResize resizes on its own
        // and this plugin would double-subtract. Fail loudly so whoever flips
        // it reads plugins/withAndroidImeInsets.js first.
        const app = JSON.parse(read("app.json"));
        expect(app.expo.android.edgeToEdgeEnabled).toBe(true);
        expect(app.expo.android.softwareKeyboardLayoutMode).toBe("resize");
    });

    it("injects a listener driven by the real ime() inset", () => {
        const out = applyPlugin(FIXTURE_KT);
        expect(out).toContain("setOnApplyWindowInsetsListener");
        // The whole point: padding comes from the OS inset, not a derived or
        // per-device number.
        expect(out).toContain("WindowInsetsCompat.Type.ime()");
    });

    it("pads by the FULL ime inset and does not subtract the navigation bar", () => {
        // Measured on 2026-09-12: subtracting the nav bar put the composer
        // 48px BEHIND the keyboard — exactly one nav-bar height too low —
        // because tabBarHideOnKeyboard removes the tab bar (the thing that
        // was providing bottom padding) as soon as the keyboard opens.
        const out = applyPlugin(FIXTURE_KT);
        expect(out).not.toContain("navigationBars()");
        expect(out).toMatch(
            /val keyboardOverlap = insets\.getInsets\(WindowInsetsCompat\.Type\.ime\(\)\)\.bottom/
        );
    });

    it("adds the imports the injected Kotlin needs, or it would not compile", () => {
        const out = applyPlugin(FIXTURE_KT);
        for (const imp of [
            "import android.view.View",
            "import androidx.core.view.ViewCompat",
            "import androidx.core.view.WindowInsetsCompat",
        ]) {
            expect(out).toContain(imp);
        }
    });

    it("injects INSIDE onCreate, after super.onCreate", () => {
        const out = applyPlugin(FIXTURE_KT);
        const superIdx = out.indexOf("super.onCreate(null)");
        const listenerIdx = out.indexOf("setOnApplyWindowInsetsListener");
        expect(superIdx).toBeGreaterThan(-1);
        expect(listenerIdx).toBeGreaterThan(superIdx);
        // ...and before onCreate's closing brace, i.e. before the next member.
        const nextMember = out.indexOf("override fun getMainComponentName");
        if (nextMember > -1) expect(listenerIdx).toBeLessThan(nextMember);
    });

    it("returns the insets unconsumed so RN's own keyboard events still fire", () => {
        const out = applyPlugin(FIXTURE_KT);
        // The lambda must end by handing the insets back, not returning CONSUMED.
        expect(out).not.toContain("WindowInsetsCompat.CONSUMED");
    });

    it("is idempotent — a second prebuild must not inject twice", () => {
        const once = applyPlugin(FIXTURE_KT);
        const twice = applyPlugin(once);
        expect(twice).toBe(once);
        const occurrences = twice.split("setOnApplyWindowInsetsListener").length - 1;
        expect(occurrences).toBe(1);
    });

    it("REPLACES a stale injection instead of keeping it", () => {
        // This bit for real on 2026-09-12: the first version just bailed when
        // the marker was present, so a corrected inset formula was skipped on
        // the incremental prebuild and the WRONG Kotlin went into the APK.
        // An edit to the injected code must actually reach the build.
        const canonical = applyPlugin(FIXTURE_KT);
        const stale = canonical.replace(
            "WindowInsetsCompat.Type.ime()).bottom",
            "WindowInsetsCompat.Type.ime()).bottom /* STALE FORMULA */"
        );
        expect(stale).not.toBe(canonical); // the mutation really applied
        const refreshed = applyPlugin(stale);
        expect(refreshed).not.toContain("STALE FORMULA");
        expect(refreshed).toBe(canonical);
    });

    it("THROWS if an old injection has no end marker, rather than guessing", () => {
        const canonical = applyPlugin(FIXTURE_KT);
        const truncated = canonical.replace("// IMOTARA_IME_INSETS_END", "");
        expect(() => applyPlugin(truncated)).toThrow(/end marker/);
    });

    it("THROWS if the Expo template drops super.onCreate, rather than silently not applying", () => {
        // This is the dangerous failure mode: JS has already stopped avoiding
        // the keyboard, so a silent no-op would put the composer back under it
        // on every Android device.
        const broken = FIXTURE_KT.replace("super.onCreate(null)", "super.onCreate(savedInstanceState)");
        expect(() => applyPlugin(broken)).toThrow(/super\.onCreate\(null\)/);
    });

    it("THROWS on a Java MainActivity instead of emitting broken Kotlin", () => {
        expect(() => applyPlugin(FIXTURE_KT, "java")).toThrow(/Kotlin/);
    });
});

describe("Android IME inset fix — no double subtraction", () => {
    // With the window itself shrinking, any KeyboardAvoidingView that also
    // applies "height" on Android subtracts the keyboard a second time. That
    // is exactly the 771px dead-gap bug measured on the Galaxy A27.
    //
    // Screens render in the Activity window, so the plugin covers them.
    const SCREENS_COVERED_BY_THE_PLUGIN = [
        "src/screens/ChatScreen.tsx",
        "src/screens/SettingsScreen.tsx",
        "src/screens/connect/ConnectScreen.tsx",
    ];

    it.each(SCREENS_COVERED_BY_THE_PLUGIN)(
        "%s never gives Android a KeyboardAvoidingView behavior",
        (file) => {
            const src = read(file);
            // Find every `behavior={...}` and assert the Android branch is undefined.
            const behaviors = src.match(/behavior=\{[^}]*\}/g) ?? [];
            expect(behaviors.length).toBeGreaterThan(0);
            for (const b of behaviors) {
                // Modal-hosted views are the documented exception, handled below.
                if (b.includes('"height"')) {
                    expect(insideModal(src, src.indexOf(b))).toBe(true);
                }
            }
        }
    );

    it("ChatScreen's composer, the reported bug, has no Android behavior", () => {
        const src = read("src/screens/ChatScreen.tsx");
        expect(src).toMatch(
            /behavior=\{Platform\.OS === "ios" \? "padding" : undefined\}/
        );
        expect(src).not.toMatch(
            /behavior=\{Platform\.OS === "ios" \? "padding" : "height"\}/
        );
    });

    it("SettingsScreen has no Android behavior either", () => {
        const src = read("src/screens/SettingsScreen.tsx");
        const m = src.match(/behavior=\{Platform\.OS === "ios" \? "padding" : ([^}]*)\}/);
        expect(m).not.toBeNull();
        expect(m![1].trim()).toBe("undefined");
    });
});

describe("Android IME inset fix — modals keep their own avoidance", () => {
    // React Native <Modal> renders in its OWN window. The Activity-level
    // listener never sees it, so removing these would break modal inputs.
    const MODAL_HOSTED = [
        "src/components/imotara/UnsentLetterModal.tsx",
        "src/components/imotara/OnboardingModal.tsx",
    ];

    it.each(MODAL_HOSTED)("%s still has a KeyboardAvoidingView", (file) => {
        const src = read(file);
        expect(src).toContain("KeyboardAvoidingView");
        expect(src).toContain("<Modal");
    });

    it("the Connect scheduling modal keeps its Android height behavior", () => {
        const src = read("src/screens/connect/ConnectScreen.tsx");
        const idx = src.indexOf('behavior={Platform.OS === "ios" ? "padding" : "height"}');
        expect(idx).toBeGreaterThan(-1);
        expect(insideModal(src, idx)).toBe(true);
    });
});

/** True if the offset sits between a <Modal and its matching </Modal>. */
function insideModal(src: string, offset: number): boolean {
    const before = src.slice(0, offset);
    const opens = (before.match(/<Modal[\s>]/g) ?? []).length;
    const closes = (before.match(/<\/Modal>/g) ?? []).length;
    return opens > closes;
}
