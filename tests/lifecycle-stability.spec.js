const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const files=fs.readdirSync('.').filter(f=>f.endsWith('.html')&&fs.readFileSync(f,'utf8').includes('acs-restored'));
test.beforeEach(async({page})=>{
  await page.route('**/api/public*',r=>r.fulfill({json:{settings:{}}}));
  await page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''}));
  await page.emulateMedia({reducedMotion:'reduce'});
});
test('inner page content and footer share one wide-screen container',async({page})=>{
  test.setTimeout(120000);await page.setViewportSize({width:1920,height:1080});
  for(const file of files){
    await page.goto('/'+file);await page.evaluate(()=>document.fonts.ready);
    const main=await page.locator('main .container').first().boundingBox();
    const footer=await page.locator('.site-footer .container').boundingBox();
    expect(Math.abs(main.x-footer.x),file+' left edge').toBeLessThanOrEqual(1);
    expect(Math.abs(main.width-footer.width),file+' width').toBeLessThanOrEqual(1);
    const empty=await page.locator('.acs-content-flow').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.querySelector('img,form,[id^="acs-"]')).length);
    expect(empty,file+' empty content').toBe(0);
    expect(await page.locator('main').evaluate(n=>n.scrollWidth-n.clientWidth),file+' content width').toBeLessThanOrEqual(1);
  }
});
test('homepage presents the complete automation lifecycle in document and model order',async({page})=>{
  await page.goto('/');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
  const expected=['arrival','field','control','installation','power','data','engineering-proof','experience','contact'];
  expect(await page.locator('[data-world-chapter]').evaluateAll(nodes=>nodes.map(n=>n.id))).toEqual(expected);
  const data=await page.evaluate(async()=>{
    const {stages,modelSlots}=await import('/assets/home-journey/stages.js');
    return {ids:stages.map(s=>s.id),opening:stages[0].actors,process:modelSlots.process,manufacturing:stages[3].id};
  });
  expect(data.ids).toEqual(expected);expect(data.opening).toEqual(['process']);
  expect(data.process.modelUrl).toBe(null);expect(data.process.status).toContain('schematic');
  for(const word of ['process','manufacture','program','commission','2009'])await expect(page.locator('#arrival')).toContainText(word);
  await expect(page.locator('#control')).toContainText('EPLAN');
  await expect(page.locator('#installation')).toContainText('testing');
  await expect(page.locator('#data')).toContainText('PLC');
  await expect(page.locator('#experience')).toContainText('support');
});
test('manufacturing evidence is available without obscuring the mobile model',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.goto('/');
  await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
  await page.selectOption('#world-jump','installation');
  await expect(page.locator('#acs-world')).toHaveAttribute('data-stage','installation');
  await expect(page.locator('#installation .mobile-story-lead')).toHaveText('Built and tested at ACS.');
  await page.locator('#installation .mobile-scope').click();
  await expect(page.locator('#world-scope .scope-evidence img')).toBeVisible();
  await expect(page.locator('#world-scope')).toContainText('Actual ACS panel');
  await page.keyboard.press('Escape');await expect(page.locator('#installation .mobile-scope')).toBeFocused();
});
test('VFD route retains the published panel specifications and reference image',async({page})=>{
  await page.goto('/variable-frequency-drive-vfd-electrical-panel-manufacturers.html');
  for(const fact of ['0.37KW to 560KW','560 KW AC Drive Panel','Modbus, USS, Profinet and Profibus','36000 sq. ft.'])await expect(page.locator('.acs-content-flow')).toContainText(fact);
  await expect(page.locator('.acs-panel-evidence img')).toHaveAttribute('src','assets/acs/vfd-panel.jpg');
  await expect.poll(()=>page.locator('.acs-panel-evidence img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
});
