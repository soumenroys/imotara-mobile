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

> # 🔴 AUDITED AGAINST THE CODE, 2026-10-16 — and the LIVE FORM AND THIS DOC BOTH DISAGREED WITH IT
>
> Opened the live Data safety form in Play Console. **Only three data types were
> ticked** — Messages 1/3, App activity 1/5, and the Approximate location added
> that day. Personal info **0/9**, Health and fitness **0/2**, Photos **0/2**,
> Audio **0/3**, Device IDs **0/1**.
>
> ⚠️ **This document was also wrong**, in the other direction: it listed Payment
> info as collected (it is exempt) and omitted Photos, Address and the
> government-ID uploads entirely. Neither source could be trusted, so every line
> below was re-derived **from the code**, with the file that proves it.
>
> ⛔ **I am not a lawyer and this is a legal attestation.** Read the evidence
> column and decide each line yourself. Confidence is marked honestly.

### ✅ ENTERED IN THE CONSOLE 2026-10-16 — staged, **NOT yet sent to Google**

All ten types are filled in and saved. ⛔ **The final step is not done**: the console says
*"Change saved. Send for review in Publishing overview."* A dialog offered to go there and
**"Not now" was clicked** — sending the declaration for review is the owner's act, not mine.

**Exactly what is staged**, as the store listing will render it:

| Data type | Required? | Purpose | Ephemeral |
|---|---|---|---|
| Name | Optional | App functionality, Personalization | No |
| Email address | Optional | Account management | No |
| **User IDs** | **Required** | App functionality | No |
| Address | Optional | Fraud prevention, security & compliance | No |
| Other info | Optional | Fraud prevention, security & compliance | No |
| Purchase history | Optional | App functionality | No |
| **Approximate location** | **Required** | **Analytics** | No |
| Photos | Optional | Fraud prevention, security & compliance | No |
| **Health info** | **Required** | App functionality | No |
| Voice or sound recordings | Optional | App functionality | **YES** ⇒ disclosed in the form but **not shown on the public listing** |
| In-app messages · App interactions | — | *(pre-existing, untouched)* | — |

**Nothing is marked Shared.** The listing reads *"this app doesn't share user data with other
companies or organizations."* Transfers to OpenAI/Azure and Razorpay are service providers
processing on our behalf, which Google exempts from "sharing".

