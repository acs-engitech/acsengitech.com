const { test, expect } = require('@playwright/test');

const MOCK = {
  pages: [{ path: '/', label: 'Home', defaults: { title: 'ACS Home' }, seo: {} }],
  posts: [],
  positions: [],
  positionTypes: [],
  applications: [],
  partners: [],
  enquiries: [{
    id: 'e1', firstName: 'Ravi', lastName: 'Shah', name: 'Ravi Shah', email: 'ravi@example.com',
    subject: 'MCC panel quote', message: 'Need 3 MCC panels <b>IP54</b>.', status: 'new', createdAt: '2026-10-20T09:00:00Z',
  }],
  partnerCategories: [],
  settings: {},
  analytics: {},
};

test('contact form enquiries are listed, viewable and updatable in the admin', async ({ page }) => {
  const posts = [];
  await page.route('**/api/admin*', async (route) => {
    if (route.request().method() === 'POST') posts.push(route.request().postDataJSON());
    await route.fulfill({ json: MOCK });
  });
  await page.goto('/admin');
  await page.fill('#loginForm [name="email"]', 'a@b.com');
  await page.fill('#loginForm [name="password"]', 'pw');
  await page.click('#loginForm button[type="submit"]');
  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);
  await expect(page.locator('#overviewMetrics')).toContainText('New enquiries');

  await page.locator('[data-tab="enquiries"]').click();
  const row = page.locator('[data-enquiry-row="e1"]');
  await expect(row).toContainText('Ravi Shah');
  await expect(row).toContainText('MCC panel quote');
  await expect(row.locator('a', { hasText: 'Reply' })).toHaveAttribute('href', /^mailto:ravi@example\.com\?subject=Re%3A%20MCC%20panel%20quote$/);

  await page.locator('[data-enquiry-details="e1"]').click();
  await expect(page.locator('#enquiryDrawer')).toHaveClass(/is-open/);
  // Messages are shown as text, never as HTML.
  await expect(page.locator('#enquiryDrawerBody')).toContainText('Need 3 MCC panels <b>IP54</b>.');
  await page.locator('#enquiryDrawer .drawer-close').click();

  await page.locator('[data-enquiry-status="e1"]').selectOption('replied');
  await expect.poll(() => posts).toContainEqual({ action: 'enquiry.update', id: 'e1', patch: { status: 'replied' } });

  await page.fill('#enquirySearch', 'nobody');
  await expect(page.locator('#enquiryList')).toContainText('No enquiries match this view.');
});
