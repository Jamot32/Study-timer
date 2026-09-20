import { QUOTES, RARE_QUOTES, type Quote } from '../components/quotes';
import { storage } from './sessions';

export const CANON_STORAGE_KEY = '@study_timer/canon';

/**
 * What the book remembers. `seen` holds canon ids (an index into the common
 * quotes, or `r<n>` for a rare one) so a reordered QUOTES list cannot silently
 * re-lock anything. `cycles` counts how many times the whole canon was read
 * through — once every quote is seen, the pool refills.
 */
export type Canon = { seen: string[]; cycles: number };

export const EMPTY_CANON: Canon = { seen: [], cycles: 0 };

/** What a rare quote is unlocked by. Everything is read from saved history. */
export type CanonStats = {
  /** Longest single day of study, in ms. */
  bestDayMs: number;
  /** Consecutive days studied. */
  streakDays: number;
  /** Finished sessions, all-time. */
  sessions: number;
};

export const NO_STATS: CanonStats = { bestDayMs: 0, streakDays: 0, sessions: 0 };

const HOUR_MS = 60 * 60 * 1000;

/**
 * Each rare quote is earned, not found. The index matches RARE_QUOTES.
 * Keep the order: the id `r<n>` is what gets written down as seen.
 */
export const RARE_UNLOCKS: Array<{ label: string; met: (s: CanonStats) => boolean }> = [
  { label: 'FINISH YOUR FIRST SESSION', met: (s) => s.sessions >= 1 },
  { label: 'STUDY 5 HOURS IN ONE DAY', met: (s) => s.bestDayMs >= 5 * HOUR_MS },
  { label: 'KEEP A 7 DAY STREAK', met: (s) => s.streakDays >= 7 },
  { label: 'FINISH 50 SESSIONS', met: (s) => s.sessions >= 50 },
  { label: 'KEEP A 30 DAY STREAK', met: (s) => s.streakDays >= 30 },
];

export const commonId = (index: number) => String(index);
export const rareId = (index: number) => `r${index}`;

/** Every quote the reader has earned the right to find. */
export function unlockedIds(stats: CanonStats): string[] {
  const ids = QUOTES.map((_, i) => commonId(i));
  RARE_UNLOCKS.forEach((unlock, i) => {
    if (i < RARE_QUOTES.length && unlock.met(stats)) ids.push(rareId(i));
  });
  return ids;
}

export function quoteFor(id: string): Quote {
  if (id.startsWith('r')) {
    return RARE_QUOTES[Number(id.slice(1))] ?? QUOTES[0];
  }
  return QUOTES[Number(id)] ?? QUOTES[0];
}

export function isRare(id: string): boolean {
  return id.startsWith('r');
}

/**
 * The next quote to show. Unseen ones come first, so the canon is read through
 * before anything repeats; when none are left the pool refills and `cycles`
 * ticks up. `pickRandom` is injectable so the self-check can be deterministic.
 */
export function nextQuoteId(
  canon: Canon,
  stats: CanonStats,
  pickRandom: (length: number) => number = (length) => Math.floor(Math.random() * length)
): { id: string; canon: Canon; fresh: boolean } {
  const unlocked = unlockedIds(stats);
  const seen = new Set(canon.seen);
  const unseen = unlocked.filter((id) => !seen.has(id));

  if (unseen.length > 0) {
    const id = unseen[Math.min(unseen.length - 1, Math.max(0, pickRandom(unseen.length)))];
    return { id, canon: { ...canon, seen: [...canon.seen, id] }, fresh: true };
  }

  // the whole canon has been read: start it over, keeping the tally
  const id = unlocked[Math.min(unlocked.length - 1, Math.max(0, pickRandom(unlocked.length)))];
  return { id, canon: { seen: [id], cycles: canon.cycles + 1 }, fresh: false };
}

function normalize(raw: unknown): Canon {
  if (!raw || typeof raw !== 'object') return EMPTY_CANON;
  const canon = raw as Partial<Canon>;
  const seen = Array.isArray(canon.seen)
    ? canon.seen.filter((id): id is string => typeof id === 'string')
    : [];
  const cycles =
    typeof canon.cycles === 'number' && Number.isFinite(canon.cycles) && canon.cycles > 0
      ? Math.floor(canon.cycles)
      : 0;
  return { seen: Array.from(new Set(seen)), cycles };
}

export async function loadCanon(): Promise<Canon> {
  try {
    const raw = await storage.getItem(CANON_STORAGE_KEY);
    if (!raw) return EMPTY_CANON;
    return normalize(JSON.parse(raw));
  } catch {
    return EMPTY_CANON;
  }
}

export async function saveCanon(canon: Canon): Promise<Canon> {
  try {
    await storage.setItem(CANON_STORAGE_KEY, JSON.stringify(canon));
  } catch (error) {
    console.error('Failed to save canon:', error);
  }
  return canon;
}

/** Draw the next quote and write it down as read. */
export async function drawQuote(
  stats: CanonStats
): Promise<{ id: string; quote: Quote; rare: boolean; canon: Canon }> {
  const current = await loadCanon();
  const { id, canon } = nextQuoteId(current, stats);
  await saveCanon(canon);
  return { id, quote: quoteFor(id), rare: isRare(id), canon };
}

export async function clearCanon(): Promise<void> {
  try {
    await storage.removeItem(CANON_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear canon:', error);
  }
}
