// Run: node --experimental-strip-types lib/sync/consent.self-check.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const values = new Map();
globalThis.__studySyncTestStorage = {
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => { values.set(key, value); },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@react-native-async-storage/async-storage') {
      return {
        url: 'data:text/javascript,export default globalThis.__studySyncTestStorage',
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { createSyncEngine, SYNC_STATE_STORAGE_KEY } = await import('./index.ts');
const { loadAllSessions, replaceAllSessions } = await import('../sessions.ts');
const auth = (email) => ({ user: { email }, syncToken: email });
const row = (id, updatedAt = '2026-01-01T00:00:00.000Z') => ({
  id, startedAt: updatedAt, endedAt: updatedAt, durationMs: 60000,
  subject: null, type: 'stopwatch', source: 'timer', schemaVersion: 1,
  updatedAt, deletedAt: null,
});
let pulls = 0;
const pushes = [];
let remote = [];
const gateway = {
  pull: async () => {
    pulls++;
    return { sessions: remote, serverAt: '2026-01-02T00:00:00.000Z' };
  },
  push: async (token, sessions) => {
    pushes.push({ token, sessions });
    return { serverAt: '2026-01-02T00:00:00.000Z' };
  },
};
const a = auth('A@example.com');
const b = auth('b@example.com');

await replaceAllSessions([row('guest')]);
let engine = createSyncEngine(gateway);
assert.equal((await engine.syncSessions(a)).state, 'needs-consent');
assert.equal(engine.getSyncStatus().consentEmail, 'a@example.com');
assert.equal(pulls, 0);
assert.equal(pushes.length, 0);
assert.equal(values.has(SYNC_STATE_STORAGE_KEY), false);

// Restarting/restoring the session must still ask; declining must persist first.
engine = createSyncEngine(gateway);
assert.equal((await engine.syncSessions(a)).state, 'needs-consent');
assert.equal((await engine.syncSessions(a, 'keep-local')).state, 'ok');
assert.equal(pushes.length, 0);
assert.deepEqual((await loadAllSessions()).map((s) => s.id), ['guest']);
assert.deepEqual(JSON.parse(values.get(SYNC_STATE_STORAGE_KEY)).localOnlyIds, ['guest']);

// Neither editing/deleting a declined row nor a newer remote copy can upload/replace it.
const deletedGuest = { ...row('guest', '2099-01-01T00:00:00.000Z'), deletedAt: '2099-01-01T00:00:00.000Z' };
await replaceAllSessions([deletedGuest, row('new-account-row', '2099-01-01T00:00:00.000Z')]);
remote = [row('guest', '2100-01-01T00:00:00.000Z'), row('remote')];
engine = createSyncEngine(gateway);
assert.equal((await engine.syncSessions(a)).state, 'ok');
assert.deepEqual(pushes.at(-1).sessions.map((s) => s.id), ['new-account-row']);
assert.deepEqual((await loadAllSessions()).find((s) => s.id === 'guest'), deletedGuest);

await engine.resetSyncState();
engine = createSyncEngine(gateway);
assert.equal((await engine.syncSessions(b)).state, 'ok');
assert.deepEqual((await loadAllSessions()).map((s) => s.id).sort(), ['guest', 'remote']);
assert.ok(pushes.every((p) => p.sessions.every((s) => s.id !== 'guest')));

// Accepting an old-format guest store retains pull/merge/upload behavior.
values.clear();
pushes.length = 0;
remote = [row('remote')];
await replaceAllSessions([row('accepted-guest')]);
values.set(SYNC_STATE_STORAGE_KEY, JSON.stringify({ email: null }));
engine = createSyncEngine(gateway);
assert.equal((await engine.syncSessions(a)).state, 'needs-consent');
assert.equal((await engine.syncSessions(a, 'upload')).state, 'ok');
assert.deepEqual(pushes[0].sessions.map((s) => s.id), ['accepted-guest']);
assert.deepEqual((await loadAllSessions()).map((s) => s.id).sort(), ['accepted-guest', 'remote']);

// A fresh guest store with no rows needs no prompt.
values.clear();
engine = createSyncEngine(gateway);
assert.equal((await engine.syncSessions(a)).state, 'ok');

// A foreground sync queued during the consent check cannot discard the user's choice.
values.clear();
remote = [];
await replaceAllSessions([row('queued-guest')]);
engine = createSyncEngine(gateway);
const waiting = engine.syncSessions(a);
void engine.syncSessions(a, 'keep-local');
void engine.syncSessions(a);
await waiting;
await new Promise((resolve) => {
  if (engine.getSyncStatus().state === 'ok') return resolve();
  const unsubscribe = engine.subscribeSyncStatus((status) => {
    if (status.state === 'ok') {
      unsubscribe();
      resolve();
    }
  });
});
assert.deepEqual(JSON.parse(values.get(SYNC_STATE_STORAGE_KEY)).localOnlyIds, ['queued-guest']);
console.log('Guest upload consent self-check passed.');
