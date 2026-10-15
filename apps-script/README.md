# Google Sheet login backend

This Apps Script verifies Google ID tokens and uses a private Google Sheet as an access allowlist. The mobile app never reads the sheet directly.

## 1. Create the sheet

Create a private spreadsheet with a worksheet named `Users`. Row 1 must contain these exact headers:

| email | status | display_name | role | avatar |
|---|---|---|---|---|
| student@example.com | active | Student | student | 🐱 |

- Normalize email addresses to lowercase.
- `status` must be `active` to grant access. Any other value denies login.
- Keep the spreadsheet private and shared only with administrators.
- Before deployment, open **Share** and confirm **General access: Restricted** and that every listed person is an administrator. Remove link-wide access and non-admin sharing before using the sheet for login or sync.
- Never put passwords, OAuth tokens, API keys, or signing secrets in the sheet.

## 2. Create the Apps Script project

Create a standalone Apps Script project and copy in `Code.gs` and `appsscript.json`. In **Project Settings → Script properties**, add:

- `SPREADSHEET_ID` (required): the ID between `/d/` and `/edit` in your private sheet URL. Login and sync use this script property only; there is no default or bound-sheet fallback. If it is missing or blank, requests that read the sheet fail with `not-configured`. Keep the actual ID out of source and public documentation.
- `GOOGLE_WEB_CLIENT_ID`: the Web OAuth client ID used by the Expo app.
- `SYNC_SECRET`: a long random string (e.g. `openssl rand -base64 48`) used to HMAC-sign the 30-day sync tokens issued at login. Required: without it login and sync both fail with `not-configured`. Rotating it invalidates every issued sync token at once; users get a new token on their next login.

The script calls Google's `tokeninfo` endpoint using an HTTPS POST with `id_token` in the form body, then validates the token audience, issuer, expiration, and verified-email flag before reading the allowlist. The token is never included in the URL, and redirects are rejected. Google [documents POST support](https://developers.google.com/identity/openid-connect/reference#tokeninfo-endpoint), but this debug-oriented endpoint can throttle or fail intermittently; replace it with public-key signature verification or a supported server library before production.

A successful login also returns `session.syncToken`. `push`/`pull` requests carry it instead of a Google ID token; the script checks its signature and expiry, then re-checks the `Users` sheet on every call, so disabling or removing a row stops sync immediately. Rotate `SYNC_SECRET` to revoke all tokens.

## 3. Deploy

Deploy as a Web app:

- Execute as: **Me**
- Who has access: **Anyone**

The endpoint is public by necessity, but it returns user data only after successful Google-token verification and allowlist approval. Copy the `/exec` URL into `EXPO_PUBLIC_AUTH_ENDPOINT`.

After changing Apps Script code, create a new deployment version. Editing code alone does not update an existing versioned deployment.

## 4. Configure Google OAuth and Expo

Create Web, iOS, and Android OAuth clients in one Google Cloud project.

**Web (works with only the Web client):** in the Web client, add every origin you run from to **Authorized JavaScript origins**, e.g. `http://localhost:8081` for `npm run web` and your deployed URL. Without it Google's button shows `origin_mismatch`. Then `npm run web`.

Set these app variables from `.env.example`:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_AUTH_ENDPOINT`

The Web client ID must exactly match the Apps Script `GOOGLE_WEB_CLIENT_ID` property because it is the expected ID-token audience.

Before generating native projects:

1. Replace the placeholder iOS bundle identifier in `app.json` with the final registered identifier.
2. Add the final Android package to `app.json` and register its package/SHA-1 pair in Google Cloud.
3. Set `GOOGLE_IOS_URL_SCHEME` to the reversed iOS client ID. `app.config.js` adds the Google Sign-In plugin when this variable is present.

Then create a development build with `npm run ios` or `npm run android`. Native Google Sign-In does not run in Expo Go; there the button explains this instead of crashing the app.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Google login has not been configured for this build." | `EXPO_PUBLIC_AUTH_ENDPOINT` / `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` missing from `.env.local`. Restart `expo start` after editing it. |
| "…needs a development build…" | Running in Expo Go. Use `npm run web`, or a dev build. |
| Google button error `origin_mismatch` (web) | Origin not in the Web client's Authorized JavaScript origins. |
| "…Register an Android OAuth client…" | Android `DEVELOPER_ERROR`: no Android client for this package + SHA-1. |
| "The login server returned an invalid response." | Wrong `/exec` URL, or the deployment is not "Anyone". |
| "This token belongs to a different app." | Script property `GOOGLE_WEB_CLIENT_ID` differs from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. |
| "This Google account does not have access yet." | Email not in the `Users` sheet, or the Google account is not a test user on the consent screen. |

## Operational limits

This backend is intended for a small closed user group. Apps Script quotas, latency, and limited operational controls make it unsuitable as a durable public authentication backend. The sheet is an authorization registry and, through `Sync.gs`, a temporary store for synced study sessions until the Supabase migration.

## Current deployment

- Google Cloud project: `study-timer-509421`. OAuth consent screen is External, in Testing mode, with test user `syoung3323@gmail.com`. Only the Web OAuth client exists. iOS and Android clients wait for a real bundle ID (currently the placeholder `com.anonymous.study-timer`).
- Apps Script project `study-timer-auth` is bound to the "Study timer Login" sheet rather than standalone. This works because `Code.gs` opens the sheet with `openById`.
- Script properties: `GOOGLE_WEB_CLIENT_ID` is set. Set `SPREADSHEET_ID` explicitly before deploying this version of `Code.gs` and `Sync.gs`; deployments that relied on the former source default must add it. `SYNC_SECRET` must also be set for login and sync. Missing spreadsheet or sync configuration fails with `not-configured`. Confirm the sheet is admin-private using the sharing check above; repository changes cannot verify its live ACL.
- Deployment: Web app, Execute as Me, Access Anyone, version 2+ (sync). The manifest needs the full `spreadsheets` scope because Sync.gs writes the `Sessions` tab. The `/exec` URL lives in the local `.env.local` as `EXPO_PUBLIC_AUTH_ENDPOINT`.
- To ship code changes, use **Deploy → Manage deployments → edit (pencil) → Version: New version**. This keeps the `/exec` URL the same. **New deployment** creates a new URL instead.
- Smoke test: `curl -sL <exec-url>` returns `{"ok":true,"name":"study-timer-auth"}`. `curl -sL -d '{"action":"login","idToken":"bad"}' <exec-url>` returns `ok:false` with code `provider-error`. Don't pass `-X POST`: it keeps POST across Apps Script's 302 redirect and returns a Drive "Page Not Found" page.
