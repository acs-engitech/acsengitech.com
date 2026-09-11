const {test,expect}=require('@playwright/test');
const home=process.env.ACS_DESIGN_STAGED?'/index-design.html':'/';
test.beforeEach(async({page})=>page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''})));

for(const width of [390,1440,1920])test(`editorial homepage preserves engineering proof and fits at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(home);
 await expect(page.locator('h1')).toHaveCount(1);
 await expect(page.locator('h1')).toContainText('Industrial');
 await expect(page.locator('.ed-proof')).toContainText('2300');
 await expect(page.locator('.ed-manufacturing')).toContainText('36,000');
 await expect(page.locator('.ed-delivery')).toContainText('Manufacturing & Commissioning');
 await expect(page.locator('.ed-scale-rail')).toContainText('7000+');
 await expect(page.locator('.ed-capability-row')).toHaveCount(6);
 const heading=await page.locator('h1').boundingBox();expect(heading.x+heading.width).toBeLessThanOrEqual(width);
 for(const section of await page.locator('main>section').all())await section.scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 expect(errors).toEqual([]);
});

test('capability imagery and company tabs work with keyboard',async({page})=>{
 await page.goto(home);
 const row=page.locator('.ed-capability-row').nth(2);await row.focus();
 await expect(page.locator('.ed-sticky-media img')).toHaveAttribute('src',await row.getAttribute('data-media'));
 await page.getByRole('tab',{name:'Our Standards'}).click();
 await expect(page.getByRole('tabpanel',{name:'Our Standards'})).toContainText('ISO 9001:2015');
 await page.keyboard.press('ArrowRight');
 await expect(page.getByRole('tabpanel',{name:'Our Capability'})).toContainText('IEC 61439');
});

test('homepage retains information without JavaScript and with reduced motion',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce'});const page=await context.newPage();
 await page.goto(new URL(home,test.info().project.use.baseURL).href);
 await expect(page.locator('h1')).toBeVisible();
 await expect(page.locator('.ed-signal-chain')).toContainText('PLC / HMI / SCADA');
 await expect(page.locator('.ed-scale-rail')).toContainText('7000+');
 await context.close();
});

test('delayed CMS SEO updates metadata without replacing the editorial homepage',async({page})=>{
 await page.route('**/api/public?path=*',async r=>{await new Promise(resolve=>setTimeout(resolve,300));await r.fulfill({json:{pageSeo:{'/':{title:'ACS SEO integration test'}},settings:{}}});});
 await page.goto(home);
 await expect(page).toHaveTitle('ACS SEO integration test');
 await expect(page.locator('.ed-opening')).toBeVisible();
 await expect(page.locator('.ed-capability-row')).toHaveCount(6);
});

test('admin continues restoring its session after a slow response',async({page})=>{
 let requestedOrigin;
 await page.addInitScript(()=>sessionStorage.setItem('acsAdminSession',JSON.stringify({email:'preview@example.test',token:'mock-session',expiresAt:Date.now()+60000})));
 await page.route('**/api/admin?days=*',async r=>{requestedOrigin=new URL(r.request().url()).origin;await new Promise(resolve=>setTimeout(resolve,500));await r.fulfill({json:{pages:[],posts:[],positions:[],applications:[],partners:[],settings:{},analytics:{}}});});
 await page.goto('/admin');await expect(page.locator('#statusBar')).toContainText('All changes are loaded.');
 expect(requestedOrigin).toBe(new URL(page.url()).origin);await expect(page.locator('body')).not.toHaveClass(/admin-locked|admin-busy/);
 await page.reload();await expect(page.locator('#statusBar')).toContainText('All changes are loaded.');
});
