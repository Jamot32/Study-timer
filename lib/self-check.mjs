import assert from 'node:assert';

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
} = await import('./sessions.ts');

const { loadProfile, saveProfile, clearProfile } = await import('./auth.ts');
const { awayOutcome, AWAY_LIMIT_MS } = await import('./away.ts');

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
assert.deepStrictEqual(await saveProfile('  Ada  '), { name: 'Ada' }, 'saveProfile trims the name');
assert.deepStrictEqual(await loadProfile(), { name: 'Ada' }, 'the saved profile loads back');
await saveProfile('   ');
assert.strictEqual(await loadProfile(), null, 'a blank name is not a login');
await saveProfile('Ada');
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

console.log('\nAll self-checks passed successfully!');
