const { test, expect } = require('@playwright/test');

const HOOKS = ['#adminLogin','#loginForm','#adminMenuToggle','#adminSidebar','#statusBar',
  '#overview','#seo','#blogs','#positions','#applications','#partners','#analytics','#settings',
  '#seoForm','#postForm','#positionForm','#analyticsTagForm','#settingsForm','#dailyChart'];

test('all frozen hooks exist in built shell', async ({ page }) => {
  await page.goto('/admin');
  for (const sel of HOOKS) await expect(page.locator(sel)).toHaveCount(1);
  for (const tab of ['overview','seo','blogs','positions','applications','partners','analytics','settings'])
    await expect(page.locator(`[data-tab="${tab}"]`)).toHaveCount(1);
});

test('Alpine tab switch toggles the active panel', async ({ page }) => {
  await page.goto('/admin');
  await page.evaluate(() => document.body.classList.remove('admin-locked'));
  await page.locator('[data-tab="positions"]').click();
  await expect(page.locator('#positions')).toHaveClass(/active/);
  await expect(page.locator('#overview')).not.toHaveClass(/active/);
});

test('sidebar toggle applies is-open', async ({ page }) => {
  // The toggle only exists below the 1024px desktop breakpoint, so pin a mobile viewport.
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('/admin');
  await page.evaluate(() => document.body.classList.remove('admin-locked'));
  await page.locator('#adminMenuToggle').click();
  await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);
});
