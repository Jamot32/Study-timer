# Google Sheet Login Architecture

## Decision

Google authenticates identity. A private Google Sheet authorizes verified email addresses. No application passwords are stored or processed.

## Module seam

The app depends only on `AuthGateway` from `lib/auth/types.ts`:

- `restoreSession()`
- `signInWithGoogle()`
- `signOut()`

`google-sheet-auth.ts` is the current adapter. This keeps Apps Script and sheet details out of screens and allows a future Supabase/Firebase adapter to replace it without changing callers.

## Trust model

1. The native Google SDK returns an ID token.
2. The app sends that token to Apps Script over HTTPS.
3. Apps Script asks Google's token verification endpoint to validate it.
4. Apps Script independently checks audience, issuer, expiration, and verified email.
5. Only then does Apps Script look up the normalized email in the private `Users` worksheet.
6. The app stores the approved, short-lived session metadata in platform SecureStore.

The spreadsheet and Apps Script configuration are never bundled into the app. Public Expo variables contain only the web endpoint and OAuth client identifiers, not secrets.

## Session behavior

A cached session is accepted until one minute before the Google token expiration. After expiration, the adapter uses Google silent sign-in and rechecks the sheet. Disabling a sheet row therefore takes effect no later than the current short-lived session expiration. Explicit sign-out clears SecureStore even if the Google SDK or network is unavailable.

## Current scope

- Google login and sheet allowlist only.
- Guest use remains available.
- Profiles and study sessions remain device-local.
- Session-history cloud sync is deliberately not implemented by this module.
- Native iOS/Android only; Apps Script ContentService is not a suitable CORS backend for the Expo web build.
