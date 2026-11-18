// ================= renderer / scene =================
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, .1, 500);

function canvasTex(w, h, fn, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
scene.background = canvasTex(4, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3f88d8'); g.addColorStop(.6, '#9fd0f2'); g.addColorStop(1, '#dff1fb');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});
scene.fog = new THREE.Fog(0xcde8f8, 90, 240);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a7a3a, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dc, 2.4);
sun.position.set(-18, 32, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 110 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = .02;
scene.add(sun);
const flash = new THREE.PointLight(0xffaa44, 0, 18, 1.5);
scene.add(flash);

// ground
const grassTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#5da544'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `hsl(${rand(85, 115)},${rand(35, 55)}%,${rand(30, 48)}%)`;
    c.fillRect(Math.random() * w, Math.random() * h, rand(1, 3), rand(2, 6));
  }
}, 60);
const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ map: grassTex, roughness: .95 }));
groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true;
scene.add(groundMesh);
// build pad
const padTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#c9b48a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(90,70,40,${rand(.05, .2)})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
});
const pad = new THREE.Mesh(new THREE.BoxGeometry(21.6, .12, 21.6),
  new THREE.MeshStandardMaterial({ map: padTex, roughness: 1 }));
pad.position.y = -.06 + .025; pad.receiveShadow = true; scene.add(pad);
let grid = null;
function setArena(r) {
  buildR = r; pad.scale.set((2 * r + 1.6) / 21.6, 1, (2 * r + 1.6) / 21.6);
  if (grid) scene.remove(grid);
  grid = new THREE.GridHelper(2 * r + 1, 2 * r + 1, 0xffffff, 0xffffff);
  grid.material.transparent = true; grid.material.opacity = .3; grid.position.y = .005; scene.add(grid);
  const e = Math.max(26, r * 1.5 + 6); Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, far: 90 + e }); sun.shadow.camera.updateProjectionMatrix();
}
setArena(10);
// scenery: distant trees & hills
(function scenery() {
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x7a5232 }), leafM = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: .9 });
  const trunkG = new THREE.CylinderGeometry(.25, .35, 2, 6), leafG = new THREE.ConeGeometry(1.6, 3.6, 7);
  for (let i = 0; i < 40; i++) {
    const a = rand(0, Math.PI * 2), d = rand(40, 95), s = rand(.8, 1.8);
    const t = new THREE.Group();
    const tr = new THREE.Mesh(trunkG, trunkM); tr.position.y = 1; tr.castShadow = true;
    const lf = new THREE.Mesh(leafG, leafM); lf.position.y = 3.4; lf.castShadow = true;
    t.add(tr, lf); t.scale.setScalar(s); t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    scene.add(t);
  }
  const hillM = new THREE.MeshStandardMaterial({ color: 0x7fb865, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + rand(0, .4), d = rand(110, 150);
    const h = new THREE.Mesh(new THREE.SphereGeometry(rand(18, 30), 16, 10), hillM);
    h.scale.y = rand(.35, .6); h.position.set(Math.cos(a) * d, -4, Math.sin(a) * d); scene.add(h);
  }
})();

