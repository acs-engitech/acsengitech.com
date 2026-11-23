// Staff accounts (HR, Content & SEO) sign in to /admin and only see and change their own sections.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const store = require('../lib/store');
const { createPgliteDriver, useDriver } = require('../lib/ops/db');
const { execute } = require('../lib/ops/service');
const { superadminUser } = require('../lib/ops/auth');

const PASSWORD = 'staff-password-123';

function call(handler, { method = 'GET', headers = {}, body } = {}) {
  const req = Readable.from([Buffer.from(body ? JSON.stringify(body) : '')]);
  Object.assign(req, { method, query: {}, headers });
  const res = { statusCode: 200, setHeader() {}, end(payload) { this.body = payload ? JSON.parse(payload) : null; } };
  return handler(req, res).then(() => res);
}

let handler;
before(async () => {
  for (const key of ['ACS_ADMIN_EMAIL', 'ACS_ADMIN_PASSWORD_HASH', 'ACS_ADMIN_PASSWORD', 'ACS_ADMIN_SESSION_SECRET']) delete process.env[key];
  const db = await useDriver(createPgliteDriver());
  const director = superadminUser();
  const customer = await execute(db, director, 'customer.save', { name: 'Cust' });
  for (const [email, role] of [['hr@acs.test', 'hr'], ['seo@acs.test', 'content'], ['trader@acs.test', 'trading']]) await execute(db, director, 'user.save', { email, name: role, role, password: PASSWORD });
  await execute(db, director, 'user.save', { email: 'cust@acs.test', name: 'c', role: 'customer', customerId: customer.id, password: PASSWORD });
  store.getAll = async () => ({ pages: [{ path: '/' }], posts: [{ id: 1 }], jobs: [], positions: [{ id: 'p' }], positionTypes: [], applications: [{ id: '1' }], partners: [{ id: '2' }], enquiries: [{ id: '3' }], partnerCategories: [], settings: {} });
  store.getAnalytics = async () => [];
  store.saveAll = async () => store.getAll();
  store.updateApplication = async () => ({});
  handler = require('../api/admin');
});

const login = (email) => ({ 'x-admin-email': email, 'x-admin-password': PASSWORD });

test('HR sees positions, applications and enquiries only', async () => {
  const res = await call(handler, { headers: login('hr@acs.test') });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.access.sections, ['positions', 'enquiries', 'applications']);
  assert.ok(res.body.applications && res.body.enquiries && res.body.positions);
  assert.equal(res.body.pages, undefined);
  assert.equal(res.body.partners, undefined);
  assert.equal(res.body.analytics, undefined);
  assert.ok(res.body.sessionToken.startsWith('ops.'));
  // The minted session works on its own.
  const again = await call(handler, { headers: { 'x-admin-session': res.body.sessionToken } });
  assert.equal(again.statusCode, 200);
});

test('HR cannot change SEO; Content cannot touch applications', async () => {
  assert.equal((await call(handler, { method: 'POST', headers: login('hr@acs.test'), body: { pageSeo: {} } })).statusCode, 403);
  assert.equal((await call(handler, { method: 'POST', headers: login('hr@acs.test'), body: { action: 'application.update', id: '1', patch: { status: 'reviewed' } } })).statusCode, 200);
  assert.equal((await call(handler, { method: 'POST', headers: login('seo@acs.test'), body: { action: 'application.update', id: '1', patch: {} } })).statusCode, 403);
  const seo = await call(handler, { headers: login('seo@acs.test') });
  assert.ok(seo.body.pages && seo.body.posts);
  assert.equal(seo.body.applications, undefined);
  assert.equal((await call(handler, { method: 'POST', headers: login('seo@acs.test'), body: { pageSeo: {} } })).statusCode, 200);
});

test('trading staff and customers cannot sign in to /admin; the director still sees everything', async () => {
  assert.equal((await call(handler, { headers: login('trader@acs.test') })).statusCode, 401);
  assert.equal((await call(handler, { headers: login('cust@acs.test') })).statusCode, 401);
  const director = await call(handler, { headers: { 'x-admin-email': 'acsengitech@gmail.com', 'x-admin-password': 'ACSEngitech@2026#' } });
  assert.equal(director.statusCode, 200);
  assert.equal(director.body.access.sections, 'all');
  assert.ok(director.body.partners && director.body.pages && director.body.applications);
  assert.equal(director.body.sessionToken.startsWith('ops.'), false, 'superadmin keeps the existing session format');
});
