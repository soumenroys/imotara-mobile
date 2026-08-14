// src/lib/rtl.ts
// P2-12 (code_review_audit_2026_08_14 finding E1): zero I18nManager usage
// anywhere in this app — Arabic, Hebrew, and Urdu are fully shipped
// languages (dedicated prompt engineering, romanization rules, TTS voices,
// test scenarios) but were always rendered left-to-right.
//
// IMPORTANT PLATFORM CONSTRAINT: I18nManager.forceRTL() does NOT take visual
// effect in the current session — React Native bakes LTR/RTL into the native
// layout engine at launch. Calling forceRTL() here only updates a persisted
// native flag that takes effect starting the NEXT full app launch (a
// documented React Native/Expo limitation, not a bug in this code). This is
// why the check below runs fire-and-forget at startup rather than blocking
// app registration on it — there's nothing to gain from blocking, since
// nothing visually changes until the following cold start regardless.
//
// NOT YET DONE (deliberately, out of caution): a "please restart the app"
// prompt when the user changes language mid-session. That interaction is
// genuinely easy to get wrong (RN's reload-after-RTL-change is a known
// tricky area) and this session has no simulator/device access to verify it
// visually — left as a follow-up for whoever can test on a real device.

import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_STORAGE_KEY = "imotara_settings_v1";
const RTL_LANGS = new Set(["ar", "he", "ur"]);

export async function syncI18nManagerFromStoredSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // The persisted shape is { toneContext: { user: { preferredLang } }, ... }
    // (see src/state/SettingsContext.tsx's `payload` object) — every other
    // call site in the app (ChatScreen, SettingsScreen, TrendsScreen,
    // CompanionQuickPanel) reads it via toneContext.user.preferredLang.
    // A prior version of this file read parsed.user.preferredLang directly,
    // which is always undefined against the real payload shape — RTL never
    // activated, and on a device whose OS locale is already ar/he/ur (where
    // I18nManager.isRTL defaults to true natively) this would have detected
    // a false mismatch and force-disabled RTL, actively breaking correct
    // native rendering. Fixed 2026-08-14 before first release of this file.
    const lang: string | undefined = parsed?.toneContext?.user?.preferredLang;
    const shouldBeRtl = !!lang && RTL_LANGS.has(lang);

    if (I18nManager.isRTL !== shouldBeRtl) {
      I18nManager.allowRTL(shouldBeRtl);
      I18nManager.forceRTL(shouldBeRtl);
      // Effect applies on the NEXT app launch — see module comment above.
    }
  } catch {
    // Fail silently — RTL sync is a progressive enhancement, never a startup blocker.
  }
}
