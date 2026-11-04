const { neon } = require('@neondatabase/serverless');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS, DEFAULT_JOBS, DEFAULT_POSITION_TYPES, DEFAULT_PARTNER_CATEGORIES } = require('../lib/acs-defaults');
const LINKEDIN_IMPORT = require('../lib/linkedin-blog-import.json');

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
  const url = connectionString();
  if (!url) {
    throw new Error(`Database is not configured: set ${CONNECTION_ENV.join(' or ')}`);
  }
  sql ||= neon(url);
  return sql;
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
  await db()`CREATE TABLE IF NOT EXISTS acs_applications (
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
  )`;
  await db()`CREATE TABLE IF NOT EXISTS acs_enquiries (
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
  )`;
  await db()`CREATE TABLE IF NOT EXISTS acs_partners (
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

// Page SEO overrides saved before version 2 were full copies of the old defaults (plus test edits) and would
// mask the current defaults on the live site, so only overrides saved by the current admin are applied.
const PAGE_SEO_VERSION = 2;

async function getPageSeo() {
  const [pageSeo, version] = await Promise.all([getValue('pageSeo', {}), getValue('pageSeoVersion', 1)]);
  return Number(version) >= PAGE_SEO_VERSION ? pageSeo || {} : {};
}

function migrateJobToPosition(job) {
  return {
    ...job,
    type: job.type || 'Full-time',
    tags: Array.isArray(job.tags) ? job.tags : [],
    status: job.status === 'closed' ? 'closed' : 'live',
  };
}

// LinkedIn articles bundled with the site are merged into the posts blob once (matched by slug), so they appear in
// the admin as ordinary posts and their publish dates drive the daily 08:00 IST schedule. Deleting one later sticks.
async function getPosts() {
  const posts = (await getValue('posts', [])) || [];
  const importedVersion = Number(await getValue('linkedinImportVersion', 0));
  if (importedVersion >= LINKEDIN_IMPORT.version) return posts;
  const existing = new Set(posts.map((post) => post.slug));
  const merged = [...posts, ...LINKEDIN_IMPORT.posts.filter((post) => !existing.has(post.slug))];
  await setValue('posts', merged);
  await setValue('linkedinImportVersion', LINKEDIN_IMPORT.version);
  return merged;
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
  const pageSeo = await getPageSeo();
  const settings = await getValue('settings', {});
  const [positions, positionTypes, partnerCategories, applications, partners, enquiries] = await Promise.all([
    getPositions(),
    getPositionTypes(),
    getPartnerCategories(),
    listApplications(),
    listPartners(),
    listEnquiries(),
  ]);
  return {
    pages: PAGE_DEFAULTS.map((page) => ({
      path: page.path,
      label: page.label,
      file: page.file,
      defaults: page.defaults,
      seo: pageSeo[page.path] || {},
    })),
    posts: await getPosts(),
    jobs: await getValue('jobs', DEFAULT_JOBS),
    positions,
    positionTypes,
    applications,
    partners,
    enquiries,
    partnerCategories,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

async function getPublicData() {
  const pageSeo = await getPageSeo();
  const settings = await getValue('settings', {});
  const [positions, positionTypes, partnerCategories, posts, jobs] = await Promise.all([
    getPositions(),
    getPositionTypes(),
    getPartnerCategories(),
    getPosts(),
    getValue('jobs', DEFAULT_JOBS),
  ]);
  return {
    pages: PAGE_DEFAULTS.map((page) => ({
      path: page.path,
      label: page.label,
      file: page.file,
      defaults: page.defaults,
      seo: pageSeo[page.path] || {},
    })),
    posts,
    jobs,
    positions,
    positionTypes,
    partnerCategories,
    settings: { ...DEFAULT_SETTINGS, ...settings },
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
};
