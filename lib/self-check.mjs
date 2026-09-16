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
  storage,
} = await import('./sessions.ts');

const {
  loadProfile,
  saveProfile,
  clearProfile,
  nameError,
  normalizeProfile,
  bringStickerToFront,
  PROFILE_STORAGE_KEY,
  NAME_MAX,
  TITLE_MAX,
  FRAMES,
  STICKERS,
} = await import('./auth.ts');
const {
  BADGES,
  FRAME_UNLOCKS,
  STICKER_UNLOCKS,
  LEVEL_STEP_MS,
  countEarned,
  evaluateBadges,
  isUnlocked,
  levelProgress,
  streaks,
  studyStats,
  unlockFor,
} = await import('./progress.ts');
const {
  initHistory,
  commit,
  commitFrom,
  replace,
  undo,
  redo,
  canUndo,
  canRedo,
  HISTORY_LIMIT,
} = await import('./history.ts');
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
assert.deepStrictEqual(await saveProfile({ name: '  Ada  ' }), { name: 'Ada' }, 'saveProfile trims the name');
assert.deepStrictEqual(await loadProfile(), { name: 'Ada' }, 'the saved profile loads back');
// A blank name reads back as signed out, so a blank save must not reach storage:
// it would erase the whole profile — avatar and stickers included — on next launch.
await saveProfile({ name: '   ' });
assert.deepStrictEqual(await loadProfile(), { name: 'Ada' }, 'a blank name never overwrites the stored profile');
assert.strictEqual(nameError('   '), 'NAME CANNOT BE BLANK', 'whitespace alone is not a name');
assert.strictEqual(nameError(''), 'NAME CANNOT BE BLANK', 'an empty name is rejected');
assert.strictEqual(nameError('A'.repeat(NAME_MAX)), null, 'a name at the limit is fine');
assert.strictEqual(nameError('A'.repeat(NAME_MAX + 1)), `MAX ${NAME_MAX} CHARACTERS`, 'a name past the limit is rejected');
assert.strictEqual(normalizeProfile({ name: 'A'.repeat(NAME_MAX + 5) }).name.length, NAME_MAX, 'normalize clamps an over-long name');
assert.strictEqual(
  normalizeProfile({ name: 'Ada', title: 'T'.repeat(TITLE_MAX + 5) }).title.length,
  TITLE_MAX,
  'normalize clamps an over-long title'
);

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

// draw order: array order is what Avatar renders, so the sticker just moved must
// end up last, or a fresh sticker stays hidden behind the ones placed before it
const stacked = { name: 'Ada', stickers: [{ glyph: '⚡', x: 0, y: 0 }, { glyph: '🔥', x: 0.5, y: 0.5 }, { glyph: '🍀', x: 1, y: 1 }] };
assert.deepStrictEqual(
  bringStickerToFront(stacked, 0).stickers.map((sticker) => sticker.glyph),
  ['🔥', '🍀', '⚡'],
  'the dragged sticker moves to the end of the draw order'
);
assert.strictEqual(bringStickerToFront(stacked, 2), stacked, 'the top sticker is already in front');
assert.strictEqual(bringStickerToFront(stacked, 7), stacked, 'an out-of-range index is ignored');
assert.deepStrictEqual(bringStickerToFront({ name: 'Ada' }, 0), { name: 'Ada' }, 'no stickers, nothing to lift');
console.log('\u2713 sticker draw-order checks passed');

// undo/redo stack: one step per gesture, redo cleared by a fresh edit
let history = initHistory({ name: 'Ada' });
assert.strictEqual(canUndo(history), false, 'an untouched history has nothing to undo');
assert.strictEqual(canRedo(history), false, 'an untouched history has nothing to redo');
assert.strictEqual(undo(history), history, 'undo at the bottom of the stack is a no-op');
assert.strictEqual(redo(history), history, 'redo with an empty future is a no-op');

history = commit(history, { name: 'Ada', avatar: '🦊' });
assert.strictEqual(history.present.avatar, '🦊', 'commit moves the present forward');
assert.strictEqual(canUndo(history), true, 'the previous snapshot is undoable');
// an identical commit (a re-submit, a no-op blur) must not consume an undo step
assert.strictEqual(commit(history, { name: 'Ada', avatar: '🦊' }), history, 'a no-op commit is dropped');

