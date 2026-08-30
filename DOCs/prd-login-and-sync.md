# PRD: Login & Cloud Sync

**Product:** Study Timer (Expo / React Native, iOS + Android)
**Status:** Draft
**Scope:** v1 — optional account via Apple/Google sign-in, with session history synced and backed up to the cloud
**Prior art:** [PRD: Session History & Time Dashboard](prd-sessions-and-dashboard.md) — this spec is the "Cloud sync" item that PRD deferred to P2. Its session schema (`lib/sessions.ts`) was deliberately built for this: stable `id`, `updatedAt`, `deletedAt`, `schemaVersion`. That schema is the design contract here, not something to re-derive.

---

## Problem Statement

Study history lives only in AsyncStorage on one device. Reinstall the app, lose the phone, or get a new one, and every session is gone with no warning and no recovery — the same data loss the sessions PRD set out to eliminate, just moved one level up. A user who studies daily for six months is accumulating the exact record that makes the app worth keeping, and that record is one device wipe from zero. Users on more than one device (phone + tablet) also see two disjoint, wrong histories with no way to reconcile them.

## Goals

1. **History survives the device.** A signed-in user who reinstalls or switches devices recovers their full session history. Target: 100% of sessions present after restore in QA; zero reported loss in the first 30 days post-launch.
2. **Local history is never lost at sign-in.** Sessions created while signed out are uploaded and merged on first sign-in, not overwritten or discarded.
3. **Signed-out users are unaffected.** The app remains fully functional with no account. Median cold-launch-to-running-timer stays ≤3s, unchanged from the pre-release baseline.
4. **Sign-in is quick and rarely fails.** ≥95% sign-in attempt success rate; median time from tapping "Sign in" to a synced dashboard under 15 seconds.
5. **Sync is invisible when it works and honest when it doesn't.** The user can always tell whether their data is backed up.

## Non-Goals

- **Email/password and magic-link sign-in.** v1 is Apple and Google only. Passwords bring reset flows, credential storage, and strength rules for a minority of users; adding a provider later is cheap if the account model is provider-agnostic from day one.
- **Real-time / live multi-device sync.** Sync runs on app foreground, after a session is saved, and on manual pull-to-refresh. Push-based live updates are not worth a socket layer for a single-user study log.
- **Account deletion self-service beyond the legal minimum.** v1 ships in-app account deletion because the App Store requires it for apps with account creation — but not data-export tooling, partial deletion, or retention settings.
- **Sharing, social, leaderboards, friends.** An account enables these later; none of them ship here. They would change the data model's privacy assumptions and deserve their own spec.
- **Syncing settings.** `lib/settings.ts` (week start, minimum session length) stays device-local in v1. Small payoff, extra conflict surface.
- **Offline write queue with retry semantics beyond "try again next foreground."** Sessions are already durable locally; the sync layer can be simple and eventually-consistent.

## User Stories

**Primary — the long-term studier**

1. As someone with months of study history, I want to sign in so that my record is backed up and I stop worrying about losing my phone.
2. As someone setting up a new phone, I want to sign in and see my full history restored so that my streak and totals continue uninterrupted.
3. As someone who has been using the app signed out, I want the sessions I already logged to be kept when I sign in so that signing in never costs me data.
4. As someone studying on a phone and a tablet, I want a session finished on one to appear on the other so that my totals are correct wherever I look.

**Secondary**

5. As a privacy-minded user, I want to keep using the app without an account so that I am not forced to hand over an identity to time myself.
6. As a signed-in user, I want to see whether my data is currently backed up so that I know if something is silently broken.
7. As a signed-in user, I want to sign out, and I want to be told plainly what happens to the data on this device.
8. As a user who no longer wants an account, I want to delete it and my synced data from inside the app.

**Edge cases**

9. As someone with no internet, I want to keep timing and finishing sessions so that connectivity is never a prerequisite for studying.
10. As someone whose sign-in fails or is cancelled, I want to land back where I was with nothing broken and a clear reason.
11. As someone who signs in on a second device that already has local sessions, I want both sets merged, not one replaced.
12. As someone who deleted a session on one device, I want it to stay deleted everywhere.

