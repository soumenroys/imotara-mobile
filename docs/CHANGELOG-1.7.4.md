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

- **Crisis help in every language** (`d858020`, `528234c`; web `2a8b3742`, `77697539`). 59 everyday
  ways of saying "I want to die" in the 22 languages were tested: 21 showed no crisis card. Now
  all of them do. The card speaks Spanish, French, German, Portuguese and Indonesian even when no
  language was chosen (it was English). Someone clearly writing English keeps English.
- **A survivor is never turned away** (`ad9b3d5`; web `a33a85e9`). The explicit-content filter
  blocked words like "rape" and "sexual assault", so a person disclosing abuse got "That's not
  something I can help with here". Disclosures now get support and the crisis card, in all
  22 languages. Explicit requests stay blocked. German, Hebrew and Japanese got their own filter
  words and refusal text (they had none).
- **Offline replies in every language** (`062fdb3`). On-device replies now greet, say who they
  are and say goodbye in the person's language (several were English), and recognise goodbyes
  in 9 more languages.

## 2. Under the hood

- **Google sign-in sends the access token** (`ea1845e`). Supabase warned that it will become
  mandatory alongside the ID token. If Google gives none, sign-in works exactly as in 1.7.3, and a
  refused token still falls back to the web sign-in.
- **Android resource shrinking is really on** (`f747ecc`, Play advisory #107). The
  expo-build-properties option had been renamed, so the old name did nothing. Measure the AAB size against 1.7.3 after the build before claiming a smaller download.

## 3. Checks

- 2,369 / 2,369 tests ✓ · `tsc` ✓ on `release/1.7.4` (27 Nov, 02:2x).
- iOS 26.5 simulator + Android emulator Release builds tested 27 Nov 00:40–00:57 (before the crisis,
  survivor and offline-engine changes): consent, Connect hidden by default, first reply, Connect
  switch, Settings search, Google native picker. ▶️ Repeat on the final build.
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
Help when you need it most, in your language: the crisis card now appears for far more ways of saying it, in all 22 languages.

Replies always finish their last sentence, even the long ones.

Offline replies speak your language too.

Connect is only mentioned in chat when you have switched it on in Settings → Advanced.
```

## App Store — "What's New in This Version"

```
Help when you need it most, in your language: the crisis card now appears for far more ways of saying it, in all 22 languages.

Replies always finish their last sentence, even the long ones.

Offline replies speak your language too.

Connect is only mentioned in chat when you have switched it on in Settings → Advanced.
```