history = commit(history, { name: 'Ada', avatar: '🦊', frame: '#d95b2e' });
const rewound = undo(history);
assert.deepStrictEqual(rewound.present, { name: 'Ada', avatar: '🦊' }, 'undo restores the previous snapshot');
assert.strictEqual(canRedo(rewound), true, 'an undone snapshot is redoable');
assert.deepStrictEqual(redo(rewound).present, history.present, 'redo returns to the later snapshot');
// a new edit after an undo abandons the redo branch
assert.strictEqual(commit(rewound, { name: 'Ada' }).future.length, 0, 'a fresh edit clears the redo stack');

// a gesture: frames replace the present without stacking, then one commit lands
const gestureBase = { name: 'Ada', stickers: [{ glyph: '⚡', x: 0, y: 0 }] };
let gesture = initHistory(gestureBase);
gesture = replace(gesture, { name: 'Ada', stickers: [{ glyph: '⚡', x: 0.3, y: 0 }] });
gesture = replace(gesture, { name: 'Ada', stickers: [{ glyph: '⚡', x: 0.7, y: 0.2 }] });
assert.strictEqual(gesture.past.length, 0, 'drag frames never stack undo steps');
assert.strictEqual(gesture.present.stickers[0].x, 0.7, 'the last frame wins');
assert.strictEqual(replace(gesture, gesture.present), gesture, 'a frame identical to the present is dropped');
const settled = commitFrom(gesture, gestureBase, gesture.present);
assert.strictEqual(settled.past.length, 1, 'the gesture costs exactly one undo step');
assert.deepStrictEqual(undo(settled).present, gestureBase, 'one undo restores the pre-drag position');

// the cap keeps a long session from growing the stack forever
let deep = initHistory(0);
for (let i = 1; i <= HISTORY_LIMIT + 10; i += 1) deep = commit(deep, i);
assert.strictEqual(deep.past.length, HISTORY_LIMIT, 'the undo stack is capped');
assert.strictEqual(deep.present, HISTORY_LIMIT + 10, 'the newest snapshot is still the present');
console.log('\u2713 undo/redo history checks passed');

// progress: levels, streaks, badges, and cosmetic unlocks — all derived from the
// session log, so nothing here needs its own storage or migration
const MIN_MS = 60 * 1000;
const HOUR = 60 * MIN_MS;
const sessionAt = (start, minutes = 30, overrides = {}) => ({
  id: `s_${start.getTime()}_${minutes}`,
  startedAt: start.toISOString(),
  endedAt: new Date(start.getTime() + minutes * MIN_MS).toISOString(),
  durationMs: minutes * MIN_MS,
  subject: null,
  type: 'stopwatch',
  source: 'timer',
  schemaVersion: 1,
  updatedAt: start.toISOString(),
  deletedAt: null,
  ...overrides,
});
// A fixed reference "now": Wed 16 Sep 2026, 20:00 local.
const NOW = new Date(2026, 8, 16, 20, 0, 0);
const at = (dayOffset, hour = 12) => new Date(2026, 8, 16 + dayOffset, hour, 0, 0);

const start = levelProgress(0);
assert.strictEqual(start.level, 1, 'a fresh profile starts at level 1, never 0');
assert.strictEqual(start.remainingMs, LEVEL_STEP_MS, 'level 2 is one step away');
assert.strictEqual(start.progress, 0, 'a new level starts empty');
assert.strictEqual(levelProgress(LEVEL_STEP_MS - 1).level, 1, 'a millisecond short is still level 1');
assert.strictEqual(levelProgress(LEVEL_STEP_MS).level, 2, 'exactly the cost levels up');
assert.strictEqual(levelProgress(LEVEL_STEP_MS).intoLevelMs, 0, 'the overflow carries into the new level');
assert.strictEqual(levelProgress(90 * MIN_MS).level, 3, '30m + 60m reaches level 3');
assert.strictEqual(levelProgress(90 * MIN_MS - 1).level, 2, 'just under that boundary is still level 2');
const midLevel = levelProgress(7 * HOUR);
assert.strictEqual(midLevel.level, 5, '5h of study is level 5');
assert.strictEqual(midLevel.intoLevelMs, 2 * HOUR, '2h of the 7h sits inside level 5');
assert.strictEqual(midLevel.remainingMs, 30 * MIN_MS, '30m is left of level 5');
assert.strictEqual(levelProgress(-5000).level, 1, 'a nonsense total is clamped, not extrapolated');
for (const total of [0, 1, LEVEL_STEP_MS, 3 * HOUR, 11 * HOUR, 40 * HOUR]) {
  const step = levelProgress(total);
  assert.strictEqual(
    step.intoLevelMs + step.remainingMs,
    step.levelCostMs,
    `level math adds up at ${total}ms`
  );
  assert.ok(step.progress >= 0 && step.progress < 1, `progress stays inside the level at ${total}ms`);
}
console.log('\u2713 level progress checks passed');

