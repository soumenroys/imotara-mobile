# Imotara 1.3.2 → 1.4.0 — Complete Change Log

**Previous store version:** 1.3.2 / build 132 (released 2026-08-17)
**This version:** 1.4.0 / build 140 (submitted 2026-09-13)
**Scope:** 59 commits in `imotara-mobile`, 48 commits in `imotaraapp` (web/API).
Intermediate versions 1.3.3, 1.3.4, 1.3.5 and 1.3.6 were built but never
shipped to a store — every change below is new to users.

---

## 1. Theme & appearance — the largest visible change

### Follow the phone's appearance (UX-19 mobile / UX-20 web)
The theme was a binary toggle that defaulted to dark and never asked the phone
what it preferred. Someone on a light-mode device installed Imotara and got a
dark app with no explanation.

- Settings now offers **System / Light / Dark**, defaulting to System.
- The app follows the device **live**, not only at launch.
- Web applies the saved theme **before first paint**, so there is no flash.

### A real light-mode palette (UX-44 + follow-up)
Roughly **105 text colours across ten screens** were bare hex literals, every
one chosen for a dark background and none with a light counterpart. Measured
against the light background they sat between **1.19:1 and 2.85:1** where WCAG
AA requires 4.5:1 — pale amber status text, pale green prices, pale violet role
labels, pale red errors.

A follow-up caught twelve more literals the first sweep walked past, because
they were `<Ionicons color="#..." />` JSX props rather than style-object keys.
Ten now use semantic palette colours; the two left are white on the Apple
sign-in button, where Apple mandates it.

Also fixed in light mode specifically:
- The **crisis card** was unreadable.
- **Toasts** were unreadable.
- The chat **search bar** hardcoded `rgba(24, 15, 30, 0.7)` — a dark strip on a
  light screen. Reported by an intern on a Poco M6 Pro: "the search icon is
  visible, but the 'Search messages…' text is very faint."

### Native dialogs follow the app, not the OS
Pick Dark while the phone is on Light and the app went dark, but `Alert.alert`
threw a stark white dialog over it — and the mirror case was as bad. Native
surfaces (alerts, keyboard, pickers) ask the OS, not the React theme.
`Appearance.setColorScheme` now sets the app-level override natively
(iOS `overrideUserInterfaceStyle`, Android `AppCompatDelegate`). Reproduced and
verified on both iPhone 17 Pro and Pixel.

---

## 2. Accessibility

| Item | What changed |
|---|---|
| **Reduce Motion (UX-27)** | Mobile had *zero* uses of `AccessibilityInfo` — the OS setting existed and the app never asked. `ThemeProvider` now reads it and stays in step, so toggling it takes effect without a relaunch. Web has respected `prefers-reduced-motion` since day one. |
| **Icon-only buttons (UX-14/15/16)** | A review counted 747 `TouchableOpacity` against 23 `accessibilityLabel` and read it as ~724 unlabelled controls. It was actually **33** — a touchable containing `<Text>` already takes its name from that text. The 33 genuinely icon-only controls (back arrows, close buttons, etc.) now announce properly. |
| **Chat-bubble contrast** | Bubbles are barely opaque (user bubble = sky at 35%, bot bubbles = mood tint at 12–26%), so text inside is read against whatever is behind. The timestamp measured **2.68:1**: `textSecondary` already carries alpha 0.9, and a further 0.85–0.9 opacity was applied on top. |
| **Large text sizes (UX-28)** | At the largest accessibility size a companion card read "Full Test CompanionFree" — name and price with no gap. Deliberately **not** fixed with `maxFontSizeMultiplier`, which would refuse the person the text size they asked the OS for; the layout was fixed instead. |
| **RTL (web, UX-36/37)** | Layout now mirrors for Arabic, Hebrew and Urdu. |
| **Dialogs (web, UX-09)** | Nine overlays converted to real accessible dialogs on a shared wrapper; form controls behind sign-in were named (UX-12/13/39). |

---

## 3. Voice — input

