const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Readable } = require('node:stream');

const ROOT = path.resolve(__dirname, '..');
const defaults = require('../lib/acs-defaults');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS, SITE_URL } = defaults;
const { buildSitemap, buildLlmsTxt } = require('../lib/admin-core');
const seoHead = require('../scripts/seo-head');
const markdownApi = require('../api/markdown');

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const loadMiddleware = () => import(`data:text/javascript;base64,${fs.readFileSync(path.join(ROOT, 'middleware.js')).toString('base64')}`);
const ldGraph = (html) => {
  const match = html.match(/<script type="application\/ld\+json" data-acs-jsonld="true">([\s\S]*?)<\/script>/);
  assert.ok(match, 'JSON-LD script missing');
  return JSON.parse(match[1])['@graph'];
};

function callMarkdown(query, method = 'GET') {
  return new Promise((resolve) => {
    const req = Object.assign(Readable.from([]), { method, query, headers: {} });
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(body) { resolve({ status: this.statusCode, headers: this.headers, body: body || '' }); } };
    markdownApi(req, res);
  });
}

// --- Markdown content negotiation -------------------------------------------------------------

test('middleware rewrites Markdown-preferring requests and lets HTML requests through', async () => {
  const { default: middleware, prefersMarkdown, config } = await loadMiddleware();
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html'), true);
  assert.equal(prefersMarkdown('text/html, text/markdown'), false);
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
  assert.equal(prefersMarkdown(undefined), false);

  const request = (url, accept) => ({ url, headers: { get: () => accept } });
  const rewrite = middleware(request('https://www.acsengitech.com/blog?post=plc-basics', 'text/markdown'));
  const target = new URL(rewrite.headers.get('x-middleware-rewrite'));
  assert.equal(target.pathname, '/api/markdown');
  assert.equal(target.searchParams.get('path'), '/blog');
  assert.equal(target.searchParams.get('post'), 'plc-basics');
  assert.equal(middleware(request('https://www.acsengitech.com/', 'text/html')), undefined);

  const matches = (pathname) => config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname));
  for (const pathname of ['/', '/about', '/contact.html', '/some-missing-page']) assert.ok(matches(pathname), pathname);
  for (const pathname of ['/api/public', '/assets/acs/og-image.jpg', '/llms.txt', '/sitemap.xml', '/robots.txt', '/admin/index.html']) assert.ok(!matches(pathname), pathname);
});

