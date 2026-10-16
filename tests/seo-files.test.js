const { test } = require('node:test');
const assert = require('node:assert');
const { Readable } = require('node:stream');
const { buildSitemap, buildLlmsTxt, isPostVisible } = require('../lib/admin-core');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS } = require('../lib/acs-defaults');

const NOW = new Date('2026-10-16T12:00:00Z');
const pages = PAGE_DEFAULTS.map((page) => ({ ...page, seo: {} }));
const posts = [
  { title: 'Live', slug: 'live', status: 'published', publishedAt: '2026-10-01T00:00:00Z' },
  { title: 'Due', slug: 'due', status: 'scheduled', publishedAt: '2026-10-15T00:00:00Z' },
  { title: 'Later', slug: 'later', status: 'scheduled', publishedAt: '2026-11-01T00:00:00Z' },
  { title: 'Draft', slug: 'draft', status: 'draft', publishedAt: '2026-10-01T00:00:00Z' },
];

test('scheduled posts go live at their publish time; drafts never do', () => {
  assert.deepStrictEqual(posts.map((post) => isPostVisible(post, NOW)), [true, true, false, false]);
});

test('sitemap lists indexable pages and live posts only', () => {
  const hidden = pages.map((page, i) => (i === 1 ? { ...page, seo: { robots: 'noindex, follow' } } : i === 2 ? { ...page, seo: { sitemapExclude: 'yes' } } : page));
  const xml = buildSitemap({ pages: hidden, posts }, NOW);
  assert.match(xml, /^<\?xml/);
  assert.strictEqual((xml.match(/<url>/g) || []).length, pages.length - 2 + 2);
  assert.match(xml, /post=due/);
  assert.doesNotMatch(xml, /post=later|post=draft/);
  assert.doesNotMatch(xml, new RegExp(`<loc>${pages[1].defaults.canonical}</loc>`));
});

test('llms.txt uses the edited body and the chosen generated sections', () => {
  const settings = { ...DEFAULT_SETTINGS, llmsIntro: '# ACS test body', llmsIncludePages: false, llmsFooter: 'Closing note.' };
  const text = buildLlmsTxt({ settings, pages, posts, positions: [{ title: 'Automation Engineer', status: 'live' }, { title: 'Closed', status: 'closed' }] }, NOW);
  assert.ok(text.startsWith('# ACS test body'));
  assert.doesNotMatch(text, /## Pages/);
  assert.match(text, /\[Due\]/);
  assert.doesNotMatch(text, /\[Later\]/);
  assert.match(text, /Automation Engineer/);
  assert.doesNotMatch(text, /Closed/);
  assert.match(text, /Closing note\.\n$/);
});

test('default admin login is acsengitech@gmail.com', async () => {
  for (const key of ['ACS_ADMIN_EMAIL', 'ACS_ADMIN_PASSWORD_HASH', 'ACS_ADMIN_PASSWORD', 'ACS_ADMIN_SESSION_SECRET']) delete process.env[key];
  const store = require('../api/_store');
  store.getAll = async () => ({ pages: [], posts: [], positions: [], applications: [], partners: [], settings: {} });
  store.getAnalytics = async () => [];
  const handler = require('../api/admin');
  const call = async (email, password) => {
    const req = Readable.from([Buffer.from('')]);
    Object.assign(req, { method: 'GET', query: {}, headers: { 'x-admin-email': email, 'x-admin-password': password } });
    const res = { statusCode: 200, setHeader() {}, end(body) { this.body = body; } };
    await handler(req, res);
    return res.statusCode;
  };
  assert.strictEqual(await call('acsengitech@gmail.com', 'ACSEngitech@2026#'), 200);
  assert.strictEqual(await call('acsengitech@gmail.com', 'wrong'), 401);
  assert.strictEqual(await call('acs.mmo@gmail.com', 'ACSEngitech@2026#'), 401);
});