### Hands-free that actually starts (new)
Hands-free already did most of the loop — auto-stop on silence, auto-send, read
the reply aloud, reopen the mic. **What it never did was start.** Every
conversation began with a manual mic tap, making the shipped copy
("Automatically start voice input") untrue. It now starts on entering Chat and
resumes on returning to the app, and shows clearly while listening.

### Auto-send voice notes (new setting)
"Send voice notes automatically", in Settings → Experience → Voice input.
**Off by default** — auto-send removes the one chance to catch a
mis-transcription, so nobody gets it without asking. Silence-stop stays
hands-free-only, so a manual recording never cuts someone off mid-thought.

### Transcription no longer vanishes
Auto-send called `handleSend` directly and never touched the composer.
`handleSend` has early returns that fire *before* it clears the input — message
over `CHAR_LIMIT`, or `isTyping || isSendingRef.current` (the previous reply
still arriving, the common case). On that path the transcription went
**nowhere at all**: not sent, not in the box. The person spoke and the app
silently dropped it. Words now go into the composer first, then get sent — and
it sends what the composer holds, so a half-typed draft is no longer discarded.

### "Online transcription" was recording you and throwing it away
The toggle reads like a choice between server-side and on-device transcription.
There is no on-device option — `expo-speech` is text-to-*speech* and nothing in
the project does the reverse. Switching it off opened the microphone, recorded,
**discarded the audio, and said nothing.** The code even documented the
assumption: "the user knows cloud STT is off." They were never told.

### Whisper's inventions no longer reach the message box
Whisper invents sentences from silence and hands them back as if spoken. Three
layers of guard now sit on the transcribe route: boilerplate rejection, sound-
event annotation rejection (`[music]`, `[silence]` and friends), and bare
function-word rejection — the last found in production.

### Stopping a recording ≠ stopping it being sent
Hands-free kept recording after leaving Chat, then transcribed and **sent a
message from the Settings screen**. `mountedRef` is not the same as *focused* —
a screen you navigated away from is still mounted. Nothing may now open the mic
for a screen nobody is looking at.

---

## 4. Voice — spoken replies (TTS)

**Time to first sound: 4.8s → 2.3s**, from four separate fixes:

1. **An unbounded model call sat in front of every spoken reply.**
   `speakMessage` awaited `transliterateIfNeeded` *before* chunking, so nothing
   was requested from `/api/tts` until it returned. That route runs a model call
   deployed with `maxDuration = 30` and had **no timeout of its own** — the 20s
   per-chunk ceiling arms later, inside `armedFetch`. Up to thirty seconds of
   silence. (Intern report: "TTS takes 30–40 seconds, sometimes never plays.")
2. Azure's audio is no longer buffered before answering (**−928 ms**).
3. The Azure region is chosen by **where the function runs**, not where the user
   is.
4. The quota count runs **alongside** auth and the rate limit rather than after
   them.

**A reply being read aloud now stops when you send the next message.** Every
other way of moving on already stopped it — tapping the mic, tapping the
speaker, leaving the screen — so with auto-read on, typing and sending left the
previous reply talking over the new turn. Placed deliberately *after* the early
returns, so an over-length message or a double tap cannot silence a reply
someone is still listening to.

**Hands-free no longer opens the mic into a speaking reply.**
`handleMicPress` always stopped TTS first, because on Android the speaker bleeds
into the mic. The unprompted opener (fires on focus and on return from
background) had no such check. It now *waits* rather than refusing, since
`onDone` hands the mic back the moment the reply ends.

The speak trigger existed **twice** — streaming and non-streaming paths, as
near-identical sixteen-line blocks. Two copies of one state transition is how
these combinations drifted apart; they are now one `speakReplyIfEnabled`.

*All four on/off combinations were verified on a real Galaxy A27 release build,
reading playback and microphone state out of `dumpsys audio`.*

---

## 5. Language — 22 languages, properly

### A stored default no longer outranks what someone writes
Writing in Bengali got an English reply. Device-verified 2026-09-11: stored
`preferredLang` "en", typed *"ami khub valo nei tumi kemon acho"*, answer came
back in English. `preferredLang` **defaulted** to "en" and `toneContext` is
persisted, so every user had "en" stored whether they chose it or not — and the
resolver put profile ahead of detection, so `detectLangFromScript` and
`detectLangFromRomanHints` never ran for anyone.

