const { test } = require('node:test');
const assert = require('node:assert');
const { Readable } = require('node:stream');
const crypto = require('node:crypto');
const store = require('../lib/store');

const EMAIL = 'acs.mmo@gmail.com';
const PASSWORD_HASH = crypto.createHash('sha256').update('test-password').digest('hex');

function fakeRequest(body) {
  const buffer = Buffer.from(JSON.stringify(body));
  const req = Readable.from([buffer]);
  req.method = 'POST';
  req.headers = { 'x-admin-email': EMAIL, 'x-admin-password': 'test-password' };
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

function mockStoreForAdmin() {
  process.env.ACS_ADMIN_EMAIL = EMAIL;
  process.env.ACS_ADMIN_PASSWORD_HASH = PASSWORD_HASH;
  const applications = new Map([['1', { id: '1', status: 'new', adminNotes: '' }]]);
  const partners = new Map([['1', { id: '1', status: 'new', adminNotes: '' }]]);
  const enquiries = new Map([['1', { id: '1', status: 'new', adminNotes: '' }]]);

  store.updateApplication = async (id, patch) => {
    const current = applications.get(id);
    if (!current) return null;
    const updated = { ...current, ...patch };
    applications.set(id, updated);
    return updated;
  };
  store.deleteApplications = async (ids) => { ids.forEach((id) => applications.delete(id)); return ids; };
  store.updatePartner = async (id, patch) => {
    const current = partners.get(id);
    if (!current) return null;
    const updated = { ...current, ...patch };
    partners.set(id, updated);
    return updated;
  };
  store.deletePartners = async (ids) => { ids.forEach((id) => partners.delete(id)); return ids; };
  store.updateEnquiry = async (id, patch) => {
    const current = enquiries.get(id);
    if (!current) return null;
    const updated = { ...current, ...patch };
    enquiries.set(id, updated);
    return updated;
  };
  store.deleteEnquiries = async (ids) => { ids.forEach((id) => enquiries.delete(id)); return ids; };
  store.getAll = async () => ({
    pages: [], posts: [], jobs: [], positions: [], positionTypes: [],
    applications: Array.from(applications.values()), partners: Array.from(partners.values()),
    enquiries: Array.from(enquiries.values()), partnerCategories: [], settings: {},
  });
  return { applications, partners, enquiries };
}

test('application.update changes status via /api/admin action', async () => {
  const { applications } = mockStoreForAdmin();
  const handler = require('../api/admin');
  const req = fakeRequest({ action: 'application.update', id: '1', patch: { status: 'shortlisted' } });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(applications.get('1').status, 'shortlisted');
  assert.equal(res.body.applications[0].status, 'shortlisted');
});

test('application.delete removes the row via /api/admin action', async () => {
  const { applications } = mockStoreForAdmin();
  const handler = require('../api/admin');
  const req = fakeRequest({ action: 'application.delete', ids: ['1'] });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(applications.has('1'), false);
  assert.equal(res.body.applications.length, 0);
});

test('partner.update changes status via /api/admin action', async () => {
  const { partners } = mockStoreForAdmin();
  const handler = require('../api/admin');
  const req = fakeRequest({ action: 'partner.update', id: '1', patch: { status: 'reviewed', adminNotes: 'Looks good' } });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(partners.get('1').status, 'reviewed');
  assert.equal(partners.get('1').adminNotes, 'Looks good');
});

test('partner.delete removes the row via /api/admin action', async () => {
  const { partners } = mockStoreForAdmin();
  const handler = require('../api/admin');
  const req = fakeRequest({ action: 'partner.delete', ids: ['1'] });
  const res = fakeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(partners.has('1'), false);
});

test('enquiry.update changes status and notes via /api/admin action', async () => {
  const { enquiries } = mockStoreForAdmin();
  const handler = require('../api/admin');
  const res = fakeResponse();
  await handler(fakeRequest({ action: 'enquiry.update', id: '1', patch: { status: 'replied', adminNotes: 'Quoted' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(enquiries.get('1').status, 'replied');
  assert.equal(res.body.enquiries[0].adminNotes, 'Quoted');
});

test('enquiry.delete removes the row via /api/admin action', async () => {
  const { enquiries } = mockStoreForAdmin();
  const handler = require('../api/admin');
  const res = fakeResponse();
  await handler(fakeRequest({ action: 'enquiry.delete', ids: ['1'] }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(enquiries.has('1'), false);
  assert.equal(res.body.enquiries.length, 0);
});
