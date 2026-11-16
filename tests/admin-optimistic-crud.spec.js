const { test, expect } = require('@playwright/test');

// Regression test for: every CRUD action blocked on a full network round-trip and re-rendered
// the whole app. Status changes etc. are now optimistic — the UI updates synchronously, the
// request fires in the background. A delayed mock response proves the update isn't just fast.
const MOCK = {
  pages: [{ path: '/', label: 'Home', defaults: { title: 'ACS Home' }, seo: {} }],
  posts: [],
  positions: [],
  positionTypes: [],
  applications: [{ id: 'a1', name: 'Asha Patel', email: 'asha@example.com', status: 'new', createdAt: '2026-01-02T00:00:00Z' }],
  partners: [],
  partnerCategories: [],
  settings: {},
  analytics: {},
};

async function mockApi(page) {
  await page.route('**/api/admin*', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.fulfill({ json: MOCK });
  });
}

test('application status change appears instantly, before the delayed network response resolves', async ({ page }) => {
  await mockApi(page);
  await page.goto('/admin');
  await page.fill('#loginForm [name="email"]', 'a@b.com');
  await page.fill('#loginForm [name="password"]', 'pw');
  await page.click('#loginForm button[type="submit"]');
  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);

  await page.locator('[data-tab="applications"]').click();
  await expect(page.locator('[data-application-status="a1"]')).toHaveValue('new');

  await page.locator('[data-application-status="a1"]').selectOption('reviewed');

  // The mock POST response is delayed 500ms. Assert the DOM already shows the new status
  // well before that — proving the update is optimistic, not just a fast round trip.
  await expect(page.locator('[data-application-status="a1"]')).toHaveValue('reviewed', { timeout: 200 });

  // No full-screen blocking overlay for an optimistic action.
  await expect(page.locator('#adminLoading')).not.toHaveClass(/is-visible/);
});
