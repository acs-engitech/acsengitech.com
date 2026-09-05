const store = require('./_store');
const { summarizeAnalytics } = require('../lib/admin-core');
const crypto = require('node:crypto');

const DEFAULT_ADMIN_EMAIL = 'acs.mmo@gmail.com';
const DEFAULT_ADMIN_PASSWORD_HASH = 'b75a2dbee0058fc142cc4b15c7ca5df52621cfc69cd7024a527f8facad439524';

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function authorized(req) {
  const configuredEmail = process.env.ACS_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const configuredHash = process.env.ACS_ADMIN_PASSWORD_HASH || hashPassword(process.env.ACS_ADMIN_PASSWORD || '') || DEFAULT_ADMIN_PASSWORD_HASH;
  const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
  const password = String(req.headers['x-admin-password'] || '');
  return email === configuredEmail.toLowerCase() && safeEqual(hashPassword(password), configuredHash);
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
    if (!authorized(req)) return send(res, 401, { error: 'Invalid admin email or password' });

    if (req.method === 'GET') {
      const data = await store.getAll();
      const days = Number(req.query?.days || 30);
      const analytics = summarizeAnalytics(await store.getAnalytics(days), new Date(), days);
      return send(res, 200, { ...data, analytics });
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      if (payload.action) {
        await runAction(payload);
        const data = await store.getAll();
        return send(res, 200, data);
      }

      const data = await store.saveAll(payload);
      return send(res, 200, data);
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
};
