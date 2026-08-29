# PRD: Session History & Time Dashboard

**Product:** Study Timer (Expo / React Native, iOS + Android)
**Status:** Draft
**Scope:** v1 — local-only session persistence and a daily/weekly/monthly stats view

---

## Problem Statement

Today the timer counts up and then forgets. Closing the app, backgrounding it, or hitting Reset destroys the elapsed time, so a user who studies every day has no way to answer "how much did I study this week?" The core value of a study timer is not the stopwatch — it's the accumulated record that shows progress and sustains a streak. Without persistence the app is a worse version of the system clock's stopwatch, and there is no reason to open it twice.

## Goals

1. **No study time is ever lost.** A completed session survives app close, background, and device restart. Target: zero data-loss reports in the first 30 days.
2. **A returning user can see their totals within one tap of opening the app.** Today / this week / this month, with no configuration.
3. **Give users a reason to return.** ≥40% of users who log a session return and log another within 7 days.
4. **Keep the start-to-timing path unchanged.** Starting a session still takes exactly one tap; median time from cold launch to running timer stays under 3 seconds.
5. **Build a data model that survives cloud sync later** without a migration that discards history.

## Non-Goals

- **Cloud sync, accounts, and multi-device.** v1 is on-device only. Accounts are a separate initiative; adding auth now triples the scope and blocks the thing users actually want.
- **Pomodoro / countdown mode.** The timer stays a freeform stopwatch. Countdown is a distinct interaction model and deserves its own spec.
- **Goals, streaks, badges, notifications.** Motivational layers are worthless until there's data to motivate against. Ship the data first.
- **Editing or manually adding past sessions.** Real need, but it adds a full CRUD surface and conflict rules. Deferred to v1.1.
- **Charts and graphs.** v1 ships numeric totals and a session list. Visualizations come after we see whether people look at the dashboard at all.
- **Export (CSV/JSON).** Nice, but low usage until history is deep enough to be worth exporting.

## User Stories

**Primary — the daily studier**

1. As someone studying daily, I want my finished session saved automatically so that I don't have to remember to log anything.
2. As someone studying daily, I want to see how much I've studied today, this week, and this month so that I know whether I'm keeping up.
3. As someone studying daily, I want to see the individual sessions that make up today's total so that I can tell one long session from four short ones.
4. As someone who studies several subjects, I want to optionally tag a session with a subject so that I can later see where my time actually went.

**Edge cases**

5. As a first-time user, I want the dashboard to explain itself when it's empty so that I'm not staring at a screen of zeroes wondering if it's broken.
6. As someone who accidentally hit Start, I want a very short session to be discarded rather than cluttering my history.
7. As someone who backgrounded the app mid-session, I want the timer to still be counting when I come back so that I don't lose the time I actually studied.
8. As someone who force-quit the app with the timer running, I want to be told what happened rather than silently losing 40 minutes.

## Requirements

### Must-Have (P0)

**P0-1 — Session record**
A session is persisted when the user completes it. Minimum shape:

| Field | Notes |
|---|---|
| `id` | stable unique id |
| `startedAt` | ISO timestamp, wall-clock |
| `endedAt` | ISO timestamp |
| `durationMs` | accumulated running time, excludes paused time |
| `subject` | nullable string; null renders as "Unlabeled" |
| `schemaVersion` | present from day one, for future migrations |

Acceptance criteria:
- [ ] Given a running timer, when the user ends the session, then a record with the above fields is written to device storage
- [ ] Given a session with pauses, when it is saved, then `durationMs` equals running time only, not wall-clock span
- [ ] Given the app is killed and relaunched, when the user opens the dashboard, then previously saved sessions are still listed
- [ ] Sessions shorter than a minimum threshold (proposed: 60s) are discarded without being written, and the user is told they were discarded

*Technical note:* today's `useStudyTimer` tracks `accumulatedMs` + `startedAt` in refs and has `toggle` / `reset` only. It needs an explicit **end/finish** action distinct from `reset`, otherwise there is no moment at which to save.

**P0-2 — Ending a session**
The timer gains a distinct "Finish" action. `Reset` becomes explicitly destructive (discard without saving) and requires confirmation when elapsed time is non-trivial.

- [ ] Given a running or paused timer with time on it, when the user taps Finish, then the session is saved and the timer returns to `ready` at 00:00
- [ ] Given a timer with time on it, when the user taps Reset, then a confirmation appears warning the time will not be saved
- [ ] Given the timer is at 00:00, when the user views the controls, then Finish is disabled

**P0-3 — Background and crash resilience**
- [ ] Given a running timer, when the app is backgrounded for N minutes and reopened, then elapsed time reflects the full N minutes (compute from wall-clock, do not rely on the interval firing)
- [ ] Given a running timer, when the app is terminated and relaunched, then the in-progress session is restored, or — if it cannot be trusted — the user is shown a recovery prompt with the recorded elapsed time and can save or discard it