### Offline replies no longer mix two scripts
Each offline reply is assembled from several pools at once — an opener, a
validation, an extra — and those pools were not all in the same script.
Captured on a real phone with the network off:

> "Hmm. Tumi thik jaygay esechho. Tumi ekhono eta r maazhkhane aacho, tai na?
> আমি এখনও তোমার সাথেই আছি এতে।"

### Emotion detection gaps closed
- **Hindi (UX-04):** `HI_SAD_REGEX` had been defined and exported all along and
  **nothing consumed it.** Hindi is the largest non-English language in the
  product, and a Hindi speaker writing plainly that they felt low got nothing
  from the offline path — while the same sentence in Bengali or Tamil worked.
- **Tamil (UX-40):** `TA_SAD_REGEX` and `TA_STRESS_REGEX` contained **no Tamil
  script whatsoever**, only romanised terms — so a Tamil speaker writing
  Tanglish was understood and one writing Tamil got nothing.
- **Telugu (UX-41):** not detected at all.
- **Japanese, Hebrew, Arabic, German (UX-38):** patterns had been defined and
  exported and never called. Arabic and Hebrew went in unchanged; the other two
  needed work first.

### Punctuation and romanisation (web)
- A sentence now terminates by **the script it is written in**, not the language
  label.
- A romanised reply is no longer wrapped in native-script furniture (`।` etc.).
- The non-ASCII strip no longer glues words together, and the model is told not
  to emit the mark in the first place.

### Crisis support in the right language (UX-01)
Detection has been multilingual for months — `CRISIS_HINT_REGEX` covers all 22
languages at tier 2 and the Indic patterns cover tier 1. **The card that
appeared afterwards was hardcoded English.** So someone writing
*"मुझे जीने का मन नहीं करता"* was recognised correctly and then handed help they
might not be able to read, at the exact moment it mattered most.

Separately: *"जीने का मन नहीं करता"* scored **tier 0** — no card, no helpline —
because the pattern only carried the "…है" form. Found by running real sentences
through the regex inside the app on an iPhone 17 Pro simulator over the Hermes
inspector.

---

## 6. Chat

