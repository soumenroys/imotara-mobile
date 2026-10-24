# Imotara 1.5.9 → 1.6.0 — Change Log

Prepared 25 Oct 2026 · iOS and Android build 160 · web 1.6.0. **Not yet built or submitted.**

A small release: two hardening changes and a dependency refresh since the 1.5.9 build
(`a29a0a8`). Nothing in the chat, voice, reminders or crisis support changes for the user.

## 1. What users can see

- **The App Store lists the 22 languages Imotara already speaks** (`c3e6850`). The binary
  declared only English, so the store page said "Languages: English". The app itself is
  unchanged: it still follows the phone's language, and crisis numbers and reminders still
  follow the phone's locale (checked on the simulator with bn-IN, hi-IN and sw-KE).

## 2. Security

- **Android release builds refuse plain HTTP** (`ba75439`). Expo's default allowed it; nothing
  in a release build uses it. Checked in the merged manifests after a fresh prebuild:
  release `usesCleartextTraffic=false`, debug `true`, so the development server still
  connects.
- **Build-tool dependencies refreshed** (`ac4892a`). Expo SDK 54 patch releases (expo
  54.0.37, expo-updates 29.0.20, expo-file-system 19.0.24, expo-constants 18.0.14) plus
  the non-breaking `npm audit` fixes: 32 findings → 12, none critical. What is left sits in
  Expo's command-line build tooling, not in the shipped app.

## 3. Checks run

- `npm run check:version` — 1.6.0, iOS 160, Android 160 in sync.
- `npm run typecheck` ✓ · 1,692 / 1,692 tests ✓ · `expo-doctor` 18/18 ✓.

## 4. To attach when submitting

- **App Store:** the 4 new iPhone screenshots and the 8 iPad (Duo) screenshots accepted by
  Apple on 23 Oct. They could not be placed on the released 1.5.9 page, so they go on the
  1.6.0 version page before it is submitted.

## 5. Not in this release

- Android App Links / iOS associated domains (custom-scheme interception, low risk).
- Fresh Android store screenshots (Play still shows iOS captures).

---

# Store copy

## Google Play — "What's new" (≤500 characters)

```
Security and reliability updates under the hood. Nothing changes in how you use Imotara.
```

## App Store — "What's New in This Version"

```
The App Store page now lists all 22 languages Imotara speaks, including Bengali, Hindi, Tamil, Telugu and Urdu.

Security and reliability updates under the hood. Nothing changes in how you use Imotara.
```
