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
  const mobileLead={panel:'Designed in EPLAN. Built and tested in our 36,000 sq. ft. facility.',contact:'Start a conversation with ACS engineering.'};
  chapters.forEach(chapter=>{
    const copy=chapter.querySelector('.scene-description,.deployment-copy');if(!copy)return;
    const paragraphs=[...copy.querySelectorAll(':scope > p')];
    paragraphs.forEach(p=>p.classList.add('scope-copy'));
    const lead=mobileLead[chapter.id]||paragraphs[0]?.querySelector('strong')?.textContent;
    if(lead){const p=document.createElement('p');p.className='mobile-story-lead';p.textContent=lead;copy.prepend(p);}
    const button=document.createElement('button');button.className='mobile-scope';button.type='button';button.innerHTML='View scope <i class="ri-add-line" aria-hidden="true"></i>';
    button.addEventListener('click',()=>{
      scope.querySelector('h2').textContent=chapter.querySelector('h1,h2').innerText.replace(/\n/g,' ');
      scope.querySelector('.scope-body').replaceChildren(...paragraphs.map(p=>p.cloneNode(true)));
      const index=chapter.querySelector('.component-index');
      if(index)scope.querySelector('.scope-body').append(index.cloneNode(true));
      const evidence=chapter.querySelector('.drawing-evidence,.drawing-reference');
      if(evidence){const copy=evidence.cloneNode(true);copy.className='scope-evidence';scope.querySelector('.scope-body').append(copy);}
      scope.showModal();
    });
    copy.append(button);
  });
  const jump=document.createElement('select');jump.id='world-jump';jump.setAttribute('aria-label','Choose a journey chapter');
  chapters.forEach((chapter,i)=>{const option=document.createElement('option');option.value=chapter.id;option.textContent=String(i).padStart(2,'0')+' / '+links[i].lastChild.textContent.trim();jump.append(option);});
  document.querySelector('.world-bottom').prepend(jump);
  jump.addEventListener('change',()=>document.getElementById(jump.value).scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'}));
  const record=document.querySelector('.trust-record');
  const standards=document.createElement('details');standards.className='mobile-standards';
  standards.innerHTML='<summary>Standards &amp; certifications <i class="ri-add-line" aria-hidden="true"></i></summary>';
  for(const a of record.querySelectorAll(':scope > a'))standards.append(a.cloneNode(true));
  record.append(standards);
  let engine, stages, calloutList = [], active = -1, frame = 0, scrollPositions = [], visible = true, lost = false;
  const inspection=document.querySelector('.world-inspection');
  const door=document.getElementById('world-door');
  const calloutLayer=document.querySelector('.world-callouts');
  const unannotated=['inside','experience','capabilities','contact'];
  function setDoorButton(open) {
    door.setAttribute('aria-pressed',String(open));
    door.title=open?'Close panel doors':'Open panel doors';door.setAttribute('aria-label',door.title);
    door.querySelector('i').className=open?'ri-door-open-line':'ri-door-closed-line';
    door.querySelector('span').textContent=open?'Close doors':'Open doors';
  }
  function showInfo(open) {note.hidden=!open;info.setAttribute('aria-expanded',String(open));}
  info.addEventListener('click',()=>showInfo(note.hidden));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')showInfo(false);});
  mount.addEventListener('world-model-loaded',event=>{if(event.detail.id==='panel')door.hidden=!event.detail.doorsReady;});
  door.addEventListener('click',()=>{
    const open=door.getAttribute('aria-pressed')!=='true';
    engine?.setDoor(open);setDoorButton(open);
  });
  for(const [id,direction] of [['world-left',-1],['world-right',1]])document.getElementById(id).addEventListener('click',()=>engine?.rotate(direction));
  document.getElementById('world-reset').addEventListener('click',()=>{
    engine?.reset();setDoorButton(Boolean(stages?.[active]?.doorOpen));
  });
  function buildCallouts(list) {
    calloutList=list;
    calloutLayer.replaceChildren(...list.map((item,i)=>{
      const node=document.createElement('div');node.className='callout is-'+item.side;
      node.innerHTML='<i class="callout-dot">'+(i+1)+'</i><span class="callout-line"></span><span class="callout-label"><b>'+String(i+1).padStart(2,'0')+'</b><strong></strong><small></small></span>';
      node.querySelector('strong').textContent=item.label;node.querySelector('small').textContent=item.note;
      return node;
    }));
  }
  function placeCallouts(state) {
    if(!state||lost){calloutLayer.hidden=true;return;}
    calloutLayer.hidden=false;calloutLayer.style.opacity=String(state.opacity);
    const gap=mount.clientWidth<1000?0:Math.max(40,(state.box.right-state.box.left)*.12);
    [...calloutLayer.children].forEach((node,i)=>{
      const point=state.points[i],left=calloutList[i].side==='left';
      const edge=left?state.box.left-gap:state.box.right+gap;
      node.style.setProperty('--x',point.x+'px');node.style.setProperty('--y',point.y+'px');
      node.style.setProperty('--from',Math.min(point.x,edge)+'px');node.style.setProperty('--len',Math.abs(edge-point.x)+'px');
      node.style.setProperty('--edge',edge+'px');
    });
  }
  function updatePoster(index) {
    const id=chapters[index].id;
    const base='assets/home-journey/media/world-'+id;
    document.getElementById('world-poster-mobile').srcset=base+'-mobile.png';
    poster.src=base+'-desktop.png';poster.alt='Rendered 3D scene: '+(stages?.[index].label||id);
  }
  function select(index) {
    if(index===active)return;
    active=index;journey.dataset.stage=chapters[index].id;
    jump.value=chapters[index].id;
    chapters.forEach((chapter,i)=>{chapter.classList.toggle('is-active',i===index);chapter.querySelector('.scene-content').inert=i!==index;});
    links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
    document.getElementById('world-coordinate').textContent=String(index).padStart(2,'0')+' / '+(stages?.[index].label||chapters[index].id).toUpperCase();
    inspection.hidden=!['panel','inside'].includes(chapters[index].id);
    document.querySelector('.world-next').href=index<chapters.length-1?'#'+chapters[index+1].id:'#main';
    setDoorButton(Boolean(stages?.[index]?.doorOpen));
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
    const fits=point.x>10&&point.x<w-15&&point.y>Math.min(290,h*.4)&&point.y<h-(w<700?290:180)&&!unannotated.includes(chapters[active].id);
    anchor.hidden=!fits;
    if(fits){anchor.classList.toggle('is-left',point.x>w-room);anchor.style.left=point.x+'px';anchor.style.top=point.y+'px';}
  }
  function fallback() {
    lost=true;journey.dataset.renderer='fallback';updatePoster(Math.max(0,active));
    journey.style.setProperty('--copy-opacity','1');
    document.querySelector('.world-status').textContent='Rendered view';
    anchor.hidden=true;calloutLayer.hidden=true;
  }
  mount.addEventListener('world-restored',()=>{lost=false;journey.dataset.renderer='ready';document.querySelector('.world-status').textContent='Illustrative 3D factory';schedule();});
  const observer=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;engine?.setVisible(visible&&!document.hidden&&!lost);
  },{threshold:0});
  observer.observe(journey);
  document.addEventListener('visibilitychange',()=>engine?.setVisible(visible&&!document.hidden&&!lost));
  motion.addEventListener('change',()=>{engine?.setReduced(motion.matches);schedule();});
  async function boot() {
    try {
      const [data,scene]=await Promise.all([import('./stages.js'),import('./world-scene.js')]);
      stages=data.stages;buildCallouts(data.callouts);
      engine=await scene.createWorld(mount,{reduced:motion.matches,onProject:project,onCallouts:placeCallouts,onLost:fallback});
      journey.dataset.renderer='ready';lost=false;active=-1;measure();update();
      // Review hooks generate fallback assets from these exact scene states.
      mount.captureWorld=()=>engine.capture();
      mount.setReviewStage=index=>{engine.setProgress(index,true);select(index);};
    } catch {fallback();}
  }
  measure();boot();
})();
