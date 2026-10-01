const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
  await page.route('**/api/public*',r=>r.fulfill({json:{settings:{}}}));
  await page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''}));
});
test('MCC specifications are structured and its opening is not flattened',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/mcc-panel-manufacturer.html');
  const opening=page.locator('.acs-content-group').first().locator('.acs-detail-grid').first();
  await expect(opening).toHaveCSS('display','grid');
  await expect(page.locator('.acs-specification-row')).toHaveCount(9);
  await expect(page.locator('main img[src*="placehold.co"]')).toHaveCount(0);
  expect(await page.locator('main h2').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('*')]));
});
test('all nine panel types have working catalogue links and inspectable specifications',async({page})=>{
  await page.goto('/panel-manufacturer.html');
  await expect(page.locator('.acs-panel-record')).toHaveCount(9);
  const links=page.locator('.acs-panel-index a');await expect(links).toHaveCount(9);
  await links.nth(4).click();
  const record=page.locator('#panel-type-05');await expect(record).toHaveAttribute('open','');
  await expect(record.locator('li').first()).toContainText('4000A');
  await record.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(record).not.toHaveAttribute('open','');
});
test('software and logView comparisons preserve paired rows, package names and codes',async({page})=>{
  await page.goto('/software-and-cutting-edge-technologies.html');
  await expect(page.locator('.acs-comparison tbody tr')).toHaveCount(5);
  await expect(page.locator('.acs-software-record')).toHaveCount(4);
  await page.goto('/smart-data-logger.html');
  await expect(page.locator('.acs-comparison tbody tr')).toHaveCount(4);
  await expect(page.locator('.acs-package-record')).toHaveCount(3);
  await expect(page.locator('.acs-package-record').first()).toContainText('ACSLVB10');
  await expect(page.locator('.acs-package-upgrades tbody tr')).toHaveCount(4);
  await page.locator('[data-media-view]').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/smart-data-logger-2.html');
  await expect(page.locator('.acs-comparison tbody tr')).toHaveCount(4);
  await expect(page.locator('main img[src*="placehold.co"]')).toHaveCount(0);
});
test('restored technical documents fit narrow and wide screens with legible records',async({page})=>{
  test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,768,1440,1920]){
    await page.setViewportSize({width,height:1000});
    for(const route of ['mcc-panel-manufacturer','imcc-panel-manufacturer','panel-manufacturer','software-and-cutting-edge-technologies','smart-data-logger','smart-data-logger-2']){
      await page.goto('/'+route+'.html');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),route+' '+width).toBeLessThanOrEqual(1);
      const broken=await page.locator('.acs-comparison td,.acs-package-record p,.acs-specification-row p').evaluateAll(els=>els.filter(el=>parseFloat(getComputedStyle(el).fontSize)<15).length);
      expect(broken,route+' readable record text').toBe(0);
    }
  }
  expect(errors).toEqual([]);
});
test('related technical pages retain structured records without export artifacts or dummy images',async({page})=>{
  test.setTimeout(90000);
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:1000});
    for(const route of ['scada','multi-effect-evaporator-plant-automation','siemens-s7-300-plc','siemens-s7-400-plc','siemens-g120-ac-drives','siemens-v-90-servo-drive','siemens-et-200sp']){
      await page.goto('/'+route+'.html');
      await expect(page.locator('.acs-content-flow img[src*="placehold.co"]')).toHaveCount(0);
      expect((await page.locator('main h2').allTextContents()).filter(t=>t.includes('*')),route).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),route+' '+width).toBeLessThanOrEqual(1);
      for(const href of await page.locator('.acs-related-products a').evaluateAll(a=>a.map(n=>n.getAttribute('href')))){
        expect(href).not.toBe('#');expect((await page.request.get('/'+href)).status()).toBe(200);
      }
    }
  }
});