## Requirements

### Must-Have (P0)

**P0-1 — Optional account, guest-first**
The app launches into the timer with no account, exactly as today. Sign-in is offered from Settings and (once) from a dismissible dashboard prompt.

- [ ] Given a cold launch with no account, when the app opens, then the timer screen is shown with no auth wall or blocking modal
- [ ] Given no account, when the user starts, finishes, and reviews sessions, then every existing feature works unchanged
- [ ] Given the user dismisses the sign-in prompt, then it is not shown again automatically

**P0-2 — Sign in with Apple and Google**
Both providers on both platforms. Apple is required on iOS by App Store Guideline 4.8 because Google sign-in is offered.

- [ ] Given the sign-in screen, when the user taps Sign in with Apple, then the native Apple flow runs and returns to a signed-in state
- [ ] Given the sign-in screen, when the user taps Google, then the OAuth flow runs and returns to a signed-in state
- [ ] Given the user cancels the provider flow, when they return to the app, then they are signed out, on the screen they started from, with no error shown
- [ ] Given the provider flow fails (network, revoked consent, provider outage), then a specific, actionable error is shown and the app remains fully usable signed-out
- [ ] Given a user who signs in with Apple's "Hide My Email", then the account is created successfully and no feature depends on a real email address
- [ ] Auth tokens are stored in the platform keychain/keystore, never in AsyncStorage

*Technical note:* see **Technical Design** below for the concrete provider setup. `lib/sessions.ts` exports a single `storage` shim over AsyncStorage — tokens must not go through it.

**P0-3 — First sign-in merges local history**
This is the highest-risk requirement in the spec. Local sessions created while signed out belong to the user and must survive.

- [ ] Given N local sessions and a brand-new account, when the user signs in, then all N sessions are uploaded and remain visible; totals before and after sign-in are identical
- [ ] Given local sessions and an existing account with remote sessions, when the user signs in, then the merged set is the union of both, deduplicated by session `id`
- [ ] Given the merge fails or is interrupted, then local sessions are left untouched and the user can retry; local data is never deleted as part of sign-in
- [ ] Given the merge is in progress, then the UI shows it is running and the timer remains usable

**P0-4 — Ongoing sync**
Sync triggers: app foreground, after a session is saved, and manual pull-to-refresh on the dashboard.

- [ ] Given a signed-in user finishes a session, when connectivity is available, then the session appears on a second signed-in device after that device's next sync
- [ ] Given a session is soft-deleted (`deletedAt` set) on one device, when the other device syncs, then the session is hidden there too and does not reappear
- [ ] Given the same session `id` exists on both sides with different `updatedAt`, then the later `updatedAt` wins (last-write-wins per session record)
- [ ] Given no connectivity, when the user finishes a session, then it saves locally as today and syncs on the next successful attempt
- [ ] Sync never blocks the timer, the Finish action, or navigation

**P0-5 — Sync status is visible**
- [ ] Given a signed-in user, then the account area shows the last successful sync time and the current state: synced / syncing / offline / error
- [ ] Given the last sync failed, then the error state is shown with a manual retry
- [ ] Given the user is signed out, then no sync status or false "backed up" impression is presented anywhere

**P0-6 — Sign out**
- [ ] Given a signed-in user, when they sign out, then they are told explicitly what happens to session data on this device before confirming
- [ ] Given unsynced local changes, when the user attempts to sign out, then they are warned before proceeding
- [ ] Given sign-out completes, then auth tokens are cleared from secure storage and the app returns to full signed-out functionality

**P0-7 — Account deletion**
Required by App Store Guideline 5.1.1(v) for any app that supports account creation.

- [ ] Given a signed-in user, when they choose Delete account, then a confirmation states that synced data is permanently removed and cannot be recovered
- [ ] Given deletion completes, then server-side account and session data are deleted and the app returns to a signed-out state
- [ ] The user is told, before confirming, whether local device history is kept or removed (proposed: kept — deleting the account should not destroy the record on the device in hand)

**P0-8 — Privacy disclosure**
- [ ] A privacy policy URL is reachable from the sign-in screen and from Settings
- [ ] App Store / Play data-safety declarations are updated to cover the identifier and study-session data now leaving the device

