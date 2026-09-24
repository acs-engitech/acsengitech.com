(() => {
  'use strict';
  document.documentElement.classList.add('has-js');


  const journey = document.getElementById('acs-world');
  const mount = document.getElementById('world-canvas');
  const chapters = [...document.querySelectorAll('[data-world-chapter]')];
  const links = [...document.querySelectorAll('.world-chapters a')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const anchor = document.getElementById('world-anchor');
  const note = document.getElementById('world-note');
  const info = document.getElementById('world-info');
  const poster = document.getElementById('world-poster');
  const compact=matchMedia('(max-width:999px)');
  const scope=document.createElement('dialog');scope.id='world-scope';scope.setAttribute('aria-labelledby','world-scope-title');
  scope.innerHTML='<button class="scope-close icon-button" aria-label="Close engineering scope" title="Close engineering scope"><i class="ri-close-line" aria-hidden="true"></i></button><h2 id="world-scope-title"></h2><div class="scope-body"></div>';
  document.body.append(scope);
  scope.querySelector('button').addEventListener('click',()=>scope.close());
  scope.addEventListener('click',e=>{if(e.target===scope)scope.close();});
  const mobileLead={installation:'From engineering to on-site commissioning.',contact:'Start a conversation with ACS engineering.'};
  chapters.forEach(chapter=>{
    const copy=chapter.querySelector('.scene-description,.deployment-copy');if(!copy)return;
    const paragraphs=[...copy.querySelectorAll(':scope > p')];
    paragraphs.forEach(p=>p.classList.add('scope-copy'));
    const lead=paragraphs[0]?.querySelector('strong')?.textContent||mobileLead[chapter.id];
    if(lead){const p=document.createElement('p');p.className='mobile-story-lead';p.textContent=lead;copy.prepend(p);}
    const button=document.createElement('button');button.className='mobile-scope';button.type='button';button.innerHTML='View scope <i class="ri-add-line" aria-hidden="true"></i>';
    button.addEventListener('click',()=>{
      scope.querySelector('h2').textContent=chapter.querySelector('h1,h2').innerText.replace(/\n/g,' ');
      scope.querySelector('.scope-body').replaceChildren(...paragraphs.map(p=>p.cloneNode(true)));
      scope.showModal();
    });
    copy.append(button);
  });
  const jump=document.createElement('select');jump.id='world-jump';jump.setAttribute('aria-label','Choose a journey chapter');
  chapters.forEach((chapter,i)=>{const option=document.createElement('option');option.value=chapter.id;option.textContent=String(i+1).padStart(2,'0')+' / '+links[i].textContent.replace(/^\s*\d+\s*/,'');jump.append(option);});
  document.querySelector('.world-bottom').prepend(jump);
  jump.addEventListener('change',()=>document.getElementById(jump.value).scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'}));
  const record=document.querySelector('.trust-record');
  const standards=document.createElement('details');standards.className='mobile-standards';
  standards.innerHTML='<summary>Standards &amp; certifications <i class="ri-add-line" aria-hidden="true"></i></summary>';
  for(const a of record.querySelectorAll(':scope > a'))standards.append(a.cloneNode(true));
  record.append(standards);
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
    jump.value=chapters[index].id;
    chapters.forEach((chapter,i)=>{chapter.classList.toggle('is-active',i===index);chapter.querySelector('.scene-content').inert=i!==index;});
    links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
    document.getElementById('world-coordinate').textContent=String(index).padStart(2,'0')+' / '+(stages?.[index].label||chapters[index].id).toUpperCase();
    document.querySelector('.world-inspection').hidden=index!==2;
    document.querySelector('.world-software').hidden=index!==4;
    document.querySelector('.world-next').href=index<chapters.length-1?'#'+chapters[index+1].id:'#main';
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
    const transition=Math.max(0,Math.min(1,(fraction-.55)/.45));
    const eased=transition*transition*(3-2*transition);
    const progress=Math.min(chapters.length-1,index+eased);
    journey.style.setProperty('--journey-progress',String(progress/(chapters.length-1)));
    if(!engine||lost||motion.matches)select(Math.round(progress));
    engine?.setProgress(motion.matches?Math.round(progress):progress,motion.matches);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',measure,{passive:true});
  document.fonts.ready.then(measure);
  function project(point) {
    if(point){select(point.index);journey.style.setProperty('--copy-opacity',String(motion.matches||compact.matches?1:point.copyOpacity));}
    if(!point||!point.stable||lost){anchor.hidden=true;return;}
    const h=mount.clientHeight,w=mount.clientWidth;
    const room=w<700?160:235;
    const fits=point.x>10&&point.x<w-15&&point.y>Math.min(290,h*.4)&&point.y<h-(w<700?290:180)&&active<5;
    anchor.hidden=!fits;
    if(fits){anchor.classList.toggle('is-left',point.x>w-room);anchor.style.left=point.x+'px';anchor.style.top=point.y+'px';}
  }
  function fallback() {
    lost=true;journey.dataset.renderer='fallback';updatePoster(Math.max(0,active));
    journey.style.setProperty('--copy-opacity','1');
    document.querySelector('.world-status').textContent='Schematic / rendered view';
    anchor.hidden=true;
  }
  mount.addEventListener('world-restored',()=>{lost=false;journey.dataset.renderer='ready';document.querySelector('.world-status').textContent='Schematic engineering study';schedule();});
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
