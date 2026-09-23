(() => {
 const nav=document.querySelector('.ed-navigation'),toggle=document.querySelector('.ed-menu-toggle');
 if(!nav||!toggle)return;
 const close=()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open menu');toggle.firstElementChild.className='ri-menu-line';nav.querySelectorAll('details').forEach(d=>d.open=false);};
 toggle.addEventListener('click',()=>{const open=!nav.classList.contains('is-open');close();nav.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close menu':'Open menu');toggle.firstElementChild.className=open?'ri-close-line':'ri-menu-line';});
 nav.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)nav.querySelectorAll('details').forEach(other=>{if(other!==d)other.open=false;});}));
 document.addEventListener('click',e=>{if(!e.target.closest('.ed-header'))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const wasOpen=nav.classList.contains('is-open')||nav.querySelector('details[open]');close();if(wasOpen)toggle.offsetWidth?toggle.focus():nav.querySelector('summary').focus();}});
 matchMedia('(min-width:992px)').addEventListener('change',close);
 const route=location.pathname.replace(/-design(?=\.html$)/,'').replace(/\.html$|\/$/g,'')||'/index';
 nav.querySelectorAll('a').forEach(a=>{if(new URL(a.href).pathname.replace(/\.html$/,'')===route)a.setAttribute('aria-current','page');});
 document.querySelectorAll('.ed-capability-index').forEach(index=>{
  const image=index.querySelector('.ed-sticky-media img');
  index.querySelectorAll('[data-media]').forEach(row=>{const activate=()=>{if(image.getAttribute('src')!==row.dataset.media){image.src=row.dataset.media;image.alt=row.dataset.mediaAlt;}index.querySelectorAll('.is-active').forEach(n=>n.classList.remove('is-active'));row.classList.add('is-active');};row.addEventListener('pointerenter',activate);row.addEventListener('focus',activate);});
 });
 const tabs=[...document.querySelectorAll('.acs-tab-btn')];
 document.querySelector('.acs-tabs')?.setAttribute('role','tablist');
 tabs.forEach((button,i)=>{
  const panel=document.querySelector(`[data-panel="${button.dataset.tab}"]`);if(!panel)return;
  button.id=`ed-tab-${i}`;panel.id=`ed-panel-${i}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-selected',String(i===0));button.tabIndex=i===0?0:-1;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
  button.addEventListener('click',()=>tabs.forEach(t=>{const selected=t===button;t.classList.toggle('is-active',selected);t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;document.querySelector(`[data-panel="${t.dataset.tab}"]`).classList.toggle('is-active',selected);}));
  button.addEventListener('keydown',e=>{let next=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;if(next>=0){e.preventDefault();tabs[next].click();tabs[next].focus();}});
 });
})();
