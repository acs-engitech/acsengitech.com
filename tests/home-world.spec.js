const { test, expect } = require('@playwright/test');
const ids=['arrival','field','control','installation','power','data','engineering-proof','experience','contact'];
async function chapter(page,id){
 await page.evaluate(id=>{const el=document.getElementById(id);scrollTo({top:el.getBoundingClientRect().top+scrollY-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header')),behavior:'instant'});},id);
 await expect(page.locator('#acs-world')).toHaveAttribute('data-stage',id);
}
async function pixels(page){
 return page.evaluate(async()=>{
  const source=document.querySelector('#world-canvas').captureWorld();const img=new Image();img.src=source;await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
  const data=ctx.getImageData(0,0,c.width,c.height).data;let dark=0,blue=0;
  for(let i=0;i<data.length;i+=4){if(data[i]<170&&data[i+1]<185&&data[i+2]<185)dark++;if(data[i+2]>data[i]+25)blue++;}
  return {dark,blue};
 });
}
test.beforeEach(async ({page}) => {
  await page.route('**/api/public*',r=>r.fulfill({json:{settings:{},pageSeo:{}}}));
  await page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''}));
});

for(const width of [320,390,768,1024,1440,1920])test(`3D scene, chapters and media fit ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.emulateMedia({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
 for(const id of ids){
  await chapter(page,id);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.locator('#'+id+' h1,#'+id+' h2,#'+id+' p').evaluateAll(elements=>elements.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent))).toEqual([]);
 }
 await chapter(page,'control');
 const stats=await pixels(page);expect(stats.dark).toBeGreaterThan(800);expect(stats.blue).toBeGreaterThan(100);
 await page.screenshot({path:`.scratch/world-check-${width}.png`});
 for(const id of ['engineering-proof','experience','contact'])await page.locator('#'+id).scrollIntoViewIfNeeded();
 expect(errors).toEqual([]);
});

test('cabinet inspection, doors, rotation and reset change the actual canvas',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
 await chapter(page,'control');
 const canvas=page.locator('#world-canvas canvas');const before=await canvas.screenshot();
 await page.locator('#world-door').click();await expect(page.locator('#world-door')).toHaveAttribute('aria-pressed','false');
 await page.waitForTimeout(100);expect(Buffer.compare(before,await canvas.screenshot())).not.toBe(0);
 await page.locator('[data-zone=routing]').click();await expect(page.locator('#world-part-copy')).toContainText('Routing zone / cable management');
 const closed=await canvas.screenshot();await page.locator('#world-right').click();await page.waitForTimeout(100);
 expect(Buffer.compare(closed,await canvas.screenshot())).not.toBe(0);
 await page.locator('#world-reset').click();await expect(page.locator('#world-door')).toHaveAttribute('aria-pressed','true');
 const box=await canvas.boundingBox();const reset=await canvas.screenshot();
 await page.mouse.move(box.x+box.width*.53,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.62,box.y+box.height*.53,{steps:8});await page.mouse.up();
 expect(Buffer.compare(reset,await canvas.screenshot())).not.toBe(0);
});

test('software uses the real ACS imagery on the 3D display',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
 await chapter(page,'data');const before=await page.locator('canvas').screenshot();
 await page.locator('[data-world-software=logview]').click();await expect(page.locator('#world-software-original')).toHaveAttribute('href',/logview.jpg/);
 await page.waitForTimeout(250);expect(Buffer.compare(before,await page.locator('canvas').screenshot())).not.toBe(0);
});

test('native scroll advances the real camera without replacing the scene',async({page})=>{
 await page.goto('/');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
 const before=await page.locator('canvas').screenshot();await chapter(page,'power');await page.waitForTimeout(800);
 expect(Buffer.compare(before,await page.locator('canvas').screenshot())).not.toBe(0);
 await expect(page.locator('canvas')).toHaveCount(1);
 await expect(page.locator('.world-chapters a[aria-current=step]')).toHaveAttribute('href','#power');
 await chapter(page,'engineering-proof');
 await expect(page.locator('#engineering-proof .scene-content')).toBeVisible();
 await expect(page.locator('#world-canvas canvas')).toBeVisible();
 await chapter(page,'contact');
 await expect(page.locator('#contact .enquiry-action')).toBeVisible();
 await expect(page.locator('#world-canvas canvas')).toBeVisible();
});

test('WebGL failure shows matching rendered scenes, not substitute photographs',async({page})=>{
 await page.route('**/three.module.js',r=>r.abort());await page.goto('/');
 await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','fallback');
 await chapter(page,'power');await expect(page.locator('#world-poster')).toHaveAttribute('src',/world-power-desktop.png/);
 await page.locator('#world-poster').evaluate(img=>img.decode());await expect(page.locator('.world-fallback')).toBeVisible();
 await expect(page.locator('#world-right')).toBeHidden();
});

test('context loss preserves the active composition',async({page})=>{
 await page.goto('/');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');await chapter(page,'control');
 await page.locator('canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','fallback');
 await expect(page.locator('#world-poster')).toHaveAttribute('src',/world-control-desktop.png/);
 await page.locator('#world-poster').evaluate(img=>img.decode());
});

test('failed future model retains the dimensional schematic actor',async({page})=>{
 await page.route('**/home-journey/stages.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('cabinet: { modelUrl: null',"cabinet: { modelUrl: './missing-test.glb'")});});
 await page.route('**/missing-test.glb',r=>r.fulfill({status:404,body:'Missing test model'}));
 await page.goto('/');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
 await expect(page.locator('#world-canvas')).toHaveAttribute('data-model-fallback','schematic');
 expect((await pixels(page)).dark).toBeGreaterThan(800);
});

test('approved replacement slots load and disable unsupported door animation',async({page})=>{
 const vertices=new Float32Array([0,0,0,1,0,0,0,1,0]);
 const asset={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:'data:application/octet-stream;base64,'+Buffer.from(vertices.buffer).toString('base64'),byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]};
 await page.route('**/home-journey/stages.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('cabinet: { modelUrl: null',"cabinet: { modelUrl: './approved-test.gltf'")});});
 await page.route('**/approved-test.gltf',r=>r.fulfill({json:asset}));
 await page.goto('/');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');await chapter(page,'control');
 await expect(page.locator('#world-door')).toBeHidden();await expect(page.locator('canvas')).toBeVisible();
});

test('navigation and dropdown bounds work at all supported sizes',async({page})=>{
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:844});await page.goto('/');
  if(width<1024)await page.locator('.menu-toggle').click();
  for(const name of ['Expertise','Siemens','Company']){
   const button=page.getByRole('button',{name,exact:true});await button.focus();await page.keyboard.press('Enter');
   await expect(page.locator('.nav-group[open]')).toHaveCount(1);
   const bounds=await page.locator('.nav-group[open] .nav-dropdown').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
   await page.keyboard.press('Escape');await expect(button).toHaveAttribute('aria-expanded','false');
  }
  if(width<1024){await page.keyboard.press('Escape');await expect(page.locator('#main-navigation')).toBeHidden();}
 }
});

test('touch controls work and canvas permits native vertical scrolling',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
 await page.route('**/api/public*',r=>r.fulfill({json:{settings:{}}}));await page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''}));
 await page.goto(process.env.ACS_TEST_URL||'http://localhost:3000');await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
 await chapter(page,'control');await page.locator('[data-zone=connections]').tap();await expect(page.locator('#world-part-copy')).toContainText('Connection zone');
 await expect(page.locator('canvas')).toHaveCSS('touch-action','pan-y');await page.reload();await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
 const session=await context.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:600}]});
 for(const y of [550,500,450,400,350])await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100);await context.close();
});

test('CMS metadata and real ACS evidence remain intact',async({page})=>{
 await page.route('**/api/public?path=*',r=>r.fulfill({json:{settings:{},pageSeo:{'/':{title:'ACS SEO integration test'}}}}));
 await page.goto('/');await expect(page).toHaveTitle('ACS SEO integration test');await expect(page.locator('#acs-world')).toBeVisible();
 for(const [id,text] of [['installation','36,000'],['engineering-proof','2300'],['experience','7000+'],['experience','2018'],['contact','sales@acsengitech.com']])await expect(page.locator('#'+id)).toContainText(text);
});

test('no-JavaScript retains evidence and real scene renders',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const page=await context.newPage();
 await page.goto(process.env.ACS_TEST_URL||'http://localhost:3000');await expect(page.locator('#main-navigation')).toBeVisible();
 await expect(page.locator('.chapter-still')).toHaveCount(9);
 await expect(page.locator('#arrival h1')).toBeVisible();
 await expect(page.locator('#experience .trust-record')).toBeVisible();
 for(const img of await page.locator('.chapter-still').all())expect(await img.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await context.close();
});

test('all original route links and homepage assets resolve',async({page,request})=>{
 await page.goto('/');const paths=await page.locator('a[href],img[src],script[src],link[rel=stylesheet]').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('href')||n.getAttribute('src')).filter(path=>path&&!/^(https?:|mailto:|tel:|#)/.test(path)))]);
 for(const path of paths)expect((await request.get('/'+path)).status(),path).toBe(200);
});
test('homepage has a real persistent 3D installation',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
  await expect(page.locator('#world-canvas canvas')).toBeVisible();
  await expect(page.locator('[data-world-chapter]')).toHaveCount(9);
  await expect(page.locator('#acs-world .world-stage img:not(.world-poster)')).toHaveCount(0);
});

test('story typography, team evidence and proof remain separated across viewport heights',async({page})=>{
 test.setTimeout(60000);
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const [width,height] of [[320,740],[390,844],[768,900],[1024,768],[1440,960],[1920,900]]){
  await page.setViewportSize({width,height});await page.goto('/');
  await expect(page.locator('#acs-world')).toHaveAttribute('data-renderer','ready');
  for(const id of ids){
   await chapter(page,id);
   const collisions=await page.locator('#'+id+' .scene-content').evaluate(root=>{
    const nodes=[...root.children].filter(el=>getComputedStyle(el).display!=='none');
    const found=[];
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
     const a=nodes[i].getBoundingClientRect(),b=nodes[j].getBoundingClientRect();
     if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>5)found.push(nodes[i].className+' / '+nodes[j].className);
    }
    return found;
   });
   expect(collisions,`${width}x${height}: ${id}`).toEqual([]);
   if(id==='control'||id==='data'){
    const controls=await page.locator(id==='control'?'.world-inspection':'.world-software').boundingBox();
    const copy=await page.locator('#'+id+' .scene-description').boundingBox();
    const overlapX=Math.min(controls.x+controls.width,copy.x+copy.width)-Math.max(controls.x,copy.x);
    const overlapY=Math.min(controls.y+controls.height,copy.y+copy.height)-Math.max(controls.y,copy.y);
    expect(overlapX>5&&overlapY>5,`${width}px ${id} controls overlap story`).toBe(false);
   }
  }
  await chapter(page,'experience');
  const title=await page.locator('#experience .scene-title').boundingBox();
  const record=await page.locator('#experience .trust-record').boundingBox();
  expect(title.y+title.height).toBeLessThanOrEqual(record.y+1);
  if(width>=1000){
   const photo=await page.locator('.team-evidence').boundingBox();
   const numbers=await page.locator('.experience-numbers').boundingBox();
   expect(photo.y+photo.height).toBeLessThanOrEqual(numbers.y+1);
  }
 }
});

test('footer directory is keyboard accessible without losing existing routes',async({page})=>{
 for(const width of [320,390,768,1440,1920]){
  await page.setViewportSize({width,height:900});await page.goto('/');
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  for(const label of ['Explore our engineering','People & company']){
   const summary=page.locator('.footer-directory summary').filter({hasText:label});
   await summary.focus();await page.keyboard.press('Enter');
   await expect(summary.locator('..')).toHaveAttribute('open','');
  }
  await expect(page.locator('.footer-directory a[href="panel-manufacturer.html"]')).toBeVisible();
  await expect(page.locator('.footer-directory a[href="career.html"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
});
