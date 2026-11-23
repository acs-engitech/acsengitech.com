const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const store = require('../lib/store');

function fakeRequest(path = '/') {
  const req = Readable.from([Buffer.from('')]);
  req.method = 'GET';
  req.headers = {};
  req.query = { path };
  return req;
}

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(payload) { this.body = payload ? JSON.parse(payload) : null; },
  };
}

test('public endpoint uses the public store path without loading admin-only data', async () => {
  const originalGetAll = store.getAll;
  const originalGetPublicData = store.getPublicData;
  try {
    store.getAll = async () => {
      throw new Error('public endpoint should not load admin-only data');
    };
    store.getPublicData = async () => ({
      pages: [{ path: '/', defaults: { title: 'ACS Home' }, seo: {} }],
      posts: [],
      jobs: [],
      positions: [{ id: 'automation-engineer', title: 'Automation Engineer', status: 'live' }],
      positionTypes: ['Full-time'],
      partnerCategories: ['Development'],
      settings: {},
    });
    delete require.cache[require.resolve('../api/public')];
    const handler = require('../api/public');

    const res = fakeResponse();
    await handler(fakeRequest('/'), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.fallback, undefined);
    assert.equal(res.body.positions.length, 1);
    assert.match(res.headers['Cache-Control'], /s-maxage=60/);
  } finally {
    store.getAll = originalGetAll;
    if (originalGetPublicData) store.getPublicData = originalGetPublicData;
    else delete store.getPublicData;
    delete require.cache[require.resolve('../api/public')];
  }
});
