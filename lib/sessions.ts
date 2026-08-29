import AsyncStorage from '@react-native-async-storage/async-storage';

/** Shared by lib/settings.ts too — keep this the only AsyncStorage interop shim. */
export const storage = (AsyncStorage as any)?.default?.getItem
  ? (AsyncStorage as any).default
  : AsyncStorage;

export type StudySession = {
  id: string;
  startedAt: string;      // ISO, wall-clock
  endedAt: string;        // ISO
  durationMs: number;     // running time only, excludes paused time
  subject: string | null; // null renders as "Unlabeled"
  type: 'stopwatch';
  source: 'timer';
  schemaVersion: 1;
  updatedAt: string;      // ISO
  deletedAt: string | null;
};

/** 0 = Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;

export const MIN_SESSION_MS = 60000;
export const SESSIONS_STORAGE_KEY = '@study_timer/sessions';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function loadSessions(): Promise<StudySession[]> {
  try {
    const raw = await storage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is StudySession =>
          Boolean(s && typeof s === 'object' && s.deletedAt === null)
      )
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
  } catch {
    return [];
  }
}

export async function saveSession(
  input: {
    startedAt: string;
    endedAt: string;
    durationMs: number;
    subject?: string | null;
  },
  minSessionMs: number = MIN_SESSION_MS
): Promise<StudySession | null> {
  if (input.durationMs < minSessionMs) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const session: StudySession = {
    id: generateId(),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    subject: input.subject ?? null,
    type: 'stopwatch',
    source: 'timer',
    schemaVersion: 1,
    updatedAt: nowIso,
    deletedAt: null,
  };

  try {
    const raw = await storage.getItem(SESSIONS_STORAGE_KEY);
    let existing: StudySession[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          existing = parsed;
        }
      } catch {
        existing = [];
      }
    }
    const updated = [session, ...existing];
    await storage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    return session;
  } catch (error) {
    console.error('Failed to save session:', error);
    return null;
  }
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isSameMonth(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth()
  );
}

/** Midnight on the first day of d's week. Single source of truth for week boundaries. */
export function getWeekStart(d: Date, weekStartsOn: WeekStart = 1): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diffToStart = (dayOfWeek - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - diffToStart);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameWeek(d1: Date, d2: Date, weekStartsOn: WeekStart): boolean {
  return getWeekStart(d1, weekStartsOn).getTime() === getWeekStart(d2, weekStartsOn).getTime();
}

export function totals(
  sessions: StudySession[],
  now?: Date,
  weekStartsOn: WeekStart = 1
): { todayMs: number; weekMs: number; monthMs: number } {
  const refDate = now ?? new Date();
  let todayMs = 0;
  let weekMs = 0;
  let monthMs = 0;

  for (const session of sessions) {
    if (session.deletedAt !== null) continue;
    const sessionDate = new Date(session.startedAt);
    if (isNaN(sessionDate.getTime())) continue;

    if (isSameDay(sessionDate, refDate)) {
      todayMs += session.durationMs;
    }
    if (isSameWeek(sessionDate, refDate, weekStartsOn)) {
      weekMs += session.durationMs;
    }
    if (isSameMonth(sessionDate, refDate)) {
      monthMs += session.durationMs;
    }
  }

  return { todayMs, weekMs, monthMs };
}

export function sessionsForDay(
  sessions: StudySession[],
  day?: Date
): StudySession[] {
  const refDate = day ?? new Date();
  return sessions
    .filter((session) => {
      if (session.deletedAt !== null) return false;
      const sessionDate = new Date(session.startedAt);
      if (isNaN(sessionDate.getTime())) return false;
      return isSameDay(sessionDate, refDate);
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export async function clearSessions(): Promise<void> {
  try {
    await storage.removeItem(SESSIONS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear sessions:', error);
  }
}

/** Local (not UTC) YYYY-MM-DD — must match the local-day logic in totals()/sessionsForDay(). */
export function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Studied ms per local day. Days with no sessions are absent from the map. */
export function dailyTotals(sessions: StudySession[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const session of sessions) {
    if (session.deletedAt !== null) continue;
    const started = new Date(session.startedAt);
    if (isNaN(started.getTime())) continue;
    const key = dayKey(started);
    byDay.set(key, (byDay.get(key) ?? 0) + session.durationMs);
  }
  return byDay;
}
