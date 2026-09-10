const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.scratch/lab-build-manifest.json')));
const live=process.argv.includes('--live');
(async()=>{
  const browser=await chromium.launch();
  const jobs=Object.entries(manifest).flatMap(([file,entry])=>[390,1440,1920].map(width=>({file,entry,width})));
  const results=[];let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<jobs.length){
      const {file,entry,width}=jobs[cursor++];
      const hash=createHash('sha256').update(fs.readFileSync(path.join(root,live?file:entry.staged))).digest('hex');
      const page=await browser.newPage({viewport:{width,height:960},reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/widget/v1/bundle.js',r=>r.abort());
      await page.goto(`http://localhost:3200/${live?file:entry.staged}`,{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(600);
      await page.evaluate(()=>document.querySelectorAll('img[loading=lazy]').forEach(n=>n.loading='eager'));
      await page.evaluate(()=>Promise.race([Promise.all([...document.images].map(n=>n.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,8000))]));
      const result=await page.evaluate(({texts})=>{
        const norm=s=>s.replace(/\s+/g,' ').trim();
        const text=norm(document.querySelector('main')?.textContent||'');
        const visible=n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(n).visibility!=='hidden';};
        const missing=[...new Set(texts.filter(t=>!text.includes(norm(t))))];
        const broken=[...document.querySelectorAll('img')].filter(n=>visible(n)&&n.complete&&!n.naturalWidth).map(n=>n.getAttribute('src'));
        const overflow=[...document.querySelectorAll('main *,header *')].filter(n=>visible(n)&&n.getBoundingClientRect().right>innerWidth+2).map(n=>n.className).slice(0,6);
        return {missing,broken,overflow,overflowPixels:document.documentElement.scrollWidth-innerWidth,headers:document.querySelectorAll('header').length,footers:document.querySelectorAll('footer').length};
      },{texts:entry.manifest});
      results.push({file,width,hash,...result,errors});
      if(['about.html','services.html','process-automation.html','siemens-s7-1200.html','contact.html','career.html','index.html'].includes(file)&&width!==1440){
        await page.screenshot({path:path.join(root,`.scratch/lab-${file.replace('.html','')}-${width}.png`),fullPage:true});
      }
      await page.close();
    }
  }));
  fs.writeFileSync(path.join(root,'.scratch/lab-verification.json'),JSON.stringify(results,null,2));
  const unique=results.filter(r=>r.width===390).map(r=>({file:r.file,missing:r.missing.slice(0,8),missingCount:r.missing.length,broken:r.broken,errors:r.errors})).filter(r=>r.missingCount||r.broken.length||r.errors.length);
  console.log(JSON.stringify({checked:results.length,contentAndErrors:unique,overflow:results.filter(r=>r.width!==390&&r.width!==1440? r.width && r.overflow.length : r.overflow.length).map(r=>({file:r.file,viewport:r.width,overflow:r.overflow})).slice(0,30)},null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
