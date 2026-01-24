# Imotara Mobile — RELEASE GO / NO-GO Checklist (Public v1)

Date:
Build:
Owner:

## Non-negotiables (must be YES)

### 1) Chat never blocks
- [ ] Can send message and receive reply
- [ ] If API fails: graceful fallback (no crash)
- [ ] Donation / licensing failures do NOT affect chat flow

### 2) Passive licensing (3 months free)
- [ ] No paywall UI
- [ ] No gating / restriction logic
- [ ] App continues if licensing endpoints are down

### 3) Donations are safe + optional
- [ ] Donation is only in Settings / About (not in chat)
- [ ] Buttons don’t double-trigger (busyRef works)
- [ ] Checkout opens successfully
- [ ] Success text is truthful (“Checkout completed… confirming receipt…”)
- [ ] App does not crash on cancel/failure
- [ ] Receipt confirmation can lag without confusing users

---

## GO / NO-GO Tests (run now)

### Local run
- [ ] `npm install` (or `yarn`) succeeds
- [ ] `npm start` / `expo start` launches

### Donation flow
- [ ] Settings → Donation: checkout opens
- [ ] Cancel: neutral message, no crash
- [ ] Failure: neutral message, no crash
- [ ] Success: shows payment id + webhook confirmation note
- [ ] No duplicate orders on rapid taps

### Build / distribution
- [ ] iOS: TestFlight build available
- [ ] Android: internal build available

---

## Release Decision

Decision:
- [ ] GO
- [ ] NO-GO

Notes / blockers:
-
