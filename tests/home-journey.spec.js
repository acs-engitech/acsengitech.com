const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route('**/widget/v1/bundle.js', route => route.fulfill({ body: '' }));
  await page.route('**/api/public?path=*', route => route.fulfill({ json: { settings: {}, pageSeo: {} } }));
  await page.route('**/api/public', route => route.fulfill({ json: { ok: true } }));
});

test('signal journey connects all five chapters and keeps ACS proof', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-journey-chapter]')).toHaveCount(6);
  await expect(page.locator('#system-journey')).toHaveAttribute('data-renderer', 'ready');
  for (const id of ['field', 'control', 'power', 'process', 'data']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await expect(page.locator('#system-journey')).toHaveAttribute('data-stage', id);
    await expect(page.locator(`.journey-map a[href="#${id}"]`)).toHaveAttribute('aria-current', 'step');
  }
  await expect(page.locator('#engineering-proof')).toContainText('2300');
  await expect(page.locator('#manufacturing')).toContainText('36,000');
  await expect(page.locator('#experience')).toContainText('7000+');
});

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`homepage fits and assets render at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    for (const id of ['field', 'control', 'power', 'process', 'data', 'engineering-proof', 'manufacturing', 'capabilities', 'contact']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    await page.waitForFunction(() => [...document.images].filter(image => image.getClientRects().length).every(image => image.complete));
    expect(await page.locator('img').evaluateAll(images => images.filter(i => i.getClientRects().length && !i.naturalWidth).map(i => i.src))).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('navigation works by keyboard and mobile menu closes with Escape', async ({ page }) => {
  await page.goto('/');
  const company = page.getByRole('button', { name: 'Company', exact: true });
  await company.focus();
  await page.keyboard.press('Enter');
  await expect(company).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(company).toHaveAttribute('aria-expanded', 'false');
  await expect(company).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.click();
  await expect(page.locator('#main-navigation')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#main-navigation')).toBeHidden();
  await expect(menu).toBeFocused();
});

test('reduced motion and failed 3D retain the whole journey', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#system-journey')).toHaveAttribute('data-renderer', 'static');
  await expect(page.locator('#data')).toContainText('LogView');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/vendor/three/**', r => r.abort());
  await page.reload();
  await expect(page.locator('#system-journey')).toHaveAttribute('data-renderer', 'fallback');
  await page.locator('#control').scrollIntoViewIfNeeded();
  await expect(page.locator('.scene-fallback')).toBeVisible();
  await expect(page.locator('#control')).toContainText('PLC / HMI / SCADA');
});

test('CMS SEO updates without replacing the homepage', async ({ page }) => {
  await page.route('**/api/public?path=*', r => r.fulfill({ json: { settings: {}, pageSeo: { '/': { title: 'ACS SEO integration test' } } } }));
  await page.goto('/');
  await expect(page).toHaveTitle('ACS SEO integration test');
  await expect(page.locator('[data-journey-chapter]')).toHaveCount(6);
});

test('assemblies render nonblank pixels and respond to inspection controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await expect(page.locator('#system-journey')).toHaveAttribute('data-renderer', 'ready');
  await page.waitForTimeout(1250);
  const canvas = page.locator('#scene-mount canvas');
  const before = await canvas.screenshot();
  const stats = await page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const target = document.createElement('canvas'); target.width = image.width; target.height = image.height;
    const ctx = target.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, target.width, target.height).data;
    let dark = 0, blue = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 180 && pixels[i + 1] < 180 && pixels[i + 2] < 180 && pixels[i + 3]) dark++;
      if (pixels[i + 2] > pixels[i] + 30 && pixels[i + 3]) blue++;
    }
    return { dark, blue };
  }, before.toString('base64'));
  expect(stats.dark).toBeGreaterThan(1500);
  expect(stats.blue).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Rotate assembly right' }).click();
  await page.waitForTimeout(150);
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
  await page.getByRole('button', { name: 'Reset assembly view' }).click();
  const box = await canvas.boundingBox();
  const reset = await canvas.screenshot();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  expect(Buffer.compare(reset, await canvas.screenshot())).not.toBe(0);
  await page.getByRole('button', { name: 'Signal termination' }).click();
  await expect(page.locator('#hotspot-description')).toBeVisible();
  await page.locator('#manufacturing').scrollIntoViewIfNeeded();
  const leak = await page.evaluate(() => {
    const point = document.querySelector('#manufacturing h2').getBoundingClientRect();
    return document.elementFromPoint(point.x + 5, Math.max(90, point.y + 5))?.closest('.scene-sticky') !== null;
  });
  expect(leak).toBe(false);
});

test('context loss reveals real ACS media', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#system-journey')).toHaveAttribute('data-renderer', 'ready');
  await page.locator('canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('#system-journey')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('.scene-fallback')).toHaveCSS('opacity', '1');
  await expect(page.locator('.scene-controls')).toBeHidden();
});

test('content and navigation remain usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(process.env.ACS_TEST_URL || 'http://localhost:3000');
  await expect(page.locator('#main-navigation')).toBeVisible();
  await expect(page.locator('[data-journey-chapter]')).toHaveCount(6);
  await page.locator('#data').scrollIntoViewIfNeeded();
  await expect(page.locator('#data')).toContainText('LogView');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await context.close();
});

test('short mobile screens use the readable static composition', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await expect(page.locator('#system-journey')).toHaveClass(/no-sticky/);
  await expect(page.locator('.scene-sticky')).toBeHidden();
  await expect(page.locator('.compact-opening')).toBeVisible();
  await expect(page.locator('#system-journey')).toHaveAttribute('data-renderer', 'static');
});

test('touch devices render 3D without trapping vertical scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.route('**/widget/v1/bundle.js', r => r.fulfill({ body: '' }));
  await page.route('**/api/public*', r => r.fulfill({ json: { settings: {} } }));
  await page.goto(process.env.ACS_TEST_URL || 'http://localhost:3000');
  await expect(page.locator('#system-journey')).toHaveAttribute('data-renderer', 'ready');
  await expect(page.locator('canvas')).toHaveCSS('touch-action', 'pan-y');
  await page.waitForTimeout(1200);
  const pixels = await page.locator('canvas').screenshot();
  const darkPixels = await page.evaluate(async data => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
    let count = 0;
    for (let i = 0; i < rgba.length; i += 4) if (rgba[i] < 180 && rgba[i + 1] < 180 && rgba[i + 2] < 180 && rgba[i + 3]) count++;
    return count;
  }, pixels.toString('base64'));
  expect(darkPixels).toBeGreaterThan(400);
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 210, y: 660 }] });
  for (const y of [625, 590, 550, 505, 450]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 210, y }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await context.close();
});
