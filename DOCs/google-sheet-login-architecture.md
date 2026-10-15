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
3. Apps Script asks Google's `tokeninfo` endpoint to validate it using an HTTPS POST form body, keeping the ID token out of the URL. Redirects are rejected. This beta backend still depends on the debug-oriented endpoint; production should use signature verification with Google's public keys or a supported server library.
4. Apps Script independently checks audience, issuer, expiration, and verified email.
5. Only then does Apps Script look up the normalized email in the private `Users` worksheet.
6. The app stores the approved session, including user metadata, expiration, and the `syncToken` bearer secret. Native builds use platform SecureStore; web uses AsyncStorage backed by localStorage because SecureStore is unavailable there. Web storage is readable by JavaScript running on the app's origin, so an XSS vulnerability can expose the sync token and allow sync access as that user until the token expires or is revoked.

The spreadsheet and Apps Script configuration are never bundled into the app. Public Expo variables contain only the web endpoint and OAuth client identifiers, not secrets.

## Session behavior

Fresh login responses must contain a valid session before the app saves or returns them. Login and cached-session reads share the same `isAuthSession` shape check; malformed login responses fail with `invalid-response`. The `syncToken` remains optional for compatibility with sessions created before sync existed.

A cached session is accepted until one minute before the Google token expiration. After expiration, native builds use Google silent sign-in and recheck the sheet; the web build has no silent refresh and shows the sign-in button again. Any restore failure resolves to "signed out" rather than blocking the loading screen. When a sync pull or push rejects access with `not-approved` or `disabled`, its status includes that error code and App immediately clears in-memory Google auth and calls the auth gateway's sign-out to wipe the persisted session. The local profile and history remain available for guest use. Missing sync tokens and transient sync failures do not trigger this revocation. Until a sync detects the change, cached auth keeps its existing expiration window. Explicit sign-out clears SecureStore even if the Google SDK or network is unavailable.

Choosing name-only login or "Continue as guest" awaits the same sign-out before saving the local profile and entering guest mode, so an earlier persisted Google session cannot restore on the next launch. Guest mode remains available without Google configuration or the native SDK.

Login also issues a sync token that lasts 30 days, but every push/pull call re-checks the sheet, so disabling or removing a row stops sync immediately. Rotating the `SYNC_SECRET` script property revokes all issued sync tokens.

Sign-out invalidates the sync generation before clearing auth storage. Late responses cannot start further local writes or pushes, update cursors, or publish success/error status. Reset waits for already-issued local writes before clearing sync timestamps and preserves the last account owner; it does not wait for network responses. Requests already sent to the gateway cannot be retracted. Overlapping sync callers await the latest queued auth state, including signed-out (`null`), while same-account sync triggers remain single-flight.

## Current scope

- Google login and sheet allowlist.
- Guest use remains available.
- Study-session history syncs through the same Apps Script (`Sync.gs`, `Sessions` tab) via `lib/sync` (`SyncGateway` seam, pull-then-push, last-write-wins by `updatedAt`, tombstones for deletes). Guest sessions upload on first sign-in; a different account signing in on the same device drops the previous account's local rows instead of uploading them.
- Profile, inventory and settings remain device-local; see `DOCs/sync-remaining-state.md` for what to sync next.
- Web, iOS and Android. The web build POSTs as `text/plain` so the request stays a CORS simple request (Apps Script cannot answer a preflight).
- The sheet is a closed-beta backend. Move to Supabase (`DOCs/prd-login-and-sync.md`) before real users; only `SyncGateway` and `AuthGateway` adapters change.
