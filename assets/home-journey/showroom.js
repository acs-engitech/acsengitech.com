(() => {
  'use strict';
  document.documentElement.classList.add('has-js');
  const nav = document.getElementById('main-navigation');
  const menu = document.querySelector('.menu-toggle');
  const groups = [...document.querySelectorAll('.nav-group')];
  const mobileNav = matchMedia('(max-width: 1023px)');
  function setMenu(open, focus = false) {
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.title = open ? 'Close menu' : 'Open menu';
    menu.firstElementChild.className = open ? 'ri-close-line' : 'ri-menu-line';
    if (!open) groups.forEach(group => { group.open = false; });
    if (focus) menu.focus();
  }
  menu.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  groups.forEach(group => group.addEventListener('toggle', () => {
    group.querySelector('summary').setAttribute('aria-expanded', String(group.open));
    if (group.open) groups.forEach(other => { if (other !== group) other.open = false; });
  }));
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) setMenu(false); });
  nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const open = groups.find(group => group.open);
      if (open) { open.open = false; open.querySelector('summary').focus(); }
      else if (nav.classList.contains('is-open')) setMenu(false, true);
    }
    if (event.key === 'Tab' && mobileNav.matches && nav.classList.contains('is-open')) {
      const items = [...document.querySelectorAll('.site-header a,.site-header summary,.menu-toggle')].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  mobileNav.addEventListener('change', () => setMenu(false));


  const journey = document.getElementById('acs-world');
  const mount = document.getElementById('world-canvas');
  const chapters = [...document.querySelectorAll('[data-world-chapter]')];
  const links = [...document.querySelectorAll('.world-chapters a')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const anchor = document.getElementById('world-anchor');
  const note = document.getElementById('world-note');
  const info = document.getElementById('world-info');
  const poster = document.getElementById('world-poster');
  let engine, stages, active = -1, frame = 0, scrollPositions = [], visible = true, lost = false;
  const parts = {
    control: 'Control zone / schematic mounting positions for the control assembly. No component models or ratings are implied.',
    connections: 'Connection zone / a schematic terminal and interface arrangement. Final geometry requires approved ACS references.',
    routing: 'Routing zone / ducts and a representative signal route. This is not an electrical wiring diagram.'
  };
  function part(name) {
    engine?.inspect(name);
    document.querySelectorAll('[data-zone]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.zone===name)));
    document.getElementById('world-part-copy').textContent=parts[name];
  }
  function showInfo(open) {note.hidden=!open;info.setAttribute('aria-expanded',String(open));}
  info.addEventListener('click',()=>showInfo(note.hidden));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')showInfo(false);});
  document.querySelectorAll('[data-zone]').forEach(button=>button.addEventListener('click',()=>part(button.dataset.zone)));
  const door=document.getElementById('world-door');
  mount.addEventListener('world-model-loaded',event=>{if(event.detail.id==='cabinet')door.hidden=!event.detail.doorsReady;});
  door.addEventListener('click',()=>{
    const open=door.getAttribute('aria-pressed')!=='true';
    engine?.setDoor(open);door.setAttribute('aria-pressed',String(open));
    door.querySelector('span').textContent=open?'Doors open':'Doors closed';
    door.title=open?'Close cabinet doors':'Open cabinet doors';
    door.querySelector('i').className=open?'ri-door-open-line':'ri-door-closed-line';
  });
  for(const [id,direction] of [['world-left',-1],['world-right',1]])document.getElementById(id).addEventListener('click',()=>engine?.rotate(direction));
  document.getElementById('world-reset').addEventListener('click',()=>{
    engine?.reset();door.setAttribute('aria-pressed','true');door.querySelector('span').textContent='Doors open';door.title='Close cabinet doors';
    document.querySelectorAll('[data-zone]').forEach(button=>button.setAttribute('aria-pressed','false'));
    document.getElementById('world-part-copy').textContent='Panel engineering / PLC / HMI / SCADA';
  });
  document.querySelectorAll('[data-world-software]').forEach(button=>button.addEventListener('click',()=>{
    const name=button.dataset.worldSoftware;
    engine?.setSoftware(name);
    document.querySelectorAll('[data-world-software]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    document.getElementById('world-software-original').href='assets/home-journey/media/'+name+'.jpg';
  }));
  function updatePoster(index) {
    const id=chapters[index].id;
    const base='assets/home-journey/media/world-'+id;
    document.getElementById('world-poster-mobile').srcset=base+'-mobile.png';
    poster.src=base+'-desktop.png';poster.alt='Rendered schematic ACS '+(stages?.[index].label||id)+' scene';
  }
  function select(index) {
    if(index===active)return;
    active=index;journey.dataset.stage=chapters[index].id;
    chapters.forEach((chapter,i)=>chapter.classList.toggle('is-active',i===index));
    if(!motion.matches)chapters[index].querySelector('.world-heading').animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
    links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
    document.getElementById('world-coordinate').textContent=String(index).padStart(2,'0')+' / '+(stages?.[index].label||chapters[index].id).toUpperCase();
    document.querySelector('.world-inspection').hidden=index!==2;
    document.querySelector('.world-software').hidden=index!==4;
    document.querySelector('.world-next').href=index<5?'#'+chapters[index+1].id:'#engineering-proof';
    door.setAttribute('aria-pressed','true');door.querySelector('span').textContent='Doors open';door.title='Close cabinet doors';
    if(stages){document.getElementById('world-anchor-label').textContent=stages[index].annotation;document.getElementById('world-note-copy').textContent=stages[index].detail;}
    if(journey.dataset.renderer!=='ready')updatePoster(index);
    showInfo(false);
  }
  function measure() {scrollPositions=chapters.map(el=>el.getBoundingClientRect().top+scrollY-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header')));schedule();}
  function update() {
    frame=0;
    if(!scrollPositions.length)return;
    const bounds=journey.getBoundingClientRect();
    journey.classList.toggle('is-present',bounds.bottom>=innerHeight-2&&bounds.top<innerHeight);
    let index=0;
    for(let i=0;i<scrollPositions.length;i++)if(scrollY>=scrollPositions[i]-2)index=i;
    const length=(scrollPositions[index+1]||scrollPositions[index]+chapters[index].offsetHeight)-scrollPositions[index];
    const fraction=Math.max(0,Math.min(1,(scrollY-scrollPositions[index])/length));
    const transition=Math.max(0,Math.min(1,(fraction-.35)/.55));
    const progress=Math.min(5,index+transition);
    select(transition>.6?Math.min(5,index+1):index);
    engine?.setProgress(motion.matches?active:progress,motion.matches);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',measure,{passive:true});
  document.fonts.ready.then(measure);
  function project(point) {
    if(!point||!point.stable||lost){anchor.hidden=true;return;}
    const h=mount.clientHeight,w=mount.clientWidth;
    const room=w<700?160:235;
    const fits=point.x>10&&point.x<w-15&&point.y>Math.min(270,h*.38)&&point.y<h-170;
    anchor.hidden=!fits;
    if(fits){anchor.classList.toggle('is-left',point.x>w-room);anchor.style.left=point.x+'px';anchor.style.top=point.y+'px';}
  }
  function fallback() {
    lost=true;journey.dataset.renderer='fallback';updatePoster(Math.max(0,active));
    document.querySelector('.world-status').textContent='SCHEMATIC / RENDERED VIEW';
    anchor.hidden=true;
  }
  mount.addEventListener('world-restored',()=>{lost=false;journey.dataset.renderer='ready';document.querySelector('.world-status').textContent='SCHEMATIC 3D / FINAL ASSETS PENDING';schedule();});
  const observer=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;engine?.setVisible(visible&&!document.hidden&&!lost);
  },{threshold:0});
  observer.observe(journey);
  document.addEventListener('visibilitychange',()=>engine?.setVisible(visible&&!document.hidden&&!lost));
  motion.addEventListener('change',()=>{engine?.setReduced(motion.matches);schedule();});
  async function boot() {
    try {
      const [data,scene]=await Promise.all([import('./stages.js'),import('./world-scene.js')]);
      stages=data.stages;
      engine=await scene.createWorld(mount,{reduced:motion.matches,onProject:project,onLost:fallback,onPart:part});
      journey.dataset.renderer='ready';lost=false;active=-1;measure();update();
      // Review hooks generate fallback assets from these exact scene states.
      mount.captureWorld=()=>engine.capture();
      mount.setReviewStage=index=>{engine.setProgress(index,true);select(index);};
    } catch {fallback();}
  }
  measure();boot();
})();
