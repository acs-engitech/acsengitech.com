const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('legacy standalone admin files are gone', () => {
  for (const f of ['admin.html', 'acs-admin.css', 'acs-admin.js'])
    assert.ok(!fs.existsSync(path.join(root, f)), `${f} should be deleted`);
});
