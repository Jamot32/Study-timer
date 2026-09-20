import { dailyTotals, dayKey, getWeekStart, type StudySession, type WeekStart } from './sessions';

/**
 * Consecutive days of study, counting back from today.
 *
 * A day with no time yet does not break the streak until it is over, so a
 * morning with nothing studied still shows yesterday's run. Once yesterday is
 * empty too, the streak is gone.
 */
export function studyStreak(sessions: StudySession[], now?: Date): number {
  const byDay = dailyTotals(sessions);
  const cursor = now ? new Date(now) : new Date();
  cursor.setHours(0, 0, 0, 0);

  // today counts when it has time; when it does not, start from yesterday
  if (!(byDay.get(dayKey(cursor))! > 0)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let days = 0;
  while (byDay.get(dayKey(cursor))! > 0) {
    days += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

/** The longest single session of the current week, in ms. */
export function weeklyLongestMs(
  sessions: StudySession[],
  now?: Date,
  weekStartsOn: WeekStart = 1
): number {
  const refDate = now ?? new Date();
  const start = getWeekStart(refDate, weekStartsOn).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;

  let longest = 0;
  for (const session of sessions) {
    if (session.deletedAt !== null) continue;
    const startedAt = new Date(session.startedAt).getTime();
    if (isNaN(startedAt) || startedAt < start || startedAt >= end) continue;
    if (session.durationMs > longest) longest = session.durationMs;
  }
  return longest;
}
