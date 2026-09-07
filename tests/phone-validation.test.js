const { test } = require('node:test');
const assert = require('node:assert');
const { isValidPhone } = require('../lib/phone');
const { buildMultipartRequest, fakeResponse } = require('./helpers/multipart');
const store = require('../api/_store');

test('isValidPhone accepts empty string (phone stays optional)', () => {
  assert.equal(isValidPhone(''), true);
  assert.equal(isValidPhone(undefined), true);
  assert.equal(isValidPhone(null), true);
});

test('isValidPhone accepts valid +91 Indian mobile numbers', () => {
  assert.equal(isValidPhone('+919998887777'), true);
  assert.equal(isValidPhone('+916000000000'), true);
  assert.equal(isValidPhone('+919876543210'), true);
});

test('isValidPhone rejects numbers without the +91 prefix', () => {
  assert.equal(isValidPhone('9998887777'), false);
  assert.equal(isValidPhone('919998887777'), false);
});

test('isValidPhone rejects numbers starting with 0-5 after +91', () => {
  assert.equal(isValidPhone('+915998887777'), false);
  assert.equal(isValidPhone('+910998887777'), false);
});

test('isValidPhone rejects wrong digit counts and junk input', () => {
  assert.equal(isValidPhone('+91998887777'), false); // 9 digits
  assert.equal(isValidPhone('+9199988877771'), false); // 11 digits
  assert.equal(isValidPhone('+91abcdefghij'), false);
  assert.equal(isValidPhone('not-a-phone'), false);
});

test('POST /api/apply rejects a phone missing the +91 prefix (server is the authoritative check)', async () => {
  store.insertApplication = async (row) => ({ ...row, id: '1', createdAt: new Date().toISOString() });
  const handler = require('../api/apply');
  const req = buildMultipartRequest({
    fields: { name: 'Bad Phone', email: 'bad-phone@example.com', phone: '9998887777' },
    socket: { remoteAddress: '10.2.0.1' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid 10-digit Indian mobile number/i);
});

test('POST /api/apply accepts a valid +91 phone', async () => {
  let inserted;
  store.insertApplication = async (row) => { inserted = { ...row, id: '2', createdAt: new Date().toISOString() }; return inserted; };
  const handler = require('../api/apply');
  const req = buildMultipartRequest({
    fields: { name: 'Good Phone', email: 'good-phone@example.com', phone: '+919998887777' },
    socket: { remoteAddress: '10.2.0.2' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(inserted.phone, '+919998887777');
});

test('POST /api/partner rejects an invalid phone', async () => {
  store.insertPartner = async (row) => ({ ...row, id: '1', createdAt: new Date().toISOString() });
  const handler = require('../api/partner');
  const req = buildMultipartRequest({
    fields: { name: 'Vendor Co', email: 'vendor@example.com', phone: '12345' },
    socket: { remoteAddress: '10.2.0.3' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid 10-digit Indian mobile number/i);
});

test('POST /api/partner accepts an empty phone (still optional)', async () => {
  let inserted;
  store.insertPartner = async (row) => { inserted = { ...row, id: '2', createdAt: new Date().toISOString() }; return inserted; };
  const handler = require('../api/partner');
  const req = buildMultipartRequest({
    fields: { name: 'Vendor Co', email: 'vendor2@example.com' },
    socket: { remoteAddress: '10.2.0.4' },
  });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(inserted.phone, null);
});
