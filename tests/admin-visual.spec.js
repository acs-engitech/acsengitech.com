const { test, expect } = require('@playwright/test');

test('primary action uses ACS brand color', async ({ page }) => {
  await page.goto('/admin');
  const color = await page.locator('#loginForm button[type="submit"]').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(color).toBe('rgb(0, 105, 171)'); // #0069AB, DESIGN.md primary
});

test('each tab renders a screenshot', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('#adminLogin')).toBeVisible();
  await page.screenshot({ path: 'visual-checks/admin-login.png' });
});
