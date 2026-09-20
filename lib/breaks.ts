import { storage } from './sessions';

export const BREAKS_STORAGE_KEY = '@study_timer/breaks';

/** One hour of focus is worth this many minutes of paid break. */
export const MINUTES_PER_HOUR = 5;

export type BreakBank = { minutes: number };

export const EMPTY_BREAK_BANK: BreakBank = { minutes: 0 };

function normalize(raw: unknown): BreakBank {
  if (!raw || typeof raw !== 'object') return EMPTY_BREAK_BANK;
  const minutes = (raw as Partial<BreakBank>).minutes;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return EMPTY_BREAK_BANK;
  }
  return { minutes: Math.floor(minutes) };
}

export async function loadBreakBank(): Promise<BreakBank> {
  try {
    const raw = await storage.getItem(BREAKS_STORAGE_KEY);
    if (!raw) return EMPTY_BREAK_BANK;
    return normalize(JSON.parse(raw));
  } catch {
    return EMPTY_BREAK_BANK;
  }
}

async function write(bank: BreakBank): Promise<BreakBank> {
  try {
    await storage.setItem(BREAKS_STORAGE_KEY, JSON.stringify(bank));
  } catch (error) {
    console.error('Failed to save break bank:', error);
  }
  return bank;
}

/** Credit earned break minutes. Hours already paid out are the caller's to track. */
export async function addBreakMinutes(minutes: number): Promise<BreakBank> {
  if (!(minutes > 0)) return loadBreakBank();
  const current = await loadBreakBank();
  return write({ minutes: current.minutes + Math.floor(minutes) });
}

/** Spend minutes. Returns null when the bank cannot cover them. */
export async function spendBreakMinutes(minutes: number): Promise<BreakBank | null> {
  const current = await loadBreakBank();
  if (minutes <= 0 || current.minutes < minutes) return null;
  return write({ minutes: current.minutes - minutes });
}

export async function clearBreakBank(): Promise<void> {
  try {
    await storage.removeItem(BREAKS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear break bank:', error);
  }
}
