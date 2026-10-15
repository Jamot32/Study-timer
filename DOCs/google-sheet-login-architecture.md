# Google Sheet Login Architecture

## Decision

Google authenticates identity. A private Google Sheet authorizes verified email addresses. No application passwords are stored or processed.

## Module seam

The app depends only on `AuthGateway` from `lib/auth/types.ts`:

- `restoreSession()`
- `signInWithIdToken(idToken)`
- `signOut()`

`google-sheet-auth.ts` is the current adapter. Getting the Google ID token is platform-specific and lives in `google-id-token.ts` (native SDK, loaded lazily so Expo Go and guest mode never crash) and `google-id-token.web.ts` (Google Identity Services). `components/GoogleSignInButton{,.web}.tsx` hands the token to the gateway. This keeps Apps Script and sheet details out of screens and allows a future Supabase/Firebase adapter to replace it without changing callers.

## Trust model

1. The native Google SDK (iOS/Android) or Google Identity Services (web) returns an ID token for the Web client ID.
2. The app sends that token to Apps Script over HTTPS.
3. Apps Script asks Google's token verification endpoint to validate it.
4. Apps Script independently checks audience, issuer, expiration, and verified email.
5. Only then does Apps Script look up the normalized email in the private `Users` worksheet.
6. Native builds persist the approved session, including its bearer `syncToken`, in platform SecureStore. Web keeps the entire session in memory only for the page lifetime and removes any legacy auth-session blob from AsyncStorage/localStorage at startup.

The spreadsheet and Apps Script configuration are never bundled into the app. Public Expo variables contain only the web endpoint and OAuth client identifiers, not secrets.

## Session behavior

A cached session is accepted until one minute before the Google token expiration. After expiration, native builds use Google silent sign-in and recheck the sheet; the web build has no silent refresh and shows the sign-in button again. Reloading a web page always requires Google sign-in again because no auth session or sync token is persisted; guest use remains available. Any restore failure resolves to "signed out" rather than blocking the loading screen. Disabling a sheet row therefore takes effect no later than the current short-lived session expiration. Explicit sign-out clears the in-memory web session or native SecureStore even if the Google SDK or network is unavailable.

Login also issues a sync token that lasts 30 days, but every push/pull call re-checks the sheet, so disabling or removing a row stops sync immediately. Rotating the `SYNC_SECRET` script property revokes all issued sync tokens.

## Current scope

- Google login and sheet allowlist.
- Guest use remains available.
- Study-session history syncs through the same Apps Script (`Sync.gs`, `Sessions` tab) via `lib/sync` (`SyncGateway` seam, pull-then-push, last-write-wins by `updatedAt`, tombstones for deletes). Guest sessions upload on first sign-in; a different account signing in on the same device drops the previous account's local rows instead of uploading them.
- Profile, inventory and settings remain device-local; see `DOCs/sync-remaining-state.md` for what to sync next.
- Web, iOS and Android. The web build POSTs as `text/plain` so the request stays a CORS simple request (Apps Script cannot answer a preflight).
- The sheet is a closed-beta backend. Move to Supabase (`DOCs/prd-login-and-sync.md`) before real users; only `SyncGateway` and `AuthGateway` adapters change.
