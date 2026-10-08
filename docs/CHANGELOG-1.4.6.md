# Imotara 1.4.3 → 1.4.6 — Complete Change Log

**Previous store version:** 1.4.3 / build 143 (production, released 2026-09-26)
**This version:** 1.4.6 / build 146 (built 2026-10-08)
**Scope:** 35 commits in `imotara-mobile`.

⚠️ **1.4.4 and 1.4.5 never reached production.** 1.4.4 / 144 went to the Play
**internal testing** track on 2 October and stopped there; 1.4.5 / 145 was
tagged in the repo and never uploaded at all — confirmed first-hand in Play
Console on 2026-10-08, where the highest bundle ever uploaded is **144**. So
for anyone on the store today, **every change below is new**.

🔴 **This is also the first production build since enforcement went live.**
`SOFT_LAUNCH_BYPASS_ALL_GATES = false` landed in 1.4.3 (`f94b673`), but a large
share of what follows is the paid-tier plumbing that had to be correct *because*
the gates are now real. Several of these were charging-adjacent bugs.

---

## 1. Emotion understanding in Indian languages — the largest user-visible fix

The on-device emotion pass reads what someone writes and passes a label into the
reply. When it hears nothing, the companion answers more generically. It was
deaf in most of the languages Imotara ships in.

### Happiness went unheard in ten Indian languages (`5c1d0a0`, `c85c511`)
There were no positive keyword maps at all for most Indic scripts. Someone
writing *"মন ভালো"* or *"मैं खुश हूँ"* got the same neutral handling as silence.
Positive vocabulary now covers all **22** supported languages, not the 15 the
first pass reached.

**Two traps this had to survive:**

- 🔴 **The अशांत trap.** `\b` has nothing to anchor to in Indic scripts, so a
  naive search for शांत ("calm") also matches **अ**शांत ("restless") — and
  শান্ত inside **অ**শান্ত. The exact opposite emotion. False friends are
  stripped before the calm map runs.
- 🔴 **The Russian mirror-trap.** `не` ("not") sits inside `мне` ("to me"), so a
  naive negator turned *"мне спокойно"* ("I am calm") into its own negation.

### "not happy" read as hopeful (`5c1d0a0`)
Negation was not checked at all, so *"I'm not happy"* and *"I don't feel
better"* were scored as positive. Negators are now looked for in a window
around the match, sized for whether the language uses spaces.

### Plain sadness went unheard in four languages (`eeb5231`)
Bengali, Marathi, Gujarati and Malayalam had maps for several emotions but not
for sadness itself — the single most important one for this product.

### The label really does change the reply (`6598260`)
A test now pins the loop, because the mobile emotion label feeds the **system
prompt**. A change here is a change to what the companion says, not a cosmetic
tag.

---

## 2. Money, prices and purchases

Everything in this section was wrong in a way the user could see, and some of it
in a way that cost us the sale.

| | |
|---|---|
| `6011d98` | A plan card **showed India's price to people the store would not charge in rupees.** Prices now come from the store for the user's own storefront. |
| `bf43f28` | **Android donations showed India's prices to everyone** and opened a banded checkout that did not apply. iOS already had purchasing-power banding; Android did not. |
| `f31a5e5` | The upgrade sheet **advertised four credit packs Play does not sell.** Tapping them could only fail. |
| `9d32ec7` | The purchase timer **told a paying user their purchase had failed** while it was still completing. |
| `c7e8a58` | The post-purchase poll read `data.tier` — **a field the API has never sent** — so a successful upgrade did not register. |
| `bd00a3d` | The chat header said **Free** while the upgrade sheet said **Plus**, for the same person at the same moment. |
| `5aa0317` | The app pointed users at an **external checkout it was not meant to open** — a store-policy exposure as much as a UX one. |
| `7704f4e` | Razorpay keys are **no longer baked into the build profiles**. |
| `d1a72a5`, `d93fcdf` | Source comments quoting pre-launch prices and a price mismatch that does not exist. |

---

## 3. Licensing correctness

- **A signed-out device claimed Plus** (`cfd157b`, `a8bb401`). Signing out
  stopped *showing* Plus but the device still *had* it, and history pruning
  could run on a guess about a tier nobody had checked. Fixed in three stages;
  stage 3 makes the entitlement actually go away.
- **`refreshLicense` deadlocked after sign-in** (`2e2fdac`) — the known trap
  that `supabase.auth.*` must never be called inside `onAuthStateChange`.
- **The licence is re-read when the app returns to the foreground** (`7b25e0a`),
  so a purchase made elsewhere is picked up.
- **Trends had no upsell on mobile at all** (`c849df0`).
- **Every request now carries the app version** (`d03b2d5`), so a report can be
  tied to a build.

---

## 4. Sign-in and the chat header

- **Your plan now shows in the chat header, with sign in / sign out in the ⋯
  menu** (`d319e11`). Previously there was no way to sign out from the main
  screen.
- **"Signing in…" outlived the sign-in it was waiting for** (`df5547a`) — the
  spinner never cleared.
- **The only sign-in control in Settings was labelled for subscribers only**
  (`9ab9e4a`), so free users had no obvious way in.

---

## 5. Network and offline handling

The old check asked one endpoint whether it was healthy and treated anything
else as "you are offline".

- **A timeout now reads as slow, not offline** (`03defc1`). On a weak Indian
  mobile connection the app was declaring itself offline while the network
  worked.
- **Reaching Imotara is the bar**, not one endpoint being up (`f28d862`).
- **Captive-portal defence** checked only the status code (`65b4036`), so a
  hotel Wi-Fi splash page returning 200 read as success. A foreign `{ok:true}`
  must not read as reachable (`c242028`).
- The probe **never runs on Android** — that is deliberate, Android uses the
  native signal, and it is now documented where it is read (`35efa2e`,
  `5199e2a`).

---

## 6. Settings and copy

- **The consent checkbox — Android + iOS** (`80baec6`).
- **The Support card said all features remain completely free** (`fe60fa9`).
  Untrue since enforcement went live, and exactly the sentence a reviewer or a
  disappointed user would quote back.

---

## STORE COPY — ready to paste

### Google Play "What's new" (≤500 characters)

```
• Imotara now recognises happiness and sadness in all 22 supported languages, including Bengali, Hindi, Marathi, Gujarati and Malayalam.
• Your plan now appears in the chat header, with sign in and sign out in the ⋯ menu.
• Plan and donation prices now match your country and store.
• A slow connection is no longer mistaken for being offline.
• Fixed: a completed purchase could be reported as failed.
• Fixed: signing out now fully clears Plus on that device.
```

### App Store "What's New"

```
Better understanding in Indian languages
Imotara now recognises happiness and sadness across all 22 supported languages — Bengali, Hindi, Marathi, Gujarati, Malayalam and more. It also understands negation, so "I'm not happy" is no longer read as a good day.

Your plan, where you can see it
Your current plan now appears in the chat header, and you can sign in or out from the ⋯ menu.

Correct prices, wherever you are
Plan and donation prices now come from your own App Store storefront instead of defaulting to India's, and the upgrade screen no longer lists packs that are not for sale.

Steadier on a weak connection
A slow network is no longer mistaken for being offline, and hotel or airport Wi-Fi sign-in pages are detected properly.

Also fixed
• A completed purchase could be reported as failed.
• The header could say Free while the upgrade screen said Plus.
• "Signing in…" could stay on screen after signing in had finished.
• Signing out now fully clears Plus on that device.
```
