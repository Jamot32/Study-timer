# Login system issues — agent handoff

Audit date: 2026-10-15  
Scope: Google + sheet allowlist auth, session store, sync token lifecycle  
Related: `DOCs/google-sheet-login-architecture.md`, `DOCs/prd-login-and-sync.md`

## Goal for follow-up agents

Fix the issues below without changing guest-first UX (name / Continue as guest must still work). Prefer small, reviewable PRs — one theme per PR when possible.

## Priority order

| # | Severity | Issue | Primary files |
|---|----------|--------|----------------|
| 1 | High | ID token in `tokeninfo` query string (log leak) | `apps-script/Code.gs` |
| 2 | High | Login response not validated with `isAuthSession` | `lib/auth/google-sheet-auth.ts`, `lib/auth/secure-session-store.ts` |
| 3 | High | Web stores 30-day bearer `syncToken` in localStorage | `lib/auth/secure-session-store.ts` |
| 4 | Medium | Disabled / not-approved users stay UI-signed-in | `lib/auth/google-sheet-auth.ts`, `lib/sync/index.ts`, `App.tsx` |
| 5 | Medium | Web restore dies after ~1h despite valid `syncToken` | `lib/auth/google-sheet-auth.ts`, `lib/auth/google-id-token.web.ts` |
| 6 | Medium | Guest/name login does not clear prior Google session | `components/Login.tsx`, `App.tsx` |
| 7 | Medium | Sign-out vs in-flight `syncSessions` race | `lib/sync/index.ts`, `App.tsx` |
| 8 | Medium | First Google sign-in uploads prior guest rows (shared device) | `lib/sync/index.ts` |
| 9 | Low | Hardcoded `DEFAULT_SPREADSHEET_ID` in repo | `apps-script/Code.gs`, `apps-script/README.md` |
| 10 | Low | Architecture doc says session “holds no secrets” but stores `syncToken` | `DOCs/google-sheet-login-architecture.md` |

---

## Issue details

### 1. ID token passed in URL query string

**Where:** `apps-script/Code.gs` → `verifyGoogleToken_` (~line 47)

**Problem:**  
`UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + ...)` puts the JWT in the query string. Tokens can land in UrlFetch / proxy / access logs.

**Also:** `tokeninfo` is a debug-oriented endpoint (throttle / outages). Production should verify JWT signature + `aud` / `iss` / `exp` / `email_verified` via Google JWKS (or another non-query-string path).

**Fix direction:** Local JWKS verification in Apps Script, or otherwise avoid putting the raw ID token in a URL.

---

### 2. `authorize` does not validate session shape

**Where:** `lib/auth/google-sheet-auth.ts` → `authorize` (~line 54)  
**Contrast:** `lib/auth/secure-session-store.ts` → `isAuthSession` (used only on read)

**Problem:**  
On `{ ok: true }`, the client writes/returns `payload.session` with no runtime check. A wrong or compromised endpoint body becomes in-memory (and persisted) auth.

**Fix direction:** Export or share `isAuthSession`; reject before `writeSecureSession`. Consider requiring non-empty `syncToken` for new logins if sync is expected.

---

### 3. Web persists long-lived bearer `syncToken`

**Where:** `lib/auth/secure-session-store.ts` (web branch uses AsyncStorage / localStorage)

**Problem:**  
`SYNC_TOKEN_TTL_MS` is 30 days (`apps-script/Code.gs`). On web, XSS can steal the bearer and push/pull until expiry or `SYNC_SECRET` rotation. Native SecureStore is fine.

**Fix direction (pick one):** Shorter web TTL; memory-only token on web; HttpOnly cookie / different web auth; document + accept risk for beta only.

---

### 4. Allowlist disable does not clear UI auth

**Where:**  
- Cache short-circuit: `googleSheetAuth.restoreSession` returns unexpired cache without sheet re-check  
- Sync: `lib/sync/index.ts` ~91 — `not-approved` / `disabled` → status `needs-sign-in` only

**Problem:**  
Disabled/removed users can remain UI-signed-in until Google `expiresAt` (~1h). Sync stops, but `authSession` is not cleared and secure storage is not wiped.

**Fix direction:** On sync `not-approved` / `disabled`, clear secure session and set `authSession` to null (wire from sync status → App, or clear inside auth gateway). Optionally shorten trust window for cached sessions.

---

### 5. Web session restore vs 30-day sync token

