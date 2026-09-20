import assert from 'node:assert';
import { register } from 'node:module';

// resolves the extensionless relative imports the app modules use
register('./resolve-ts-hook.mjs', import.meta.url);

// Mock localStorage for Node environment before importing AsyncStorage
if (typeof globalThis.window === 'undefined') {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    },
  };
}

const {
  saveSession,
  loadSessions,
  totals,
  sessionsForDay,
  formatDuration,
  getWeekStart,
  dailyTotals,
  dayKey,
  storage,
} = await import('./sessions.ts');

const { loadProfile, saveProfile, clearProfile, PROFILE_STORAGE_KEY } = await import('./auth.ts');
const { awayOutcome, AWAY_LIMIT_MS } = await import('./away.ts');
const { earnedRolls, earnRolls, loadRolls, spendRoll, clearRolls, MAX_TICKETS, ROLL_EARN_MS } =
  await import('./rolls.ts');
const { studyStreak, weeklyLongestMs } = await import('./streak.ts');
const { loadBreakBank, addBreakMinutes, spendBreakMinutes, clearBreakBank } =
  await import('./breaks.ts');
const { nextQuoteId, unlockedIds, quoteFor, isRare, RARE_UNLOCKS, EMPTY_CANON } =
  await import('./canon.ts');
const { QUOTES, RARE_QUOTES } = await import('../components/quotes.ts');

console.log('Running self-check...');

// 1. formatDuration output
assert.strictEqual(formatDuration(0), '0m', '0ms should format to "0m"');
assert.strictEqual(formatDuration(45 * 60000), '45m', '45m should format to "45m"');
assert.strictEqual(formatDuration(135 * 60000), '2h 15m', '135m should format to "2h 15m"');
assert.strictEqual(formatDuration(120 * 60000), '2h', '120m should format to "2h"');
assert.strictEqual(formatDuration(65 * 60000), '1h 5m', '65m should format to "1h 5m"');
console.log('✓ formatDuration output checks passed');

// 2. Every session is saved — the minimum-session rule was removed with the tab bar
const shortResult = await saveSession({
  startedAt: new Date('2026-08-26T10:00:00').toISOString(),
  endedAt: new Date('2026-08-26T10:00:59').toISOString(),
  durationMs: 59000,
  subject: 'Too Short',
});
assert.strictEqual(shortResult?.durationMs, 59000, 'a short session is saved like any other');

const validResult = await saveSession({
  startedAt: new Date('2026-08-26T10:00:00').toISOString(),
  endedAt: new Date('2026-08-26T10:01:00').toISOString(),
  durationMs: 60000,
  subject: 'Math',
});
assert.ok(validResult, '>=60s session should be saved');
assert.strictEqual(validResult?.durationMs, 60000);
assert.strictEqual(validResult?.subject, 'Math');

const loaded = await loadSessions();
assert.strictEqual(loaded.length, 2, 'both sessions are stored');
assert.deepStrictEqual(
  loaded.map((session) => session.subject).sort(),
  ['Math', 'Too Short'],
  'no session is silently dropped'
);
console.log('\u2713 saveSession and loadSessions checks passed');

// 3. Paused session durationMs (running time only, excludes paused time)
// E.g. Wall clock was 45 mins, but user was active for 30 mins (15 mins paused)
const pausedSession = {
  id: 's_paused',
  startedAt: new Date('2026-08-26T14:00:00').toISOString(),
  endedAt: new Date('2026-08-26T14:45:00').toISOString(),
  durationMs: 30 * 60000, // 30 mins running, 15 mins paused excluded
  subject: 'Physics',
  type: 'stopwatch',
  source: 'timer',
  schemaVersion: 1,
  updatedAt: new Date('2026-08-26T14:45:00').toISOString(),
  deletedAt: null,
};
const pausedTotals = totals([pausedSession], new Date('2026-08-26T15:00:00'));
assert.strictEqual(pausedTotals.todayMs, 30 * 60000, 'totals must aggregate active durationMs, not wall-clock span');
console.log('✓ Paused session durationMs check passed');

