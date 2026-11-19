// The database copy used to move the site to a new Neon project: exact, ordered by foreign keys, refuses a
// non-empty target, resets counters, and never writes to the source. Runs on two separate in-memory databases.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createPgliteDriver } = require('../lib/ops/db');
const { migrate } = require('../lib/ops/schema');
const { execute } = require('../lib/ops/service');
const { superadminUser } = require('../lib/ops/auth');
const { copyDatabase, plan, listTables } = require('../lib/migrate-copy');

// Site tables as _store.js creates them (the parts the copy has to handle: jsonb, bigserial, timestamptz, text keys).
const SITE_TABLES = `
  CREATE TABLE IF NOT EXISTS acs_admin_data (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS acs_analytics_events (id bigserial PRIMARY KEY, path text NOT NULL, visitor_id text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS acs_partners (id bigserial PRIMARY KEY, name text NOT NULL, portfolio_urls jsonb DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS acs_team_photos (id text PRIMARY KEY, mime text NOT NULL, data text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
`;

let source;
let target;
const director = superadminUser();

async function prepare(db) {
  await migrate(db);
  await db.exec(SITE_TABLES);
}

before(async () => {
  source = createPgliteDriver();
  target = createPgliteDriver();
  await prepare(source);
  await prepare(target);

  // Related ops rows (items -> stock, customers -> enquiries -> lines) so foreign keys are exercised.
  const item = await execute(source, director, 'item.save', { sku: 'S7-1200', name: 'Siemens S7-1200', brand: 'Siemens', standardCost: 30000.5 });
  await execute(source, director, 'item.save', { sku: 'KTP700', name: 'Siemens KTP700' });
  const customer = await execute(source, director, 'customer.save', { name: 'R. Mehta', company: 'Mehta Chemicals', email: 'buyer@mehta.test' });
  await execute(source, director, 'stock.adjust', { itemId: item.id, onHand: 15, note: 'Opening count' });
  await execute(source, director, 'enquiry.create', { customerId: customer.id, title: 'PLC for evaporator', lines: [{ itemId: item.id, qty: 5 }] });

  // Site data: jsonb with quotes/unicode, many analytics rows (more than one batch), a photo.
  await source.query(`INSERT INTO acs_admin_data (key, value) VALUES ('team', $1::jsonb), ('settings', $2::jsonb)`,
    [JSON.stringify([{ id: 'a', name: 'Bhavesh "BP" Prajapati', bio: 'Zażółć gęślą — 日本語' }]), JSON.stringify({ gaMeasurementId: 'G-1' })]);
  await source.query(`INSERT INTO acs_analytics_events (path, visitor_id) SELECT '/about', 'v' || g FROM generate_series(1, 1234) g`);
  await source.query(`INSERT INTO acs_partners (name, portfolio_urls) VALUES ('P', '["https://a.test","https://b.test"]'::jsonb)`);
  await source.query(`INSERT INTO acs_team_photos (id, mime, data) VALUES ('p1', 'image/webp', 'AAAA')`);
});

after(async () => { await source.close(); await target.close(); });

test('plan lists the site and ops tables, parents before children, and shows the empty target', async () => {
  const rows = await plan(source, target);
  const names = rows.map((row) => row.table);
  assert.ok(names.includes('acs_admin_data') && names.includes('ops_items') && names.includes('ops_enquiry_lines'));
  assert.ok(names.indexOf('ops_items') < names.indexOf('ops_enquiry_lines'), 'items before the lines that reference them');
  assert.ok(names.indexOf('ops_enquiries') < names.indexOf('ops_enquiry_lines'));
  assert.ok(names.indexOf('ops_customers') < names.indexOf('ops_enquiries'));
  assert.equal(rows.find((row) => row.table === 'acs_analytics_events').source, 1234);
  assert.ok(rows.every((row) => row.target === 0));
});

test('copies every row exactly, verifies it, and the counters continue after the copied ids', async () => {
  const report = await copyDatabase(source, target, { batch: 500 });
  assert.ok(report.length >= 25);
  assert.ok(report.every((row) => row.same), JSON.stringify(report.filter((row) => !row.same)));
  assert.equal(report.find((row) => row.table === 'acs_analytics_events').target, 1234);

  const team = (await target.query(`SELECT value FROM acs_admin_data WHERE key = 'team'`))[0].value;
  assert.equal(team[0].name, 'Bhavesh "BP" Prajapati');
  assert.equal(team[0].bio, 'Zażółć gęślą — 日本語');
  assert.deepEqual((await target.query('SELECT portfolio_urls FROM acs_partners'))[0].portfolio_urls, ['https://a.test', 'https://b.test']);
  assert.equal((await target.query('SELECT standard_cost::text AS c FROM ops_items WHERE sku = $1', ['S7-1200']))[0].c, '30000.50');

  // Counters: the next rows get ids after the copied ones instead of colliding.
  const next = await target.query(`INSERT INTO acs_analytics_events (path) VALUES ('/new') RETURNING id`);
  assert.equal(Number(next[0].id), 1235);
  const nextItem = await target.query(`INSERT INTO ops_items (sku, name) VALUES ('NEW', 'New') RETURNING id`);
  assert.equal(nextItem[0].id, 3);
});

test('a target that already has rows is refused and left untouched', async () => {
  await assert.rejects(copyDatabase(source, target), /not empty/);
  assert.equal((await target.query('SELECT count(*)::int AS n FROM ops_items'))[0].n, 3, 'still the copied rows plus the one added above');
});

test('a target without the tables is refused with a clear message', async () => {
  const bare = createPgliteDriver();
  try {
    await assert.rejects(copyDatabase(source, bare), /missing tables/);
  } finally {
    await bare.close();
  }
});

test('the copy only reads from the source', async () => {
  const seen = [];
  const readOnly = { query: (text, params) => { seen.push(text.trim().split(/\s+/)[0].toUpperCase()); return source.query(text, params); } };
  const fresh = createPgliteDriver();
  try {
    await prepare(fresh);
    await copyDatabase(readOnly, fresh);
  } finally {
    await fresh.close();
  }
  assert.ok(seen.length > 50);
  assert.deepEqual([...new Set(seen)].sort(), ['SELECT']);
  assert.ok((await listTables(source)).length >= 25);
});
