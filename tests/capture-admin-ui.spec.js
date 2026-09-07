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
        positions: [
          { id: 'j1', title: 'Automation Engineer', department: 'Machine Automation', location: 'Ahmedabad, Gujarat', type: 'Full-time', tags: ['PLC', 'SCADA'], status: 'live', responsibilities: ['Program PLCs', 'Commission panels'], experience: '2-3 years', qualification: 'Diploma / B.E', vacancies: '5', gender: 'Any', hardSkills: 'TIA Portal, WinCC', softSkills: 'Communication', applyEmail: 'sales@acsengitech.com' },
          { id: 'j2', title: 'SCADA Developer', department: 'Software', location: 'Ahmedabad, Gujarat', type: 'Contract', tags: ['SCADA'], status: 'closed', responsibilities: [] },
        ],
        positionTypes: ['Internship', 'Full-time', 'Part-time', 'Contract'],
        applications: [
          { id: 'a1', name: 'Asha Patel', email: 'asha@example.com', phone: '9998887777', positionId: 'j1', positionTitle: 'Automation Engineer', yearsExperience: '2 years', status: 'new', message: 'Excited to join ACS Engitech.', resumeUrl: '/uploads/applications/asha-resume.pdf', resumeFilename: 'asha-resume.pdf', resumeSize: 87000, createdAt: '2026-08-10T09:00:00Z' },
          { id: 'a2', name: 'Rohit Shah', email: 'rohit@example.com', phone: '9998887778', positionId: 'j1', positionTitle: 'Automation Engineer', yearsExperience: '4 years', status: 'shortlisted', message: '', resumeUrl: '', createdAt: '2026-08-09T09:00:00Z' },
          { id: 'a3', name: 'Neha Joshi', email: 'neha@example.com', phone: '', positionId: 'j2', positionTitle: 'SCADA Developer', yearsExperience: '1 year', status: 'rejected', message: '', resumeUrl: '', createdAt: '2026-08-08T09:00:00Z' },
        ],
        partners: [
          { id: 'pt1', name: 'BrightAds Agency', email: 'hello@brightads.example', phone: '9990001111', category: 'Digital marketing & ads', city: 'Mumbai', entityType: 'Agency', yearsExperience: '6 years', portfolioUrls: ['https://brightads.example/work'], profileUrl: '/uploads/partners/brightads-profile.pdf', profileFilename: 'brightads-profile.pdf', profileSize: 240000, description: 'Performance marketing for industrial brands.', status: 'new', createdAt: '2026-08-10T10:00:00Z' },
          { id: 'pt2', name: 'PixelForge Studio', email: 'team@pixelforge.example', phone: '9990002222', category: 'Design & branding', city: 'Ahmedabad', entityType: 'Studio', yearsExperience: '3 years', portfolioUrls: [], profileUrl: '', description: 'Brand identity and print design.', status: 'reviewed', createdAt: '2026-08-09T10:00:00Z' },
        ],
        partnerCategories: ['Digital marketing & ads', 'Voice-over & audio', 'Video production', 'Content creation', 'Design & branding', 'Development', 'Consulting', 'Other'],
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

  await page.locator('[data-tab="positions"]').click();
  await page.screenshot({ path: path.join(outDir, '05-careers.png'), fullPage: true });

  await page.locator('[data-tab="analytics"]').click();
  await page.screenshot({ path: path.join(outDir, '06-analytics.png'), fullPage: true });

  await page.locator('[data-tab="settings"]').click();
  await page.screenshot({ path: path.join(outDir, '07-settings.png'), fullPage: true });

  await page.locator('[data-tab="positions"]').click();
  await page.screenshot({ path: path.join(outDir, '10-positions.png'), fullPage: true });

  await page.locator('[data-tab="applications"]').click();
  await page.screenshot({ path: path.join(outDir, '11-applications.png'), fullPage: true });

  await page.locator('[data-application-details="a1"]').click();
  await expect(page.locator('#applicationDrawer')).toHaveClass(/is-open/);
  await page.screenshot({ path: path.join(outDir, '13-application-details-drawer.png'), fullPage: true });
  await page.locator('#applicationDrawer [data-drawer-close]').first().click();

  await page.locator('[data-tab="partners"]').click();
  await page.screenshot({ path: path.join(outDir, '12-partners.png'), fullPage: true });

  await page.locator('[data-partner-details="pt1"]').click();
  await expect(page.locator('#partnerDrawer')).toHaveClass(/is-open/);
  await page.screenshot({ path: path.join(outDir, '14-partner-details-drawer.png'), fullPage: true });
});

async function mockPublicWithPositions(page) {
  await page.route('**/api/public*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        settings: {},
        pageSeo: {},
        posts: [],
        positions: [{ id: 'j1', title: 'Automation Engineer', department: 'Machine Automation', location: 'Ahmedabad, Gujarat', status: 'live' }],
        positionTypes: ['Full-time'],
        partnerCategories: ['Digital marketing & ads', 'Design & branding'],
        jobs: [{ id: 'j1', title: 'Automation Engineer', department: 'Machine Automation', location: 'Ahmedabad, Gujarat', status: 'open', responsibilities: [] }],
      }),
    });
  });
}

test('capture career page with apply form', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPublicWithPositions(page);
  await page.goto('/career.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: path.join(outDir, '15-career-page.png'), fullPage: true });
});

test('capture partner-with-us page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPublicWithPositions(page);
  await page.goto('/partner-with-us.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: path.join(outDir, '16-partner-with-us-page.png'), fullPage: true });
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
