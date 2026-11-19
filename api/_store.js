const { neon } = require('@neondatabase/serverless');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS, DEFAULT_JOBS, DEFAULT_POSITION_TYPES, DEFAULT_PARTNER_CATEGORIES } = require('../lib/acs-defaults');

let sql;
let initialization;

// Neon connection string. NEON_DATABASE_URL is the dedicated variable; the names the Vercel Neon
// integration creates (DATABASE_URL, POSTGRES_URL) are accepted as fallbacks.
const CONNECTION_ENV = ['NEON_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL'];

function connectionString() {
  for (const name of CONNECTION_ENV) if (process.env[name]) return process.env[name];
  return '';
}

function db() {
  if (sql) return sql;
  const url = connectionString();
  if (url) return (sql = neon(url));
  // Local runs without Neon (local-dev-server.js sets ACS_OPS_PGLITE_DIR) share the embedded Postgres the
  // operations platform already uses, so the admin works offline too. Never on Vercel.
  if (!process.env.VERCEL && process.env.ACS_OPS_PGLITE_DIR) return (sql = localSql());
  throw new Error(`Database is not configured: set ${CONNECTION_ENV.join(' or ')}`);
}

// A tagged-template function with the Neon driver's calling convention, backed by the ops PGlite driver.
function localSql() {
  const driver = require('../lib/ops/db').getDb();
  return async (parts, ...values) => {
    const text = parts.reduce((out, part, index) => `${out}$${index}${part}`);
    return (await driver).query(text, values);
  };
}

