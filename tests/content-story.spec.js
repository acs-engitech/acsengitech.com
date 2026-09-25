const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.route('**/api/public*',r=>r.fulfill({json:{settings:{}}}));
 await page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''}));
 await page.emulateMedia({reducedMotion:'reduce'});
});
const words=text=>{const out={};for(const word of text.match(/[\p{L}\p{N}]+/gu)||[])out[word]=(out[word]||0)+1;return out;};
const content=page=>page.locator('main').evaluate(el=>{
 const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),parts=[];
 while(walker.nextNode())parts.push(walker.currentNode.textContent);
 return parts.join(' ');
});
test('enhancement preserves every original content word on transformed capability pages',async({page})=>{
 test.setTimeout(60000);
 for(const path of ['about','process-automation','process-automation-2','machine-plant-automation','software-and-cutting-edge-technologies','boiler-automation','energy-monitoring-and-date-management','smart-data-logger','smart-data-logger-2']){
  await page.route('**/assets/acs-site/story.js',r=>r.fulfill({body:''}));await page.goto('/'+path+'.html');
  const before=words(await content(page));await page.unroute('**/assets/acs-site/story.js');await page.reload();
  const after=words(await content(page));
  const missing=Object.entries(before).filter(([word,count])=>(after[word]||0)<count);
  expect(missing,path).toEqual([]);
 }
});
test('history has readable contrast, intact milestones and working directional controls',async({page})=>{
 await page.goto('/about.html');await page.getByRole('tab',{name:'2014',exact:true}).click();
 await expect(page.locator('.tab-pane.active .history-year')).toHaveText('2014');
 await page.getByRole('button',{name:'Next milestone'}).click();await expect(page.locator('.tab-pane.active .history-year')).toHaveText('2015');
 await page.getByRole('button',{name:'Previous milestone'}).click();await expect(page.locator('.tab-pane.active .history-year')).toHaveText('2014');
 const colors=await page.locator('.history-copy').first().evaluate(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el.closest('section')).backgroundColor}));
 const luminance=s=>{const c=s.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 expect((luminance(colors.bg)+.05)/(luminance(colors.color)+.05)).toBeGreaterThanOrEqual(4.5);
});
test('industry explorer is keyboard accessible and retains nested engineering detail',async({page})=>{
 await page.goto('/process-automation.html');const chapters=page.locator('.acs-industry-chapter');
 await expect(chapters).toHaveCount(4);
 const first=chapters.first();await first.locator('.acs-context-story summary').click();await expect(first.locator('.acs-context-story')).toContainText('Siemens TIA Portal');
 const feature=first.locator('.acs-feature').nth(1);await feature.locator('summary').focus();await page.keyboard.press('Enter');await expect(feature).toHaveAttribute('open','');
 await expect(first.locator('.acs-feature').first()).not.toHaveAttribute('open','');
 await chapters.nth(3).locator('> summary').click();await expect(chapters.nth(3)).toHaveAttribute('open','');await expect(first).not.toHaveAttribute('open','');
 await expect(chapters.nth(3)).toContainText('2300');
});
test('product hero uses its actual catalogue image and applications is no longer empty',async({page})=>{
 await page.goto('/siemens-s7-1500.html');const src=await page.locator('.acs-product-card img').first().getAttribute('src');
 await expect(page.locator('.acs-breadcrumb-photo')).toHaveAttribute('src',src);
  await page.goto('/application.html');await expect(page.locator('.application-row')).toHaveCount(5);
  await page.locator('.application-row').nth(3).focus();await expect(page.locator('.application-preview img')).toHaveAttribute('src','assets/home-journey/media/ems.jpg');
});
test('story layouts fit mobile, tablet and wide desktop including the final milestone',async({page})=>{
 test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,390,768,1440,1920]){
  await page.setViewportSize({width,height:960});
  for(const path of ['about','process-automation','siemens-s7-1500','application']){
   await page.goto('/'+path+'.html');
   if(path==='about')await page.getByRole('tab',{name:/2026/}).click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),path+' at '+width).toBeLessThanOrEqual(1);
  }
 }
 expect(errors).toEqual([]);
});
