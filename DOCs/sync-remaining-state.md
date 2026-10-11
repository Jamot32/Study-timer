# Remaining State to Sync

**Scope:** read-only audit of everything the app persists on-device, other than study sessions, and what syncing each piece would take. Session sync (steps 1–6 of the sheet-sync plan) is covered elsewhere and only cross-referenced here.

**Method:** grep for `@study_timer`, `storage.setItem/getItem/removeItem`, `AsyncStorage`, `SecureStore` and `localStorage` across `lib/`, `components/` and `App.tsx`. Every persisted write goes through the single `storage` shim exported by `lib/sessions.ts`, or through `lib/auth/secure-session-store.ts`. No component writes storage directly.

## Inventory

| Key | Module | Holds | Derived from sessions? | `id` / `updatedAt` / `deletedAt` | Strategy now (Sheet) | Strategy later (Supabase) |
|---|---|---|---|---|---|---|
| `@study_timer/sessions` | `lib/sessions.ts` | `StudySession[]` | It *is* the log | yes / yes / yes | Per-item LWW (in flight, steps 1–6) | `sessions` table, per-row LWW |
| `@study_timer/inventory` | `lib/inventory.ts` | Wallet, items, ELO, arena, coupon state | **No** (but reads sessions, see below) | none / none / none | Whole-doc LWW + fresh-install guard (lossy for counters, documented) | Ledger table (event log) + derived balance; per-field for the rest |
| `@study_timer/profile` | `lib/profile.ts` | Name, avatar, title, frame, stickers | No | none / none / none | Whole-doc LWW | `profiles` row, LWW; image avatar in Storage bucket |
| `@study_timer/settings` | `lib/settings.ts` | `{ weekStartsOn }` | No | none / none / none | Do not sync (PRD non-goal) | Column on `profiles`, LWW (PRD P1-3) |
| `study-timer.auth-session.v1` | `lib/auth/secure-session-store.ts` | `AuthSession` (user, expiry, and after step 1 `syncToken`) | No | n/a | **Never sync** | **Never sync** |

Not state (listed so nobody adds them to the sync list later):

- `lib/wallet.ts` — compile-time constants (`PLAYER_COINS = 480`, `PLAYER_TROPHIES`). `PLAYER_COINS` is only the starting balance in `DEFAULT_INVENTORY`.
- `lib/history.ts` — undo/redo stack for the profile editor, in memory only.
- `lib/today.ts`, `lib/progress.ts` — level, streaks, achievements, minutes-today. Pure functions over sessions; they become correct on every device automatically once sessions sync.
- `lib/self-check.mjs` `setItem` calls — test harness seeding a mocked `localStorage`.

## Per-key detail

### `@study_timer/sessions`

Already Supabase-shaped (`id`, `updatedAt`, `deletedAt`, `schemaVersion`). Handled by steps 1–6. One gap found here, see Follow-ups: `clearSessions()` hard-deletes the key instead of tombstoning, so "Clear all history" would be undone by the next pull.

### `@study_timer/inventory` — the hard one

**Shape** (`Inventory` in `lib/inventory.ts`): one JSON document per device.

```
coins, honor, bankedBreak, rollTickets, winStreak, elo     numbers
items: Record<string, number>                              coupon/cosmetic counts
arenaId                                                    string
equipped: [string|null, string|null]                       coupon slots
firstBonusDay, ticketDay, secretShopDay                    'YYYY-MM-DD' | null
giftedArenas: string[], streakPatches: string[]            grow-only lists
capsule: { startDay } | null
compound: { startDay, settledThrough } | null
```

No `id`, no `updatedAt`, no `deletedAt`, no `schemaVersion`. Missing fields are migrated by spreading over `DEFAULT_INVENTORY` on load.

**Not derivable from sessions.** Every mutation is a read-modify-write of the balance (`buyItem`, `applyLedger`, `enterMatch`, `claimRoll`, `spendBagCoupon`, `creditCoins`, `recordDuel`, `settleDailyCoupons`, `debugSet`). Duel outcomes, ROLL rewards (including the random jackpot), shop purchases and entry fees are not logged anywhere, so the balance cannot be rebuilt from history. Once a delta is folded in, it is gone.

**But it depends on sessions.** `settleDailyCoupons` (capsule, compound, streak anchor), `studyStreakNow`, and the session payout in `components/StudyTimer.tsx` (soft cap via `studiedMinutesToday`, `firstBonusDay`) all read the session log. So once sessions sync but inventory does not:

- Device B sees device A's study time, so B's capsule/compound/anchor settlement and B's daily soft-cap band change.
- Coins already paid on A are not recomputed on B. Two devices with identical session history will still show different balances, ELO and items.

This mismatch is visible to the user as soon as session sync ships, which is why inventory should be next after profile rather than "later".

**Conflict risk by field class:**

| Class | Fields | Two-device behaviour | Merge rule |
|---|---|---|---|
| Counters | `coins`, `honor`, `bankedBreak`, `rollTickets`, `items[*]`, `winStreak` | Double-spend / duplicate. Whole-doc LWW silently drops one device's deltas; max/sum both mint or burn coins. | Only an event log is correct |
| Day-keyed guards | `firstBonusDay`, `ticketDay`, `secretShopDay`, `capsule`, `compound` | Each device pays its own guarded reward once. Example: both devices finish a 10-minute session on the same day, each pays the +30 first-session bonus; LWW then keeps one device's whole document and drops the other's day of coins. | LWW acceptable; server-side check needed for true once-per-day |
| Grow-only sets | `giftedArenas`, `streakPatches` | Union is always correct | Set union, conflict-free |
| Scalar progress | `elo`, `arenaId` | ELO deltas from duels on two devices collide like counters; `arenaId` is a user choice | ELO: event log. `arenaId`: LWW |
| Preference | `equipped` | Harmless | LWW, or keep device-local |