function init() {
  // Share setup across concurrent reads and warm invocations; allow outage recovery.
  initialization ||= createTables().catch(error => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

async function createTables() {
  // Independent statements, so they run together: one round trip of latency on a cold start instead of six.
  await Promise.all([
    db()`CREATE TABLE IF NOT EXISTS acs_admin_data (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    db()`CREATE TABLE IF NOT EXISTS acs_analytics_events (
      id bigserial PRIMARY KEY,
      path text NOT NULL,
      visitor_id text,
      referrer text,
      device text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.then(() => db()`CREATE INDEX IF NOT EXISTS acs_analytics_events_created_at ON acs_analytics_events (created_at)`),
    db()`CREATE TABLE IF NOT EXISTS acs_applications (
      id bigserial PRIMARY KEY,
      position_id text,
      position_title text,
      name text NOT NULL,
      email text NOT NULL,
      phone text,
      years_experience text,
      message text,
      resume_url text,
      resume_filename text,
      resume_size integer,
      status text NOT NULL DEFAULT 'new',
      admin_notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    db()`CREATE TABLE IF NOT EXISTS acs_enquiries (
      id bigserial PRIMARY KEY,
      first_name text NOT NULL,
      last_name text NOT NULL,
      email text NOT NULL,
      subject text NOT NULL,
      message text NOT NULL,
      status text NOT NULL DEFAULT 'new',
      admin_notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    db()`CREATE TABLE IF NOT EXISTS acs_partners (
      id bigserial PRIMARY KEY,
      category text,
      name text NOT NULL,
      email text NOT NULL,
      phone text,
      city text,
      entity_type text,
      years_experience text,
      portfolio_urls jsonb DEFAULT '[]'::jsonb,
      profile_url text,
      profile_filename text,
      profile_size integer,
      description text,
      status text NOT NULL DEFAULT 'new',
      admin_notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    // Team photos live in the database (base64) so they work without any extra storage service.
    db()`CREATE TABLE IF NOT EXISTS acs_team_photos (
      id text PRIMARY KEY,
      mime text NOT NULL,
      data text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  ]);
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

// Page SEO overrides saved before version 2 were full copies of the old defaults (plus test edits) and would
// mask the current defaults on the live site, so only overrides saved by the current admin are applied.
const PAGE_SEO_VERSION = 2;

async function getPageSeo() {
  const [pageSeo, version] = await Promise.all([getValue('pageSeo', {}), getValue('pageSeoVersion', 1)]);
  return Number(version) >= PAGE_SEO_VERSION ? pageSeo || {} : {};
}

// ---------- Batched reads ----------
// Network round trips to the database dominate request time (the function and Neon are not co-located), so the
// admin and public payloads are each read in ONE round trip: every key/value blob in a single SELECT, plus the
// record tables and analytics, sent together as one Neon HTTP transaction. Anything that must be written back
// (first-time migrations) is returned as `writes` and done after the read.
const KV_KEYS = ['settings', 'pageSeo', 'pageSeoVersion', 'posts', 'jobs', 'positions', 'positionTypes', 'partnerCategories', 'linkedinImportVersion', 'team', 'teamLayout'];

// One HTTP request when the driver supports transactions, parallel requests otherwise (tests, local fakes).
async function batch(build) {
  const sql = db();
  const queries = build(sql);
  return typeof sql.transaction === 'function' ? sql.transaction(queries) : Promise.all(queries);
}

const kvQuery = (sql) => sql`SELECT key, value FROM acs_admin_data WHERE key = ANY(${KV_KEYS})`;

function kvMap(rows) {
  const map = new Map();
  for (const row of rows || []) map.set(row.key, row.value);
  return (key, fallback) => map.get(key) ?? fallback;
}

function resolveKv(get) {
  const writes = [];
  const pageSeoVersion = Number(get('pageSeoVersion', 1));
  const jobs = get('jobs', DEFAULT_JOBS);
  let positions = get('positions', []);
  if (!positions || !positions.length) {
    positions = (jobs || []).map(migrateJobToPosition);
    writes.push(['positions', positions]);
  }
  let posts = get('posts', []) || [];
  const linkedin = require('../lib/linkedin-blog-import.json');
  if (Number(get('linkedinImportVersion', 0)) < linkedin.version) {
    const existing = new Set(posts.map((post) => post.slug));
    posts = [...posts, ...linkedin.posts.filter((post) => !existing.has(post.slug))];
    writes.push(['posts', posts], ['linkedinImportVersion', linkedin.version]);
  }
  return {
    writes,
    pageSeo: pageSeoVersion >= PAGE_SEO_VERSION ? get('pageSeo', {}) || {} : {},
    settings: get('settings', {}),
    posts,
    jobs,
    positions,
    positionTypes: get('positionTypes', DEFAULT_POSITION_TYPES),
    partnerCategories: get('partnerCategories', DEFAULT_PARTNER_CATEGORIES),
    team: normalizeTeam(get('team', TEAM_SEED)),
    teamLayout: normalizeTeamLayout(get('teamLayout', {})),
  };
}

// ---------- Team (About page) ----------
// Members are one ordered list (the order shown on /about), stored as a key/value blob like positions.
// The team photos supplied in Nov 2026 (four directors first, then six team members), used until the team is
// first saved in the admin. Names (and the members' designations) are left blank until ACS confirms them; the
// About page keeps the space for them.
const TEAM_SEED = [
  ...[1, 2, 3, 4].map((n) => ({ id: `seed-director-${n}`, name: '', role: 'Director', photo: `/assets/team/director-${n}.webp`, status: 'live' })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `seed-member-${n}`, name: '', role: '', photo: `/assets/team/member-${n}.webp`, status: 'live' })),
];

const TEAM_FIELDS = ['name', 'role', 'department', 'bio', 'photo', 'linkedin', 'email'];
const TEAM_PHOTO_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const TEAM_PHOTO_MAX_BYTES = 1024 * 1024;

// How the About page lays the team out: columns per screen size, how many rows show before "View the full team"
// (0 = everyone), and the photo shape. Anything out of range falls back to the default.
const TEAM_LAYOUT_DEFAULTS = { columns: 4, tabletColumns: 3, mobileColumns: 2, rows: 0, photo: 'portrait' };
const TEAM_LAYOUT_LIMITS = { columns: [2, 6], tabletColumns: [1, 4], mobileColumns: [1, 3], rows: [0, 10] };
const TEAM_PHOTO_SHAPES = ['portrait', 'square', 'tall'];

function normalizeTeamLayout(layout) {
  const input = layout && typeof layout === 'object' ? layout : {};
  const clean = { ...TEAM_LAYOUT_DEFAULTS };
  for (const [key, [min, max]] of Object.entries(TEAM_LAYOUT_LIMITS)) {
    const value = Number(input[key]);
    if (Number.isInteger(value) && value >= min && value <= max) clean[key] = value;
  }
  if (TEAM_PHOTO_SHAPES.includes(input.photo)) clean.photo = input.photo;
  return clean;
}

function normalizeTeam(list) {
  return (Array.isArray(list) ? list : [])
    .filter((member) => member && typeof member === 'object' && (String(member.name || '').trim() || String(member.photo || '').trim()))
    .map((member) => {
      const clean = { id: String(member.id || require('node:crypto').randomUUID()), status: member.status === 'hidden' ? 'hidden' : 'live' };
      for (const field of TEAM_FIELDS) clean[field] = String(member[field] || '').trim().slice(0, field === 'bio' ? 1200 : 400);
      return clean;
    });
}

const teamPhotoId = (url) => (/^\/api\/team-photo\?id=([\w-]+)$/.exec(url || '') || [])[1];

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

// Takes a data: URL from the admin (already resized in the browser) and returns the URL the photo is served at.
async function saveTeamPhoto(dataUrl) {
  const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match || !TEAM_PHOTO_TYPES.includes(match[1])) throw badRequest('Upload a JPG, PNG or WebP image');
  if (Buffer.byteLength(match[2], 'base64') > TEAM_PHOTO_MAX_BYTES) throw badRequest('Image is too large (1 MB max)');
  await init();
  const id = require('node:crypto').randomUUID();
  await db()`INSERT INTO acs_team_photos (id, mime, data) VALUES (${id}, ${match[1]}, ${match[2]})`;
  return `/api/team-photo?id=${id}`;
}

async function getTeamPhoto(id) {
  await init();
  const rows = await db()`SELECT mime, data FROM acs_team_photos WHERE id = ${String(id || '')}`;
  return rows[0] ? { mime: rows[0].mime, buffer: Buffer.from(rows[0].data, 'base64') } : null;
}

// Photos no member uses any more are removed once a day old (a fresh upload may not be saved yet).
async function pruneTeamPhotos(team) {
  const keep = team.map((member) => teamPhotoId(member.photo)).filter(Boolean);
  await db()`DELETE FROM acs_team_photos WHERE created_at < now() - interval '1 day' AND NOT (id = ANY(${keep}))`;
}

async function applyWrites(writes) {
  for (const [key, value] of writes) await setValue(key, value);
}

function migrateJobToPosition(job) {
  return {
    ...job,
    type: job.type || 'Full-time',
    tags: Array.isArray(job.tags) ? job.tags : [],
    status: job.status === 'closed' ? 'closed' : 'live',
  };
}

async function getPositions() {
  const jobs = await getValue('jobs', DEFAULT_JOBS);
  let positions = await getValue('positions', []);
  if (!positions || !positions.length) {
    positions = (jobs || []).map(migrateJobToPosition);
    await setValue('positions', positions);
  }
  return positions;
}

async function getPositionTypes() {
  return getValue('positionTypes', DEFAULT_POSITION_TYPES);
}

async function setPositionTypes(list) {
  return setValue('positionTypes', Array.isArray(list) ? list : DEFAULT_POSITION_TYPES);
}

async function getPartnerCategories() {
  return getValue('partnerCategories', DEFAULT_PARTNER_CATEGORIES);
}

async function setPartnerCategories(list) {
  return setValue('partnerCategories', Array.isArray(list) ? list : DEFAULT_PARTNER_CATEGORIES);
}

function rowToApplication(row) {
  return {
    id: String(row.id),
    positionId: row.position_id,
    positionTitle: row.position_title,
    name: row.name,
    email: row.email,
    phone: row.phone,
    yearsExperience: row.years_experience,
    message: row.message,
    resumeUrl: row.resume_url,
    resumeFilename: row.resume_filename,
    resumeSize: row.resume_size,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insertApplication(row) {
  await init();
  const rows = await db()`INSERT INTO acs_applications
    (position_id, position_title, name, email, phone, years_experience, message, resume_url, resume_filename, resume_size, status)
    VALUES (${row.positionId || null}, ${row.positionTitle || null}, ${row.name}, ${row.email}, ${row.phone || null}, ${row.yearsExperience || null}, ${row.message || null}, ${row.resumeUrl || null}, ${row.resumeFilename || null}, ${row.resumeSize || null}, 'new')
    RETURNING *`;
  return rowToApplication(rows[0]);
}

async function listApplications() {
  await init();
  const rows = await db()`SELECT * FROM acs_applications ORDER BY created_at DESC`;
  return rows.map(rowToApplication);
}

async function updateApplication(id, patch) {
  await init();
  const current = await db()`SELECT * FROM acs_applications WHERE id = ${id}`;
  if (!current[0]) return null;
  const status = patch.status ?? current[0].status;
  const notes = patch.adminNotes ?? current[0].admin_notes;
  const rows = await db()`UPDATE acs_applications SET status = ${status}, admin_notes = ${notes}, updated_at = now() WHERE id = ${id} RETURNING *`;
  return rowToApplication(rows[0]);
}

async function deleteApplications(ids) {
  await init();
  const numericIds = (ids || []).map(Number).filter((n) => Number.isFinite(n));
  if (!numericIds.length) return [];
  await db()`DELETE FROM acs_applications WHERE id = ANY(${numericIds})`;
  return numericIds;
}

function rowToEnquiry(row) {
  return {
    id: String(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insertEnquiry(row) {
  await init();
  const rows = await db()`INSERT INTO acs_enquiries (first_name, last_name, email, subject, message, status)
    VALUES (${row.firstName}, ${row.lastName}, ${row.email}, ${row.subject}, ${row.message}, 'new')
    RETURNING *`;
  return rowToEnquiry(rows[0]);
}

async function listEnquiries() {
  await init();
  const rows = await db()`SELECT * FROM acs_enquiries ORDER BY created_at DESC`;
  return rows.map(rowToEnquiry);
}

async function updateEnquiry(id, patch) {
  await init();
  const current = await db()`SELECT * FROM acs_enquiries WHERE id = ${id}`;
  if (!current[0]) return null;
  const status = patch.status ?? current[0].status;
  const notes = patch.adminNotes ?? current[0].admin_notes;
  const rows = await db()`UPDATE acs_enquiries SET status = ${status}, admin_notes = ${notes}, updated_at = now() WHERE id = ${id} RETURNING *`;
  return rowToEnquiry(rows[0]);
}

async function deleteEnquiries(ids) {
  await init();
  const numericIds = (ids || []).map(Number).filter((n) => Number.isFinite(n));
  if (!numericIds.length) return [];
  await db()`DELETE FROM acs_enquiries WHERE id = ANY(${numericIds})`;
  return numericIds;
}

function rowToPartner(row) {
  return {
    id: String(row.id),
    category: row.category,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    entityType: row.entity_type,
    yearsExperience: row.years_experience,
    portfolioUrls: row.portfolio_urls || [],
    profileUrl: row.profile_url,
    profileFilename: row.profile_filename,
    profileSize: row.profile_size,
    description: row.description,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insertPartner(row) {
  await init();
  const rows = await db()`INSERT INTO acs_partners
    (category, name, email, phone, city, entity_type, years_experience, portfolio_urls, profile_url, profile_filename, profile_size, description, status)
    VALUES (${row.category || null}, ${row.name}, ${row.email}, ${row.phone || null}, ${row.city || null}, ${row.entityType || null}, ${row.yearsExperience || null}, ${JSON.stringify(row.portfolioUrls || [])}::jsonb, ${row.profileUrl || null}, ${row.profileFilename || null}, ${row.profileSize || null}, ${row.description || null}, 'new')
    RETURNING *`;
  return rowToPartner(rows[0]);
}

async function listPartners() {
  await init();
  const rows = await db()`SELECT * FROM acs_partners ORDER BY created_at DESC`;
  return rows.map(rowToPartner);
}

async function updatePartner(id, patch) {
  await init();
  const current = await db()`SELECT * FROM acs_partners WHERE id = ${id}`;
  if (!current[0]) return null;
  const status = patch.status ?? current[0].status;
  const notes = patch.adminNotes ?? current[0].admin_notes;
  const rows = await db()`UPDATE acs_partners SET status = ${status}, admin_notes = ${notes}, updated_at = now() WHERE id = ${id} RETURNING *`;
  return rowToPartner(rows[0]);
}

async function deletePartners(ids) {
  await init();
  const numericIds = (ids || []).map(Number).filter((n) => Number.isFinite(n));
  if (!numericIds.length) return [];
  await db()`DELETE FROM acs_partners WHERE id = ANY(${numericIds})`;
  return numericIds;
}

async function getAll() {
  await init();
  const [kvRows, applications, partners, enquiries] = await batch((sql) => [
    kvQuery(sql),
    sql`SELECT * FROM acs_applications ORDER BY created_at DESC`,
    sql`SELECT * FROM acs_partners ORDER BY created_at DESC`,
    sql`SELECT * FROM acs_enquiries ORDER BY created_at DESC`,
  ]);
  const kv = resolveKv(kvMap(kvRows));
  await applyWrites(kv.writes);
  return {
    pages: PAGE_DEFAULTS.map((page) => ({
      path: page.path,
      label: page.label,
      file: page.file,
      defaults: page.defaults,
      seo: kv.pageSeo[page.path] || {},
    })),
    posts: kv.posts,
    jobs: kv.jobs,
    positions: kv.positions,
    positionTypes: kv.positionTypes,
    applications: applications.map(rowToApplication),
    partners: partners.map(rowToPartner),
    enquiries: enquiries.map(rowToEnquiry),
    partnerCategories: kv.partnerCategories,
    team: kv.team,
    teamLayout: kv.teamLayout,
    settings: { ...DEFAULT_SETTINGS, ...kv.settings },
  };
}

async function getPublicData() {
  await init();
  const [kvRows] = await batch((sql) => [kvQuery(sql)]);
  const kv = resolveKv(kvMap(kvRows));
  await applyWrites(kv.writes);
  return {
    pages: PAGE_DEFAULTS.map((page) => ({
      path: page.path,
      label: page.label,
      file: page.file,
      defaults: page.defaults,
      seo: kv.pageSeo[page.path] || {},
    })),
    posts: kv.posts,
    jobs: kv.jobs,
    positions: kv.positions,
    positionTypes: kv.positionTypes,
    partnerCategories: kv.partnerCategories,
    team: kv.team,
    teamLayout: kv.teamLayout,
    settings: { ...DEFAULT_SETTINGS, ...kv.settings },
  };
}

async function saveAll(payload) {
  const writes = [];
  if (payload.pageSeo) writes.push(setValue('pageSeo', payload.pageSeo), setValue('pageSeoVersion', PAGE_SEO_VERSION));
  if (payload.posts) writes.push(setValue('posts', payload.posts));
  if (payload.jobs) writes.push(setValue('jobs', payload.jobs));
  if (payload.positions) writes.push(setValue('positions', payload.positions));
  if (payload.positionTypes) writes.push(setPositionTypes(payload.positionTypes));
  if (payload.partnerCategories) writes.push(setPartnerCategories(payload.partnerCategories));
  if (payload.settings) writes.push(setValue('settings', { ...DEFAULT_SETTINGS, ...payload.settings }));
  if (payload.teamLayout) writes.push(setValue('teamLayout', normalizeTeamLayout(payload.teamLayout)));
  if (Array.isArray(payload.team)) {
    const team = normalizeTeam(payload.team);
    writes.push(setValue('team', team).then(() => pruneTeamPhotos(team)));
  }
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
  // Grouped in Postgres: the admin needs counts, not every raw page view (which grows with traffic).
  const [totals, devices, pages, referrers, daily] = await batch((sql) => [
    sql`SELECT count(*)::int AS views, count(DISTINCT NULLIF(visitor_id, ''))::int AS visitors
      FROM acs_analytics_events WHERE created_at >= ${since}`,
    sql`SELECT device AS key, count(*)::int AS count FROM acs_analytics_events
      WHERE created_at >= ${since} GROUP BY device`,
    sql`SELECT path AS key, count(*)::int AS count FROM acs_analytics_events
      WHERE created_at >= ${since} GROUP BY path ORDER BY count DESC LIMIT 200`,
    sql`SELECT referrer AS key, count(*)::int AS count FROM acs_analytics_events
      WHERE created_at >= ${since} AND referrer <> '' GROUP BY referrer ORDER BY count DESC LIMIT 500`,
    sql`SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS key, count(*)::int AS count
      FROM acs_analytics_events WHERE created_at >= ${since} GROUP BY 1 ORDER BY 1`,
  ]);
  return { views: totals[0]?.views || 0, visitors: totals[0]?.visitors || 0, devices, pages, referrers, daily };
}

module.exports = {
  PAGE_SEO_VERSION,
  connectionString,
  getAll,
  getPublicData,
  saveAll,
  recordAnalytics,
  getAnalytics,
  getPositions,
  getPositionTypes,
  setPositionTypes,
  getPartnerCategories,
  setPartnerCategories,
  insertApplication,
  listApplications,
  updateApplication,
  deleteApplications,
  insertEnquiry,
  listEnquiries,
  updateEnquiry,
  deleteEnquiries,
  insertPartner,
  listPartners,
  updatePartner,
  deletePartners,
  normalizeTeam,
  normalizeTeamLayout,
  saveTeamPhoto,
  getTeamPhoto,
};
