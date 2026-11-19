// Copies every row of the site's tables (acs_* and ops_*) from one Postgres database to another that already has
// the same, empty tables. Used to move the site to a new Neon project (see docs/MIGRATION.md).
//
// Safety properties:
//  - The source is only ever read (SELECT); nothing here writes to it.
//  - The target must be empty; an existing row anywhere aborts before anything is copied.
//  - Tables are copied parents-first (foreign keys), in batches, and identity/serial counters are reset so new
//    rows continue after the copied ones.
//  - Afterwards every table is verified by row count, and tables up to CHECKSUM_LIMIT rows by a content checksum.
//
// `source` and `target` are anything with `query(text, params) -> rows` (a pg Pool wrapper, a PGlite instance).

const TABLE_NAME = /^[a-z][a-z0-9_]*$/;
const CHECKSUM_LIMIT = 50000;

const quote = (name) => {
  if (!TABLE_NAME.test(name)) throw new Error(`Unexpected table name: ${name}`);
  return `"${name}"`;
};

async function listTables(db) {
  const rows = await db.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND (table_name LIKE 'acs\\_%' OR table_name LIKE 'ops\\_%')
    ORDER BY table_name`);
  return rows.map((row) => row.table_name);
}

// Parents before children, so foreign keys hold while rows go in. Cycles (none today) fall back to name order.
async function orderByDependencies(db, tables) {
  const edges = await db.query(`SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
    FROM pg_constraint c WHERE c.contype = 'f'`);
  const set = new Set(tables);
  const waiting = new Map(tables.map((table) => [table, new Set()]));
  for (const { child, parent } of edges) {
    const c = child.replace(/^public\./, '').replace(/"/g, '');
    const p = parent.replace(/^public\./, '').replace(/"/g, '');
    if (c !== p && set.has(c) && set.has(p)) waiting.get(c).add(p);
  }
  const ordered = [];
  while (waiting.size) {
    const ready = [...waiting].filter(([, parents]) => parents.size === 0).map(([table]) => table);
    const next = ready.length ? ready : [...waiting.keys()].slice(0, 1);
    for (const table of next) {
      ordered.push(table);
      waiting.delete(table);
      for (const parents of waiting.values()) parents.delete(table);
    }
  }
  return ordered;
}

async function count(db, table) {
  const rows = await db.query(`SELECT count(*)::int AS n FROM ${quote(table)}`);
  return rows[0].n;
}

async function orderColumns(db, table) {
  const rows = await db.query(`SELECT a.attname AS name FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary ORDER BY array_position(i.indkey::int[], a.attnum::int)`, [quote(table)]);
  return rows.length ? rows.map((row) => `"${row.name}"`).join(', ') : 'ctid';
}

async function copyTable(source, target, table, { batch = 500, log = () => {} } = {}) {
  const total = await count(source, table);
  const order = await orderColumns(source, table);
  let copied = 0;
  for (let offset = 0; offset < total; offset += batch) {
    const page = await source.query(`SELECT row_to_json(t)::text AS r FROM (SELECT * FROM ${quote(table)} ORDER BY ${order} LIMIT ${batch} OFFSET ${offset}) t`);
    if (!page.length) break;
    // json_populate_recordset keeps every type exact (jsonb, timestamptz, numeric, arrays) without per-column code.
    await target.query(`INSERT INTO ${quote(table)} SELECT * FROM json_populate_recordset(NULL::${quote(table)}, $1::json)`, [`[${page.map((row) => row.r).join(',')}]`]);
    copied += page.length;
    log(`  ${table}: ${copied}/${total}`);
  }
  return { copied, total };
}

// Identity/serial counters restart after the highest copied id, so the next insert does not collide.
async function resetCounters(target, table) {
  const hasId = await target.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'`, [table]);
  if (!hasId.length) return false;
  const seq = await target.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [quote(table)]);
  if (!seq[0]?.seq) return false;
  await target.query(`SELECT setval($1, COALESCE((SELECT max(id) FROM ${quote(table)}), 1), (SELECT max(id) IS NOT NULL FROM ${quote(table)}))`, [seq[0].seq]);
  return true;
}

async function checksum(db, table) {
  const order = await orderColumns(db, table);
  const rows = await db.query(`SELECT md5(COALESCE(string_agg(row_to_json(t)::text, '|' ORDER BY ${order}), '')) AS sum FROM ${quote(table)} t`);
  return rows[0].sum;
}

// Plan only: table list, row counts on the source, and whether the target is ready (tables exist and are empty).
async function plan(source, target) {
  const tables = await orderByDependencies(source, await listTables(source));
  const targetTables = new Set(await listTables(target));
  const rows = [];
  for (const table of tables) {
    rows.push({ table, source: await count(source, table), target: targetTables.has(table) ? await count(target, table) : null });
  }
  return rows;
}

async function copyDatabase(source, target, { batch = 500, log = () => {} } = {}) {
  const rows = await plan(source, target);
  const missing = rows.filter((row) => row.target === null).map((row) => row.table);
  if (missing.length) throw new Error(`The target database is missing tables: ${missing.join(', ')}. Prepare it first (the script does this).`);
  const used = rows.filter((row) => row.target > 0).map((row) => `${row.table} (${row.target})`);
  if (used.length) throw new Error(`The target database is not empty: ${used.join(', ')}. Nothing was copied.`);

  const results = [];
  for (const { table } of rows) {
    const { copied, total } = await copyTable(source, target, table, { batch, log });
    await resetCounters(target, table);
    results.push({ table, total, copied });
  }

  // Verify against the source as it is now (rows added on the live site during the copy show as a difference).
  const report = [];
  for (const { table, total } of results) {
    const [sourceCount, targetCount] = [await count(source, table), await count(target, table)];
    let same = sourceCount === targetCount;
    let checked = 'count';
    if (same && targetCount <= CHECKSUM_LIMIT) {
      same = (await checksum(source, table)) === (await checksum(target, table));
      checked = 'count + content';
    }
    report.push({ table, source: sourceCount, target: targetCount, same, checked, copiedRows: total });
  }
  return report;
}

module.exports = { listTables, orderByDependencies, plan, copyDatabase, copyTable, resetCounters, count };
