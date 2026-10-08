# 1.4.6 / 146 — on-device check before production

**Build:** 1.4.6, versionCode/build **146**, commit `c85c511`.
**Route:** Play **internal testing** track and **TestFlight** — *not* a sideloaded APK.

> 🔴 **Why the route matters.** Six of the fixes in this build read prices and
> products **from the store** (`6011d98`, `f31a5e5`, `bf43f28`, `9d32ec7`,
> `c7e8a58`, `8229c5b`). A sideloaded APK has no valid Play Billing context, so
> it cannot tell you whether those are fixed — it would show you a plausible
> screen either way. The whole point of going to internal track first is that
> the artifact is delivered by the store, the way a real user gets it.

**Devices on hand** (from the 09-12 setup, re-verified 10-05):
- **Samsung Galaxy A27** `SM-A276B` / `RZGL62HG8WA`, Android 16 — install from
  the Play Store once the tester account is on the internal list.
  ⚠️ If you need USB at any point: **Settings → Security and privacy → Auto
  Blocker must be OFF**, or USB debugging stays greyed out with no explanation.
- **iPhone 14 Pro**, iOS 26.6.2 — install from TestFlight.

---

## A. The checks that can only be done from a store build — do these first

| # | Do this | Expect | Guards |
|---|---|---|---|
| **A1** | Open the upgrade sheet | Monthly **₹149**, annual **₹1,299**. 🔴 **Not ₹99 / ₹699** — those were retired on 25 Sep. | `6011d98` |
| **A2** | Look at the credit packs on that sheet | Only packs Play actually sells. 🔴 **Four phantom packs** were listed before; tapping one could only fail. | `f31a5e5` |
| **A3** | Open Donations | Prices banded for the region, **not India's prices shown to everyone**, and the checkout it opens is the right one. | `bf43f28`, `5aa0317` |
| **A4** | Compare the chat header with the upgrade sheet, same moment | Both say the **same tier**. The header said Free while the sheet said Plus. | `bd00a3d` |

> ⚠️ **A1–A3 on iOS too.** iOS already had donation banding; Android did not.
> The two platforms take different paths to the same screens.

## B. Sign-in, and the entitlement actually going away

| # | Do this | Expect | Guards |
|---|---|---|---|
| **B1** | Sign in | **"Signing in…" clears.** It used to outlive the sign-in it was waiting for. | `df5547a` |
| **B2** | Watch immediately after sign-in | No freeze. `refreshLicense` **deadlocked** on supabase's auth lock here. | `2e2fdac` |
| **B3** | Chat header → **⋯** menu | Sign in / sign out are **there**. There was previously no way out from the main screen. | `d319e11` |
| **B4** | Sign out, then look at what the device can still do | Plus is **gone**, not merely hidden. The old build stopped *showing* Plus while the device still *had* it. | `cfd157b`, `a8bb401` |
| **B5** | Background the app, buy or change something elsewhere, return | The licence is **re-read on foreground**. | `7b25e0a` |
| **B6** | Settings, while signed out | The sign-in control is **not** labelled for subscribers only. | `9ab9e4a` |

## C. Emotion in Indian languages — the largest user-visible change

Type each of these and read **the reply**, not a label. The emotion feeds the
system prompt, so a miss shows up as a generic, flatter answer.

| # | Type | Expect | Guards |
|---|---|---|---|
| **C1** | `মন ভালো` (Bengali, "feeling good") | Warm, responds to the good news | `5c1d0a0` |
| **C2** | `मैं खुश हूँ` (Hindi, "I am happy") | Same | `5c1d0a0` |
| **C3** | `আমি দুঃখিত` / plain sadness in Bengali, Marathi, Gujarati or Malayalam | Responds to **sadness** — this was completely unheard | `eeb5231` |
| **C4** | `I'm not happy` | 🔴 **Must NOT read as positive.** Negation was not checked at all. | `5c1d0a0` |
| **C5** | `আমি অশান্ত` (Bengali, "I am restless") | 🔴 **Must NOT read as calm.** শান্ত sits inside অ**শান্ত** — the exact opposite emotion. | `c85c511` |

> 🔑 **C4 and C5 are the two that matter.** C1–C3 fail loudly if broken. C4 and
> C5 fail *quietly*, by giving a cheerful answer to someone having a bad time —
> which is the worst failure this product has.

## D. Network, on a real connection

| # | Do this | Expect | Guards |
|---|---|---|---|
| **D1** | Use it on mobile data with a weak signal | **No "you are offline"** while the network is merely slow. A timeout now reads as slow. | `03defc1` |
| **D2** | Airplane mode on, then off | Recovers cleanly | `f28d862` |
| **D3** | If you can reach one: a café / hotel Wi-Fi with a sign-in page | The splash page is **detected**, not treated as success. It used to check only the status code. | `65b4036`, `c242028` |

## E. Quick sweep

- **Settings** — the consent checkbox is present, Android **and** iOS (`80baec6`).
- **Trends** — there is an upsell; there was none on mobile at all (`c849df0`).
- **Support card** — does **not** say all features remain completely free. Untrue
  since enforcement went live, and the sentence a reviewer would quote (`fe60fa9`).

---

## Then, and only then

Promote the Android internal build to **production with a staged rollout**, and
submit the iOS build for review. Store copy for both is already written, in
`CHANGELOG-1.4.6.md` — the Play text measures 461 of its 500 characters.

⛔ **Do not upload a mapping file by hand.** Play extracts it from the bundle;
a manual upload is rejected.
