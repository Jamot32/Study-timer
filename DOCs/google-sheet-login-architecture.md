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
6. Native builds persist the approved session, including its bearer `syncToken`, in platform SecureStore. Web keeps the entire session in memory only for the page lifetime and removes any legacy auth-session blob from AsyncStorage/localStorage at startup.

The spreadsheet and Apps Script configuration are never bundled into the app. Public Expo variables contain only the web endpoint and OAuth client identifiers, not secrets.

## Session behavior

Fresh login responses must contain a valid session before the app saves or returns them. Login and cached-session reads share the same `isAuthSession` shape check; malformed login responses fail with `invalid-response`. The `syncToken` remains optional for compatibility with sessions created before sync existed.

`AuthSession.expiresAt` is the Google ID token expiration (typically about one hour), not the sync token expiration.

- **Native:** a SecureStore session is accepted until one minute before `expiresAt`. After that, restore uses Google silent sign-in and rechecks the sheet. Any restore failure resolves to "signed out" rather than blocking the loading screen. When a sync pull or push rejects access with `not-approved` or `disabled`, its status includes that error code and App immediately clears in-memory Google auth and calls the auth gateway's sign-out to wipe the persisted session. The local profile and history remain available for guest use. Missing sync tokens and transient sync failures do not trigger this revocation. Until a sync detects the change, cached auth keeps its existing expiration window. Explicit sign-out clears SecureStore even if the Google SDK or network is unavailable.
- **Web:** `restoreSession()` always returns `null`, without reading cached credentials or attempting silent Google sign-in. Every page reload requires interactive Google sign-in again, even before `expiresAt` and even if a legacy stored `syncToken` remains valid. No cached identity is restored on its own. Guest/name use and local history remain available; a saved local profile is not Google authentication. During the current page lifetime, `expiresAt` does not trigger automatic sign-out; sync uses the in-memory `syncToken` and server authorization. Explicit sign-out clears the in-memory web session even if the Google SDK or network is unavailable.

Choosing name-only login or "Continue as guest" awaits the same sign-out before saving the local profile and entering guest mode, so an earlier persisted Google session cannot restore on the next launch. Guest mode remains available without Google configuration or the native SDK.

Login also issues a sync token valid for up to 30 days. This is a server credential lifetime, not a promise of a 30-day web session or reload restore. Every push/pull call re-checks the sheet, so disabling or removing a row stops sync immediately. Rotating the `SYNC_SECRET` script property revokes all issued sync tokens.

Sign-out invalidates the sync generation before clearing auth storage. Late responses cannot start further local writes or pushes, update cursors, or publish success/error status. Reset waits for already-issued local writes before clearing sync timestamps and preserves the last account owner; it does not wait for network responses. Requests already sent to the gateway cannot be retracted. Overlapping sync callers await the latest queued auth state, including signed-out (`null`), while same-account sync triggers remain single-flight.

## Current scope

- Google login and sheet allowlist.
- Guest use remains available.
- Study-session history syncs through the same Apps Script (`Sync.gs`, `Sessions` tab) via `lib/sync` (`SyncGateway` seam, pull-then-push, last-write-wins by `updatedAt`, tombstones for deletes). When sync has no account owner (`state.email === null`) and guest rows exist, it pauses before any pull/push and asks “Upload local study history to <email>?” This also applies to restored sign-ins. Upload accepts the existing merge/upload behavior; Keep local (including dismissing the dialog) persists those row IDs in `localOnlyIds` in `@study_timer/sync-state` alongside the account binding before sync proceeds. These rows remain in the local sessions store and visible in device history, but are excluded from account merges and uploads, including tombstones and later local edits. The exclusion survives restart and sign-out, and a different account signing in preserves local-only rows while dropping the previous account's syncable local rows. New sessions created after the choice sync normally to the signed-in account. There is no later upload action for declined rows in this scope; device history can therefore include both local-only and account rows. Existing sync state defaults to an empty exclusion list; rows already bound to an account are not reclassified. `AuthGateway` and `SyncGateway` interfaces are unchanged.
- Profile, inventory and settings remain device-local; see `DOCs/sync-remaining-state.md` for what to sync next.
- Web, iOS and Android. The web build POSTs as `text/plain` so the request stays a CORS simple request (Apps Script cannot answer a preflight).
- The sheet is a closed-beta backend. Move to Supabase (`DOCs/prd-login-and-sync.md`) before real users; only `SyncGateway` and `AuthGateway` adapters change.
