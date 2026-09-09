const { test, expect } = require('@playwright/test');

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(overflow.docScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.innerWidth + 2);
  expect(overflow.bodyScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.innerWidth + 2);
}

test('homepage hero is ACS industrial proof, not schematic art', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  await expect(page.locator('.acs-bp-hero')).toBeVisible();
  await expect(page.locator('.acs-bp-title')).toContainText('Electrical automation built for real industrial plants.');
  await expect(page.locator('.acs-bp-main-photo img')).toHaveAttribute('src', /control-panels\.jpg/);
  await expect(page.locator('.acs-bp-secondary-photo img')).toHaveAttribute('src', /machine-automation\.jpg/);
  await expect(page.locator('.acs-bp-figure svg')).toHaveCount(0);
  await expect(page.locator('.acs-bp-readout')).toContainText('7000+');
  await expectNoHorizontalOverflow(page);
});

test('homepage hero keeps ACS panel imagery in the first mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const imageBox = await page.locator('.acs-bp-main-photo').boundingBox();
  expect(imageBox.y).toBeLessThan(980);
  await expectNoHorizontalOverflow(page);
});