const threeDays = [sessionAt(at(0, 10)), sessionAt(at(-1, 10)), sessionAt(at(-2, 10))];
const run3 = streaks(threeDays, NOW);
assert.strictEqual(run3.current, 3, 'three days running counts as three');
assert.strictEqual(run3.longest, 3, 'the longest run matches');
assert.strictEqual(run3.studiedToday, true, 'today counts as studied');
assert.strictEqual(run3.activeDays.length, 3, 'one entry per day studied');
assert.strictEqual(
  streaks([...threeDays, sessionAt(at(-1, 18))], NOW).activeDays.length,
  3,
  'two sessions in one day is still one study day'
);
// today not studied yet does not cancel a streak — the day is not over
const run2 = streaks([sessionAt(at(-1, 10)), sessionAt(at(-2, 10))], NOW);
assert.strictEqual(run2.current, 2, 'an untouched today keeps yesterday\'s streak alive');
assert.strictEqual(run2.studiedToday, false, 'but today is not marked as studied');
assert.strictEqual(
  streaks([sessionAt(at(0, 10)), sessionAt(at(-3, 10))], NOW).current,
  1,
  'a missed day breaks the run'
);
assert.strictEqual(
  streaks([sessionAt(at(-6, 10)), sessionAt(at(-7, 10))], NOW).current,
  0,
  'a streak that ended days ago has lapsed'
);
assert.strictEqual(
  streaks([...threeDays, sessionAt(at(-6, 10)), sessionAt(at(-7, 10)), sessionAt(at(-8, 10)), sessionAt(at(-9, 10))], NOW).longest,
  4,
  'the longest run survives a break'
);
assert.strictEqual(
  streaks([...threeDays, sessionAt(at(-3, 10), 30, { deletedAt: '2026-09-16T00:00:00.000Z' })], NOW).longest,
  3,
  'a deleted session does not extend a streak'
);
const noDays = streaks([], NOW);
assert.deepStrictEqual(
  { current: noDays.current, longest: noDays.longest, days: noDays.activeDays.length },
  { current: 0, longest: 0, days: 0 },
  'no sessions means no streak'
);
console.log('\u2713 streak checks passed');

const statsSource = [sessionAt(at(0, 9), 60), sessionAt(at(-1, 9), 30), sessionAt(at(-1, 9), 90, { deletedAt: '2026-09-16T00:00:00.000Z' })];
const stats = studyStats(statsSource, NOW);
assert.strictEqual(stats.totalMs, 90 * MIN_MS, 'a deleted session is not study time');
assert.strictEqual(stats.sessionCount, 2, 'a deleted session is not a session');
assert.strictEqual(stats.activeDayCount, 2, 'days come from the live log');
assert.strictEqual(stats.todayMs, 60 * MIN_MS, 'today is today');
assert.strictEqual(stats.current, 2, 'stats carry the streak');
assert.strictEqual(stats.level, levelProgress(stats.totalMs).level, 'stats carry the level');
console.log('\u2713 study stats checks passed');

assert.strictEqual(countEarned(evaluateBadges([], studyStats([], NOW))), 0, 'an empty log earns nothing');
// 23:00 for two hours: a marathon, a night owl, and an hour on the clock
const nightRun = [sessionAt(at(0, 23), 120)];
const nightIds = evaluateBadges(nightRun, studyStats(nightRun, NOW))
  .filter((badge) => badge.earned)
  .map((badge) => badge.id);