| Change | Detail |
|---|---|
| **Bigger, safer message controls** | 18px icons with `hitSlop: 8` gave 34px targets spaced 10px apart — centres 28px apart, targets 34px wide, so neighbouring hit areas **overlapped by ~6px** and a tap in that band could resolve to either control. Each action is now a real 44×44 box. |
| **A "…" menu (intern item 6)** | Every bot reply carried **four** controls while a full Message actions sheet (copy, bookmark, timestamp, back-up, export, delete) existed and was reachable only by a long-press nothing advertised. The row is now copy + read-aloud + a 3-dot door to that same sheet. **Bug found while scoping it:** the inline picker wrote Ionicons names (`"heart"`) and the sheet wrote emoji (`"👍"`) into the *same* reactions map — so reacting to a bot message from the sheet showed nothing, anywhere. One shared `reactionOptionsFor()` now serves both. |
| **"New messages" lands on the message** | The capsule scrolled to the bottom, then jumped again after a **fixed 350 ms**. The worry was right — content can still grow — but the things that grow don't respect a guess: a long reply reflows, insight and open-loop cards mount, the emotion strip lays out. Growth landing at 360 ms left the list 1200 px short with no further attempt. It now declares an intent with a deadline and re-pins on every real content change while that intent stands — gated (so it can't yank the list while you read history) and bounded (so it can't take scrolling away), and a drag cancels it. |
| **Colour the chat by relationship** (new, off by default) | Requested by an intern. The hard part wasn't the palette: bubbles are barely opaque, so the background *is* what message text is read against — not decoration underneath the conversation. |
| **Settings apply immediately** | `ChatScreen` read its settings in four mount-only effects and re-read a short hand-picked subset on focus. **Thirty settings** silently kept their old value until the screen happened to remount: typing speed, haptics, voice quality, API timeout, crisis threshold, message timestamps, and every capsule you had dismissed and wanted back. |

---

## 7. Settings & discoverability

- **Search now finds eighteen settings it never could.** Searching "timestamp"
  answered "No settings found", as did "online transcription", "reduced
  motion", "undo", "daily check-in" and most of the Experience section.
  `settingsCatalog.ts` is a hand-maintained index sitting beside the screen it
  indexes and nothing checked the two against each other. One of the eighteen
  was Online transcription, unsearchable from the moment it shipped. A test now
  catches the drift — and the drift is two-sided, since queries of three or more
  words are answered by `/api/settings-search` against a *separate* list in the
  web repo.
- **Search sends you to the right section.** "Companion reactions" renders in
  Advanced and claimed Experience; "Emotional arc cadence" renders in Your
  companion and claimed Advanced — the same failure in both directions, each
  landing you on a collapsed accordion with the toggle out of sight.
- **Master switch for feature discovery cards** — the one-per-session chat tips
  (Trends, Companion, Offline mode, Unsent Letter) were previously dismissible
  only one at a time.

---

## 8. Breathing

Three replacement ambiences: **Rain, Ocean, Bell** — "Bowl" renamed to "Bell".

- **Re-encoded, not shipped as supplied.** The sources were ~5 minutes each at
  256 kbps stereo — **29.8 MB for three**, against 1.6 MB shipping at the time.
  Quality was measured rather than assumed: in all three, content above 14 kHz
  already sits 25–30 dB below the signal, so 96 kbps discards nothing audible.
  Bell gets 128 kbps because it is the only *tonal* source (strikes are
  transients, harmonics are tonal — where MP3 artifacts are audible). Result:
  **11.9 MB**.
- **Level-matched.** The sources spanned **15.8 dB** (Rain −18.3, Ocean −34.1),
  and both platforms play at a fixed volume of 0.35 — so Ocean would have been
  near-inaudible at a setting where Rain was comfortable. All three now sit
  within 0.1 dB of −26.4 dB, applied as pure linear gain, no compression.
- **The rain no longer warbles.** The old loop was broadband noise at 64 kbps —
  the worst case for MP3 — on a 16-second loop, so the seam came round often.
  (Intern feedback item I.) New loops are ~5 minutes, so a normal session never
  reaches the seam.

---

## 9. Network & offline

- **No more waiting out a timeout.** Mobile had *no network awareness at all* —
  no NetInfo, no listener. It discovered it was offline the way a person does
  when nobody answers the phone: a message sent with no signal went to
  `/api/chat-reply` and waited out a 20-second timeout, then to `/api/respond`
  and waited again. (UX-10/11)
- **Captive portals detected.** NetInfo's reachability probe now points at
  Imotara's own `/api/health`, so a café or airport sign-in page is recognised
  for what it is instead of counting as "connected".

---

## 10. Imotara Connect

- **Filter by language and gender (UX-06).** The API has accepted `lang` and
  `gender` since Connect shipped and mobile sent neither — someone looking for a
  companion they could actually talk to had to open every card and read the
  language line.
- **The gender filter is now findable.** It was the *tail* of the language row
  in one horizontal scroller — on a Pixel, roughly two and a half screens of
  sideways scrolling past "Any language" plus eleven languages. It now has its
  own row, both visible without scrolling.
- **A skeleton instead of a blank screen (UX-29).** Mobile had 58
  `ActivityIndicator`s and no skeletons. Measured first: the companion list takes
  **0.9–2.6 s** to come back. The skeleton mirrors the real card.
- **48 blocking dialogs became toasts (UX-17).** `ConnectScreen` had 26 modals
  titled exactly **"Error"** — naming nothing, explaining nothing — plus 22 more,
  all inside a paid booking and wallet flow. The 29 alerts left are the ones that
  are genuinely decisions ("Sign in required", "Billing Paused").
- **The API no longer accepts session types nothing can book.**

---

## 11. Platform fixes

- **iOS haptics did nothing (UX-07).** Haptics were built on React Native's
  `Vibration` API, which never reaches the Taptic Engine on iOS — and vibration
  *patterns* are dropped outright, so `Vibration.vibrate([0, 15, 60, 15])` was a
  no-op on **every iPhone**. The off/light/strong control in Settings was a
  switch wired to nothing. Now routed through `expo-haptics`.
- **The whole Supabase client deadlocked on iOS at startup.** Not an auth bug —
  *every* Supabase call. `getSession()`, `getUser()` and any `.from()` query
  never settled: not resolved, not rejected. supabase-js runs
  `onAuthStateChange` subscribers while holding the auth lock; `applySession` is
  one of those subscribers and called `signInAnonymously()` directly, which needs
  the same lock. `_initialize()` never finished and the client was dead from
  launch.
- **Toast bus ownership.** The bus holds a single handler, and with a tab
  navigator several screens are mounted at once — a second screen calling
  `registerToast` would quietly take ownership of everyone's messages and show
  them on a screen nobody is looking at.
- **Stop interrupting people for things they can't act on (UX-18).** An export
  that couldn't share, or a donation page that wouldn't open, threw a modal that
  had to be dismissed first. Nothing about those needs a decision.

### Android-only (not in the iOS build, included for completeness)
- Keyboard layout driven from the real `ime()` inset. Under edge-to-edge
  (mandatory at targetSdk 35+) `adjustResize` no longer resizes the window and
  React Native does not consume the inset — `KeyboardAvoidingView` can't cover
  for it because `checkForKeyboardEvents()` fires **only when ime() visibility
  toggles**, so an IME changing height while already visible emits nothing.
  Symptom: **771 px of dead space**, plus a header pushed under the status bar.
- Three modals holding text inputs had no keyboard avoidance of their own (a RN
  `Modal` renders in its own window, so Activity-level inset padding never
  reaches it).
- Breathing ambiences shipped as Android raw resources. They played in
  **silence** on a real Galaxy A27, every track, every time — while the identical
  APK was fine on an emulator. `Image.resolveAssetSource()` returned correct
  metadata and an **empty `uri`**, so `downloadAsync` rejected and the only
  symptom a user got was no sound. The platform split in `musicSources.ts` /
  `musicSources.android.ts` is load-bearing: one file with a `Platform.OS` branch
  shipped the mp3s **twice** (APK 114.9 → 126.7 MB).

---

## 12. Build & tooling (no user-facing effect)

- **The iOS Simulator could not run the app at all.** `razorpay-core-pod` 1.0.2
  ships `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64` in **`user_target_xcconfig`**,
  which propagates to the *app* target — leaving no buildable simulator
  architecture on Apple Silicon. The symptom pointed the wrong way ("Unable to
  find a destination matching the provided destination specifier" for a
  demonstrably booted simulator). The exclusion is an Intel-era leftover; the
  vendored xcframework now ships an `ios-arm64_x86_64-simulator` slice. Fixed
  with a post-install hook that rewrites the generated xcconfig **files**, since
  device and store builds are scoped `[sdk=iphonesimulator*]` and cannot change.
- An `internal` EAS profile that produces an installable APK (both existing
  profiles are `distribution=store`, and `production` builds an `.aab`, which
  cannot be sideloaded).
- Web: chat no longer lives in a 1024px column and ends at the bottom of the
  window; Connect CLS **0.88 → 0.06**; admin licenses list reaches every user;
  broadcast email masthead, store links, optional `{{name}}`; CSP allows
  Razorpay fraud detection while keeping its analytics blocked; dead careers
  endpoints and `BottomNav` removed.

---

## Verification notes carried in the commits

- Verified on a **real Galaxy A27 (Android 16), release build** — hands-free
  matrix via `dumpsys audio`, capsule scroll with real post-tap growth, breathing
  playback, launch at 287 ms.
- Verified on **iPhone 17 Pro simulator** — onboarding keyboard avoidance
  measured (Continue y 1702 → 936, Skip setup y 1858 → 1071, keyboard top 1240),
  crisis regex over the Hermes inspector.
- **713 tests, 0 TypeScript errors** at the release commit; guards
  mutation-tested.
