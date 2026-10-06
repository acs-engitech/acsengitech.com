import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { modelSlots, stages, callouts } from './stages.js';

const v = a => new THREE.Vector3(...a);
const paper = 0xf2f5f4;
const FOV = 30;
const CYCLE = 4; // seconds per robot pick, matched to carton pitch / belt speed
const PITCH = 1.2, SPEED = PITCH / CYCLE;
const smooth = t => t * t * (3 - 2 * t);

export async function createWorld(mount, { onProject, onCallouts, onLost, reduced = false } = {}) {
  await Promise.race([document.fonts?.load('600 20px Manrope').catch(() => {}), new Promise(r => setTimeout(r, 900))]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 1000 ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  // CPU rasterisers (no GPU acceleration) get a lighter scene: no shadow pass, 1x pixels.
  const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : '');
  if (software) renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D factory floor with an ACS control panel');
  renderer.domElement.setAttribute('role', 'img');
  mount.append(renderer.domElement);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(paper);
  scene.fog = new THREE.Fog(paper, 34, 78);
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 200);
  const world = new THREE.Group(); scene.add(world);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb4c0c3, .85));
  const sun = new THREE.DirectionalLight(0xfff8ee, 2.6);
  sun.position.set(7, 15, 11); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 15, bottom: -15, near: 1, far: 50 });
  sun.shadow.normalBias = .03; sun.shadow.bias = -.0004; sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdcecff, .7); fill.position.set(-10, 6, 8); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, .45); rim.position.set(2, 8, -12); scene.add(rim);

  // Soft-box studio reflections give painted steel and chrome believable highlights without HDR downloads.
  const studio = new THREE.Scene(); studio.background = new THREE.Color(0xb9c4c8);
  for (const [position, scale, intensity] of [[[-6, 8, 5], [6, 10, 1], 5], [[6, 5, -3], [3, 7, 1], 2.4], [[0, 10, 0], [12, 1, 8], 3.6], [[7, 3, 7], [1, 5, 6], 1.8], [[0, -4, 0], [20, 1, 20], .35]]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(...scale), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(intensity) }));
    light.position.copy(v(position)); studio.add(light);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, .04); scene.environment = environment.texture;
  pmrem.dispose(); studio.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });

  function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  }
  const font = (weight, size) => `${weight} ${size}px Manrope, Arial, sans-serif`;
  const textures = {
    floor: canvasTexture(512, 512, (x, w, h) => {
      const img = x.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - .5) * 9; img.data[i] = 221 + n; img.data[i + 1] = 227 + n; img.data[i + 2] = 226 + n; img.data[i + 3] = 255; }
      x.putImageData(img, 0, 0);
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,135,140,${Math.random() * .035})`; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 90, 10 + Math.random() * 50, Math.random() * 3, 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(110,125,130,.35)'; x.lineWidth = 2; x.strokeRect(0, 0, w, h);
    }, [6, 22 / 6]),
    belt: canvasTexture(64, 64, (x, w, h) => { x.fillStyle = '#30373a'; x.fillRect(0, 0, w, h); x.fillStyle = '#3c4447'; x.fillRect(0, 0, 10, h); }, [40, 1]),
    carton: canvasTexture(256, 256, (x, w, h) => {
      x.fillStyle = '#c59c6b'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(90,60,30,${Math.random() * .06})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 8); }
      x.fillStyle = '#d9bc8f'; x.fillRect(0, h * .44, w, h * .12);
      x.fillStyle = '#0069ab'; x.fillRect(w * .12, h * .14, w * .2, h * .06);
    }),
    hatch: canvasTexture(128, 128, (x, w, h) => {
      x.fillStyle = '#2b2f31'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8b923';
      for (let i = -2; i < 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32 + h, h); x.lineTo(i * 64 + h, h); x.fill(); }
    }, [8, 1.5]),
    fence: canvasTexture(128, 128, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(60,66,70,.95)'; x.lineWidth = 3;
      for (let i = 0; i <= w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
    }, [6, 6]),
    contact: canvasTexture(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(25,38,44,.55)'); g.addColorStop(.55, 'rgba(25,38,44,.22)'); g.addColorStop(1, 'rgba(25,38,44,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }),
    hmi: canvasTexture(512, 360, (x, w, h) => {
      x.fillStyle = '#0d2633'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#0069ab'; x.fillRect(0, 0, w, 52);
      x.fillStyle = '#fff'; x.font = font(700, 24); x.fillText('LINE 01  ·  PACKAGING', 18, 35);
      x.fillStyle = '#3ddc84'; x.font = font(700, 20); x.textAlign = 'right'; x.fillText('AUTO  ●  RUN', w - 18, 34); x.textAlign = 'left';
      x.strokeStyle = '#4f7d93'; x.lineWidth = 6; x.beginPath(); x.moveTo(30, 150); x.lineTo(w - 30, 150); x.stroke();
      [[60, 'FORM'], [200, 'SEAL'], [330, 'CHECK'], [450, 'PALLET']].forEach(([px, name]) => {
        x.fillStyle = '#1b4255'; x.fillRect(px - 42, 96, 84, 40); x.fillStyle = '#3ddc84'; x.beginPath(); x.arc(px - 26, 116, 7, 0, 7); x.fill();
        x.fillStyle = '#dbe9ef'; x.font = font(600, 15); x.fillText(name, px - 14, 122);
      });
      x.fillStyle = '#9fc3d3'; x.font = font(600, 17); x.fillText('SPEED', 30, 205); x.fillText('UPTIME', 190, 205); x.fillText('ALARMS', 350, 205);
      x.fillStyle = '#fff'; x.font = font(700, 38); x.fillText('18 /min', 30, 250); x.fillText('24×7', 190, 250); x.fillText('0', 350, 250);
      x.fillStyle = '#163a4b'; x.fillRect(30, 285, w - 60, 16); x.fillStyle = '#3ddc84'; x.fillRect(30, 285, (w - 60) * .78, 16);
      x.fillStyle = '#7fa6b7'; x.font = font(600, 14); x.fillText('ACS ENGITECH  ·  CONTROL SYSTEM', 30, 334);
    }),
    meter: canvasTexture(256, 256, (x, w, h) => {
      x.fillStyle = '#1d2427'; x.fillRect(0, 0, w, h); x.fillStyle = '#a9d7ff'; x.fillRect(22, 30, w - 44, h - 90);
      x.fillStyle = '#123247'; x.font = font(700, 48); x.textAlign = 'right'; x.fillText('415.2', w - 64, 102); x.fillText('48.6', w - 64, 162);
      x.font = font(700, 26); x.fillText('V', w - 32, 102); x.fillText('A', w - 32, 162);
      x.fillStyle = '#9aa7ad'; x.font = font(600, 20); x.textAlign = 'center'; x.fillText('MFM', w / 2, h - 26);
    }),
    plate: canvasTexture(512, 96, (x, w, h) => {
      x.fillStyle = '#e9eded'; x.fillRect(0, 0, w, h); x.fillStyle = '#0069ab'; x.font = font(800, 46); x.fillText('ACS', 24, 64);
      x.fillStyle = '#253237'; x.font = font(700, 30); x.fillText('ENGITECH', 136, 62); x.fillStyle = '#6b7c83'; x.font = font(600, 18); x.fillText('CONTROL PANEL', 330, 60);
    }),
    danger: canvasTexture(128, 128, (x, w, h) => {
      x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(w / 2, 8); x.lineTo(w - 6, h - 10); x.lineTo(6, h - 10); x.closePath(); x.fill();
      x.strokeStyle = '#1b1d1f'; x.lineWidth = 7; x.stroke(); x.fillStyle = '#1b1d1f';
      x.beginPath(); x.moveTo(70, 38); x.lineTo(50, 78); x.lineTo(66, 78); x.lineTo(56, 104); x.lineTo(82, 66); x.lineTo(66, 66); x.lineTo(76, 38); x.closePath(); x.fill();
    })
  };
  const M = (color, roughness = .5, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const materials = {
    floor: M(0xffffff, .62, 0, { map: textures.floor }),
    slab: M(0xc5cecf, .8),
    ground: M(paper, .95),
    wall: M(0xe8ecec, .9), dado: M(0xbccbd0, .75), window: M(0xeef6fa, .2, 0, { emissive: 0xdfeef6, emissiveIntensity: .35 }),
    column: M(0x8fa4ae, .55, .35), rafter: M(0x9cb0b9, .55, .35),
    paint: new THREE.MeshPhysicalMaterial({ color: 0xd2d5cf, roughness: .48, metalness: .05, clearcoat: .3, clearcoatRoughness: .45 }),
    paintInner: M(0xdfe1dc, .6, .03),
    plinth: M(0x2a2f31, .62, .2),
    black: M(0x16191b, .38, .1),
    galv: M(0xb3babc, .4, .85),
    chrome: M(0xdfe4e6, .16, 1),
    aluminium: M(0xc4cacd, .35, .8),
    duct: M(0xc6cac8, .72),
    ductSlot: M(0x8e9592, .8),
    copper: M(0xc98552, .28, 1),
    insulator: M(0xb43a2e, .55),
    device: M(0xe9ebe8, .55), deviceDark: M(0x34393c, .5, .1), deviceMid: M(0x6c7478, .5, .1),
    plc: M(0x31373a, .45, .15), plcFace: M(0x9aa6aa, .5, .1),
    vfd: M(0x495156, .45, .2), vfdFace: M(0x24292b, .3, .1),
    terminal: M(0xb8bdbd, .6), terminalBlue: M(0x2f6cb3, .55), terminalEarth: M(0x9dbb3a, .55),
    wireRed: M(0xb8322b, .55), wireYellow: M(0xd9b52b, .55), wireBlue: M(0x2b5fb0, .55), wireBlack: M(0x1d2022, .55), wireControl: M(0x3f78c4, .55), wireGrey: M(0x7b8387, .6),
    lampGreen: M(0x2cc16a, .3, 0, { emissive: 0x31ff86, emissiveIntensity: 1.6 }),
    lampAmber: M(0xb7832a, .3, 0, { emissive: 0xffa21f, emissiveIntensity: .12 }),
    lampRed: M(0xa3302a, .3, 0, { emissive: 0xff3a2a, emissiveIntensity: .14 }),
    lampRedOn: M(0xd0382c, .3, 0, { emissive: 0xff3a2a, emissiveIntensity: 1.3 }),
    lampYellowOn: M(0xd9b23a, .3, 0, { emissive: 0xffd34a, emissiveIntensity: 1.2 }),
    lampBlueOn: M(0x3570c8, .3, 0, { emissive: 0x4a8dff, emissiveIntensity: 1.2 }),
    led: M(0x1e8f4c, .4, 0, { emissive: 0x2cff7a, emissiveIntensity: 1.4 }),
    ledBlink: M(0xb37a1e, .4, 0, { emissive: 0xffb12c, emissiveIntensity: 1 }),
    estop: M(0xc4291f, .32, 0), yellow: M(0xe6b622, .45), stripe: M(0xe8b923, .6),
    hatch: M(0xffffff, .7, 0, { map: textures.hatch }),
    screen: new THREE.MeshBasicMaterial({ map: textures.hmi, toneMapped: false }),
    meter: new THREE.MeshBasicMaterial({ map: textures.meter, toneMapped: false }),
    plate: M(0xffffff, .4, .2, { map: textures.plate }),
    danger: M(0xffffff, .5, 0, { map: textures.danger, transparent: true }),
    machine: new THREE.MeshPhysicalMaterial({ color: 0xeaedec, roughness: .42, metalness: .05, clearcoat: .4, clearcoatRoughness: .4 }),
    machineDark: M(0x3a4246, .5, .2),
    blue: M(0x0069ab, .38, .15), blueDeep: M(0x0b4f80, .4, .2),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xd6e8ee, roughness: .06, metalness: 0, transparent: true, opacity: .2, depthWrite: false }),
    belt: M(0xffffff, .82, 0, { map: textures.belt }),
    carton: M(0xffffff, .82, 0, { map: textures.carton }),
    wood: M(0xb8935f, .85), rackBlue: M(0x2c63a0, .45, .3), rackOrange: M(0xd47a2a, .5, .25),
    fence: M(0x5b6266, .5, .3, { map: textures.fence, side: THREE.DoubleSide, transparent: true, depthWrite: false }),
    robot: new THREE.MeshPhysicalMaterial({ color: 0xf1f3f2, roughness: .32, metalness: .05, clearcoat: .6, clearcoatRoughness: .25 }),
    robotJoint: M(0x0069ab, .35, .2), rubber: M(0x222629, .85),
    contact: new THREE.MeshBasicMaterial({ map: textures.contact, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    lamp: M(0xffffff, .3, 0, { emissive: 0xfff6e3, emissiveIntensity: 1.2 }),
    monitor: M(0x1b1f21, .35, .2)
  };

  // ---------- geometry helpers ----------
  function roundedBox(w, h, d, r) {
    if (r <= 0) return new THREE.BoxGeometry(w, h, d);
    const b = Math.min(r, w / 4, h / 4, d / 4);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + b, -h / 2 + b); shape.lineTo(w / 2 - b, -h / 2 + b); shape.lineTo(w / 2 - b, h / 2 - b); shape.lineTo(-w / 2 + b, h / 2 - b); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, steps: 1, curveSegments: 1 });
    geo.translate(0, 0, -d / 2 + b); return geo;
  }
  function mesh(parent, geo, mat, at = [0, 0, 0], rot, cast = true) {
    const m = new THREE.Mesh(geo, typeof mat === 'string' ? materials[mat] : mat);
    m.position.copy(v(at)); if (rot) m.rotation.set(...rot);
    m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (parent, size, at, mat = 'paint', r = 0, rot) => mesh(parent, roundedBox(...size, r), mat, at, rot);
  function cyl(parent, r, h, at, mat = 'chrome', axis = 'y', seg = 20, r2 = r) {
    const m = mesh(parent, new THREE.CylinderGeometry(r, r2, h, seg), mat, at);
    if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  }
  function tube(parent, points, r, mat, seg = 24) {
    const curve = new THREE.CatmullRomCurve3(points.map(v), false, 'centripetal');
    return mesh(parent, new THREE.TubeGeometry(curve, seg, r, 6, false), mat);
  }
  function plane(parent, w, h, at, mat, rot) { return mesh(parent, new THREE.PlaneGeometry(w, h), mat, at, rot, false); }
  function contact(parent, w, d, at = [0, 0, 0], strength = 1) {
    const m = plane(parent, w, d, [at[0], .006 + (at[1] || 0), at[2]], 'contact', [-Math.PI / 2, 0, 0]);
    m.receiveShadow = false; m.renderOrder = 1; m.userData.opacity = strength; return m;
  }
  function stackLight(parent, at) {
    const g = new THREE.Group(); g.position.copy(v(at)); parent.add(g);
    cyl(g, .012, .14, [0, .07, 0], 'aluminium', 'y', 10);
    [['lampRed', .17], ['lampAmber', .23], ['lampGreen', .29]].forEach(([mat, y]) => cyl(g, .035, .055, [0, y, 0], mat, 'y', 16));
    cyl(g, .036, .02, [0, .33, 0], 'black', 'y', 16);
    return g;
  }
  function louvres(parent, x, y, z, w, rows, gap = .028) {
    for (let i = 0; i < rows; i++) box(parent, [w, .012, .012], [x, y + i * gap, z], 'plinth', 0, [-.6, 0, 0]);
  }

  // ---------- slots ----------
  const actors = {};
  for (const [id, slot] of Object.entries(modelSlots)) { const g = new THREE.Group(); g.position.copy(v(slot.position)); g.userData.slot = id; world.add(g); actors[id] = g; }

  // ---------- factory floor & building ----------
  const factory = actors.factory;
  const ground = mesh(scene, new THREE.PlaneGeometry(400, 400), 'ground', [0, -.15, 0], [-Math.PI / 2, 0, 0], false);
  ground.receiveShadow = true;
  const gridMat = new THREE.LineBasicMaterial({ color: 0xc9d5d8, transparent: true, opacity: .45 });
  const gridPts = [];
  for (let i = -60; i <= 60; i += 3) { gridPts.push(v([i, -.14, -60]), v([i, -.14, 60]), v([-60, -.14, i]), v([60, -.14, i])); }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPts), gridMat));
  box(factory, [36, .15, 22], [0, -.075, 0], 'slab');
  const floorTop = plane(factory, 36, 22, [0, .001, 0], 'floor', [-Math.PI / 2, 0, 0]); floorTop.receiveShadow = true;
  // Back and side walls form a cut-away hall; the open sides keep the camera unobstructed.
  box(factory, [36.3, 7.4, .3], [0, 3.7, -11.15], 'wall');
  box(factory, [.3, 7.4, 22], [-18.15, 3.7, 0], 'wall');
  box(factory, [36, 1.3, .06], [0, .65, -10.97], 'dado');
  box(factory, [.06, 1.3, 22], [-17.97, .65, 0], 'dado');
  for (let x = -15; x <= 15; x += 6) box(factory, [4.8, 1.3, .05], [x, 5.55, -10.97], 'window');
  for (let z = -8; z <= 8; z += 6) box(factory, [.05, 1.3, 4.8], [-17.97, 5.55, z], 'window');
  function column(x, z) {
    box(factory, [.3, 7.2, .04], [x, 3.6, z], 'column'); box(factory, [.04, 7.2, .3], [x, 3.6, z + .15], 'column'); box(factory, [.04, 7.2, .3], [x, 3.6, z - .15], 'column');
    box(factory, [.5, .05, .5], [x, .025, z], 'column');
  }
  for (let x = -18; x <= 18; x += 6) column(x, -10.8);
  for (let z = -4.8; z <= 10; z += 6) column(-17.8, z);
  for (let x = -18; x <= 18; x += 6) {
    box(factory, [.04, .42, 9.5], [x, 6.95, -6.2], 'rafter'); box(factory, [.22, .035, 9.5], [x, 6.75, -6.2], 'rafter'); box(factory, [.22, .035, 9.5], [x, 7.15, -6.2], 'rafter');
    for (const z of [-7.5, -3.3]) {
      cyl(factory, .012, .55, [x, 6.48, z], 'aluminium', 'y', 6);
      cyl(factory, .32, .26, [x, 6.1, z], 'column', 'y', 24, .16);
      cyl(factory, .3, .01, [x, 5.965, z], 'lamp', 'y', 24);
    }
  }
  for (const z of [-10.4, -7.2, -4, -1.6]) box(factory, [36, .14, .08], [0, 7.24, z], 'rafter');
  // Floor markings: aisle, line zone and panel clearance.
  const stripe = (x1, z1, x2, z2, w = .07) => box(factory, [Math.abs(x2 - x1) || w, .004, Math.abs(z2 - z1) || w], [(x1 + x2) / 2, .004, (z1 + z2) / 2], 'stripe');
  stripe(-17, 5.6, 17, 5.6); stripe(-17, 6.9, 17, 6.9);
  for (let x = -15; x <= 15; x += 3) box(factory, [1.2, .004, .5], [x, .004, 6.25], M(0xd4dcd9, .7));
  stripe(-11.4, .25, 3.85, .25); stripe(3.85, .25, 3.85, 4.2); stripe(1.2, 4.2, 3.85, 4.2); stripe(-11.4, 4.2, 1.2, 4.2); stripe(-11.4, .25, -11.4, 4.2);
  stripe(-1.4, -3.75, 6.6, -3.75); stripe(-1.4, -3.75, -1.4, -4.85); stripe(6.6, -3.75, 6.6, -4.85);
  plane(factory, 1.75, .8, [modelSlots.panel.position[0], .006, modelSlots.panel.position[2] + .75], 'hatch', [-Math.PI / 2, 0, 0]).receiveShadow = true;
  plane(factory, 2.2, .45, [-2.3, .006, 5.05], 'hatch', [-Math.PI / 2, 0, 0]).receiveShadow = true;

  // Pallet racking along the side wall.
  function pallet(parent, at, layers = 0, rotation = 0) {
    const g = new THREE.Group(); g.position.copy(v(at)); g.rotation.y = rotation; parent.add(g);
    for (const z of [-.36, 0, .36]) box(g, [1.2, .1, .1], [0, .05, z], 'wood');
    for (let i = 0; i < 6; i++) box(g, [.14, .025, .8], [-.52 + i * .208, .112, 0], 'wood');
    for (let l = 0; l < layers; l++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box(g, [.37, .31, .29], [-.38 + i * .38, .28 + l * .32, -.15 + j * .3], 'carton', .006);
    return g;
  }
  for (let z = -9.6; z <= 3.6; z += 2.7) {
    for (const dx of [-.5, .5]) box(factory, [.08, 5.4, .08], [-16.4 + dx, 2.7, z], 'rackBlue');
  }
  for (let z = -8.25; z <= 3.6; z += 2.7) for (const y of [1.6, 3.3, 5]) {
    for (const dx of [-.5, .5]) box(factory, [.06, .12, 2.6], [-16.4 + dx, y, z], 'rackOrange');
    pallet(factory, [-16.4, y + .06, z - .62], (z + y) % 2 > .7 ? 2 : 1, Math.PI / 2);
    pallet(factory, [-16.4, y + .06, z + .62], 2, Math.PI / 2);
  }
  for (let z = -8.25; z <= 3.6; z += 2.7) pallet(factory, [-16.4, 0, z], 2, Math.PI / 2);
  contact(factory, 1.8, 14, [-16.4, 0, -2.8]);

  // CNC machining centres.
  function cnc(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); factory.add(g);
    box(g, [2.7, .35, 2], [0, .175, 0], 'machineDark', .02);
    box(g, [2.7, 2.05, 2], [0, 1.37, 0], 'machine', .05);
    box(g, [2.72, .16, 2.02], [0, 2.3, 0], 'blue', .02);
    box(g, [1.5, 1.3, .04], [-.35, 1.35, 1.01], 'machineDark', .015);
    box(g, [1.32, 1.08, .02], [-.35, 1.38, 1.035], 'glass');
    box(g, [.04, .5, .06], [.38, 1.35, 1.05], 'chrome', .01);
    box(g, [.5, .7, .14], [1.05, 1.5, 1.08], 'machineDark', .02);
    box(g, [.4, .28, .01], [1.05, 1.66, 1.155], 'screen');
    for (let i = 0; i < 4; i++) box(g, [.07, .05, .01], [.9 + i * .1, 1.38, 1.155], 'device');
    stackLight(g, [1.2, 2.38, -.7]);
    box(g, [.6, .55, 1.4], [-1.65, .3, .1], 'machineDark', .02);
    contact(g, 3.9, 2.8, [0, 0, 0]);
  }
  cnc(-11.6, -6.6); cnc(-7.8, -6.6);

  // ---------- production line ----------
  const line = actors.line;
  const conveyor = { x0: -10.6, x1: 1.4, z: 1.6, top: .85 };
  const beltLength = conveyor.x1 - conveyor.x0, beltX = (conveyor.x0 + conveyor.x1) / 2;
  const belt = box(line, [beltLength, .03, .5], [beltX, conveyor.top - .015, conveyor.z], 'belt');
  textures.belt.repeat.set(beltLength / .3, 1);
  for (const dz of [-.29, .29]) {
    box(line, [beltLength + .1, .1, .05], [beltX, conveyor.top - .04, conveyor.z + dz], 'aluminium', .01);
    for (let x = conveyor.x0 + .6; x < conveyor.x1; x += 1.6) {
      cyl(line, .008, .2, [x, 1.03, conveyor.z + dz * .78], 'chrome', 'y', 6);
      box(line, [.05, .78, .05], [x, .39, conveyor.z + dz], 'aluminium', .005);
      box(line, [.12, .02, .1], [x, .01, conveyor.z + dz], 'black');
    }
    cyl(line, .01, beltLength, [beltX, 1.06, conveyor.z + dz * .8], 'chrome', 'x', 8);
  }
  cyl(line, .12, .32, [conveyor.x0 + .25, .58, conveyor.z - .45], 'blueDeep', 'z', 20);
  box(line, [.22, .22, .2], [conveyor.x0 + .25, .58, conveyor.z - .7], 'deviceMid', .01);
  contact(line, beltLength + .4, 1.1, [beltX, 0, conveyor.z], .7);

  function station(x, w, d, h, opts = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, conveyor.z); line.add(g);
    box(g, [w, .8, d], [0, .4, 0], 'machine', .025);
    box(g, [w + .02, .05, d + .02], [0, .82, 0], 'blue', .01);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [.045, h - .8, .045], [sx * (w / 2 - .02), .8 + (h - .8) / 2, sz * (d / 2 - .02)], 'aluminium', .006);
    for (const sz of [-1, 1]) box(g, [w - .06, h - .95, .012], [0, .8 + (h - .8) / 2 - .04, sz * (d / 2 - .02)], 'glass');
    box(g, [w, .32, d], [0, h + .16, 0], 'machine', .03);
    box(g, [w + .01, .06, d + .01], [0, h + .05, 0], 'blueDeep', .01);
    box(g, [.42, .26, .03], [w / 2 - .3, h + .16, d / 2 + .005], 'machineDark', .01);
    box(g, [.32, .18, .005], [w / 2 - .3, h + .17, d / 2 + .022], 'screen');
    stackLight(g, [-w / 2 + .15, h + .32, -d / 2 + .15]);
    contact(g, w + .9, d + .9);
    return g;
  }
  const stationA = station(-8, 2, 1.7, 2.05);
  const press = new THREE.Group(); press.userData.live = true; press.position.set(0, 1.45, 0); stationA.add(press);
  box(press, [.5, .06, .4], [0, 0, 0], 'aluminium', .01);
  box(press, [.42, .02, .34], [0, -.04, 0], 'rubber');
  for (const dx of [-.15, .15]) cyl(press, .02, .65, [dx, .33, 0], 'chrome', 'y', 10);
  box(stationA, [.3, .3, .3], [0, 2.0, 0], 'deviceMid', .02);
  const stationB = station(-4.4, 1.3, 1.2, 1.6);
  cyl(stationB, .22, .1, [.2, 1.25, .85], 'device', 'z', 28);
  cyl(stationB, .06, .12, [.2, 1.25, .85], 'chrome', 'z', 12);
  box(stationB, [.08, .9, .08], [.2, .9, .72], 'aluminium');
  const arch = new THREE.Group(); arch.position.set(-1.6, 0, conveyor.z); line.add(arch);
  for (const dz of [-.42, .42]) box(arch, [.12, 1.75, .12], [0, .875, dz], 'machine', .02);
  box(arch, [.2, .16, 1], [0, 1.78, 0], 'machine', .025);
  box(arch, [.16, .16, .2], [0, 1.6, 0], 'machineDark', .02);
  const ring = mesh(arch, new THREE.TorusGeometry(.13, .018, 8, 32), 'lamp', [0, 1.5, 0], [Math.PI / 2, 0, 0]);
  ring.castShadow = false;
  box(arch, [.5, .5, .5], [.3, .25, -.75], 'machineDark', .02);
  stackLight(arch, [0, 1.86, .35]);

  // Robot palletiser cell.
  const robotBase = new THREE.Vector3(2.5, 0, 1.6);
  const robot = new THREE.Group(); robot.position.copy(robotBase); line.add(robot);
  box(robot, [.75, .5, .75], [0, .25, 0], 'machineDark', .03);
  cyl(robot, .34, .22, [0, .61, 0], 'robot', 'y', 32);
  const L1 = 1.05, L2 = 1.0, shoulderY = 1.05;
  const j1 = new THREE.Group(); j1.position.set(0, .72, 0); j1.userData.live = true; robot.add(j1);
  cyl(j1, .29, .2, [0, .1, 0], 'robot', 'y', 32);
  box(j1, [.42, .3, .5], [.05, .3, 0], 'robot', .06);
  const shoulder = new THREE.Group(); shoulder.position.set(.08, shoulderY - .72, 0); shoulder.userData.live = true; j1.add(shoulder);
  cyl(shoulder, .17, .52, [0, 0, 0], 'robotJoint', 'z', 28);
  box(shoulder, [L1, .2, .24], [L1 / 2, 0, .02], 'robot', .07);
  const elbow = new THREE.Group(); elbow.position.set(L1, 0, 0); elbow.userData.live = true; shoulder.add(elbow);
  cyl(elbow, .13, .38, [0, 0, 0], 'robotJoint', 'z', 24);
  box(elbow, [L2, .15, .17], [L2 / 2, 0, -.03], 'robot', .06);
  box(elbow, [.32, .22, .24], [-.12, 0, -.03], 'robot', .06);
  const wrist = new THREE.Group(); wrist.position.set(L2, 0, 0); wrist.userData.live = true; elbow.add(wrist);
  cyl(wrist, .08, .22, [0, 0, 0], 'robotJoint', 'z', 20);
  cyl(wrist, .055, .14, [0, -.08, 0], 'robot', 'y', 16);
  box(wrist, [.34, .03, .26], [0, -.17, 0], 'aluminium', .008);
  for (const dx of [-.1, .1]) for (const dz of [-.07, .07]) cyl(wrist, .025, .04, [dx, -.2, dz], 'rubber', 'y', 10);
  const held = box(wrist, [.37, .31, .29], [0, -.375, 0], 'carton', .006); held.userData.live = true;
  const palletAt = new THREE.Vector3(2.75, 0, 3.05);
  pallet(line, palletAt.toArray(), 1);
  const slots = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) slots.push(new THREE.Vector3(palletAt.x - .38 + i * .38, .6, palletAt.z - .15 + j * .3));
  const placed = slots.map(p => { const m = box(line, [.37, .31, .29], [p.x, p.y, p.z], 'carton', .006); m.userData.live = true; return m; });
  pallet(line, [4.1, 0, 3.6], 0, .2); pallet(line, [4.1, .15, 3.6], 0, .25); pallet(line, [4.1, .3, 3.6], 0, .18);
  contact(line, 2.2, 2.2, [2.5, 0, 1.6], .8); contact(line, 1.7, 1.2, [palletAt.x, 0, palletAt.z], .7);
  // Safety fence on the two sides that do not face the viewer.
  const fencePanel = (x, z, w, rot) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; line.add(g);
    plane(g, w, 1.7, [0, 1.0, 0], 'fence');
    box(g, [w, .04, .04], [0, 1.86, 0], 'yellow'); box(g, [w, .04, .04], [0, .14, 0], 'yellow');
    for (const dx of [-w / 2, w / 2]) { box(g, [.06, 1.95, .06], [dx, .975, 0], 'yellow', .01); box(g, [.16, .015, .16], [dx, .008, 0], 'yellow'); }
  };
  fencePanel(2.55, .42, 2.3, 0); fencePanel(3.75, 1.45, 2.1, Math.PI / 2);

  // Cable tray from the control panel to every station.
  const PX = modelSlots.panel.position[0], PZ = modelSlots.panel.position[2];
  const trayY = 3.05, trayZ = .78;
  const tray = (x1, x2) => {
    const len = x2 - x1, cx = (x1 + x2) / 2;
    for (const dz of [-.15, .15]) box(line, [len, .06, .012], [cx, trayY, trayZ + dz], 'galv');
    for (let x = x1 + .1; x < x2; x += .3) box(line, [.025, .012, .3], [x, trayY - .025, trayZ], 'galv');
    for (const dz of [-.07, 0, .07]) cyl(line, .022, len, [cx, trayY - .005, trayZ + dz], 'wireBlack', 'x', 8);
  };
  tray(-8.6, PX);
  for (const x of [-6, 0, 6]) if (x < PX) cyl(line, .01, 3.75, [x, trayY + 1.88, trayZ], 'aluminium', 'y', 6);
  for (const [x, top] of [[-8, 2.4], [-4.4, 1.92], [-1.6, 1.86], [2.5, 1.15]]) {
    tube(line, [[x, trayY, trayZ], [x, trayY - .3, trayZ + .2], [x, top + .4, conveyor.z - .45], [x + (x === 2.5 ? -.2 : 0), top, conveyor.z - (x === 2.5 ? .3 : .2)]], .02, 'wireBlack', 20);
  }
  for (const dz of [-.15, .15]) box(line, [.012, trayY - 2.15, .06], [PX, 2.15 + (trayY - 2.15) / 2, trayZ + dz], 'galv');
  tube(line, [[PX, trayY, trayZ], [PX, 2.5, trayZ + .02], [PX - .1, 2.16, PZ - .15]], .03, 'wireBlack', 16);

  // ---------- control panel (hero) ----------
  const panel = actors.panel;
  const doors = [];
  function buildPanel(root) {
    const W = 1.6, D = .6, base = .1, H = 2;
    box(root, [W - .04, base, D - .04], [0, base / 2, 0], 'plinth', .005);
    box(root, [W, .05, D + .02], [0, base + H + .025, 0], 'paint', .012);
    for (const sx of [-1, 1]) box(root, [.03, H, D], [sx * (W / 2 - .015), base + H / 2, 0], 'paint', .006);
    box(root, [W, H, .03], [0, base + H / 2, -D / 2 + .015], 'paint', .006);
    box(root, [W, .04, D], [0, base + .02, 0], 'paintInner');
    box(root, [.04, H, .04], [0, base + H / 2, D / 2 - .02], 'paint', .005);
    for (const sx of [-.62, .62]) for (const sz of [-.2, .2]) mesh(root, new THREE.TorusGeometry(.03, .008, 8, 16), 'galv', [sx, base + H + .08, sz]);
    for (let i = 0; i < 8; i++) box(root, [.012, .012, .26], [W / 2 + .004, .45 + i * .03, 0], 'plinth', 0, [0, 0, .6]);
    contact(root, 2.2, 1.2, [0, 0, .05], 1);
    // Interior: galvanised mounting plate, ducts and devices, laid out in rows like an ACS build.
    const ix = 0, plateZ = -.26;
    box(root, [1.48, 1.86, .015], [ix, base + .97, plateZ], 'galv');
    const dz = plateZ + .045;
    const hDuct = (y, x1 = -.72, x2 = .72) => { box(root, [x2 - x1, .06, .075], [(x1 + x2) / 2, y, dz], 'duct'); for (let x = x1 + .02; x < x2; x += .035) box(root, [.008, .06, .002], [x, y, dz + .038], 'ductSlot'); };
    const vDuct = x => { box(root, [.06, 1.78, .075], [x, base + .97, dz], 'duct'); for (let y = base + .12; y < base + 1.84; y += .035) box(root, [.06, .008, .002], [x, y, dz + .038], 'ductSlot'); };
    vDuct(-.69); vDuct(.69);
    for (const y of [2.0, 1.62, 1.16, .7, .3]) hDuct(y, -.66, .66);
    const rail = (y, x1, x2) => box(root, [x2 - x1, .035, .008], [(x1 + x2) / 2, y, plateZ + .012], 'galv');
    // Row A: incomer MCCB and copper busbars.
    box(root, [.21, .3, .12], [-.5, 1.81, plateZ + .07], 'deviceDark', .01);
    box(root, [.15, .1, .02], [-.5, 1.81, plateZ + .14], 'deviceMid', .005);
    cyl(root, .035, .03, [-.5, 1.81, plateZ + .16], 'black', 'z', 16);
    box(root, [.09, .022, .02], [-.5, 1.81, plateZ + .18], 'yellow', .004, [0, 0, .7]);
    for (const [i, mat] of [[0, 'wireRed'], [1, 'wireYellow'], [2, 'wireBlue']]) tube(root, [[-.56 + i * .06, 1.96, plateZ + .07], [-.56 + i * .06, 2.01, plateZ + .06]], .007, mat, 4);
    for (const y of [1.91, 1.85, 1.79]) box(root, [.66, .03, .01], [.2, y, plateZ + .085], 'copper', .002);
    for (const x of [-.1, .2, .5]) box(root, [.03, .16, .06], [x, 1.85, plateZ + .045], 'insulator', .005);
    for (const [i, mat] of [[0, 'wireRed'], [1, 'wireYellow'], [2, 'wireBlue']]) tube(root, [[-.39, 1.88 - i * .04, plateZ + .07], [-.2, 1.91 - i * .06, plateZ + .09], [-.12, 1.91 - i * .06, plateZ + .09]], .006, mat, 8);
    // Row B: PLC rack, MCB distribution and 24 V power supplies.
    rail(1.39, -.64, .64);
    box(root, [.12, .19, .1], [-.56, 1.39, plateZ + .06], 'plc', .006);
    box(root, [.1, .07, .005], [-.56, 1.43, plateZ + .112], 'plcFace');
    for (let i = 0; i < 6; i++) {
      const x = -.47 + i * .048;
      box(root, [.045, .19, .1], [x, 1.39, plateZ + .06], 'plc', .004);
      box(root, [.038, .05, .006], [x, 1.33, plateZ + .112], 'plcFace');
      for (let k = 0; k < 4; k++) box(root, [.006, .006, .004], [x - .01 + (k % 2) * .02, 1.44 + Math.floor(k / 2) * .015, plateZ + .112], k === 1 && i % 2 ? 'ledBlink' : 'led');
    }
    for (let i = 0; i < 14; i++) {
      const x = -.13 + i * .019;
      box(root, [.017, .09, .07], [x, 1.39, plateZ + .045], 'device', .002);
      box(root, [.007, .02, .02], [x, 1.4, plateZ + .085], 'black');
    }
    for (const x of [.38, .53]) { box(root, [.12, .17, .11], [x, 1.39, plateZ + .065], 'deviceMid', .008); for (let k = 0; k < 5; k++) box(root, [.012, .01, .005], [x - .04 + k * .02, 1.46, plateZ + .122], 'terminalBlue'); box(root, [.008, .008, .004], [x + .04, 1.33, plateZ + .122], 'led'); }
    // Row C: drives and motor starters.
    for (let i = 0; i < 3; i++) {
      const x = -.55 + i * .16;
      box(root, [.14, .36, .16], [x, .93, plateZ + .085], 'vfd', .012);
      box(root, [.08, .06, .01], [x, 1.02, plateZ + .17], 'vfdFace', .004);
      box(root, [.05, .02, .004], [x, 1.02, plateZ + .176], 'meter');
      for (let k = 0; k < 3; k++) box(root, [.03, .004, .1], [x, .79 + k * .015, plateZ + .12], 'plinth');
    }
    for (let i = 0; i < 6; i++) {
      const x = .09 + i * .09;
      box(root, [.07, .11, .11], [x, .98, plateZ + .06], 'deviceMid', .006);
      box(root, [.05, .03, .02], [x, 1.0, plateZ + .12], 'device', .003);
      box(root, [.07, .07, .1], [x, .86, plateZ + .055], 'deviceDark', .006);
      box(root, [.02, .015, .01], [x + .015, .87, plateZ + .11], 'lampAmber');
    }
    // Row D: terminal strip.
    rail(.5, -.64, .64);
    for (let i = 0; i < 120; i++) {
      const x = -.62 + i * .0104, mat = i % 12 === 11 ? 'terminalEarth' : i % 6 === 5 ? 'terminalBlue' : 'terminal';
      box(root, [.0095, .085, .06], [x, .5, plateZ + .04], mat);
    }
    box(root, [1.26, .012, .004], [0, .55, plateZ + .072], 'device');
    // Wiring: dressed drops from devices into the nearest duct.
    const drop = (x, y1, y2, mat, z = plateZ + .05) => cyl(root, .0035, Math.abs(y2 - y1), [x, (y1 + y2) / 2, z], mat, 'y', 5);
    for (let i = 0; i < 6; i++) { drop(-.47 + i * .048, 1.49, 1.59, 'wireControl'); drop(-.47 + i * .048, 1.19, 1.29, 'wireControl'); }
    for (let i = 0; i < 14; i += 2) drop(-.13 + i * .019, 1.44, 1.59, 'wireBlack');
    for (let i = 0; i < 3; i++) { drop(-.57 + i * .16, 1.11, 1.13, 'wireBlack'); drop(-.55 + i * .16, .73, .75, 'wireRed'); }
    for (let i = 0; i < 6; i++) { drop(.08 + i * .09, 1.04, 1.13, i % 2 ? 'wireYellow' : 'wireRed'); drop(.1 + i * .09, .73, .82, 'wireBlue'); }
    for (let i = 0; i < 40; i++) { const x = -.6 + i * .031; drop(x, .54, .67, ['wireControl', 'wireBlue', 'wireGrey', 'wireBlack'][i % 4], plateZ + .06); drop(x, .33, .46, 'wireGrey', plateZ + .06); }
    cyl(root, .06, .02, [.55, 2.06, plateZ + .2], 'lamp', 'x', 12).castShadow = false;
    // Doors: hinged at the outer edges, ACS nameplate, HMI, indication and controls.
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * W / 2, 0, D / 2); pivot.userData.live = true; root.add(pivot);
      const dir = -side, dw = .795, cx = dir * dw / 2;
      box(pivot, [dw - .004, H - .01, .025], [cx, base + H / 2, .0125], 'paint', .008);
      box(pivot, [dw - .06, H - .07, .004], [cx, base + H / 2, .026], 'paint', .002);
      box(pivot, [dw - .08, H - .1, .012], [cx, base + H / 2, -.006], 'paintInner', .004);
      for (const y of [.35, 1.1, 1.85]) cyl(pivot, .011, .07, [0, base + y, .006], 'galv', 'y', 10);
      const handleX = dir * (dw - .07);
      box(pivot, [.04, .17, .025], [handleX, base + 1.0, .037], 'black', .008);
      box(pivot, [.026, .12, .025], [handleX, base + .97, .055], 'black', .01);
      cyl(pivot, .009, .01, [handleX, base + 1.07, .052], 'chrome', 'z', 10);
      if (side === -1) {
        box(pivot, [.3, .085, .006], [dir * .4, base + 1.87, .03], 'plate', .002);
        box(pivot, [.26, .19, .02], [dir * .4, base + 1.52, .035], 'monitor', .01);
        box(pivot, [.23, .158, .002], [dir * .4, base + 1.525, .046], 'screen');
        [['lampRed', .27], ['lampAmber', .37], ['lampGreen', .47]].forEach(([mat, x]) => { cyl(pivot, .017, .012, [dir * x, base + 1.26, .032], 'chrome', 'z', 16); cyl(pivot, .013, .02, [dir * x, base + 1.26, .04], mat, 'z', 16); box(pivot, [.05, .018, .002], [dir * x, base + 1.215, .027], 'device'); });
        [['lampGreen', .27], ['lampRed', .37]].forEach(([mat, x]) => { cyl(pivot, .017, .012, [dir * x, base + 1.12, .032], 'chrome', 'z', 16); cyl(pivot, .013, .014, [dir * x, base + 1.12, .04], mat === 'lampGreen' ? M(0x2a9b54, .35) : M(0xb33227, .35), 'z', 16); });
        cyl(pivot, .018, .02, [dir * .47, base + 1.12, .036], 'black', 'z', 16); box(pivot, [.006, .028, .008], [dir * .47, base + 1.12, .05], 'device', 0, [0, 0, .8]);
        box(pivot, [.075, .075, .004], [dir * .62, base + 1.19, .028], 'yellow');
        cyl(pivot, .02, .025, [dir * .62, base + 1.19, .04], 'black', 'z', 16);
        mesh(pivot, new THREE.SphereGeometry(.03, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'estop', [dir * .62, base + 1.19, .05], [Math.PI / 2, 0, 0]);
        box(pivot, [.22, .3, .03], [dir * .4, base + .7, -.025], 'paintInner', .006);
      } else {
        box(pivot, [.11, .11, .02], [dir * .4, base + 1.55, .035], 'black', .006);
        box(pivot, [.09, .09, .002], [dir * .4, base + 1.55, .046], 'meter');
        [['lampRedOn', .3], ['lampYellowOn', .4], ['lampBlueOn', .5]].forEach(([mat, x]) => { cyl(pivot, .017, .012, [dir * x, base + 1.36, .032], 'chrome', 'z', 16); cyl(pivot, .013, .02, [dir * x, base + 1.36, .04], mat, 'z', 16); });
        box(pivot, [.1, .09, .002], [dir * .4, base + 1.78, .0275], 'danger');
        box(pivot, [.24, .24, .025], [dir * .4, base + .42, .035], 'plinth', .01);
        louvres(pivot, dir * .4, base + .33, .05, .2, 7);
        box(pivot, [.24, .24, .025], [dir * .4, base + .42, -.03], 'deviceMid', .01);
      }
      doors.push({ door: pivot, side, baseRotation: 0 });
    }
  }
  buildPanel(panel);
  const panelAnchors = callouts.map(c => v(c.anchor));

  // ---------- MCC / VFD lineup ----------
  const mcc = actors.mcc;
  (function buildMcc() {
    const H = 2.2, D = .6, base = .1, widths = [1, .8, .8, .8, .8, .8, .8, .8, .8];
    let x = -widths.reduce((a, b) => a + b) / 2;
    box(mcc, [7.4, base, D - .04], [0, base / 2, 0], 'plinth');
    widths.forEach((w, i) => {
      const cx = x + w / 2; x += w;
      box(mcc, [w - .006, H, D], [cx, base + H / 2, 0], 'paint', .006);
      box(mcc, [w - .04, .36, .012], [cx, base + H - .2, D / 2 + .006], 'paint', .004);
      box(mcc, [.09, .08, .002], [cx, base + H - .2, D / 2 + .013], 'danger');
      for (const sx of [-.25, .25]) louvres(mcc, cx + sx * w, base + H - .3, D / 2 + .016, .14, 5, .03);
      box(mcc, [w - .04, H - .44, .02], [cx, base + (H - .42) / 2 + .01, D / 2 + .01], 'paint', .006);
      box(mcc, [.03, .14, .02], [cx + w / 2 - .09, base + 1.1, D / 2 + .03], 'black', .006);
      if (i === 0) { box(mcc, [.11, .11, .015], [cx, base + 1.45, D / 2 + .025], 'black', .004); box(mcc, [.09, .09, .002], [cx, base + 1.45, D / 2 + .034], 'meter'); return; }
      [['lampRedOn', -.1], ['lampYellowOn', 0], ['lampBlueOn', .1]].forEach(([mat, dx]) => cyl(mcc, .013, .02, [cx + dx, base + 1.6, D / 2 + .03], mat, 'z', 14));
      [['lampGreen', -.1], ['lampAmber', 0], ['lampRed', .1]].forEach(([mat, dx]) => cyl(mcc, .013, .02, [cx + dx, base + 1.52, D / 2 + .03], mat, 'z', 14));
      box(mcc, [.07, .11, .012], [cx, base + 1.36, D / 2 + .024], 'black', .004); box(mcc, [.055, .045, .002], [cx, base + 1.38, D / 2 + .031], 'meter');
      cyl(mcc, .025, .02, [cx, base + 1.15, D / 2 + .03], 'black', 'z', 16); box(mcc, [.06, .015, .012], [cx, base + 1.15, D / 2 + .042], 'device', .003);
      for (const sx of [-.17, .17]) louvres(mcc, cx + sx * w / .8, base + .25, D / 2 + .025, .16, 9, .035);
    });
    contact(mcc, 8.2, 1.5, [0, 0, .1], 1);
  })();

  // SCADA operator desk with real ACS software imagery.
  const desk = new THREE.Group(); desk.position.set(8.4, 0, -.2); desk.rotation.y = -.35; factory.add(desk);
  box(desk, [1.9, .05, .8], [0, .76, 0], 'machine', .015);
  for (const sx of [-.9, .9]) box(desk, [.05, .74, .7], [sx, .37, 0], 'machineDark', .01);
  const screens = [];
  for (const x of [-.45, .45]) {
    box(desk, [.66, .42, .04], [x, 1.2, -.18], 'monitor', .012);
    cyl(desk, .02, .3, [x, .93, -.22], 'aluminium', 'y', 8); box(desk, [.22, .015, .16], [x, .79, -.2], 'aluminium', .005);
    const screen = new THREE.MeshBasicMaterial({ color: 0xdfeae8, toneMapped: false });
    screens.push(screen); plane(desk, .62, .37, [x, 1.2, -.158], screen);
  }
  box(desk, [.5, .02, .16], [0, .79, .14], 'device', .004);
  box(desk, [.55, .5, .55], [0, .25, .75], 'machineDark', .04); box(desk, [.5, .55, .06], [0, .75, 1.0], 'machineDark', .03);
  contact(desk, 2.6, 2.2, [0, 0, .3]);
  const textureLoader = new THREE.TextureLoader();
  ['ems', 'logview'].forEach((name, i) => textureLoader.loadAsync(new URL(`./media/${name}.jpg`, import.meta.url).href).then(t => {
    if (!alive) { t.dispose(); return; }
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; screens[i].map = t; screens[i].color.set(0xffffff); screens[i].needsUpdate = true; loaded.push(t); invalidate();
  }).catch(() => { mount.dataset.texture = 'unavailable'; }));
  const loaded = [];

  // ---------- cartons on the belt ----------
  const CARTONS = 9, pickX = conveyor.x1 - .25, startX = pickX - (CARTONS - 1) * PITCH;
  const cartons = new THREE.InstancedMesh(roundedBox(.37, .31, .29, .006), materials.carton, CARTONS);
  cartons.castShadow = true; cartons.receiveShadow = true; cartons.frustumCulled = false; line.add(cartons);
  const dummy = new THREE.Object3D();

  // Merge static meshes per material: hundreds of parts become a few dozen draw calls.
  function bake(root) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const buckets = new Map(), retired = [];
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh) return;
      for (let p = o; p && p !== root; p = p.parent) if (p.userData.live) return;
      if (o.userData.live) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
      const key = o.material.uuid + o.castShadow + o.renderOrder;
      if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, order: o.renderOrder, geos: [] });
      buckets.get(key).geos.push(g); retired.push(o);
    });
    retired.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
    for (const { material, cast, order, geos } of buckets.values()) {
      const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
      const m = new THREE.Mesh(merged, material); m.castShadow = cast; m.receiveShadow = true; m.renderOrder = order; root.add(m);
    }
  }
  function bakeAll(root) {
    const lives = []; root.traverse(o => { if (o !== root && o.userData.live && !o.isMesh) lives.push(o); });
    bake(root); lives.forEach(bake);
  }
  scene.updateMatrixWorld(true);
  Object.values(actors).forEach(bakeAll);

  // ---------- camera & interaction ----------
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enablePan = false; orbit.enableZoom = false; orbit.enableDamping = false; orbit.rotateSpeed = .35;
  orbit.minPolarAngle = .3; orbit.maxPolarAngle = 1.48;
  orbit.addEventListener('change', () => invalidate());
  let progress = 0, desired = 0, frame = 0, visible = true, forceCamera = true, width = 1, height = 1, doorOverride = null, lastTime = 0, clock = 1.4, alive = true;
  function resize() {
    const r = mount.getBoundingClientRect(); width = r.width; height = r.height; if (!width || !height) return;
    renderer.setSize(width, height); orbit.enabled = matchMedia('(pointer:fine)').matches; renderer.domElement.style.touchAction = 'pan-y';
    forceCamera = true; invalidate();
  }
  const observer = new ResizeObserver(resize); observer.observe(mount);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  function configureCamera() {
    const a = Math.floor(progress), b = Math.min(stages.length - 1, a + 1), t = smooth(progress - a);
    const A = stages[a], B = stages[b];
    const narrow = width < 1000, aspect = width / height;
    const target = v(narrow ? (A.mobileTarget || A.target) : A.target).lerp(v(narrow ? (B.mobileTarget || B.target) : B.target), t);
    const direction = v(A.direction).normalize().lerp(v(B.direction).normalize(), t).normalize();
    let view = THREE.MathUtils.lerp(A.height, B.height, t);
    if (narrow) view = Math.max(view * .8, THREE.MathUtils.lerp(A.mobileWidth, B.mobileWidth, t) / aspect);
    const distance = view / 2 / tanHalf;
    camera.aspect = aspect;
    const horizontal = narrow ? 0 : THREE.MathUtils.lerp(A.placement[0], B.placement[0], t);
    const vertical = narrow ? THREE.MathUtils.lerp(A.mobileY ?? -.02, B.mobileY ?? -.02, t) : THREE.MathUtils.lerp(A.placement[1], B.placement[1], t);
    camera.setViewOffset(width, height, -horizontal * width, -vertical * height, width, height);
    camera.position.copy(target).addScaledVector(direction, distance);
    orbit.target.copy(target); camera.lookAt(target); camera.updateProjectionMatrix(); orbit.update();
  }
  function invalidate() { if (alive && visible && !frame) frame = requestAnimationFrame(render); }

  // ---------- animation ----------
  const toCyl = p => { const d = p.clone().sub(robotBase); return { yaw: Math.atan2(-d.z, d.x), r: Math.hypot(d.x, d.z), y: p.y }; };
  const fromCyl = c => new THREE.Vector3(robotBase.x + Math.cos(c.yaw) * c.r, c.y, robotBase.z - Math.sin(c.yaw) * c.r);
  function lerpCyl(p, q, t) {
    const a = toCyl(p), b = toCyl(q); let dy = b.yaw - a.yaw; if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
    return fromCyl({ yaw: a.yaw + dy * t, r: a.r + (b.r - a.r) * t, y: a.y + (b.y - a.y) * t });
  }
  const HOLD = .375; // wrist pivot to carried-carton centre
  const pickDown = new THREE.Vector3(pickX, conveyor.top + .155 + HOLD, conveyor.z), pickUp = pickDown.clone().setY(pickDown.y + .5);
  function solveArm(target) {
    const c = toCyl(target);
    j1.rotation.y = c.yaw;
    const r = c.r - .08, h = c.y - shoulderY;
    const d = Math.min(L1 + L2 - .001, Math.hypot(r, h));
    const t1 = Math.atan2(h, r) + Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const ex = L1 * Math.cos(t1), ey = L1 * Math.sin(t1), t2 = Math.atan2(h - ey, r - ex);
    shoulder.rotation.z = t1; elbow.rotation.z = t2 - t1; wrist.rotation.z = -t2;
  }
  function animate(time) {
    const cycle = Math.floor(time / CYCLE), u = time / CYCLE - cycle;
    for (let i = 0; i < CARTONS; i++) {
      const x = startX + ((time * SPEED + i * PITCH) % (CARTONS * PITCH));
      const grow = THREE.MathUtils.clamp((x - startX) / .3, 0, 1);
      dummy.position.set(x, conveyor.top + .155 * grow, conveyor.z);
      dummy.scale.set(1, Math.max(.001, grow) * (x <= pickX + .001 ? 1 : 0) || .0001, 1); dummy.updateMatrix();
      cartons.setMatrixAt(i, dummy.matrix);
    }
    cartons.instanceMatrix.needsUpdate = true;
    textures.belt.offset.x = -((time * SPEED / .3) % 1);
    const slot = cycle % slots.length, placeDown = slots[slot].clone().setY(slots[slot].y + HOLD), placeUp = placeDown.clone().setY(placeDown.y + .55);
    const seg = (a, b) => smooth(THREE.MathUtils.clamp((u - a) / (b - a), 0, 1));
    let target;
    if (u < .08) target = pickDown;
    else if (u < .2) target = pickDown.clone().lerp(pickUp, seg(.08, .2));
    else if (u < .5) target = lerpCyl(pickUp, placeUp, seg(.2, .5));
    else if (u < .6) target = placeUp.clone().lerp(placeDown, seg(.5, .6));
    else if (u < .66) target = placeDown;
    else if (u < .76) target = placeDown.clone().lerp(placeUp, seg(.66, .76));
    else if (u < .92) target = lerpCyl(placeUp, pickUp, seg(.76, .92));
    else target = pickUp.clone().lerp(pickDown, seg(.92, 1));
    solveArm(target);
    held.visible = u < .63; held.rotation.y = -j1.rotation.y;
    const filled = slot + (u >= .63 ? 1 : 0);
    placed.forEach((m, i) => { m.visible = i < filled; });
    press.position.y = 1.45 - .12 * Math.max(0, Math.sin(time * Math.PI * 2 / CYCLE * 2));
    const blink = Math.sin(time * 9) > 0;
    materials.ledBlink.emissiveIntensity = blink ? 1.4 : .05;
    materials.lampGreen.emissiveIntensity = 1.5 + Math.sin(time * 2.2) * .15;
  }

  function render(time = performance.now()) {
    frame = 0; if (!alive || !visible) return;
    // Ambient motion is capped near 40 fps; scroll-driven camera moves render every frame.
    if (lastTime && !forceCamera && Math.abs(desired - progress) <= .001 && time - lastTime < 24) { invalidate(); return; }
    // Time-based easing: slow GPUs reach the scrolled stage in the same wall-clock time.
    const elapsed = Math.min(250, lastTime ? time - lastTime : 16); lastTime = time;
    const delta = desired - progress;
    if (Math.abs(delta) > .001) { progress = reduced ? desired : progress + delta * (1 - Math.exp(-elapsed / 110)); forceCamera = true; }
    else if (progress !== desired) { progress = desired; forceCamera = true; }
    if (forceCamera) { configureCamera(); forceCamera = false; }
    if (!reduced) clock += elapsed / 1000;
    animate(clock);
    const a = Math.floor(progress), b = Math.min(stages.length - 1, a + 1), mix = smooth(progress - a);
    const open = doorOverride ?? THREE.MathUtils.lerp(stages[a].doorOpen || 0, stages[b].doorOpen || 0, mix);
    doors.forEach(({ door, side, baseRotation }) => { door.rotation.y = baseRotation + side * smooth(open) * 1.88; });
    renderer.render(scene, camera);
    const index = Math.round(progress), stage = stages[index];
    const point = v(stage.anchor).project(camera);
    const distance = Math.abs(progress - index);
    onProject?.({ x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, index, stable: distance < .15, copyOpacity: 1 - THREE.MathUtils.smoothstep(distance, .08, .38) });
    const showCallouts = THREE.MathUtils.lerp(stages[a].callouts ? 1 : 0, stages[b].callouts ? 1 : 0, mix) * THREE.MathUtils.smoothstep(open, .75, 1);
    if (onCallouts) {
      if (showCallouts > .02) {
        panel.updateMatrixWorld();
        const project = p => { const s = panel.localToWorld(p.clone()).project(camera); return { x: (s.x + 1) * width / 2, y: (1 - s.y) * height / 2 }; };
        const corners = [[-.8, 2.15, .3], [.8, 2.15, .3], [-.8, .1, .3], [.8, .1, .3]].map(c => project(v(c)));
        onCallouts({ opacity: showCallouts, box: { left: Math.min(...corners.map(c => c.x)), right: Math.max(...corners.map(c => c.x)), top: Math.min(...corners.map(c => c.y)), bottom: Math.max(...corners.map(c => c.y)) }, points: panelAnchors.map(project) });
      } else onCallouts(null);
    }
    if (!reduced || Math.abs(desired - progress) > .001) invalidate();
  }
  function lost(e) { e.preventDefault(); visible = false; cancelAnimationFrame(frame); frame = 0; onLost?.(); }
  renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.domElement.addEventListener('webglcontextrestored', () => { visible = true; forceCamera = true; invalidate(); mount.dispatchEvent(new CustomEvent('world-restored')); });

  // Approved GLBs replace a slot's procedural actor while keeping its world position.
  const retiredModels = [];
  for (const [id, slot] of Object.entries(modelSlots)) if (slot.modelUrl) {
    import('three/addons/loaders/GLTFLoader.js').then(async ({ GLTFLoader }) => {
      const asset = await new GLTFLoader().loadAsync(new URL(slot.modelUrl, import.meta.url).href);
      if (!alive) return;
      const bounds = new THREE.Box3().setFromObject(asset.scene), size = bounds.getSize(new THREE.Vector3());
      if (bounds.isEmpty()) throw new Error('Empty model');
      const scale = Math.min(...slot.size.map((n, i) => n / Math.max(size.getComponent(i), .001)));
      const center = bounds.getCenter(new THREE.Vector3());
      asset.scene.scale.setScalar(scale); asset.scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      asset.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const host = actors[id]; retiredModels.push(...host.children); host.clear(); host.add(asset.scene);
      if (id === 'panel') {
        doors.length = 0;
        for (const [name, side] of [['ACS_Door_Left', -1], ['ACS_Door_Right', 1]]) { const door = asset.scene.getObjectByName(name); if (door) doors.push({ door, side, baseRotation: door.rotation.y }); }
        mount.dispatchEvent(new CustomEvent('world-model-loaded', { detail: { id, doorsReady: doors.length > 0 } }));
      }
      invalidate();
    }).catch(() => { mount.dataset.modelFallback = 'procedural'; });
  }
  resize(); invalidate();
  return {
    setProgress(value, instant = false) { const next = THREE.MathUtils.clamp(value, 0, stages.length - 1); if (Math.round(next) !== Math.round(desired)) doorOverride = null; desired = next; if (instant || reduced) { progress = desired; forceCamera = true; } invalidate(); },
    setReduced(value) { reduced = value; if (value) { progress = desired; forceCamera = true; } invalidate(); },
    setDoor(open) { doorOverride = open ? 1 : 0; invalidate(); },
    reset() { doorOverride = null; forceCamera = true; invalidate(); },
    rotate(direction) { const offset = camera.position.clone().sub(orbit.target); offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * .16); camera.position.copy(orbit.target).add(offset); camera.lookAt(orbit.target); orbit.update(); invalidate(); },
    setVisible(value) { visible = value; if (value) { lastTime = 0; invalidate(); } else { cancelAnimationFrame(frame); frame = 0; } },
    capture() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      alive = false; observer.disconnect(); orbit.dispose(); cancelAnimationFrame(frame);
      scene.traverse(o => { o.geometry?.dispose(); for (const m of [o.material].flat().filter(Boolean)) m.dispose(); });
      retiredModels.forEach(o => o.traverse(n => n.geometry?.dispose()));
      Object.values(textures).forEach(t => t.dispose()); loaded.forEach(t => t.dispose());
      environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    }
  };
}
