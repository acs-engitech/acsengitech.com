const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {parse}=require('parse5');
const root=path.resolve(__dirname,'..');
const files=fs.readdirSync(root).filter(f=>f.endsWith('.html')&&!/-(lab|legacy|design)|^(header|footer)/.test(f));
const images=new Map();
for(const file of files){const doc=parse(fs.readFileSync(path.join(root,file),'utf8'));const visit=n=>{const a=Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));if(n.tagName==='img'&&a.src){const item=images.get(a.src)||{src:a.src,alt:a.alt||'',pages:[]};item.pages.push(file);images.set(a.src,item);}for(const c of n.childNodes||[])visit(c);};visit(doc);}
fs.mkdirSync(path.join(root,'.scratch'),{recursive:true});fs.writeFileSync(path.join(root,'.scratch/asset-audit.json'),JSON.stringify([...images.values()],null,2));
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:960}});
 await p.route('**/widget/v1/bundle.js',r=>r.abort());
 await p.goto('http://localhost:3200/',{waitUntil:'domcontentloaded'});await p.screenshot({path:path.join(root,'.scratch/design-before.png')});
 const selected=[...images.values()].filter(x=>x.pages.some(p=>['index.html','about.html','panel-manufacturer.html','software-and-cutting-edge-technologies.html','photo-gallery.html','process-automation.html'].includes(p))&&!/logo|svg|placehold/i.test(x.src));
 for(let i=0;i<selected.length;i+=16){await p.setContent(`<style>body{margin:16px;font:13px Arial}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}img{width:100%;height:180px;object-fit:contain;background:#eef0f1}p{height:40px;margin:8px 0}</style><main>${selected.slice(i,i+16).map((x,j)=>`<div><img src="${new URL(x.src,'http://localhost:3200/').href}"><p>${i+j} / ${x.alt}</p></div>`).join('')}</main>`);await p.evaluate(()=>Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,8000))]));await p.screenshot({path:path.join(root,`.scratch/assets-${i/16}.png`),fullPage:true});}
 for(const [name,url]of [['hadrian','https://www.hadrian.co/'],['bright','https://www.brightmachines.com/'],['ur','https://www.universal-robots.com/'],['vention','https://vention.com/']]){try{await p.goto(url,{waitUntil:'domcontentloaded',timeout:18000});await p.waitForTimeout(1500);await p.screenshot({path:path.join(root,`.scratch/ref-${name}.png`)});}catch(e){console.log(name,e.message.split('\n')[0]);}}
 await b.close();console.log(`${files.length} routes; ${images.size} unique image assets; ${selected.length} editorial images inventoried.`);
})();
