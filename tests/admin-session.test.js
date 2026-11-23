const { test } = require('node:test');
const assert = require('node:assert');
const { Readable } = require('node:stream');
const crypto = require('node:crypto');
const store = require('../lib/store');

const EMAIL = 'acs.mmo@gmail.com';
const RAW_PASSWORD = 'session-test-password';
const PASSWORD_HASH = crypto.createHash('sha256').update(RAW_PASSWORD).digest('hex');

function fakeRequest(headers) {
  const req = Readable.from([Buffer.from('')]);
  req.method = 'GET';
  req.headers = headers;
  req.query = {};
  return req;
}

function fakeResponse() {
  const res = {
    statusCode: 200,
    setHeader() {},
    end(payload) { this.body = payload ? JSON.parse(payload) : null; },
  };
  return res;
}

function signToken(email, expiresAt, secret) {
  const payload = Buffer.from(JSON.stringify({ email, expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function mockStore() {
  store.getAll = async () => ({
    pages: [], posts: [], jobs: [], positions: [], positionTypes: [],
    applications: [], partners: [], partnerCategories: [], settings: {},
  });
  store.getAnalytics = async () => [];
}

function setEnv() {
  process.env.ACS_ADMIN_EMAIL = EMAIL;
  process.env.ACS_ADMIN_PASSWORD_HASH = PASSWORD_HASH;
  delete process.env.ACS_ADMIN_SESSION_SECRET;
}

test('password login response includes a sessionToken that authorizes a later request', async () => {
  setEnv();
  mockStore();
  const handler = require('../api/admin');

  const loginReq = fakeRequest({ 'x-admin-email': EMAIL, 'x-admin-password': RAW_PASSWORD });
  const loginRes = fakeResponse();
  await handler(loginReq, loginRes);
  assert.equal(loginRes.statusCode, 200);
  assert.ok(loginRes.body.sessionToken, 'expected a sessionToken in the response');
  assert.ok(loginRes.body.sessionExpiresAt > Date.now());

  const sessionReq = fakeRequest({ 'x-admin-session': loginRes.body.sessionToken, 'x-admin-email': EMAIL });
  const sessionRes = fakeResponse();
  await handler(sessionReq, sessionRes);
  assert.equal(sessionRes.statusCode, 200);
});

test('a tampered session token is rejected', async () => {
  setEnv();
  mockStore();
  const handler = require('../api/admin');

  const forged = signToken(EMAIL, Date.now() + 60000, 'wrong-secret');
  const req = fakeRequest({ 'x-admin-session': forged, 'x-admin-email': EMAIL });
  const res = fakeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

test('an expired session token is rejected even with a correctly-signed payload', async () => {
  setEnv();
  mockStore();
  const handler = require('../api/admin');

  const expired = signToken(EMAIL, Date.now() - 1000, PASSWORD_HASH);
  const req = fakeRequest({ 'x-admin-session': expired, 'x-admin-email': EMAIL });
  const res = fakeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

test('no credentials at all returns 401', async () => {
  setEnv();
  mockStore();
  const handler = require('../api/admin');
  const req = fakeRequest({});
  const res = fakeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

test('admin GET loads dashboard data and analytics concurrently', async () => {
  setEnv();
  const originalGetAll = store.getAll;
  const originalGetAnalytics = store.getAnalytics;
  let analyticsStartedBeforeGetAllResolved = false;
  let getAllResolved = false;
  try {
    store.getAll = async () => new Promise((resolve) => {
      setTimeout(() => {
        getAllResolved = true;
        resolve({
          pages: [], posts: [], jobs: [], positions: [], positionTypes: [],
          applications: [], partners: [], partnerCategories: [], settings: {},
        });
      }, 25);
    });
    store.getAnalytics = async () => {
      analyticsStartedBeforeGetAllResolved = !getAllResolved;
      return [];
    };
    delete require.cache[require.resolve('../api/admin')];
    const handler = require('../api/admin');

    const req = fakeRequest({ 'x-admin-email': EMAIL, 'x-admin-password': RAW_PASSWORD });
    const res = fakeResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(analyticsStartedBeforeGetAllResolved, true);
  } finally {
    store.getAll = originalGetAll;
    store.getAnalytics = originalGetAnalytics;
    delete require.cache[require.resolve('../api/admin')];
  }
});
