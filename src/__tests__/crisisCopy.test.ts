// src/__tests__/crisisCopy.test.ts
// The crisis card is the highest-stakes text in the product: it is what a
// person sees at the moment reading is hardest. These tests exist because a
// missing or empty string here fails silently and looks fine in review.

import { getCrisisCopy, CRISIS_COPY_LANGS } from "../lib/safety/crisisCopy";

// The 22 languages the app actually offers in Settings.
const SHIPPED = [
  "en", "bn", "gu", "hi", "kn", "ml", "mr", "or", "pa", "ta", "te", "ur",
  "ar", "zh", "fr", "de", "he", "id", "ja", "pt", "ru", "es",
];

describe("crisis copy covers what the app ships", () => {
  it("has copy for every language in the picker", () => {
    const missing = SHIPPED.filter((l) => !CRISIS_COPY_LANGS.includes(l));
    expect(missing).toEqual([]);
  });

  it("has no language the picker does not offer", () => {
    // A stray entry means a translation nobody can ever see.
    expect(CRISIS_COPY_LANGS.filter((l) => !SHIPPED.includes(l))).toEqual([]);
  });
});

describe("every string is real", () => {
  for (const lang of SHIPPED) {
    it(`${lang} has four non-empty strings`, () => {
      const c = getCrisisCopy(lang);
      for (const key of ["t1Title", "t1Body", "t2Title", "t2Footer"] as const) {
        expect(typeof c[key]).toBe("string");
        expect(c[key].trim().length).toBeGreaterThan(0);
      }
    });

    if (lang !== "en") {
      it(`${lang} is not silently English`, () => {
        // The failure this catches is a copy-paste that leaves English behind
        // in a language that looks handled.
        const c = getCrisisCopy(lang);
        const en = getCrisisCopy("en");
        expect(c.t1Body).not.toBe(en.t1Body);
        expect(c.t2Footer).not.toBe(en.t2Footer);
      });
    }
  }
});

describe("falling back", () => {
  it("gives English for a language we do not have", () => {
    // Help in a language you may not read still beats a blank card.
    expect(getCrisisCopy("xx")).toEqual(getCrisisCopy("en"));
  });

  it("gives English for nothing at all", () => {
    expect(getCrisisCopy(undefined)).toEqual(getCrisisCopy("en"));
    expect(getCrisisCopy(null)).toEqual(getCrisisCopy("en"));
    expect(getCrisisCopy("")).toEqual(getCrisisCopy("en"));
  });

  it("handles a region tag, not just a bare code", () => {
    // A device locale is "pt-BR", not "pt". Falling back to English there
    // would be a near-miss producing the exact failure this task fixes.
    expect(getCrisisCopy("pt-BR")).toEqual(getCrisisCopy("pt"));
    expect(getCrisisCopy("zh-Hans")).toEqual(getCrisisCopy("zh"));
    expect(getCrisisCopy("HI")).toEqual(getCrisisCopy("hi"));
    expect(getCrisisCopy("es_MX")).toEqual(getCrisisCopy("es"));
  });
});

describe("the scripts are what they claim to be", () => {
  // Guards against a translation landing in the wrong row.
  const SCRIPT: Record<string, RegExp> = {
    hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, bn: /[ঀ-৿]/,
    gu: /[઀-૿]/, pa: /[਀-੿]/, or: /[଀-୿]/,
    ta: /[஀-௿]/, te: /[ఀ-౿]/, kn: /[ಀ-೿]/,
    ml: /[ഀ-ൿ]/, ur: /[؀-ۿ]/, ar: /[؀-ۿ]/,
    he: /[֐-׿]/, ru: /[Ѐ-ӿ]/, zh: /[一-鿿]/,
    ja: /[぀-ヿ一-鿿]/,
  };
  for (const [lang, re] of Object.entries(SCRIPT)) {
    it(`${lang} is written in its own script`, () => {
      const c = getCrisisCopy(lang);
      expect(re.test(c.t1Title)).toBe(true);
      expect(re.test(c.t1Body)).toBe(true);
      expect(re.test(c.t2Title)).toBe(true);
      expect(re.test(c.t2Footer)).toBe(true);
    });
  }
});
