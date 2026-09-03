const { test } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

test('admin build emits index.html and brand-tokened CSS', () => {
  execSync('npm run build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  const adminDir = path.resolve(__dirname, '..', 'admin');
  assert.ok(fs.existsSync(path.join(adminDir, 'index.html')), 'admin/index.html missing');
  const css = fs.readdirSync(path.join(adminDir, 'assets')).filter((f) => f.endsWith('.css'));
  assert.ok(css.length > 0, 'no compiled CSS emitted');
  const cssText = css.map((f) => fs.readFileSync(path.join(adminDir, 'assets', f), 'utf8')).join('');
  assert.match(cssText, /#0067ff/i, 'ACS brand color not in compiled CSS');
  assert.match(cssText, /Outfit/i, 'Outfit font not in compiled CSS');
});
