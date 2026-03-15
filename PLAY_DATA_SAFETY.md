# Google Play — Data Safety Section Answers
# Imotara v1.0.2

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

## 5. Data NOT collected (explicitly confirm these as "No" in the form)

- Location
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
- [ ] Data is encrypted at rest *(local AsyncStorage is not encrypted — do NOT check this)*
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
