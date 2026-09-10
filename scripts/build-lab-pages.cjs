const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.ACS_TEST_URL || 'http://localhost:3200';
const selected = process.argv.slice(2);
const files = fs.readdirSync(root).filter(f => f.endsWith('.html') && !/-legacy|-lab|^header|^footer/.test(f) && (!selected.length || selected.includes(f)));
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

(async () => {
  const browser = await chromium.launch();
  const shellPage = await browser.newPage({ javaScriptEnabled: false });
  await shellPage.goto(base + '/index.html');
  const shell = await shellPage.evaluate(() => ({ head:document.head.innerHTML, header:document.querySelector('header').outerHTML, footer:document.querySelector('footer').outerHTML, main:document.querySelector('main').outerHTML }));
  await shellPage.close();
  let cursor = 0;
  const report = selected.length && fs.existsSync(path.join(root,'.scratch/lab-build-manifest.json')) ? JSON.parse(fs.readFileSync(path.join(root,'.scratch/lab-build-manifest.json'))) : {};
  await Promise.all(Array.from({length:4}, async () => {
    while (cursor < files.length) {
      const file = files[cursor++];
      const page = await browser.newPage({ viewport:{width:1440,height:1000} });
      await page.route('**/widget/v1/bundle.js', route => route.abort());
      await page.goto(base+'/'+file, {waitUntil:'domcontentloaded',timeout:30000});
      await page.waitForFunction(() => window.__acsLabRuntime?.runtimeStarted, {timeout:20000});
      await page.waitForTimeout(500);
      const model = await page.evaluate(file => {
        const norm = s => String(s || '').replace(/\s+/g,' ').trim();
        const escape = s => String(s || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const content = document.querySelector('.acs-preserved-page') || document.querySelector('main') || document.querySelector('.entry-content');
        const intro = content?.querySelector('.acs-preserved-intro');
        const title = intro?.querySelector('h1')?.textContent || document.querySelector('main h1,h1')?.textContent || document.title.split(' - ')[0];
        const lead = intro?.querySelector('.acs-lab-hero-content > p:not(.acs-template-kicker)')?.textContent || '';
        const kicker = intro?.querySelector('.acs-template-kicker')?.textContent || title;
        const heroImage = intro?.querySelector('img')?.getAttribute('src') || 'assets/acs/control-panels.jpg';
        const route = file.replace('.html','');
        const manifest = [];
        const original = content?.cloneNode(true);
        original?.querySelectorAll('script,style,title,meta,link,noscript,svg,.acs-preserved-intro,.acs-preserved-project-cta,.acs-original-banner,#lb').forEach(n=>n.remove());
        const originalTexts=[];
        if(original){ const walker=document.createTreeWalker(original,NodeFilter.SHOW_TEXT); while(walker.nextNode()){const t=norm(walker.currentNode.textContent);if(/[a-zA-Z]/.test(t))originalTexts.push(t);} }
        const src = value => {
          if (!value) return '';
          if(value==='https://acsengitech.com/wp-content/uploads/2023/05/Textile.jpg')return 'https://acsengitech.com/wp-content/uploads/2026/06/textile.jpg';
          if (value.startsWith(location.origin)) return value.slice(location.origin.length);
          return value.replace(/^index\.html([^#?]+)/,'$1').replace(/https:\/\/acsengitech.com\/https:\/\/acsengitech.com\//g,'https://acsengitech.com/');
        };
        const omit = 'script,style,title,meta,link,noscript,svg,.orb,.bgr,.s1-bgshape,.acs-preserved-intro,.acs-preserved-project-cta,.acs-original-banner,#lb';
        function clean(node, inCard=false) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = norm(node.textContent);
            if(text) manifest.push(text);
            return escape(node.textContent);
          }
          if (node.nodeType !== Node.ELEMENT_NODE || node.matches(omit)) return '';
          if(node.matches('[data-acs-form-island]')) {
            const form=node.querySelector('form');
            if(!form)throw new Error('Original contact form did not render');
            const fields=[...form.querySelectorAll('.mf-input-wrapper')].map(wrapper=>{
              const field=wrapper.querySelector('input,textarea');field.required=true;field.maxLength=field.name==='mf-comment'?10000:320;
              return `<div class="${field.tagName==='TEXTAREA'?'acs-form-wide':''}">${wrapper.querySelector('label').outerHTML}${field.outerHTML}</div>`;
            }).join('');
            return `<form id="acs-contact-form"><h3>${escape(form.querySelector('h3').textContent)}</h3><div class="acs-row">${fields}</div><button type="submit">${escape(form.querySelector('button[type=submit]').textContent)}</button><p role="status" id="acs-contact-status" aria-live="polite"></p></form>`;
          }
          if(node.matches('.pa-tabs-section,.mpa-tabs-section')) {
            const copy=node.cloneNode(true),panes=[...copy.querySelectorAll('.pa-pane,.mpa-pane')],buttons=[...copy.querySelectorAll('.pa-nav-btn,.mpa-nav-btn')];copy.classList.remove('pa-tabs-section','mpa-tabs-section');
            copy.querySelectorAll('.pa-pane,.pa-nav,.mpa-pane,.mpa-nav').forEach(n=>n.remove());
            copy.querySelectorAll('.pa-nav-btn,.mpa-nav-btn').forEach(n=>n.remove());
            return clean(copy)+`<div class="acs-industry-tabs nav nav-pills" role="tablist">`+buttons.map((b,i)=>`<button class="nav-link ${i?'':'active'}" id="industry-tab-${i}" data-bs-toggle="pill" data-bs-target="#industry-${i}" role="tab" aria-controls="industry-${i}" aria-selected="${!i}">${escape(norm(b.textContent))}</button>`).join('')+'</div><div class="tab-content">'+panes.map((p,i)=>`<div class="tab-pane ${i?'':'show active'}" id="industry-${i}" role="tabpanel" aria-labelledby="industry-tab-${i}">${[...p.childNodes].map(n=>clean(n)).join('')}</div>`).join('')+'</div>';
          }
          if(node.matches('.prod-grid')) return `<div class="acs-product-grid">${[...node.children].map(n=>clean(n)).join('')}</div>`;
          if(node.matches('#section')&&node.querySelector('.metric'))return `<div class="rs-counter-area acs-contact-counters"><div class="acs-detail-grid">${[...node.querySelectorAll('.metric')].map(n=>clean(n)).join('')}</div></div>`;
          if(node.matches('.prod-card')) return `<article class="rs-services-item acs-product-card" data-product-category="${escape(node.dataset.cat||'cpu')}">${[...node.childNodes].map(n=>clean(n,true)).join('')}</article>`;
          if(node.matches('.cat-tabs')) return `<div class="acs-product-filters" role="group" aria-label="Product categories">${[...node.querySelectorAll('.cat-tab')].map((b,i)=>`<button type="button" data-product-filter="${escape((b.getAttribute('onclick')||'').match(/\('([^']+)'/)?.[1]||'all')}" aria-pressed="${!i}">${escape(norm(b.textContent))}</button>`).join('')}</div>`;
          if(node.matches('.sn,.metric .num,[data-count-to]') && /^[\d,+.\s]+$/.test(node.textContent)) {
            const value=node.dataset.countTo || node.dataset.target || node.dataset.count || norm(node.textContent).replace(/[^0-9]/g,'');
            if(value) return `<span class="rs-counter-number" data-count-to="${escape(value)}">${escape(value)}</span>${node.textContent.includes('+')?'<span class="acs-counter-plus">+</span>':''}`;
          }
          if (node.matches('img')) {
            const url=src(node.getAttribute('src') || node.dataset.src);
            if(!url) return '';
            return `<img src="${escape(url)}" alt="${escape(node.alt)}" loading="lazy">`;
          }
          if (node.matches('iframe')) return `<iframe src="${escape(node.src)}" title="${escape(node.title || 'ACS location')}" loading="lazy" width="100%" height="400"></iframe>`;
          if(node.matches('br')) return '<br>';
          if (node.matches('form')) { manifest.push(...[...node.querySelectorAll('label,button')].map(n=>norm(n.textContent)).filter(Boolean)); return node.outerHTML; }
          const card = !inCard && /(^|\s)(vc|cred|feat-item|pa-sol-card|pa-info-card|sc-bar|.*-card)(\s|$)/.test(node.className || '') || !inCard&&node.matches('.sv-grid > .sc');
          const html = [...node.childNodes].map(n=>clean(n,inCard||card)).join('');
          if(!norm(html)) return '';
          if(node.matches('h1,h2,h3,h4,h5,h6')) return `<${inCard?'h3':node.tagName==='H1'?'h2':node.tagName.toLowerCase()}>${html}</${inCard?'h3':node.tagName==='H1'?'h2':node.tagName.toLowerCase()}>`;
          if(node.matches('p,ul,ol,li,table,thead,tbody,tr,th,td,strong,em,b,i,br')) return `<${node.tagName.toLowerCase()}>${html}</${node.tagName.toLowerCase()}>`;
          if(node.matches('a')) return `<a${card?' class="rs-services-item acs-detail-card acs-service-link"':''} href="${escape(src(node.getAttribute('href')) || '#')}"${node.target?' target="_blank" rel="noopener"':''}>${html}</a>`;
          if(node.matches('button')) return `<span class="acs-source-label">${html}</span>`;
          if(card) return `<article class="rs-services-item acs-detail-card">${html}</article>`;
          if(!node.classList.contains('e-grid')&&/(^|\s)(.*grid|sg|vmv|creds|feat-list)(\s|$)/.test(node.className || '')) return `<div class="acs-detail-grid">${html}</div>`;
          if(node.matches('.s1-in,.overview-in,.pa-intro-inner,.mpa-intro-inner')) return `<div class="acs-story-layout">${html}</div>`;
          if(node.matches('[data-acs-contact-layout]')) return `<div class="acs-contact-layout">${html}</div>`;
          if(node.matches('section')) return `<section class="acs-content-group">${html}</section>`;
          if(/(^|\s)(sh|H1|H2|tl-title|vc-ttl|pa-pane-h3)(\s|$)/.test(node.className || '')) return `<h2>${html}</h2>`;
          if(/(^|\s)(slbl|eyebrow|kicker|awdit-label)(\s|$)/.test(node.className || '')) return `<p class="rs-section-subtitle has-theme-light-blue">${html}</p>`;
          return node.matches('span') ? `<span>${html}</span>` : `<div class="acs-copy-block">${html}</div>`;
        }
        function section(node, component='rs-about-area') {
          return `<section class="${component} acs-section"><div class="container acs-content-flow">${clean(node)}</div></section>`;
        }
        let body='';
        const scripts=[];
        let extraScripts='';
        if(file==='index.html') return {home:true,title:document.title};
        if(file==='about.html' && content.querySelector('.tl-box')) {
          const history=content.querySelector('.s2');
          const boxes=[...history.querySelectorAll('.tl-box')];
          const story=content.querySelector('.s1').cloneNode(true);
          const stats=content.querySelector('.stats');
          body+=section(story,'rs-about-area rs-about-six');
          if(stats) body+=section(stats,'rs-counter-area rs-counter-one');
          body+='<section class="rs-history-area rs-history-one acs-section"><div class="container">'+clean(history.querySelector('.s2-intro'));
          body+='<div class="rs-history-tab-wrapper"><div class="nav nav-pills" role="tablist" aria-label="Company history">'+boxes.map((box,i)=>`<button class="nav-link ${i?'':'active'}" id="history-tab-${i}" data-bs-toggle="pill" data-bs-target="#history-${i}" role="tab" aria-controls="history-${i}" aria-selected="${!i}">${escape(norm(box.querySelector('.tl-year')?.textContent))}</button>`).join('')+'</div></div>';
          body+='<div class="rs-history-tab-content-wrapper tab-content">'+boxes.map((box,i)=>`<div class="tab-pane ${i?'':'show active'}" id="history-${i}" role="tabpanel" aria-labelledby="history-tab-${i}">${clean(box)}</div>`).join('')+'</div></div></section>';
          for(const [selector,component] of [['.s3','rs-team-area'],['.s4','rs-about-area'],['.s5','rs-services-area rs-services-six'],['.s6','rs-cta']]){const node=content.querySelector(selector);if(node)body+=section(node,component);}
        } else if(content?.querySelector('.prod-card')) {
          body=section(content,'rs-services-area')+'<dialog id="acs-image-dialog"><button aria-label="Close image" type="button"><i class="ri-close-line" aria-hidden="true"></i></button><img alt=""></dialog>';
        } else if(file==='blog.html') {
          body='<section class="rs-blog-area acs-section"><div class="container"><div id="acs-blog-board">'+(document.getElementById('acs-blog-board')?.innerHTML || '')+'</div></div></section>';
        } else if(file==='career.html') {
          const roles=document.querySelector('.acs-career-roles,.acs-career-board,#acs-career-board');
          const allRoles=[...document.querySelectorAll('.acs-career-role')].map(n=>n.outerHTML).join('');
          const careerIntro=content.cloneNode(true);careerIntro.querySelectorAll('.acs-career-role,#acs-career-board,.acs-career-board,.acs-apply-form').forEach(n=>n.remove());
          body=section(careerIntro,'rs-team-area')+'<section class="rs-team-area acs-section"><div class="container"><div id="acs-career-board">'+(allRoles||roles?.innerHTML||'')+'</div></div></section>';
          const form=document.getElementById('acs-job-form');
          form?.querySelectorAll('#acs-position-select option:not(:first-child)').forEach(n=>n.remove());
          if(form) body+='<section class="rs-contact-area acs-section"><div class="container acs-form-container">'+form.parentElement.outerHTML+'</div></section>';
          scripts.push(...[...document.querySelectorAll('script:not([src])')].filter(n=>n.textContent.includes("var form = document.getElementById('acs-job-form')")).map(n=>n.textContent));
        } else if(file==='partner-with-us.html') {
          const form=document.getElementById('acs-partner-form');
          form.querySelectorAll('#acs-partner-category option:not(:first-child)').forEach(n=>n.remove());
          body='<section class="rs-contact-area acs-section"><div class="container acs-form-container">'+form.parentElement.outerHTML+'</div></section>';
          scripts.push(...[...document.querySelectorAll('script:not([src])')].filter(n=>n.textContent.includes("var form = document.getElementById('acs-partner-form')")).map(n=>n.textContent));
        } else {
          const clone=content.cloneNode(true);
          clone.querySelectorAll(omit).forEach(n=>n.remove());
          if(file==='contact.html') {
            clone.querySelectorAll('.elementor-widget-metform').forEach(node=>{node.dataset.acsFormIsland='true';});
            const formColumn=clone.querySelector('.elementor-element-62fbbed');
            if(formColumn)formColumn.parentElement.dataset.acsContactLayout='true';
          }
          body=section(clone,'rs-services-area');
        }
        return {title:norm(title),description:document.querySelector('meta[name="description"]')?.content||'',lead:norm(lead),kicker:norm(kicker),heroImage:src(heroImage),body,scripts,extraScripts,manifest:originalTexts,route};
      },file);
      let head=shell.head.replace('css/acs-home.css','css/acs-pages.css').replace('js/acs-home.js','js/acs-pages.js');
      if(model.home) head=shell.head;
      if(!model.home){
        const source=fs.readFileSync(path.join(root,file),'utf8');
        model.title=(source.match(/<title>(.*?)<\/title>/s)?.[1]||model.title).replace(/\s*[-\u2013|]\s*ACS(?: Engitech)?$/i,'').replace(/&amp;/g,'&');
        model.kicker=model.title;
        head=head.replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esc(model.description)}">`);
      }
      head=head.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(model.title)}</title>`);
      if(!head.includes('css/acs-shell.css'))head+='<link rel="stylesheet" href="assets/lab-theme/css/acs-shell.css">';
      head=head.replace(/<script src="assets\/lab-theme\/js\/acs-(?:home|pages).js"/, '<script defer src="assets/lab-theme/js/acs-shell.js"></script>$&');
      const hero=`<section class="rs-breadcrumb-area rs-breadcrumb-one"><img class="acs-breadcrumb-photo" src="${esc(model.heroImage)}" alt="${esc(model.kicker)}"><div class="container"><div class="rs-breadcrumb-content-wrapper"><p class="rs-section-subtitle">${esc(model.kicker)}</p><h1 class="rs-breadcrumb-title">${esc(model.title)}</h1>${model.lead?`<p class="acs-breadcrumb-lead">${esc(model.lead)}</p>`:''}<nav class="rs-breadcrumb-menu" aria-label="Breadcrumb"><ul><li><a href="index.html">Home</a></li><li aria-current="page">${esc(model.kicker)}</li></ul></nav></div></div></section>`;
      const cta='<section class="rs-cta acs-contact-band acs-section"><div class="container"><div><h2>Need dependable automation execution?</h2><p>Talk to ACS Engitech about PLC panels, SCADA systems, process automation, machine automation, data logging, or Siemens automation support.</p></div><a class="rs-btn" href="contact.html">Contact Us <i class="ri-arrow-right-line" aria-hidden="true"></i></a></div></section>';
      const main=model.home?shell.main:`<main id="main">${hero}${model.body}${cta}</main>`;
      const html=`<!doctype html>\n<html lang="en"><head>${head}</head><body class="acs-laboratory${model.home?'':' acs-document'}" data-acs-standalone data-acs-page-path="/${model.home?'':model.route}"><a class="acs-skip" href="#main">Skip to content</a>${shell.header}${main}${shell.footer}${model.extraScripts||''}${(model.scripts||[]).map(s=>`<script>${s}</script>`).join('')}</body></html>`;
      const staged=file.replace('.html','-lab.html');
      fs.writeFileSync(path.join(root,staged),html);
      report[file]={staged,manifest:model.manifest||[],bytes:Buffer.byteLength(html)};
      await page.close();
    }
  }));
  fs.writeFileSync(path.join(root,'.scratch/lab-build-manifest.json'),JSON.stringify(report,null,2));
  await browser.close();
  console.log(`Staged ${Object.keys(report).length} pages; original HTML untouched.`);
})();
