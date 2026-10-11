// Study-session sync. Shares global scope with Code.gs (DEFAULT_SPREADSHEET_ID, normalize_, authError_).
const SESSIONS_SHEET_NAME = 'Sessions';
const SESSION_COLUMNS = [
  'email', 'id', 'startedAt', 'endedAt', 'durationMs', 'subject', 'type', 'source',
  'schemaVersion', 'updatedAt', 'deletedAt', 'serverAt',
];
const SYNC_MAX_BATCH = 500;
const SYNC_LOCK_TIMEOUT_MS = 10000;
const SYNC_MAX_ID_LENGTH = 100;
const SYNC_MAX_SUBJECT_LENGTH = 200;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function handleSync_(body, email) {
  const lock = LockService.getScriptLock();
  try {
    const owner = normalize_(email);
    if (!owner) throw authError_('not-approved', 'Missing sync identity.');

    let sessions = null;
    if (body.action === 'push') {
      if (!Array.isArray(body.sessions)) throw authError_('invalid-response', 'sessions must be an array.');
      if (body.sessions.length > SYNC_MAX_BATCH) {
        throw authError_('invalid-response', 'Too many sessions in one push (max ' + SYNC_MAX_BATCH + ').');
      }
      sessions = body.sessions.map(function (session, index) { return validateSession_(session, index); });
    } else if (body.action === 'pull') {
      if (body.since !== null && body.since !== undefined && !isIso_(body.since)) {
        throw authError_('invalid-response', 'since must be an ISO date or null.');
      }
    } else {
      throw authError_('invalid-response', 'Unknown sync action.');
    }

    // Pull takes the lock too: serverAt must be captured after any in-flight push commits.
    if (!lock.tryLock(SYNC_LOCK_TIMEOUT_MS)) throw authError_('provider-error', 'Sync is busy. Try again.');
    const serverAt = new Date().toISOString();
    const sheet = getSessionsSheet_();
    // ponytail: reads the whole tab (every user) per request; fine for the beta, Supabase replaces it.
    const values = sheet.getDataRange().getValues();
    checkSessionsHeader_(values[0]);

    if (sessions) {
      if (applyPush_(values, owner, sessions, serverAt)) {
        const range = sheet.getRange(1, 1, values.length, SESSION_COLUMNS.length);
        range.setNumberFormat('@');
        range.setValues(values);
      }
      return { ok: true, serverAt: serverAt };
    }
    return { ok: true, sessions: selectSessions_(values, owner, body.since || null), serverAt: serverAt };
  } catch (error) {
    const code = error && error.code ? error.code : 'provider-error';
    const message = error && error.message ? error.message : 'Sync failed.';
    console.error(JSON.stringify({ code: code, message: message }));
    return { ok: false, code: code, error: message };
  } finally {
    lock.releaseLock();
  }
}