// 4. Week boundary is Monday
// Week of Aug 24, 2026 (Mon) to Aug 30, 2026 (Sun)
const prevSunday = {
  id: 's_prev_sun',
  startedAt: new Date(2026, 7, 23, 22, 0, 0).toISOString(), // Aug 23, 2026 (Sunday)
  endedAt: new Date(2026, 7, 23, 23, 0, 0).toISOString(),
  durationMs: 60 * 60000,
  subject: 'Prev Week',
  type: 'stopwatch',
  source: 'timer',
  schemaVersion: 1,
  updatedAt: new Date(2026, 7, 23, 23, 0, 0).toISOString(),
  deletedAt: null,
};
const mondaySession = {
  id: 's_mon',
  startedAt: new Date(2026, 7, 24, 9, 0, 0).toISOString(), // Aug 24, 2026 (Monday)
  endedAt: new Date(2026, 7, 24, 10, 0, 0).toISOString(),
  durationMs: 60 * 60000,
  subject: 'This Week Mon',
  type: 'stopwatch',
  source: 'timer',
  schemaVersion: 1,
  updatedAt: new Date(2026, 7, 24, 10, 0, 0).toISOString(),
  deletedAt: null,
};
const sundaySession = {
  id: 's_sun',
  startedAt: new Date(2026, 7, 30, 20, 0, 0).toISOString(), // Aug 30, 2026 (Sunday)
  endedAt: new Date(2026, 7, 30, 21, 0, 0).toISOString(),
  durationMs: 60 * 60000,
  subject: 'This Week Sun',
  type: 'stopwatch',
  source: 'timer',
  schemaVersion: 1,
  updatedAt: new Date(2026, 7, 30, 21, 0, 0).toISOString(),
  deletedAt: null,
};
const nextMondaySession = {
  id: 's_next_mon',
  startedAt: new Date(2026, 7, 31, 8, 0, 0).toISOString(), // Aug 31, 2026 (Monday)
  endedAt: new Date(2026, 7, 31, 9, 0, 0).toISOString(),
  durationMs: 60 * 60000,
  subject: 'Next Week Mon',
  type: 'stopwatch',
  source: 'timer',
  schemaVersion: 1,
  updatedAt: new Date(2026, 7, 31, 9, 0, 0).toISOString(),
  deletedAt: null,
};

const wednesdayRef = new Date(2026, 7, 26, 12, 0, 0); // Aug 26, 2026 (Wednesday)
const weekTotals = totals([prevSunday, mondaySession, sundaySession, nextMondaySession], wednesdayRef);
assert.strictEqual(
  weekTotals.weekMs,
  120 * 60000,
  'Week total must only include Mon Aug 24 and Sun Aug 30 (Monday week boundary)'
);
assert.strictEqual(
  weekTotals.todayMs,
  0,
  'No sessions today (Wed Aug 26)'
);
assert.strictEqual(
  weekTotals.monthMs,
  240 * 60000,
  'All 4 sessions are in August 2026'
);

const dayList = sessionsForDay([prevSunday, mondaySession, sundaySession], new Date(2026, 7, 24, 18, 0, 0));
assert.strictEqual(dayList.length, 1);
assert.strictEqual(dayList[0].id, 's_mon');
console.log('✓ Week boundary is Monday checks passed');

// 5. Week boundary follows the weekStartsOn setting
// Same data, Sunday-start weeks: Aug 23 (Sun) .. Aug 29 (Sat) contains prevSunday only.
const sundayWeekTotals = totals(
  [prevSunday, mondaySession, sundaySession, nextMondaySession],
  wednesdayRef,
  0
);
assert.strictEqual(
  sundayWeekTotals.weekMs,
  120 * 60000,
  'Sunday-start week must include Sun Aug 23 and Mon Aug 24, not Sun Aug 30'
);
assert.strictEqual(
  getWeekStart(wednesdayRef, 0).getDay(),
  0,
  'weekStartsOn=0 must land on a Sunday'
);
assert.strictEqual(
  getWeekStart(wednesdayRef, 1).getDay(),
  1,
  'weekStartsOn=1 must land on a Monday'
);
// Default must stay Monday so existing callers are unchanged.
assert.strictEqual(getWeekStart(wednesdayRef).getDay(), 1, 'default week start is Monday');
console.log('✓ weekStartsOn setting checks passed');

