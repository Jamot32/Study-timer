import type { AuthSession } from '../auth/types';
import { loadAllSessions, replaceAllSessions, storage } from '../sessions.ts';
import { changedSince, mergeSessions } from './merge.ts';
import { sheetGateway, SyncError, type SyncGateway } from './sheet-gateway.ts';

export type SyncState = 'idle' | 'syncing' | 'ok' | 'error' | 'signed-out' | 'needs-sign-in';
export type SyncStatus = { state: SyncState; lastSyncedAt: string | null; error?: string };
export type { SyncGateway } from './sheet-gateway.ts';

export const SYNC_STATE_STORAGE_KEY = '@study_timer/sync-state';

type StoredSyncState = {
  /** Account the local rows belong to; null = guest rows, uploaded on the next sign-in. */
  email: string | null;
  /** serverAt of the last successful pull. */
  cursor: string | null;
  /** Local clock: rows updated after this may not be on the server yet. */
  lastPushedAt: string | null;
  lastSyncedAt: string | null;
};

const EMPTY_STATE: StoredSyncState = { email: null, cursor: null, lastPushedAt: null, lastSyncedAt: null };

async function loadState(): Promise<StoredSyncState> {
  try {
    const raw = await storage.getItem(SYNC_STATE_STORAGE_KEY);
    return raw ? { ...EMPTY_STATE, ...JSON.parse(raw) } : { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

async function saveState(state: StoredSyncState): Promise<void> {
  await storage.setItem(SYNC_STATE_STORAGE_KEY, JSON.stringify(state));
}

/** Engine factory; the module exports one instance bound to the sheet. self-check injects a fake gateway. */
export function createSyncEngine(gateway: SyncGateway) {
  let status: SyncStatus = { state: 'idle', lastSyncedAt: null };
  const listeners = new Set<(s: SyncStatus) => void>();
  let inFlight: Promise<SyncStatus> | null = null;
  let queued: { auth: AuthSession | null; generation: number } | null = null;
  let generation = 0;
  let authKey: string | null = null;
  let pendingWrite: Promise<void> = Promise.resolve();

  // Reset must follow an already-issued local write, but never wait on a slow network call.
  function write(operation: () => Promise<void>, runGeneration?: number): Promise<void> {
    pendingWrite = pendingWrite.catch(() => {}).then(() => {
      if (runGeneration === undefined || runGeneration === generation) return operation();
    });
    return pendingWrite;
  }

  function setStatus(next: SyncStatus): SyncStatus {
    status = next;
    listeners.forEach((listener) => listener(next));
    return next;
  }

  async function run(auth: AuthSession | null, runGeneration: number): Promise<SyncStatus> {
    const isCurrent = () => runGeneration === generation;
    await pendingWrite.catch(() => {});
    if (!isCurrent()) return status;
    if (!auth) return setStatus({ state: 'signed-out', lastSyncedAt: null });
    const token = auth.syncToken;
    if (!token) return setStatus({ state: 'needs-sign-in', lastSyncedAt: status.lastSyncedAt });

    let state = await loadState();
    if (!isCurrent()) return status;
    setStatus({ state: 'syncing', lastSyncedAt: state.lastSyncedAt });
    try {
      if (!isCurrent()) return status;
      const email = auth.user.email.trim().toLowerCase();
      if (state.email !== null && state.email !== email) {
        // ponytail: a different account signed in on this device. Its rows must not be pushed
        // to the new account, so drop them and start fresh; ceiling: edits the previous account
        // never synced from this device are lost. Upgrade: per-account storage keys.
        await write(() => replaceAllSessions([]), runGeneration);
        if (!isCurrent()) return status;
        state = { ...EMPTY_STATE };
      }
      if (state.email !== email) {
        state = { ...state, email };
        await write(() => saveState(state), runGeneration);
        if (!isCurrent()) return status;
      }

      // Pull before push: the merge decides which local rows are still winners worth sending.
      const pulled = await gateway.pull(token, state.cursor);
      if (!isCurrent()) return status;
      // 1 ms back so a row saved in this same millisecond still counts as "after" next run.
      const startedAt = new Date(Date.now() - 1).toISOString();
      const local = await loadAllSessions();
      if (!isCurrent()) return status;
      const merged = mergeSessions(local, pulled.sessions);
      await write(() => replaceAllSessions(merged), runGeneration);
      if (!isCurrent()) return status;
      state = { ...state, cursor: pulled.serverAt };
      await write(() => saveState(state), runGeneration);
      if (!isCurrent()) return status;

      // Only local rows that won the merge and changed since the last push; pulled rows are
      // already on the server. mergeSessions keeps object identity, so === means "local won".
      const winners = new Set(merged);
      const outgoing = changedSince(local, state.lastPushedAt).filter((s) => winners.has(s));
      if (outgoing.length) await gateway.push(token, outgoing);
      if (!isCurrent()) return status;

      state = { ...state, lastPushedAt: startedAt, lastSyncedAt: new Date().toISOString() };
      await write(() => saveState(state), runGeneration);
      if (!isCurrent()) return status;
      return setStatus({ state: 'ok', lastSyncedAt: state.lastSyncedAt });
    } catch (error) {
      if (!isCurrent()) return status;
      if (error instanceof SyncError && (error.code === 'not-approved' || error.code === 'disabled')) {
        return setStatus({ state: 'needs-sign-in', lastSyncedAt: state.lastSyncedAt, error: error.message });
      }
      const message = error instanceof Error ? error.message : 'Sync failed.';
      return setStatus({ state: 'error', lastSyncedAt: state.lastSyncedAt, error: message });
    }
  }

  function syncSessions(auth: AuthSession | null): Promise<SyncStatus> {
    const nextKey = auth ? JSON.stringify([auth.user.email.trim().toLowerCase(), auth.syncToken]) : null;
    if (nextKey !== authKey) {
      generation += 1;
      authKey = nextKey;
    }
    queued = { auth, generation };
    if (!auth) setStatus({ state: 'signed-out', lastSyncedAt: null });
    if (inFlight) return inFlight;
    // Every caller awaits the whole drain, including the latest auth (even null).
    inFlight = (async () => {
      try {
        while (queued) {
          const next = queued;
          queued = null;
          await run(next.auth, next.generation);
        }
        return status;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  return {
    syncSessions,
    getSyncStatus: (): SyncStatus => status,
    subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * Called on sign-out. Clears cursor and push/sync times but keeps `email` as the last owner:
     * clearing it would make the leftover rows look like guest data and upload them to whichever
     * account signs in next. Signing back in as the same account re-pulls everything and re-sends
     * local rows (the server ignores ones it already has).
     */
    async resetSyncState(): Promise<void> {
      generation += 1;
      void syncSessions(null);
      await write(async () => {
        const { email } = await loadState();
        await saveState({ ...EMPTY_STATE, email });
      });
    },
  };
}

const engine = createSyncEngine(sheetGateway);
export const { syncSessions, getSyncStatus, subscribeSyncStatus, resetSyncState } = engine;
