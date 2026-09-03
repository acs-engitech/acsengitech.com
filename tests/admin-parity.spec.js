const { test, expect } = require('@playwright/test');

const MOCK = {
  pages: [{ path: '/', label: 'Home', defaults: { title: 'ACS Home' }, seo: {} }],
  posts: [{ id: 'p1', title: 'PLC basics', slug: 'plc-basics', status: 'published', publishedAt: '2026-01-01T00:00:00Z', tags: ['PLC'] }],
  jobs: [{ id: 'j1', title: 'Automation Engineer', department: 'Automation', location: 'Ahmedabad', status: 'open', responsibilities: [] }],
  settings: { robotsTxt: 'User-agent: *', llmsIntro: 'ACS', gaMeasurementId: '', gtmContainerId: '' },
  analytics: { pageViews: 10, uniqueVisitors: 5, avgViewsPerDay: 2, devices: { desktop: 6, mobile: 4 }, daily: [{ date: '2026-01-01', views: 3 }], topPages: [['/',10]].map(([path,views])=>({path,views})), topReferrers: [] },
};

async function mockApi(page, onPost) {
  await page.route('**/api/admin*', async (route) => {
    if (route.request().method() === 'POST') { onPost(JSON.parse(route.request().postData() || '{}')); return route.fulfill({ json: MOCK }); }
    return route.fulfill({ json: MOCK });
  });
}

test('login → all tabs render from data → save round-trips', async ({ page }) => {
  let posted = null;
  await mockApi(page, (body) => { posted = body; });
  await page.goto('/admin');
  await page.fill('#loginForm [name="email"]', 'a@b.com');
  await page.fill('#loginForm [name="password"]', 'pw');
  await page.click('#loginForm button[type="submit"]');

  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);
  await expect(page.locator('#overviewMetrics')).toContainText('SEO pages');
  await page.locator('[data-tab="blogs"]').click();
  await expect(page.locator('#postList')).toContainText('PLC basics');
  await page.locator('[data-tab="careers"]').click();
  await expect(page.locator('#jobList')).toContainText('Automation Engineer');
  await page.locator('[data-tab="analytics"]').click();
  await expect(page.locator('#analyticsMetrics')).toContainText('Page views');
  await expect(page.locator('#dailyChart .bar')).toHaveCount(1);

  await page.locator('[data-tab="seo"]').click();
  await page.click('#saveSeoBtn');
  await expect.poll(() => posted && Object.keys(posted)[0]).toBe('pageSeo');
  await expect(page.locator('#statusBar')).toContainText('SEO saved');
});