// dailyTotals must bucket by LOCAL day. A 23:30 local session would fall on the
// next UTC day for any negative-offset zone — slicing the ISO string would misplace it.
const lateNight = new Date(2026, 7, 26, 23, 30);
const byDay = dailyTotals([
  {
    startedAt: lateNight.toISOString(),
    endedAt: new Date(2026, 7, 26, 23, 50).toISOString(),
    durationMs: 20 * 60000,
    deletedAt: null,
  },
  {
    startedAt: new Date(2026, 7, 26, 9, 0).toISOString(),
    endedAt: new Date(2026, 7, 26, 9, 40).toISOString(),
    durationMs: 40 * 60000,
    deletedAt: null,
  },
]);
assert.strictEqual(dayKey(lateNight), '2026-08-26', 'dayKey uses the local calendar date');
assert.strictEqual(byDay.get('2026-08-26'), 60 * 60000, 'same local day sums to 60m');
assert.strictEqual(byDay.size, 1, 'a late-night session must not leak onto the next day');
console.log('\u2713 dailyTotals local-day bucketing checks passed');

// profile round-trip: trims, rejects blank/corrupt, clears
assert.strictEqual(await loadProfile(), null, 'no profile stored means logged out');
assert.deepStrictEqual(await saveProfile({ name: '  Ada  ' }), { name: 'Ada' }, 'saveProfile trims the name');
assert.deepStrictEqual(await loadProfile(), { name: 'Ada' }, 'the saved profile loads back');
await saveProfile({ name: '   ' });
assert.strictEqual(await loadProfile(), null, 'a blank name is not a login');

// profile edits survive a reload — loadProfile used to drop everything but the name
const edited = { name: 'Ada', avatar: '🦊', title: '  Night Owl  ', frame: '#d95b2e' };
assert.deepStrictEqual(
  await saveProfile(edited),
  { name: 'Ada', avatar: '🦊', title: 'Night Owl', frame: '#d95b2e' },
  'saveProfile keeps avatar/title/frame and trims the title'
);
assert.deepStrictEqual(
  await loadProfile(),
  { name: 'Ada', avatar: '🦊', title: 'Night Owl', frame: '#d95b2e' },
  'the edited profile loads back whole'
);
assert.deepStrictEqual(
  await saveProfile({ ...edited, title: '' }),
  { name: 'Ada', avatar: '🦊', frame: '#d95b2e' },
  'a blank title clears the field instead of storing an empty string'
);

// stickers carry a 0-1 fraction so a placement survives any avatar size
const { MAX_STICKERS } = await import('./auth.ts');
assert.deepStrictEqual(
  await saveProfile({ name: 'Ada', stickers: [{ glyph: '⚡', x: 0.25, y: 0.75 }] }),
  { name: 'Ada', stickers: [{ glyph: '⚡', x: 0.25, y: 0.75 }] },
  'a dragged sticker stores its own spot'
);
assert.deepStrictEqual(
  (await loadProfile()).stickers,
  [{ glyph: '⚡', x: 0.25, y: 0.75 }],
  'the placement loads back'
);
assert.deepStrictEqual(
  (await saveProfile({ name: 'Ada', stickers: [{ glyph: '⚡', x: 1.7, y: -3 }] })).stickers,
  [{ glyph: '⚡', x: 1, y: 0 }],
  'a drag past the edge clamps into the picture'
);
assert.deepStrictEqual(
  (await saveProfile({ name: 'Ada', stickers: [{ glyph: '⚡', x: 0.2, y: 0.2 }, { glyph: '⚡', x: 0.8, y: 0.8 }] })).stickers.length,
  2,
  'the same glyph can appear twice at different spots'
);
assert.strictEqual(
  (await saveProfile({
    name: 'Ada',
    stickers: Array.from({ length: 12 }, (_, i) => ({ glyph: '⚡', x: i / 12, y: 0 })),
  })).stickers.length,
  MAX_STICKERS,
  'more stickers than the cap are dropped'
);

