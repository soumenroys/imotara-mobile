# Imotara 1.7.2 → 1.7.3 — Change Log (December batch)

Prepared 26 Nov 2026 · iOS and Android **build 173** (not built yet — needs the owner's OK) · web
changes for this batch are already live.

Since 1.7.2 (`a01f760`): Expo SDK 58, native Google sign-in, the store age signal, Connect off by
default, the check-in invite under the first reply, and four fixes found in the release checks.
Branch `chore/expo-sdk-58`.

## 1. What users can see

- **Google sign-in uses the phone's own account picker** (`329901a`, #169). It used to open a web
  page that named our database host. A cancel stops cleanly; the web page is kept only as a fallback
  if the phone cannot do native sign-in.
- **The Connect tab is off unless you switch it on** (`4905c4a`, #108) — Settings → Advanced →
  Show Connect. Same as the website (Settings → Appearance).
- **The daily check-in invite comes under the first reply** (`e91db87`, #16) — "Shall I check in
  with you tomorrow?" with 8:30 PM / 9:00 AM / Choose a time / Not now. Still once ever, never near
  a crisis. It used to wait for the second reply, and 21–40% of new people leave after one.
- **The store's age range is respected** (`d94930e`, #159). Where Google Play (Age Signals) or Apple
  (Declared Age Range) says the person is under 13, a gentle stop screen with crisis help replaces
  the chat. 13–17 gets the teen tone, and Connect stays closed to them. An unclear or missing signal
  never locks anyone out, and the app does not wait for the answer before opening.
- **Searching Settings for "reminder" finds the daily check-in reminder** (`0138984`; web
  `5e69aeea`). It had no search entry, and the chat's "Choose a time" sends people to Settings.
- **Settings search shows the list for what you typed** (`79b54de`). A slow server answer for a
  half-typed word could replace the right list ("Show connect" showed five unrelated settings).
  This was already in 1.7.2.
- **Companion memory no longer saves a feeling as a fact about you** (`4b51eeb`; web `7269269d`).
  "I'm stressed and overwhelmed" was saved as "User is a/an stressed and overwhelmed", shown in
  Settings and passed to replies. A job is now saved only when it is clearly a job, the wording is
  plain ("User works as a teacher", "User lives in Kolkata"), and wrong memories already saved are
  removed the first time the app loads them.
- **Status bar readable in both themes on iOS** (`f66837f`). On SDK 58 it turned dark on the dark
  theme.
- **Start-up looks as quick as before** (`4644f06`). SDK 58 faded the splash screen out over 0.4 s
  on Android, so the app looked about a quarter of a second slower although it was ready at the same
  moment. The fade is now 0.12 s (frame-timed on the emulator: median 1.85 s to the first screen,
  against 2.91 s for 1.7.2).

## 2. Under the hood

- **Expo SDK 54 → 58** in five steps (`b3c245d` … `2b8f76e`): React Native 0.88.1, React 19.3.
  Audio moved from expo-av to expo-audio through one adapter (`src/lib/audio/av.ts`); Android keeps
  the speech-tuned microphone. iOS minimum is now 16.4.
- **Test builds say so** (`1f884b6`, #170). Only the store build profiles mark themselves as
  `store`; every other build sends `x-imotara-build: test`, and the server drops those counts.
- **Anonymous step counts in the app** (`e91db87`, `faa4888`, #16): invite shown / accepted /
  declined, welcome-back, daily limit reached and reminder tapped. These are once per device per
  day, with no id and no text, the same as the website. The store forms already cover them (Play:
  App interactions → Analytics; Apple: Product Interaction → Analytics).

## 3. Checks run (25–26 Nov 2026)

- 2,079 / 2,079 tests ✓ · `tsc` ✓ · GitHub CI ✓ on the branch.
- **Android, a release build on the live server (emulator):** everything below passed.
  - Consent card shows and the app opens with no age block.
  - Connect is hidden by default; the switch works and stays set after a restart.
  - Reply in about 7 s, with the invite under the first reply.
  - Mic records, uploads and gets the server's answer.
  - Read aloud plays.
  - Google opens the native picker.
  - The light theme is readable.
  - No test counts reached the server.
- **iOS, a fresh install on the 26.5 simulator:** the same list passed. In addition:
  - iOS asks for the microphone with our wording.
  - The Google native path was used (no web fallback).
  - The status bar is right in all 5 light/dark combinations.
- **Still for the owner, on a real phone:** a real Google sign-in and a spoken mic test.

## 4. Before building

- Raise the version to **1.7.3 / 173** on iOS, Android and web together (`npm run check:version`).
- Turn on Apple's **Declared Age Range** capability for the app ID.
- Have a native speaker check the under-13 stop screen wording.

## 5. Not in this release

- "Choose a time" opens Settings at the top, not at the reminder (same in 1.7.2).
- Some replies contain " - " with spaces where a dash belongs; this comes from the server, not
  the app.

---

# Store copy

## Google Play — "What's new" (≤500 characters)

```
Imotara can now offer a gentle daily check-in after your very first chat. Pick a time, or say not now.

Signing in with Google uses your phone's own account picker.

Companion memory no longer mistakes a feeling for a fact about you.

The Connect tab is off unless you switch it on in Settings → Advanced.

Searching Settings for "reminder" finds your daily check-in.

Smoother start-up, plus reliability updates.
```

## App Store — "What's New in This Version"

```
Imotara can now offer a gentle daily check-in after your very first chat. Pick a time, or say not now.

Signing in with Google uses your iPhone's own sign-in sheet.

Companion memory no longer mistakes a feeling for a fact about you.

The Connect tab is off unless you switch it on in Settings → Advanced.

Searching Settings for "reminder" finds your daily check-in.

The status bar is easier to read in light and dark themes, plus reliability updates.
```
