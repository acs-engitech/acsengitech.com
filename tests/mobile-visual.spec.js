const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.join(__dirname, '..', 'visual-checks');

test.beforeAll(() => {
  fs.mkdirSync(outputDir, { recursive: true });
});

async function mockAdminApi(page, options = {}) {
  await page.route('**/api/admin?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        pages: [
          { path: '/', label: 'Home', file: 'index.html', defaults: { title: 'ACS Engitech' }, seo: {} },
          { path: '/blog', label: 'Blog', file: 'blog.html', defaults: { title: 'ACS Blog' }, seo: {} },
        ],
        posts: [],
        jobs: [
          { id: 'automation-engineer', title: 'Automation Engineer', department: 'Machine Automation', location: 'Kuha, Ahmedabad', status: 'open' },
        ],
        settings: { gaMeasurementId: 'G-ACS2026', gtmContainerId: 'GTM-ACS26', robotsTxt: 'User-agent: *\nAllow: /', llmsIntro: '# ACS Engitech' },
        analytics: {
          pageViews: 42,
          uniqueVisitors: 18,
          avgViewsPerDay: 6,
          devices: { desktop: 30, mobile: 12 },
          topPages: [{ path: '/', views: 20 }, { path: '/career', views: 8 }],
          topReferrers: [{ source: 'google.com', views: 9 }],
          daily: [{ date: '2026-08-01', views: 8 }, { date: '2026-08-02', views: 14 }, { date: '2026-08-03', views: 20 }],
        },
      }),
    });
  });
  await page.route('**/api/admin', async (route) => {
    if (options.delayPost && route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

async function mockPublicContent(page) {
  await page.route('**/api/public?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        settings: {},
        pageSeo: {},
        posts: [{
          id: 'test-post',
          title: 'Testing PLC Panel Blog',
          slug: 'testing-plc-panel-blog',
          excerpt: 'A short ACS test article for panel automation.',
          author: 'ACS Engitech',
          tags: ['PLC', 'SCADA', 'Panels'],
          content: '<p>Useful automation note from ACS Engitech.</p>',
          status: 'published',
          publishedAt: '2026-08-03T09:00:00.000Z',
          readingMinutes: 1,
        }],
        jobs: [{
          id: 'testing-role',
          title: 'Testing Automation Role',
          department: 'Automation',
          location: 'Ahmedabad, Gujarat',
          status: 'open',
        }],
      }),
    });
  });
}

async function signInAdmin(page) {
  await expect(page.locator('#loginForm input[name="email"]')).toHaveValue('');
  await expect(page.locator('#loginForm input[name="password"]')).toHaveValue('');
  await page.locator('#loginForm input[name="email"]').fill('acs.mmo@gmail.com');
  await page.locator('#loginForm input[name="password"]').fill('acsmmo@2026#');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);
}

async function mockDelayedAdminApi(page) {
  await page.route('**/api/admin?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ pages: [], posts: [], jobs: [], settings: {}, analytics: {} }),
    });
  });
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(overflow.docScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.innerWidth + 2);
  expect(overflow.bodyScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.innerWidth + 2);
}

test('home mobile header menu and footer stay inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'home-mobile-closed.png'), fullPage: false });

  await page.locator('.hfe-nav-menu__toggle').first().click();
  await page.waitForTimeout(300);
  await expectNoHorizontalOverflow(page);

  const menuBox = await page.locator('nav.hfe-nav-menu__layout-horizontal, nav.hfe-dropdown, nav.hfe-dropdown-expandible').first().boundingBox();
  expect(menuBox.x).toBeGreaterThanOrEqual(-2);
  expect(menuBox.width).toBeLessThanOrEqual(432);
  expect(menuBox.height).toBeGreaterThan(300);
  expect(menuBox.height).toBeLessThan(620);
  const visibleMenuGap = await page.locator('nav.hfe-nav-menu__layout-horizontal, nav.hfe-dropdown, nav.hfe-dropdown-expandible').first().evaluate((node) => {
    const navBottom = node.getBoundingClientRect().bottom;
    const visibleItems = Array.from(node.querySelectorAll(':scope > ul > li')).filter((item) => {
      const style = window.getComputedStyle(item);
      return style.display !== 'none' && style.visibility !== 'hidden' && item.getBoundingClientRect().height > 0;
    });
    const itemBottom = Math.max(...visibleItems.map((item) => item.getBoundingClientRect().bottom));
    return Math.round(navBottom - itemBottom);
  });
  expect(visibleMenuGap).toBeLessThanOrEqual(12);
  await page.screenshot({ path: path.join(outputDir, 'home-mobile-menu-open.png'), fullPage: false });

  await page.locator('.hfe-nav-menu__toggle').first().click();
  await page.waitForTimeout(200);
  await page.locator('footer#colophon').scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'home-mobile-footer.png'), fullPage: false });
});

