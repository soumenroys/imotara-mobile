// src/__tests__/isSadText.test.ts
// UX-04. On-device sadness detection was written out by hand in four places in
// ChatScreen and every copy was different. Hindi — the largest non-English
// language in the product — was in none of them, so a Hindi speaker writing
// plainly that they felt low got nothing back from the offline path, while
// HI_SAD_REGEX sat defined and exported the whole time.

import {
  isSadText,
  HI_SAD_REGEX, BN_SAD_REGEX, TA_SAD_REGEX, GU_SAD_REGEX, KN_SAD_REGEX,
  ML_SAD_REGEX, PA_SAD_REGEX, OR_SAD_REGEX, MR_SAD_REGEX,
} from "../lib/emotion/keywordMaps";

// Drawn from each language's own regex so the test cannot drift from the source.
function sampleFor(re: RegExp): string {
  const src = re.source;
  const first = src.replace(/^[^(]*\(\??:?/, "").split("|")[0].replace(/[)^$\\]/g, "");
  return first;
}

describe("Hindi — the language this bug was about", () => {
  it("detects Hindi sadness", () => {
    // The exact failure: recognised by the regex, ignored by every caller.
    expect(HI_SAD_REGEX.test(sampleFor(HI_SAD_REGEX))).toBe(true);
    expect(isSadText(sampleFor(HI_SAD_REGEX))).toBe(true);
  });

  it("detects it inside a longer sentence, not just alone", () => {
    expect(isSadText(`आज ${sampleFor(HI_SAD_REGEX)} बहुत`)).toBe(true);
  });

  it("was genuinely uncovered before — no other language's pattern catches it", () => {
    // Without this the fix could be a no-op: if some other Indic regex already
    // matched Hindi text, adding HI would change nothing and the reported bug
    // would not have been real. It was.
    const hindi = sampleFor(HI_SAD_REGEX);
    const others = [BN_SAD_REGEX, TA_SAD_REGEX, GU_SAD_REGEX, KN_SAD_REGEX,
                    ML_SAD_REGEX, PA_SAD_REGEX, OR_SAD_REGEX, MR_SAD_REGEX];
    expect(others.some((re) => re.test(hindi))).toBe(false);
    expect(/\b(sad|down|lonely|tired|upset|hurt|empty|depressed|blue|cry|crying|hopeless)\b/
      .test(hindi.toLowerCase())).toBe(false);
  });
});

describe("every Indic language the app detects on-device", () => {
  const cases: [string, RegExp][] = [
    ["hi", HI_SAD_REGEX], ["bn", BN_SAD_REGEX], ["ta", TA_SAD_REGEX],
    ["gu", GU_SAD_REGEX], ["kn", KN_SAD_REGEX], ["ml", ML_SAD_REGEX],
    ["pa", PA_SAD_REGEX], ["or", OR_SAD_REGEX], ["mr", MR_SAD_REGEX],
  ];
  for (const [lang, re] of cases) {
    it(`${lang} sadness reaches isSadText`, () => {
      expect(isSadText(sampleFor(re))).toBe(true);
    });
  }
});

describe("English still works", () => {
  for (const s of ["I feel so sad today", "feeling really lonely", "I'm depressed", "just empty"]) {
    it(`"${s}"`, () => expect(isSadText(s)).toBe(true));
  }

  it("is case-insensitive", () => {
    expect(isSadText("I AM SO SAD")).toBe(true);
  });

  it("matches whole words only", () => {
    // "sadhana" and "download" contain sad/down but are not sadness.
    expect(isSadText("I practise sadhana every morning")).toBe(false);
    expect(isSadText("the download finished")).toBe(false);
  });
});

describe("what must NOT be read as sadness", () => {
  for (const s of ["", "I am so happy today", "what time is the meeting", "मैं बहुत खुश हूँ"]) {
    it(JSON.stringify(s), () => expect(isSadText(s)).toBe(false));
  }

  it("handles junk input without throwing", () => {
    expect(isSadText("😀😀😀")).toBe(false);
    expect(isSadText("   ")).toBe(false);
  });
});