**Where:**  
- `restoreSession` treats `expiresAt` (Google ID token exp) as session life  
- `getSilentGoogleIdToken` on web always returns `null` (`google-id-token.web.ts`)

**Problem:**  
After ~1 hour, web always signs out even when `syncToken` is still valid. UX is “signed out on refresh” while sync credentials could still work.

**Fix direction:** Decide product rule: either (a) restore using `syncToken` validity on web, or (b) keep ~1h UX but document it and stop implying 30-day web sessions. Align `expiresAt` with the credential that actually gates restore.

---

### 6. Guest / name path leaves Google session on disk

**Where:** `components/Login.tsx` — name submit and “Continue as guest” call `onLoggedIn(..., null)` without clearing auth storage

**Problem:**  
If a Google session was persisted and the user later lands on Login with a cleared profile (or chooses guest), the secure/local session blob can still exist and restore later unexpectedly.

**Fix direction:** On guest/name login (or whenever `session === null` is chosen intentionally), call `googleSheetAuth.signOut()` / `clearSecureSession` before continuing.

---

### 7. Sign-out vs in-flight sync race

**Where:** `App.tsx` `signOut`; `lib/sync/index.ts` `syncSessions` / `resetSyncState`

**Problem:**  
`signOut` does not cancel an in-flight `syncSessions`. A late `replaceAllSessions` / push can run after `clearSecureSession`. While in-flight, new calls only overwrite `queued` and return the old promise — a sign-out (`null`) can be lost or callers can resolve with a stale run.

**Fix direction:** Generation/abort token in the sync engine; ignore stale runs; always queue latest auth including `null`; make `resetSyncState` invalidate in-flight work.

---

### 8. Guest history attaches to next Google account

**Where:** `lib/sync/index.ts` — when `state.email === null`, first signed-in email owns local rows

**Problem:**  
Shared-device guest study data uploads into the next allowlisted login. Architecture doc currently treats this as intentional (“Guest sessions upload on first sign-in”).

**Fix direction:** Confirm product intent. If unsafe: require explicit “upload local history” consent, or keep guest rows under a guest key and never auto-merge.

---

### 9. Hardcoded spreadsheet ID

**Where:** `apps-script/Code.gs` `DEFAULT_SPREADSHEET_ID`; README may link the same sheet

**Problem:**  
Repo contains the beta Users spreadsheet id. If ACL is ever “anyone with link”, allowlist emails leak.

**Fix direction:** Require `SPREADSHEET_ID` script property only; remove default from source; confirm sheet is admin-private.

---

### 10. Doc trust-model drift

**Where:** `DOCs/google-sheet-login-architecture.md` (~line 24: “holds no secrets”)

**Problem:**  
Session blob includes `syncToken`, a bearer secret. Misleading for ops / future agents.

**Fix direction:** Update the trust model section to match reality (native SecureStore vs web localStorage + bearer).

---

## Suggested PR split

1. **Validate + clear auth** — issues 2, 4, 6  
2. **Sync race / generation** — issue 7  
3. **Apps Script token verify** — issue 1  
4. **Web session / token storage policy** — issues 3, 5  
5. **Guest upload consent or keep-as-is docs** — issue 8  
6. **Repo hygiene + docs** — issues 9, 10  

## Out of scope / do not break

- Guest-first PRD: do not wall the timer behind Google.  
- CORS simple request: keep `Content-Type: text/plain` for Apps Script POSTs.  
- Lazy native Google SDK load (Expo Go / guest must not crash on import).  
- `AuthGateway` / `SyncGateway` seams — adapters can change; callers should not.

## Quick file map

```
lib/auth/
  index.ts
  types.ts
  google-sheet-auth.ts      # authorize, restoreSession, signOut
  secure-session-store.ts   # SecureStore / web storage + isAuthSession
  google-id-token.ts        # native
  google-id-token.web.ts    # GIS; no silent refresh
components/Login.tsx
components/GoogleSignInButton{,.web}.tsx
App.tsx                     # restore, sync on active, signOut
lib/sync/index.ts           # syncSessions queue, resetSyncState
lib/sync/sheet-gateway.ts
apps-script/Code.gs         # login + token verify + syncToken
apps-script/Sync.gs
```

## Open question for humans

Is the beta Users spreadsheet ACL strictly private to admins (not link-viewable)? Affects urgency of issue 9.
