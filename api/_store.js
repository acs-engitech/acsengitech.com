const { neon } = require('@neondatabase/serverless');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS, DEFAULT_JOBS } = require('../lib/acs-defaults');

let sql;

function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  sql ||= neon(process.env.DATABASE_URL);
  return sql;
}

async function init() {
  await db()`CREATE TABLE IF NOT EXISTS acs_admin_data (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db()`CREATE TABLE IF NOT EXISTS acs_analytics_events (
    id bigserial PRIMARY KEY,
    path text NOT NULL,
    visitor_id text,
    referrer text,
    device text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
}

async function getValue(key, fallback) {
  await init();
  const rows = await db()`SELECT value FROM acs_admin_data WHERE key = ${key}`;
  return rows[0]?.value ?? fallback;
}

async function setValue(key, value) {
  await init();
  await db()`INSERT INTO acs_admin_data (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  return value;
}

async function getAll() {
  const pageSeo = await getValue('pageSeo', {});
  const settings = await getValue('settings', {});
  return {
    pages: PAGE_DEFAULTS.map((page) => ({
      path: page.path,
      label: page.label,
      file: page.file,
      defaults: page.defaults,
      seo: pageSeo[page.path] || {},
    })),
    posts: await getValue('posts', []),
    jobs: await getValue('jobs', DEFAULT_JOBS),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

async function saveAll(payload) {
  const writes = [];
  if (payload.pageSeo) writes.push(setValue('pageSeo', payload.pageSeo));
  if (payload.posts) writes.push(setValue('posts', payload.posts));
  if (payload.jobs) writes.push(setValue('jobs', payload.jobs));
  if (payload.settings) writes.push(setValue('settings', { ...DEFAULT_SETTINGS, ...payload.settings }));
  await Promise.all(writes);
  return getAll();
}

async function recordAnalytics(event) {
  await init();
  await db()`INSERT INTO acs_analytics_events (path, visitor_id, referrer, device, user_agent)
    VALUES (${event.path || '/'}, ${event.visitorId || ''}, ${event.referrer || ''}, ${event.device || 'desktop'}, ${event.userAgent || ''})`;
}

async function getAnalytics(days = 30) {
  await init();
  const since = new Date(Date.now() - (Number(days) || 30) * 24 * 60 * 60 * 1000).toISOString();
  const rows = await db()`SELECT path, visitor_id AS "visitorId", referrer, device, created_at AS "createdAt"
    FROM acs_analytics_events
    WHERE created_at >= ${since}
    ORDER BY created_at ASC`;
  return rows;
}

module.exports = {
  getAll,
  saveAll,
  recordAnalytics,
  getAnalytics,
};
