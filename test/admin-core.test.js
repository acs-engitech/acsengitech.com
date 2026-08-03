const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePagePath,
  normalizePost,
  isPostVisible,
  mergeSeo,
  summarizeAnalytics,
} = require('../lib/admin-core');
const packageJson = require('../package.json');

test('package exposes local Vercel dev scripts', () => {
  assert.equal(packageJson.scripts.dev, 'node local-dev-server.js');
  assert.equal(packageJson.scripts['vercel:dev'], 'npx vercel dev');
});

test('normalizePagePath converts exported HTML names to public paths', () => {
  assert.equal(normalizePagePath('index.html'), '/');
  assert.equal(normalizePagePath('career.html'), '/career');
  assert.equal(normalizePagePath('/process-automation.html'), '/process-automation');
});

test('normalizePost derives slug, reading time, tags, and scheduled status', () => {
  const post = normalizePost({
    title: 'PLC Panel Maintenance Checklist',
    content: '<h2>Intro</h2><p>Use this checklist for safer panel work.</p>',
    tags: 'Automation, PLC, Automation',
    publishedAt: '2026-08-10T09:00:00.000Z',
  }, new Date('2026-08-03T00:00:00.000Z'));

  assert.equal(post.slug, 'plc-panel-maintenance-checklist');
  assert.equal(post.status, 'scheduled');
  assert.deepEqual(post.tags, ['Automation', 'PLC']);
  assert.equal(post.readingMinutes, 1);
  assert.match(post.excerpt, /safer panel work/);
});

test('isPostVisible only exposes published posts whose publish time has arrived', () => {
  assert.equal(isPostVisible({ status: 'draft' }, new Date('2026-08-03')), false);
  assert.equal(isPostVisible({ status: 'scheduled', publishedAt: '2026-08-10' }, new Date('2026-08-03')), false);
  assert.equal(isPostVisible({ status: 'published', publishedAt: '2026-08-01' }, new Date('2026-08-03')), true);
});

test('mergeSeo keeps page defaults when admin fields are blank', () => {
  const merged = mergeSeo(
    { title: 'Career - ACS', description: 'Join Our Team', canonical: '/career' },
    { title: 'Careers at ACS', description: '', robots: 'noindex, follow' }
  );

  assert.deepEqual(merged, {
    title: 'Careers at ACS',
    description: 'Join Our Team',
    canonical: '/career',
    robots: 'noindex, follow',
    keywords: '',
    ogTitle: 'Careers at ACS',
    ogDescription: 'Join Our Team',
    ogImage: '',
    twitterTitle: 'Careers at ACS',
    twitterDescription: 'Join Our Team',
    twitterImage: '',
    jsonLd: '',
  });
});

test('summarizeAnalytics groups page views, visitors, devices, pages, and referrers', () => {
  const summary = summarizeAnalytics([
    { path: '/', visitorId: 'a', referrer: 'https://google.com/search', device: 'desktop', createdAt: '2026-08-01T10:00:00Z' },
    { path: '/', visitorId: 'a', referrer: '', device: 'desktop', createdAt: '2026-08-01T11:00:00Z' },
    { path: '/career', visitorId: 'b', referrer: 'https://linkedin.com/', device: 'mobile', createdAt: '2026-08-02T10:00:00Z' },
  ], new Date('2026-08-03T00:00:00Z'), 30);

  assert.equal(summary.pageViews, 3);
  assert.equal(summary.uniqueVisitors, 2);
  assert.equal(summary.devices.desktop, 2);
  assert.equal(summary.devices.mobile, 1);
  assert.equal(summary.topPages[0].path, '/');
  assert.equal(summary.topReferrers[0].source, 'google.com');
});
