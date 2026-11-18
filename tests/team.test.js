// About page team: managed in /admin (Team), stored in the database, served to /about and photos via /api/team-photo.
// Runs the real store against an in-memory PGlite database (the local fallback used when no Neon URL is set).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

for (const name of ['NEON_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL', 'VERCEL']) delete process.env[name];
process.env.ACS_OPS_PGLITE_DIR = 'memory';

const store = require('../api/_store');
const { createPgliteDriver, useDriver } = require('../lib/ops/db');
const { execute } = require('../lib/ops/service');
const { superadminUser } = require('../lib/ops/auth');

const PASSWORD = 'staff-password-123';
// 1x1 PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function call(handler, { method = 'GET', headers = {}, body, query = {} } = {}) {
  const req = Readable.from([Buffer.from(body ? JSON.stringify(body) : '')]);
  Object.assign(req, { method, query, headers });
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(payload) { this.raw = payload; try { this.body = payload ? JSON.parse(payload) : null; } catch { this.body = null; } },
  };
  return handler(req, res).then(() => res);
}

let admin;
let publicApi;
let photoApi;
const login = (email) => ({ 'x-admin-email': email, 'x-admin-password': PASSWORD });

before(async () => {
  for (const key of ['ACS_ADMIN_EMAIL', 'ACS_ADMIN_PASSWORD_HASH', 'ACS_ADMIN_PASSWORD', 'ACS_ADMIN_SESSION_SECRET']) delete process.env[key];
  const db = await useDriver(createPgliteDriver());
  const director = superadminUser();
  await execute(db, director, 'user.save', { email: 'boss@acs.test', name: 'Boss', role: 'director', password: PASSWORD });
  await execute(db, director, 'user.save', { email: 'seo@acs.test', name: 'Seo', role: 'content', password: PASSWORD });
  await execute(db, director, 'user.save', { email: 'hr@acs.test', name: 'Hr', role: 'hr', password: PASSWORD });
  admin = require('../api/admin');
  publicApi = require('../api/public');
  photoApi = require('../api/team-photo');
});

test('team members are cleaned up: nameless rows dropped, unknown fields stripped, status defaults to live', () => {
  const team = store.normalizeTeam([
    { id: 'a', name: '  Asha Patel ', role: 'Director', status: 'weird', isAdmin: true, bio: 'x'.repeat(2000) },
    { id: 'b', name: '   ' },
    null,
    { id: 'c', name: 'Ravi', status: 'hidden' },
  ]);
  assert.deepEqual(team.map((m) => [m.id, m.name, m.status]), [['a', 'Asha Patel', 'live'], ['c', 'Ravi', 'hidden']]);
  assert.equal(team[0].isAdmin, undefined);
  assert.equal(team[0].bio.length, 1200);
});

test('until the team is first saved, /about shows the six supplied photos with names left blank', async () => {
  const about = await call(publicApi, { query: { path: '/about' } });
  assert.equal(about.body.team.length, 6);
  assert.deepEqual(about.body.team.map((m) => m.photo), [1, 2, 3, 4, 5, 6].map((n) => `/assets/team/member-${n}.webp`));
  assert.ok(about.body.team.every((m) => m.name === '' && m.role === ''));
  const fs = require('node:fs');
  for (const m of about.body.team) assert.ok(fs.existsSync(require('node:path').join(__dirname, '..', m.photo)), m.photo);
  assert.deepEqual(store.normalizeTeam([{ id: 'x', photo: '/assets/team/member-1.webp' }]).map((m) => m.id), ['x'], 'a photo-only member is kept');
});

test('content staff manage the team end to end; it shows on /about only, in order, without hidden members', async () => {
  const upload = await call(admin, { method: 'POST', headers: login('seo@acs.test'), body: { action: 'team.photo', dataUrl: PNG } });
  assert.equal(upload.statusCode, 200);
  assert.match(upload.body.url, /^\/api\/team-photo\?id=[\w-]+$/);

  const team = [
    { id: 'm1', name: 'Asha Patel', role: 'Managing Director', department: 'Leadership', photo: upload.body.url, linkedin: 'https://www.linkedin.com/in/asha', status: 'live' },
    { id: 'm2', name: 'Hidden Person', role: 'Engineer', status: 'hidden' },
    { id: 'm3', name: 'Ravi Shah', role: 'Head of Projects', status: 'live' },
  ];
  const saved = await call(admin, { method: 'POST', headers: login('seo@acs.test'), body: { team } });
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(saved.body.team.map((m) => m.id), ['m1', 'm2', 'm3']);
  assert.ok(saved.body.access.sections.includes('team'));

  const about = await call(publicApi, { query: { path: '/about' } });
  assert.deepEqual(about.body.team.map((m) => m.name), ['Asha Patel', 'Ravi Shah']);
  assert.equal(about.body.team[0].status, undefined);
  const home = await call(publicApi, { query: { path: '/' } });
  assert.deepEqual(home.body.team, []);

  const id = new URLSearchParams(upload.body.url.split('?')[1]).get('id');
  const photo = await call(photoApi, { query: { id } });
  assert.equal(photo.statusCode, 200);
  assert.equal(photo.headers['content-type'], 'image/png');
  assert.match(photo.headers['cache-control'], /immutable/);
  assert.ok(Buffer.isBuffer(photo.raw) && photo.raw.length > 0);

  assert.equal((await call(photoApi, { query: { id: 'does-not-exist' } })).statusCode, 404);
});

test('HR cannot change the team or upload photos, and does not receive it', async () => {
  assert.equal((await call(admin, { method: 'POST', headers: login('hr@acs.test'), body: { team: [] } })).statusCode, 403);
  assert.equal((await call(admin, { method: 'POST', headers: login('hr@acs.test'), body: { action: 'team.photo', dataUrl: PNG } })).statusCode, 403);
  const hr = await call(admin, { headers: login('hr@acs.test') });
  assert.equal(hr.body.team, undefined);
  const director = await call(admin, { headers: login('boss@acs.test') });
  assert.ok(Array.isArray(director.body.team));
});

test('photo uploads reject non-images and oversized files', async () => {
  const bad = await call(admin, { method: 'POST', headers: login('seo@acs.test'), body: { action: 'team.photo', dataUrl: 'data:text/html;base64,PGgxPg==' } });
  assert.equal(bad.statusCode, 400);
  const huge = `data:image/png;base64,${Buffer.alloc(1024 * 1024 + 10).toString('base64')}`;
  assert.equal((await call(admin, { method: 'POST', headers: login('seo@acs.test'), body: { action: 'team.photo', dataUrl: huge } })).statusCode, 400);
});
