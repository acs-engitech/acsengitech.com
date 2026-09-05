const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', 'visual-checks', 'admin-ui-rebuild');

test.beforeAll(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

// Minimal inline fixture, mirrors mockAdminApi in mobile-visual.spec.js.
async function mockAdminApi(page) {
  await page.route('**/api/admin?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        pages: [
          { path: '/', label: 'Home', file: 'index.html', defaults: { title: 'ACS Engitech' }, seo: {} },
          { path: '/blog', label: 'Blog', file: 'blog.html', defaults: { title: 'ACS Blog' }, seo: {} },
        ],
        posts: [
          { id: 'p1', title: 'PLC panel design basics', slug: 'plc-panel-design-basics', status: 'published', publishedAt: '2026-08-01T00:00:00Z', tags: ['PLC', 'Panels'], author: 'ACS Engitech' },
          { id: 'p2', title: 'Scheduled SCADA upgrade notes', slug: 'scada-upgrade-notes', status: 'scheduled', publishedAt: '2026-12-01T00:00:00Z', tags: ['SCADA'], author: 'ACS Engitech' },
          { id: 'p3', title: 'Draft: energy monitoring guide', slug: 'energy-monitoring-guide', status: 'draft', publishedAt: '2026-08-01T00:00:00Z', tags: [], author: 'ACS Engitech' },
        ],
        jobs: [
          { id: 'j1', title: 'Automation Engineer', department: 'Machine Automation', location: 'Ahmedabad, Gujarat', status: 'open', responsibilities: [] },
          { id: 'j2', title: 'SCADA Developer', department: 'Software', location: 'Ahmedabad, Gujarat', status: 'paused', responsibilities: [] },
        ],
        settings: { gaMeasurementId: 'G-ACS2026', gtmContainerId: 'GTM-ACS26', robotsTxt: 'User-agent: *\nAllow: /', llmsIntro: '# ACS Engitech' },
        analytics: {
          pageViews: 420,
          uniqueVisitors: 180,
          avgViewsPerDay: 14,
          devices: { desktop: 300, mobile: 120 },
          topPages: [{ path: '/', views: 200 }, { path: '/career', views: 80 }],
          topReferrers: [{ source: 'google.com', views: 90 }],
          daily: [
            { date: '2026-08-01', views: 8 }, { date: '2026-08-02', views: 14 }, { date: '2026-08-03', views: 20 },
            { date: '2026-08-04', views: 6 }, { date: '2026-08-05', views: 18 },
          ],
        },
      }),
    });
  });
  await page.route('**/api/admin', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

async function signInAdmin(page) {
  await page.locator('#loginForm input[name="email"]').fill('acs.mmo@gmail.com');
  await page.locator('#loginForm input[name="password"]').fill('acsmmo@2026#');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('body')).not.toHaveClass(/admin-locked/);
}

test('capture desktop admin UI screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockAdminApi(page);
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#adminLogin')).toBeVisible();
  await page.screenshot({ path: path.join(outDir, '01-login.png'), fullPage: true });

  await signInAdmin(page);

  await page.screenshot({ path: path.join(outDir, '02-overview.png'), fullPage: true });

  await page.locator('[data-tab="seo"]').click();
  await page.screenshot({ path: path.join(outDir, '03-seo.png'), fullPage: true });

  await page.locator('[data-tab="blogs"]').click();
  await page.screenshot({ path: path.join(outDir, '04-blogs.png'), fullPage: true });

  await page.locator('[data-tab="careers"]').click();
  await page.screenshot({ path: path.join(outDir, '05-careers.png'), fullPage: true });

  await page.locator('[data-tab="analytics"]').click();
  await page.screenshot({ path: path.join(outDir, '06-analytics.png'), fullPage: true });

  await page.locator('[data-tab="settings"]').click();
  await page.screenshot({ path: path.join(outDir, '07-settings.png'), fullPage: true });
});

test('capture mobile admin UI screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await mockAdminApi(page);
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await signInAdmin(page);

  await page.locator('#adminMenuToggle').click();
  await page.screenshot({ path: path.join(outDir, '08-mobile-sidebar.png'), fullPage: true });

  await page.locator('#adminMenuToggle').click();
  await page.screenshot({ path: path.join(outDir, '09-mobile-overview.png'), fullPage: true });
});
