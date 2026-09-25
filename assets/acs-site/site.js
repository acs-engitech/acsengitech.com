(() => {
  'use strict';
  document.documentElement.classList.add('has-js');
  const nav=document.getElementById('main-navigation'),menu=document.querySelector('.menu-toggle');
  if(!nav||!menu||nav.dataset.bound)return;
  nav.dataset.bound='true';
  const groups=[...nav.querySelectorAll('.nav-group')],mobile=matchMedia('(max-width:1023px)');
  const canonical=path=>path.replace(/index\.html$|\.html$|\/$/g,'')||'/';
  nav.querySelectorAll('a').forEach(a=>{
    const active=canonical(new URL(a.href).pathname)===canonical(location.pathname);
    if(active){a.setAttribute('aria-current','page');a.closest('details')?.classList.add('contains-current');}
    else a.removeAttribute('aria-current');
  });
  function setMenu(open,focus=false){
    nav.classList.toggle('is-open',open);document.body.classList.toggle('menu-open',open);
    menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');menu.title=open?'Close menu':'Open menu';
    menu.querySelector('i').className=open?'ri-close-line':'ri-menu-line';
    if(!open)groups.forEach(g=>g.open=false);
    if(focus)menu.focus();
  }
  menu.addEventListener('click',()=>setMenu(!nav.classList.contains('is-open')));
  groups.forEach(g=>g.addEventListener('toggle',()=>{
    g.querySelector('summary').setAttribute('aria-expanded',String(g.open));
    if(g.open)groups.forEach(other=>{if(other!==g)other.open=false;});
  }));
  document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))setMenu(false);});
  nav.addEventListener('click',e=>{if(e.target.closest('a'))setMenu(false);});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      const open=groups.find(g=>g.open);
      if(open){open.open=false;open.querySelector('summary').focus();}
      else if(nav.classList.contains('is-open'))setMenu(false,true);
    }
    if(e.key==='Tab'&&mobile.matches&&nav.classList.contains('is-open')){
      const items=[...document.querySelectorAll('.site-header a,.site-header summary,.menu-toggle')].filter(el=>el.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  mobile.addEventListener('change',()=>setMenu(false));

  const media=[...document.querySelectorAll('[data-media-view]')];
  if(media.length){
    const viewer=document.createElement('dialog');viewer.className='acs-media-viewer';viewer.setAttribute('aria-labelledby','acs-media-caption');
    viewer.innerHTML='<div class="media-toolbar"><p id="acs-media-caption"></p><a class="media-original" target="_blank" rel="noopener" aria-label="Open original image" title="Open original image"><i class="ri-external-link-line" aria-hidden="true"></i></a><button type="button" data-close aria-label="Close image" title="Close image"><i class="ri-close-line" aria-hidden="true"></i></button></div><div class="media-surface"><img alt=""><p class="media-error" hidden>Image could not be loaded. The original file is available above.</p></div><div class="media-controls"><button type="button" data-step="-1" aria-label="Previous image" title="Previous image"><i class="ri-arrow-left-line" aria-hidden="true"></i></button><span class="media-count"></span><button type="button" data-step="1" aria-label="Next image" title="Next image"><i class="ri-arrow-right-line" aria-hidden="true"></i></button></div>';
    document.body.append(viewer);let current=0;
    const image=viewer.querySelector('img'),error=viewer.querySelector('.media-error');
    function show(index){
      current=(index+media.length)%media.length;const link=media[current],source=link.querySelector('img');
      error.hidden=true;image.hidden=false;image.src=link.href;image.alt=source.alt;
      viewer.querySelector('#acs-media-caption').textContent=link.closest('figure').querySelector('figcaption').textContent;
      viewer.querySelector('.media-original').href=link.href;viewer.querySelector('.media-count').textContent=(current+1)+' / '+media.length;
    }
    image.addEventListener('error',()=>{image.hidden=true;error.hidden=false;});
    media.forEach((link,i)=>link.addEventListener('click',e=>{e.preventDefault();show(i);viewer.showModal();}));
    viewer.querySelector('[data-close]').addEventListener('click',()=>viewer.close());
    viewer.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>show(current+Number(button.dataset.step))));
    viewer.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(current+(e.key==='ArrowRight'?1:-1));}});
    viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
  }
})();
