const {test,expect}=require('@playwright/test');
const route=name=>`/${name}${process.env.ACS_DESIGN_STAGED?'-design':''}.html`;
test.beforeEach(async({page})=>page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''})));

test('Services contains only the approved ACS service content',async({page})=>{
  await page.goto(route('services'));
  await expect(page.locator('.ed-capability-row')).toHaveCount(6);
  await expect(page.locator('main')).toContainText('PLC, SCADA, instrumentation, commissioning');
  await expect(page.locator('main')).not.toContainText(/Lorem ipsum|Bookkeeping|Tax Consulting|59,00/i);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('product filters, image preview and enquiry links survive the theme',async({page})=>{
  await page.goto(route('siemens-s7-1200'));
  await page.getByRole('button',{name:'CPU',exact:true}).click();
  await expect(page.locator('.acs-product-card:visible')).toHaveCount(4);
  const card=page.locator('.acs-product-card:visible').first();
  await expect(card.locator('a')).toHaveAttribute('href',/^https:\/\/wa.me\/917048520058/);
  await card.locator('img').click();
  await expect(page.locator('#acs-image-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#acs-image-dialog')).toBeHidden();
  await page.getByRole('button',{name:'All',exact:true}).click();
  expect(await page.locator('.acs-product-card:visible').count()).toBeGreaterThan(4);
});

test('secondary mobile menu and chatbot install once even with repeated runtime',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(route('about'));
  await page.locator('.ed-menu-toggle').click();
  await expect(page.locator('.ed-navigation')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ed-navigation')).toBeHidden();
  await page.addScriptTag({url:'/acs-runtime.js'});
  const chatbot=page.locator('script[src="https://cleuzaibot.srv1512185.hstgr.cloud/widget/v1/bundle.js"]');
  await expect(chatbot).toHaveCount(1);
  await expect(chatbot).toHaveAttribute('data-client-id','client_862605');
  await expect(chatbot).toHaveAttribute('data-public-key','pk_live_vk50wW0PYdOiHyPR4krYoozrATDgSQZNmn3N');
});