⛔ **Deliberately NOT ticked:** Payment info (Razorpay collects card details under its own terms
— Google's *Payment services* exemption) · Precise location · Phone number · Contacts · Calendar ·
Files and docs · Web browsing · Device or other IDs.

### 🔑 THE THREE "REQUIRED" ENTRIES, which are the judgement calls
A user **cannot turn these off while using the app**, so claiming otherwise would be false:
- **User IDs** — `anonId` is generated whether or not you sign in;
- **Approximate location** — derived server-side from the network the request arrives on;
- **Health info** — emotion is derived from any chat message and stored with the record. Mood
  detection is the product; there is no switch.

### ⚠️ TWO ORDERING FACTS THAT ARE EASY TO GET WRONG
1. **Per-type answers do not survive a page reload** unless **Save draft** is pressed afterwards.
   The first attempt at *Name* was lost to exactly this.
2. **`IMOTARA_USAGE_GEO_MOBILE` is still unset**, so mobile geo is **not being recorded**. Turn it
   on **only after** this declaration has been sent and accepted ⇒ `imotaraapp src/lib/analytics/usageGeo.ts`.

### The table, with evidence

| Play type | Declare | Confidence | Evidence in the code |
|---|---|---|---|
| **Personal info → Name** | **Collected**, optional, App functionality | **High** | `SettingsScreen.tsx:581` sends `name` to `/api/profile/sync`; the server **upserts it into `user_memory`** (`profile/sync/route.ts:144`) |
| **Personal info → Email address** | **Collected**, optional, Account management | **High** | Google/Apple OAuth via Supabase (`AuthContext.tsx`); the address lands in `auth.users`. An account is optional — the app works signed-out |
| **Personal info → User IDs** | **Collected**, required, App functionality | **High** | `anonId` persists in AsyncStorage (`lib/legal/anonId.ts`) and is sent as `x-imotara-user`; signed-in users send a Supabase uid |
| **Personal info → Address** | **Collected**, optional, App functionality | **Medium** | Connect consultant registration uploads **"Proof of Address — utility bill, bank statement"** (`ConnectScreen.tsx:4536`). Consultants only, not ordinary users |
| **Personal info → Other info** | **Collected**, optional, App functionality | **Medium** | Same flow uploads **"Government Photo ID — Passport, Aadhaar, Driver's License"** and **Proof of Age** (`:4535`, `:4537`); plus `ageTone` and `gender` from profile sync |
| **Photos and videos → Photos** | **Collected**, optional, App functionality | **High** | A **selfie** plus the document images go to `/api/connect/upload-doc` and `/upload-photo` via `FileSystem.uploadAsync` (`ConnectScreen.tsx:4631`) |
| **Health and fitness → Health info** | **Collected**, optional, App functionality | **High** 🔴 | `/api/history` **persists an `emotion` field per record** (`history/route.ts:85-110`), and the column exists in the schema. Mood tracking is the product — this is the single most important missing line |
| **Messages → In-app messages** | **Collected** ✅ *(already ticked)* | — | Chat text to `/api/respond` and `/api/history` |
| **App activity** | 1/5 ✅ *(already ticked)* | — | — |
| **Audio → Voice or sound recordings** | **Collected, mark EPHEMERAL**, optional | **High** | Audio is uploaded to `/api/voice/transcribe` and **never retained** — no Storage upload, no filesystem write; the only DB write is a `usage_events` quota row. ⚠️ Google: ephemeral data *"must still be included in your form response"*, it is simply **not shown on the listing** |
| **Financial info → Purchase history** | **Collected**, optional, App functionality | **Medium** | `productId` + `purchaseToken` sent to `/api/payments/google-play/verify` (`UpgradeSheet.tsx:94`); the resulting licence is stored |
| **Financial info → Payment info** | ⛔ **Do NOT declare — exempt** | **High** | Razorpay collects card details in **its own checkout** under its own terms; the app never sees them. Google's *"Payment services"* exemption covers exactly this ⇒ the old version of this doc was **wrong** to list it |
| **Location → Approximate location** | **Collected**, required, Analytics | **High** | IP-derived server-side, stored only as a **daily (country, region, platform) count** with no identifier ⇒ `imotaraapp docs/sql/usage_geo_daily.sql`. ⛔ Precise location stays **unticked** — lat/long headers are never read, asserted by test |

### ⚠️ Answers for the follow-up questions, per type
Google asks these for every ticked type:
- **Collected or shared?** → **Collected** for all. **Nothing is shared.** Transfers to OpenAI/Azure (transcription, replies) and Razorpay are to **service providers processing on our behalf**, which Google exempts from "sharing".
- **Processed ephemerally?** → **Yes for Voice only.** Everything else is stored.
- **Required or optional?** → **Required**: User IDs, Approximate location (collected automatically). **Optional**: everything else — the app works signed-out, Connect is opt-in, voice is opt-in.
- **Purpose** → App functionality for most; **Analytics** for Approximate location; **Account management** for Email.


> ## ⛔ EVERYTHING FROM HERE TO §5 IS THE OLD, PRE-AUDIT VERSION — SUPERSEDED 2026-10-16
> It is kept only so the change is traceable. **The evidence table above is the
> one to fill the form from.** These older tables are wrong in both directions:
> they list **Payment info** as collected (it is exempt — Razorpay collects card
> details under its own terms) and they omit **Photos**, **Address** and the
> **government-ID uploads** entirely. ⚠️ Two hand-kept copies drift, and the one
> someone fills a legal form from should never be the stale one.

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

- ~~Location~~ — ⛔ **NO LONGER TRUE.** Approximate location is collected (IP-derived, aggregated). See the evidence table in §4.
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
