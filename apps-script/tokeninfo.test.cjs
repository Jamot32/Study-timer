const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');

function verifier(identity, status = 200) {
  const requests = [];
  const context = vm.createContext({
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'expected-client' }),
    },
    UrlFetchApp: {
      fetch(url, options) {
        requests.push({ url, options });
        return {
          getResponseCode: () => status,
          getContentText: () => JSON.stringify(identity),
        };
      },
    },
  });
  vm.runInContext(source, context);
  return { verify: context.verifyGoogleToken_, requests };
}

const validIdentity = {
  aud: 'expected-client',
  iss: 'https://accounts.google.com',
  email_verified: 'true',
  sub: 'google-user',
  email: 'student@example.com',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

test('ID tokens travel only in the POST body, including URL metacharacters', () => {
  for (const token of ['header.payload.signature', 'secret&next=value?#/%+']) {
    const { verify, requests } = verifier(validIdentity);
    assert.equal(verify(token).sub, validIdentity.sub);
    assert.equal(requests.length, 1);
    const { url, options } = requests[0];
    assert.equal(url, 'https://oauth2.googleapis.com/tokeninfo');
    assert.equal(options.method, 'post');
    assert.equal(options.contentType, 'application/x-www-form-urlencoded');
    assert.equal(options.payload.id_token, token);
    assert.equal(options.followRedirects, false);
    assert.equal(options.muteHttpExceptions, true);
  }
});

test('failed verification and redirects reject login without exposing the token', () => {
  for (const status of [302, 400, 429, 500]) {
    const { verify } = verifier({}, status);
    assert.throws(() => verify('secret-token'), (error) => {
      assert.equal(error.code, 'provider-error');
      assert.equal(error.message, 'Google could not verify this login.');
      return true;
    });
  }
});

test('audience, issuer, verified email, expiration and identity checks remain enforced', () => {
  for (const invalid of [
    { aud: 'other-client' },
    { iss: 'https://attacker.example' },
    { email_verified: 'false' },
    { exp: 1 },
    { sub: '' },
    { email: '' },
  ]) {
    const { verify } = verifier({ ...validIdentity, ...invalid });
    assert.throws(() => verify('secret-token'), { code: 'provider-error' });
  }
});
