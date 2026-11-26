# Imotara 1.7.3 → 1.7.4 — Change Log (draft)

Prepared 27 Nov 2026 · iOS and Android **build 174**. Not built yet: a build needs the owner's OK.
Branch `release/1.7.4`.

Since 1.7.3 (`900acf4`): replies that hit the length limit end cleanly in the app, the chat tells
the server whether Connect is switched on, Google sign-in sends the access token, and Android
resource shrinking is really on.

The server changes from the #17 audit (26–27 Nov) are already live for 1.7.3 phones:
- Connect is named only when it is switched on and staffed.
- No story on the person's first message.
- Cut replies are trimmed on the non-streaming path.

## 1. What users can see

- **A reply never stops mid-sentence** (`ca9299e`; web `44e4fe5d`). When a reply reaches the
  length limit, the server now sends the same reply ending on its last full sentence, and the app
  shows that. 1.7.3 ignores this message and keeps the cut-off text.
- **Connect is mentioned only if you switched it on** (`7d04ff7`; web `2eee7852`). The chat now
  sends the Show Connect switch with each message. With the switch on, and once a companion is
  listed, a lonely person can be told about Connect again. With it off (the default), Connect is
  never named. 1.7.3 sends nothing, which the server reads as off.

## 2. Under the hood

- **Google sign-in sends the access token** (`ea1845e`). Supabase warned that it will become
  mandatory alongside the ID token. If Google gives none, sign-in works exactly as in 1.7.3, and a
  refused token still falls back to the web sign-in.
- **Android resource shrinking is really on** (`f747ecc`, Play advisory #107). The
  expo-build-properties option had been renamed, so the old name did nothing. Measure the AAB size against 1.7.3 after the build before claiming a smaller download.

## 3. Checks

- 2,110 / 2,110 tests ✓ · `tsc` ✓ on `release/1.7.4`.
- **To do before the build (C):** a fresh-install simulator test on iOS 26.5 and an Android
  emulator release build. Covers chat streaming, a first reply, the Connect switch on and off, the
  Settings search, and the Google native picker opening.
- **For the owner, on a real phone:** one real Google sign-in. Then C reads the Supabase auth log
  for `grant_type=id_token` and status 200.

## 4. Before building

- Raise the version to **1.7.4 / 174** on iOS, Android and web together (`npm run check:version`).
- Owner decisions to fold in, or leave out:
  - #133: free cloud-sync switch default.
  - A native-speaker check of the under-13 stop-screen wording, carried over from 1.7.3.
- Not in this batch: #152, moving the app's sign-in return link to `/auth/app-callback`. The
  current link works, and changing a sign-in path needs its own real-phone test.

---

# Store copy (draft)

## Google Play — "What's new" (≤500 characters)

```
Replies always finish their last sentence, even the long ones.

Connect is only mentioned in chat when you have switched it on in Settings → Advanced.

Reliability updates to Google sign-in.
```

## App Store — "What's New in This Version"

```
Replies always finish their last sentence, even the long ones.

Connect is only mentioned in chat when you have switched it on in Settings → Advanced.

Reliability updates to Google sign-in.
```
