const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'.scratch/design-manifest.json')));
const live=process.argv.includes('--live');
const major=['index.html','about.html','services.html','panel-manufacturer.html','process-automation.html','software-and-cutting-edge-technologies.html','siemens-s7-1200.html','contact.html','career.html','photo-gallery.html'];
(async()=>{const b=await chromium.launch();let cursor=0;const jobs=Object.entries(manifest).flatMap(([file,m])=>[320,390,1440,...(major.includes(file)?[768,1920]:[])].map(width=>({file,m,width})));const report=[];
 await Promise.all(Array.from({length:3},async()=>{while(cursor<jobs.length){const {file,m,width}=jobs[cursor++];const p=await b.newPage({viewport:{width,height:960},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''}));await p.goto('http://localhost:3200/'+(live?file:m.staged),{waitUntil:'domcontentloaded'});await p.waitForTimeout(200);await p.evaluate(()=>document.querySelectorAll('img[loading]').forEach(n=>n.loading='eager'));await p.evaluate(()=>Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,6000))]));
 const data=await p.evaluate(()=>{
  const visible=n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(n).visibility!=='hidden';};
  const forms=[...document.querySelectorAll('form')].map(f=>({id:f.id,fields:[...f.querySelectorAll('input,textarea,select')].map(n=>({name:n.name,type:n.type,required:n.required}))}));
  const bad=[...document.querySelectorAll('main *,header *,footer *')].filter(n=>visible(n)&&n.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent.slice(0,40)}));
  return {overflow:document.documentElement.scrollWidth-innerWidth,bad,forms,broken:[...document.images].filter(n=>visible(n)&&n.complete&&!n.naturalWidth).map(n=>n.src),mainText:document.querySelector('main').textContent.replace(/\s+/g,' ').trim(),h1:document.querySelectorAll('h1').length};
 });
 const formMismatch=JSON.stringify(data.forms)!==JSON.stringify(m.contracts);delete data.forms;
 report.push({file,width,...data,formMismatch,errors,hash:createHash('sha256').update(fs.readFileSync(path.join(root,live?file:m.staged))).digest('hex')});
 if(major.includes(file)&&[390,1440].includes(width)){await p.screenshot({path:path.join(root,`.scratch/editorial-${file.replace('.html','')}-${width}.png`)});if(width===1440)await p.screenshot({path:path.join(root,`.scratch/editorial-${file.replace('.html','')}-full.png`),fullPage:true});}
 await p.close();}}));await b.close();fs.writeFileSync(path.join(root,'.scratch/editorial-verification.json'),JSON.stringify(report,null,2));const issues=report.filter(r=>r.overflow>1||r.bad.length||r.formMismatch||r.errors.length||r.broken.length||r.h1!==1);console.log(JSON.stringify({checks:report.length,issues:issues.map(({mainText,...r})=>r)},null,2));if(issues.length)process.exitCode=1;})();
