const { test } = require('node:test');
const assert = require('node:assert');
const store = require('../api/_store');
const { buildMultipartRequest, fakeResponse } = require('./helpers/multipart');

function mockStore() {
  const inserted = [];
  store.insertApplication = async (row) => {
    const record = { ...row, id: String(inserted.length + 1), createdAt: new Date().toISOString() };
    inserted.push(record);
    return record;
  };
  return inserted;
}

test('POST /api/apply creates an application row', async () => {
  const inserted = mockStore();
  const handler = require('../api/apply');
  const req = buildMultipartRequest({
    fields: { name: 'Asha Patel', email: 'asha@example.com', phone: '+919998887777', position_id: 'p1', position_title: 'Automation Engineer', years_experience: '2 years' },
    socket: { remoteAddress: '10.0.0.1' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].name, 'Asha Patel');
  assert.equal(inserted[0].email, 'asha@example.com');
});

test('POST /api/apply rejects an invalid email', async () => {
  mockStore();
  const handler = require('../api/apply');
  const req = buildMultipartRequest({
    fields: { name: 'Bad Email', email: 'not-an-email' },
    socket: { remoteAddress: '10.0.0.2' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error);
});

test('POST /api/apply rejects a missing name', async () => {
  mockStore();
  const handler = require('../api/apply');
  const req = buildMultipartRequest({
    fields: { email: 'someone@example.com' },
    socket: { remoteAddress: '10.0.0.3' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
});

test('POST /api/apply enforces the per-IP rate limit', async () => {
  mockStore();
  const handler = require('../api/apply');
  const socket = { remoteAddress: '10.0.0.4' };
  let lastRes;
  for (let i = 0; i < 6; i += 1) {
    const req = buildMultipartRequest({ fields: { name: `Person ${i}`, email: `p${i}@example.com` }, socket });
    lastRes = fakeResponse();
    await handler(req, lastRes);
  }
  assert.equal(lastRes.statusCode, 429);
});
