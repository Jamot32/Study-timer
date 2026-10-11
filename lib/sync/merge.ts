import type { StudySession } from '../sessions';

const time = (iso: string) => Date.parse(iso);

/** True if `a` should replace `b`: later updatedAt wins; on a tie, a tombstone wins. */
function beats(a: StudySession, b: StudySession): boolean {
  const diff = time(a.updatedAt) - time(b.updatedAt);
  if (diff !== 0) return diff > 0;
  return a.deletedAt !== null && b.deletedAt === null;
}

/** Last-write-wins merge by id. Pure; result includes tombstones. */
export function mergeSessions(
  local: StudySession[],
  remote: StudySession[]
): StudySession[] {
  const byId = new Map<string, StudySession>();
  for (const s of [...local, ...remote]) {
    const cur = byId.get(s.id);
    if (!cur || beats(s, cur)) byId.set(s.id, s);
  }
  return [...byId.values()];
}

/** Rows with updatedAt after `iso`; all rows when `iso` is null. */
export function changedSince(
  rows: StudySession[],
  iso: string | null
): StudySession[] {
  if (iso === null) return rows.slice();
  const since = time(iso);
  return rows.filter((s) => time(s.updatedAt) > since);
}
