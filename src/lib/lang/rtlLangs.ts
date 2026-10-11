// src/lib/lang/rtlLangs.ts
//
// Which of the product's languages are written right-to-left.
//
// 🔑 DELIBERATELY FREE OF NATIVE IMPORTS. This started inside lib/rtl.ts, which
// imports AsyncStorage and I18nManager — so the moment a test tried to ask the
// simple question "is Arabic RTL?", it had to boot React Native's storage
// layer and failed. A pure predicate about language belongs nowhere near
// device storage.
//
// ⛔ Do not add imports to this file.

/**
 * The three RTL languages Imotara ships — each with its own prompts, TTS voice
 * and crisis copy.
 *
 * ⚠️ A fourth RTL language added to the product must be added HERE, or its
 * crisis card will render left-to-right while its text reads right-to-left.
 */
export const RTL_LANGS: ReadonlySet<string> = new Set(["ar", "he", "ur"]);

/**
 * Is this language written right-to-left?
 *
 * 🔑 USE THIS FOR PER-COMPONENT DIRECTION, not I18nManager. Verified on a real
 * iPhone 2026-10-11: an Arabic crisis card rendered its TEXT correctly (the 💛
 * moved to the right of the string, so bidi works) inside an LTR CONTAINER —
 * header left-aligned, dismiss "x" on the right, helpline label and number the
 * wrong way round.
 *
 * ⛔ I18nManager could not have fixed that card. It keys off the STORED
 * setting, the person was on "auto", and RN only applies direction at the NEXT
 * cold start. A card that must answer the message just typed cannot wait for a
 * relaunch.
 *
 * ⇒ Style the component from this instead: `flexDirection: "row-reverse"`,
 * `textAlign: "right"`, `writingDirection: "rtl"`. Those take effect in the
 * current session and are scoped to what is being rendered.
 *
 * Accepts "ar", "ar-EG", "he_IL", "UR" — anything with a language subtag.
 */
export function isRtlLang(lang: string | null | undefined): boolean {
    if (!lang) return false;
    return RTL_LANGS.has(String(lang).trim().toLowerCase().split(/[-_]/)[0]);
}
