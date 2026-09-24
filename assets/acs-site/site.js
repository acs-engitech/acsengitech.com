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
})();
