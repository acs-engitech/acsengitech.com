const { test } = require('node:test');
const assert = require('node:assert');
const store = require('../api/_store');
const { buildMultipartRequest, fakeResponse } = require('./helpers/multipart');

function mockStore() {
  const inserted = [];
  store.insertPartner = async (row) => {
    const record = { ...row, id: String(inserted.length + 1), createdAt: new Date().toISOString() };
    inserted.push(record);
    return record;
  };
  return inserted;
}

test('POST /api/partner creates a partner row with parsed portfolio URLs', async () => {
  const inserted = mockStore();
  const handler = require('../api/partner');
  const req = buildMultipartRequest({
    fields: {
      name: 'Vendor Co', email: 'vendor@example.com', category: 'Design & branding', city: 'Ahmedabad',
      entity_type: 'Agency', years_experience: '5', portfolio_urls: JSON.stringify(['https://example.com/a', 'https://example.com/b']),
      description: 'We design things.',
    },
    socket: { remoteAddress: '10.1.0.1' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(inserted.length, 1);
  assert.deepEqual(inserted[0].portfolioUrls, ['https://example.com/a', 'https://example.com/b']);
});

test('POST /api/partner rejects an invalid email', async () => {
  mockStore();
  const handler = require('../api/partner');
  const req = buildMultipartRequest({
    fields: { name: 'Vendor Co', email: 'nope' },
    socket: { remoteAddress: '10.1.0.2' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
});

test('POST /api/partner rejects a missing name', async () => {
  mockStore();
  const handler = require('../api/partner');
  const req = buildMultipartRequest({
    fields: { email: 'vendor@example.com' },
    socket: { remoteAddress: '10.1.0.3' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
});

test('POST /api/partner enforces the per-IP rate limit', async () => {
  mockStore();
  const handler = require('../api/partner');
  const socket = { remoteAddress: '10.1.0.4' };
  let lastRes;
  for (let i = 0; i < 6; i += 1) {
    const req = buildMultipartRequest({ fields: { name: `Vendor ${i}`, email: `v${i}@example.com` }, socket });
    lastRes = fakeResponse();
    await handler(req, lastRes);
  }
  assert.equal(lastRes.statusCode, 429);
});