### Nice-to-Have (P1)

**P1-1 — Restore progress detail.** On a fresh install sign-in, show "restoring N sessions" rather than an indeterminate spinner.
**P1-2 — Link a second provider.** Sign in with Apple on iOS and Google on Android and land on the same account. Requires email-based account linking, which "Hide My Email" complicates — hence P1, not P0.
**P1-3 — Sync settings too.** Week start and minimum session length follow the account.
**P1-4 — Background sync** on a periodic task rather than only on foreground.
**P1-5 — Data export (JSON/CSV)** from the account screen. Pairs naturally with account deletion and answers "let me take my data."

### Future Considerations (P2)

Not built now, but v1 must not preclude them:

- **Email / magic-link sign-in.** Keep the account record provider-agnostic — a user has an account with one or more linked identities, rather than an account keyed on "the Apple account."
- **Shared or social features.** Keep a clear boundary between the account record and session records so a future visibility/permission field has an obvious home.
- **Server-side aggregation** (streaks, cross-device stats computed remotely). Keep the aggregation functions in `lib/sessions.ts` pure over a session array so the same logic can run either side.
- **Non-stopwatch session types.** The `type` discriminator already exists in the schema; the sync layer must round-trip unknown future fields rather than dropping them.

## Technical Design

**Decision: Supabase.** Postgres for the session table, Supabase Auth for Apple/Google via native ID tokens, and Row Level Security as the entire authorization layer. Chosen over Firebase because the existing `StudySession` shape is a flat relational row with a natural primary key, and over a custom API because there is no server-side logic here worth owning — the whole backend is one table, one policy, and two RPC-free queries. This settles what was the blocking backend question; the rest of this section is the contract Phase 1 and 2 build against.

### Dependencies to add

| Package | Why |
|---|---|
| `@supabase/supabase-js` | Client, auth, and PostgREST queries |
| `expo-secure-store` | Keychain/Keystore-backed session persistence (P0-2) |
| `expo-apple-authentication` | Native Sign in with Apple, returns an identity token |
| `@react-native-google-signin/google-signin` | Native Google sign-in, returns an ID token (see Open Questions) |
| `expo-crypto` | SHA-256 of the Apple nonce; `randomUUID` for the raw nonce |
| `expo-dev-client` + EAS Build | **Blocker for Phase 1** — all three auth modules are native. The app currently has no `ios.bundleIdentifier` or `android.package` in `app.json` and cannot run these in Expo Go. |
| `react-native-url-polyfill` | `supabase-js` needs it on React Native |

### Database schema

One table. Column names are snake_case per Postgres convention; the sync layer maps to the existing camelCase `StudySession` type — no change to `lib/sessions.ts`'s public shape.

```sql
create table public.sessions (
  id            uuid primary key,                    -- client-generated, matches StudySession.id
  user_id       uuid not null references auth.users(id) on delete cascade,
  started_at    timestamptz not null,
  ended_at      timestamptz not null,
  duration_ms   bigint not null check (duration_ms >= 0),
  subject       text,
  type          text not null default 'stopwatch',
  source        text not null default 'timer',
  schema_version int  not null default 1,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz                          -- soft delete; rows are never hard-deleted
);

create index sessions_user_updated_idx on public.sessions (user_id, updated_at);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);

alter table public.sessions enable row level security;

create policy "own rows" on public.sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Notes that are requirements, not commentary:

- **`id` is client-generated and is the merge key.** `generateId()` in `lib/sessions.ts` currently falls back to a non-UUID string when `crypto.randomUUID` is missing — that fallback breaks a `uuid` column. It must be replaced with `expo-crypto`'s `randomUUID()` before Phase 2, and existing local ids of the fallback shape must be migrated (regenerate id, keep everything else) as part of the first-sign-in merge.
- **`on delete cascade` from `auth.users`** is what makes P0-7 account deletion a single call rather than a cleanup job.
- **No hard deletes ever.** A hard delete on one device is invisible to the other; only `deleted_at` propagates.
- **`updated_at` is set by the server**, not trusted from the client, via a `before update`/`before insert` trigger setting `new.updated_at = now()`. Client clocks drift and a wrong clock would poison last-write-wins.

### Auth flow

Both providers use the ID-token path — no browser redirect, no deep-link handling, no `expo-auth-session` state:

```ts
// Apple (iOS only — the button is hidden on Android)
const rawNonce = Crypto.randomUUID();
const hashedNonce = await Crypto.digestStringAsync(SHA256, rawNonce);
const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [FULL_NAME, EMAIL],
  nonce: hashedNonce,          // Apple gets the hash...
});
await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: credential.identityToken,
  nonce: rawNonce,             // ...Supabase gets the raw value
});

