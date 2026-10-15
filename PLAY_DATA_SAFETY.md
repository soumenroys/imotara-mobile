# Google Play — Data Safety Section Answers
# Imotara (keep updated with each release — data types rarely change)

Use this document to fill in the Data Safety form in Google Play Console.
---

## 1. Does your app collect or share any of the required user data types?
**→ Yes**

---

## 2. Is all of the user data collected by your app encrypted in transit?
**→ Yes** (all API calls use HTTPS)

---

## 3. Do you provide a way for users to request that their data is deleted?
**→ Yes** — users can clear local history from the app. Cloud data deletion can be requested via support.

---

## 4. Data Types — What to declare

### Personal Info

| Data Type | Collected | Shared | Required or Optional | Purpose |
|-----------|-----------|--------|----------------------|---------|
| Name | Optional | No | Optional | AI personalization via companion memory |
| Age range | Optional | No | Optional | Tone adjustment for AI responses |
| Gender | Optional | No | Optional | Tone adjustment for AI responses |

---

### Financial Info

| Data Type | Collected | Shared | Required or Optional | Purpose |
|-----------|-----------|--------|----------------------|---------|
| Purchase history | No | No | — | — |
| Payment info | Yes (via Razorpay SDK) | Yes (Razorpay, for payment processing) | Optional | Donation / license unlock only |

> Note: The app does NOT store card/UPI details. Payment is handled entirely by the Razorpay SDK. Only a payment confirmation ID is retained.

---

### App Activity

| Data Type | Collected | Shared | Required or Optional | Purpose |
|-----------|-----------|--------|----------------------|---------|
| App interactions | No | No | — | No analytics SDK present |
| In-app search history | No | No | — | — |
| Installed apps | No | No | — | — |

---

### Messages / User Content

| Data Type | Collected | Shared | Required or Optional | Purpose |
|-----------|-----------|--------|----------------------|---------|
| Emails or text messages | No | No | — | — |
| In-app messages (chat) | Yes | No (shared only with our own server) | Required | AI emotional companion response & history sync |

> Chat messages are sent to imotaraapp.vercel.app (owned by the developer) for AI response generation and optional cross-device sync. Data is NOT shared with any third party.

---

### Audio

| Data Type | Collected | Shared | Required or Optional | Purpose |
|-----------|-----------|--------|----------------------|---------|
| Voice or sound recordings | Yes (temporary) | No (sent only to our own server) | Optional | Voice-to-text transcription for chat input |

> Audio is recorded only when the user taps the mic button. The file is sent to imotaraapp.vercel.app for transcription and is not permanently stored.

---

### Health & Fitness

| Data Type | Collected | Shared | Required or Optional | Purpose |
|-----------|-----------|--------|----------------------|---------|
| Health info | Yes (emotional wellbeing / mood) | No | Optional | Emotion analysis and mood tracking |

> The app detects and stores emotional states (e.g. sad, anxious, hopeful) from conversations. This data stays on the user's device (local mode) or is synced to the developer's own server (cloud mode). It is never sold or shared with third parties.

---

### Identifiers

| Data Type | Collected | Shared | Required or Optional | Purpose |
|-----------|-----------|--------|----------------------|---------|
| User IDs | Yes (anonymous device-generated ID) | No | Required | Scoping data per user/device |
| Device or other IDs | No | No | — | — |

> No IDFA, GAID, or hardware identifiers are used. The user ID is a random string generated locally or optionally set by the user.

---

### Location — ⛔ READ THE GATE BEFORE FILLING THIS IN

> ## ⛔ THIS SECTION IS NOT YET TRUE — AND MY FIRST VERSION OF THIS GATE NAMED THE WRONG TRIGGER.
> It said this became true "at the next EAS build". **It does not.** The
> recorder runs **server-side on `/api/respond`**, which every ALREADY-INSTALLED
> iOS and Android build calls, and those builds already send
> `X-Imotara-Platform`. So mobile usage would begin being recorded **the instant
> the WEB deploys** — no app release involved. A gate naming the wrong trigger
> is worse than no gate, because it buys false time.
>
> **What actually switches it on:** setting **`IMOTARA_USAGE_GEO_MOBILE=true`**
> in Vercel. The recorder is **web-only by default** and returns early for
> ios/android without it (`imotaraapp src/lib/analytics/usageGeo.ts`).
>
> ▶️ **THE ORDER, and it only works in this order:**
> 1. Enter the Location section below in the Play Console form, and the Apple
>    label (Coarse Location · Not Linked to You · Analytics).
> 2. **Then** set `IMOTARA_USAGE_GEO_MOBILE=true`.
>
> Until step 2, **Location stays "No"** as §5 says, and that remains accurate
> however many times the web deploys.

