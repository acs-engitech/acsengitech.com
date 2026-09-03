const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('vercel.json rewrites /admin to the built admin/index.html with no trailing-slash redirect', () => {
  const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'vercel.json'), 'utf8'));

  const adminRewrite = (cfg.rewrites || []).find((r) => r.source === '/admin');
  assert.ok(adminRewrite, '/admin rewrite must exist');
  assert.equal(adminRewrite.destination, '/admin/index.html');

  const bareRedirect = (cfg.redirects || []).find((r) => r.source === '/admin');
  assert.equal(bareRedirect, undefined, 'no /admin -> /admin/ trailing-slash redirect (incompatible with trailingSlash: false)');

  assert.equal(cfg.cleanUrls, true);
  assert.equal(cfg.trailingSlash, false);
});