// both older shapes still load: a 3x3 slot index, and a plain tap-order glyph list
await storage.setItem(
  PROFILE_STORAGE_KEY,
  JSON.stringify({ name: 'Ada', stickers: [{ glyph: '🔥', slot: 4 }] })
);
assert.deepStrictEqual(
  (await loadProfile()).stickers,
  [{ glyph: '🔥', x: 0.5, y: 0.5 }],
  'a slot-4 sticker migrates to the centre'
);
await storage.setItem(
  PROFILE_STORAGE_KEY,
  JSON.stringify({ name: 'Ada', stickers: ['⚡', '🔥'] })
);
assert.deepStrictEqual(
  (await loadProfile()).stickers,
  [{ glyph: '⚡', x: 0, y: 0 }, { glyph: '🔥', x: 1, y: 0 }],
  'a legacy glyph list migrates onto the top corners'
);
assert.deepStrictEqual(
  await saveProfile({ name: 'Ada', stickers: [] }),
  { name: 'Ada' },
  'an empty sticker list drops the key'
);

await saveProfile({ name: 'Ada' });
await clearProfile();
assert.strictEqual(await loadProfile(), null, 'clearProfile signs out');
console.log('\u2713 profile auth checks passed');

// away-from-app handling
const running = { onBreak: false, hasTime: true, wasRunning: true };
assert.strictEqual(awayOutcome(60_000, running), 'resume', 'a short absence just resumes');
assert.strictEqual(awayOutcome(AWAY_LIMIT_MS, running), 'resume', 'exactly the limit is still fine');
assert.strictEqual(awayOutcome(AWAY_LIMIT_MS + 1, running), 'finish', 'past the limit banks the session');
assert.strictEqual(
  awayOutcome(AWAY_LIMIT_MS + 1, { ...running, onBreak: true }),
  'resume',
  'a paid break is not punished'
);
assert.strictEqual(
  awayOutcome(AWAY_LIMIT_MS + 1, { ...running, hasTime: false }),
  'reset',
  'nothing to bank means a plain reset'
);
assert.strictEqual(
  awayOutcome(1000, { ...running, wasRunning: false }),
  'idle',
  'a paused timer stays paused on return'
);
console.log('\u2713 away-from-app checks passed');

// page-roll economy: the book opens only for time already put in
assert.strictEqual(earnedRolls(0), 0, 'an empty session earns nothing');
assert.strictEqual(earnedRolls(60_000), 1, 'sitting down at all earns the first roll');
assert.strictEqual(earnedRolls(ROLL_EARN_MS), 2, 'a full half hour adds one more');
assert.strictEqual(earnedRolls(ROLL_EARN_MS * 2 - 1), 2, 'a part-finished half hour does not');
assert.strictEqual(earnedRolls(ROLL_EARN_MS * 3), 4, 'ninety minutes earns four');

await clearRolls();
assert.deepStrictEqual(await loadRolls(), { tickets: 0, spent: 0 }, 'a fresh bank is empty');
assert.strictEqual(await spendRoll(), null, 'an empty bank cannot be spent');

const first = await earnRolls(ROLL_EARN_MS);
assert.strictEqual(first.earned, 2, 'a 30m session credits two rolls');
assert.strictEqual(first.bank.tickets, 2, 'and the bank holds them');

const afterSpend = await spendRoll();
assert.strictEqual(afterSpend.tickets, 1, 'rolling costs one ticket');
assert.strictEqual(afterSpend.spent, 1, 'and is counted as spent');
assert.strictEqual((await loadRolls()).tickets, 1, 'the spend survives a reload');

const overflow = await earnRolls(ROLL_EARN_MS * 50);
assert.strictEqual(overflow.bank.tickets, MAX_TICKETS, 'tickets stop at the cap');
assert.strictEqual(
  (await earnRolls(ROLL_EARN_MS)).earned,
  0,
  'a full bank earns nothing more'
);

await clearRolls();
assert.strictEqual((await loadRolls()).tickets, 0, 'clearing history clears the rolls');
console.log('\u2713 page-roll economy checks passed');

// day streak, read back out of the saved history
const dayMs = 24 * 60 * 60 * 1000;
const at = (daysAgo, ms) => ({
  id: `s${daysAgo}`,
  startedAt: new Date(Date.now() - daysAgo * dayMs).toISOString(),
  endedAt: new Date(Date.now() - daysAgo * dayMs + ms).toISOString(),
  durationMs: ms,
  subject: null,
  type: 'stopwatch',
  source: 'timer',
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  deletedAt: null,
});

