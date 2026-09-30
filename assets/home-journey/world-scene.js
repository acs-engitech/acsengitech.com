import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { modelSlots, stages } from './stages.js';

const v = a => new THREE.Vector3(...a);
const paper = 0xf2f5f4;

export async function createWorld(mount, { onProject, onLost, onPart, reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Interactive schematic ACS control-system installation');
  renderer.domElement.setAttribute('role', 'img');
  mount.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(paper);
  scene.fog = new THREE.Fog(paper, 24, 65);
  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, .1, 100);
  const world = new THREE.Group(); scene.add(world);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x84979e, 1.15));
  const sun = new THREE.DirectionalLight(0xfffaf0, 3.2);
  sun.position.set(-6, 12, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: .5, far: 35 });
  sun.shadow.normalBias = .025; sun.shadow.bias = -.0002; sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdcefff, .9); fill.position.set(8, 5, -6); scene.add(fill);

  // A studio reflection environment gives schematic sheet metal depth without image assets.
  const studio = new THREE.Scene(); studio.background = new THREE.Color(0xc8d2d5);
  for (const [position, scale, intensity] of [[[-5, 7, 4],[5,9,1],4],[[5,3,-2],[3,7,1],2],[[0,9,0],[8,1,6],3]]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(...scale), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(intensity) }));
    light.position.copy(v(position)); studio.add(light);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, .08); scene.environment = environment.texture;
  pmrem.dispose(); studio.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  const materials = {
    shell: new THREE.MeshStandardMaterial({ color: 0x9eafb8, metalness: .62, roughness: .3 }),
    face: new THREE.MeshStandardMaterial({ color: 0xc8d3d8, metalness: .48, roughness: .34 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x889a9f, metalness: .78, roughness: .26 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x263738, metalness: .42, roughness: .4 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x7c8c90, metalness: .2, roughness: .65 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x006bb1, metalness: .25, roughness: .32 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x228b85, metalness: .2, roughness: .35 }),
    base: new THREE.MeshStandardMaterial({ color: 0xe0e6e5, metalness: .12, roughness: .8 }),
    floor: new THREE.MeshStandardMaterial({ color: paper, roughness: .95, metalness: .03 })
  };
  function block(parent, size, at, material = 'shell', bevel = .012) {
    const [w,h,d] = size;
    const b = Math.min(bevel, w/6, h/6, d/6);
    const shape = new THREE.Shape();
    shape.moveTo(-w/2+b,-h/2+b); shape.lineTo(w/2-b,-h/2+b);
    shape.lineTo(w/2-b,h/2-b); shape.lineTo(-w/2+b,h/2-b); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,steps:1,curveSegments:1});
    geo.translate(0,0,-d/2+b);
    const mesh = new THREE.Mesh(geo, materials[material]); mesh.position.copy(v(at));
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function path(parent, points, material='blue', radius=.013) {
    const curve = new THREE.CatmullRomCurve3(points.map(v),false,'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve,48,radius,8,false),materials[material]);
    mesh.userData.curve=curve;
    parent.add(mesh); return mesh;
  }
  function line(parent, points, color=0x9eafb3) {
    const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(v)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.55}));
    parent.add(mesh); return mesh;
  }
  function label(parent, text, width, at, floor=false) {
    const c = document.createElement('canvas'); c.width=768; c.height=96;
    const ctx=c.getContext('2d'); ctx.fillStyle='#34535c'; ctx.font='500 32px Arial'; ctx.textAlign='center'; ctx.fillText(text,384,58);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    mesh.position.copy(v(at)); if(floor)mesh.rotation.x=-Math.PI/2; parent.add(mesh); return mesh;
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200),materials.floor);
  ground.rotation.x=-Math.PI/2; ground.position.y=-.16; ground.receiveShadow=true; scene.add(ground);
  const actors={};
  for(const [id,slot] of Object.entries(modelSlots)){const g=new THREE.Group();g.position.copy(v(slot.position));g.userData.slot=id;world.add(g);actors[id]=g;}
  const base=actors.installation;
  // The floor is continuous beyond the actors, not a product display plinth.
  for(let x=-24;x<=24;x+=2) line(base,[[x,-.14,-24],[x,-.14,24]],0xd7e0e2).material.opacity=.18;
  for(let z=-24;z<=24;z+=2) line(base,[[-24,-.14,z],[24,-.14,z]],0xd7e0e2).material.opacity=.18;
  for(const x of [-7,7]){
    line(base,[[x,-.13,-18],[x,-.13,16]],0x9cb7c4);
    for(let z=-14;z<=12;z+=1)line(base,[[x,-.13,z],[x+.15,-.13,z]],0x9cb7c4);
  }
  for(const [id,slot] of Object.entries(modelSlots)) if(id!=='installation') {
    const [x,,z]=slot.position, [w,,d]=slot.size;
    line(base,[[x-w/2-.15,-.01,z-d/2-.15],[x+w/2+.15,-.01,z-d/2-.15],[x+w/2+.15,-.01,z+d/2+.15],[x-w/2-.15,-.01,z+d/2+.15],[x-w/2-.15,-.01,z-d/2-.15]],0x8ba6ae);
  }
  // Incoming paths converge on a single control boundary, then continue to execution.
  const incoming=new THREE.Group();world.add(incoming);
  for(let i=0;i<7;i++){
    const z=1.5+i*.32;
    path(incoming,[[-14,.005,z+4],[-8,.005,z+4],[-5,.005,z],[-2.2,.005,z],[.35+i*.06,.005,1.2],[.35+i*.06,.28,.45]],i===3?'blue':'steel',i===3?.017:.006);
  }
  const boundary=new THREE.Group();world.add(boundary);
  for(const z of [-3.5,3.5])line(boundary,[[-10,-.08,z],[10,-.08,z]],0xa4bdc8);
  for(const x of [-10,10])line(boundary,[[x,-.08,-3.5],[x,-.08,3.5]],0xa4bdc8);
  const drawing=new THREE.Group();world.add(drawing);
  for(const x of [-1.7,1.7]){
    line(drawing,[[x,.1,-.75],[x,3.6,-.75]],0x6795ab);
    for(const y of [.1,3.6])line(drawing,[[x-.12,y,-.75],[x+.12,y,-.75]],0x6795ab);
  }
  line(drawing,[[-1.7,3.6,-.75],[1.7,3.6,-.75]],0x6795ab);
  // Generic process roles, never a claimed factory layout or equipment specification.
  const process=actors.process;
  function cylinder(parent,radius,length,at,material='steel',axis='y') {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,32),materials[material]);
    mesh.position.copy(v(at));if(axis==='x')mesh.rotation.z=Math.PI/2;
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  for(const x of [-1.45,.5]){
    for(const dx of [-.4,.4])for(const z of [-.35,.35])block(process,[.06,.65,.06],[x+dx,.4,z],'steel');
    cylinder(process,.66,1.65,[x,1.45,0],'face');
    for(const y of [.65,2.24])cylinder(process,.69,.06,[x,y,0],'steel');
    const lid=new THREE.Mesh(new THREE.SphereGeometry(.66,32,16,0,Math.PI*2,0,Math.PI/2),materials.face);
    lid.scale.y=.35;lid.position.set(x,2.27,0);lid.castShadow=true;process.add(lid);
    cylinder(process,.075,.3,[x,2.62,0],'steel');
    block(process,[.22,.18,.18],[x,2.84,0],'blue');
    path(process,[[x,.9,.64],[x,.9,.94],[x,.4,1.05]],'steel',.055);
  }
  block(process,[5.1,.12,2.5],[0,.04,.15],'base');
  block(process,[1.12,.15,.72],[1.9,.2,.63],'dark');
  cylinder(process,.26,.72,[1.83,.54,.63],'steel','x');
  for(let i=0;i<6;i++)cylinder(process,.28,.025,[1.6+i*.08,.54,.63],'shell','x');
  block(process,[.23,.16,.24],[1.85,.85,.63],'face');
  path(process,[[-1.45,.4,1.05],[-.7,.4,1.05],[.5,.4,1.05],[1.3,.4,.63],[1.5,.54,.63]],'blue',.045);
  path(process,[[2.2,.54,.63],[2.48,.54,.63],[2.48,1.65,-.6],[.5,1.65,-.65]],'steel',.045);
  cylinder(process,.14,.13,[-.4,.4,1.05],'dark','x');
  cylinder(process,.035,.22,[-.4,.55,1.05],'steel');
  block(process,[.36,.035,.075],[-.4,.68,1.05],'blue');
  block(process,[.08,1.7,.08],[2.05,.93,-.65],'steel');
  block(process,[.72,.46,.12],[2.05,1.95,-.65],'dark');
  block(process,[.61,.35,.015],[2.05,1.95,-.579],'face');
  label(process,'PROCESS / FLOW + MOTORS + SIGNALS',3.8,[0,.115,1.31],true);
  const cabinet=actors.cabinet;
  block(cabinet,[2.94,.19,1.14],[0,.1,0],'dark');
  block(cabinet,[2.87,3.24,.075],[0,1.84,-.5],'shell');
  for(const x of [-1.43,1.43])block(cabinet,[.075,3.24,1.05],[x,1.84,0],'shell');
  for(const y of [.24,3.47])block(cabinet,[2.9,.075,1.05],[0,y,0],'face');
  block(cabinet,[2.68,3.02,.06],[0,1.84,-.39],'face');
  block(cabinet,[.065,3.15,.08],[0,1.84,.5],'steel');
  const inspectionParts=[];
  for(const [name,y,h,color] of [['control',2.78,.52,'dark'],['connections',1.85,.28,'steel'],['routing',.95,.72,'recess']]) {
    const zone=new THREE.Group(); zone.userData.part=name; cabinet.add(zone);
    for(const x of [-.7,.7]) {
      block(zone,[1.09,.055,.05],[x,y-h/2-.055,-.24],'steel');
      if(name==='routing') {
        for(const dx of [-.42,.42])block(zone,[.105,h+.3,.16],[x+dx,y,-.15],'face');
        path(zone,[[x,y+.45,-.04],[x,y+.2,.05],[x,y-.35,.05],[x,.32,.02]],'blue',.012);
      } else {
        const body=block(zone,[1.03,h,.22],[x,y,-.08],color);
        inspectionParts.push(body);
        for(let i=0;i<5;i++)block(zone,[.012,h-.05,.012],[x-.4+i*.2,y,.04],'recess',.002);
      }
    }
  }
  const doors=[];
  for(const side of [-1,1]) {
    const door=new THREE.Group();door.position.set(side*1.43,1.84,.56);cabinet.add(door);
    block(door,[1.405,3.15,.075],[-side*.702,0,0],'face');
    block(door,[1.31,3.06,.016],[-side*.702,0,-.053],'recess',.003);
    block(door,[.035,.31,.055],[-side*1.22,-.15,.068],'dark',.008);
    for(const y of [-1.2,0,1.2])block(door,[.05,.12,.09],[0,y,0],'steel');
    doors.push({door,side});
  }
  label(cabinet,'ACS / CONTROL',1,[.55,3.26,.62]);
  const field=actors.field;
  block(field,[.85,.12,.65],[0,.06,0],'dark');
  block(field,[.76,.96,.57],[0,.68,0],'shell');
  block(field,[.66,.85,.045],[0,.69,.31],'face');
  block(field,[.045,.15,.05],[.24,.65,.35],'steel');
  block(field,[.6,.07,.46],[0,1.19,0],'steel');
  for(const x of [-.2,0,.2])block(field,[.055,.13,.07],[x,.19,.13],'dark');
  label(field,'INPUT',.5,[0,.98,.337]);
  const power=actors.power;
  block(power,[3.76,.17,1],[0,.09,0],'dark');
  for(let i=0;i<4;i++) {
    const x=(i-1.5)*.93;
    block(power,[.92,2.55,.86],[x,1.45,0],'shell');
    block(power,[.84,2.4,.06],[x,1.45,.465],'face');
    block(power,[.035,.23,.04],[x+.31,1.4,.516],'dark');
    block(power,[.56,.15,.025],[x,2.41,.504],'recess');
    for(let j=0;j<5;j++)block(power,[.59,.016,.018],[x,.42+j*.055,.51],'steel',.002);
  }
  label(power,'POWER / MCC + VFD',1.8,[0,2.68,.51]);
  const data=actors.data;
  block(data,[1.5,.07,.65],[0,.04,0],'steel');
  for(const x of [-.95,.95])block(data,[.045,1.05,.07],[x,.58,0],'steel');
  block(data,[2.95,1.52,.11],[0,1.85,0],'dark');
  block(data,[2.84,1.41,.015],[0,1.85,.069],'steel');
  const screenMaterial=new THREE.MeshBasicMaterial({color:0xe3eeea});
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.75,1.316),screenMaterial);screen.position.set(0,1.85,.082);data.add(screen);
  label(data,'ACS / DATA & MONITORING',1.8,[0,2.73,.08]);
  const textureLoader=new THREE.TextureLoader();
  const textures={}; let software='ems', alive=true;
  async function setSoftware(name) {
    software=name;
    try {
      if(!textures[name]) { textures[name]=await textureLoader.loadAsync(new URL(`./media/${name}.jpg`,import.meta.url).href);textures[name].colorSpace=THREE.SRGBColorSpace;textures[name].anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy()); }
      if(!alive)return;
      if(software===name){screenMaterial.map=textures[name];screenMaterial.color.set(0xffffff);screenMaterial.needsUpdate=true;invalidate();}
    } catch { mount.dataset.texture='unavailable'; }
  }
  const routes=[
    path(world,[[3.2,.025,2.35],[3.2,.025,2.6],[1.9,.025,2.6],[.7,.025,1.3],[.7,.025,.4]],'blue',.014),
    path(world,[[-.7,.025,.4],[-.7,.025,1.3],[-3,.025,1.3],[-4.1,.025,.2],[-4.1,.025,-1]],'blue',.014),
    path(world,[[.9,.025,-.4],[1.6,.025,-1],[2.8,.025,-2.1],[4.2,.025,-2.1]],'teal',.014)
  ];
  routes.push(path(world,[[-4.1,.1,-1],[-5,.025,.2],[-5,.025,2],[-3.9,.025,4.63],[-3.9,.4,4.63]],'blue',.016));
  routes.push(path(world,[[-5.3,2.84,4],[-5.3,2.84,3.4],[-3.4,.035,3],[1.5,.035,3],[3.2,.035,2.1]],'teal',.012));
  path(data,[[0,.035,0],[0,.65,-.1],[0,1.15,0]],'teal',.015);
  const terminals=[];
  for(const [id,slot] of Object.entries(modelSlots))if(id!=='installation'){
    const node=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.026,16),materials.blue);
    node.position.set(slot.position[0],.018,slot.position[2]);world.add(node);terminals.push(node);
  }
  routes.forEach(route=>{route.material=route.material.clone();});
  const trace=new THREE.Mesh(new THREE.BoxGeometry(.085,.085,.085),new THREE.MeshStandardMaterial({color:0x0076bf,emissive:0x005991,emissiveIntensity:.5,roughness:.3}));
  world.add(trace);
  const surfaces={};
  function collectSurfaces(id){
    surfaces[id]=[];
    actors[id].traverse(object=>{
      if(!object.isMesh)return;
      if(object.material!==screenMaterial)object.material=object.material.clone();
      surfaces[id].push({object,material:object.material,transparent:object.material.transparent,depthWrite:object.material.depthWrite});
    });
  }
  Object.keys(actors).filter(id=>id!=='installation').forEach(collectSurfaces);
  const orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enablePan=false;orbit.enableZoom=false;orbit.enableDamping=false;orbit.rotateSpeed=.35;
  orbit.minPolarAngle=.3;orbit.maxPolarAngle=1.5;
  orbit.addEventListener('change',()=>invalidate());
  let progress=0,desired=0,frame=0,visible=true,forceCamera=true,width=1,height=1,doorOverride=null,inspected=null,lastTime=0;
  const partAnchors={control:[0,2.78,.1],connections:[0,1.85,.1],routing:[.7,.95,.1]};
  const raycaster=new THREE.Raycaster();let pointerStart;
  renderer.domElement.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY];});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>6||!stages[Math.round(progress)].inspection)return;
    const rect=renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=raycaster.intersectObjects(cabinet.children,true)[0];
    let object=hit?.object;
    while(object&&object!==cabinet){if(object.userData.part){onPart?.(object.userData.part);return;}object=object.parent;}
  });
  function resize(){const r=mount.getBoundingClientRect();width=r.width;height=r.height;if(!width||!height)return;renderer.setSize(width,height);orbit.enabled=matchMedia('(pointer:fine)').matches;renderer.domElement.style.touchAction=orbit.enabled?'pan-y':'pan-y';forceCamera=true;invalidate();}
  const observer=new ResizeObserver(resize);observer.observe(mount);
  function configureCamera(){
    const a=Math.floor(progress),b=Math.min(stages.length-1,a+1),t=progress-a;
    const A=stages[a],B=stages[b];
    const narrow=width<1000,aspect=width/height;
    const target=v(narrow?(A.mobileTarget||A.target):A.target).lerp(v(narrow?(B.mobileTarget||B.target):B.target),t),offset=v(A.offset).lerp(v(B.offset),t);
    let view=THREE.MathUtils.lerp(A.height,B.height,t);
    if(narrow)view=Math.max(9,view,THREE.MathUtils.lerp(A.mobileWidth,B.mobileWidth,t)/aspect);
    const horizontal=narrow?0:THREE.MathUtils.lerp(A.placement[0],B.placement[0],t);
    const shift=view*(narrow?THREE.MathUtils.lerp(A.mobileY??-.015,B.mobileY??-.015,t):THREE.MathUtils.lerp(A.placement[1],B.placement[1],t));
    camera.left=-view*aspect/2-horizontal*view*aspect;camera.right=view*aspect/2-horizontal*view*aspect;camera.top=view/2+shift;camera.bottom=-view/2+shift;
    camera.position.copy(target).add(offset);orbit.target.copy(target);camera.lookAt(target);camera.updateProjectionMatrix();orbit.update();
  }
  function invalidate(){if(alive&&visible&&!frame)frame=requestAnimationFrame(render);}
  function render(time=performance.now()){
    frame=0;if(!alive||!visible)return;
    const delta=desired-progress;
    const elapsed=Math.min(64,lastTime?time-lastTime:16);lastTime=time;
    if(Math.abs(delta)>.001){progress=reduced?desired:progress+delta*(1-Math.exp(-elapsed/85));forceCamera=true;}
    else if(progress!==desired){progress=desired;forceCamera=true;}
    if(forceCamera){configureCamera();forceCamera=false;}
    const a=Math.floor(progress),b=Math.min(stages.length-1,a+1),mix=progress-a;
    const activeStage=stages[Math.round(progress)];
    const open=doorOverride??THREE.MathUtils.lerp(stages[a].doorOpen||0,stages[b].doorOpen||0,mix);
    doors.forEach(({door,side,baseRotation=0})=>door.rotation.y=baseRotation+side*(.14+open*1.95));
    routes.forEach(route=>{route.material.emissive.setHex(activeStage.software?0x063a55:0x000000);route.material.emissiveIntensity=.16;});
    // Reveal roles progressively. Hidden actors retain their world-space footprints.
    for(const [id,items] of Object.entries(surfaces)){
      const emphasis=index=>stages[index].actors.includes(id)?1:0;
      const opacity=width<1000?emphasis(Math.round(progress)):THREE.MathUtils.lerp(emphasis(a),emphasis(b),mix);
      actors[id].visible=opacity>.005;
      for(const item of items){
        item.material.opacity=opacity;
        const transparent=item.transparent||opacity<.99;
        if(item.material.transparent!==transparent){item.material.transparent=transparent;item.material.needsUpdate=true;}
        item.material.depthWrite=opacity>.99&&item.depthWrite;
        item.object.castShadow=opacity>.9;
      }
    }
    drawing.visible=Boolean(activeStage.drawing);
    incoming.visible=activeStage.id!=='arrival';
    routes.forEach((route,i)=>{route.visible=i<activeStage.routes;});
    terminals.forEach((node,i)=>{node.visible=activeStage.actors.includes(Object.keys(modelSlots).filter(id=>id!=='installation')[i]);});
    const traceRoute=routes.find(route=>route.visible)||incoming.children[3];
    trace.position.copy(traceRoute.userData.curve.getPointAt(progress-Math.floor(progress)));
    trace.position.y+=.06;trace.visible=activeStage.routes>0&&Math.abs(desired-progress)>.002&&!reduced;
    renderer.render(scene,camera);
    const index=Math.round(progress),point=v(activeStage.inspection&&inspected?partAnchors[inspected]:stages[index].anchor).project(camera);
    const distance=Math.abs(progress-index);
    onProject?.({x:(point.x+1)*width/2,y:(1-point.y)*height/2,index,stable:distance<.15,copyOpacity:1-THREE.MathUtils.smoothstep(distance,.08,.38)});
    if(Math.abs(desired-progress)>.001)invalidate();
  }
  function lost(e){e.preventDefault();visible=false;cancelAnimationFrame(frame);frame=0;onLost?.();}
  renderer.domElement.addEventListener('webglcontextlost',lost);
  renderer.domElement.addEventListener('webglcontextrestored',()=>{visible=true;forceCamera=true;invalidate();mount.dispatchEvent(new CustomEvent('world-restored'));});
  const retired=[];
  for(const [id,slot] of Object.entries(modelSlots))if(slot.modelUrl){
    import('three/addons/loaders/GLTFLoader.js').then(async({GLTFLoader})=>{
      const asset=await new GLTFLoader().loadAsync(new URL(slot.modelUrl,import.meta.url).href);
      if(!alive)return;
      const bounds=new THREE.Box3().setFromObject(asset.scene),size=bounds.getSize(new THREE.Vector3());
      if(bounds.isEmpty())throw new Error('Empty model');
      const scale=Math.min(...slot.size.map((n,i)=>n/Math.max(size.getComponent(i),.001)));
      const center=bounds.getCenter(new THREE.Vector3());
      asset.scene.scale.setScalar(scale);asset.scene.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      const host=actors[id];retired.push(...host.children);host.clear();host.add(asset.scene);
      if(id!=='installation')collectSurfaces(id);
      if(id==='cabinet'){
        doors.length=0;
        for(const [name,side] of [['ACS_Door_Left',-1],['ACS_Door_Right',1]]){
          const door=asset.scene.getObjectByName(name);if(door)doors.push({door,side,baseRotation:door.rotation.y});
        }
        for(const [name,part] of [['ACS_Control','control'],['ACS_Connections','connections'],['ACS_Routing','routing']]){
          const group=asset.scene.getObjectByName(name);if(group)group.userData.part=part;
        }
        mount.dispatchEvent(new CustomEvent('world-model-loaded',{detail:{id,doorsReady:doors.length>0}}));
      }
      invalidate();
    }).catch(()=>{mount.dataset.modelFallback='schematic';});
  }
  resize();setSoftware('ems');invalidate();
  return {
    setProgress(value,instant=false){const next=THREE.MathUtils.clamp(value,0,stages.length-1);if(next!==desired)doorOverride=null;desired=next;if(instant||reduced){progress=desired;forceCamera=true;}invalidate();},
    setReduced(value){reduced=value;if(value){progress=desired;forceCamera=true;}invalidate();},
    setDoor(open){doorOverride=open?1:0;invalidate();},
    inspect(name){
      inspected=name;
      cabinet.traverse(group=>{if(group.userData.part)group.traverse(object=>{if(object.isMesh&&object.material.emissive){object.material.emissive.setHex(group.userData.part===name?0x087aae:0x000000);object.material.emissiveIntensity=.28;}});});
      invalidate();
    },
    setSoftware,
    reset(){doorOverride=null;inspected=null;cabinet.traverse(object=>{if(object.isMesh&&object.material.emissive)object.material.emissive.set(0x000000);});forceCamera=true;invalidate();},
    rotate(direction){const offset=camera.position.clone().sub(orbit.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),direction*.16);camera.position.copy(orbit.target).add(offset);camera.lookAt(orbit.target);orbit.update();invalidate();},
    setVisible(value){visible=value;if(value)invalidate();else{cancelAnimationFrame(frame);frame=0;}},
    capture(){renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},
    dispose(){alive=false;observer.disconnect();orbit.dispose();cancelAnimationFrame(frame);scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean))m.dispose();});retired.forEach(o=>o.traverse(n=>n.geometry?.dispose()));Object.values(textures).forEach(t=>t.dispose());environment.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
