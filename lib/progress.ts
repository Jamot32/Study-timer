import { dailyTotals, dayKey, totals, type StudySession, type WeekStart } from './sessions.ts';

/**
 * Everything the profile shows about who the user is as a student: level, streak,
 * and achievements. Pure functions over a session array — no storage, no React —
 * so the same numbers can be shown on the timer, the dashboard, or a shared card
 * without re-deriving them, and the self-check can drive them directly.
 */

/**
 * XP is study time. Level L costs L × STEP more than the level before it, so the
 * first levels land inside the first week and the curve still has room at 50h+:
 * L2 at 30m, L3 at 1h30, L4 at 3h, L5 at 5h, L10 at 27h30.
 */
export const LEVEL_STEP_MS = 30 * 60 * 1000;
export const MAX_LEVEL = 99;

export type LevelProgress = {
  level: number;
  /** Study time earned inside the current level. */
  intoLevelMs: number;
  /** What the current level costs in full. */
  levelCostMs: number;
  /** Study time still needed to reach the next level. */
  remainingMs: number;
  /** 0-1 through the current level. */
  progress: number;
};

export function levelProgress(totalMs: number): LevelProgress {
  const total = Math.max(0, Math.floor(totalMs));
  let level = 1;
  let floor = 0; // study time required to enter `level`
  let cost = LEVEL_STEP_MS * level;
  while (level < MAX_LEVEL && total >= floor + cost) {
    floor += cost;
    level += 1;
    cost = LEVEL_STEP_MS * level;
  }
  const intoLevelMs = total - floor;
  return {
    level,
    intoLevelMs,
    levelCostMs: cost,
    remainingMs: cost - intoLevelMs,
    progress: Math.min(1, intoLevelMs / cost),
  };
}

