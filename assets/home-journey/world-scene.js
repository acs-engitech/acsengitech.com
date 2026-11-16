import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { modelSlots, stages, callouts } from './stages.js';

const v = a => new THREE.Vector3(...a);
const paper = 0xf2f5f4;
const FOV = 30;
const smooth = t => t * t * (3 - 2 * t);

export async function createWorld(mount, { onProject, onCallouts, onLost, reduced = false } = {}) {
  await Promise.race([document.fonts?.load('600 20px Manrope').catch(() => {}), new Promise(r => setTimeout(r, 900))]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  // Pixel ratio is the biggest GPU cost on phones and laptops; 1.25x / 1.5x keeps edges clean at a fraction of the fill.
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 1000 ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  // CPU rasterisers (no GPU acceleration) get a lighter scene: no shadow pass, 1x pixels.
  const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : '');
  if (software) renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The scene is static apart from doors and small ambient parts, so the shadow pass only reruns when something moves.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
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
  sun.shadow.mapSize.setScalar(innerWidth < 1000 ? 1024 : 2048);
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
    hatch: canvasTexture(128, 128, (x, w, h) => {
      x.fillStyle = '#2b2f31'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8b923';
      for (let i = -2; i < 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32 + h, h); x.lineTo(i * 64 + h, h); x.fill(); }
    }, [8, 1.5]),
    belt: canvasTexture(256, 64, (x, w, h) => {
      x.fillStyle = '#2b3033'; x.fillRect(0, 0, w, h);
      let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 140; i++) { x.fillStyle = ['#5b4a3e', '#3d4042', '#6a5646', '#4a4d4f'][i % 4]; x.beginPath(); x.ellipse(r() * w, 10 + r() * (h - 20), 3 + r() * 7, 2 + r() * 5, r() * 3, 0, 7); x.fill(); }
    }, [1, 1]),
    caution: canvasTexture(128, 80, (x, w, h) => { x.fillStyle = '#f3c330'; x.fillRect(0, 0, w, h); x.fillStyle = '#e2553a'; x.fillRect(0, 0, w, 30); x.fillStyle = '#fff'; x.font = font(800, 22); x.textAlign = 'center'; x.fillText('CAUTION', w / 2, 23); x.fillStyle = '#1b1d1f'; x.font = font(700, 16); x.fillText('CABLE ALLEY', w / 2, 58); }),
    contact: canvasTexture(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(25,38,44,.55)'); g.addColorStop(.55, 'rgba(25,38,44,.22)'); g.addColorStop(1, 'rgba(25,38,44,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }),
    hmi: canvasTexture(512, 360, (x, w, h) => {
      x.fillStyle = '#0d2633'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#0069ab'; x.fillRect(0, 0, w, 52);
      x.fillStyle = '#fff'; x.font = font(700, 24); x.fillText('STOCKYARD  ·  STACKER / RECLAIMER', 18, 35);
      x.fillStyle = '#3ddc84'; x.font = font(700, 20); x.textAlign = 'right'; x.fillText('AUTO  ●  RUN', w - 18, 34); x.textAlign = 'left';
      x.strokeStyle = '#4f7d93'; x.lineWidth = 6; x.beginPath(); x.moveTo(30, 150); x.lineTo(w - 30, 150); x.stroke();
      [[60, 'YARD'], [190, 'STACK'], [325, 'RECLM'], [450, 'JH-1']].forEach(([px, name]) => {
        x.fillStyle = '#1b4255'; x.fillRect(px - 42, 96, 84, 40); x.fillStyle = '#3ddc84'; x.beginPath(); x.arc(px - 26, 116, 7, 0, 7); x.fill();
        x.fillStyle = '#dbe9ef'; x.font = font(600, 15); x.fillText(name, px - 14, 122);
      });
      x.fillStyle = '#9fc3d3'; x.font = font(600, 17); x.fillText('RATE', 30, 205); x.fillText('UPTIME', 190, 205); x.fillText('ALARMS', 350, 205);
      x.fillStyle = '#fff'; x.font = font(700, 38); x.fillText('1200 t/h', 30, 250); x.fillText('24×7', 190, 250); x.fillText('0', 350, 250);
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
    device: M(0xe9ebe8, .55), deviceDark: M(0x34393c, .5, .1), deviceMid: M(0x6c7478, .5, .1),
    plc: M(0x31373a, .45, .15), plcFace: M(0x9aa6aa, .5, .1),
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
    contact: new THREE.MeshBasicMaterial({ map: textures.contact, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    lamp: M(0xffffff, .3, 0, { emissive: 0xfff6e3, emissiveIntensity: 1.2 }),
    monitor: M(0x1b1f21, .35, .2),
    cladding: M(0xd5dadc, .3, .75), claddingBand: M(0xa9b1b4, .35, .8),
    motor: M(0x1f5f9e, .45, .3), pump: M(0x5b6670, .45, .45),
    grating: M(0x9aa3a6, .55, .6),
    steelYellow: M(0xd9a52a, .5, .25), concrete: M(0xb9bfbd, .9), rail: M(0x6f777a, .35, .85),
    coal: M(0x34383a, .97), ore: M(0x5e3a2b, .95),
    fall: M(0x6d5242, .9, 0, { transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }),
    relay: M(0x5aa0e0, .25, 0, { transparent: true, opacity: .85 }),
    gap: M(0x3d4448, .7, .1), brass: M(0xc9a24a, .35, .8),
    caution: M(0xffffff, .5, 0, { map: textures.caution }),
    belt: M(0xffffff, .85, 0, { map: textures.belt })
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
  function ladder(parent, x, z, y0, y1, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
    for (const dx of [-.2, .2]) box(g, [.04, y1 - y0, .04], [dx, (y0 + y1) / 2, 0], 'yellow');
    for (let y = y0 + .3; y < y1; y += .3) cyl(g, .012, .4, [0, y, 0], 'yellow', 'x', 6);
  }
  // Floor markings: walkway, MCC clearance and panel clearance.
  const stripe = (x1, z1, x2, z2, w = .07) => box(factory, [Math.abs(x2 - x1) || w, .004, Math.abs(z2 - z1) || w], [(x1 + x2) / 2, .004, (z1 + z2) / 2], 'stripe');
  stripe(-17, 7.9, 17, 7.9); stripe(-17, 9.2, 17, 9.2);
  for (let x = -15; x <= 15; x += 3) box(factory, [1.2, .004, .5], [x, .004, 8.55], M(0xd4dcd9, .7));
  stripe(-1.4, -3.75, 6.6, -3.75); stripe(-1.4, -3.75, -1.4, -4.85); stripe(6.6, -3.75, 6.6, -4.85);
  plane(factory, 1.75, .8, [modelSlots.panel.position[0], .006, modelSlots.panel.position[2] + .75], 'hatch', [-Math.PI / 2, 0, 0]).receiveShadow = true;

  // ---------- stacker and reclaimer stockyard ----------
  // A covered bulk-material yard: two long stockpiles either side of a rail track, a boom stacker
  // building one pile, a bucket-wheel reclaimer recovering the other, and a yard conveyor running
  // to a junction house. Conveyor drives, travel, slew and wheel motors all run from the ACS panels.
  const line = actors.line;
  const TRACK_Z = .7, RAIL_GAUGE = 1.1, TRACK_X0 = -17.2, TRACK_X1 = .2;
  const CONVEYOR_Z = -1, BELT_Y = .95;

  // Stockpiles as noisy height-fields: a long ridge with rounded, conical ends.
  function stockpile(cx, cz, length, halfWidth, height, mat, seed) {
    const geo = new THREE.PlaneGeometry(length + halfWidth * 2, halfWidth * 2, 140, 40);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    let s = seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < p.count; i++) {
      const dx = Math.max(0, Math.abs(p.getX(i)) - length / 2), r = Math.hypot(dx, p.getZ(i));
      const t = Math.max(0, 1 - r / halfWidth);
      const profile = t > .9 ? .9 + (t - .9) * .45 : t;
      // Noise fades out towards the toe so the pile meets the floor in a clean line.
      p.setY(i, t > 0 ? height * profile + (rnd() - .5) * .08 * Math.min(1, t * 5) : -.01);
    }
    geo.computeVertexNormals();
    return mesh(line, geo, mat, [cx, 0, cz]);
  }
  stockpile(-9.6, -4.6, 10, 2.6, 2.5, 'coal', 7);
  stockpile(-7.2, 4.2, 9.4, 2.3, 2.1, 'ore', 13);

  // Rail track on a concrete beam, with end stops and a cable trench beside it.
  const trackLen = TRACK_X1 - TRACK_X0, trackX = (TRACK_X0 + TRACK_X1) / 2;
  for (const dz of [-RAIL_GAUGE / 2, RAIL_GAUGE / 2]) {
    box(line, [trackLen, .12, .42], [trackX, .06, TRACK_Z + dz], 'concrete');
    box(line, [trackLen, .07, .07], [trackX, .155, TRACK_Z + dz], 'rail');
    box(line, [.3, .4, .3], [TRACK_X1 + .15, .2, TRACK_Z + dz], 'yellow', .02);
    box(line, [.3, .4, .3], [TRACK_X0 - .15, .2, TRACK_Z + dz], 'yellow', .02);
  }
  box(line, [trackLen, .02, .26], [trackX, .012, TRACK_Z + 1.05], 'machineDark');

  // Conveyor belts carry a scrolling texture so material visibly flows while the yard runs.
  const belts = [];
  function beltMaterial(length) {
    const map = textures.belt.clone(); map.needsUpdate = true; map.repeat.set(Math.max(1, length / 1.6), 1);
    belts.push(map);
    return M(0xffffff, .85, 0, { map });
  }
  // Lattice truss along local +x from the origin, used for booms, the tripper and the gallery.
  function truss(parent, length, h = .6, w = .76, mat = 'steelYellow') {
    for (const y of [h / 2, -h / 2]) for (const z of [-w / 2, w / 2]) box(parent, [length, .1, .1], [length / 2, y, z], mat);
    const n = Math.max(2, Math.round(length / .8)), step = length / n, diag = Math.hypot(step, h), ang = Math.atan2(h, step);
    for (let i = 0; i < n; i++) for (const z of [-w / 2, w / 2]) {
      box(parent, [diag, .05, .05], [step * (i + .5), 0, z], mat, 0, [0, 0, i % 2 ? ang : -ang]);
      box(parent, [.05, h, .05], [step * i, 0, z], mat);
    }
    for (const z of [-w / 2, w / 2]) box(parent, [.05, h, .05], [length, 0, z], mat);
    for (let x = .3; x < length; x += .6) cyl(parent, .045, w - .12, [x, h / 2 + .05, 0], 'galv', 'z', 8);
    box(parent, [length, .035, w - .14], [length / 2, h / 2 + .1, 0], beltMaterial(length));
  }

  // Yard conveyor: trestles, troughed idlers, belt, pull-cord safety switches and the head drive.
  const yardX0 = TRACK_X0 + .2, yardX1 = -2.9, yardLen = yardX1 - yardX0, yardX = (yardX0 + yardX1) / 2;
  for (const dz of [-.42, .42]) box(line, [yardLen, .14, .06], [yardX, BELT_Y - .12, CONVEYOR_Z + dz], 'galv');
  for (let x = yardX0 + .3; x < yardX1; x += 2.2) for (const dz of [-.42, .42]) {
    box(line, [.08, BELT_Y - .12, .08], [x, (BELT_Y - .12) / 2, CONVEYOR_Z + dz], 'galv');
    box(line, [.22, .03, .22], [x, .015, CONVEYOR_Z + dz], 'galv');
  }
  for (let x = yardX0 + .2; x < yardX1; x += .55) {
    cyl(line, .055, .34, [x, BELT_Y - .03, CONVEYOR_Z], 'galv', 'z', 10);
    for (const dz of [-.27, .27]) cyl(line, .05, .22, [x, BELT_Y + .03, CONVEYOR_Z + dz], 'galv', 'z', 10).rotation.x = Math.PI / 2 + Math.sign(dz) * .45;
  }
  box(line, [yardLen, .03, .72], [yardX, BELT_Y + .04, CONVEYOR_Z], beltMaterial(yardLen));
  for (let x = yardX0 + 1.2; x < yardX1; x += 3.6) {
    box(line, [.05, 1.05, .05], [x, .52, CONVEYOR_Z - .62], 'galv');
    box(line, [.16, .2, .12], [x, 1.1, CONVEYOR_Z - .62], 'yellow', .02);
  }
  tube(line, [[yardX0 + 1.2, 1.12, CONVEYOR_Z - .6], [yardX1 - .2, 1.12, CONVEYOR_Z - .6]], .008, 'wireRed', 2);
  cyl(line, .3, .86, [yardX1 + .05, BELT_Y - .12, CONVEYOR_Z], 'machineDark', 'z', 28);
  box(line, [.5, .42, .42], [yardX1 + .05, .55, CONVEYOR_Z - .78], 'pump', .03);
  cyl(line, .17, .6, [yardX1 + .05, .55, CONVEYOR_Z - 1.3], 'motor', 'z', 24);
  for (let i = 0; i < 5; i++) cyl(line, .18, .012, [yardX1 + .05, .55, CONVEYOR_Z - 1.12 - i * .08], 'motor', 'z', 24);
  box(line, [.9, .12, .8], [yardX1 + .05, .3, CONVEYOR_Z - 1.0], 'machineDark', .01);
  contact(line, yardLen + 1, 1.4, [yardX, 0, CONVEYOR_Z], .6);

  // Junction house where the yard conveyor discharges to the gallery conveyor feeding the plant.
  const jh = new THREE.Group(); jh.position.set(-1.6, 0, -1.1); line.add(jh);
  for (const dx of [-1.15, 1.15]) for (const dz of [-1.05, 1.05]) box(jh, [.18, 4.3, .18], [dx, 2.15, dz], 'column');
  box(jh, [2.5, .18, 2.3], [0, 4.35, 0], 'rafter');
  box(jh, [2.5, 2.3, .05], [0, 2.95, -1.05], 'cladding');
  box(jh, [.05, 2.3, 2.3], [1.15, 2.95, 0], 'cladding');
  box(jh, [.05, 2.3, 2.3], [-1.15, 2.95, 0], 'cladding');
  for (let y = 1.95; y < 4.1; y += .3) box(jh, [2.52, .025, .02], [0, y, -1.08], 'claddingBand');
  box(jh, [2.3, .1, 2.1], [0, 1.75, 0], 'grating');
  box(jh, [.9, 1.0, .9], [-.3, 1.2, .1], 'galv', .02);
  cyl(jh, .26, .2, [-.3, .6, .1], 'galv', 'y', 16, .4);
  ladder(jh, 1.0, 1.25, 0, 1.75);
  contact(jh, 3.2, 3, [0, 0, 0], .9);
  // Inclined gallery conveyor from the junction house to the plant behind the yard.
  const gallery = new THREE.Group(); gallery.position.set(-1.6, 3.9, -2.3); gallery.rotation.set(0, Math.PI / 2, Math.atan2(2.4, 7.4)); line.add(gallery);
  truss(gallery, Math.hypot(7.4, 2.4), .9, 1.0, 'galv');
  for (const [z, h] of [[-6.4, 5.4], [-9.3, 6.3]]) for (const dx of [-.42, .42]) box(line, [.14, h, .14], [-1.6 + dx, h / 2, z], 'galv');
  // Plant feed conveyor drive and pull-cord switch inside the yard.
  stackLight(jh, [1.15, 4.45, 1.05]);

  // Shared undercarriage for both yard machines: travel bogies, portal and cable reel.
  function travelGear(parent, x, reel) {
    const g = new THREE.Group(); g.position.set(x, 0, TRACK_Z); parent.add(g);
    for (const dz of [-RAIL_GAUGE / 2, RAIL_GAUGE / 2]) for (const dx of [-1.45, 1.45]) {
      box(g, [1.25, .34, .3], [dx, .42, dz], 'machineDark', .02);
      for (const k of [-.4, 0, .4]) cyl(g, .15, .12, [dx + k, .31, dz], 'pump', 'z', 18);
      box(g, [.32, .32, .34], [dx + .55, .62, dz], 'motor', .02);
    }
    for (const dx of [-1.45, 1.45]) for (const dz of [-RAIL_GAUGE / 2, RAIL_GAUGE / 2]) box(g, [.4, .5, .4], [dx, .8, dz], 'steelYellow', .02);
    box(g, [3.9, .38, 1.9], [0, 1.18, 0], 'steelYellow', .03);
    cyl(g, .82, .2, [0, 1.47, 0], 'machineDark', 'y', 40);
    if (reel) {
      cyl(g, .55, .3, [2.25, 1.05, .2], 'machineDark', 'x', 32);
      cyl(g, .6, .04, [2.42, 1.05, .2], 'steelYellow', 'x', 32); cyl(g, .6, .04, [2.08, 1.05, .2], 'steelYellow', 'x', 32);
      box(g, [.5, .7, .5], [2.25, .5, .2], 'steelYellow', .02);
    }
    contact(g, 4.6, 2.6, [0, 0, 0], .9);
    return g;
  }
  // Slewing superstructure: turntable, machinery house, cab, A-frame mast and stays.
  function superstructure(parent, x, yaw) {
    const g = new THREE.Group(); g.position.set(x, 1.57, TRACK_Z); g.rotation.y = yaw; parent.add(g);
    box(g, [2.6, .32, 1.9], [0, .16, 0], 'steelYellow', .03);
    box(g, [1.5, 1.05, 1.5], [-.95, .85, 0], 'machine', .03);
    louvres(g, -.95, .55, .76, 1.1, 8, .07);
    box(g, [.9, .82, .85], [.75, .73, -.95], 'machine', .03);
    plane(g, .78, .42, [.75, .9, -1.38], 'window', [0, Math.PI, 0]);
    plane(g, .8, .42, [1.21, .9, -.95], 'window', [0, Math.PI / 2, 0]);
    for (const dz of [-.5, .5]) {
      box(g, [.14, 3.6, .14], [-.35, 2.0, dz], 'steelYellow', 0, [0, 0, -.16]);
      box(g, [.14, 3.4, .14], [.55, 1.9, dz], 'steelYellow', 0, [0, 0, .22]);
    }
    box(g, [.5, .2, 1.2], [-.05, 3.75, 0], 'steelYellow', .02);
    return g;
  }

  // Bucket-wheel reclaimer recovering ore from the far pile; the wheel turns while the yard runs.
  const RX = -3.2;
  travelGear(line, RX, true);
  const reclaimer = superstructure(line, RX, -Math.PI / 2 + .35);
  const rBoom = new THREE.Group(); rBoom.position.set(.9, 1.15, 0); rBoom.rotation.z = -.08; reclaimer.add(rBoom);
  truss(rBoom, 3.5);
  const wheel = new THREE.Group(); wheel.position.set(3.85, .1, .62); wheel.userData.live = true; rBoom.add(wheel);
  mesh(wheel, new THREE.TorusGeometry(.86, .07, 10, 48), 'steelYellow');
  mesh(wheel, new THREE.TorusGeometry(.56, .05, 8, 40), 'steelYellow');
  cyl(wheel, .2, .32, [0, 0, 0], 'machineDark', 'z', 24);
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    box(wheel, [.06, .82, .06], [c * .43, s * .43, 0], 'steelYellow', 0, [0, 0, a - Math.PI / 2]);
    box(wheel, [.34, .26, .42], [c * .98, s * .98, 0], 'steelYellow', .03, [0, 0, a]);
    box(wheel, [.06, .3, .44], [c * 1.15, s * 1.15, 0], 'black', 0, [0, 0, a]);
  }
  box(rBoom, [.5, .5, .45], [3.85, .1, -.32], 'motor', .03);
  box(rBoom, [.5, .32, .9], [3.5, .1, .2], 'steelYellow', .02);
  const rCounter = new THREE.Group(); rCounter.position.set(-.6, 1.25, 0); reclaimer.add(rCounter);
  box(rCounter, [2.1, .26, .7], [-1.05, 0, 0], 'steelYellow', .02);
  box(rCounter, [1.0, .95, 1.0], [-2.2, .1, 0], 'concrete', .04);
  tube(reclaimer, [[-.05, 3.8, .15], [2.2, 2.1, .15], [4.1, 1.15, .15]], .025, 'galv', 12);
  tube(reclaimer, [[-.05, 3.8, -.15], [-2.7, 1.6, -.15]], .025, 'galv', 8);
  // Discharge chute from the machine to the yard conveyor.
  box(line, [.7, .12, 1.4], [RX, 1.25, (TRACK_Z + CONVEYOR_Z) / 2 + .1], 'galv', 0, [-.35, 0, 0]);

  // Boom stacker building the coal pile, fed from the yard conveyor by a tripper.
  const SX = -11.5;
  travelGear(line, SX, false);
  const stacker = superstructure(line, SX, Math.PI / 2 + .3);
  const sBoom = new THREE.Group(); sBoom.position.set(.9, 1.0, 0); sBoom.rotation.z = .1; stacker.add(sBoom);
  truss(sBoom, 4.9, .55, .7);
  const sTip = new THREE.Group(); sTip.position.set(5.0, .05, 0); sBoom.add(sTip);
  box(sTip, [.5, .5, .55], [0, -.15, 0], 'galv', .02, [0, 0, -.1]);
  mesh(sTip, new THREE.ConeGeometry(.42, 1.0, 18, 1, true), 'fall', [0, -.85, 0], [0, 0, -.1]);
  const sCounter = new THREE.Group(); sCounter.position.set(-.6, 1.15, 0); stacker.add(sCounter);
  box(sCounter, [1.6, .24, .6], [-.8, 0, 0], 'steelYellow', .02);
  box(sCounter, [.85, .85, .85], [-1.7, .1, 0], 'concrete', .04);
  tube(stacker, [[-.05, 3.8, 0], [2.6, 2.4, 0], [5.6, 1.6, 0]], .022, 'galv', 12);
  const tripper = new THREE.Group(); tripper.position.set(SX + 3.3, BELT_Y + .2, CONVEYOR_Z); tripper.rotation.set(0, Math.PI - .32, Math.atan2(1.5, 3.4)); line.add(tripper);
  truss(tripper, Math.hypot(3.5, 1.5), .45, .7);
  for (const dx of [2.6, 1.1]) box(line, [.1, BELT_Y + .5 + (2.6 - dx) * .4, .1], [SX + dx, (BELT_Y + .5 + (2.6 - dx) * .4) / 2, CONVEYOR_Z + .45], 'steelYellow');

  // Cable tray from the control panel to the junction house drives.
  const PX = modelSlots.panel.position[0], PZ = modelSlots.panel.position[2];
  const trayY = 3.0, trayZ = .42;
  const tray = (x1, x2) => {
    const len = x2 - x1, cx = (x1 + x2) / 2;
    for (const dz of [-.15, .15]) box(line, [len, .06, .012], [cx, trayY, trayZ + dz], 'galv');
    for (let x = x1 + .1; x < x2; x += .3) box(line, [.025, .012, .3], [x, trayY - .025, trayZ], 'galv');
    for (const dz of [-.07, 0, .07]) cyl(line, .022, len, [cx, trayY - .005, trayZ + dz], 'wireBlack', 'x', 8);
  };
  tray(-.5, PX);
  for (const x of [.6, 3.1]) { box(line, [.08, trayY, .08], [x, trayY / 2, trayZ - .25], 'galv'); box(line, [.08, .06, .5], [x, trayY - .07, trayZ], 'galv'); }
  tube(line, [[-.5, trayY, trayZ], [-.6, 2.7, .2], [-.45, 2.4, -.05]], .03, 'wireBlack', 12);
  for (const dz of [-.15, .15]) box(line, [.012, trayY - 2.15, .06], [PX, 2.15 + (trayY - 2.15) / 2, trayZ + dz], 'galv');
  tube(line, [[PX, trayY, trayZ], [PX, 2.5, trayZ + .2], [PX - .1, 2.16, PZ - .15]], .03, 'wireBlack', 16);

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
    // Interior of a PLC control panel, laid out like an ACS build: galvanised plate, ducts and rows of devices.
    const ix = 0, plateZ = -.26;
    box(root, [1.48, 1.86, .015], [ix, base + .97, plateZ], 'galv');
    const dz = plateZ + .045;
    const hDuct = (y, x1 = -.72, x2 = .72) => { box(root, [x2 - x1, .06, .075], [(x1 + x2) / 2, y, dz], 'duct'); for (let x = x1 + .02; x < x2; x += .035) box(root, [.008, .06, .002], [x, y, dz + .038], 'ductSlot'); };
    const vDuct = x => { box(root, [.06, 1.78, .075], [x, base + .97, dz], 'duct'); for (let y = base + .12; y < base + 1.84; y += .035) box(root, [.06, .008, .002], [x, y, dz + .038], 'ductSlot'); };
    vDuct(-.69); vDuct(.69);
    for (const y of [2.0, 1.62, 1.16, .7, .3]) hDuct(y, -.66, .66);
    const rail = (y, x1, x2) => box(root, [x2 - x1, .035, .008], [(x1 + x2) / 2, y, plateZ + .012], 'galv');
    // Row A: incoming isolator, 24 V power supplies and MCB distribution.
    box(root, [.16, .24, .11], [-.52, 1.81, plateZ + .065], 'deviceMid', .01);
    cyl(root, .04, .03, [-.52, 1.83, plateZ + .13], 'yellow', 'z', 18);
    box(root, [.1, .022, .02], [-.52, 1.83, plateZ + .15], 'estop', .004, [0, 0, .7]);
    for (const [i, mat] of [[0, 'wireRed'], [1, 'wireYellow'], [2, 'wireBlue']]) tube(root, [[-.56 + i * .04, 1.93, plateZ + .07], [-.56 + i * .04, 2.01, plateZ + .06]], .006, mat, 4);
    rail(1.81, -.4, .64);
    for (const x of [-.31, -.17]) { box(root, [.12, .19, .11], [x, 1.81, plateZ + .065], 'deviceMid', .008); for (let k = 0; k < 5; k++) box(root, [.012, .01, .005], [x - .04 + k * .02, 1.88, plateZ + .122], 'terminalBlue'); box(root, [.008, .008, .004], [x + .04, 1.75, plateZ + .122], 'led'); }
    for (let i = 0; i < 22; i++) { const x = -.05 + i * .0315; box(root, [.028, .09, .07], [x, 1.81, plateZ + .045], 'device', .002); box(root, [.008, .02, .02], [x, 1.82, plateZ + .085], i % 7 === 0 ? 'estop' : 'black'); }
    // Row B: PLC CPU, I/O modules and an industrial Ethernet switch.
    rail(1.39, -.64, .64);
    box(root, [.13, .2, .1], [-.56, 1.39, plateZ + .06], 'plc', .006);
    box(root, [.11, .075, .005], [-.56, 1.43, plateZ + .112], 'plcFace');
    for (let i = 0; i < 11; i++) {
      const x = -.465 + i * .048;
      box(root, [.045, .2, .1], [x, 1.39, plateZ + .06], 'plc', .004);
      box(root, [.038, .05, .006], [x, 1.33, plateZ + .112], 'plcFace');
      for (let k = 0; k < 4; k++) box(root, [.006, .006, .004], [x - .01 + (k % 2) * .02, 1.44 + Math.floor(k / 2) * .015, plateZ + .112], k === 1 && i % 3 === 1 ? 'ledBlink' : 'led');
    }
    box(root, [.13, .16, .09], [.45, 1.39, plateZ + .055], 'deviceDark', .008);
    for (let k = 0; k < 8; k++) box(root, [.012, .012, .004], [.4 + (k % 4) * .03, 1.36 + Math.floor(k / 4) * .03, plateZ + .102], k % 2 ? 'led' : 'ledBlink');
    // Row C: interface relays and signal isolators.
    rail(.93, -.64, .64);
    for (let i = 0; i < 26; i++) {
      const x = -.62 + i * .0235;
      box(root, [.02, .1, .075], [x, .93, plateZ + .047], 'device', .002);
      box(root, [.018, .04, .02], [x, .95, plateZ + .094], 'relay', .002);
    }
    for (let i = 0; i < 9; i++) { const x = .05 + i * .065; box(root, [.022, .12, .1], [x, .93, plateZ + .06], 'plc', .003); box(root, [.006, .006, .004], [x, .97, plateZ + .112], 'led'); }
    // Row D: terminal strip.
    rail(.5, -.64, .64);
    for (let i = 0; i < 120; i++) {
      const x = -.62 + i * .0104, mat = i % 12 === 11 ? 'terminalEarth' : i % 6 === 5 ? 'terminalBlue' : 'terminal';
      box(root, [.0095, .085, .06], [x, .5, plateZ + .04], mat);
    }
    box(root, [1.26, .012, .004], [0, .55, plateZ + .072], 'device');
    // Wiring: dressed drops from devices into the nearest duct.
    const drop = (x, y1, y2, mat, z = plateZ + .05) => cyl(root, .0035, Math.abs(y2 - y1), [x, (y1 + y2) / 2, z], mat, 'y', 5);
    for (let i = 0; i < 22; i += 2) drop(-.05 + i * .0315, 1.66, 1.76, 'wireBlack');
    for (let i = 0; i < 11; i++) { drop(-.465 + i * .048, 1.49, 1.59, 'wireControl'); drop(-.465 + i * .048, 1.19, 1.29, 'wireControl'); }
    for (let i = 0; i < 26; i += 2) { drop(-.62 + i * .0235, .73, .88, 'wireControl'); drop(-.62 + i * .0235, .98, 1.13, 'wireBlue'); }
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

  // ---------- compartmental MCC lineup (after ACS MCC photographs) ----------
  const mcc = actors.mcc;
  (function buildMcc() {
    const H = 2.3, D = .62, base = .1, top = .36, bottom = .3, front = D / 2;
    const layout = [['incomer', 1.0]]; for (let i = 0; i < 5; i++) layout.push(['alley', .3], ['feeder', .8]); layout.push(['alley', .3]);
    const total = layout.reduce((a, [, w]) => a + w, 0);
    box(mcc, [total, base, D - .04], [0, base / 2, 0], 'plinth');
    box(mcc, [total, H, D - .02], [0, base + H / 2, -.01], 'gap', .004);
    const yMid0 = base + bottom, yMid1 = base + H - top, mid = yMid1 - yMid0;
    const door = (cx, cy, w, h) => box(mcc, [w - .012, h - .012, .02], [cx, cy, front], 'paint', .004);
    const screws = (cx, cy, w, h) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) cyl(mcc, .011, .012, [cx + sx * (w / 2 - .035), cy + sy * (h / 2 - .035), front + .015], 'brass', 'z', 10); };
    const caution = (cx, cy) => box(mcc, [.07, .045, .002], [cx, cy, front + .012], 'caution');
    let x = -total / 2;
    for (const [kind, w] of layout) {
      const cx = x + w / 2; x += w;
      door(cx, base + H - top / 2, w, top); door(cx, base + bottom / 2, w, bottom);
      for (const sx of w > .5 ? [-.25, .25] : [0]) { louvres(mcc, cx + sx * w, base + H - top + .1, front + .016, Math.min(.16, w * .5), 5, .032); louvres(mcc, cx + sx * w, base + .07, front + .016, Math.min(.16, w * .5), 5, .032); }
      caution(cx, base + H - top / 2 + .12);
      if (kind === 'alley') {
        door(cx, yMid0 + mid / 2, w, mid); screws(cx, yMid0 + mid / 2, w, mid);
        louvres(mcc, cx, yMid1 - .32, front + .016, .14, 5, .032); louvres(mcc, cx, yMid0 + .12, front + .016, .14, 5, .032);
        caution(cx, yMid0 + mid / 2);
      } else if (kind === 'incomer') {
        const h1 = mid * .55, h2 = mid - h1;
        door(cx, yMid1 - h1 / 2, w, h1); screws(cx, yMid1 - h1 / 2, w, h1);
        door(cx, yMid0 + h2 / 2, w, h2); screws(cx, yMid0 + h2 / 2, w, h2);
        [['lampRedOn', -.12], ['lampYellowOn', 0], ['lampBlueOn', .12]].forEach(([mat, dx]) => cyl(mcc, .016, .022, [cx + dx, yMid1 - .14, front + .02], mat, 'z', 14));
        box(mcc, [.1, .1, .015], [cx, yMid1 - .36, front + .02], 'black', .004); box(mcc, [.08, .08, .002], [cx, yMid1 - .36, front + .029], 'meter');
        box(mcc, [.06, .09, .002], [cx, yMid1 - .58, front + .012], 'danger');
        box(mcc, [.03, .14, .02], [cx + w / 2 - .09, yMid1 - h1 / 2, front + .02], 'black', .006);
        box(mcc, [.14, .14, .015], [cx + .2, yMid0 + h2 * .4, front + .018], 'plinth', .004); louvres(mcc, cx + .2, yMid0 + h2 * .4 - .05, front + .03, .12, 4, .03);
        cyl(mcc, .02, .02, [cx - .2, yMid0 + h2 * .65, front + .02], 'estop', 'z', 16);
      } else {
        const rows = 6, mh = mid / rows;
        for (let r = 0; r < rows; r++) {
          const cy = yMid0 + mh * (r + .5);
          door(cx, cy, w, mh); screws(cx, cy, w, mh);
          box(mcc, [.09, .025, .002], [cx - w / 2 + .1, cy + mh / 2 - .04, front + .012], 'plinth');
          [['lampGreen', -.22], ['lampRedOn', -.16], ['lampAmber', -.1]].forEach(([mat, dx]) => cyl(mcc, .012, .018, [cx + dx, cy + .05, front + .02], mat, 'z', 12));
          cyl(mcc, .016, .02, [cx - .16, cy - .02, front + .02], 'estop', 'z', 14);
          box(mcc, [.07, .035, .004], [cx - .12, cy - .075, front + .013], 'meter');
          cyl(mcc, .028, .025, [cx + .18, cy, front + .022], 'black', 'z', 16); box(mcc, [.012, .05, .012], [cx + .18, cy, front + .038], 'black', .003);
          cyl(mcc, .022, .01, [cx + .04, cy + .02, front + .016], 'black', 'z', 14);
        }
      }
    }
    contact(mcc, total + .8, 1.5, [0, 0, .1], 1);
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
  let zones = [];
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
    // Desktop framing keeps the same horizontal extent on squarer screens, so the model stays clear of the copy column.
    else view *= Math.max(1, 1.8 / aspect);
    camera.aspect = aspect;
    const horizontal = narrow ? 0 : THREE.MathUtils.lerp(A.placement[0], B.placement[0], t);
    let vertical = narrow ? THREE.MathUtils.lerp(A.mobileY ?? -.02, B.mobileY ?? -.02, t) : THREE.MathUtils.lerp(A.placement[1], B.placement[1], t);
    // Phones: centre the subject in the measured gap between title and story copy, and shrink it when that gap is short.
    const zoneA = narrow && zones[a], zoneB = narrow && zones[b];
    if (zoneA && zoneB) {
      const centre = THREE.MathUtils.lerp((zoneA.top + zoneA.bottom) / 2, (zoneB.top + zoneB.bottom) / 2, t);
      const room = Math.max(60, THREE.MathUtils.lerp(zoneA.bottom - zoneA.top, zoneB.bottom - zoneB.top, t));
      vertical = (centre - height / 2) / height;
      view *= Math.max(1, THREE.MathUtils.lerp(A.mobileFill ?? .42, B.mobileFill ?? .42, t) * height / room);
    }
    camera.setViewOffset(width, height, -horizontal * width, -vertical * height, width, height);
    camera.position.copy(target).addScaledVector(direction, view / 2 / tanHalf);
    orbit.target.copy(target); camera.lookAt(target); camera.updateProjectionMatrix(); orbit.update();
  }
  function invalidate() { if (alive && visible && !frame) frame = requestAnimationFrame(render); }

  // ---------- animation ----------
  function animate(time) {
    wheel.rotation.z = -time * 1.1;
    for (const map of belts) map.offset.x = -(time * .45 % 1);
    const blink = Math.sin(time * 9) > 0;
    materials.ledBlink.emissiveIntensity = blink ? 1.4 : .05;
    materials.lampGreen.emissiveIntensity = 1.5 + Math.sin(time * 2.2) * .15;
  }

  function setDoors(a, b, mix) {
    const open = doorOverride ?? THREE.MathUtils.lerp(stages[a].doorOpen || 0, stages[b].doorOpen || 0, mix);
    doors.forEach(({ door, side, baseRotation }) => { door.rotation.y = baseRotation + side * smooth(open) * 1.88; });
    return open;
  }

  function render(time = performance.now()) {
    frame = 0; if (!alive || !visible) return;
    // Ambient motion is capped near 30 fps; scroll-driven camera moves render every frame.
    if (lastTime && !forceCamera && Math.abs(desired - progress) <= .001 && time - lastTime < 33) { invalidate(); return; }
    // Time-based easing: slow GPUs reach the scrolled stage in the same wall-clock time.
    const elapsed = Math.min(250, lastTime ? time - lastTime : 16); lastTime = time;
    const delta = desired - progress;
    if (Math.abs(delta) > .001) { progress = reduced ? desired : progress + delta * (1 - Math.exp(-elapsed / 110)); forceCamera = true; }
    else if (progress !== desired) { progress = desired; forceCamera = true; }
    if (forceCamera) { configureCamera(); forceCamera = false; renderer.shadowMap.needsUpdate = true; }
    if (!reduced) clock += elapsed / 1000;
    animate(clock);
    const a = Math.floor(progress), b = Math.min(stages.length - 1, a + 1), mix = smooth(progress - a);
    const open = setDoors(a, b, mix);
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
      const host = actors[id]; retiredModels.push(...host.children); host.clear(); host.add(asset.scene); renderer.shadowMap.needsUpdate = true;
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
    setZones(value) { zones = value || []; forceCamera = true; invalidate(); },
    setReduced(value) { reduced = value; if (value) { progress = desired; forceCamera = true; } invalidate(); },
    setDoor(open) { doorOverride = open ? 1 : 0; invalidate(); },
    reset() { doorOverride = null; forceCamera = true; invalidate(); },
    rotate(direction) { const offset = camera.position.clone().sub(orbit.target); offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * .16); camera.position.copy(orbit.target).add(offset); camera.lookAt(orbit.target); orbit.update(); invalidate(); },
    setVisible(value) { visible = value; if (value) { lastTime = 0; invalidate(); } else { cancelAnimationFrame(frame); frame = 0; } },
    // Captures the requested stage even when the next animation frame has not run yet (slow, CPU-only GPUs).
    capture() {
      if (forceCamera) { configureCamera(); forceCamera = false; renderer.shadowMap.needsUpdate = true; }
      const a = Math.floor(progress), b = Math.min(stages.length - 1, a + 1);
      setDoors(a, b, smooth(progress - a));
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    dispose() {
      alive = false; observer.disconnect(); orbit.dispose(); cancelAnimationFrame(frame);
      scene.traverse(o => { o.geometry?.dispose(); for (const m of [o.material].flat().filter(Boolean)) m.dispose(); });
      retiredModels.forEach(o => o.traverse(n => n.geometry?.dispose()));
      Object.values(textures).forEach(t => t.dispose()); loaded.forEach(t => t.dispose());
      environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    }
  };
}
