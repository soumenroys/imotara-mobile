# Imotara 1.5.8 → 1.5.9 — Change Log

Released 21 Oct 2026 · iOS and Android build 159 · web 1.5.9 the same day.

Fifteen user-facing commits since the 1.5.8 build (`9d01973`). Most of them bring the
phone apps level with changes the web made in mid-October.

## 1. 🔴 Crisis support

- **The crisis card could appear with no helpline on it** (`bf25a98`). Any country outside
  the 59 with their own numbers got `null`, and the card rendered empty. It now always shows
  a number.
- **The crisis-country setting did nothing** (`4447fbd`). Settings saved the choice and
  nothing read it; the fallback also guessed a *country* from the *language*. Both fixed.

## 2. The first-use welcome and consent screen

- **New on iOS and Android** (`1ff17c8`, `eae27d7`), word for word the same as the web:
  what Imotara is and is not, the emergency numbers for your country, 13 or older with a
  parent's agreement under 18, in all 22 languages.
- **It actually gates now** (`96417e3`). On a wiped device the sign-in sheet could appear on
  top of it, so someone could create an account without passing it.
- **The age constant said 18 while every translation said 13** (`962e71c`).

## 3. The daily reminder

- **It no longer quotes what you wrote on the lock screen** (`fcb5e0b`). It names the day
  instead.
- **You can pause it for 3 or 5 days** (`3d2da64`), and the pause really cancels the
  scheduled notification.
- **It was in English for everyone** (`eb4a056`); it now follows your language. Paid users
  also had no off switch; they do now.

## 4. Everything else

- Connect: the people you book are **companions, not counsellors** (`5130187`).
- Shared family mood links went to the raw deployment address, not imotara.com
  (`baebcb8`); the app now links Imotara's Facebook, Instagram, X and LinkedIn pages
  (`baebcb8`, `007c0be`, `8e6ae8f`).
- The voice said its own name wrong in **Urdu** and **Kannada** (`0e7ce61`, `185a384`).

---

# Store copy

## Google Play — "What's new" (≤500 characters)

```
The crisis card now always shows a helpline for your country, and the country you pick in Settings is used.

A short welcome screen on first use explains what Imotara is and isn't, in your language.

The daily reminder no longer quotes your words on the lock screen, speaks your language, and can be paused for a few days.

Imotara now says its own name correctly in Urdu and Kannada.
```

## App Store — "What's New in This Version"

```
SAFER WHEN IT MATTERS MOST
The crisis card now always shows a helpline. Before, people in some countries could see the card with no number on it. The country you choose in Settings is now the one it uses.

A WELCOME ON FIRST USE
The first time you open Imotara, a short screen explains what it is and what it isn't, shows the emergency numbers for your country, and asks you to agree to the terms — in all 22 languages.

A KINDER DAILY REMINDER
- It no longer quotes what you wrote on your lock screen
- It speaks your language instead of English
- You can pause it for three or five days

SMALLER THINGS
- Connect now describes the people you can talk to as companions, which is what they are
- Shared mood snapshots open on imotara.com
- Imotara says its own name correctly in Urdu and Kannada
- Links to Imotara on Facebook, Instagram, X and LinkedIn are in Settings
```
