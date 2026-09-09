const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const defaults = require('../lib/acs-defaults');

function isolatedStore(query) {
  const context = {
    module: { exports: {} }, process: { env: { DATABASE_URL: 'test' } },
    require: name => name === '@neondatabase/serverless' ? { neon: () => query } : defaults,
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/_store'), 'utf8'), context);
  return context.module.exports;
}

test('concurrent public reads share database setup, including subsequent warm reads', async () => {
  const calls = [];
  const store = isolatedStore(async parts => { calls.push(parts.join('?')); return []; });
  await Promise.all([store.getPublicData(), store.getPublicData()]);
  await store.getPublicData();
  assert.equal(calls.filter(sql => sql.startsWith('CREATE TABLE')).length, 4);
});

test('database setup can retry after a temporary failure', async () => {
  let failed = false;
  const calls = [];
  const store = isolatedStore(async parts => {
    const query = parts.join('?'); calls.push(query);
    if (!failed) { failed = true; throw new Error('temporary database outage'); }
    return [];
  });
  await assert.rejects(store.getPublicData(), /temporary database outage/);
  await store.getPublicData();
  assert.equal(calls.filter(sql => sql.startsWith('CREATE TABLE')).length, 5);
});
