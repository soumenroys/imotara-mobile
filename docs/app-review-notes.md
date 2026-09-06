# App Review notes — Imotara (iOS)

Paste the relevant section into **App Store Connect → App Review Information →
Notes** at submission. Keeping it here means the reasoning ships with the code
that depends on it.

---

## Payments: what uses In-App Purchase, and the one thing that does not

**Everything Apple requires IAP for uses IAP.** Subscriptions and token packs go
through StoreKit (`UpgradeSheet`, via `expo-iap`), and tips/donations go through
`IOSTipJar`, also StoreKit. None of these touch an external payment provider on
iOS.

**One flow uses an external payment provider, deliberately: Imotara Connect
session minutes.**

Imotara Connect lets a person book a **realtime one-to-one session with a named
human wellness companion** — a live conversation with another individual, not
digital content, not a subscription, and not credit that can be spent anywhere
else in the app. Payment buys minutes for that specific booked session with that
specific companion.

We understand this to fall under **App Review Guideline 3.1.3(d), Person-to-
Person Services**, which permits payment methods other than in-app purchase for
realtime person-to-person services between two individuals, in the same family
as tutoring, medical consultations and fitness training.

Scope, so the boundary is explicit:
- One-to-one only. There are no group or one-to-many sessions.
- Realtime only. Nothing recorded, downloadable, or consumable later.
- The minutes are tied to a booked session with a named companion. They are not
  a general wallet or store credit. The previous general wallet top-up was
  **removed** from the app.
- Free companions (rate 0) take no payment at all.

If any of those stop being true, this flow needs an IAP path before it ships.

## How a reviewer can reach it

1. Open the **Connect** tab.
2. Choose a companion whose rate is shown as a price per minute (companions
   marked **Free** never prompt for payment).
3. Sign in, then start or extend a session — the recharge sheet appears there.

## Other things reviewers commonly ask about

- **Crisis support.** If a message suggests distress, the app surfaces a crisis
  card with helpline numbers chosen by the user's country, in the language they
  wrote in (22 supported). It is informational and never replaces emergency
  services.
- **Data.** Chat and emotion history stay on the device by default. Cloud sync
  is off unless the person turns it on.
- **Accounts.** The app is usable without signing in; Sign in with Apple is
  offered alongside Google.
