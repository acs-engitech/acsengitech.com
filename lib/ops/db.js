// Operations database driver. Production uses Neon over WebSockets (pg-compatible Pool) so workflow
// commands get real interactive transactions with row locks. Local development and tests run the same
// SQL against PGlite (embedded Postgres), file-backed under .data/ or in memory.
const path = require('node:path');
const { connectionString } = require('../../api/_store');
const { migrate } = require('./schema');

let driver;
let ready;

function createNeonDriver(url) {
  const { Pool, neonConfig } = require('@neondatabase/serverless');
  if (!neonConfig.webSocketConstructor && globalThis.WebSocket) neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString: url });
  return {
    kind: 'neon',
    async query(text, params = []) {
      return (await pool.query(text, params)).rows;
    },
    // Several parameterless statements in one round trip (simple query protocol).
    async exec(text) {
      await pool.query(text);
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: async (text, params = []) => (await client.query(text, params)).rows });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

function createPgliteDriver(dataDir) {
  // Optional dependency: only needed where no Neon connection string is configured.
  const { PGlite } = require('@electric-sql/pglite');
  if (dataDir) require('node:fs').mkdirSync(path.dirname(dataDir), { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  let queue = Promise.resolve();
  // PGlite is a single connection; serialize transactions so concurrent commands cannot interleave.
  const exclusive = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };
  return {
    kind: 'pglite',
    pg,
    query: (text, params = []) => exclusive(async () => (await pg.query(text, params)).rows),
    exec: (text) => exclusive(async () => { await pg.exec(text); }),
    tx: (fn) => exclusive(() => pg.transaction((t) => fn({ query: async (text, params = []) => (await t.query(text, params)).rows }))),
    close: () => pg.close(),
  };
}

// Local runs opt in to PGlite with ACS_OPS_PGLITE_DIR (a folder, or "memory"); local-dev-server.js sets it
// when no Neon URL is present. Nothing falls back silently in production.
function isConfigured() {
  return Boolean(driver || connectionString() || (!process.env.VERCEL && process.env.ACS_OPS_PGLITE_DIR));
}

function resolveDriver() {
  const url = connectionString();
  if (url) return createNeonDriver(url);
  const dir = process.env.ACS_OPS_PGLITE_DIR;
  if (process.env.VERCEL || !dir) throw new Error('Database is not configured: set NEON_DATABASE_URL');
  return createPgliteDriver(dir === 'memory' ? undefined : path.resolve(dir));
}

async function getDb() {
  driver ||= resolveDriver();
  ready ||= migrate(driver).catch((error) => {
    ready = undefined;
    throw error;
  });
  await ready;
  return driver;
}

// Tests swap in a fresh in-memory database.
async function useDriver(next) {
  driver = next;
  ready = undefined;
  return getDb();
}

module.exports = { getDb, useDriver, createPgliteDriver, isConfigured };
