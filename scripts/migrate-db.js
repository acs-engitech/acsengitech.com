#!/usr/bin/env node
// Copies the whole site database (admin content, team, applications, enquiries, analytics, operations platform)
// from the OLD Neon project to a NEW one. See docs/MIGRATION.md for the full move.
//
//   OLD_DATABASE_URL=...  NEW_DATABASE_URL=...  node scripts/migrate-db.js --dry-run   (reads only, changes nothing)
//   OLD_DATABASE_URL=...  NEW_DATABASE_URL=...  node scripts/migrate-db.js             (creates tables, copies, verifies)
//
// The old database is opened in a read-only session, so this cannot change or delete anything there. The new
// database must be empty. Connection strings are never printed (only the host name).

const { copyDatabase, plan } = require('../lib/migrate-copy');

const dryRun = process.argv.includes('--dry-run');
const { OLD_DATABASE_URL: oldUrl, NEW_DATABASE_URL: newUrl } = process.env;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const isPostgres = (url) => /^postgres(ql)?:\/\//i.test(url || '');
const hostOf = (url) => { try { return new URL(url).host; } catch { return '(invalid URL)'; } };

if (!isPostgres(oldUrl) || !isPostgres(newUrl)) fail('Set OLD_DATABASE_URL and NEW_DATABASE_URL to the two Neon connection strings (postgresql://...).');
if (oldUrl === newUrl || hostOf(oldUrl) === hostOf(newUrl)) fail('The old and new connection strings point at the same database. Check which one is which.');

async function connect(url, { readOnly }) {
  const { Client, neonConfig } = require('@neondatabase/serverless');
  if (!neonConfig.webSocketConstructor) {
    if (!globalThis.WebSocket) fail('This needs Node 22 or newer (built-in WebSocket). Run `node -v` to check.');
    neonConfig.webSocketConstructor = globalThis.WebSocket;
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  if (readOnly) await client.query('SET default_transaction_read_only = on');
  return { query: async (text, params = []) => (await client.query(text, params)).rows, close: () => client.end() };
}

async function main() {
  console.log(`Old database: ${hostOf(oldUrl)} (read-only)`);
  console.log(`New database: ${hostOf(newUrl)}${dryRun ? ' (dry run: not changed)' : ''}\n`);
  const source = await connect(oldUrl, { readOnly: true });

  if (!dryRun) {
    // Create the empty tables with the app's own code, so the schema is exactly what the site expects.
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    process.env.NEON_DATABASE_URL = newUrl;
    await require('../api/_store').init();
    await require('../lib/ops/db').getDb();
    console.log('Prepared empty tables in the new database.\n');
  }
  const target = await connect(newUrl, { readOnly: dryRun });

  const rows = await plan(source, target);
  console.table(rows.map((row) => ({ table: row.table, 'rows in old': row.source, 'rows in new': row.target === null ? '(table will be created)' : row.target })));
  if (dryRun) {
    const total = rows.reduce((sum, row) => sum + row.source, 0);
    console.log(`\nDry run complete: ${rows.length} tables, ${total} rows would be copied. Nothing was changed.`);
    return 0;
  }

  const report = await copyDatabase(source, target, { log: (line) => process.stdout.write(`\r${line.padEnd(60)}`) });
  console.log('\n');
  console.table(report.map((row) => ({ table: row.table, old: row.source, new: row.target, checked: row.checked, match: row.same ? 'yes' : 'NO' })));
  const bad = report.filter((row) => !row.same);
  if (bad.length) {
    console.log(`\n${bad.length} table(s) differ: ${bad.map((row) => row.table).join(', ')}.`);
    console.log('Rows written to the live site during the copy (page-view analytics, a form submission) show up like this.');
    console.log('If other tables differ, do not switch over; drop the new database\'s tables and run this again.');
    return 2;
  }
  console.log('\nEvery table matches. The new database is a faithful copy.');
  return 0;
}

main().then((code) => process.exit(code), (error) => fail(`Migration stopped: ${error.message}\nNothing in the old database was changed.`));