test('homepage Markdown: text/markdown body, Vary: Accept, canonical link', async () => {
  const res = await callMarkdown({ path: '/' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(res.headers.vary, 'Accept');
  assert.match(res.headers.link, /<https:\/\/www\.acsengitech\.com\/>; rel="canonical"/);
  assert.ok(res.body.startsWith('# Electrical Control Panel Manufacturer'));
  assert.match(res.body, /Canonical URL: https:\/\/www\.acsengitech\.com\//);
  assert.match(res.body, /Your plant keeps running/);
  assert.doesNotMatch(res.body, /<\/?(div|span|script|section)\b/);
});

test('every public page has a Markdown version; .html and clean URLs map to the same page', async () => {
  for (const page of PAGE_DEFAULTS) {
    const res = await callMarkdown({ path: page.path });
    assert.equal(res.status, 200, page.path);
    assert.ok(res.body.length > 500, `${page.path} Markdown too short`);
  }
  const html = await callMarkdown({ path: '/about.html' });
  assert.match(html.body, /^# About ACS Engitech/);
});

test('missing pages return a Markdown 404 that points agents to llms.txt and the sitemap', async () => {
  const res = await callMarkdown({ path: '/__ora-404-probe' });
  assert.equal(res.status, 404);
  assert.equal(res.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(res.headers.vary, 'Accept');
  assert.ok(res.body.length >= 20);
  assert.match(res.body, /https:\/\/www\.acsengitech\.com\/llms\.txt/);
  assert.match(res.body, /https:\/\/www\.acsengitech\.com\/sitemap\.xml/);
  const head = await callMarkdown({ path: '/' }, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal((await callMarkdown({ path: '/' }, 'POST')).status, 405);
});

test('HTML 404 page exists, is noindex and uses root-relative links', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.match(html, /href="\/llms\.txt"/);
  assert.doesNotMatch(html, /(?:href|src)="(?!https?:|\/|#|mailto:|tel:|data:)/);
});

// --- Static SEO head and JSON-LD -----------------------------------------------------------------

test('static SEO heads are generated and up to date for every public page', () => {
  assert.deepEqual(seoHead.run({ check: true }), []);
  for (const page of PAGE_DEFAULTS) {
    const html = read(page.file);
    const url = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`;
    assert.match(html, /<html lang="en"/, page.file);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${page.file} canonical`);
    assert.match(html, /<meta property="og:image" content="https:\/\/www\.acsengitech\.com\/assets\/acs\/og-image\.jpg">/, page.file);
    assert.match(html, /<meta property="og:type" content="website">/, page.file);
    assert.equal((html.match(/acs:seo:start/g) || []).length, 1, `${page.file} has one SEO block`);
    const graph = ldGraph(html);
    assert.equal(graph[0]['@type'] === 'WebPage' || ['AboutPage', 'ContactPage', 'CollectionPage', 'ImageGallery'].includes(graph[0]['@type']), true, page.file);
    assert.equal(graph[0].url, url);
    assert.ok(page.defaults.title.length <= 60, `${page.path} title length`);
    assert.ok(page.defaults.description.length <= 160, `${page.path} description length`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/acs/og-image.jpg')));
});

test('homepage Organization schema has contactPoint and PostalAddress', () => {
  const graph = ldGraph(read('index.html'));
  const org = graph.find((node) => node['@type'] === 'Organization');
  assert.ok(org, 'Organization missing');
  assert.equal(org.name, 'ACS Engitech');
  assert.ok(org.description.length > 50);
  assert.equal(org.url, `${SITE_URL}/`);
  assert.equal(org.address['@type'], 'PostalAddress');
  assert.equal(org.address.addressCountry, 'IN');
  const contact = org.contactPoint[0];
  assert.equal(contact['@type'], 'ContactPoint');
  assert.equal(contact.contactType, 'sales');
  assert.equal(contact.email, 'sales@acsengitech.com');
  assert.match(contact.telephone, /^\+91/);
  assert.ok(graph.some((node) => node['@type'] === 'WebSite'));
});

test('keyword pages target the agreed keywords', () => {
  const keywordsFor = (p) => PAGE_DEFAULTS.find((page) => page.path === p).defaults.keywords.toLowerCase();
  assert.match(keywordsFor('/panel-manufacturer'), /iec 61439 tta panel manufacturers in india/);
  assert.match(keywordsFor('/panel-manufacturer'), /schneider prisma set tta/);
  assert.match(keywordsFor('/panel-manufacturer'), /rittal ri4 power tta/);
  assert.match(keywordsFor('/mcc-panel-manufacturer'), /mcc panel manufacturer in india/);
  assert.match(keywordsFor('/imcc-panel-manufacturer'), /intelligent mcc panel manufacturer india/);
  assert.match(keywordsFor('/multi-effect-evaporator-plant-automation'), /mee plant automation panel manufacturer in india/);
  assert.match(keywordsFor('/machine-plant-automation'), /skin pass mill automation in india/);
  assert.match(keywordsFor('/centralized-automation'), /central operation cockpit manufacturer in india/);
  assert.match(keywordsFor('/trading'), /siemens plc supplier in india/);
});

// --- Trust pages, crawl files and routing ---------------------------------------------------------

test('privacy page has real content, schema and footer links', () => {
  const html = read('privacy.html');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(main.length > 500, `privacy content is ${main.length} characters`);
  assert.match(main, /sales@acsengitech\.com/);
  assert.ok(PAGE_DEFAULTS.some((page) => page.path === '/privacy'));
  for (const file of ['index.html', 'about.html', 'contact.html']) assert.match(read(file), /href="privacy\.html"/, file);
});

test('sitemap lists absolute www URLs only and ignores junk canonical overrides', () => {
  const pages = PAGE_DEFAULTS.map((page) => ({ ...page, seo: page.path === '/about' ? { canonical: '/about-us-page-gg' } : page.path === '/' ? { canonical: '/' } : {} }));
  const xml = buildSitemap({ pages, posts: [{ title: 'P', slug: 'p', status: 'published', publishedAt: '2026-01-01' }] }, new Date('2026-10-01'));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, PAGE_DEFAULTS.length + 1);
  for (const loc of locs) assert.match(loc, /^https:\/\/www\.acsengitech\.com\//);
  assert.ok(locs.includes('https://www.acsengitech.com/about'));
  assert.ok(locs.includes('https://www.acsengitech.com/privacy'));
  assert.ok(locs.includes('https://www.acsengitech.com/blog?post=p'));
});

test('llms.txt always carries when-to-use guidance, once', () => {
  const data = { pages: PAGE_DEFAULTS.map((page) => ({ ...page, seo: {} })), posts: [], positions: [] };
  const generated = buildLlmsTxt({ ...data, settings: DEFAULT_SETTINGS });
  assert.equal((generated.match(/^## When to use ACS Engitech$/gm) || []).length, 1);
  assert.match(generated, /How an agent should engage/);
  assert.match(generated, /Accept: text\/markdown/);
  const custom = buildLlmsTxt({ ...data, settings: { ...DEFAULT_SETTINGS, llmsIntro: '# ACS\n\n## When to use ACS\n- Panels' } });
  assert.equal((custom.match(/^## When to use/gm) || []).length, 1);
});

test('recommended robots.txt keeps the data feed crawlable and points to the www sitemap', () => {
  const robots = DEFAULT_SETTINGS.robotsTxt;
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/api\/public$/m);
  assert.match(robots, /^Disallow: \/admin$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Sitemap: https:\/\/www\.acsengitech\.com\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /^Disallow: \/$/m);
});

test('vercel.json negotiates on Accept, hides drafts from search and redirects duplicates', () => {
  const config = JSON.parse(read('vercel.json'));
  const rule = (source) => config.headers.find((h) => h.source === source);
  assert.deepEqual(rule('/((?!api/|assets/|admin/).*)').headers, [{ key: 'Vary', value: 'Accept' }]);
  assert.equal(rule('/(.*)-(design|signal)').headers[0].value, 'noindex, follow');
  assert.equal(rule('/(index-console|index-design|index-signal|header|footer)').headers[0].key, 'X-Robots-Tag');
  assert.deepEqual(config.redirects.map((r) => [r.source, r.destination, r.permanent]), [
    ['/process-automation-2', '/process-automation', true],
    ['/smart-data-logger-2', '/smart-data-logger', true],
  ]);
  assert.equal(config.functions['api/markdown.js'].includeFiles, '*.html');
  assert.ok(config.rewrites.some((r) => r.source === '/sitemap.xml'));
});

test('page SEO overrides saved before version 2 are not applied; new saves are', async () => {
  const values = { pageSeo: { '/about': { title: 'About Jaimin', canonical: '/about-us-page-gg' } } };
  const query = async (parts, ...args) => {
    const sql = parts.join('?');
    if (sql.startsWith('SELECT value FROM acs_admin_data')) return values[args[0]] === undefined ? [] : [{ value: values[args[0]] }];
    if (sql.startsWith('INSERT INTO acs_admin_data')) { values[args[0]] = JSON.parse(args[1]); return []; }
    return [];
  };
  const context = { module: { exports: {} }, process: { env: { NEON_DATABASE_URL: 'test' } }, require: (name) => (name === '@neondatabase/serverless' ? { neon: () => query } : defaults) };
  vm.runInNewContext(read('api/_store.js'), context);
  const store = context.module.exports;
  // Objects built inside the vm context have their own prototypes, so compare through JSON.
  const about = (data) => JSON.parse(JSON.stringify(data.pages.find((page) => page.path === '/about').seo));
  assert.deepEqual(about(await store.getPublicData()), {});
  await store.saveAll({ pageSeo: { '/about': { focusKeyword: 'siemens system integrator' } } });
  assert.equal(values.pageSeoVersion, store.PAGE_SEO_VERSION);
  assert.deepEqual(about(await store.getPublicData()), { focusKeyword: 'siemens system integrator' });
});