export type Streaks = {
  /** Consecutive study days ending today, or yesterday while today is still open. */
  current: number;
  /** The longest run of consecutive study days ever recorded. */
  longest: number;
  studiedToday: boolean;
  /** Every local day with study time, oldest first. */
  activeDays: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const fromDayKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function streaks(sessions: StudySession[], now = new Date()): Streaks {
  const byDay = dailyTotals(sessions);
  const activeDays = [...byDay.entries()]
    .filter(([, ms]) => ms > 0)
    .map(([key]) => key)
    .sort();
  const active = new Set(activeDays);

  // Today not being studied yet does not break a streak — it is still in progress
  // until the day ends, so the count simply starts from yesterday.
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (active.has(dayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Days are local midnights, so a DST shift makes a real day 23 or 25 hours long —
  // rounding the gap is what keeps those from reading as a break.
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const key of activeDays) {
    const midnight = fromDayKey(key).getTime();
    run = previous !== null && Math.round((midnight - previous) / DAY_MS) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = midnight;
  }

  return { current, longest, studiedToday: active.has(dayKey(now)), activeDays };
}

export type StudyStats = LevelProgress &
  Streaks & {
    totalMs: number;
    sessionCount: number;
    activeDayCount: number;
    todayMs: number;
    weekMs: number;
    monthMs: number;
  };

export function studyStats(
  sessions: StudySession[],
  now = new Date(),
  weekStartsOn: WeekStart = 1
): StudyStats {
  const live = sessions.filter((session) => session.deletedAt === null);
  const totalMs = live.reduce((sum, session) => sum + session.durationMs, 0);
  const period = totals(sessions, now, weekStartsOn);
  const streak = streaks(sessions, now);
  return {
    totalMs,
    sessionCount: live.length,
    activeDayCount: streak.activeDays.length,
    todayMs: period.todayMs,
    weekMs: period.weekMs,
    monthMs: period.monthMs,
    ...streak,
    ...levelProgress(totalMs),
  };
}

const HOUR_MS = 60 * 60 * 1000;

type BadgeContext = { stats: StudyStats; sessions: StudySession[] };

type BadgeDef = {
  id: string;
  label: string;
  glyph: string;
  requirement: string;
  check: (context: BadgeContext) => boolean;
};

export type Badge = Omit<BadgeDef, 'check'> & { earned: boolean };

/** True when any session started inside the given local hour range. */
const startedWhen = (sessions: StudySession[], test: (hour: number) => boolean) =>
  sessions.some((session) => {
    if (session.deletedAt !== null) return false;
    const started = new Date(session.startedAt);
    return !isNaN(started.getTime()) && test(started.getHours());
  });

export const BADGES: BadgeDef[] = [
  {
    id: 'first-session',
    label: 'FIRST STEP',
    glyph: '🌱',
    requirement: 'FINISH YOUR FIRST SESSION',
    check: ({ stats }) => stats.sessionCount >= 1,
  },
  {
    id: 'ten-sessions',
    label: 'GETTING GOING',
    glyph: '📚',
    requirement: 'FINISH 10 SESSIONS',
    check: ({ stats }) => stats.sessionCount >= 10,
  },
  {
    id: 'hundred-sessions',
    label: 'CENTURION',
    glyph: '🏛',
    requirement: 'FINISH 100 SESSIONS',
    check: ({ stats }) => stats.sessionCount >= 100,
  },
  {
    id: 'ten-days',
    label: 'REGULAR',
    glyph: '🗓',
    requirement: 'STUDY ON 10 DIFFERENT DAYS',
    check: ({ stats }) => stats.activeDayCount >= 10,
  },
  {
    id: 'hour-club',
    label: 'HOUR CLUB',
    glyph: '⏳',
    requirement: 'STUDY FOR 1 HOUR IN TOTAL',
    check: ({ stats }) => stats.totalMs >= HOUR_MS,
  },
  {
    id: 'ten-hours',
    label: 'TEN HOURS',
    glyph: '🔟',
    requirement: 'STUDY FOR 10 HOURS IN TOTAL',
    check: ({ stats }) => stats.totalMs >= 10 * HOUR_MS,
  },
  {
    id: 'fifty-hours',
    label: 'FIFTY HOURS',
    glyph: '🏔',
    requirement: 'STUDY FOR 50 HOURS IN TOTAL',
    check: ({ stats }) => stats.totalMs >= 50 * HOUR_MS,
  },
  {
    id: 'streak-3',
    label: 'THREE IN A ROW',
    glyph: '🔥',
    requirement: 'STUDY 3 DAYS IN A ROW',
    check: ({ stats }) => stats.longest >= 3,
  },
  {
    id: 'streak-7',
    label: 'WEEK STREAK',
    glyph: '⚡',
    requirement: 'STUDY 7 DAYS IN A ROW',
    check: ({ stats }) => stats.longest >= 7,
  },
  {
    id: 'streak-30',
    label: 'MONTH STREAK',
    glyph: '🌟',
    requirement: 'STUDY 30 DAYS IN A ROW',
    check: ({ stats }) => stats.longest >= 30,
  },
  {
    id: 'marathon',
    label: 'MARATHON',
    glyph: '🏃',
    requirement: 'ONE SESSION OF 2 HOURS',
    check: ({ sessions }) => sessions.some((s) => s.deletedAt === null && s.durationMs >= 2 * HOUR_MS),
  },
  {
    id: 'early-bird',
    label: 'EARLY BIRD',
    glyph: '🌅',
    requirement: 'START A SESSION BEFORE 7 AM',
    check: ({ sessions }) => startedWhen(sessions, (hour) => hour < 7),
  },
  {
    id: 'night-owl',
    label: 'NIGHT OWL',
    glyph: '🌙',
    requirement: 'START A SESSION AFTER 10 PM',
    check: ({ sessions }) => startedWhen(sessions, (hour) => hour >= 22),
  },
  {
    id: 'level-5',
    label: 'LEVEL FIVE',
    glyph: '🎖',
    requirement: 'REACH LEVEL 5',
    check: ({ stats }) => stats.level >= 5,
  },
  {
    id: 'level-10',
    label: 'LEVEL TEN',
    glyph: '👑',
    requirement: 'REACH LEVEL 10',
    check: ({ stats }) => stats.level >= 10,
  },
];

export function evaluateBadges(sessions: StudySession[], stats: StudyStats): Badge[] {
  return BADGES.map(({ check, ...badge }) => ({ ...badge, earned: check({ stats, sessions }) }));
}

export function countEarned(badges: Badge[]): number {
  return badges.filter((badge) => badge.earned).length;
}

/**
 * Cosmetics that have to be earned. Anything absent from a table is available
 * from the start — gating is additive, so a look already saved on a device can
 * never be taken away by a later rule.
 */
export type Unlock = { label: string; earned: (stats: StudyStats) => boolean };

export const FRAME_UNLOCKS: Record<string, Unlock> = {
  '#c9a227': { label: 'REACH LEVEL 3', earned: (stats) => stats.level >= 3 },
  '#c2577a': { label: 'A 3-DAY STREAK', earned: (stats) => stats.longest >= 3 },
  '#7fb6c9': { label: '5 HOURS TOTAL', earned: (stats) => stats.totalMs >= 5 * HOUR_MS },
  '#3b3355': { label: 'REACH LEVEL 10', earned: (stats) => stats.level >= 10 },
};

export const STICKER_UNLOCKS: Record<string, Unlock> = {
  '💎': { label: '1 HOUR TOTAL', earned: (stats) => stats.totalMs >= HOUR_MS },
  '🚀': { label: '10 SESSIONS', earned: (stats) => stats.sessionCount >= 10 },
  '🧠': { label: '10 HOURS TOTAL', earned: (stats) => stats.totalMs >= 10 * HOUR_MS },
  '🏆': { label: 'REACH LEVEL 5', earned: (stats) => stats.level >= 5 },
  '🐉': { label: 'A 7-DAY STREAK', earned: (stats) => stats.longest >= 7 },
  '🌌': { label: 'REACH LEVEL 10', earned: (stats) => stats.level >= 10 },
};

/** null when the cosmetic is free — the UI treats null as available. */
export function unlockFor(unlocks: Record<string, Unlock>, value: string): Unlock | null {
  return unlocks[value] ?? null;
}

export function isUnlocked(
  unlocks: Record<string, Unlock>,
  value: string,
  stats: StudyStats
): boolean {
  const unlock = unlockFor(unlocks, value);
  return !unlock || unlock.earned(stats);
}
