(() => {
  'use strict';
  const main=document.querySelector('main');
  if(!main||main.dataset.storyReady)return;
  main.dataset.storyReady='true';
  document.body.classList.add('acs-story-page');
  const icon=()=>'<i class="ri-add-line" aria-hidden="true"></i>';
  const children=node=>[...node.children];

  const hero=main.querySelector('.rs-breadcrumb-one'),heroImage=hero?.querySelector('.acs-breadcrumb-photo');
  if(document.body.classList.contains('acs-family-product')&&heroImage){
    const actual=main.querySelector('.acs-product-card img,.acs-content-flow img');
    if(actual){
      heroImage.src=actual.getAttribute('src');heroImage.alt=actual.alt;heroImage.removeAttribute('loading');
      hero.classList.add('acs-product-hero');hero.querySelector('.rs-breadcrumb-content-wrapper').append(heroImage);
    }
  }

  const applications=main.querySelector('.acs-application-index');
  if(applications){
    const references=[
      ['assets/acs/control-panels.jpg','Control panel engineering'],
      ['assets/acs/vfd-panel.jpg','Drive panel engineering'],
      ['assets/home-journey/media/plc-mcc.jpg','PLC / MCC panel engineering'],
      ['assets/home-journey/media/ems.jpg','ACS energy monitoring'],
      ['assets/home-journey/media/logview.jpg','ACS LogView']
    ];
    const rows=[...applications.querySelectorAll('.application-row')];
    const stage=document.createElement('figure');stage.className='application-preview';
    stage.innerHTML='<img width="800" height="600" alt=""><figcaption></figcaption>';
    const list=document.createElement('div');list.className='application-list';list.append(...rows);applications.append(stage,list);
    const select=index=>{
      const [src,label]=references[index];stage.querySelector('img').src=src;stage.querySelector('img').alt=label;stage.querySelector('figcaption').textContent=label;
      rows.forEach((row,i)=>row.classList.toggle('is-previewed',i===index));
    };
    rows.forEach((row,i)=>{row.addEventListener('pointerenter',()=>select(i));row.addEventListener('focus',()=>select(i));});select(0);
  }

  // Reuse existing content nodes: disclosure changes hierarchy, not the underlying copy.
  main.querySelectorAll('article.acs-detail-card').forEach(card=>{
    if(document.body.classList.contains('acs-family-product'))return;
    if(card.querySelector('img,a,button,input,details'))return;
    let source=card;
    while(source.children.length===1&&source.firstElementChild.tagName==='DIV')source=source.firstElementChild;
    const [title,...body]=children(source);
    if(!title||!body.length||title.textContent.trim().length>120||body.map(n=>n.textContent).join('').trim().length<25)return;
    const detail=document.createElement('details');detail.className='acs-feature';
    if(card.id)detail.id=card.id;
    const summary=document.createElement('summary');summary.append(title);summary.insertAdjacentHTML('beforeend',icon());
    const copy=document.createElement('div');copy.className='acs-feature-copy';copy.append(...body);
    detail.append(summary,copy);card.replaceWith(detail);detail.parentElement.classList.add('acs-feature-list');
  });
  main.querySelectorAll('.acs-feature-list').forEach(list=>{
    const rows=children(list).filter(n=>n.matches('.acs-feature'));
    if(rows.length>2)rows[0].open=true;
    rows.forEach(row=>row.addEventListener('toggle',()=>{if(row.open)rows.forEach(other=>{if(other!==row)other.open=false;});}));
  });

  const tabs=main.querySelector('.acs-industry-tabs');
  if(tabs){
    const explorer=document.createElement('div');explorer.className='acs-industry-explorer';
    const content=tabs.nextElementSibling;
    [...tabs.querySelectorAll('[data-bs-target]')].forEach((tab,index)=>{
      const pane=document.querySelector(tab.dataset.bsTarget);if(!pane)return;
      const chapter=document.createElement('details');chapter.className='acs-industry-chapter';chapter.id=pane.id;chapter.open=index===0;
      const summary=document.createElement('summary');summary.id=tab.id;summary.dataset.number=String(index+1).padStart(2,'0');
      const label=document.createElement('span');label.textContent=tab.textContent;summary.append(label);summary.insertAdjacentHTML('beforeend',icon());
      const body=document.createElement('div');body.className='acs-industry-stage';body.append(...pane.childNodes);
      const layout=body.querySelector('.acs-detail-grid');layout?.classList.add('acs-industry-layout');
      const introduction=layout?.firstElementChild;
      const paragraphs=introduction?children(introduction).filter(n=>n.tagName==='P'):[];
      if(paragraphs.length){
        const context=document.createElement('details');context.className='acs-context-story';
        context.innerHTML='<summary>Application context '+icon()+'</summary><div></div>';
        paragraphs[0].before(context);context.lastElementChild.append(...paragraphs);
      }
      const media=layout?.children[1];if(media)media.classList.add('acs-industry-evidence');
      chapter.append(summary,body);explorer.append(chapter);
    });
    tabs.replaceWith(explorer);content?.remove();
    explorer.querySelectorAll(':scope > details').forEach(chapter=>chapter.addEventListener('toggle',()=>{
      if(!chapter.open)return;
      explorer.querySelectorAll(':scope > details').forEach(other=>{if(other!==chapter)other.open=false;});
      requestAnimationFrame(()=>{if(chapter.getBoundingClientRect().top<parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header')))chapter.scrollIntoView({block:'start',behavior:'instant'});});
    }));
    const first=main.querySelector('.acs-content-group');
    const layout=first?.querySelector('.acs-story-layout,.acs-detail-grid');
    if(layout?.children.length===2){
      layout.classList.add('acs-opening-story');
      const right=layout.children[1],paragraphs=children(right).filter(n=>n.tagName==='P');
      const facts=children(right).find(n=>n.tagName==='DIV');
      if(facts){facts.classList.add(facts.querySelector('span')?'acs-proof-strip':'acs-system-specs');layout.after(facts);}
      if(paragraphs.length){
        const scope=document.createElement('details');scope.className='acs-scope-story';
        scope.innerHTML='<summary>Engineering scope '+icon()+'</summary><div></div>';
        scope.lastElementChild.append(...paragraphs);layout.after(scope);
      }
      const photo=document.createElement('figure');photo.className='acs-drawing-plane';
      photo.innerHTML='<img src="assets/home-journey/media/engineering.jpg" alt="ACS engineering drawings" width="1000" height="700" loading="lazy"><figcaption>ACS / Panel engineering</figcaption>';
      right.replaceChildren(photo);
    }
  }

  const history=main.querySelector('.rs-history-area');
  if(history){
    history.classList.add('acs-history-story');
    const panels=[...history.querySelectorAll('.tab-pane')],buttons=[...history.querySelectorAll('[role=tab]')];
    panels.forEach(panel=>{
      const source=panel.firstElementChild;const [year,title,copy]=children(source);
      if(!year||!title||!copy)return;
      year.classList.add('history-year');title.classList.add('history-title');copy.classList.add('history-copy');
      source.classList.add('history-scene');const description=document.createElement('div');description.className='history-event';description.append(title,copy);source.append(description);
    });
    const controls=document.createElement('div');controls.className='history-controls';
    controls.innerHTML='<button type="button" data-history-step="-1" aria-label="Previous milestone" title="Previous milestone"><i class="ri-arrow-left-line" aria-hidden="true"></i></button><button type="button" data-history-step="1" aria-label="Next milestone" title="Next milestone"><i class="ri-arrow-right-line" aria-hidden="true"></i></button>';
    history.querySelector('.rs-history-tab-content-wrapper').after(controls);
    const state=()=>{const index=buttons.findIndex(b=>b.classList.contains('active'));controls.children[0].disabled=index===0;controls.children[1].disabled=index===buttons.length-1;};
    controls.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      const index=buttons.findIndex(x=>x.classList.contains('active')),target=buttons[index+Number(b.dataset.historyStep)];
      if(target)window.bootstrap.Tab.getOrCreateInstance(target).show();
    }));
    buttons.forEach(b=>b.addEventListener('shown.bs.tab',state));state();
  }

  function revealHash(){
    const id=decodeURIComponent(location.hash.slice(1));if(!id)return;
    const target=document.getElementById(id);if(!target||!main.contains(target))return;
    let node=target;while(node&&node!==main){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}
  }
  addEventListener('hashchange',revealHash);revealHash();
})();
