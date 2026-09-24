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
  renderer.toneMappingExposure = 1.05;
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9eaaa9, 1.5));
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
    shell: new THREE.MeshStandardMaterial({ color: 0xcbd3d5, metalness: .52, roughness: .32 }),
    face: new THREE.MeshStandardMaterial({ color: 0xe0e5e5, metalness: .38, roughness: .38 }),
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
    parent.add(mesh); return mesh;
  }
  function line(parent, points, color=0x9eafb3) {
    const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(v)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.55}));
    parent.add(mesh); return mesh;
  }
  function label(parent, text, width, at, floor=false) {
    const c = document.createElement('canvas'); c.width=768; c.height=96;
    const ctx=c.getContext('2d'); ctx.fillStyle='#34535c'; ctx.font='32px monospace'; ctx.textAlign='center'; ctx.fillText(text,384,58);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    mesh.position.copy(v(at)); if(floor)mesh.rotation.x=-Math.PI/2; parent.add(mesh); return mesh;
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200),materials.floor);
  ground.rotation.x=-Math.PI/2; ground.position.y=-.16; ground.receiveShadow=true; scene.add(ground);
  const actors={};
  for(const [id,slot] of Object.entries(modelSlots)){const g=new THREE.Group();g.position.copy(v(slot.position));g.userData.slot=id;world.add(g);actors[id]=g;}
  const base=actors.installation;
  block(base,[12,.12,8],[0,-.09,0],'base',.025);
  // Installation boundaries and restrained datum marks belong to the physical floor.
  for(let x=-6;x<=6;x+=1) line(base,[[x,-.023,-4],[x,-.023,4]],0xc4cfd0);
  for(let z=-4;z<=4;z+=1) line(base,[[-6,-.023,z],[6,-.023,z]],0xc4cfd0);
  for(const [id,slot] of Object.entries(modelSlots)) if(id!=='installation') {
    const [x,,z]=slot.position, [w,,d]=slot.size;
    line(base,[[x-w/2-.15,-.01,z-d/2-.15],[x+w/2+.15,-.01,z-d/2-.15],[x+w/2+.15,-.01,z+d/2+.15],[x-w/2-.15,-.01,z+d/2+.15],[x-w/2-.15,-.01,z-d/2-.15]],0x8ba6ae);
  }
  label(base,'ACS / INTEGRATED AUTOMATION',3.8,[0,-.012,3.5],true);
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
    path(world,[[3.2,.24,2.35],[3.2,.035,2.6],[1.9,.035,2.6],[.7,.035,1.3],[.7,.3,.4]],'blue',.019),
    path(world,[[-.7,.3,.4],[-.7,.035,1.3],[-3,.035,1.3],[-4.1,.035,.2],[-4.1,.24,-1]],'blue',.019),
    path(world,[[.9,.35,-.4],[1.6,.035,-1],[2.8,.035,-2.1],[4.2,.035,-2.1],[4.2,1.15,-2.1]],'teal',.016)
  ];
  routes.forEach(route=>{route.material=route.material.clone();});
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
  let progress=0,desired=0,frame=0,visible=true,forceCamera=true,width=1,height=1,doorOverride=null,inspected=null;
  const partAnchors={control:[0,2.78,.1],connections:[0,1.85,.1],routing:[.7,.95,.1]};
  const raycaster=new THREE.Raycaster();let pointerStart;
  renderer.domElement.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY];});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>6||Math.round(progress)!==2)return;
    const rect=renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=raycaster.intersectObjects(cabinet.children,true)[0];
    let object=hit?.object;
    while(object&&object!==cabinet){if(object.userData.part){onPart?.(object.userData.part);return;}object=object.parent;}
  });
  function resize(){const r=mount.getBoundingClientRect();width=r.width;height=r.height;if(!width||!height)return;renderer.setSize(width,height);orbit.enabled=matchMedia('(pointer:fine)').matches;renderer.domElement.style.touchAction=orbit.enabled?'pan-y':'pan-y';forceCamera=true;invalidate();}
  const observer=new ResizeObserver(resize);observer.observe(mount);
  function configureCamera(){
    const a=Math.floor(progress),b=Math.min(5,a+1),t=progress-a;
    const A=stages[a],B=stages[b];
    const target=v(A.target).lerp(v(B.target),t),offset=v(A.offset).lerp(v(B.offset),t);
    const narrow=width<700,aspect=width/height;
    let view=THREE.MathUtils.lerp(A.height,B.height,t);
    if(narrow)view=Math.max(view,THREE.MathUtils.lerp(A.mobileWidth,B.mobileWidth,t)/aspect);
    const shift=view*(narrow?.1:.07);
    camera.left=-view*aspect/2;camera.right=view*aspect/2;camera.top=view/2+shift;camera.bottom=-view/2+shift;
    camera.position.copy(target).add(offset);orbit.target.copy(target);camera.lookAt(target);camera.updateProjectionMatrix();orbit.update();
  }
  function invalidate(){if(alive&&visible&&!frame)frame=requestAnimationFrame(render);}
  function render(){
    frame=0;if(!alive||!visible)return;
    const delta=desired-progress;
    if(Math.abs(delta)>.001){progress=reduced?desired:progress+delta*.16;forceCamera=true;}
    else if(progress!==desired){progress=desired;forceCamera=true;}
    if(forceCamera){configureCamera();forceCamera=false;}
    const open=doorOverride??THREE.MathUtils.smoothstep(progress,1.45,2);
    doors.forEach(({door,side,baseRotation=0})=>door.rotation.y=baseRotation+side*(.14+open*1.95));
    routes.forEach((route,i)=>{route.material.emissive.setHex((Math.round(progress)===i+1||Math.round(progress)===4)?0x063a55:0x000000);route.material.emissiveIntensity=.16;});
    // Context actors become translucent spatial references during close inspection.
    const a=Math.floor(progress),b=Math.min(5,a+1),mix=progress-a;
    for(const [id,items] of Object.entries(surfaces)){
      const emphasis=index=>(index===0||index===5||stages[index].actor===id)?1:.04;
      const opacity=THREE.MathUtils.lerp(emphasis(a),emphasis(b),mix);
      for(const item of items){
        item.material.opacity=opacity;
        const transparent=item.transparent||opacity<.99;
        if(item.material.transparent!==transparent){item.material.transparent=transparent;item.material.needsUpdate=true;}
        item.material.depthWrite=opacity>.99&&item.depthWrite;
        item.object.castShadow=opacity>.9;
      }
    }
    renderer.render(scene,camera);
    const index=Math.round(progress),point=v(index===2&&inspected?partAnchors[inspected]:stages[index].anchor).project(camera);
    onProject?.({x:(point.x+1)*width/2,y:(1-point.y)*height/2,index,stable:Math.abs(progress-index)<.15});
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
    setProgress(value,instant=false){desired=THREE.MathUtils.clamp(value,0,5);doorOverride=null;if(instant||reduced){progress=desired;forceCamera=true;}invalidate();},
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
