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
  const expected=['arrival','production','panel','inside','always-on','experience','capabilities','contact'];
  expect(await page.locator('[data-world-chapter]').evaluateAll(nodes=>nodes.map(n=>n.id))).toEqual(expected);
  const data=await page.evaluate(async()=>{
    const {stages,modelSlots}=await import('/assets/home-journey/stages.js');
    return {ids:stages.map(s=>s.id),callouts:stages.filter(s=>s.callouts).map(s=>s.id),doors:stages.map(s=>s.doorOpen||0),panel:modelSlots.panel,factory:modelSlots.factory};
  });
  expect(data.ids).toEqual(expected);expect(data.callouts).toEqual(['inside']);expect(data.doors[3]).toBe(1);expect(data.doors[2]).toBe(0);
  expect(data.panel.modelUrl).toBe(null);expect(data.factory.status).toContain('Not a replica');
  for(const word of ['process','manufacture','program','commission','2009'])await expect(page.locator('#arrival')).toContainText(word);
  await expect(page.locator('#production')).toContainText('control panel');
  await expect(page.locator('#panel')).toContainText('EPLAN');
  await expect(page.locator('#panel')).toContainText('tested');
  await expect(page.locator('#inside')).toContainText('PLC');
  await expect(page.locator('#always-on')).toContainText('24×7');
  await expect(page.locator('#experience')).toContainText('support');
});
test('manufacturing evidence is available without obscuring the mobile model',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.goto('/');
  await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
  await page.selectOption('#world-jump','panel');
  await expect(page.locator('#acs-world')).toHaveAttribute('data-stage','panel');
  await expect(page.locator('#panel .mobile-story-lead')).toHaveText('Designed in EPLAN. Built and tested in our 36,000 sq. ft. facility.');
  await page.locator('#panel .mobile-scope').click();
  await expect(page.locator('#world-scope .scope-evidence img')).toBeVisible();
  await expect(page.locator('#world-scope')).toContainText('Actual ACS panel');
  await page.keyboard.press('Escape');await expect(page.locator('#panel .mobile-scope')).toBeFocused();
});
test('VFD route retains the published panel specifications and reference image',async({page})=>{
  await page.goto('/variable-frequency-drive-vfd-electrical-panel-manufacturers.html');
  for(const fact of ['0.37KW to 560KW','560 KW AC Drive Panel','Modbus, USS, Profinet and Profibus','36000 sq. ft.'])await expect(page.locator('.acs-content-flow')).toContainText(fact);
  await expect(page.locator('.acs-panel-evidence img')).toHaveAttribute('src','assets/acs/vfd-panel.jpg');
  await expect.poll(()=>page.locator('.acs-panel-evidence img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
});
