import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const COLORS = { shell: 0xd3d9d7, steel: 0xa9b5b3, dark: 0x303b3c, blue: 0x176bb0, teal: 0x297d72, yellow: 0xc4ab62, light: 0xeeeeea };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function createJourneyScene(mount, stages, onLost, onProject) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = innerWidth >= 700;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  mount.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf5f6f3, 20, 40);
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
  const target = V(0, 0, 0);
  const offset = V(4, 2.8, 6.5);
  camera.position.copy(offset);
  camera.lookAt(target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9faeaa, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 3.5);
  key.position.set(2, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  key.shadow.normalBias = 0.025;
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xc9dfe9, 2);
  rim.position.set(-5, 4, -4); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 35), new THREE.ShadowMaterial({ color: 0x65766f, opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(14, -1.64, 0); floor.receiveShadow = true; scene.add(floor);
  let alive = true, visible = true, frame = 0, desired = 0, progress = 0, initial = true, introStart = 0;
  let ems;
  try { ems = await new THREE.TextureLoader().loadAsync(new URL('./media/ems.webp', import.meta.url).href); ems.colorSpace = THREE.SRGBColorSpace; }
  catch { /* The static EMS image and text remain available if its texture cannot load. */ }

  const material = (color, metalness = 0.25) => new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.48 });
  const palette = Object.fromEntries(Object.entries(COLORS).map(([name, color]) => [name, material(color, name === 'steel' ? 0.65 : 0.25)]));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x647875, transparent: true, opacity: 0.25 });
  function box(group, size, at, type = 'shell', edges = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), palette[type]);
    mesh.position.set(...at); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat));
    return mesh;
  }
  function cylinder(group, radius, height, at, type = 'steel', rotate = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), palette[type]);
    mesh.position.set(...at); if (rotate) mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function cable(group, points, type = 'blue', radius = 0.018) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)), false, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 6, false), palette[type]);
    group.add(mesh); return mesh;
  }
  function screw(group, x, y, z) {
    cylinder(group, 0.032, 0.03, [x, y, z], 'steel', true);
    box(group, [0.035, 0.006, 0.01], [x, y, z + 0.019], 'dark');
  }
  function enclosure(group, w, h, depth) {
    box(group, [w, h, 0.075], [0, 0, -depth / 2], 'steel', true);
    box(group, [0.075, h, depth], [-w / 2, 0, 0], 'shell', true);
    box(group, [0.075, h, depth], [w / 2, 0, 0], 'shell', true);
    box(group, [w, 0.075, depth], [0, h / 2, 0], 'shell', true);
    box(group, [w, 0.075, depth], [0, -h / 2, 0], 'shell', true);
    box(group, [w - 0.18, h - 0.18, 0.025], [0, 0, -depth / 2 + 0.065], 'light');
  }
  function rail(group, y, count, color = 'dark') {
    box(group, [1.66, 0.085, 0.04], [0, y - 0.05, -0.21], 'steel');
    for (let i = 0; i < count; i++) {
      const x = -0.68 + i * (1.36 / count);
      box(group, [1.12 / count, 0.3, 0.25], [x, y, -0.055], color, true);
      box(group, [0.024, 0.019, 0.006], [x, y + 0.08, 0.075], 'teal');
      for (let j = 0; j < 3; j++) box(group, [0.026, 0.012, 0.008], [x, y - 0.02 - j * 0.032, 0.075], 'steel');
    }
  }
  function junction() {
    const group = new THREE.Group();
    enclosure(group, 2.1, 1.45, 0.62);
    for (const y of [-0.29, 0.29]) {
      box(group, [1.85, 0.065, 0.055], [0, y, -0.19], 'steel');
      for (let i = 0; i < 13; i++) {
        const x = -0.81 + i * 0.135;
        box(group, [0.09, 0.25, 0.2], [x, y, -0.04], i > 10 ? 'yellow' : 'light', true);
        screw(group, x, y + 0.067, 0.072);
        cable(group, [[x, y - 0.1, 0.04], [x, y - 0.18, 0.13], [x * 0.6, -0.62, 0.13]], i % 3 ? 'blue' : 'dark', 0.009);
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = -0.72 + i * 0.36;
      cylinder(group, 0.085, 0.2, [x, -0.8, 0], 'steel');
      cable(group, [[x, -0.86, 0], [x, -1.15, 0], [x + 0.4, -1.5, 0.3], [x + 0.85, -1.56, 1.3]], i === 2 ? 'blue' : 'dark', 0.03);
    }
    const lid = new THREE.Group();
    box(lid, [2.17, 1.51, 0.055], [0, 0, 0], 'shell', true);
    for (const x of [-0.96, 0.96]) for (const y of [-0.63, 0.63]) screw(lid, x, y, 0.045);
    lid.position.set(-0.32, 1.06, -0.48); lid.rotation.x = -1.05; group.add(lid);
    box(group, [0.55, 0.14, 0.006], [0.56, 0.6, 0.32], 'blue');
    return group;
  }
  function cabinet() {
    const group = new THREE.Group();
    enclosure(group, 2.0, 2.9, 0.72);
    box(group, [2.12, 0.14, 0.86], [0, -1.55, 0], 'dark', true);
    rail(group, 0.86, 7); rail(group, 0.2, 9, 'light'); rail(group, -0.45, 10, 'yellow');
    for (const x of [-0.87, 0.87]) {
      box(group, [0.13, 2.55, 0.19], [x, 0, -0.12], 'light', true);
      for (let i = 0; i < 32; i++) box(group, [0.09, 0.015, 0.01], [x, 1.21 - i * 0.078, -0.018], 'steel');
    }
    for (let i = 0; i < 13; i++) {
      const x = -0.67 + i * 0.105;
      cable(group, [[x, -0.61, 0.09], [x, -0.82, 0.1], [x * 0.84, -1.04, 0.05], [x * 0.84, -1.35, 0]], i % 3 ? 'blue' : 'yellow', 0.013);
      box(group, [0.06, 0.18, 0.14], [x, -1.15, 0], 'light', true);
    }
    const door = new THREE.Group();
    box(door, [1.95, 2.87, 0.07], [0.975, 0, 0], 'shell', true);
    box(door, [0.62, 0.44, 0.07], [0.95, 0.6, 0.07], 'dark', true);
    box(door, [0.48, 0.3, 0.01], [0.95, 0.6, 0.115], 'blue');
    for (let i = 0; i < 3; i++) cylinder(door, 0.048, 0.035, [0.69 + i * 0.25, 0.08, 0.08], i === 1 ? 'teal' : 'dark', true);
    box(door, [0.075, 0.32, 0.08], [1.76, -0.25, 0.1], 'dark');
    door.position.set(-1.04, 0, 0.39); door.rotation.y = -2.0; group.add(door);
    return group;
  }
  function drive() {
    const group = new THREE.Group();
    box(group, [1.55, 2.55, 0.7], [0, 0, -0.08], 'dark', true);
    for (let i = 0; i < 13; i++) box(group, [0.055, 2.45, 0.58], [-0.81 + i * 0.135, 0, -0.48], 'steel', true);
    box(group, [1.32, 2.26, 0.25], [0, 0.05, 0.35], 'shell', true);
    box(group, [0.97, 0.7, 0.08], [0, 0.65, 0.52], 'dark', true);
    box(group, [0.72, 0.26, 0.01], [0, 0.77, 0.57], 'blue');
    for (let i = 0; i < 4; i++) box(group, [0.12, 0.09, 0.02], [-0.29 + i * 0.19, 0.47, 0.57], 'steel');
    for (let i = 0; i < 12; i++) box(group, [0.92, 0.027, 0.018], [0, 0.09 - i * 0.071, 0.485], 'dark');
    box(group, [1.32, 0.11, 0.018], [0, -0.92, 0.488], 'blue');
    for (let i = 0; i < 3; i++) {
      cylinder(group, 0.076, 0.18, [-0.38 + i * 0.38, -1.32, 0], 'steel');
      cable(group, [[-0.38 + i * 0.38, -1.3, 0], [-0.38 + i * 0.38, -1.5, 0], [0.3 + i * 0.3, -1.6, 1.2]], 'dark', 0.032);
    }
    return group;
  }
  function processSkid() {
    const group = new THREE.Group();
    for (const z of [-0.62, 0.62]) box(group, [3.4, 0.1, 0.1], [0, -1.3, z], 'steel', true);
    for (const x of [-1.55, 1.55]) {
      box(group, [0.1, 0.1, 1.35], [x, -1.3, 0], 'steel', true);
      for (const z of [-0.62, 0.62]) box(group, [0.1, 0.25, 0.1], [x, -1.46, z], 'dark');
    }
    for (const x of [-0.8, 0.7]) {
      cylinder(group, 0.47, 1.6, [x, 0.05, 0], 'steel');
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.47, 24, 12), palette.shell);
      cap.scale.y = 0.35; cap.position.set(x, 0.87, 0); group.add(cap);
      for (const y of [-0.64, 0.66]) cylinder(group, 0.485, 0.045, [x, y, 0], 'light');
      for (const z of [-0.25, 0.25]) box(group, [0.07, 0.6, 0.07], [x, -1.02, z], 'steel');
      cylinder(group, 0.09, 0.28, [x, 1.06, 0], 'steel');
    }
    cable(group, [[-0.8, 1.16, 0], [-0.8, 1.37, 0], [0.7, 1.37, 0], [0.7, 1.16, 0]], 'steel', 0.045);
    cable(group, [[-0.8, -0.65, 0], [-0.8, -0.92, 0.64], [0.68, -0.92, 0.64], [0.7, -0.65, 0]], 'blue', 0.052);
    cylinder(group, 0.17, 0.36, [0, -0.92, 0.66], 'dark', true);
    box(group, [0.48, 0.5, 0.28], [1.52, 0.16, 0], 'shell', true);
    box(group, [0.31, 0.22, 0.012], [1.52, 0.24, 0.151], 'dark');
    cable(group, [[1.52, -0.09, 0], [1.52, -0.95, 0], [0.2, -1.2, 0.4]], 'dark', 0.018);
    return group;
  }
  function display() {
    const group = new THREE.Group();
    box(group, [2.9, 1.65, 0.2], [0, 0.35, 0], 'dark', true);
    box(group, [2.78, 1.53, 0.035], [0, 0.35, 0.115], 'steel', true);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.57, 1.23), ems ? new THREE.MeshBasicMaterial({ map: ems }) : palette.dark);
    screen.position.set(0, 0.4, 0.137); group.add(screen);
    cylinder(group, 0.025, 0.014, [1.2, -0.31, 0.15], 'teal', true);
    box(group, [0.2, 0.8, 0.18], [0, -0.8, -0.16], 'steel', true);
    box(group, [1.2, 0.09, 0.7], [0, -1.25, 0.03], 'dark', true);
    cable(group, [[0.3, -0.38, -0.05], [0.3, -0.9, -0.3], [0.8, -1.57, -0.3], [1.4, -1.57, 0.6]], 'dark', 0.023);
    return group;
  }
  const factories = [junction, cabinet, drive, processSkid, display];
  const assemblies = factories.map((create, index) => {
    const group = create();
    const center = new THREE.Box3().setFromObject(group).getCenter(V(0, 0, 0));
    group.children.forEach(child => { child.position.x -= center.x; child.position.z -= center.z; });
    group.userData.anchor = V(...stages[index].hotspot).sub(V(center.x, 0, center.z));
    group.position.x = index * 7; scene.add(group); return group;
  });
  const signals = [];
  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group();
    const tube = cable(group, [[i * 7 + 1, -1.57, 1], [i * 7 + 2, -1.57, 1.4], [i * 7 + 5, -1.57, 1.4], [i * 7 + 6.2, -1.57, 0.2]], 'blue', 0.018);
    tube.material = palette.blue.clone(); scene.add(group); signals.push(tube);
  }
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enablePan = false; orbit.enableZoom = false; orbit.enableDamping = false;
  orbit.minPolarAngle = Math.PI * 0.29; orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.minAzimuthAngle = -0.5; orbit.maxAzimuthAngle = 1.2; orbit.rotateSpeed = 0.45;
  orbit.enabled = matchMedia('(pointer: fine)').matches;
  orbit.addEventListener('change', invalidate);

  function fit() {
    const { width, height } = mount.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const viewHeight = Math.max(4.8, 5.8 / aspect);
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
    orbit.enabled = matchMedia('(pointer: fine)').matches;
    renderer.domElement.style.touchAction = orbit.enabled ? 'none' : 'pan-y';
    invalidate();
  }
  const resize = new ResizeObserver(fit); resize.observe(mount);
  function invalidate() { if (alive && visible && !frame) frame = requestAnimationFrame(render); }
  function render(time) {
    frame = 0;
    if (!alive || !visible) return;
    if (!introStart) introStart = time;
    const delta = desired - progress;
    if (Math.abs(delta) > 0.0005) {
      progress += delta * 0.13;
      const x = progress * 7;
      const shift = x - target.x;
      target.x = x;
      camera.position.x += shift; orbit.target.copy(target);
      key.position.x = x + 2; key.target.position.x = x;
      orbit.update();
    }
    const intro = Math.min(1, (time - introStart) / 1100);
    for (const mat of Object.values(palette)) {
      mat.transparent = intro < 1; mat.opacity = intro;
    }
    edgeMat.opacity = 0.25 + (1 - intro) * 0.6;
    assemblies.forEach((group, i) => { group.visible = Math.abs(i - progress) < 1.05; });
    signals.forEach((line, i) => line.material.color.setHex(progress >= i + 0.15 ? COLORS.blue : 0xaabbb4));
    renderer.render(scene, camera);
    const index = Math.round(progress);
    if (Math.abs(index - progress) < 0.06 && assemblies[index].userData.anchor) {
      const point = assemblies[index].localToWorld(assemblies[index].userData.anchor.clone()).project(camera);
      onProject?.({ x: (point.x + 1) * mount.clientWidth / 2, y: (1 - point.y) * mount.clientHeight / 2 });
    } else onProject?.(null);
    if (Math.abs(delta) > 0.0005 || intro < 1) invalidate();
  }
  const lost = event => { event.preventDefault(); visible = false; onLost(); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  const restored = () => { onLost(); };
  renderer.domElement.addEventListener('webglcontextrestored', restored);

  function disposeGroup(group) {
    group.traverse(object => {
      object.geometry?.dispose();
      if (object.material) for (const mat of [object.material].flat()) {
        for (const value of Object.values(mat)) if (value?.isTexture) value.dispose();
        mat.dispose();
      }
    });
  }
  // The conceptual assembly remains in place while an approved replacement loads or fails.
  const retired = [];
  for (const [index, stage] of stages.entries()) if (stage.modelUrl) {
    import('three/addons/loaders/GLTFLoader.js').then(async ({ GLTFLoader }) => {
      const gltf = await new GLTFLoader().loadAsync(new URL(stage.modelUrl, import.meta.url).href);
      if (!alive) { disposeGroup(gltf.scene); return; }
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      const size = bounds.getSize(V(0, 0, 0));
      const center = bounds.getCenter(V(0, 0, 0));
      if (bounds.isEmpty()) throw new Error('Empty model');
      const scale = Math.min(stage.modelHeight / Math.max(size.y, 0.001), 4 / Math.max(size.x, 0.001), 2.5 / Math.max(size.z, 0.001));
      gltf.scene.position.copy(center.multiplyScalar(-scale));
      gltf.scene.scale.setScalar(scale);
      const replacement = new THREE.Group(); replacement.add(gltf.scene); replacement.position.x = index * 7;
      replacement.rotation.copy(assemblies[index].rotation);
      replacement.userData.anchor = V(...stage.hotspot);
      scene.remove(assemblies[index]); retired.push(assemblies[index]); assemblies[index] = replacement; scene.add(replacement); invalidate();
    }).catch(() => { /* Keep the conceptual assembly and readable page if a replacement is unavailable. */ });
  }
  fit(); invalidate();
  return {
    setProgress(value, opening) {
      desired = value;
      if (initial) {
        progress = desired; target.x = progress * 7;
        camera.position.copy(target).add(offset); orbit.target.copy(target); orbit.update(); initial = false;
      }
      if (!opening) introStart = -10000;
      invalidate();
    },
    rotate(direction) { assemblies[Math.round(progress)].rotation.y += direction * 0.18; invalidate(); },
    reset() { assemblies.forEach(group => { group.rotation.y = 0; }); camera.position.copy(target).add(offset); orbit.target.copy(target); orbit.update(); invalidate(); },
    setVisible(value) { visible = value; if (visible) invalidate(); else { cancelAnimationFrame(frame); frame = 0; } },
    dispose() {
      alive = false; cancelAnimationFrame(frame); resize.disconnect(); orbit.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.domElement.removeEventListener('webglcontextrestored', restored);
      disposeGroup(scene); retired.forEach(disposeGroup); ems?.dispose(); renderer.dispose(); renderer.domElement.remove();
    }
  };
}
