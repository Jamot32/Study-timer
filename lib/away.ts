/** How long the app may sit in the background before a focus session is banked. */
export const AWAY_LIMIT_MS = 5 * 60 * 1000;

export type AwayOutcome = 'finish' | 'reset' | 'resume' | 'idle';

/**
 * What to do when the app comes back to the foreground.
 * A SHORT BREAK was paid for out of the break bank, so being away during one
 * costs nothing; any other absence over the limit ends the session.
 */
export function awayOutcome(
  awayMs: number,
  { onBreak, hasTime, wasRunning }: { onBreak: boolean; hasTime: boolean; wasRunning: boolean }
): AwayOutcome {
  if (!onBreak && awayMs > AWAY_LIMIT_MS) return hasTime ? 'finish' : 'reset';
  return wasRunning ? 'resume' : 'idle';
}