test('about mobile header menu stays inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/about.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('.hfe-nav-menu__toggle').first().click();
  await page.waitForTimeout(300);

  await expectNoHorizontalOverflow(page);
  const menuBox = await page.locator('nav.hfe-nav-menu__layout-horizontal, nav.hfe-dropdown, nav.hfe-dropdown-expandible').first().boundingBox();
  expect(menuBox.height).toBeGreaterThan(300);
  expect(menuBox.height).toBeLessThan(620);
  await page.screenshot({ path: path.join(outputDir, 'about-mobile-menu-open.png'), fullPage: false });
});

test('blog uses ACS shared header and footer', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/blog.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  await expect(page.locator('header#masthead')).toBeVisible();
  await expect(page.locator('footer#colophon')).toBeVisible();
  await expect(page.locator('header#masthead a.hfe-menu-item', { hasText: 'Blog' })).toBeVisible();
  await expect(page.locator('text=Blog posts are loading. Please refresh in a moment.')).toHaveCount(0);
  const footerLinkColor = await page.locator('footer#colophon a').first().evaluate((node) => window.getComputedStyle(node).color);
  expect(footerLinkColor).toBe('rgb(255, 255, 255)');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'blog-desktop.png'), fullPage: false });
});

test('published blog content renders as an ACS client page', async ({ page }) => {
  await mockPublicContent(page);
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/blog.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  await expect(page.locator('.acs-blog-hero')).toBeVisible();
  await expect(page.locator('.acs-blog-card')).toHaveCount(1);
  await expect(page.locator('.acs-blog-card h2')).toHaveText('Testing PLC Panel Blog');
  const titleBox = await page.locator('.acs-blog-index h1').boundingBox();
  expect(titleBox.height).toBeLessThan(90);
  await expect(page.locator('.acs-blog-card > a')).toHaveCSS('background-color', 'rgb(28, 58, 98)');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'blog-with-post.png'), fullPage: false });
});

test('published blog article renders inside ACS article shell', async ({ page }) => {
  await mockPublicContent(page);
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/blog.html?post=testing-plc-panel-blog', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  await expect(page.locator('.acs-blog-article-hero')).toBeVisible();
  await expect(page.locator('.acs-blog-article h1')).toHaveText('Testing PLC Panel Blog');
  await expect(page.locator('.acs-blog-content-card')).toBeVisible();
  await expect(page.locator('.acs-blog-content-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('header#masthead')).toBeVisible();
  await expect(page.locator('footer#colophon')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'blog-article.png'), fullPage: false });
});

test('career page renders existing role layout dynamically without duplicate placeholder', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/career.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  await expect(page.locator('#acs-career-board')).toHaveCount(0);
  await expect(page.locator('.acs-career-existing-board')).toHaveCount(1);
  await expect(page.locator('.acs-career-role h2', { hasText: 'Automation Engineer' })).toBeVisible();
  await expect(page.locator('.acs-career-role h2', { hasText: 'Field Sales Engineer' })).toBeVisible();
  await expect(page.locator('text=Loading current openings...')).toHaveCount(0);
  await page.locator('.acs-career-role').first().scrollIntoViewIfNeeded();
  await expect(page.locator('.acs-career-meta span')).toHaveCount(8);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'career-dynamic.png'), fullPage: false });
});

