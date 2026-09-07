const { test, expect } = require('@playwright/test');

// Regression test for: admin session was lost on every page refresh because
// state.email/state.password lived only in JS memory. Now a signed, short-lived
// session token is stored in sessionStorage and restored on load.
const MOCK = {
  pages: [{ path: '/', label: 'Home', defaults: { title: 'ACS Home' }, seo: {} }],
  posts: [{ id: 'p1', title: 'PLC basics', slug: 'plc-basics', status: 'published', publishedAt: '2026-01-01T00:00:00Z', tags: ['PLC'] }],
  positions: [],
  positionTypes: ['Full-time'],
  applications: [],
  partners: [],
  partnerCategories: [],
  settings: {},
  analytics: { pageViews: 1, uniqueVisitors: 1, avgViewsPerDay: 1, devices: {}, daily: [], topPages: [], topReferrers: [] },
  sessionToken: 'test-session-token',
  sessionExpiresAt: Date.now() + 12 * 60 * 60 * 1000,
};

async function mockApi(page) {
  await page.route('**/api/admin*', async (route) => route.fulfill({ json: MOCK }));
}

test('admin session survives a page refresh (no re-login, data still visible)', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin');
  await page.fill('#loginForm [name="email"]', 'a@b.com');
  await page.fill('#loginForm [name="password"]', 'pw');
  await page.click('#loginForm button[type="submit"]');

  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);
  await expect(page.locator('#overviewMetrics')).toContainText('SEO pages');

  await page.reload();

  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);
  await expect(page.locator('#overviewMetrics')).toContainText('SEO pages');
  await page.locator('[data-tab="blogs"]').click();
  await expect(page.locator('#postList')).toContainText('PLC basics');
});

test('signing out clears the session so a later refresh shows the login screen', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin');
  await page.fill('#loginForm [name="email"]', 'a@b.com');
  await page.fill('#loginForm [name="password"]', 'pw');
  await page.click('#loginForm button[type="submit"]');
  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);

  await page.locator('#logoutBtn').click();
  await expect(page.locator('body')).toHaveClass(/admin-locked/);

  await page.reload();
  await expect(page.locator('body')).toHaveClass(/admin-locked/);
});
