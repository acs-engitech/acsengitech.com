const crypto = require('node:crypto');

// Default sign-in (ACS_ADMIN_EMAIL / ACS_ADMIN_PASSWORD_HASH or ACS_ADMIN_PASSWORD override it). Only the SHA-256 hash is stored.
const DEFAULT_ADMIN_EMAIL = 'acsengitech@gmail.com';
const DEFAULT_ADMIN_PASSWORD_HASH = '06b61aecf910f8007c9a0d7e0b0fcd7f6be95b29fb5a5fea8f158d5cc6e69598';

function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function configuredEmail() {
  return (process.env.ACS_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
}

function configuredHash() {
  return process.env.ACS_ADMIN_PASSWORD_HASH || hashPassword(process.env.ACS_ADMIN_PASSWORD || '') || DEFAULT_ADMIN_PASSWORD_HASH;
}

// Session secret: dedicated ACS_ADMIN_SESSION_SECRET is recommended (see admin-src/README.md),
// but falls back to the configured password hash so session signing works with zero new config.
function sessionSecret() {
  return process.env.ACS_ADMIN_SESSION_SECRET || configuredHash();
}

// Superadmin session token used by /admin: base64url({ email, expiresAt }) signed with the session secret.
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

function isSuperadmin(email, password) {
  return String(email || '').trim().toLowerCase() === configuredEmail() && safeEqual(hashPassword(password), configuredHash());
}

module.exports = { DEFAULT_ADMIN_EMAIL, hashPassword, safeEqual, configuredEmail, configuredHash, sessionSecret, isSuperadmin, signSession, verifySession };