| Data Type | Collected | Shared | Required or Optional | Purpose |
|-----------|-----------|--------|----------------------|---------|
| Approximate location | **Yes** — country + region, inferred from IP | No | Required | Analytics |
| Precise location | No | No | — | — |

**Why it must be declared, verified against Google's guidance 2026-10-16** —
[Data safety — provide information](https://support.google.com/googleplay/android-developer/answer/10787469):

> *"Approximate location that is inferred, such as via IP address or Access
> Point Name, must be disclosed here."*

⛔ **Three exemptions were checked and none applies:**
- **"Anonymous data"** is an exemption from **SHARING**, not from collection. We do not share it, so it is irrelevant here.
- **Aggregation is not listed as an exemption at all.** That our rows carry no identifier makes the data safer; it does not make it undeclarable.
- **Ephemeral processing** requires data "only stored in memory and retained for no longer than necessary to service the specific request". A daily counter is stored, so it does not qualify. ⚠️ Note that even ephemeral data "must still be included in your form response" — it is merely hidden from the public listing.

**What is actually stored** — one row per `(day, country, region, platform)` with
a count, and nothing else. No user id, no session id, no IP in any form, no
coordinates, no city, and no timestamp finer than the day. Rows older than 100
days are summed into one row per month, destroying the exact date. The app
requests **no location permission**; the country is inferred server-side from
the network the request arrives on, so a device with location services off is
counted identically. ⇒ `imotaraapp docs/sql/usage_geo_daily.sql`.

**🍎 APPLE'S ANSWER IS DIFFERENT, AND THE DIFFERENCE IS REAL.** Apple defines
collection as transmitting off device **and storing in readable form for longer
than it takes to service the request** — *"if an authentication token or IP
address is sent on a server call and not retained… you do not need to disclose
this."* So Imotara's **pre-existing** uses of the header (crisis numbers, PPP
donation banding, TTS region routing) are genuinely not collection for Apple,
while Google would still want them in the form as ephemeral. Once the counter
is stored, declare **Coarse Location**, marked **"Not Linked to You"**, purpose
**Analytics** — Apple has no aggregation exemption either, and unlinked data is
still disclosed, just in the unlinked column.

---

## 5. Data NOT collected (explicitly confirm these as "No" in the form)

- Location — ⚠️ true **today**; see the gated section above before the next mobile release
- Contacts
- Calendar events
- Camera
- Photos / videos
- Files / documents
- Web browsing history
- Crash logs
- Device or other IDs (IDFA / GAID)
- Advertising data

---

## 6. Data Sharing Summary

| Shared With | What | Why |
|-------------|------|-----|
| Razorpay | Payment amount, order ID (via native SDK) | Process optional donation payment |
| imotaraapp.vercel.app (developer's own server) | Chat messages, voice audio, user scope ID | AI responses, history sync, transcription |

**No data is sold. No data is shared with advertisers or data brokers.**

---

## 7. Security Practices (check these in the form)

- [x] Data is encrypted in transit (HTTPS)
- [ ] Data is encrypted at rest *(chat history in AsyncStorage is not encrypted — do NOT check this. Companion memories and JWT are in device Keychain/Keystore via expo-secure-store.)*
- [x] Users can request data deletion
- [ ] App follows Families Policy *(only check if targeting children)*
- [ ] App has been independently security reviewed

---

## 8. Privacy Policy URL

Make sure you have a published Privacy Policy URL to enter in the form.
Suggested URL: https://imotaraapp.vercel.app/privacy

---

## Summary Statement (for your reference)

> Imotara collects chat messages and optional voice input to provide AI-powered emotional support. Data is stored locally on the device or optionally synced to the developer's own server. No analytics SDKs, advertising networks, or third-party trackers are used. Payment is handled by Razorpay for optional donations. No user data is sold or shared with third parties.