**P0-4 — Dashboard totals**
A dashboard surface showing three totals: **Today**, **This week**, **This month**.

- [ ] Totals are computed from saved sessions, in the device's local timezone
- [ ] Week and month boundaries are defined and consistent (proposed: calendar week starting Monday; calendar month)
- [ ] A session is attributed to the day of its `startedAt`
- [ ] Durations render in a readable format (e.g. `2h 15m`, not `08:15:00`)
- [ ] Given zero saved sessions, when the dashboard is opened, then an empty state explains that finished sessions will appear here

**P0-5 — Session list**
- [ ] Today's (or the selected period's) sessions are listed newest-first with start time, duration, and subject
- [ ] The list handles a large history without stalling the UI

**P0-6 — Navigation**
Timer and Dashboard are separate surfaces, with the timer as the default landing screen. `@rn-primitives/tabs` is already a dependency and is the likely fit.

- [ ] Given a cold launch, when the app opens, then the timer screen is shown
- [ ] Given the user is on the dashboard, when they navigate to the timer, then a running timer is still running and shows correct elapsed time

### Nice-to-Have (P1)

**P1-1 — Subject tagging.** Optional subject chosen at Finish (or pre-set before Start), remembering recently used subjects. Skippable in one tap — never blocks saving.
**P1-2 — Per-subject breakdown.** Time by subject within the selected period.
**P1-3 — Delete a session.** Single-session delete with undo. Cheapest correction mechanism, and the most likely first complaint.
**P1-4 — Period switcher.** Toggle the session list between day / week / month rather than today only.
**P1-5 — Daily average** for the selected period.

### Future Considerations (P2)

Not built now, but the v1 data model should not preclude them:

- **Cloud sync.** Requires stable ids, `updatedAt`, and soft deletes. Adding those fields to the schema in v1 is nearly free; retrofitting them is not.
- **Pomodoro mode.** Requires a `type` discriminator on the session record. Add the field now, hardcode `"stopwatch"`.
- **Goals and streaks.** Need a cheap "did the user study on day X" query — keep daily aggregation logic separable from the UI.
- **Charts.** Keep aggregation as a pure function over sessions so a chart layer can reuse it.
- **Manual entry / editing.** Requires distinguishing timed sessions from manually entered ones — consider a `source` field.

## Success Metrics

**Leading (days to weeks)**
- **Save rate:** ≥90% of started sessions over the minimum threshold end in a saved record rather than a discard or loss. Measured at 2 weeks.
- **Dashboard adoption:** ≥60% of users with ≥1 saved session open the dashboard within their first 3 app opens.
- **Time to start unchanged:** median cold-launch-to-running stays ≤3s versus the pre-release baseline.
- **Recovery prompt frequency:** <5% of sessions hit the crash-recovery path. Higher means the persistence model is wrong.

**Lagging (weeks to months)**
- **D7 return with a second session:** ≥40%.
- **Sessions per active user per week:** trending up month over month.
- **Median history depth at 30 days:** ≥10 saved sessions, indicating the record is actually accumulating.

## Open Questions

**Blocking**
- *(Engineering)* Storage layer: AsyncStorage/MMKV with a JSON array, or SQLite (expo-sqlite)? A flat blob is faster to build but degrades once history is long and makes P2 sync harder. **Recommend deciding before P0-1 starts.**
- *(Product)* Minimum session threshold — is 60s right? Too high and legitimate short reviews vanish; too low and misfires pollute history.
- *(Product)* Does Finish also need to be reachable while running, or must the user pause first? Affects the control layout.

**Non-blocking**
- *(Product)* Week start — Monday or Sunday? Locale-derived or fixed?
- *(Engineering)* How to attribute a session that crosses midnight — by `startedAt` (proposed), or split across days?
- *(Design)* Does the dashboard show all three totals at once, or one with a period switcher?
- *(Engineering)* Behavior when the device clock changes or the user travels across timezones.

## Timeline Considerations

No hard external deadline. Suggested phasing — each phase is independently shippable:

**Phase 1 — Persistence.** P0-1, P0-2, P0-3. Sessions save and survive. No new UI beyond the Finish control. This is the phase that removes the data loss, and it is the one worth doing carefully.

**Phase 2 — Dashboard.** P0-4, P0-5, P0-6. Totals, session list, tab navigation.

**Phase 3 — Fast follows.** P1 items, prioritized by what users complain about first (likely delete, then subjects).

**Dependency:** Phase 2 cannot start until the storage decision in Open Questions is settled, since the aggregation approach depends on it.
