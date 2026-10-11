// src/lib/lang/devanagariHint.ts
//
// Telling Marathi from Hindi. They share the Devanagari script, so the script
// range alone cannot separate them — only the words can.
//
// 🔴 WHY THIS FILE EXISTS. This pattern was living in THREE places and only two
// of them worked:
//
//   1. imotara-mobile  src/lib/tts/mobileTTS.ts  — used it, picked the right VOICE
//   2. imotaraapp      src/app/chat/page.tsx     — used it, picked the right REPLY
//   3. imotara-mobile  src/api/aiClient.ts       — DID NOT HAVE IT
//
// So on a phone, Marathi typed in Devanagari was *spoken* in a Marathi voice
// while being *answered in Hindi*, because `detectLangFromScript` returned "hi"
// for every Devanagari string. The same sentence, two different answers, one
// app. On the web it was right.
//
// ⚠️ The web copy carries the comment "the mobile app already had this right".
// That was true of the RANGE and false of the HINT — the kind of claim that
// survives precisely because nobody opens the other file. Hence one export.
//
// ⛔ Do not inline this regex again. If it needs to change, it needs to change
// for the voice AND the reply at the same time, or they drift apart again.

/**
 * Words that appear in ordinary Marathi and not in ordinary Hindi.
 *
 * ⚠️ `मी ` keeps its TRAILING SPACE on purpose — without it the pattern fires on
 * Hindi words that merely begin with मी. Do not "tidy" it away.
 *
 * Kept byte-identical to the two copies it replaces, so this is a move and not
 * a behaviour change.
 */
export const MARATHI_HINT =
    /आहे|नाही|माझ[ेा]|तुझ[ेा]|होत[ेी]|मी |तुम्ही/;

/** Devanagari LETTERS — deliberately excludes the danda (U+0964) and digits. */
export const DEVANAGARI_LETTERS = /[ऄ-हक़-ॣॱ-ॿ]/;

/**
 * "hi" or "mr" for a Devanagari string. Callers decide what to do when the text
 * is not Devanagari at all — this answers only the question it is asked.
 */
export function devanagariLang(text: string): "hi" | "mr" {
    return MARATHI_HINT.test(text) ? "mr" : "hi";
}