// Google
const { data } = await GoogleSignin.signIn();
await supabase.auth.signInWithIdToken({ provider: 'google', token: data.idToken });
```

Configuration required: Apple Service ID + key uploaded to the Supabase Apple provider; Google iOS, Android, and Web client ids (the Web client id is the audience Supabase validates against).

**Token storage (P0-2).** `supabase-js` is constructed with a SecureStore adapter:

```ts
createClient(url, anonKey, {
  auth: { storage: SecureStoreAdapter, autoRefreshToken: true,
          persistSession: true, detectSessionInUrl: false },
});
```

SecureStore warns above 2048 bytes and a Supabase session with a fat JWT can exceed it, so the adapter chunks values across `key.0`, `key.1`, … Do not fall back to AsyncStorage on overflow.

**Keys and config.** The Supabase URL and *anon* key ship in the bundle via `EXPO_PUBLIC_` env vars — they are publishable by design and RLS is the actual guard. The `service_role` key must never appear in the app, in `app.json`, or in the repo.

### Sync algorithm

Delta by watermark, in one file (`lib/sync.ts`). Roughly 100 lines; it is deliberately dumb.

1. **Push.** Read local sessions whose `updatedAt` is newer than `lastPushedAt`; `upsert` them in one call keyed on `id`. Soft deletes are ordinary rows with `deleted_at` set — no special path.
2. **Pull.** `select * from sessions where updated_at > lastPulledAt order by updated_at` (paged, 500 rows). Merge into local storage by `id`: the row with the later `updated_at` wins, whole-record. Rows arriving with `deleted_at` set overwrite the local copy and disappear from the UI via the existing `deletedAt === null` filters.
3. **Watermark.** `lastPulledAt` is the max `updated_at` **returned by the server**, never a local clock reading, and is stored in AsyncStorage alongside the sessions key. A missing watermark means a full pull — which is also the fresh-install restore path, so there is only one code path to test.
4. **Triggers.** App foreground, after `finish()` saves a session, and pull-to-refresh. Never on an interval, never blocking the UI.

**First sign-in merge (P0-3)** is the same algorithm with the watermark unset and one extra guarantee: the push completes before local state is touched, and a failure at any point leaves AsyncStorage byte-identical. Nothing about sign-in ever deletes local rows.

### File layout

| File | Contents |
|---|---|
| `lib/supabase.ts` | Client construction, SecureStore adapter |
| `lib/auth.ts` | `signInWithApple()`, `signInWithGoogle()`, `signOut()`, `deleteAccount()`, session state hook |
| `lib/sync.ts` | Push/pull/merge, watermark, sync status |
| `lib/sessions.ts` | Unchanged public API; `generateId()` switched to `expo-crypto` |
| `components/Account.tsx` | Sign-in buttons, sync status, sign out, delete account — rendered inside the existing Settings tab |

Account deletion needs the one piece of server code in the project: an Edge Function calling `auth.admin.deleteUser(uid)` with the service-role key, since a client cannot delete its own `auth.users` row. The cascade above removes the session rows.

### Self-check

Following `lib/self-check.mjs`, the merge logic ships with an assert-based check covering: local-only rows survive a merge, remote-only rows arrive, same-`id` conflicts resolve to the later `updated_at`, a tombstone beats an older live row, and an older live row does **not** resurrect a newer tombstone.

---

## Success Metrics

**Leading (days to weeks)**
- **Sign-in success rate:** ≥95% of started provider flows reach a signed-in state (cancellations excluded). Measured at 2 weeks.
- **Merge integrity:** 100% — session count and total duration before first sign-in equal the values after. Any discrepancy is a P0 bug, not a metric to trend.
- **Account creation among engaged users:** ≥25% of users with ≥5 saved sessions create an account within 30 days.
- **Cold-launch-to-timer unchanged:** median stays ≤3s versus the pre-release baseline, for both signed-in and signed-out users.
- **Sync error rate:** <2% of sync attempts end in a surfaced error state.

**Lagging (weeks to months)**
- **Cross-device usage:** % of accounts with sessions from 2+ devices — the direct evidence sync is doing something users wanted.
- **Retention lift:** D30 retention for signed-in users versus signed-out, controlling for pre-sign-in engagement.
- **Reinstall recovery:** number of accounts that restore history on a fresh install. Low absolute numbers are fine; each one is the feature paying for itself.
- **Support/review mentions of data loss:** trending to zero.

## Open Questions

**Resolved**
- **Google sign-in library:** `@react-native-google-signin/google-signin` — native ID-token flow, matching the Apple path. Cost: a config plugin and iOS / Android / Web client ids.
- **Supabase project ownership:** owned and paid for by the project owner (syoung3323@gmail.com). A paid tier is required before launch so the project does not pause on inactivity.
- **Privacy policy:** written and hosted by the project owner. Still a hard gate on store submission (P0-8).
- **Account deletion and local data:** deleting the account does **not** wipe local device history. Only synced server data is removed; the record on the device in hand survives. Confirmation copy must say exactly this.

**Blocking**
- *(Engineering)* Apple Developer Program membership and an `ios.bundleIdentifier` / `android.package` must exist before Phase 1 — Sign in with Apple cannot be built or tested without them, and none are configured today. Nothing else in Phase 1 can start first.

**Non-blocking**
- *(Engineering)* Is last-write-wins per record sufficient, or do we need field-level merge? For an append-mostly log of immutable sessions, LWW looks adequate — confirm once editing (P1 of the prior PRD) is on the table.
- *(Engineering)* Supabase region — pick the one nearest the user base; changing it later means a project migration.
- *(Engineering)* Retention for tombstones: `deleted_at` rows accumulate forever. Not a real problem until years of use, but decide before it is.
- *(Design)* Where does the sign-in prompt live — Settings only, or a dismissible dashboard card? How aggressive should it be?
- *(Design)* What does the dashboard show mid-restore: empty state, skeleton, or local-only data with a "syncing" badge?
- *(Engineering)* Device identity for the cross-device metric — do we store a device id per session, or infer it? Adds a field to the schema if yes.
- *(Data)* Which analytics tool records sign-in funnel and sync errors? None is instrumented today; the leading metrics above are unmeasurable without one.

## Timeline Considerations

No hard external deadline. The store-review requirements (P0-7 account deletion, P0-8 privacy disclosure) are hard gates on submission, not on development — but they are frequent rejection causes, so they are P0 rather than fast-follows.

Suggested phasing, each phase independently shippable:

**Phase 1 — Auth only.** P0-1, P0-2, P0-6. A user can sign in and out; nothing syncs yet. Nothing is user-visible beyond an account screen, so this can ship dark or behind a flag. Validates the provider flows and secure token storage in isolation, before any data is at risk.

**Phase 2 — Sync and merge.** P0-3, P0-4, P0-5. The phase that carries the actual risk. P0-3 (merge) deserves disproportionate test effort: it is the one place where a bug destroys history the app promised to keep.

**Phase 3 — Store compliance and launch.** P0-7, P0-8. Must land before submission.

**Phase 4 — Fast follows.** P1 items, prioritized by what breaks first (likely P1-2 provider linking, once users hit "I signed in with Google on Android and Apple on iOS and now have two accounts").

**Dependencies:** Phase 1 cannot start until the Apple Developer account and bundle identifiers exist (see Open Questions). Phase 3 cannot complete without the privacy policy. Nothing here blocks the prior PRD's P1 work — but P1-3 (delete a session) from that spec should ship before or with Phase 2, so soft-delete propagation is exercised by a real feature rather than only by tests.
