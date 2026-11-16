const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const defaults = require('../lib/acs-defaults');

function isolatedStore(query) {
  const context = {
    module: { exports: {} }, process: { env: { DATABASE_URL: 'test' } },
    require: name => name === '@neondatabase/serverless' ? { neon: () => query } : name.endsWith('linkedin-blog-import.json') ? require('../lib/linkedin-blog-import.json') : defaults,
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/_store'), 'utf8'), context);
  return context.module.exports;
}

test('concurrent public reads share database setup, including subsequent warm reads', async () => {
  const calls = [];
  const store = isolatedStore(async parts => { calls.push(parts.join('?')); return []; });
  await Promise.all([store.getPublicData(), store.getPublicData()]);
  await store.getPublicData();
  assert.equal(calls.filter(sql => sql.startsWith('CREATE TABLE')).length, 5);
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
  // Setup statements run in parallel, so the failed attempt still issued all five before the retry.
  assert.equal(calls.filter(sql => sql.startsWith('CREATE TABLE')).length, 10);
});

test('bundled LinkedIn posts are merged into the posts blob once, keeping existing posts and slugs', async () => {
  const bundled = require('../lib/linkedin-blog-import.json');
  const values = { posts: [{ id: 'own', slug: 'own-post', title: 'Own' }, { id: 'dup', slug: bundled.posts[0].slug, title: 'Edited copy' }] };
  const query = async (parts, ...args) => {
    const sql = parts.join('?');
    if (sql.startsWith('SELECT value FROM acs_admin_data')) return values[args[0]] === undefined ? [] : [{ value: values[args[0]] }];
    if (sql.startsWith('SELECT key, value FROM acs_admin_data')) return args[0].filter((key) => values[key] !== undefined).map((key) => ({ key, value: values[key] }));
    if (sql.startsWith('INSERT INTO acs_admin_data')) { values[args[0]] = JSON.parse(args[1]); return []; }
    return [];
  };
  const store = isolatedStore(query);
  const first = (await store.getPublicData()).posts;
  assert.equal(first.length, bundled.posts.length + 1);
  assert.equal(first.find((post) => post.slug === bundled.posts[0].slug).title, 'Edited copy');
  assert.equal(values.linkedinImportVersion, bundled.version);
  values.posts = values.posts.filter((post) => post.slug !== bundled.posts[1].slug);
  assert.equal((await store.getPublicData()).posts.length, bundled.posts.length, 'a post deleted after the import stays deleted');
});
