const { test, expect } = require('@playwright/test');
test.beforeEach(async({page})=>page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''})));

for (const width of [390, 1440, 1920]) {
  test(`homepage content and both slides fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.swiper-initialized')).toBeVisible();
    await page.getByRole('button', { name: 'Pause slideshow' }).click();
    await expect(page.locator('main section')).toHaveCount(9);
    await expect(page.locator('h1')).toContainText('Electrical automation');
    await expect(page.locator('.acs-bp-hero')).toHaveCount(0);
    for (let slide = 0; slide < 2; slide++) {
      const active = page.locator('.swiper-slide-active');
      await expect(active.locator('.acs-project-badge')).toBeVisible();
      const title = await active.locator('.rs-banner-title').boundingBox();
      const info = await active.locator('.rs-banner-info').boundingBox();
      expect(title.x + title.width).toBeLessThanOrEqual(width);
      expect(title.y + title.height).toBeLessThanOrEqual(info.y + 1);
      await page.getByRole('button', { name: 'Next slide' }).click();
      await page.waitForTimeout(750);
    }
    for (const section of await page.locator('main section').all()) {
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
    }
    await expect.poll(() => page.evaluate(() => [...document.images].every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      broken: [...document.images].filter(img => !img.complete || !img.naturalWidth).map(img => img.src),
    }));
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.broken).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('mobile navigation and about tabs work with keyboard and touch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Services submenu', exact: true }).click();
  await expect(page.locator('#acs-navigation').getByRole('link', { name: 'Smart Data Logger' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('tab', { name: 'Our Standards' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Our Standards' })).toContainText('ISO 9001:2015');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tabpanel', { name: 'Our Capability' })).toContainText('IEC 61439');
});

test('homepage keeps its content without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL);
  await expect(page.locator('main section')).toHaveCount(9);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.acs-services')).toContainText('Boiler Automation');
  await expect(page.locator('.acs-stats-bar')).toContainText('7000+');
  await context.close();
});

test('delayed admin SEO updates metadata without rebuilding the homepage', async ({ page }) => {
  await page.route('**/api/public?path=*', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ json: { pageSeo: { '/': { title: 'ACS SEO integration test' } }, settings: {} } });
  });
  await page.goto('/');
  await expect(page).toHaveTitle('ACS SEO integration test');
  await expect(page.locator('main section')).toHaveCount(9);
  await expect(page.locator('.rs-banner-six')).toBeVisible();
  await expect(page.locator('.acs-bp-hero')).toHaveCount(0);
});

test('admin uses the current server and restores its session after a slow response', async ({ page }) => {
  let requestedOrigin;
  await page.addInitScript(() => sessionStorage.setItem('acsAdminSession', JSON.stringify({
    email: 'preview@example.test', token: 'mock-session', expiresAt: Date.now() + 60000,
  })));
  await page.route('**/api/admin?days=*', async route => {
    requestedOrigin = new URL(route.request().url()).origin;
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ json: { pages: [], posts: [], positions: [], applications: [], partners: [], settings: {}, analytics: {} } });
  });
  await page.goto('/admin');
  await expect(page.locator('#statusBar')).toContainText('All changes are loaded.');
  expect(requestedOrigin).toBe(new URL(page.url()).origin);
  await expect(page.locator('body')).not.toHaveClass(/admin-locked|admin-busy/);
  await page.reload();
  await expect(page.locator('#statusBar')).toContainText('All changes are loaded.');
  await expect(page.locator('body')).not.toHaveClass(/admin-locked|admin-busy/);
});
