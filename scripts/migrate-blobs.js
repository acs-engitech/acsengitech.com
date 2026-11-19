#!/usr/bin/env node
// Copies uploaded files (job-application resumes, partner profiles) from the OLD Vercel Blob store to the NEW one
// and points the rows in the NEW database at the new copies. Run it after scripts/migrate-db.js.
//
//   NEW_DATABASE_URL=...  NEW_BLOB_READ_WRITE_TOKEN=...  node scripts/migrate-blobs.js --dry-run
//   NEW_DATABASE_URL=...  NEW_BLOB_READ_WRITE_TOKEN=...  node scripts/migrate-blobs.js
//
// The old files are only downloaded (they are public links) and never deleted; the old database is not touched.
// Run it while the old Vercel project's Blob store still exists. Safe to run again: files already moved are skipped.

const dryRun = process.argv.includes('--dry-run');
const { NEW_DATABASE_URL: dbUrl, NEW_BLOB_READ_WRITE_TOKEN: token } = process.env;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//i.test(dbUrl || '')) fail('Set NEW_DATABASE_URL to the NEW Neon connection string.');
if (!dryRun && !token) fail('Set NEW_BLOB_READ_WRITE_TOKEN to the read/write token of the NEW project\'s Blob store.');

const FIELDS = [
  { table: 'acs_applications', column: 'resume_url', folder: 'applications' },
  { table: 'acs_partners', column: 'profile_url', folder: 'partners' },
];
const isBlobUrl = (url) => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url || '');

async function main() {
  const { Client, neonConfig } = require('@neondatabase/serverless');
  if (!neonConfig.webSocketConstructor) neonConfig.webSocketConstructor = globalThis.WebSocket;
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const newStoreHost = token ? `${String(token).split('_')[3]?.toLowerCase() || ''}.public.blob.vercel-storage.com` : '';
  let moved = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  for (const { table, column } of FIELDS) {
    const { rows } = await client.query(`SELECT id, ${column} AS url FROM ${table} WHERE ${column} IS NOT NULL AND ${column} <> ''`);
    for (const row of rows) {
      if (!isBlobUrl(row.url) || (newStoreHost && new URL(row.url).host.toLowerCase() === newStoreHost)) { skipped += 1; continue; }
      try {
        const response = await fetch(row.url);
        if (!response.ok) throw new Error(`download failed (${response.status})`);
        const buffer = Buffer.from(await response.arrayBuffer());
        bytes += buffer.length;
        if (dryRun) { moved += 1; continue; }
        const { put } = require('@vercel/blob');
        const pathname = decodeURIComponent(new URL(row.url).pathname.replace(/^\//, ''));
        const blob = await put(pathname, buffer, { access: 'public', token, addRandomSuffix: false, allowOverwrite: true, contentType: response.headers.get('content-type') || undefined });
        await client.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [blob.url, row.id]);
        moved += 1;
        process.stdout.write(`\r${table} #${row.id} moved (${moved} so far)`.padEnd(60));
      } catch (error) {
        failed += 1;
        console.error(`\n${table} #${row.id}: ${error.message}`);
      }
    }
  }
  await client.end();
  console.log(`\n\n${dryRun ? 'Would move' : 'Moved'} ${moved} file(s) (${(bytes / 1024 / 1024).toFixed(1)} MB). Skipped ${skipped} (no file, not a Blob link, or already on the new store). Failed ${failed}.`);
  return failed ? 2 : 0;
}

main().then((code) => process.exit(code), (error) => fail(`Stopped: ${error.message}`));
