/**
 * Undo/redo over whole snapshots, for editors that write every change straight
 * through. There is no "cancel" in such a flow, so the way back is a stack.
 *
 * Pure and generic on purpose: the self-check drives it without React, and the
 * editor keeps the result in state. Snapshots are compared by JSON, which is
 * exact here because every Profile is built by normalizeProfile — the same keys
 * in the same order — so key order can never fake a difference.
 */
export type History<T> = {
  /** Oldest first; the last entry is what the next undo restores. */
  past: T[];
  present: T;
  /** Nearest redo first. */
  future: T[];
};

/** Enough to walk back through a long sticker session without hoarding memory. */
export const HISTORY_LIMIT = 30;

const same = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * Records `next`, keeping `base` undoable. Use it for gestures, where the frames
 * in between went through `replace()` and never entered the stack — the base is
 * the snapshot the gesture started from, not the current present.
 */
export function commitFrom<T>(history: History<T>, base: T, next: T): History<T> {
  if (same(base, next)) return history;
  return {
    past: [...history.past, base].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

/** A plain edit: the current present becomes the next undo step. */
export function commit<T>(history: History<T>, next: T): History<T> {
  return commitFrom(history, history.present, next);
}

/**
 * Swaps the present without touching the stack — for a drag frame, which must
 * not create one undo step per frame.
 */
export function replace<T>(history: History<T>, next: T): History<T> {
  return same(history.present, next) ? history : { ...history, present: next };
}

export function undo<T>(history: History<T>): History<T> {
  const base = history.past[history.past.length - 1];
  if (base === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: base,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...future] = history.future;
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future,
  };
}

export const canUndo = <T,>(history: History<T>) => history.past.length > 0;
export const canRedo = <T,>(history: History<T>) => history.future.length > 0;
