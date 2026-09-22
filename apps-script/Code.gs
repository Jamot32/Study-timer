const USERS_SHEET_NAME = 'Users';
const REQUIRED_COLUMNS = ['email', 'status', 'display_name', 'role', 'avatar'];
// Temporary DB for the closed beta. Script property SPREADSHEET_ID overrides it.
const DEFAULT_SPREADSHEET_ID = '13VRYsnBayobLLOEdLGvd8OoBUqSUIjGnHrDd0KxCn8I';
const ALLOWED_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

function doGet() {
  return json_({ ok: true, name: 'study-timer-auth' });
}

function doPost(event) {
  try {
    const body = JSON.parse(event.postData && event.postData.contents ? event.postData.contents : '{}');
    if (body.action !== 'login' || typeof body.idToken !== 'string' || !body.idToken) {
      return json_({ ok: false, code: 'invalid-response', error: 'Invalid login request.' });
    }

    const identity = verifyGoogleToken_(body.idToken);
    const user = findActiveUser_(identity);
    return json_({
      ok: true,
      session: {
        user: user,
        expiresAt: new Date(Number(identity.exp) * 1000).toISOString(),
      },
    });
  } catch (error) {
    const code = error && error.code ? error.code : 'provider-error';
    const message = error && error.message ? error.message : 'Login failed.';
    console.error(JSON.stringify({ code: code, message: message }));
    return json_({ ok: false, code: code, error: message });
  }
}

function verifyGoogleToken_(idToken) {
  const properties = PropertiesService.getScriptProperties();
  const expectedAudience = properties.getProperty('GOOGLE_WEB_CLIENT_ID');
  if (!expectedAudience) throw authError_('provider-error', 'Server OAuth configuration is missing.');

  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) {
    throw authError_('provider-error', 'Google could not verify this login.');
  }

  const identity = JSON.parse(response.getContentText());
  if (identity.aud !== expectedAudience) {
    throw authError_('provider-error', 'This token belongs to a different app.');
  }
  if (ALLOWED_ISSUERS.indexOf(identity.iss) === -1) {
    throw authError_('provider-error', 'The token issuer is invalid.');
  }
  if (identity.email_verified !== 'true') {
    throw authError_('provider-error', 'The Google email address is not verified.');
  }
  if (!identity.sub || !identity.email || Number(identity.exp) * 1000 <= Date.now()) {
    throw authError_('provider-error', 'The Google login has expired or is incomplete.');
  }
  return identity;
}

function findActiveUser_(identity) {
  const spreadsheetId =
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(USERS_SHEET_NAME);
  if (!sheet) throw authError_('provider-error', 'The Users worksheet does not exist.');

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) throw authError_('provider-error', 'The Users worksheet is empty.');

  const headers = values[0].map(function (value) { return normalize_(value); });
  const columns = {};
  REQUIRED_COLUMNS.forEach(function (name) {
    const index = headers.indexOf(name);
    if (index === -1) throw authError_('provider-error', 'Missing Users column: ' + name);
    columns[name] = index;
  });

  const email = normalize_(identity.email);
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    if (normalize_(row[columns.email]) !== email) continue;

    const status = normalize_(row[columns.status]);
    if (status !== 'active') {
      throw authError_('disabled', 'Access for this account has been disabled.');
    }

    const displayName = String(row[columns.display_name] || identity.name || email.split('@')[0]).trim();
    const role = normalize_(row[columns.role]) || 'student';
    const avatar = String(row[columns.avatar] || '').trim();
    return {
      id: String(identity.sub),
      email: email,
      displayName: displayName,
      role: role,
      ...(avatar ? { avatar: avatar } : {}),
    };
  }

  throw authError_('not-approved', 'This Google account does not have access yet.');
}

function normalize_(value) {
  return String(value || '').trim().toLowerCase();
}

function authError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
