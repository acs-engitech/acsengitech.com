const { test, expect } = require('@playwright/test');

const MOCK = {
  pages: [{ path: '/', label: 'Home', defaults: { title: 'ACS Home' }, seo: {} }],
  posts: [],
  jobs: [],
  positions: [
    { id: 'pos1', title: 'Automation Engineer', department: 'Automation', location: 'Ahmedabad', type: 'Full-time', tags: ['PLC'], status: 'live', responsibilities: [] },
    { id: 'pos2', title: 'Marketing Intern', department: 'Marketing', location: 'Remote', type: 'Internship', tags: [], status: 'closed', responsibilities: [] },
  ],
  positionTypes: ['Internship', 'Full-time', 'Part-time', 'Contract'],
  applications: [
    { id: 'a1', name: 'Asha Patel', email: 'asha@example.com', positionId: 'pos1', positionTitle: 'Automation Engineer', status: 'new', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'a2', name: 'Rohit Shah', email: 'rohit@example.com', positionId: 'pos1', positionTitle: 'Automation Engineer', status: 'shortlisted', createdAt: '2026-01-03T00:00:00Z' },
  ],
  partners: [
    { id: 'pt1', name: 'Vendor Co', email: 'vendor@example.com', category: 'Design & branding', status: 'new', createdAt: '2026-01-02T00:00:00Z', portfolioUrls: ['https://example.com'] },
  ],
  partnerCategories: ['Digital marketing & ads', 'Design & branding'],
  settings: { robotsTxt: 'User-agent: *', llmsIntro: 'ACS', gaMeasurementId: '', gtmContainerId: '' },
  analytics: { pageViews: 1, uniqueVisitors: 1, avgViewsPerDay: 1, devices: {}, daily: [], topPages: [], topReferrers: [] },
};

async function mockApi(page, onPost) {
  await page.route('**/api/admin*', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      onPost?.(body);
      return route.fulfill({ json: MOCK });
    }
    return route.fulfill({ json: MOCK });
  });
}

async function signIn(page) {
  await page.fill('#loginForm [name="email"]', 'a@b.com');
  await page.fill('#loginForm [name="password"]', 'pw');
  await page.click('#loginForm button[type="submit"]');
  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);
}

test('positions tab renders list and type dropdown', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin');
  await signIn(page);

  await page.locator('[data-tab="positions"]').click();
  await expect(page.locator('#positionList')).toContainText('Automation Engineer');
  await expect(page.locator('#positionList')).toContainText('Marketing Intern');

  const options = await page.locator('#positionTypeSelect option').allTextContents();
  expect(options).toEqual(expect.arrayContaining(['Internship', 'Full-time', 'Part-time', 'Contract']));
});

test('applications tab workflow filters and row status change POSTs an action', async ({ page }) => {
  let posted = null;
  await mockApi(page, (body) => { posted = body; });
  await page.goto('/admin');
  await signIn(page);

  await page.locator('[data-tab="applications"]').click();
  await expect(page.locator('#applicationList .dt-row')).toHaveCount(2);

  await page.locator('[data-app-filter="shortlisted"]').click();
  await expect(page.locator('#applicationList .dt-row')).toHaveCount(1);
  await expect(page.locator('#applicationList')).toContainText('Rohit Shah');

  await page.locator('[data-app-filter="all"]').click();
  await page.locator('[data-application-status="a1"]').selectOption('reviewed');
  await expect.poll(() => posted?.action).toBe('application.update');
  expect(posted.id).toBe('a1');
  expect(posted.patch.status).toBe('reviewed');
});

test('partners tab renders list and category filter', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin');
  await signIn(page);

  await page.locator('[data-tab="partners"]').click();
  await expect(page.locator('#partnerList')).toContainText('Vendor Co');
  const options = await page.locator('#partnerCategoryFilter option').allTextContents();
  expect(options).toEqual(expect.arrayContaining(['Design & branding']));
});
