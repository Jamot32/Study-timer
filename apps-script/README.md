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
- Never put passwords, OAuth tokens, API keys, or signing secrets in the sheet.

## 2. Create the Apps Script project

Create a standalone Apps Script project and copy in `Code.gs` and `appsscript.json`. In **Project Settings → Script properties**, add:

- `SPREADSHEET_ID` (optional): the ID between `/d/` and `/edit` in the sheet URL. Defaults to the current beta sheet, [`13VRYsnBayobLLOEdLGvd8OoBUqSUIjGnHrDd0KxCn8I`](https://docs.google.com/spreadsheets/d/13VRYsnBayobLLOEdLGvd8OoBUqSUIjGnHrDd0KxCn8I/edit).
- `GOOGLE_WEB_CLIENT_ID`: the Web OAuth client ID used by the Expo app.

The script calls Google's `tokeninfo` endpoint, then validates the token audience, issuer, expiration, and verified-email flag before reading the allowlist.

## 3. Deploy

Deploy as a Web app:

- Execute as: **Me**
- Who has access: **Anyone**

The endpoint is public by necessity, but it returns user data only after successful Google-token verification and allowlist approval. Copy the `/exec` URL into `EXPO_PUBLIC_AUTH_ENDPOINT`.

After changing Apps Script code, create a new deployment version. Editing code alone does not update an existing versioned deployment.

## 4. Configure Google OAuth and Expo

Create Web, iOS, and Android OAuth clients in one Google Cloud project.

Set these app variables from `.env.example`:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_AUTH_ENDPOINT`

The Web client ID must exactly match the Apps Script `GOOGLE_WEB_CLIENT_ID` property because it is the expected ID-token audience.

Before generating native projects:

1. Replace the placeholder iOS bundle identifier in `app.json` with the final registered identifier.
2. Add the final Android package to `app.json` and register its package/SHA-1 pair in Google Cloud.
3. Set `GOOGLE_IOS_URL_SCHEME` to the reversed iOS client ID. `app.config.js` adds the Google Sign-In plugin when this variable is present.

Then create a development build with `npm run ios` or `npm run android`. Native Google Sign-In does not run in Expo Go.

## Operational limits

This backend is intended for a small closed user group. Apps Script quotas, latency, and limited operational controls make it unsuitable as a durable public authentication backend. Study sessions remain device-local; the sheet is only an authorization registry.

## Current deployment

- Google Cloud project: `study-timer-509421`. OAuth consent screen is External, in Testing mode, with test user `syoung3323@gmail.com`. Only the Web OAuth client exists. iOS and Android clients wait for a real bundle ID (currently the placeholder `com.anonymous.study-timer`).
- Apps Script project `study-timer-auth` is bound to the "Study timer Login" sheet rather than standalone. This works because `Code.gs` opens the sheet with `openById`.
- Script properties: `GOOGLE_WEB_CLIENT_ID` is set. `SPREADSHEET_ID` is not set, so `DEFAULT_SPREADSHEET_ID` in `Code.gs` is used.
- Deployment: Web app, Execute as Me, Access Anyone, version 1. The `/exec` URL lives in the local `.env.local` as `EXPO_PUBLIC_AUTH_ENDPOINT`.
- To ship code changes, use **Deploy → Manage deployments → edit (pencil) → Version: New version**. This keeps the `/exec` URL the same. **New deployment** creates a new URL instead.
- Smoke test: `curl -sL <exec-url>` returns `{"ok":true,"name":"study-timer-auth"}`. `curl -sL -d '{"action":"login","idToken":"bad"}' <exec-url>` returns `ok:false` with code `provider-error`. Don't pass `-X POST`: it keeps POST across Apps Script's 302 redirect and returns a Drive "Page Not Found" page.
