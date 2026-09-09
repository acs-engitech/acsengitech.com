const {test,expect}=require('@playwright/test');

test('Services contains only the approved ACS service content',async({page})=>{
  await page.goto('/services.html');
  await expect(page.locator('.acs-directory-card')).toHaveCount(6);
  await expect(page.locator('main')).toContainText('PLC, SCADA, instrumentation, commissioning');
  await expect(page.locator('main')).not.toContainText(/Lorem ipsum|Bookkeeping|Tax Consulting|59,00/i);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('product filters, image preview and enquiry links survive the theme',async({page})=>{
  await page.goto('/siemens-s7-1200.html');
  await page.locator('.cat-tab').filter({hasText:/^CPU$/}).click();
  await expect(page.locator('.prod-card:visible')).toHaveCount(4);
  const card=page.locator('.prod-card:visible').first();
  await expect(card.locator('.wa-btn')).toHaveAttribute('href',/^https:\/\/wa.me\/917048520058/);
  await card.locator('img').click();
  await expect(page.locator('#lb')).toHaveClass(/on/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lb')).not.toHaveClass(/on/);
  await page.locator('.cat-tab').filter({hasText:/^ALL$/i}).click();
  expect(await page.locator('.prod-card:visible').count()).toBeGreaterThan(4);
});

test('secondary mobile menu and chatbot install once even with repeated runtime',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/about.html');
  await page.locator('.acs-lab-toggle').click();
  await expect(page.locator('#acsMobileMenu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#acsMobileMenu')).toBeHidden();
  await page.addScriptTag({url:'/acs-runtime.js'});
  const chatbot=page.locator('script[src="https://cleuzaibot.srv1512185.hstgr.cloud/widget/v1/bundle.js"]');
  await expect(chatbot).toHaveCount(1);
  await expect(chatbot).toHaveAttribute('data-client-id','client_862605');
  await expect(chatbot).toHaveAttribute('data-public-key','pk_live_vk50wW0PYdOiHyPR4krYoozrATDgSQZNmn3N');
});