assert.strictEqual(studyStreak([]), 0, 'no history is no streak');
assert.strictEqual(studyStreak([at(0, 60000)]), 1, 'studying today is a streak of one');
assert.strictEqual(
  studyStreak([at(0, 60000), at(1, 60000), at(2, 60000)]),
  3,
  'three days running counts three'
);
assert.strictEqual(
  studyStreak([at(1, 60000), at(2, 60000)]),
  2,
  'a quiet morning does not break yesterday\u2019s run'
);
assert.strictEqual(
  studyStreak([at(2, 60000), at(3, 60000)]),
  0,
  'a whole day missed ends the streak'
);
assert.strictEqual(
  studyStreak([at(0, 60000), at(2, 60000)]),
  1,
  'the streak stops at the gap'
);

// weekly longest is the longest single session, not the weekly total
const thisWeek = [at(0, 30 * 60000), at(0, 90 * 60000)];
assert.strictEqual(
  weeklyLongestMs(thisWeek, new Date()),
  90 * 60000,
  'the longest session of the week wins'
);
assert.strictEqual(weeklyLongestMs([at(60, 90 * 60000)], new Date()), 0, 'last month does not count');
console.log('\u2713 streak checks passed');

// break bank survives a reload and cannot be overspent
await clearBreakBank();
assert.strictEqual((await loadBreakBank()).minutes, 0, 'a fresh break bank is empty');
assert.strictEqual(await spendBreakMinutes(5), null, 'an empty bank cannot be spent');
assert.strictEqual((await addBreakMinutes(5)).minutes, 5, 'an hour of focus banks five minutes');
assert.strictEqual((await addBreakMinutes(5)).minutes, 10, 'a second hour banks five more');
assert.strictEqual(await spendBreakMinutes(15), null, 'more than the bank holds is refused');
assert.strictEqual((await spendBreakMinutes(10)).minutes, 0, 'spending it all leaves nothing');
assert.strictEqual((await loadBreakBank()).minutes, 0, 'and the spend survives a reload');
console.log('\u2713 break bank checks passed');

// the canon: unseen first, rare quotes earned
const noStats = { bestDayMs: 0, streakDays: 0, sessions: 0 };
assert.strictEqual(
  unlockedIds(noStats).length,
  QUOTES.length,
  'nothing rare is unlocked before the first session'
);
assert.strictEqual(
  unlockedIds({ bestDayMs: 0, streakDays: 0, sessions: 1 }).length,
  QUOTES.length + 1,
  'the first finished session unlocks the first rare quote'
);
assert.strictEqual(
  unlockedIds({ bestDayMs: 5 * 60 * 60 * 1000, streakDays: 30, sessions: 50 }).length,
  QUOTES.length + RARE_QUOTES.length,
  'meeting every milestone unlocks the whole canon'
);
assert.strictEqual(
  RARE_UNLOCKS.length,
  RARE_QUOTES.length,
  'every rare quote has an unlock and vice versa'
);
assert.ok(isRare('r0') && !isRare('3'), 'rare ids are told apart from common ones');
assert.deepStrictEqual(quoteFor('0'), QUOTES[0], 'a common id resolves to its quote');
assert.deepStrictEqual(quoteFor('r1'), RARE_QUOTES[1], 'a rare id resolves to its quote');

// reading the canon through never repeats until it is exhausted
let canon = EMPTY_CANON;
const drawn = [];
const pool = unlockedIds(noStats).length;
for (let i = 0; i < pool; i++) {
  const step = nextQuoteId(canon, noStats, () => 0);
  assert.ok(step.fresh, 'every draw is a quote not read before');
  assert.ok(!drawn.includes(step.id), `quote ${step.id} was drawn twice`);
  drawn.push(step.id);
  canon = step.canon;
}
assert.strictEqual(drawn.length, pool, 'the whole canon is readable');
const wrapped = nextQuoteId(canon, noStats, () => 0);
assert.strictEqual(wrapped.fresh, false, 'the next draw is a repeat');
assert.strictEqual(wrapped.canon.cycles, 1, 'and it counts as a full read-through');
assert.strictEqual(wrapped.canon.seen.length, 1, 'the pool refills behind it');
console.log('\u2713 quote canon checks passed');

console.log('\nAll self-checks passed successfully!');