function getSessionsSheet_() {
  const spreadsheetId =
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(SESSIONS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SESSIONS_SHEET_NAME);
    // Plain text everywhere so Sheets never turns ISO strings into Dates, ids into numbers or subjects into formulas.
    sheet.getRange(1, 1, sheet.getMaxRows(), SESSION_COLUMNS.length).setNumberFormat('@');
    sheet.getRange(1, 1, 1, SESSION_COLUMNS.length).setValues([SESSION_COLUMNS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function checkSessionsHeader_(header) {
  const ok = header && SESSION_COLUMNS.every(function (name, index) { return String(header[index]).trim() === name; });
  if (!ok) throw authError_('provider-error', 'The Sessions worksheet header does not match the expected columns.');
}

function isIso_(value) {
  return typeof value === 'string' && ISO_PATTERN.test(value) && !isNaN(Date.parse(value));
}

/** Returns a clean StudySession or throws; any client-sent email is ignored. */
function validateSession_(session, index) {
  const fail = function (field) {
    return authError_('invalid-response', 'Invalid session at index ' + index + ': ' + field + '.');
  };
  if (!session || typeof session !== 'object') throw fail('not an object');
  if (typeof session.id !== 'string' || !session.id || session.id.length > SYNC_MAX_ID_LENGTH) throw fail('id');
  if (!isIso_(session.startedAt)) throw fail('startedAt');
  if (!isIso_(session.endedAt)) throw fail('endedAt');
  if (typeof session.durationMs !== 'number' || !isFinite(session.durationMs) || session.durationMs < 0) {
    throw fail('durationMs');
  }
  if (session.subject !== null && (typeof session.subject !== 'string' || session.subject.length > SYNC_MAX_SUBJECT_LENGTH)) {
    throw fail('subject');
  }
  if (session.type !== 'stopwatch') throw fail('type');
  if (session.source !== 'timer') throw fail('source');
  if (session.schemaVersion !== 1) throw fail('schemaVersion');
  if (!isIso_(session.updatedAt)) throw fail('updatedAt');
  if (session.deletedAt !== null && !isIso_(session.deletedAt)) throw fail('deletedAt');
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.durationMs,
    subject: session.subject,
    type: 'stopwatch',
    source: 'timer',
    schemaVersion: 1,
    updatedAt: session.updatedAt,
    deletedAt: session.deletedAt,
  };
}

/** Same rule as lib/sync/merge.ts: later updatedAt wins; on a tie the tombstone wins. */
function incomingWins_(incoming, existing) {
  const a = Date.parse(incoming.updatedAt);
  const b = Date.parse(existing.updatedAt);
  if (a !== b) return a > b;
  return Boolean(incoming.deletedAt) && !existing.deletedAt;
}

function cellText_(value) {
  return value instanceof Date ? value.toISOString() : String(value === null || value === undefined ? '' : value);
}

function sessionToRow_(email, session, serverAt) {
  return [
    email, session.id, session.startedAt, session.endedAt, session.durationMs, session.subject || '',
    session.type, session.source, session.schemaVersion, session.updatedAt, session.deletedAt || '', serverAt,
  ];
}

function rowToSession_(row) {
  return {
    id: cellText_(row[1]),
    startedAt: cellText_(row[2]),
    endedAt: cellText_(row[3]),
    durationMs: Number(row[4]) || 0,
    subject: cellText_(row[5]) || null,
    type: 'stopwatch',
    source: 'timer',
    schemaVersion: 1,
    updatedAt: cellText_(row[9]),
    deletedAt: cellText_(row[10]) || null,
  };
}

/** Pure upsert into values (header at [0]). Only touches rows owned by email. Returns true if anything changed. */
function applyPush_(values, email, sessions, serverAt) {
  const rowById = {};
  for (let i = 1; i < values.length; i += 1) {
    if (normalize_(values[i][0]) === email) rowById[cellText_(values[i][1])] = i;
  }
  let changed = false;
  sessions.forEach(function (session) {
    const index = rowById[session.id];
    if (index === undefined) {
      rowById[session.id] = values.length;
      values.push(sessionToRow_(email, session, serverAt));
      changed = true;
    } else if (incomingWins_(session, rowToSession_(values[index]))) {
      values[index] = sessionToRow_(email, session, serverAt);
      changed = true;
    }
  });
  return changed;
}

/** Pure pull filter. >= since, not >: a same-millisecond push must not be skipped; resending is harmless. */
function selectSessions_(values, email, since) {
  const sinceMs = since ? Date.parse(since) : -Infinity;
  const sessions = [];
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    if (normalize_(row[0]) !== email) continue;
    if (Date.parse(cellText_(row[11])) >= sinceMs) sessions.push(rowToSession_(row));
  }
  return sessions;
}

/** Manual check from the Apps Script editor; touches no sheet. */
function testSync_() {
  const check = function (condition, message) { if (!condition) throw new Error('testSync_ failed: ' + message); };
  const base = {
    id: 's1', startedAt: '2026-10-01T10:00:00.000Z', endedAt: '2026-10-01T11:00:00.000Z', durationMs: 3600000,
    subject: 'Math', type: 'stopwatch', source: 'timer', schemaVersion: 1,
    updatedAt: '2026-10-01T11:00:00.000Z', deletedAt: null,
  };
  const withChanges = function (changes) { return Object.assign({}, base, changes); };
  const values = [SESSION_COLUMNS.slice(), sessionToRow_('other@x.com', base, '2026-10-01T00:00:00.000Z')];

  check(applyPush_(values, 'me@x.com', [base], 'T1') && values.length === 3, 'insert');
  check(!applyPush_(values, 'me@x.com', [withChanges({ subject: 'Old', updatedAt: '2026-09-01T00:00:00.000Z' })], 'T2'),
    'older update ignored');
  check(applyPush_(values, 'me@x.com', [withChanges({ subject: 'New', updatedAt: '2026-10-02T00:00:00.000Z' })], 'T3'),
    'newer update applied');
  check(values[2][5] === 'New' && values[2][11] === 'T3', 'row overwritten with new serverAt');
  check(!applyPush_(values, 'me@x.com', [withChanges({ subject: 'Tie', updatedAt: '2026-10-02T00:00:00.000Z' })], 'T4'),
    'tie without tombstone ignored');
  check(applyPush_(values, 'me@x.com', [withChanges({ updatedAt: '2026-10-02T00:00:00.000Z', deletedAt: '2026-10-02T00:00:00.000Z' })], 'T5'),
    'tie with tombstone wins');
  check(values[1][0] === 'other@x.com' && values[1][5] === 'Math', 'other user row untouched');
  check(values.length === 3, 'no duplicate rows');

  values[2][11] = '2026-10-05T00:00:00.000Z';
  const mine = selectSessions_(values, 'me@x.com', null);
  check(mine.length === 1 && mine[0].deletedAt === '2026-10-02T00:00:00.000Z' && !('email' in mine[0]), 'pull all, own rows only');
  check(mine[0].durationMs === 3600000 && mine[0].schemaVersion === 1, 'pull types');
  check(selectSessions_(values, 'me@x.com', '2026-10-05T00:00:00.000Z').length === 1, 'pull since is inclusive');
  check(selectSessions_(values, 'me@x.com', '2026-10-06T00:00:00.000Z').length === 0, 'pull since filters');

  let rejected = false;
  try { validateSession_(withChanges({ durationMs: -1 }), 0); } catch (error) { rejected = true; }
  check(rejected, 'negative duration rejected');
  check(validateSession_(withChanges({ email: 'evil@x.com' }), 0).email === undefined, 'client email dropped');
  console.log('testSync_ passed');
}
