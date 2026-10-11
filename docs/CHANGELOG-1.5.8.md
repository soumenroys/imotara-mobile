# Imotara 1.4.3 → 1.5.8 — Complete Change Log

**Previous store version:** 1.4.3 / build 143 (production, released 2026-09-26)
**This version:** 1.5.8 / build 158 (built 2026-10-11)
**Scope:** 81 commits in `imotara-mobile`.

⚠️ **Nothing between 1.4.3 and 1.5.8 ever reached production.** 1.4.4 / 144 went
to the Play **internal testing** track on 2 October and stopped there; 1.4.5
through 1.4.10 were built but never submitted — every iOS build from 145 to 157
used the `internal` distribution profile, and App Store Connect still shows
**1.4.3** as the live version. So for anyone on either store today, **every
change below is new**.

📄 The 1.4.3 → 1.4.6 portion is documented separately and in more depth in
[`CHANGELOG-1.4.6.md`](./CHANGELOG-1.4.6.md). This file covers the whole span,
with the emphasis on what landed after it.

🔢 **Version numbering.** From this release the version and the build number are
kept in parity: **1.5.8 ↔ 158**. 1.5.0–1.5.7 are deliberately skipped and can
never be used.

---

## 1. 🔴 Crisis support was appearing in English for almost everyone

This is the most serious defect fixed in this release, and it was live.

Imotara shows a crisis card — a helpline, and a line saying you do not have to
face this alone — when someone writes that they want to die. The card had
translations for all 22 supported languages. **Almost nobody could reach them.**

### The card spoke English to anyone who had not picked a language (`a6f167f`)
The card's language was resolved by running the stored setting through a helper
that turns `"auto"` into `"en"`. Since `"auto"` is the default, a Bengali
speaker writing *"আমি মরতে চাই"* was shown an **English** card. So was a Hindi,
Arabic, Tamil or Russian speaker. The translations existed and were unreachable.

The card now resolves its language in this order: a language you explicitly
chose, then the **script you actually wrote in**, then romanised Indic hints,
then English. ⛔ `"auto"` is not treated as a choice — that was the whole bug.

### The card missed 16 phrases, including the bare word "suicide" (`1105c54`)
Detection on the phone and on the web had drifted into two separate
implementations. The phone's covered 22 languages but missed 16 phrases the web
caught — among them simply typing **"suicide"**. Detection is now the union of
both, a superset of each by construction, with a 22-language test in each
codebase.

**Verified on a physical iPhone on 2026-10-11**, build 157, language set to
Auto, each phrase in a fresh conversation: Bengali, Hindi, romanised Bengali and
Arabic all produced a card **in that language**.

---

## 2. The companion kept answering in the wrong language

### Marathi was answered in Hindi (`9d01973`, this release)
Marathi and Hindi share the Devanagari script, so the script alone cannot
separate them — only the words can. The word-level hint existed in **three**
places and only two of them worked: the text-to-speech layer had it, the web app
had it, and the module that picks the **reply** language did not. The result was
one sentence getting two different answers — *spoken* in Marathi, *answered* in
Hindi. There is now a single shared definition.

### A Japanese speaker was answered in Chinese (`03615db`)
Chinese was tested for first, and the two share ideographs, so an ordinary
Japanese sentence — which nearly always mixes kanji with kana — was classified
as Chinese, and answered with a Chinese prompt and a Chinese voice. Kana is
unique to Japanese and is now checked first.

### Four of the app's own language buttons answered in the wrong language (`36436c0`)
Tapping a language chip did not reliably set the language the reply was written
in.

### Short Indic sentences were answered in English (`00abe45`)
A complete but short sentence did not clear the detection threshold, so it fell
through to English.

### Speaking Bengali produced an English reply (`3df6485`)
The microphone was telling the transcription service the audio was English,
whatever the person actually spoke.

---

## 3. Voice

- **The natural voice was treated as a paid feature** (`600a725`) — it is reply
  quality, not an upsell, and is restored for everyone.
- **An English voice was reading Gujarati words aloud** (`4594e8e`).
- **The first sound came out of the earpiece**, then switched to the speaker
  mid-reply (`2cb8af2`).
- **The speaker button could spin forever** when a voice call never answered
  (`4379be4`, `1b653f7`).
- **A transient failure cost the user their words**, and one slow chunk killed
  an entire reply (`f135162`).
- **The voice quota counted chunks, not replies** (`3296f5d`) — "15" meant three
  to five spoken replies before; it means fifteen now.

