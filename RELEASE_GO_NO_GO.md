# Imotara Mobile — Release Go / No-Go Checklist

> Fill this out before every iOS / Android release. All Non-negotiables must be YES.

---

## Release Info

| Field | Value |
|-------|-------|
| Version | |
| iOS buildNumber | |
| Android versionCode | |
| Date | |
| Owner | |

---

## Non-negotiables (must all be YES)

### 1. Chat never blocks
- [ ] Can send message and receive reply (cloud path)
- [ ] If API fails: local reply engine activates gracefully (no crash)
- [ ] Payment / licensing failures do NOT affect chat flow

### 2. Version sync
- [ ] `app.json` version, iOS `buildNumber`, Android `versionCode` all incremented
- [ ] `package.json` version matches `app.json`

### 3. Feature gates correct
- [ ] `EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL` set to intended value
- [ ] `featureGates.ts` tier sets match web `featureGates.ts` (run test suite)
- [ ] No unintended paywall during active conversations

### 4. Payments safe
- [ ] Android: Razorpay `fetchWithTimeout` wired; double-tap protected
- [ ] iOS: all IAP product IDs exist in App Store Connect and are "Ready to Submit"
- [ ] EAS `eas.json` production profile points to correct service account key (Android)

### 5. TypeScript clean
- [ ] `npx tsc --noEmit` passes (0 errors)

### 6. Bundle
- [ ] Avatar images are JPEG (not PNG) — `src/assets/avatars/**/*.jpg`
- [ ] Sounds are MP3 (not WAV)
- [ ] `enableProguardInReleaseBuilds: true` and `enableShrinkResources: true` in `app.json`

---

## Build & Submit

- [ ] `eas build --platform ios --profile production --auto-submit`
- [ ] iOS build appears in App Store Connect TestFlight
- [ ] `eas build --platform android --profile production`
- [ ] AAB submitted: `eas submit --platform android --id <build-id> --profile production`
- [ ] Android versionCode appears in Play Console production track

---

## Release Decision

- [ ] **GO** — all non-negotiables met
- [ ] **NO-GO** — blockers listed below

Blockers / notes:
-
