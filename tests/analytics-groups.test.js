const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarizeAnalytics, summarizeAnalyticsGroups } = require('../lib/admin-core');

test('grouped analytics summary matches the raw-event summary', () => {
  const now = new Date();
  const day = (n) => new Date(now.getTime() - n * 86400000).toISOString();
  const events = [
    { path: '/', visitorId: 'a', referrer: 'https://www.google.com/search', device: 'desktop', createdAt: day(1) },
    { path: '/index.html', visitorId: 'a', referrer: '', device: 'desktop', createdAt: day(1) },
    { path: '/about', visitorId: 'b', referrer: 'https://google.com/', device: 'mobile', createdAt: day(2) },
    { path: 'about.html', visitorId: '', referrer: 'https://linkedin.com/feed', device: '', createdAt: day(3) },
  ];
  const group = (keyOf) => Object.entries(events.reduce((acc, e) => ({ ...acc, [keyOf(e)]: (acc[keyOf(e)] || 0) + 1 }), {})).map(([key, count]) => ({ key, count }));
  const groups = {
    views: events.length,
    visitors: new Set(events.map((e) => e.visitorId).filter(Boolean)).size,
    devices: group((e) => e.device),
    pages: group((e) => e.path),
    referrers: group((e) => e.referrer).filter((r) => r.key),
    daily: group((e) => e.createdAt.slice(0, 10)),
  };
  assert.deepEqual(summarizeAnalyticsGroups(groups, 30), summarizeAnalytics(events, now, 30));
});

test('a raw event array is still summarised', () => {
  assert.equal(summarizeAnalyticsGroups([], 30).pageViews, 0);
});
