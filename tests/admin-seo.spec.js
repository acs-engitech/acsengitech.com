const { test, expect } = require('@playwright/test');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS } = require('../lib/acs-defaults');

const MOCK = {
  pages: PAGE_DEFAULTS.map((page) => ({ ...page, seo: {} })),
  posts: [], jobs: [], positions: [], positionTypes: ['Full-time'], applications: [], partners: [], partnerCategories: [],
  settings: { ...DEFAULT_SETTINGS },
  analytics: { pageViews: 0, uniqueVisitors: 0, avgViewsPerDay: 0, devices: {}, daily: [], topPages: [], topReferrers: [] },
};

test('SEO tab saves only fields that differ from the page defaults, and reset clears them', async ({ page }) => {
  const posts = [];
  await page.route('**/api/admin*', (route) => {
    if (route.request().method() === 'POST') posts.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ json: MOCK });
  });
  await page.goto('/admin');
  await page.fill('#loginForm [name="email"]', 'acsengitech@gmail.com');
  await page.fill('#loginForm [name="password"]', 'x');
  await page.click('#loginForm button[type="submit"]');
  await page.locator('[data-tab="seo"]').click();
  await page.locator('#pageList [data-page="/about"]').click();
  await expect(page.locator('#seoForm [name="title"]')).toHaveValue(PAGE_DEFAULTS.find((p) => p.path === '/about').defaults.title);

  await page.fill('#seoForm [name="focusKeyword"]', 'siemens authorized system integrator in india');
  await page.click('#saveSeoBtn');
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].pageSeo['/about']).toEqual({ focusKeyword: 'siemens authorized system integrator in india' });

  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#resetSeoBtn');
  await expect(page.locator('#seoForm [name="focusKeyword"]')).toHaveValue('');
  await page.click('#saveSeoBtn');
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].pageSeo['/about']).toEqual({});
});