for (const id of ['first-session', 'hour-club', 'marathon', 'night-owl']) {
  assert.ok(nightIds.includes(id), `${id} should be earned by one 2h night session`);
}
for (const id of ['early-bird', 'streak-3', 'ten-hours', 'level-5', 'hundred-sessions']) {
  assert.ok(!nightIds.includes(id), `${id} should not be earned yet`);
}
const earlyRun = [sessionAt(at(0, 6), 30)];
assert.ok(
  evaluateBadges(earlyRun, studyStats(earlyRun, NOW)).find((badge) => badge.id === 'early-bird').earned,
  'a 06:30 start earns EARLY BIRD'
);
const fiveHours = [sessionAt(at(0, 12), 300)];
const fiveHourStats = studyStats(fiveHours, NOW);
assert.strictEqual(fiveHourStats.level, 5, '5 hours is level 5');
assert.ok(
  evaluateBadges(fiveHours, fiveHourStats).find((badge) => badge.id === 'level-5').earned,
  'reaching level 5 earns its badge'
);
assert.strictEqual(new Set(BADGES.map((badge) => badge.id)).size, BADGES.length, 'badge ids are unique');
assert.ok(
  BADGES.every((badge) => badge.label && badge.glyph && badge.requirement),
  'every badge can be rendered'
);
assert.ok(
  evaluateBadges(nightRun, studyStats(nightRun, NOW)).every((badge) => typeof badge.earned === 'boolean'),
  'every badge reports an earned state'
);
console.log('\u2713 badge checks passed');

// Cosmetics: the palette starts open, the rewards start shut, and every gate
// points at a real item — a typo would silently gate nothing.
const fresh = studyStats([], NOW);
assert.strictEqual(
  FRAMES.filter((frame) => isUnlocked(FRAME_UNLOCKS, frame.value, fresh)).length,
  5,
  'the five original frames are free'
);
assert.strictEqual(
  STICKERS.filter((sticker) => isUnlocked(STICKER_UNLOCKS, sticker, fresh)).length,
  10,
  'the ten original stickers are free'
);
assert.strictEqual(Object.keys(FRAME_UNLOCKS).length, 4, 'four frame rewards');
assert.strictEqual(Object.keys(STICKER_UNLOCKS).length, 6, 'six sticker rewards');
for (const value of Object.keys(FRAME_UNLOCKS)) {
  assert.ok(FRAMES.some((frame) => frame.value === value), `${value} is a real frame`);
}
for (const value of Object.keys(STICKER_UNLOCKS)) {
  assert.ok(STICKERS.includes(value), `${value} is a real sticker`);
}
for (const [value, unlock] of Object.entries({ ...FRAME_UNLOCKS, ...STICKER_UNLOCKS })) {
  assert.strictEqual(unlock.earned(fresh), false, `${value} must start locked, or it is not a reward`);
  assert.ok(unlock.label.length > 0, `${value} needs a requirement to show`);
}
assert.strictEqual(unlockFor(FRAME_UNLOCKS, '#2e2218'), null, 'a free cosmetic has no requirement');
assert.ok(
  isUnlocked(FRAME_UNLOCKS, '#c2577a', studyStats(threeDays, NOW)),
  'a 3-day streak earns the ROSE frame'
);
assert.ok(
  !isUnlocked(STICKER_UNLOCKS, '🐉', studyStats(threeDays, NOW)),
  'a 3-day streak does not earn the 7-day sticker'
);
const longHaul = studyStats([sessionAt(at(0, 12), 40 * 60)], NOW);
assert.ok(longHaul.level >= 10, '40 hours is well past level 10');
assert.ok(isUnlocked(FRAME_UNLOCKS, '#3b3355', longHaul), 'the level-10 frame opens at level 10');
assert.ok(isUnlocked(STICKER_UNLOCKS, '🌌', longHaul), 'the level-10 sticker opens at level 10');
assert.ok(!isUnlocked(FRAME_UNLOCKS, '#3b3355', fresh), 'and it is shut before that');
console.log('\u2713 cosmetic unlock checks passed');

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
