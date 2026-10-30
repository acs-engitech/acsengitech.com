// Operations sign-in. The existing /admin superadmin login signs in as a director (user id 0); every
// other person is a row in ops_users with one role and a scrypt password hash.
const crypto = require('node:crypto');
const { safeEqual, sessionSecret, isSuperadmin, configuredEmail, verifySession } = require('../admin-credentials');
const { OpsError } = require('./rbac');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TOKEN_PREFIX = 'ops.';

function hashUserPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

function verifyUserPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  return safeEqual(crypto.scryptSync(String(password), salt, 32).toString('base64url'), hash);
}

function generatePassword() {
  return crypto.randomBytes(9).toString('base64url');
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', `ops:${sessionSecret()}`).update(body).digest('base64url');
  return `${TOKEN_PREFIX}${body}.${sig}`;
}

function issueToken(user, now = Date.now()) {
  const exp = now + SESSION_TTL_MS;
  return { token: sign({ uid: user.id, role: user.role, email: user.email, exp }), expiresAt: exp };
}

function readToken(token, now = Date.now()) {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) return null;
  const [body, sig] = token.slice(TOKEN_PREFIX.length).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', `ops:${sessionSecret()}`).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

function superadminUser() {
  return { id: 0, email: configuredEmail(), name: 'Director', role: 'director', customerId: null, active: true };
}

function rowToUser(row) {
  return { id: row.id, email: row.email, name: row.name, role: row.role, customerId: row.customer_id, active: row.active };
}

async function login(db, email, password) {
  if (isSuperadmin(email, password)) return superadminUser();
  const rows = await db.query('SELECT * FROM ops_users WHERE lower(email) = lower($1)', [String(email || '').trim()]);
  const row = rows[0];
  if (!row || !row.active || !verifyUserPassword(password, row.password_hash)) throw new OpsError(401, 'Invalid email or password');
  await db.query('UPDATE ops_users SET last_login_at = now() WHERE id = $1', [row.id]);
  return rowToUser(row);
}

// Every request re-reads the user so a deactivated account or changed role takes effect immediately.
async function userFromToken(db, token) {
  // A director already signed in to /admin carries that session into the command center.
  if (token && !String(token).startsWith(TOKEN_PREFIX)) return verifySession(token) === configuredEmail() ? superadminUser() : null;
  const payload = readToken(token);
  if (!payload) return null;
  if (payload.uid === 0) return payload.email === configuredEmail() ? superadminUser() : null;
  const rows = await db.query('SELECT * FROM ops_users WHERE id = $1', [payload.uid]);
  const row = rows[0];
  if (!row || !row.active) return null;
  return rowToUser(row);
}

module.exports = { hashUserPassword, verifyUserPassword, generatePassword, issueToken, readToken, login, userFromToken, rowToUser, superadminUser, TOKEN_PREFIX };
