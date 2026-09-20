import { storage } from './sessions';

export const ROLLS_STORAGE_KEY = '@study_timer/rolls';

/** Every full half hour of a finished session earns one roll on top of the first. */
export const ROLL_EARN_MS = 30 * 60 * 1000;
/** Tickets stop piling up so a long day cannot bank a month of rolls. */
export const MAX_TICKETS = 9;

export type RollBank = {
  tickets: number;
  /** Rolls spent all-time — the book keeps count of how often it was opened. */
  spent: number;
};

export const EMPTY_BANK: RollBank = { tickets: 0, spent: 0 };

/**
 * What a finished session is worth. Sitting down at all earns the first roll;
 * every further half hour earns another. A session that never got saved
 * (durationMs 0) earns nothing.
 */
export function earnedRolls(durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  return 1 + Math.floor(durationMs / ROLL_EARN_MS);
}

function normalize(raw: unknown): RollBank {
  if (!raw || typeof raw !== 'object') return EMPTY_BANK;
  const bank = raw as Partial<RollBank>;
  const clamp = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return {
    tickets: Math.min(MAX_TICKETS, clamp(bank.tickets)),
    spent: clamp(bank.spent),
  };
}

export async function loadRolls(): Promise<RollBank> {
  try {
    const raw = await storage.getItem(ROLLS_STORAGE_KEY);
    if (!raw) return EMPTY_BANK;
    return normalize(JSON.parse(raw));
  } catch {
    return EMPTY_BANK;
  }
}

async function write(bank: RollBank): Promise<RollBank> {
  try {
    await storage.setItem(ROLLS_STORAGE_KEY, JSON.stringify(bank));
  } catch (error) {
    console.error('Failed to save rolls:', error);
  }
  return bank;
}

/** Credit a finished session. Returns the new bank and what this session added. */
export async function earnRolls(
  durationMs: number
): Promise<{ bank: RollBank; earned: number }> {
  const current = await loadRolls();
  const earned = Math.min(earnedRolls(durationMs), MAX_TICKETS - current.tickets);
  if (earned <= 0) return { bank: current, earned: 0 };
  const bank = await write({ ...current, tickets: current.tickets + earned });
  return { bank, earned };
}

/** Spend one ticket. Returns null when the bank is empty — the caller must not roll. */
export async function spendRoll(): Promise<RollBank | null> {
  const current = await loadRolls();
  if (current.tickets <= 0) return null;
  return write({ tickets: current.tickets - 1, spent: current.spent + 1 });
}

export async function clearRolls(): Promise<void> {
  try {
    await storage.removeItem(ROLLS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear rolls:', error);
  }
}
