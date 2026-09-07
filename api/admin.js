const store = require('./_store');
const { summarizeAnalytics } = require('../lib/admin-core');
const crypto = require('node:crypto');

const DEFAULT_ADMIN_EMAIL = 'acs.mmo@gmail.com';
const DEFAULT_ADMIN_PASSWORD_HASH = 'b75a2dbee0058fc142cc4b15c7ca5df52621cfc69cd7024a527f8facad439524';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function configuredHash() {
  return process.env.ACS_ADMIN_PASSWORD_HASH || hashPassword(process.env.ACS_ADMIN_PASSWORD || '') || DEFAULT_ADMIN_PASSWORD_HASH;
}

// Session secret: dedicated ACS_ADMIN_SESSION_SECRET is recommended (see admin-src/README.md),
// but falls back to the configured password hash so session signing works with zero new config.
function sessionSecret() {
  return process.env.ACS_ADMIN_SESSION_SECRET || configuredHash();
}

function signSession(email, expiresAt) {
  const payload = Buffer.from(JSON.stringify({ email, expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  if (!safeEqual(sig, expectedSig)) return null;
  try {
    const { email, expiresAt } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!email || !expiresAt || Date.now() >= expiresAt) return null;
    return email;
  } catch {
    return null;
  }
}

// Returns { ok, viaPassword, email } instead of a plain boolean so the caller knows whether a
// fresh session token should be minted (a real login via the password path).
function authorized(req) {
  const configuredEmail = process.env.ACS_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

  const sessionToken = String(req.headers['x-admin-session'] || '');
  if (sessionToken) {
    const email = verifySession(sessionToken);
    if (email && email === configuredEmail.toLowerCase()) return { ok: true, viaPassword: false, email };
  }

  const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
  const password = String(req.headers['x-admin-password'] || '');
  if (email === configuredEmail.toLowerCase() && safeEqual(hashPassword(password), configuredHash())) {
    return { ok: true, viaPassword: true, email };
  }

  return { ok: false };
}

function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

async function runAction(payload) {
  switch (payload.action) {
    case 'application.update':
      return store.updateApplication(payload.id, payload.patch || {});
    case 'application.delete':
      return store.deleteApplications(payload.ids || []);
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
    const auth = authorized(req);
    if (!auth.ok) return send(res, 401, { error: 'Invalid admin email or password' });

    // A fresh session token is minted on every successful request (simplest sliding-window
    // design: it both establishes the session after a password login and extends it on reuse).
    const sessionExpiresAt = Date.now() + SESSION_TTL_MS;
    const sessionFields = { sessionToken: signSession(auth.email, sessionExpiresAt), sessionExpiresAt };

    if (req.method === 'GET') {
      const data = await store.getAll();
      const days = Number(req.query?.days || 30);
      const analytics = summarizeAnalytics(await store.getAnalytics(days), new Date(), days);
      return send(res, 200, { ...data, analytics, ...sessionFields });
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      if (payload.action) {
        await runAction(payload);
        const data = await store.getAll();
        return send(res, 200, { ...data, ...sessionFields });
      }

      const data = await store.saveAll(payload);
      return send(res, 200, { ...data, ...sessionFields });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
};
