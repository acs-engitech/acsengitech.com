const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage();
 await page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''}));
 for(const route of ['services','about','index']){
  await page.setViewportSize({width:1440,height:900});await page.goto(`http://localhost:3200/${route}-design.html`);
  if(route==='about')console.log('counters',await page.locator('.rs-counter-number').evaluateAll(ns=>ns.map(n=>({html:n.outerHTML,css:getComputedStyle(n).cssText,height:n.getBoundingClientRect().height,children:[...n.children].map(c=>({html:c.outerHTML,font:getComputedStyle(c).fontSize}))}))));
  for(const width of [320,390,768,1024]){
   await page.setViewportSize({width,height:844});
   console.log(route,width,await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,items:[...document.querySelectorAll('main *,header *,footer *')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).slice(0,15).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent.slice(0,55),right:n.getBoundingClientRect().right}))})));
  }
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../.scratch/design-manifest.json')));
 const missing={};
 for(const file of Object.keys(manifest)){
  await page.goto(`http://localhost:3200/${file}`);
  const before=await page.locator('main p,main li').evaluateAll(ns=>ns.filter(n=>!n.closest('script,style')).map(n=>n.textContent.replace(/\s+/g,' ').trim()).filter(s=>s.length>100));
  await page.goto(`http://localhost:3200/${manifest[file].staged}`);
  const after=(await page.locator('main').textContent()).replace(/\s+/g,' ');
  const lost=before.filter(s=>!after.includes(s));if(lost.length)missing[file]=lost;
 }
 fs.writeFileSync(path.join(__dirname,'../.scratch/content-comparison.json'),JSON.stringify(missing,null,2));console.log('missing',missing);
 await browser.close();
})();