Note: `dayKey` is local time, so two devices in different time zones disagree on "today" for every day-keyed guard. Acceptable for one user, worth knowing.

**Fresh-install clobber.** A new device starts from `DEFAULT_INVENTORY` (480 coins, no `updatedAt`). If it pushes before it pulls, it overwrites the real wallet with the default one. Rule required before any inventory sync: a local document with no `updatedAt` has never been synced and must pull first; it may only push after it has adopted or merged the remote document.

**Account switch.** `signOut` in `App.tsx` clears the profile but not inventory or sessions. With sync, signing in as a different account on the same device would push the first account's wallet and history under the second email. Inventory (and sessions) need to be scoped per account or cleared on account change.

**Trust.** The client is the authority for the balance today, and `debugSet` lets it write anything. Irrelevant for the Sheet; for Supabase the ledger insert should go through an RPC/edge function with RLS, not a direct table write.

**Recommendation:**

- *Sheet now:* whole-doc LWW on a `Inventory` tab (`email, json, updatedAt, serverAt`), with the fresh-install guard and set-union for `giftedArenas`/`streakPatches` on merge. Accept and document that concurrent counter changes on two devices lose one side. This is good enough for one person switching devices, not for two devices used the same day.
- *Supabase later:* `inventory_events (id, user_id, kind, delta jsonb, created_at, device_id)` as the source of truth for coins, honor, items, tickets, banked break and ELO; balance is a view or a server-maintained row. Day-keyed guards become unique constraints (`user_id, kind, day`). Prerequisite: rewrite each `inventory.ts` mutation to append a delta event first and fold locally. That rewrite is the real schema change, not a config flag, and it should start before Supabase so the event history exists when the migration happens.

### `@study_timer/profile`

**Shape:** `{ name, avatar?, title?, frame?, stickers?: {glyph, x, y}[] }`, normalized by `normalizeProfile`. No `id`/`updatedAt`/`deletedAt`.

**Derived?** No. Independent user-authored state; unlocks for frames/stickers are derived from sessions via `lib/progress.ts`, but the chosen values are not.

**Conflict risk:** low. Edits are rare and whole-document; LWW losing a sticker drag from the other device is fine.

**Gotchas:**

- `avatar` may be an image `data:` URI. A Google Sheet cell holds at most 50,000 characters, which one photo exceeds. Sheet: sync glyph avatars only and keep image avatars device-local (or drop to the default glyph remotely). Supabase: upload to a Storage bucket and sync the URL.
- A blank `name` reads back as "no profile" (`loadProfile` returns null) and `signOut` calls `clearProfile`. Sync must treat sign-out as "clear local cache", never as "delete remote". Profile needs `updatedAt` but no `deletedAt`: deleting the profile means deleting the account.
- Same fresh-install clobber as inventory: the profile created on the Login screen of a new device must not overwrite the remote one. Pull first on sign-in.

**Recommendation:** whole-doc LWW. Sheet: `Profiles` tab (`email, json, updatedAt, serverAt`). Supabase: `profiles` row keyed by `user_id`.

### `@study_timer/settings`

**Shape:** `{ weekStartsOn: 0 | 1 }`. The minimum-session-length setting mentioned in the PRD has since been removed.

**Derived?** No. **Conflict risk:** none worth handling.

**Recommendation:** leave device-local for now; `DOCs/prd-login-and-sync.md` lists settings sync as a v1 non-goal and P1-3. When it happens, fold it into the profile document/row (one more LWW field) rather than a separate tab.

### `study-timer.auth-session.v1`

SecureStore on native (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), AsyncStorage on web. Holds the approved user, expiry, and (after step 1) `syncToken`. This is a per-device credential. **Never sync it**; it is listed here only so the list is complete.

## Prioritized recommendation

1. **Schema prep (before any of the below).**
   - Add `updatedAt` (ISO) and `schemaVersion` to `Profile` and `Inventory`, set on every save.
   - Adopt the rule: a local doc without `updatedAt` is unsynced and must pull before it may push.
   - Scope or clear local inventory and sessions on account change (sign-out currently clears only the profile).
   - Make `clearSessions` write tombstones (see Follow-ups); otherwise session sync undoes "Clear all history".
2. **Profile — next.** Cheapest, lowest conflict, and visible ("my name and avatar don't follow me"). Whole-doc LWW, glyph avatars only on the Sheet.
3. **Inventory — right after.** The session-sync mismatch makes balances visibly diverge. Sheet: whole-doc LWW with set-union for the grow-only lists and the fresh-install guard, with the counter-loss caveat documented. In parallel, start converting `inventory.ts` mutations to append-delta events so the Supabase ledger has history from day one.
4. **Settings — per PRD P1-3**, as a field on the profile.
5. **Auth session — never.**

Sheet shape for 2–3: one tab per document type, columns `email, json, updatedAt, serverAt`, reusing the step 1 `syncToken` and adding actions alongside `push`/`pull` (or a `kind` field on them). The JSON-in-a-cell shape maps directly onto a `jsonb` column if Supabase keeps the document form for profile.
