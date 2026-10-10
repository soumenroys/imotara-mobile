/**
 * 🔴 "I spoke in Bengali ... that is translated into english."
 *    — reported 2026-10-10, physical iPhone, build 1.4.10/150.
 *
 * Whisper was not mis-detecting anything. It had been TOLD the audio was
 * English: ChatScreen derived the transcription language with
 * `concreteLang(preferredLang)`, which maps "auto" — and an unset preference —
 * to "en", and /api/voice/transcribe forwards any recognised code straight
 * through as `language=en`.
 *
 * ⚠️ The same trap, at a second call site. The chat-reply payload carries a
 * 🔴 comment explaining that concreteLang "turns auto into en"; the voice path
 * was never given the same treatment. Fixing one call site and leaving its
 * twin is the recurrence mechanism recorded in
 * trap_blunt_fix_trades_one_failure_for_its_opposite.
 */

import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { transcriptionLangHint, concreteLang } from "../api/aiClient";

const BN = ["আমি ভালো নেই", "কেমন আছো"];
const GU = ["મને સારું નથી લાગતું"];
const EN = ["i feel low today", "not great honestly"];

describe("🔴 a stated preference always wins — it is a choice", () => {
  it("an explicit language is passed through untouched", () => {
    // ⛔ The regression guard for this fix: someone who CHOSE Bengali must
    // keep getting bn, whatever the conversation looks like.
    expect(transcriptionLangHint("bn", EN)).toBe("bn");
    expect(transcriptionLangHint("gu", [])).toBe("gu");
    expect(transcriptionLangHint("en", BN)).toBe("en");
  });

  it("…including for every one of the 22 supported languages", () => {
    const LANGS = "en hi bn mr ta te gu pa kn ml or ur ar he ru zh ja es fr de pt id".split(" ");
    for (const l of LANGS) expect(transcriptionLangHint(l, [])).toBe(l);
  });
});

describe("🔑 no stated preference ⇒ the conversation is the evidence", () => {
  it("a Bengali-script conversation ⇒ bn, not en", () => {
    // The reported bug, in one assertion.
    expect(transcriptionLangHint("auto", BN)).toBe("bn");
    expect(transcriptionLangHint(undefined, BN)).toBe("bn");
    expect(transcriptionLangHint(null, BN)).toBe("bn");
    expect(transcriptionLangHint("", BN)).toBe("bn");
  });

  it("the MOST RECENT language wins when the conversation switched", () => {
    expect(transcriptionLangHint("auto", [...BN, ...GU])).toBe("gu");
    expect(transcriptionLangHint("auto", [...GU, ...BN])).toBe("bn");
  });

  it("⛔ an English-looking conversation yields 'auto', NEVER 'en'", () => {
    // This is the whole bug. Latin-script history is the ABSENCE of evidence
    // about what will be spoken next, not evidence of English — and "en"
    // would pin Whisper and reproduce the original failure exactly.
    expect(transcriptionLangHint("auto", EN)).toBe("auto");
    expect(transcriptionLangHint(undefined, [])).toBe("auto");
  });

  it("romanized Indic stays on 'auto' — it must not force native script", () => {
    // Deliberate: resolving "ami valo nei" to bn would make Whisper return
    // Bengali script and silently switch the script the person types in.
    expect(transcriptionLangHint("auto", ["ami valo nei", "tumi kemon acho"])).toBe("auto");
  });

  it("empty and whitespace turns are skipped, not treated as English", () => {
    expect(transcriptionLangHint("auto", ["", "   ", ...BN])).toBe("bn");
    expect(transcriptionLangHint("auto", ["", "  "])).toBe("auto");
  });
});

describe("⚠️ the contract this fix depends on", () => {
  it("concreteLang really does turn auto/unset into 'en'", () => {
    // Pinned because the fix is "do not use concreteLang HERE" — if this ever
    // stopped being true, the reasoning above would need revisiting.
    expect(concreteLang("auto")).toBe("en");
    expect(concreteLang(undefined)).toBe("en");
    expect(concreteLang("bn")).toBe("bn");
  });

  it("⛔ 'auto' cannot collide with a real language code", () => {
    // Why "auto" is safe to send: the route omits `language` for any code it
    // does not recognise and lets Whisper auto-detect.
    //
    // ⚠️ Deliberately NOT a copy of the route's code list. Whisper takes
    // ISO-639-1, which is two letters by definition, so a four-letter token
    // can never be in it — that holds without this test knowing the list.
    // The route's actual behaviour is pinned in the web repo, next to the
    // code: src/__tests__/transcribeLangPassthrough.test.ts.
    expect("auto".length).not.toBe(2);
    expect(transcriptionLangHint(undefined, [])).toBe("auto");
  });

  it("⛔ ChatScreen must not go back to concreteLang for the voice language", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/ChatScreen.tsx"), "utf8");
    expect(src).toMatch(/const lang = transcriptionLangHint\(/);
    // The voice-language effect specifically — concreteLang is still correct
    // elsewhere (TTS voices, locales), so this is not a file-wide ban.
    const i = src.indexOf("voiceLangRef.current = lang;");
    expect(i).toBeGreaterThan(-1);
    const effect = src.slice(src.lastIndexOf("React.useEffect", i), i);
    expect(effect).not.toMatch(/concreteLang/);
  });

  it("the default before any profile loads is 'auto', not 'en'", () => {
    // The second half of the bug: this value is only corrected once
    // toneContext resolves, so a mic press before then sent "en".
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/ChatScreen.tsx"), "utf8");
    expect(src).toMatch(/const voiceLangRef = React\.useRef\("auto"\)/);
    expect(src).toMatch(/useState\("auto"\)/);
  });
});
