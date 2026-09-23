const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
if(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('data-design-kind="home"'))throw new Error('Already activated. Edit the public HTML directly; do not rebuild from transformed input.');
const files=fs.readdirSync(root).filter(f=>f.endsWith('.html')&&!/-(lab|legacy|design)|^(header|footer)/.test(f));
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage({javaScriptEnabled:false});const manifest={};
 const assets=JSON.parse(fs.readFileSync(path.join(root,'.scratch/asset-audit.json')));
 const asset=alt=>assets.find(a=>a.alt===alt)?.src;
 const media={panel:asset('PLC CUM MCC')||'assets/acs/control-panels.jpg',drawing:asset('EPLAN Software'),software:asset('EMS Live Data'),logview:asset('System Integration'),front:asset('Manufacturing Control Panels'),team:'assets/acs/acs-team.jpg'};
 await page.goto('http://localhost:3200/index.html');
 const home=await page.evaluate(()=>({
  services:[...document.querySelectorAll('.acs-service-card')].map(a=>({href:a.getAttribute('href'),title:a.querySelector('h4').textContent,copy:a.querySelector('p').textContent,image:a.querySelector('img').getAttribute('src')})),
  footer:document.querySelector('footer').outerHTML,
  nav:[...document.querySelectorAll('.main-menu >ul>li')].map(li=>({label:li.querySelector('a')?.textContent.trim(),href:li.querySelector('a')?.getAttribute('href'),children:[...li.querySelectorAll('.submenu a')].map(a=>({label:a.textContent.trim(),href:a.getAttribute('href')}))}))
 }));
 home.services.forEach((service,i)=>{service.image=[media.panel,media.front||media.panel,media.software,media.software,media.logview,'assets/acs/mcc-panel.jpg'][i]||service.image;});
 for(const [index,file]of files.entries()){
  await page.goto('http://localhost:3200/'+file);
  const result=await page.evaluate(({file,index,home,media})=>{
   const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const main=document.querySelector('main');
   const original=main.cloneNode(true);original.querySelectorAll('script,style').forEach(n=>n.remove());
   const originalText=original.textContent.replace(/\s+/g,' ').trim();
   const contracts=[...document.querySelectorAll('form')].map(f=>({id:f.id,fields:[...f.querySelectorAll('input,textarea,select')].map(n=>({name:n.name,type:n.type,required:n.required}))}));
   const route=file.replace('.html','');
   let kind=file==='index.html'?'home':/^(about|photo-gallery|certificates)$/.test(route)?'company':/^(contact|career|partner-with-us|blog)$/.test(route)?'utility':/^(services|application|trading)$/.test(route)?'index':/^(siemens-|accessories)/.test(route)?'product':/software|data-logger|energy-monitoring|scada/.test(route)?'digital':/panel/.test(route)?'manufacturing':/boiler|evaporator|centralized/.test(route)?'industry':'service';
   document.body.classList.add('acs-ed');document.body.dataset.designKind=kind;document.body.dataset.designRoute=route;
   document.body.dataset.acsPagePath=route==='index'?'/':'/'+route;
   const link=(label,href)=>`<a href="${esc(href)}">${esc(label)}<i class="ri-arrow-right-up-line" aria-hidden="true"></i></a>`;
   const item=name=>home.nav.find(n=>n.label===name);
   const group=(name,items)=>`<details class="ed-nav-group"><summary>${name}<i class="ri-add-line" aria-hidden="true"></i></summary><div class="ed-nav-links">${items.filter(Boolean).map(n=>link(n.label,n.href)).join('')}</div></details>`;
   const services=item('Services'),panels=item('Panel Manufacturer'),applications=item('Application'),trading=item('Trading');
   const engineering=[panels,...(panels?.children||[]),services,...(services?.children||[])];
   document.querySelector('header').outerHTML=`<header class="ed-header"><a class="ed-brand" href="index.html" aria-label="ACS Engitech home"><img src="logo-1.svg" alt="ACS Engitech"></a><span class="ed-header-note">AUTOMATION / ENGINEERING</span><nav class="ed-navigation" id="ed-navigation" aria-label="Main navigation">${group('Engineering',engineering)}${group('Industries',[applications,...(applications?.children||[])])}${group('Siemens',[trading,...(trading?.children||[])])}${group('Company',home.nav.filter(n=>['About','Blog','Career','Certificates','Partner With Us'].includes(n.label)).concat([{label:'Photo Gallery',href:'photo-gallery.html'}]))}</nav><a class="ed-contact-link" href="contact.html">Talk engineering<i class="ri-arrow-right-up-line" aria-hidden="true"></i></a><button class="ed-menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="ed-navigation"><i class="ri-menu-line" aria-hidden="true"></i></button></header>`;
   document.querySelector('footer').outerHTML=home.footer;
   document.querySelector('footer').classList.add('ed-footer');
   const footerTitle=document.createElement('div');footerTitle.className='ed-footer-signature';footerTitle.innerHTML='<span>ACS ENGITECH</span><small>ENGINEERING IN EVERY CONNECTION.</small>';document.querySelector('footer').prepend(footerTitle);
   const label=text=>`<p class="ed-label">${text}</p>`;
   const img=(src,alt,cls='')=>`<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`;
   const capability=rows=>`<div class="ed-capability-index"><figure class="ed-sticky-media">${img(rows[0].image,rows[0].title)}<figcaption>ACS / AUTOMATION SYSTEMS</figcaption></figure><div class="ed-capability-rows">${rows.map((s,i)=>`<a class="ed-capability-row" href="${s.href}" data-media="${esc(s.image)}" data-media-alt="${esc(s.title)}"><span class="ed-index">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.copy)}</p></div><i class="ri-arrow-right-up-line" aria-hidden="true"></i></a>`).join('')}</div></div>`;
   if(kind==='home'){
    const about=main.querySelector('.acs-about'),features=main.querySelector('.acs-features'),stats=main.querySelector('.acs-counter-band'),cases=main.querySelector('.acs-cases'),clients=main.querySelector('.acs-clients');
    const opening=document.createElement('section');opening.className='ed-opening';opening.innerHTML=`${img(media.panel,'ACS electrical panel: PLC, drives and internal wiring','ed-opening-photo')}<div class="ed-opening-top">${label('ACS ENGITECH / AHMEDABAD, INDIA')}<span>PLC / HMI / SCADA</span></div><div class="ed-opening-content"><h1>Industrial<br>automation.</h1><div><p>Electrical automation built for real industrial plants.</p><a class="ed-arrow-link" href="services.html">Explore our engineering <i class="ri-arrow-down-line" aria-hidden="true"></i></a></div></div><div class="ed-opening-bottom"><span>CONTROL SYSTEMS. CONNECTED.</span><span>EST. 2009</span></div>`;
    const system=document.createElement('section');system.className='ed-system ed-section';system.innerHTML=`<div class="ed-container"><div class="ed-section-heading">${label('01 / CONNECTED ENGINEERING')}<h2>One process.<br>Every connection.</h2><p>Automation control panels, PLC, SCADA, process automation, machine automation, and industrial data systems for factories across India.</p></div><div class="ed-signal-chain">${[['FIELD','Instrumentation','process-automation.html'],['CONTROL','PLC / HMI / SCADA','scada.html'],['POWER','MCC / VFD / PCC','panel-manufacturer.html'],['PROCESS','Machine & plant automation','machine-plant-automation.html'],['DATA','Logging & intelligence','smart-data-logger.html']].map((a,i)=>`<a href="${a[2]}"><span class="ed-label">0${i+1} / ${a[0]}</span><strong>${a[1]}</strong><i class="ri-arrow-right-line" aria-hidden="true"></i></a>`).join('')}</div></div>`;
    const proof=document.createElement('section');proof.className='ed-proof ed-section';proof.innerHTML=`<div class="ed-container">${label('02 / ENGINEERING AT SCALE')}<div class="ed-proof-layout"><div class="ed-metric">2300<span>I/O</span></div><div><h2>Complexity.<br>Under control.</h2><p>ACS has commissioned PLC systems with up to 2300 I/O points in the FMCG segment, managing tank farm sequencing, CIP cycles, pigging systems, and centralized production monitoring from a single SCADA node.</p>${link('Process automation','process-automation.html')}</div></div></div>`;
    const capabilities=document.createElement('section');capabilities.className='ed-section ed-capabilities';capabilities.innerHTML=`<div class="ed-container"><div class="ed-section-heading">${label('03 / CAPABILITIES')}<h2>From control philosophy<br>to commissioning.</h2></div>${capability(home.services)}</div>`;
    const manufacturing=document.createElement('section');manufacturing.className='ed-manufacturing ed-section';manufacturing.innerHTML=`<div class="ed-container">${label('04 / PANEL ENGINEERING')}<h2>Precision panels.<br>Built in Ahmedabad.</h2><div class="ed-manufacturing-media">${img(media.front||media.panel,'ACS manufactured control panel')}<div class="ed-facility-proof"><strong>36,000</strong><span>SQ. FT. / IN-HOUSE MANUFACTURING</span><p>MCC, IMCC, PCC, PLC, VFD, SCADA and instrumentation panels engineered and fabricated from our facility in Ahmedabad.</p></div></div><div class="ed-manufacturing-caption"><span>EPLAN / POWER & CONTROL DRAWINGS</span><span>FABRICATION / ASSEMBLY / TESTING</span></div></div>`;
    const delivery=main.querySelector('.acs-process');delivery.classList.add('ed-delivery');manufacturing.append(delivery);
    about.classList.add('ed-company-story');features.classList.add('ed-credentials');stats.classList.add('ed-scale-rail');cases.classList.add('ed-projects');clients.classList.add('ed-trust');
    cases.querySelector('h2').textContent='Control systems. In application.';
    cases.querySelectorAll('.acs-case-card').forEach((n,i)=>{n.querySelector('img').src=['assets/acs/control-panels.jpg','assets/acs/mcc-panel.jpg','assets/acs/vfd-panel.jpg'][i];n.insertAdjacentHTML('afterbegin',label(`APPLICATION / 0${i+1}`));});
    const digital=document.createElement('section');digital.className='ed-digital ed-section';digital.innerHTML=`<div class="ed-container">${label('06 / PHYSICAL SYSTEMS. DIGITAL INTELLIGENCE.')}<div class="ed-digital-heading"><h2>See your<br>process clearly.</h2><div><h3>ACS LogView</h3><p>Customizable filtration, historical trends, tabular viewer, and storage-limited records. Production, process, and energy logging systems for traceability and performance monitoring.</p>${link('Explore data systems','smart-data-logger.html')}</div></div><figure>${img(media.software,'ACS energy monitoring live data screen')}<figcaption>ACS ENERGY MONITORING / LIVE DATA</figcaption></figure></div>`;
    const cta=main.lastElementChild;cta.classList.add('ed-final');cta.querySelector('h3').innerHTML='Your process.<br>Our engineering.';
    main.replaceChildren(opening,system,proof,stats,capabilities,manufacturing,cases,digital,about,features,clients,cta);
    document.querySelectorAll('script[src*="acs-home.js"],script[src*="acs-shell.js"]').forEach(n=>n.remove());
   }else{
    const oldHero=main.querySelector('.rs-breadcrumb-one');
    const title=oldHero?.querySelector('h1')?.textContent||document.title;
    const lead=oldHero?.querySelector('.acs-breadcrumb-lead')?.textContent||'';
    const contentImages=[...main.querySelectorAll('.acs-content-flow img,.acs-product-card img')];
    let heroImage=contentImages[0]?.getAttribute('src')||oldHero?.querySelector('img')?.getAttribute('src')||media.panel;
    if(kind==='manufacturing')heroImage=contentImages.find(n=>/PLC Panel|PLC CUM|MCC Panel|VFD Panel/.test(n.alt))?.getAttribute('src')||media.panel;
    if(kind==='company')heroImage=route==='about'?media.team:(contentImages[0]?.getAttribute('src')||media.team);
    if(kind==='digital')heroImage=route.includes('logger')?media.logview:media.software;
    if(kind==='service')heroImage=media.panel;
    const hero=document.createElement('section');hero.className='ed-page-hero';hero.innerHTML=`<div class="ed-container">${label(`ACS / ${kind.toUpperCase()} / ${String(index+1).padStart(2,'0')}`)}<h1>${esc(title)}</h1>${lead?`<p class="ed-page-lead">${esc(lead)}</p>`:''}</div>${kind!=='utility'&&kind!=='index'?`<figure class="ed-page-media">${img(heroImage,title)}<figcaption>${kind==='product'?'SIEMENS / AUTOMATION COMPONENTS':'ACS ENGITECH / '+esc(title.toUpperCase())}</figcaption></figure>`:''}`;
    if(route==='blog')oldHero?.remove();else oldHero?.replaceWith(hero);
    if(kind==='index'&&route==='services'){
      const section=main.querySelector('.acs-section:not(.acs-contact-band)');
      if(section){section.innerHTML=`<div class="ed-container">${capability(home.services)}</div>`;section.classList.add('ed-capabilities');}
    }
    main.querySelectorAll('.acs-content-group').forEach((section,i)=>{section.classList.add('ed-chapter');const heading=section.querySelector('h2,h3');if(heading){section.id=`chapter-${i+1}`;section.insertAdjacentHTML('afterbegin',label(`CHAPTER / ${String(i+1).padStart(2,'0')}`));if(/Industries We Serve/.test(heading.textContent))section.classList.add('ed-industry-index');if(/Expert Software/.test(heading.textContent))section.classList.add('ed-software-portfolio');}});
    if(kind==='service'&&route.startsWith('process-automation'))hero.querySelector('.ed-page-media').insertAdjacentHTML('beforebegin',`<section class="ed-route-proof ed-container"><strong>2300<span>I/O</span></strong><p>PLC systems commissioned in the FMCG segment.</p></section>`);
    if(kind==='company'){
      main.querySelectorAll('img[alt="Our Vision"],img[alt="Our Mission"],img[alt="Our Values"]').forEach(n=>n.remove());
      const facility=main.querySelector('img[alt="ACS Engitech Facility"]');if(facility){facility.src=media.panel;facility.alt='ACS control panel';}
      const workshop=main.querySelector('img[alt="ACS Engitech Workshop"]');if(workshop){workshop.src=media.drawing;workshop.alt='EPLAN power and control drawings';}
    }
    if(kind==='manufacturing'&&route==='panel-manufacturer')hero.insertAdjacentHTML('afterend',`<section class="ed-drawing ed-container"><div>${label('ENGINEERING / BEFORE FABRICATION')}<h2>Every connection.<br>By design.</h2><p>EPLAN power and control drawings, linked through ERP.</p></div>${img(media.drawing,'EPLAN power and control drawings')}</section>`);
    main.querySelector('.acs-contact-band')?.classList.add('ed-final');
    document.querySelectorAll('script[src*="acs-shell.js"]').forEach(n=>n.remove());
   }
   document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="assets/acs-editorial.css"><script src="assets/acs-editorial.js" defer></script>');
   return {html:'<!doctype html>\n'+document.documentElement.outerHTML,originalText,contracts,kind};
  },{file,index,home,media});
  const staged=file.replace('.html','-design.html');fs.writeFileSync(path.join(root,staged),result.html);manifest[file]={staged,kind:result.kind,originalText:result.originalText,contracts:result.contracts};
 }
 fs.writeFileSync(path.join(root,'.scratch/design-manifest.json'),JSON.stringify(manifest,null,2));await browser.close();console.log(`Art-directed ${files.length} staged pages; public originals untouched.`);
})();
