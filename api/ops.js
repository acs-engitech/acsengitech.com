// Operations API: one endpoint for the trading, purchasing, dispatch, inventory, command-center and
// customer-portal workspaces.
//   GET  /api/ops?view=<name>&...params     read model (permission checked per view)
//   POST /api/ops { action, input }          workflow command (permission + state checked per command)
//   POST /api/ops { action: 'auth.login', email, password }
// Sessions travel in the x-ops-session header.
const { getDb } = require('../lib/ops/db');
const auth = require('../lib/ops/auth');
const { execute } = require('../lib/ops/service');
const { read } = require('../lib/ops/queries');
const { checkRateLimit, clientIp } = require('../lib/rate-limit');

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 1_000_000) throw Object.assign(new Error('Request too large'), { status: 413 });
  return JSON.parse(raw || '{}');
}

module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    if (req.method === 'POST') {
      const payload = await body(req);
      if (payload.action === 'auth.login') {
        if (!checkRateLimit(`ops-login:${clientIp(req)}`, 10, 15 * 60 * 1000)) return send(res, 429, { error: 'Too many sign-in attempts. Try again in 15 minutes.' });
        const user = await auth.login(db, payload.email, payload.password);
        const session = auth.issueToken(user);
        return send(res, 200, { ...session, me: await read(db, user, 'me') });
      }
      const user = await auth.userFromToken(db, String(req.headers['x-ops-session'] || ''));
      if (!user) return send(res, 401, { error: 'Your session has ended. Sign in again.' });
      const result = await execute(db, user, String(payload.action || ''), payload.input || {});
      return send(res, 200, { ok: true, result });
    }
    if (req.method === 'GET') {
      const user = await auth.userFromToken(db, String(req.headers['x-ops-session'] || ''));
      if (!user) return send(res, 401, { error: 'Your session has ended. Sign in again.' });
      const params = req.query || Object.fromEntries(new URL(req.url, 'http://local').searchParams);
      return send(res, 200, await read(db, user, String(params.view || 'me'), params));
    }
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    // Unexpected failures are logged server-side; the client gets a generic message, not internals.
    if (status >= 500) console.error('[api/ops]', error);
    return send(res, status, { error: status >= 500 ? 'Something went wrong on our side. Nothing was changed.' : error.message });
  }
};