test('sparse career admin content still renders cleanly on client page', async ({ page }) => {
  await mockPublicContent(page);
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/career.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  await expect(page.locator('.acs-career-role h2')).toHaveText('Testing Automation Role');
  await expect(page.locator('.acs-career-meta span')).toHaveCount(4);
  await expect(page.locator('.acs-career-list li')).toHaveCount(1);
  await expect(page.locator('.acs-career-role').first()).toHaveCSS('border-radius', '8px');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'career-sparse-role.png'), fullPage: false });
});

test('admin sign in panel starts blank and blocks board', async ({ page }) => {
  await mockAdminApi(page);
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body')).toHaveClass(/admin-locked/);
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page.locator('#loginForm input[name="email"]')).toHaveValue('');
  await expect(page.locator('#loginForm input[name="password"]')).toHaveValue('');
  await expect(page.locator('.admin-shell')).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'admin-sign-in.png'), fullPage: false });
});

test('admin sign in shows loading after submit', async ({ page }) => {
  await mockDelayedAdminApi(page);
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#loginForm input[name="email"]').fill('acs.mmo@gmail.com');
  await page.locator('#loginForm input[name="password"]').fill('acsmmo@2026#');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#loginForm button[type="submit"]')).toBeDisabled();
  await expect(page.locator('#loginForm button[type="submit"]')).toHaveText('Signing in...');
});

test('admin save shows spinner while creating a blog post', async ({ page }) => {
  await mockAdminApi(page, { delayPost: true });
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
  await signInAdmin(page);
  await page.locator('.admin-nav button[data-tab="blogs"]').click();
  await page.locator('#newPostBtn').click();
  await page.locator('#postForm button[type="submit"]').click();
  await expect(page.locator('#adminLoading')).toBeVisible();
  await expect(page.locator('#adminLoading strong')).toHaveText('Saving changes...');
});

test('admin SEO list displays clean paths without html extensions', async ({ page }) => {
  await mockAdminApi(page);
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
  await signInAdmin(page);
  await page.locator('.admin-nav button[data-tab="seo"]').click();
  await expect(page.locator('#pageList')).not.toContainText('.html');
});

test('admin tabs feel like ACS module navigation on desktop and mobile', async ({ page }) => {
  await mockAdminApi(page);
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await signInAdmin(page);

  await expect(page.locator('.admin-nav .nav-title')).toBeVisible();
  await expect(page.locator('.admin-nav button[data-tab="seo"] small')).toHaveText('All page metadata');
  await page.locator('.admin-nav button[data-tab="blogs"]').click();
  await expect(page.locator('.admin-nav button[data-tab="blogs"]')).toHaveClass(/active/);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'admin-tabs-desktop.png'), fullPage: false });

  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.locator('.admin-nav .nav-title')).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outputDir, 'admin-tabs-mobile.png'), fullPage: false });
});

test('admin analytics owns GA and GTM tags with working chart', async ({ page }) => {
  await mockAdminApi(page);
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await signInAdmin(page);

  await page.locator('.admin-nav button[data-tab="analytics"]').click();
  await expect(page.locator('#analyticsTagForm input[name="gaMeasurementId"]')).toHaveValue('G-ACS2026');
  await expect(page.locator('#analyticsTagForm input[name="gtmContainerId"]')).toHaveValue('GTM-ACS26');
  await expect(page.locator('#dailyChart .bar')).toHaveCount(3);
  await expect(page.locator('#topPages .data-row')).toHaveCount(2);
  await page.screenshot({ path: path.join(outputDir, 'admin-analytics-panel.png'), fullPage: false });

  await page.locator('.admin-nav button[data-tab="settings"]').click();
  await expect(page.locator('#settingsForm input[name="gaMeasurementId"]')).toHaveCount(0);
  await expect(page.locator('#settingsForm input[name="gtmContainerId"]')).toHaveCount(0);
  await expect(page.locator('#settingsForm textarea[name="robotsTxt"]')).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, 'admin-robots-without-tags.png'), fullPage: false });
});
