const { test } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../lib/store');

function fakeResponse() {
  return { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b || ''; } };
}

const post = {
  id: 'p1', slug: 'plc-basics', title: 'PLC Basics for Plant Engineers', excerpt: 'What a PLC does and how to size one.',
  author: 'ACS Engitech', coverImage: '/assets/blog/plc-basics.webp', tags: ['PLC'], status: 'published',
  publishedAt: '2026-11-01T02:30:00.000Z', readingMinutes: 4, content: '<h2>Why PLCs</h2><p>Body text.</p><script>alert(1)</script>',
  seo: { title: 'PLC Basics | ACS Engitech', description: 'What a PLC does and how to size one.' },
};
const later = { ...post, id: 'p2', slug: 'later', title: 'Later post', publishedAt: '2999-01-01T00:00:00.000Z', status: 'scheduled' };

async function render(slug) {
  const original = store.getPublicData;
  store.getPublicData = async () => ({ posts: [post, later] });
  try {
    delete require.cache[require.resolve('../api/blog-post')];
    const res = fakeResponse();
    await require('../api/blog-post')({ query: { slug } }, res);
    return res;
  } finally {
    store.getPublicData = original;
  }
}

test('a live post renders as its own indexable page', async () => {
  const res = await render('plc-basics');
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<title>PLC Basics \| ACS Engitech<\/title>/);
  assert.match(res.body, /<link rel="canonical" href="https:\/\/www\.acsengitech\.com\/blog\/plc-basics">/);
  assert.match(res.body, /"@type":"BlogPosting"/);
  assert.match(res.body, /<meta property="og:type" content="article">/);
  assert.equal((res.body.match(/<h1[\s>]/g) || []).length, 1, 'only the post title is an h1');
  assert.match(res.body, /data-ssr="post"/);
  assert.doesNotMatch(res.body, /data-blog-hero/);
  assert.doesNotMatch(res.body, /<script>alert/);
  assert.doesNotMatch(res.body, /\ssrc="assets\//, 'asset paths are root-relative under /blog/<slug>');
  assert.doesNotMatch(res.body, /CollectionPage/, 'the blog index SEO block is replaced');
});

test('unknown and scheduled posts return 404', async () => {
  assert.equal((await render('nope')).statusCode, 404);
  assert.equal((await render('later')).statusCode, 404);
});