---

## 4. Hands-free

- The loop could **stop dead after a reply** (`d2746a5`).
- A device that never reports audio levels left the person **talking into a
  void** (`4a6b6be`).
- The turn deadline repeated a mistake the upload gate had already made
  (`b8aad7b`).

---

## 5. 🔴 The app said you were offline when you were not

Two separate defects, a month apart.

### The connection check itself was wrong (`51637ed`, `8d44875`)
`navigator.onLine` does not exist in React Native, so the test was always true —
and a separate connectivity probe, when it timed out, silently downgraded every
reply. People on full wifi were told they had no internet while replies were
arriving.

### The label was wrong (`9d01973`, this release)
Even after the above, every on-device reply was labelled **"(offline)"**,
because the label was derived from *"this reply came from the on-device engine"*
rather than from any knowledge of the connection. Caught on a real iPhone on
2026-10-11 with **both wifi and mobile data on**: a single cold-start failure
produced "Imotara (offline)". The server answered the identical message in 2.4
seconds when tested directly at that moment.

It was also wrong in a quieter way — the **greeting** and the content-guard
reply never go to the network by design, and were also labelled "(offline)",
which is both false and faintly alarming in an app about how you are feeling.

The reason a reply came from the device is now recorded when the reply is
created, and only genuine loss of connection is called "offline".

---

## 6. Arabic, Hebrew and Urdu now lay out right-to-left

Verified on a physical iPhone on 2026-10-11: the Arabic crisis card rendered its
**text** correctly but inside a **left-to-right container** — the heading hugged
the left edge, the dismiss control sat on the right, and each helpline's name and
number were the wrong way round.

Direction is now applied to the card itself, from the language the card is
speaking, so it is correct immediately rather than after the next app launch.

---

## 7. Everything else

- Replies were being **generated twice** on every message (`0ff56cb`).
- **Psychological Insight was completely dead** on mobile, silently (`7373389`).
- Placeholder text was accepted as a real reply (`0cc69cc`).
- Three silent fallbacks in transliteration, and a header that misreported what
  had happened (`edcc076`).
- Half the app's diagnostic logs never reached the log file (`92597b0`).
- You can now see **which account you are signed in as**, and the app explains
  when the natural voice has been rationed rather than degrading in silence
  (`30d10ce`).

---

# Store copy

## Google Play — "What's new" (≤500 characters)

```
Crisis support now appears in your own language. It was showing in English for
most people — Bengali, Hindi, Arabic, Tamil and 18 more are now read correctly.

Also fixed: Marathi is answered in Marathi, not Hindi. Japanese is no longer
mistaken for Chinese. Arabic, Hebrew and Urdu read right to left. The app no
longer says you are offline when you are not. The natural voice is back for
everyone, and voice replies no longer cut out mid-sentence.
```

## App Store — "What's New in This Version"

```
This release fixes a serious problem with how Imotara responds in your language.

CRISIS SUPPORT IN YOUR OWN LANGUAGE
If you write that you want to die, Imotara shows a helpline and a reminder that
you do not have to face this alone. That card had translations for all 22
languages, but almost everyone was shown it in English. It now appears in the
language you are actually writing in — including when you write your language in
English letters.

THE RIGHT LANGUAGE, MORE OFTEN
- Marathi is answered in Marathi, not Hindi
- Japanese is no longer mistaken for Chinese
- Short sentences in Indian languages are no longer answered in English
- Speaking Bengali no longer produces an English reply
- Arabic, Hebrew and Urdu now read right to left

VOICE
- The natural voice is available to everyone again
- Replies no longer cut off mid-sentence, and the speaker button no longer
  hangs
- Sound no longer starts in the earpiece and jumps to the speaker
- Gujarati is no longer read aloud in an English voice

CONNECTION
Imotara no longer tells you that you are offline when you are not, and when a
reply is written on your device it says so honestly instead of blaming your
connection.

Plus many smaller fixes to reliability and clarity.
```

---

## Verification

| | |
|---|---|
| Mobile test suite | **1633 tests, all passing** |
| Web test suite | **2155 tests, all passing** |
| New tests in this release | 3 files, 45 cases |
| Mutation testing | **3/3 caught** against green controls |
| Device check | iPhone 14 Pro, build 157, 4/4 crisis cards in the right language |

⚠️ **Open at time of writing:** the right-to-left layout fix had not yet been
confirmed visually on a device — the tests prove the decision is made and that
the card reads it, but they cannot see pixels.
