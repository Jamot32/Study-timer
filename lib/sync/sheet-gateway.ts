import type { AuthErrorCode } from '../auth/types';
import type { StudySession } from '../sessions';

/** Backend seam: the Apps Script sheet now, Supabase later. */
export interface SyncGateway {
  push(token: string, sessions: StudySession[]): Promise<{ serverAt: string }>;
  /** `since` is inclusive; null pulls everything. */
  pull(token: string, since: string | null): Promise<{ sessions: StudySession[]; serverAt: string }>;
}

export class SyncError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
  }
}

/** Server limit per push (SYNC_MAX_BATCH in apps-script/Sync.gs). */
export const PUSH_CHUNK = 500;

type SyncResponse =
  | { ok: true; serverAt: string; sessions?: StudySession[] }
  | { ok: false; code?: AuthErrorCode; error?: string };

// Same endpoint and request shape as lib/auth/google-sheet-auth.ts (its helpers are not exported).
async function call(body: object): Promise<{ serverAt: string; sessions?: StudySession[] }> {
  const url = process.env.EXPO_PUBLIC_AUTH_ENDPOINT?.trim();
  if (!url) throw new SyncError('not-configured', 'Sync has not been configured for this build.');

  let response: Response;
  try {
    // text/plain keeps this a CORS "simple request"; Apps Script cannot answer a preflight.
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SyncError('network', 'Could not reach the sync server.');
  }

  let payload: SyncResponse;
  try {
    payload = (await response.json()) as SyncResponse;
  } catch {
    throw new SyncError('invalid-response', 'The sync server returned an invalid response.');
  }
  if (!response.ok || !payload.ok) {
    const code = payload.ok ? 'invalid-response' : (payload.code ?? 'provider-error');
    const message = payload.ok ? 'Sync failed.' : (payload.error ?? 'Sync failed.');
    throw new SyncError(code, message);
  }
  return payload;
}

export const sheetGateway: SyncGateway = {
  async push(token, sessions) {
    let serverAt = new Date().toISOString();
    for (let i = 0; i < sessions.length; i += PUSH_CHUNK) {
      ({ serverAt } = await call({
        action: 'push',
        syncToken: token,
        sessions: sessions.slice(i, i + PUSH_CHUNK),
      }));
    }
    return { serverAt };
  },

  async pull(token, since) {
    const { sessions, serverAt } = await call({ action: 'pull', syncToken: token, since });
    if (!Array.isArray(sessions)) {
      throw new SyncError('invalid-response', 'The sync server returned an invalid response.');
    }
    return { sessions, serverAt };
  },
};
