const store = require('../lib/store');
const { summarizeAnalyticsGroups } = require('../lib/admin-core');
const { hashPassword, safeEqual, configuredEmail, configuredHash, signSession, verifySession } = require('../lib/admin-credentials');
const { can } = require('../lib/ops/rbac');
const opsDb = require('../lib/ops/db');
const opsAuth = require('../lib/ops/auth');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Which /admin sections each permission opens. The superadmin (directors) sees everything; HR, Content
// and Purchasing staff signing in with their own accounts see only their sections, and the server
// filters data and rejects writes outside them.
const SECTIONS = {
  'admin.content': ['seo', 'blogs', 'team', 'analytics', 'settings', 'llms'],
  'admin.hr': ['positions', 'enquiries', 'applications'],
  'admin.partners': ['partners'],
};
const ADMIN_ROLES = ['director', 'hr', 'content', 'purchase'];

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// Staff accounts live in the operations database; it is only consulted when one is configured.
async function opsUser(fn) {
  if (!opsDb.isConfigured()) return null;
  try {
    const user = await fn(await opsDb.getDb());
    return user && ADMIN_ROLES.includes(user.role) ? user : null;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

// Returns { ok, user, legacy } so the caller knows which kind of session token to mint.
async function authorized(req) {
  const sessionToken = String(req.headers['x-admin-session'] || '');
  if (sessionToken.startsWith(opsAuth.TOKEN_PREFIX)) {
    const user = await opsUser((db) => opsAuth.userFromToken(db, sessionToken));
    if (user) return { ok: true, user };
  } else if (sessionToken) {
    const email = verifySession(sessionToken);
    if (email && email === configuredEmail()) return { ok: true, legacy: true, user: opsAuth.superadminUser() };
  }

  const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
  const password = String(req.headers['x-admin-password'] || '');
  if (!email || !password) return { ok: false };
  if (email === configuredEmail() && safeEqual(hashPassword(password), configuredHash())) {
    return { ok: true, legacy: true, user: opsAuth.superadminUser() };
  }
  const user = await opsUser((db) => opsAuth.login(db, email, password));
  return user ? { ok: true, user } : { ok: false };
}

function sectionsFor(user) {
  return Object.entries(SECTIONS).filter(([permission]) => can(user, permission)).flatMap(([, sections]) => sections);
}

function scopeData(data, user) {
  if (user.role === 'director') return data;
  const scoped = { settings: data.settings };
  if (can(user, 'admin.content')) Object.assign(scoped, { pages: data.pages, posts: data.posts, team: data.team, teamLayout: data.teamLayout });
  if (can(user, 'admin.hr')) Object.assign(scoped, { positions: data.positions, positionTypes: data.positionTypes, jobs: data.jobs, applications: data.applications, enquiries: data.enquiries });
  if (can(user, 'admin.partners')) Object.assign(scoped, { partners: data.partners, partnerCategories: data.partnerCategories });
  return scoped;
}

const SAVE_PERMISSION = { pageSeo: 'admin.content', posts: 'admin.content', settings: 'admin.content', team: 'admin.content', teamLayout: 'admin.content', jobs: 'admin.hr', positions: 'admin.hr', positionTypes: 'admin.hr', partnerCategories: 'admin.partners' };
const ACTION_PERMISSION = { application: 'admin.hr', enquiry: 'admin.hr', partner: 'admin.partners', team: 'admin.content' };

function forbidden(message) {
  return Object.assign(new Error(message), { status: 403 });
}

async function runAction(payload, user) {
  const permission = ACTION_PERMISSION[String(payload.action).split('.')[0]];
  if (permission && !can(user, permission)) throw forbidden('Your role cannot change these records');
  switch (payload.action) {
    case 'application.update':
      return store.updateApplication(payload.id, payload.patch || {});
    case 'application.delete':
      return store.deleteApplications(payload.ids || []);
    case 'enquiry.update':
      return store.updateEnquiry(payload.id, payload.patch || {});
    case 'enquiry.delete':
      return store.deleteEnquiries(payload.ids || []);
    case 'partner.update':
      return store.updatePartner(payload.id, payload.patch || {});
    case 'partner.delete':
      return store.deletePartners(payload.ids || []);
    default:
      throw new Error(`Unknown action: ${payload.action}`);
  }
}

module.exports = async function handler(req, res) {
  try {
    const auth = await authorized(req);
    if (!auth.ok) return send(res, 401, { error: 'Invalid admin email or password' });
    const { user } = auth;

    // A fresh session token is minted on every successful request (simplest sliding-window
    // design: it both establishes the session after a password login and extends it on reuse).
    const sessionExpiresAt = Date.now() + SESSION_TTL_MS;
    const sessionFields = auth.legacy
      ? { sessionToken: signSession(user.email, sessionExpiresAt), sessionExpiresAt }
      : (({ token, expiresAt }) => ({ sessionToken: token, sessionExpiresAt: expiresAt }))(opsAuth.issueToken(user));
    const access = { role: user.role, name: user.name, sections: user.role === 'director' ? 'all' : sectionsFor(user) };

    if (req.method === 'GET') {
      const days = Number(req.query?.days || 30);
      const [data, analyticsGroups] = await Promise.all([
        store.getAll(),
        can(user, 'admin.content') ? store.getAnalytics(days) : [],
      ]);
      const analytics = can(user, 'admin.content') ? summarizeAnalyticsGroups(analyticsGroups, days) : undefined;
      return send(res, 200, { ...scopeData(data, user), analytics, access, ...sessionFields });
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      // A team photo upload answers with the photo's URL only; the member itself is saved separately.
      if (payload.action === 'team.photo') {
        if (!can(user, 'admin.content')) throw forbidden('Your role cannot change the team');
        return send(res, 200, { url: await store.saveTeamPhoto(payload.dataUrl), ...sessionFields });
      }

      if (payload.action) {
        await runAction(payload, user);
        const data = await store.getAll();
        return send(res, 200, { ...scopeData(data, user), access, ...sessionFields });
      }

      const denied = Object.keys(payload).find((key) => SAVE_PERMISSION[key] && !can(user, SAVE_PERMISSION[key]));
      if (denied) throw forbidden('Your role cannot change these settings');
      const data = await store.saveAll(payload);
      return send(res, 200, { ...scopeData(data, user), access, ...sessionFields });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message });
  }
};
