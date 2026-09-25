const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const files=fs.readdirSync('.').filter(f=>f.endsWith('.html')&&fs.readFileSync(f,'utf8').includes('acs-restored'));
test.beforeEach(async({page})=>{
 await page.route('**/api/public*',r=>r.fulfill({json:{settings:{}}}));
 await page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''}));
 await page.emulateMedia({reducedMotion:'reduce'});
});
for(const width of [320,390,1440])test(`all restored routes fit and keep a single shared shell at ${width}px`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const file of files){
  await page.goto('/'+file,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.site-header')).toHaveCount(1);await expect(page.locator('.site-footer')).toHaveCount(1);
  await expect(page.locator('main h1').first()).toBeVisible();
  expect(await page.locator('main h1').first().evaluate(el=>el.scrollWidth-el.clientWidth),file+' heading').toBeLessThanOrEqual(1);
  const productImage=page.locator('.acs-product-hero .acs-breadcrumb-photo');
  if(await productImage.count())await expect.poll(()=>productImage.evaluate(img=>img.complete&&img.naturalWidth>0),{message:file+' product image'}).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),file).toBeLessThanOrEqual(1);
  await expect(page.locator('.home-link')).not.toHaveAttribute('aria-current','page');
  expect(errors,file).toEqual([]);
 }
});
test('certificate and photo collections retain all images and support keyboard viewing',async({page})=>{
 for(const [route,count] of [['certificates',10],['photo-gallery',15]]){
  await page.goto('/'+route+'.html');await expect(page.locator('[data-media-view]')).toHaveCount(count);
  await page.locator('[data-media-view]').first().click();await expect(page.locator('.acs-media-viewer')).toBeVisible();
  await expect(page.locator('.media-count')).toHaveText('1 / '+count);
  await page.keyboard.press('ArrowRight');await expect(page.locator('.media-count')).toHaveText('2 / '+count);
  await page.keyboard.press('Escape');await expect(page.locator('.acs-media-viewer')).toBeHidden();
  await expect(page.locator('[data-media-view]').first()).toBeFocused();
 }
});
test('trading restores eight separate linked products, not one stacked item',async({page,request})=>{
 await page.goto('/trading.html');await expect(page.locator('.catalogue-item')).toHaveCount(8);
 for(const a of await page.locator('.catalogue-item').all())expect((await request.get(await a.getAttribute('href'))).status()).toBe(200);
 const boxes=await page.locator('.catalogue-item').evaluateAll(items=>items.slice(0,3).map(x=>x.getBoundingClientRect().top));
 expect(new Set(boxes).size).toBe(1);
});
test('mobile scope reveals original copy and returns focus to the scene',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
 await expect(page.locator('#arrival .scope-copy')).toBeHidden();
 await page.locator('#arrival .mobile-scope').click();await expect(page.locator('#world-scope')).toBeVisible();
 await expect(page.locator('#world-scope')).toContainText('manufacture, program and commission');
 await page.keyboard.press('Escape');await expect(page.locator('#arrival .mobile-scope')).toBeFocused();
 await page.selectOption('#world-jump','control');await expect(page.locator('#acs-world')).toHaveAttribute('data-stage','control');
 await expect(page.locator('#world-door')).toHaveAttribute('aria-label','View cabinet exterior');
 await expect(page.locator('#world-door')).toHaveText('');
});
test('partner form keeps aligned controls and full-width long-form fields',async({page})=>{
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.goto('/partner-with-us.html');
  const input=await page.locator('[name=portfolio_url]').boundingBox(),remove=await page.locator('.acs-portfolio-remove').boundingBox();
  expect(Math.abs(input.y+input.height/2-remove.y-remove.height/2)).toBeLessThanOrEqual(2);
  expect(input.x+input.width).toBeLessThan(remove.x);
  const textarea=await page.locator('textarea').boundingBox(),form=await page.locator('#acs-partner-form').boundingBox();
  expect(textarea.width).toBeGreaterThan(form.width*.9);expect(textarea.height).toBeGreaterThanOrEqual(160);
 }
});
