import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { makePhysics, V3, Q4, GRAV } from './phys.js';
try { await RAPIER.init(); } catch (e) { document.getElementById('err').style.display = 'flex'; throw e; }

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

// ================= definitions =================
// piece specs: {mat, shape:'box'|'cyl'|'cone'|'wedge', d:[...]}
const Bx = (mat, x, y, z) => ({ mat, shape: 'box', d: [x, y, z] });
const Cy = (mat, r, h, rb) => ({ mat, shape: 'cyl', d: [r, rb || r, h] });
const Co = (mat, r, h) => ({ mat, shape: 'cone', d: [r, h] });
const We = (mat, L, h, W) => ({ mat, shape: 'wedge', d: [L, h, W] });
const DENS = { wood: .9, stone: 2.2, glass: 1.4, tnt: 1, roof: 1.6, marble: 2.4, lacquer: .9, concrete: 2, domino: .9, sand: 1.9, gold: 3 };
// align: which local axis should line up with the camera's left-right
const BLOCKS = {
  wood:   { label: 'Wood',   spec: Bx('wood', 1, 1, 1) },
  stone:  { label: 'Stone',  spec: Bx('stone', 1, 1, 1) },
  glass:  { label: 'Glass',  spec: Bx('glass', 1, 1, 1) },
  tnt:    { label: 'TNT',    spec: Bx('tnt', 1, 1, 1) },
  plank:  { label: 'Plank',  spec: Bx('wood', 2, .4, 1), align: 'x' },
  long:   { label: 'Long',   spec: Bx('stone', 2, 1, 1), align: 'x' },
  pillar: { label: 'Pillar', spec: Bx('stone', .5, 2, .5) },
  column: { label: 'Column', spec: Cy('marble', .32, 1.5, .36) },
  roof:   { label: 'Roof',   spec: We('roof', 2, .8, 1.2), align: 'x' },
  spire:  { label: 'Spire',  spec: Co('roof', .7, 1.4) },
  domino: { label: 'Domino', spec: Bx('domino', .18, 1.1, .55), align: 'z' }
};
const PROJ = {
  ball:    { label: 'Baseball',   shape: 'sphere', r: .25, mass: .6, rest: .5 },
  bowling: { label: 'Bowling',    shape: 'sphere', r: .42, mass: 7,  rest: .1 },
  cannon:  { label: 'Cannonball', shape: 'sphere', r: .34, mass: 14, rest: .05 },
  brick:   { label: 'Brick',      shape: 'box', size: [.9, .45, .45], mass: 3, rest: .05 },
  anvil:   { label: 'Anvil',      shape: 'box', size: [1.1, .7, .6],  mass: 25, rest: 0 },
  boulder: { label: 'Boulder',    shape: 'rock', r: .6, mass: 30, rest: .05 },
  bomb:    { label: 'Bomb',       shape: 'sphere', r: .36, mass: 2,  rest: .3, bomb: true },
  cluster: { label: 'Cluster',    shape: 'sphere', r: .34, mass: 2.5, rest: .2, special: true },
  rocket:  { label: 'Rocket',     shape: 'sphere', r: .22, mass: 4,  rest: 0, special: true },
  meteor:  { label: 'Meteors',    shape: 'rock', r: .55, mass: 60, rest: 0, special: true },
  hole:    { label: 'Black hole', shape: 'sphere', r: .4, mass: 3,  rest: .1, special: true },
  nuke:    { label: 'Nuke',       shape: 'sphere', r: .55, mass: 30, rest: .1, special: true }
};
const SIZES = [['S', .6], ['M', 1], ['L', 1.6], ['XL', 2.5]];
let buildR = 10; const MAX_H = 22, MIN_SPEED = 9, MAX_SPEED = 55, CHARGE_MS = 1300;

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

// ================= materials =================
const woodTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#c98a4b'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    c.strokeStyle = `rgba(110,60,20,${rand(.15, .45)})`; c.lineWidth = rand(1, 3);
    const y = rand(0, h); c.beginPath(); c.moveTo(0, y);
    c.bezierCurveTo(w * .3, y + rand(-6, 6), w * .7, y + rand(-6, 6), w, y + rand(-4, 4)); c.stroke();
  }
  c.strokeStyle = 'rgba(90,50,15,.8)'; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
});
const stoneTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#9aa2aa'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '60,66,74' : '220,225,230'},${rand(.08, .25)})`;
    c.beginPath(); c.arc(Math.random() * w, Math.random() * h, rand(1, 5), 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(60,64,70,.8)'; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
});
const tntTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#d4302a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#f2ead8'; c.fillRect(0, h * .34, w, h * .32);
  c.fillStyle = '#111'; c.font = 'bold 34px Impact, Arial Black, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('TNT', w / 2, h / 2 + 1);
  c.strokeStyle = 'rgba(80,10,10,.8)'; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
});
const marbleTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#ece7dc'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) { c.strokeStyle = `rgba(120,115,110,${rand(.12, .3)})`; c.lineWidth = rand(.5, 2); c.beginPath();
    let x = rand(0, w), y = 0; c.moveTo(x, y); while (y < h) { x += rand(-10, 10); y += rand(6, 14); c.lineTo(x, y); } c.stroke(); }
});
const roofTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#b8472e'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(70,15,5,.35)'; c.fillRect(0, y + 12, w, 4);
    for (let x = (y / 16 % 2) * 8; x < w; x += 16) { c.fillStyle = 'rgba(60,10,0,.25)'; c.fillRect(x, y, 2, 12); } }
});
const lacquerTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#9c2a1f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d9a63a'; c.lineWidth = 4; c.strokeRect(0, 0, w, h); });
const concreteTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#c9cbcd'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(80,80,80,${rand(.03, .12)})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
});
const dominoTex = canvasTex(64, 128, (c, w, h) => {
  c.fillStyle = '#f6f1e3'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.fillRect(6, h / 2 - 2, w - 12, 4);
  [[.3, .2], [.7, .35], [.5, .27], [.3, .65], [.7, .65], [.3, .82], [.7, .82]].forEach(([x, y]) => { c.beginPath(); c.arc(x * w, y * h, 5, 0, 7); c.fill(); });
  c.strokeStyle = '#222'; c.lineWidth = 4; c.strokeRect(0, 0, w, h);
});
const sandTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#d9b97c'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '120,90,40' : '255,240,200'},${rand(.06, .2)})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  c.strokeStyle = 'rgba(120,90,45,.7)'; c.lineWidth = 5; c.strokeRect(0, 0, w, h);
});
const MATS = {
  wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: .8 }),
  stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: .9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xcdeeff, transparent: true, opacity: .5, roughness: .05, metalness: .2, depthWrite: false }),
  tnt: new THREE.MeshStandardMaterial({ map: tntTex, roughness: .7 }),
  marble: new THREE.MeshStandardMaterial({ map: marbleTex, roughness: .35 }),
  roof: new THREE.MeshStandardMaterial({ map: roofTex, roughness: .8 }),
  lacquer: new THREE.MeshStandardMaterial({ map: lacquerTex, roughness: .4 }),
  concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: .9 }),
  domino: new THREE.MeshStandardMaterial({ map: dominoTex, roughness: .3 }),
  sand: new THREE.MeshStandardMaterial({ map: sandTex, roughness: .95 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffcc4d, roughness: .3, metalness: .35, emissive: 0x5a3c00, emissiveIntensity: .6 })
};
const glassEdgeMat = new THREE.LineBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: .9 });

// ---- piece geometry + physics shapes (cached) ----
function wedgeData(L, h, W) {
  return { v: [[-L / 2, -h / 2, -W / 2], [L / 2, -h / 2, -W / 2], [L / 2, -h / 2, W / 2], [-L / 2, -h / 2, W / 2], [-L / 2, h / 2, 0], [L / 2, h / 2, 0]],
           f: [[0, 1, 2, 3], [0, 4, 5, 1], [3, 2, 5, 4], [0, 3, 4], [1, 5, 2]] };
}
const geoCache = {}, edgeCache = {};
const specKey = s => s.shape + ':' + s.d.map(n => n.toFixed(3)).join(',');
function specGeo(s) {
  const k = specKey(s); if (geoCache[k]) return geoCache[k];
  let g; const d = s.d;
  if (s.shape === 'box') g = new THREE.BoxGeometry(d[0], d[1], d[2]);
  else if (s.shape === 'cyl') g = new THREE.CylinderGeometry(d[0], d[1], d[2], 18);
  else if (s.shape === 'cone') g = new THREE.ConeGeometry(d[0], d[1], 16);
  else {
    const { v, f } = wedgeData(d[0], d[1], d[2]), pos = [], uv = [];
    for (const face of f) for (let i = 1; i < face.length - 1; i++) for (const idx of [face[0], face[i], face[i + 1]]) {
      const p = v[idx]; pos.push(...p); uv.push(p[0] / d[0] + .5, (p[1] / d[1] + .5) * .5 + (p[2] / d[2] + .5) * .5);
    }
    g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  }
  return geoCache[k] = g;
}
function specEdges(s) { const k = specKey(s); return edgeCache[k] || (edgeCache[k] = new THREE.EdgesGeometry(specGeo(s), 30)); }
function specPhys(s) {
  const d = s.d;
  if (s.shape === 'box') return { kind: 'box', hx: d[0] / 2, hy: d[1] / 2, hz: d[2] / 2 };
  if (s.shape === 'cyl') return { kind: 'cyl', r: (d[0] + d[1]) / 2, hh: d[2] / 2 };
  if (s.shape === 'cone') return { kind: 'cone', r: d[0], hh: d[1] / 2 };
  const { v } = wedgeData(d[0], d[1], d[2]);
  return { kind: 'hull', points: new Float32Array(v.flat()), radius: Math.hypot(d[0], d[1], d[2]) / 2, vol: d[0] * d[1] * d[2] / 2 };
}
function specVolume(s) {
  const d = s.d;
  if (s.shape === 'box') return d[0] * d[1] * d[2];
  if (s.shape === 'cyl') return Math.PI * ((d[0] + d[1]) / 2) ** 2 * d[2];
  if (s.shape === 'cone') return Math.PI * d[0] * d[0] * d[1] / 3;
  return d[0] * d[1] * d[2] / 2;
}
const specHeight = s => s.shape === 'cyl' ? s.d[2] : s.d[1];

// ---- instanced rendering: one draw call per (shape, material), so 1000-block builds stay smooth ----
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const batches = new Map(), batchMeshes = [];
const _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
class Batch {
  constructor(geo, mat, cast) { this.geo = geo; this.mat = mat; this.cast = cast; this.items = []; this.cap = 0; this.mesh = null; this.grow(64); }
  grow(cap) {
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = this.cast; m.receiveShadow = true; m.frustumCulled = false; m.userData.batch = this;
    if (this.mesh) {
      m.instanceMatrix.array.set(this.mesh.instanceMatrix.array.subarray(0, this.items.length * 16));
      scene.remove(this.mesh); batchMeshes[batchMeshes.indexOf(this.mesh)] = m; this.mesh.dispose();
    } else batchMeshes.push(m);
    m.count = this.items.length; this.mesh = m; this.cap = cap; scene.add(m);
  }
  add(o) { if (this.items.length >= this.cap) this.grow(this.cap * 2); o.batch = this; o.bi = this.items.length; this.items.push(o); this.mesh.count = this.items.length; o.mdirty = true; }
  remove(o) {
    const i = o.bi, last = this.items.pop();
    if (last !== o) { this.items[i] = last; last.bi = i; last.mdirty = true; }
    this.mesh.count = this.items.length; o.batch = null;
  }
  sync() {
    let any = false;
    for (const o of this.items) { if (!o.mdirty) continue; writeMatrix(o); any = true; }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
function writeMatrix(o) {
  const b = o.body, k = o.pop ? Math.max(.01, 1 - o.pop * o.pop) : 1;
  _p.set(b.position.x, b.position.y, b.position.z); _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  _s.set(o.sc[0] * k, o.sc[1] * k, o.sc[2] * k);
  o.batch.mesh.setMatrixAt(o.bi, _m4.compose(_p, _q, _s)); o.mdirty = !!o.pop;
}
function batchFor(spec) {
  const unit = spec.shape === 'box', key = (unit ? 'box' : specKey(spec)) + '|' + spec.mat;
  let b = batches.get(key);
  if (!b) { b = new Batch(unit ? UNIT_BOX : specGeo(spec), MATS[spec.mat], spec.mat !== 'glass'); batches.set(key, b); }
  return b;
}
function pickables() { for (const m of batchMeshes) { m.boundingSphere = null; m.boundingBox = null; } return batchMeshes; }
function objFromHit(h) { return h.object.isInstancedMesh ? h.object.userData.batch.items[h.instanceId] : null; }

const ballTex = canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#f8f6ee'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#d22'; c.lineWidth = 4; c.setLineDash([6, 5]);
  c.beginPath(); for (let x = 0; x <= w; x += 4) c.lineTo(x, h / 2 + Math.sin(x / w * Math.PI * 4) * h * .28); c.stroke();
});
const brickTex = canvasTex(128, 64, (c, w, h) => {
  c.fillStyle = '#b5452e'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(60,10,0,${rand(.05, .2)})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
});
const PMATS = {
  ball: new THREE.MeshStandardMaterial({ map: ballTex, roughness: .6 }),
  bowling: new THREE.MeshStandardMaterial({ color: 0x2a3590, roughness: .15, metalness: .3 }),
  brick: new THREE.MeshStandardMaterial({ map: brickTex, roughness: .95 }),
  anvil: new THREE.MeshStandardMaterial({ color: 0x3d434b, roughness: .35, metalness: .85 }),
  bomb: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .3, metalness: .4 }),
  cannon: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: .45, metalness: .75 }),
  boulder: new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x9a8f80, roughness: 1, flatShading: true })
};
// boulder: a squashed icosahedron (convex, so the physics engine can use it directly)
function rockData(r) {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map(p => { const l = Math.hypot(...p); return [p[0] / l * r * 1.15, p[1] / l * r * .82, p[2] / l * r]; });
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
    .map(([a, b, c]) => { // make every face wind counter-clockwise seen from outside
      const A = v[a], B = v[b], C = v[c], u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      return n[0] * (A[0] + B[0] + C[0]) + n[1] * (A[1] + B[1] + C[1]) + n[2] * (A[2] + B[2] + C[2]) > 0 ? [a, b, c] : [a, c, b]; });
  return { v, f };
}
function makeProjMesh(kind, f = 1) {
  if (PROJ[kind] && PROJ[kind].special) { const m = makeSpecialMesh(kind); m.scale.setScalar(Math.min(f, 1.2)); return m; }
  const p = PROJ[kind]; let m;
  if (kind === 'boulder') {
    const { v, f: faces } = rockData(p.r), pos = [];
    for (const fc of faces) for (const i of fc) pos.push(...v[i]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / p.r * .5 + .5, pos[i + 1] / p.r * .5 + .5);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    m = new THREE.Mesh(g, PMATS.boulder);
  } else if (kind === 'anvil') {
    const g = new THREE.Group(), [w, h, d] = p.size;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, h * .3, d), PMATS.anvil); top.position.y = h * .35;
    const waist = new THREE.Mesh(new THREE.BoxGeometry(w * .45, h * .4, d * .6), PMATS.anvil);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w * .75, h * .3, d), PMATS.anvil); base.position.y = -h * .35;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(h * .15, w * .35, 8), PMATS.anvil); horn.rotation.z = Math.PI / 2; horn.position.set(w * .67, h * .35, 0);
    g.add(top, waist, base, horn); m = g;
  } else if (p.shape === 'sphere') {
    m = new THREE.Mesh(new THREE.SphereGeometry(p.r, 24, 16), PMATS[kind]);
    if (kind === 'bowling') {
      const hm = new THREE.MeshBasicMaterial({ color: 0x05060f });
      [[.25, .85, .1], [.05, .9, .3], [-.12, .88, .12]].forEach(([x, y, z]) => {
        const h = new THREE.Mesh(new THREE.CircleGeometry(p.r * .12, 10), hm);
        const v = new THREE.Vector3(x, y, z).normalize(); h.position.copy(v).multiplyScalar(p.r * 1.005); h.lookAt(v.multiplyScalar(2)); m.add(h);
      });
    }
    if (kind === 'bomb') {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(p.r * .25, p.r * .25, p.r * .3, 10), new THREE.MeshStandardMaterial({ color: 0x444 }));
      cap.position.y = p.r * .95; m.add(cap);
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, p.r * .6, 5), new THREE.MeshStandardMaterial({ color: 0xc9a46a }));
      fuse.position.set(p.r * .12, p.r * 1.3, 0); fuse.rotation.z = -.4; m.add(fuse);
    }
  } else {
    m = new THREE.Mesh(new THREE.BoxGeometry(...p.size), PMATS[kind]);
  }
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  m.scale.setScalar(f);
  return m;
}

// ================= physics =================
const P = makePhysics(RAPIER);

// ---- Dormant blocks: resting pieces far from any action are drawn but NOT simulated. ----
// They sit in a spatial hash and join the physics world (still asleep) the moment anything
// moving comes near, so a 5,000-block castle costs almost nothing until you hit it.
const HC = 2, dormant = new Map();
const hkey = (x, y, z) => ((x + 300) * 700 + (y + 300)) * 700 + (z + 300);
const overlap = (a, b, pad) => b.lowerBound.x <= a.upperBound.x + pad && b.upperBound.x >= a.lowerBound.x - pad &&
  b.lowerBound.y <= a.upperBound.y + pad && b.upperBound.y >= a.lowerBound.y - pad && b.lowerBound.z <= a.upperBound.z + pad && b.upperBound.z >= a.lowerBound.z - pad;
function forCells(a, pad, fn) {
  for (let x = Math.floor((a.lowerBound.x - pad) / HC); x <= Math.floor((a.upperBound.x + pad) / HC); x++)
    for (let y = Math.floor((a.lowerBound.y - pad) / HC); y <= Math.floor((a.upperBound.y + pad) / HC); y++)
      for (let z = Math.floor((a.lowerBound.z - pad) / HC); z <= Math.floor((a.upperBound.z + pad) / HC); z++) fn(hkey(x, y, z));
}
function makeDormant(o) {
  o.dormant = true; o.aabb = o.body.getAABB(); o.cells = [];
  forCells(o.aabb, 0, k => { let st = dormant.get(k); if (!st) dormant.set(k, st = new Set()); st.add(o); o.cells.push(k); });
}
function unDormant(o) {
  for (const k of o.cells) { const st = dormant.get(k); if (st) { st.delete(o); if (!st.size) dormant.delete(k); } }
  o.cells = null; o.dormant = false;
}
function activate(o) { if (!o.dormant || o.gone) return; unDormant(o); o.body.attach(true); }   // joins asleep
function activateNear(aabb, pad) {
  const found = new Set();
  forCells(aabb, pad, k => { const st = dormant.get(k); if (st) for (const o of st) if (overlap(aabb, o.aabb, pad)) found.add(o); });
  for (const o of found) activate(o);
}
function preActivate() {   // anything awake pulls nearby dormant blocks into the simulation
  if (!dormant.size) return;
  for (const pb of [...P.bodies()]) {
    if (pb.isSleeping()) continue;
    const sp = pb.velocity.length() + pb.angularVelocity.length() * pb.boundingRadius;
    activateNear(pb.getAABB(), .25 + sp / 60 * 3);
  }
}
function deactivateResting() {      // once everything has settled, send sleeping blocks back to dormancy
  for (const pb of [...P.bodies()]) { const o = pb.userData; if (o && o.type === 'block' && !o.gone && pb.isSleeping()) { pb.detach(); makeDormant(o); } }
}

// ================= state =================
let mode = 'build', curBlock = 'wood', curProj = 'ball', slow = false, muted = false;
let objs = [];          // {body, mesh, type, kind, ...}
let placed = [], snapshot = null, dirty = true;
let pendingBreak = new Set(), pendingBoom = [], simTime = 0;
let shake = 0;
const hintDone = { build: false, throw: false };

function addObj(o) { o.body.userData = o; if (o.dormant) makeDormant(o); else o.body.attach(false); if (o.mesh) scene.add(o.mesh); else batchFor(o.spec).add(o); objs.push(o); return o; }
function removeObj(o) {
  if (o.gone) return; o.gone = true;
  if (o.dormant) unDormant(o); else o.body.detach(); if (o.mesh) scene.remove(o.mesh); else if (o.batch) o.batch.remove(o);
}
function wakeAll() { for (const pb of P.bodies()) pb.wakeUp(); }


function createPiece(spec, x, y, z, quat, sleep) {
  const body = new P.PBody({ shape: specPhys(spec), density: DENS[spec.mat], pos: new V3(x, y, z), quat: quat ? quat.clone() : new Q4(), ad: spec.mat === 'domino' ? .01 : .05 });
  return addObj({ body, dormant: !!sleep, sc: spec.shape === 'box' ? spec.d : [1, 1, 1], type: 'block', spec, mat: spec.mat, breakable: spec.mat === 'glass', tnt: spec.mat === 'tnt', pop: 0 });
}
const qY = a => a ? Q4.yaw(a) : null;
// place a piece by the height of its BOTTOM
let COUNTING = null;
function put(spec, x, yBase, z, rotY) { if (COUNTING !== null) { COUNTING++; return null; } return createPiece(spec, x, yBase + specHeight(spec) / 2 + .003, z, qY(rotY), true); }
function syncMesh(o) { if (!o.mesh) return; o.mesh.position.copy(o.body.position); o.mesh.quaternion.copy(o.body.quaternion); }

// ================= collisions =================
let lastSnd = 0;
const UPV = new V3(0, 1, 0);
function tiltOf(b) { return Math.acos(clamp(b.quaternion.vmult(UPV).y, -1, 1)); }
// Help domino chains along: when a leaning domino touches the next one, pass its tipping motion on.
function dominoAssist() {
  const ds = objs.filter(o => !o.gone && o.mat === 'domino');
  if (ds.length < 2) return;
  for (const h of ds) {
    if (h.body.isSleeping()) continue;
    const th = tiltOf(h.body); if (th < .15 || th > 1.3) continue;
    const up = h.body.quaternion.vmult(UPV), l = Math.hypot(up.x, up.z) || 1, dx = up.x / l, dz = up.z / l;
    const a = h.body.getAABB(), hp = h.body.position;
    const near = objs.filter(o => !o.gone && o.type === 'block' && o.mat !== 'domino' && !o.tipped && o.body.position.distanceTo(hp) < 3);
    for (const t of ds.concat(near)) {
      if (t === h || t.tipped) continue;
      const tp = t.body.position;
      if ((tp.x - hp.x) * dx + (tp.z - hp.z) * dz <= 0) continue;
      const b = t.body.getAABB(), pad = .03;
      if (b.lowerBound.x > a.upperBound.x + pad || b.upperBound.x < a.lowerBound.x - pad || b.lowerBound.z > a.upperBound.z + pad || b.upperBound.z < a.lowerBound.z - pad || b.lowerBound.y > a.upperBound.y) continue;
      if (tiltOf(t.body) > .5) continue;
      t.tipped = true; activate(t);
      const ax = t.body.quaternion.vmult(new V3(1, 0, 0)); let fx = ax.x, fz = ax.z; const fl = Math.hypot(fx, fz) || 1;
      fx /= fl; fz /= fl; if (fx * dx + fz * dz < 0) { fx = -fx; fz = -fz; }
      if (t.tnt) { pendingBreak.add(t); continue; }   // a falling domino sets off TNT
      if (t.mat !== 'domino') { fx = dx; fz = dz; }
      const hh = specHeight(t.spec), J = t.body.mass * 1.6 * Math.sqrt(hh);
      t.body.applyImpulse(new V3(fx * J, 0, fz * J), new V3(0, hh * .45, 0));
    }
  }
}
function onHit(a, b, impact) { if (a && a.userData) handleHit(a.userData, b, impact); if (b && b.userData) handleHit(b.userData, a, impact); }
function handleHit(o, other, impact) {
  if (o.gone) return;
  const om = other ? other.mass : o.body.mass * 2;
  const eff = impact * clamp(Math.sqrt(om / o.body.mass), .5, 3);
  if ((o.bomb || o.hole) && !o.fuse && o.launched) o.fuse = simTime + (o.rocket || o.meteor ? .01 : o.hole ? .05 : .18);
  if ((o.breakable && eff > 7) || (o.tnt && eff > 6)) pendingBreak.add(o);
  if (impact > 2.5 && o.type !== 'shard') {
    const t = performance.now();
    if (t - lastSnd > 40) {
      lastSnd = t; const v = clamp(impact / 14, .12, 1);
      const m = [o.mat, other && other.userData && other.userData.mat];
      (m.includes('stone') || m.includes('marble') || m.includes('concrete') || m.includes('sand')) ? snd.clack(v) : m.includes('glass') ? snd.tink(v) : snd.thud(v);
    }
  }
}

function shatter(o) {
  if (o.gone) return;
  const p = o.body.position.clone(), v = o.body.velocity.clone(), sc = Math.cbrt(specVolume(o.spec));
  removeObj(o);
  const shards = objs.filter(q => q.type === 'shard' && !q.gone);
  for (let i = 0; i < shards.length - 90; i++) removeObj(shards[i]);
  for (let i = 0; i < 7; i++) {
    const s = rand(.18, .34) * sc;
    const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)));
    const body = new P.PBody({ shape: { kind: 'box', hx: s / 2, hy: s / 8, hz: s / 2 }, mass: .15 * sc, events: false,
      pos: new V3(p.x + rand(-.35, .35) * sc, p.y + rand(-.35, .35) * sc, p.z + rand(-.35, .35) * sc), quat: new Q4(tq.x, tq.y, tq.z, tq.w) });
    body.velocity.set(v.x * .5 + rand(-3, 3), v.y * .5 + rand(0, 4), v.z * .5 + rand(-3, 3));
    body.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    addObj({ body, spec: Bx('glass', s, s / 4, s), sc: [s, s / 4, s], mat: 'glass', type: 'shard', born: simTime });
  }
  for (let i = 0; i < 24; i++) spawnP(p.x, p.y, p.z, rand(-4, 4), rand(-1, 5), rand(-4, 4), .7, [.85, .95, 1], .12, -12, 0);
  wakeAll(); snd.glass(1);
}

const flashMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false }));
flashMesh.visible = false; scene.add(flashMesh);
let flashT = 0;
function explode(o, power = 1) {
  if (o.gone) return;
  const c = o.body.position.clone(); removeObj(o);
  explodeAt(c, power);
  if (o.nuke) nukeFX(c);
}
function explodeAt(c, power = 1) {
  const R = 5 * power, K = 26 * power;
  for (const q of objs) {
    if (q.gone) continue;
    const qp = q.body.position, dist = Math.hypot(qp.x - c.x, qp.y - c.y, qp.z - c.z) || .01;
    if (dist > R) continue;
    activate(q); const f = 1 - dist / R, imp = K * f * Math.sqrt(q.body.mass);
    q.body.applyImpulse(new V3((qp.x - c.x) / dist * imp, ((qp.y - c.y) / dist + .45) * imp, (qp.z - c.z) / dist * imp));
    const w = q.body.angularVelocity; q.body.setAngularVelocity(w.x + rand(-6, 6) * f, w.y + rand(-6, 6) * f, w.z + rand(-6, 6) * f);
    if (q.breakable && dist < R * .6) pendingBreak.add(q);
    if (q.tnt && dist < R * .7 && !q.chain) { q.chain = true; pendingBoom.push({ o: q, t: simTime + rand(.08, .2) }); }
  }
  flashMesh.position.copy(c); flashMesh.visible = true; flashT = 1;
  flash.position.copy(c); flash.intensity = 60 * power;
  for (let i = 0; i < 70; i++) { const a = rand(0, 6.28), e = rand(-.3, 1.3), s = rand(3, 11) * power;
    spawnP(c.x, c.y, c.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, rand(.35, .8), [1, rand(.45, .85), rand(.05, .25)], rand(.35, .7), -3, 1.5); }
  for (let i = 0; i < 30; i++) spawnP(c.x + rand(-.6, .6), c.y + rand(0, .8), c.z + rand(-.6, .6), rand(-1.5, 1.5), rand(1, 3.5), rand(-1.5, 1.5), rand(1.2, 2.2), [.35, .35, .35].map(x => x + rand(0, .15)), rand(.7, 1.2), 0, 2.2, .55);
  for (let i = 0; i < 26; i++) spawnP(c.x, c.y, c.z, rand(-9, 9), rand(3, 13), rand(-9, 9), rand(.8, 1.6), [.25, .18, .1], .14, -20, 0);
  shake = .55 * power; snd.boom();
  try { navigator.vibrate && navigator.vibrate(70); } catch (e) {}
}

// ================= particles =================
const MAXP = 2600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 500 } }, transparent: true, depthWrite: false,
  vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
    void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*uScale/-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vC, vA*smoothstep(.5,.15,d)); }`
});
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; scene.add(pPoints);
let parts = [];
function spawnP(x, y, z, vx, vy, vz, life, col, size, grav, grow, alpha = 1) {
  if (parts.length >= MAXP) parts.shift();
  parts.push({ x, y, z, vx, vy, vz, t: 0, life, col, size, grav, grow, alpha });
}
function updateParticles(dt) {
  let n = 0;
  parts = parts.filter(p => (p.t += dt) < p.life);
  for (const p of parts) {
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < .05) { p.y = .05; p.vy *= -.3; p.vx *= .7; p.vz *= .7; }
    const k = p.t / p.life;
    pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z;
    pCol[n * 3] = p.col[0]; pCol[n * 3 + 1] = p.col[1]; pCol[n * 3 + 2] = p.col[2];
    pSize[n] = p.size * (1 + p.grow * k); pAlpha[n] = p.alpha * (1 - k * k);
    n++;
  }
  pGeo.setDrawRange(0, n);
  for (const a of ['position', 'color', 'size', 'alpha']) pGeo.attributes[a].needsUpdate = true;
}

// ================= camera =================
const cam = { theta: -.55, el: .42, r: 27, tTheta: -.55, tEl: .42, tR: 27, target: new THREE.Vector3(0, 2.4, 0) };
function applyCamera(dt) {
  const k = 1 - Math.pow(.0005, dt);
  cam.theta += (cam.tTheta - cam.theta) * k; cam.el += (cam.tEl - cam.el) * k; cam.r += (cam.tR - cam.r) * k;
  const c = Math.cos(cam.el);
  camera.position.set(cam.target.x + Math.sin(cam.theta) * c * cam.r, cam.target.y + Math.sin(cam.el) * cam.r, cam.target.z + Math.cos(cam.theta) * c * cam.r);
  camera.lookAt(cam.target);
  if (shake > .01) { camera.position.x += rand(-1, 1) * shake; camera.position.y += rand(-1, 1) * shake; shake *= Math.pow(.02, dt); }
}
function orbit(dTheta, dEl) {
  cam.tTheta += dTheta;
  cam.tEl = clamp(cam.tEl + dEl, .06, 1.35);
}
function zoom(f) { cam.tR = clamp(cam.tR * f, mode === 'throw' ? 11 : 7, 95); }

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 68 : 52; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
addEventListener('resize', resize);

// ================= building =================
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function camRightIsX() { const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); return Math.abs(r.x) >= Math.abs(r.z); }
function snapAxis(v, size) { const n = Math.round(size); return (n >= 2 && n % 2 === 0) ? Math.round(v - .5) + .5 : Math.round(v); }
function placeAt(sx, sy) {
  ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...pickables(), pad, groundMesh], false);
  if (!hits.length) return;
  const h = hits[0]; let pt = h.point.clone(); const ho = objFromHit(h);
  if (ho && h.face) {
    const q = ho.body.quaternion, n = h.face.normal.clone().applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    if (n.y < .7) pt.add(n.multiplyScalar(.5));
  }
  const k = BLOCKS[curBlock], spec = k.spec;
  const hgt = specHeight(spec);
  let fx, fz;
  if (spec.shape === 'box' || spec.shape === 'wedge') { fx = spec.d[0]; fz = spec.d[2]; } else { fx = fz = 2 * Math.max(spec.d[0], spec.d[1] || 0); }
  let rot = 0;
  if (k.align) {
    const rx = camRightIsX();
    if ((k.align === 'x' && !rx) || (k.align === 'z' && rx)) { rot = Math.PI / 2; [fx, fz] = [fz, fx]; }
  }
  const x = snapAxis(pt.x, fx), z = snapAxis(pt.z, fz);
  if (Math.abs(x) > buildR + .01 || Math.abs(z) > buildR + .01) { toast('Build on the sandy pad'); return; }
  let top = 0, calm = true;
  for (const o of objs) {
    if (o.gone || o.type === 'proj') continue;
    const a = o.body.getAABB();
    if (a.upperBound.x > x - fx / 2 + .03 && a.lowerBound.x < x + fx / 2 - .03 && a.upperBound.z > z - fz / 2 + .03 && a.lowerBound.z < z + fz / 2 - .03) {
      if (a.upperBound.y > top) top = a.upperBound.y;
      if (!o.body.isSleeping()) calm = false;
    }
  }
  if (top + hgt > MAX_H) { toast('Too tall — sky limit!'); return; }
  const o = createPiece(spec, x, top + hgt / 2 + .005, z, qY(rot), calm);
  o.pop = 1; o.mdirty = true;
  placed.push(o); dirty = true; snd.place(); updateHud();
}

// ================= presets =================
const G = 1.005, LAY = 1.004;
const CUBE = m => Bx(m, 1, 1, 1);
const PRESETS = [
  { id: 'castle', name: 'Grand Castle', emoji: '🏰', desc: 'Spired towers, gatehouse, battlements & a TNT keep', cam: [31, 3, .42], build() {
    const S = CUBE('stone'), LS = Bx('stone', 2, 1, 1), LIN = Bx('stone', 5, 1, 1);
    // corner towers: 2x2, 6 high, with windows and a big spire
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (let L = 0; L < 6; L++) for (const dx of [5, 6]) for (const dz of [5, 6])
        put(L === 3 && dx === 6 && dz === 6 ? CUBE('glass') : S, sx * dx * G, L * LAY, sz * dz * G);
      put(Co('roof', 1.45, 2.6), sx * 5.5 * G, 6 * LAY, sz * 5.5 * G);
    }
    // curtain walls with staggered masonry
    function wall(alongX, fixed, gate) {
      const P = (a, y, sp) => alongX ? put(sp, a * G, y, fixed * G, 0) : put(sp, fixed * G, y, a * G, Math.PI / 2);
      for (let c = 0; c < 3; c++) {
        const y = c * LAY;
        if (gate && c < 2) { for (const a of [-4, -3, -2, 2, 3, 4]) P(a, y, c === 1 && Math.abs(a) === 3 ? CUBE('glass') : S); continue; }
        if (gate && c === 2) { for (const a of [-4, -3, 3, 4]) P(a, y, S); P(0, y, LIN); continue; }
        if (c % 2 === 0) { for (const a of [-3.5, -1.5, .5, 2.5]) P(a, y, LS); P(4, y, S); }
        else { P(-4, y, S); for (const a of [-2.5, -.5, 1.5, 3.5]) P(a, y, LS); }
      }
      for (const a of [-4, -2, 0, 2, 4]) P(a, 3 * LAY, S);
    }
    wall(true, 5, true); wall(true, -5); wall(false, 5); wall(false, -5);
    // gatehouse flags: small spires over the gate
    put(Co('roof', .55, 1.1), -4 * G, 4 * LAY, 5 * G); put(Co('roof', .55, 1.1), 4 * G, 4 * LAY, 5 * G);
    // central keep: hollow 3x3 ring with TNT inside, beam roof, lookout and spire
    put(CUBE('tnt'), 0, 0, 0);
    for (let L = 0; L < 4; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (!i && !j) continue;
      put(L === 2 && (i === 0 || j === 0) ? CUBE('glass') : (L % 2 ? Bx('wood', 1, 1, 1) : S), i * G, L * LAY, j * G);
    }
    for (const j of [-1, 0, 1]) put(Bx('wood', 3, .4, 1), 0, 4 * LAY, j * G);
    const ty = 4 * LAY + .404;
    put(S, 0, ty, 0); put(CUBE('glass'), 0, ty + LAY, 0); put(Co('roof', .75, 1.5), 0, ty + 2 * LAY, 0);
  } },
  { id: 'temple', name: 'Greek Temple', emoji: '🏛️', desc: 'Marble columns, beams & a tiled pediment roof', cam: [20, 2.2, .3], build() {
    for (const x of [-3, -1, 1, 3]) for (const z of [-2, 0, 2]) put(Bx('marble', 2, .4, 2), x * G, 0, z * G);
    put(Bx('marble', 8.3, .2, .6), 0, 0, 3.35);
    const y0 = .404;
    for (const z of [-2.2, 2.2]) for (const x of [-3, -1.5, 0, 1.5, 3]) {
      put(Cy('marble', .3, 1.5, .34), x * G, y0, z); put(Cy('marble', .3, 1.5), x * G, y0 + 1.504, z);
      put(Bx('marble', .8, .25, .8), x * G, y0 + 3.008, z);
    }
    const yb = y0 + 3.008 + .254;
    for (const z of [-2.2, 2.2]) for (const x of [-1.5075, 1.5075]) put(Bx('marble', 3, .4, .8), x, yb, z);
    for (const x of [-2.25, -.75, .75, 2.25]) put(We('roof', 1.49, 1.4, 5.8), x * G, yb + .404, 0);
    put(CUBE('tnt'), 0, y0, 0); put(Bx('glass', .7, 1.6, .7), 0, y0 + LAY, 0);
  } },
  { id: 'henge', name: 'Stonehenge', emoji: '🗿', desc: 'A ring of standing stones with lintels on top', cam: [20, 1.6, .38], build() {
    const n = 12, R = 4.4, up = Bx('stone', .8, 2.6, .5);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; put(up, R * Math.sin(a), 0, R * Math.cos(a), a); }
    for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2, r = R * Math.cos(Math.PI / n);
      put(Bx('stone', 2, .45, .5), r * Math.sin(a), 2.604, r * Math.cos(a), a); }
    const big = Bx('stone', .9, 3.2, .6);
    for (const deg of [180, 125, 235, 70, 290]) {
      const a = deg * Math.PI / 180, r = 2.3, cx = r * Math.sin(a), cz = r * Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
      put(big, cx + tx * .56, 0, cz + tz * .56, a); put(big, cx - tx * .56, 0, cz - tz * .56, a);
      put(Bx('stone', 2.1, .5, .6), cx, 3.204, cz, a);
    }
    put(Bx('stone', 2, .4, .8), 0, 0, 0);
  } },
  { id: 'pagoda', name: 'Pagoda', emoji: '🏯', desc: 'Five tiers of lacquered posts & wide tiled eaves', cam: [21, 3.5, .3], build() {
    put(Bx('stone', 6, .5, 6), 0, 0, 0);
    let y = .504;
    put(CUBE('tnt'), 0, y, 0);
    for (let i = 0; i < 5; i++) {
      const w = 4.6 - i * .85, p = w / 2 - .2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(Bx('lacquer', .35, 1.3, .35), sx * p, y, sz * p);
      if (i < 3) for (const sx of [-1, 1]) put(Bx('glass', .2, 1, w - 1.1), sx * p, y, 0);
      put(Bx('roof', w + 1.3, .28, w + 1.3), 0, y + 1.304, 0);
      y += 1.304 + .284;
    }
    put(Cy('lacquer', .18, 1.2, .25), 0, y, 0); put(Co('lacquer', .3, .8), 0, y + 1.204, 0);
  } },
  { id: 'colosseum', name: 'Colosseum', emoji: '🏟️', desc: 'Three rings of arches around a TNT arena', cam: [24, 1.5, .45], build() {
    const n = 28, R = 5.5;
    for (let L = 0; L < 3; L++) for (let i = 0; i < n; i++) {
      if (L === 2 && i % 2) continue;
      const a = i / n * Math.PI * 2;
      put(L === 1 && i % 2 ? CUBE('glass') : CUBE('stone'), R * Math.sin(a), L * LAY, R * Math.cos(a), a);
    }
    for (const [x, z] of [[0, 0], [1.5, 1], [-1.5, -1]]) put(CUBE('tnt'), x, 0, z);
    for (let i = 0; i < 3; i++) put(CUBE('wood'), -1.5, i * LAY, 1.5);
  } },
  { id: 'downtown', name: 'Downtown', emoji: '🏙️', desc: 'Glass skyscrapers — watch the floors pancake', cam: [26, 4.5, .35], build() {
    const bl = [[-4, -3, 9, 2], [-1, -4, 6, 2], [3, -3, 11, 2], [4, 1.5, 5, 2], [-3.5, 2, 4, 2.4], [.5, .5, 7, 1.6]];
    for (const [x, z, fl, w] of bl) {
      let y = 0;
      for (let f = 0; f < fl; f++) { put(Bx('glass', w, .9, w), x, y, z); y += .904; put(Bx('concrete', w + .3, .22, w + .3), x, y, z); y += .224; }
      if (fl >= 9) put(Bx('concrete', .15, 1.2, .15), x, y, z);
    }
  } },
  { id: 'domino', name: 'Domino Run', emoji: '🎲', desc: 'Dominoes that grow bigger — hit the first one!', cam: [22, 1.5, .55], build() {
    const X = t => -5.2 + 9.8 * t, Z = t => 4.6 - 9 * t + 2.1 * Math.sin(t * 3 * Math.PI);
    let acc = 0, px = X(0), pz = Z(0), last = null; const sOf = t => .9 + 1.6 * t ** 1.4;
    for (let t = 0; t <= 1; t += .0005) {
      const x = X(t), z = Z(t); acc += Math.hypot(x - px, z - pz); px = x; pz = z;
      const s = sOf(t);
      if (last === null || acc >= .5 * s) {
        acc = 0; const tx = X(t + .001) - x, tz = Z(t + .001) - z, l = Math.hypot(tx, tz);
        put(Bx('domino', .16 * s, .95 * s, .42 * s), x, 0, z, Math.atan2(-tz / l, tx / l));
        last = { x, z, tx: tx / l, tz: tz / l, s };
      }
    }
    const d1 = last.s * .95 * .8 + .5, ex = last.x + last.tx * d1, ez = last.z + last.tz * d1;
    put(CUBE('tnt'), ex, 0, ez, Math.atan2(-last.tz, last.tx));
    const gx = ex + last.tx * 1.6, gz = ez + last.tz * 1.6;
    for (let i = 0; i < 4; i++) put(CUBE(i === 3 ? 'stone' : 'glass'), gx, i * LAY, gz, Math.atan2(-last.tz, last.tx));
  } },
  { id: 'jenga', name: 'Jenga Tower', emoji: '🪵', desc: 'Sixteen crisscrossed layers of planks', cam: [18, 3, .32], build() {
    for (let L = 0; L < 16; L++) {
      const y = L * .405;
      for (const s of [-.505, .505]) L % 2 === 0 ? put(Bx('wood', 2, .4, 1), 0, y, s) : put(Bx('wood', 2, .4, 1), s, y, 0, Math.PI / 2);
    }
  } },
  { id: 'pyramid', name: 'Pyramid', emoji: '🔺', desc: 'Stepped stone pyramid with a TNT capstone', cam: [21, 2, .4], build() {
    const kinds = ['stone', 'stone', 'wood', 'glass', 'tnt'];
    for (let L = 0; L < 5; L++) { const n = 5 - L;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) put(CUBE(kinds[L]), (i - (n - 1) / 2) * G, L * LAY, (j - (n - 1) / 2) * G); }
  } }
];
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// local frame helper: place pieces relative to (cx, cz) rotated by a
function frame(cx, cz, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return (spec, lx, y, lz, rot = 0) => put(spec, cx + lx * c + lz * s, y, cz - lx * s + lz * c, a + rot);
}
const MEGA = [
  { id: 'citadel', mega: true, arena: 16, name: 'The Citadel', emoji: '👑', desc: 'Two rings of walls, 18 towers, a 24-story keep, 30 buildings — the ultimate smash', cam: [82, 4, .55], build() {
    const S = CUBE('stone'), GL = CUBE('glass'), W = CUBE('wood'), occ = new Set(), ck = (x, z) => x + ',' + z;
    const P = (sp, x, L, z, rot) => put(sp, x * G, L * LAY, z * G, rot);
    const tower = (cx, cz, h, sr) => {
      for (let L = 0; L < h; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue; P(L % 4 === 3 && (i === 0 || j === 0) ? GL : S, cx + i, L, cz + j);
      }
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P(S, cx + i, h, cz + j);
      put(Co('roof', sr, sr * 1.75), cx * G, (h + 1) * LAY, cz * G);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) occ.add(ck(cx + i, cz + j));
    };
    const wall = (h, courses, gate) => {
      const cells = [];
      for (let a = -h; a <= h; a++) cells.push([a, h], [a, -h]);
      for (let a = -h + 1; a < h; a++) cells.push([h, a], [-h, a]);
      for (let c = 0; c < courses; c++) for (const [x, z] of cells) {
        if (occ.has(ck(x, z))) continue;
        if (gate && z === h && c < 3 && Math.abs(x) <= 1) continue;
        if (gate && z === h && c === 3 && Math.abs(x) <= 2) { if (x === 0) P(Bx('stone', 5, 1, 1), 0, 3, h); continue; }
        P(c === courses - 3 && (x + z) % 4 === 0 ? GL : S, x, c, z);
      }
      for (const [x, z] of cells) if (!occ.has(ck(x, z)) && (x + z) % 2 === 0) P(S, x, courses, z);
    };
    // building: 3x3 hollow, `h` floors (stone below, timber above), tiled roof
    const house = (cx, cz, h, rot) => {
      const F = frame(cx * G, cz * G, rot);
      for (let L = 0; L < h; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue; F((L % 2 === 1 && (i === 0 || j === 0)) ? GL : (L < 2 ? S : W), i * G, L * LAY, j * G);
      }
      F(We('roof', 3.3, 1.3, 3.5), 0, h * LAY, 0);
    };
    // outer ring (half-size 14): corner, mid-wall and gate towers, 11-course walls
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * 14, sz * 14, 15, 2.15);
    for (const s of [-1, 1]) { tower(s * 7, 14, 13, 1.9); tower(s * 7, -14, 13, 1.9); tower(14, s * 7, 13, 1.9); tower(-14, s * 7, 13, 1.9); }
    for (const s of [-1, 1]) tower(s * 3, 14, 10, 1.6);
    wall(14, 11, true);
    // inner ring (half-size 8): tall corner towers, 12-course walls
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * 8, sz * 8, 17, 2.15);
    wall(8, 12, true);
    // the keep: 9x9 ring (12 floors) -> timber floor -> 5x5 ring -> floor -> 3x3 lantern -> spire, 9 TNT in the cellar
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) P(CUBE('tnt'), i, 0, j);
    for (let L = 0; L < 12; L++) for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      if (Math.abs(i) < 4 && Math.abs(j) < 4) continue;
      P(L % 3 === 1 && (Math.abs(i) <= 1 || Math.abs(j) <= 1) ? GL : (L % 2 ? CUBE('marble') : S), i, L, j);
    }
    for (let j = -4; j <= 4; j++) put(Bx('wood', 9, .4, 1), 0, 12 * LAY, j * G);
    let y = 12 * LAY + .404;
    for (let L = 0; L < 5; L++) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      if (Math.abs(i) < 2 && Math.abs(j) < 2) continue; put(L === 2 && (i === 0 || j === 0) ? GL : S, i * G, y + L * LAY, j * G);
    }
    y += 5 * LAY; for (let j = -2; j <= 2; j++) put(Bx('wood', 5, .4, 1), 0, y, j * G);
    y += .404;
    for (let L = 0; L < 4; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { if (!i && !j) continue; put(L === 1 ? GL : CUBE('gold'), i * G, y + L * LAY, j * G); }
    put(Co('roof', 1.6, 3), 0, y + 4 * LAY, 0);
    // inner courtyard: 10 storehouses
    for (const [x, z] of [[6, -3], [6, 0], [6, 3], [-6, -3], [-6, 0], [-6, 3], [3, -6], [0, -6], [-3, -6], [3, 6]]) house(x, z, 3, x === 6 ? Math.PI / 2 : x === -6 ? -Math.PI / 2 : 0);
    house(-3, 6, 3, 0);
    // outer ring of town houses between the walls
    for (const a of [-8, -4, 0, 4, 8]) {
      house(a, -11, 5, 0); house(11, a, 5, Math.PI / 2); house(-11, a, 5, -Math.PI / 2);
      if (a !== 0) house(a, 11, 5, 0);
    }
  } },
  { id: 'fortress', mega: true, name: 'Mega Fortress', emoji: '🏰', desc: '11-story towers, thick walls, gatehouse, keep & courtyard huts', cam: [54, 4, .42], build() {
    const S = CUBE('stone'), GL = CUBE('glass'), W = CUBE('wood');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * 9, cz = sz * 9;
      for (let L = 0; L < 11; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue;
        put(L % 3 === 2 && (i === 0 || j === 0) ? GL : S, (cx + i) * G, L * LAY, (cz + j) * G);
      }
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(S, (cx + i) * G, 11 * LAY, (cz + j) * G);
      put(Co('roof', 2.15, 3.8), cx * G, 12 * LAY, cz * G);
    }
    const wall = (alongX, fixed, gate) => {
      const P = (a, y, sp) => alongX ? put(sp, a * G, y, fixed * G) : put(sp, fixed * G, y, a * G, Math.PI / 2);
      for (let c = 0; c < 6; c++) for (let a = -7; a <= 7; a++) {
        if (gate && c < 3 && Math.abs(a) <= 1) continue;
        if (gate && c === 3 && Math.abs(a) <= 2) { if (a === 0) P(0, c * LAY, Bx('stone', 5, 1, 1)); continue; }
        P(a, c * LAY, c === 3 && a % 4 === 0 ? GL : S);
      }
      for (let a = -6; a <= 6; a += 2) P(a, 6 * LAY, S);
    };
    wall(true, 9, true); wall(true, -9); wall(false, 9); wall(false, -9);
    for (let L = 0; L < 7; L++) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;
      put((L === 2 || L === 5) && (i === 0 || j === 0) ? GL : (L % 2 ? W : S), i * G, L * LAY, j * G);
    }
    for (const i of [-1, 0, 1]) put(CUBE('tnt'), i * G, 0, 0);
    for (let j = -2; j <= 2; j++) put(Bx('wood', 5, .4, 1), 0, 7 * LAY, j * G);
    const y0 = 7 * LAY + .404;
    put(S, 0, y0, 0); put(GL, 0, y0 + LAY, 0); put(S, 0, y0 + 2 * LAY, 0); put(Co('roof', .8, 1.6), 0, y0 + 3 * LAY, 0);
    for (const hx of [-5.5, 5.5]) for (const hz of [-5, 5]) {
      for (let L = 0; L < 2; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) put(W, (hx + dx) * G, L * LAY, (hz + dz) * G);
      put(We('roof', 2.2, 1, 2.4), hx * G, 2 * LAY, hz * G);
    }
  } },
  { id: 'gpyramid', mega: true, name: 'Great Pyramid', emoji: '🏜️', desc: '12-step sandstone pyramid hiding a gold & TNT chamber', cam: [36, 3, .4], build() {
    const N = 12;
    for (let L = 0; L < N; L++) { const n = N - L;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = (i - (n - 1) / 2), z = (j - (n - 1) / 2);
        let m = 'sand';
        if (L === 1 && Math.abs(x) <= 1 && Math.abs(z) <= 1) m = (x === 0 && z === 0) ? 'tnt' : 'gold';
        if (L === N - 1) m = 'gold';
        put(CUBE(m), x * G, L * LAY, z * G);
      } }
  } },
  { id: 'metropolis', mega: true, name: 'Metropolis', emoji: '🌆', desc: 'Sixteen glass & concrete towers up to 16 stories', cam: [48, 6, .4], build() {
    const R = rng(7), lots = [-7.5, -2.5, 2.5, 7.5];
    for (const lx of lots) for (const lz of lots) {
      const big = R() < .45, h = 4 + Math.floor(R() * (big ? 9 : 13));
      if (big) {
        for (let L = 0; L < h; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          if (!i && !j) continue;
          put(CUBE((i && j) || L % 4 === 0 ? 'concrete' : 'glass'), lx + i * G, L * LAY, lz + j * G);
        }
        put(Bx('concrete', 3.1, .3, 3.1), lx, h * LAY, lz);
        if (h >= 11) put(Cy('concrete', .08, 1.8), lx, h * LAY + .304, lz);
      } else {
        for (let L = 0; L < h; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5])
          put(CUBE(L % 3 === 2 ? 'concrete' : 'glass'), lx + dx * G, L * LAY, lz + dz * G);
        if (h >= 14) put(Cy('concrete', .07, 1.6), lx, h * LAY, lz);
      }
    }
  } },
  { id: 'dspiral', mega: true, name: 'Domino Spiral', emoji: '🌀', desc: '500 dominoes spiraling into a TNT-loaded glass tower', cam: [30, 1, .8], build() {
    const rMax = 10.3, rMin = 1.9, gap = 1.3, b = gap / (2 * Math.PI), phi0 = -.55;
    const at = th => { const r = rMax - b * th; return [r * Math.sin(th + phi0), r * Math.cos(th + phi0), r]; };
    let acc = 0, [px, pz] = at(0), last = null;
    for (let th = 0; ; th += .002) {
      const [x, z, r] = at(th); if (r < rMin) break;
      acc += Math.hypot(x - px, z - pz); px = x; pz = z;
      if (last === null || acc >= .5) {
        acc = 0; const [x2, z2] = at(th + .002), tx = x2 - x, tz = z2 - z, l = Math.hypot(tx, tz);
        put(Bx('domino', .18, 1.1, .55), x, 0, z, Math.atan2(-tz / l, tx / l));
        last = { x, z, tx: tx / l, tz: tz / l };
      }
    }
    put(CUBE('tnt'), last.x + last.tx * 1.4, 0, last.z + last.tz * 1.4, Math.atan2(-last.tz, last.tx));
    for (let L = 0; L < 5; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) put(CUBE(L === 4 ? 'gold' : 'glass'), dx * G, L * LAY, dz * G);
  } },
  { id: 'village', mega: true, name: 'Medieval Village', emoji: '🏘️', desc: 'Church & bell tower ringed by stone cottages and huts', cam: [40, 3, .5], build() {
    const S = CUBE('stone'), W = CUBE('wood'), GL = CUBE('glass');
    // church: 3x4 stone nave, tiled roof, 2x2 bell tower with spire
    for (let L = 0; L < 4; L++) for (let i = -1; i <= 1; i++) for (let j = -2; j <= 1; j++) {
      if (i === 0 && j > -2 && j < 1) continue;
      if (j === -2 && ((L < 2 && i === 0) || L === 2)) continue;           // door + lintel row
      put(L === 2 && i !== 0 && (j === -1 || j === 0) ? GL : S, i * G, L * LAY, j * G);
    }
    put(Bx('stone', 3, 1, 1), 0, 2 * LAY, -2 * G);                    // lintel over the door
    for (const z of [-1.5, .5]) put(We('roof', 2, 1.4, 3.4), 0, 4 * LAY, z * G, Math.PI / 2);
    for (let L = 0; L < 9; L++) for (const dx of [-.5, .5]) for (const dz of [2.5, 3.5]) put(L === 6 ? GL : S, dx * G, L * LAY, dz * G);
    put(Co('roof', 1.45, 2.6), 0, 9 * LAY, 3 * G);
    // inner ring: 8 small huts
    for (let k = 1; k < 7; k++) {
      const a = (k + .5) / 8 * Math.PI * 2, P = frame(5.3 * Math.sin(a), 5.3 * Math.cos(a), a);
      for (let L = 0; L < 2; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) P(W, dx * G, L * LAY, dz * G);
      P(We('roof', 2.3, 1, 2.5), 0, 2 * LAY, 0);
    }
    // outer ring: 12 two-story cottages (3x3 hollow, door facing the square, glass windows)
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, P = frame(8.6 * Math.sin(a), 8.6 * Math.cos(a), a);
      for (let L = 0; L < 4; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue;
        const win = (L === 1 || L === 3) && (i === 0 || j === 0);
        P(win ? GL : (L < 2 ? S : W), i * G, L * LAY, j * G);
      }
      P(We('roof', 3.3, 1.3, 3.5), 0, 4 * LAY, 0);
    }
  } }
];
PRESETS.unshift(...MEGA);
function countOf(p) { if (p.count == null) { COUNTING = 0; p.build(); p.count = COUNTING; COUNTING = null; } return p.count; }
function clearAll() { clearFields(); for (const o of objs) removeObj(o); dormant.clear(); objs = []; placed = []; pendingBreak.clear(); pendingBoom = []; parts = []; }
function loadPreset(p) {
  clearAll(); setArena(p.arena || 10); p.build(); dirty = true; snapshot = null; curPreset = p;
  const [r, y, el] = p.cam; cam.tR = r; cam.target.y = y; cam.tEl = el;
  if (mode === 'throw') takeSnapshot();
  updateHud(); hideHint('build'); toast(p.emoji + ' ' + p.name + ' · ' + countOf(p) + ' blocks');
}
let curPreset = null;
function takeSnapshot() {
  objs = objs.filter(o => !o.gone);
  const blocks = objs.filter(o => o.type === 'block');
  snapshot = blocks.map(o => ({ spec: o.spec, p: o.body.position.clone(), q: o.body.quaternion.clone() }));
  blocks.forEach(o => o.home = { p: o.body.position.clone(), q: o.body.quaternion.clone() });
  dirty = false;
}
function rebuild() {
  if (!snapshot || !snapshot.length) { toast('Nothing to rebuild yet'); return; }
  clearAll();
  for (const s of snapshot) { const o = createPiece(s.spec, s.p.x, s.p.y, s.p.z, s.q, true); o.home = { p: s.p.clone(), q: s.q.clone() }; }
  dirty = false; updateHud(); toast('Rebuilt');
}
// preset menu
function openMenu() {
  const g = $('mgrid'); g.innerHTML = '';
  { const b = document.createElement('button'); b.className = 'card mega custom chal'; b.innerHTML = '<span class="em">🏆</span><b>Challenge mode</b><small>10 levels · limited ammo · earn up to 3 stars each</small><i>' + Object.values(loadStars()).reduce((a, b) => a + b, 0) + ' / 30 ★</i>';
    b.onclick = () => { closeMenu(); setTimeout(openLevels, 120); }; g.appendChild(b); }
  { const b = document.createElement('button'); b.className = 'card mega custom'; b.innerHTML = '<span class="em">📐</span><b>Custom builder</b><small>Design your own: pick shape, size (e.g. 5×5×30), material & extras — or type a blueprint</small><i>up to 12,000 blocks</i>';
    b.onclick = () => { closeMenu(); setTimeout(openCustom, 120); }; g.appendChild(b); }
  for (const [title, list] of [['Mega builds · 500–5,000 blocks', PRESETS.filter(p => p.mega)], ['Classic builds', PRESETS.filter(p => !p.mega)]]) {
    const h = document.createElement('div'); h.className = 'sect'; h.textContent = title; g.appendChild(h);
    for (const p of list) {
      const b = document.createElement('button'); b.className = 'card' + (p.mega ? ' mega' : '');
      b.innerHTML = `<span class="em">${p.emoji}</span><b>${p.name}</b><small>${p.desc}</small><i>${countOf(p)} blocks</i>`;
      b.onclick = () => { closeMenu(); setTimeout(() => loadPreset(p), 30); };
      g.appendChild(b);
    }
  }
  $('menu').classList.add('open');
}
function closeMenu() { $('menu').classList.remove('open'); }
$('menuX').onclick = closeMenu;
$('menu').addEventListener('click', e => { if (e.target.id === 'menu') closeMenu(); });

// ================= custom builder =================
// Structures are described by a small command language, e.g.
//   hollow 6x6x30 glass windows 3 floors 5 roof at -8,4
// The form below writes these lines for you; the Blueprint box runs many lines at once.
const CB_SHAPES = { solid: 'Solid', hollow: 'Tower', round: 'Round', pyramid: 'Pyramid', wall: 'Wall', stairs: 'Stairs' };
const CB_MATS = ['stone', 'wood', 'glass', 'marble', 'concrete', 'sand', 'gold', 'tnt', 'striped', 'checker', 'random'];
const CB_SHAPE_WORDS = { solid: 'solid', block: 'solid', cube: 'solid', box: 'solid', hollow: 'hollow', tower: 'hollow', building: 'hollow', house: 'hollow', keep: 'hollow',
  round: 'round', cylinder: 'round', circle: 'round', silo: 'round', pyramid: 'pyramid', wall: 'wall', stairs: 'stairs', staircase: 'stairs', steps: 'stairs' };
const CB_MAX_DIM = 40, CB_MAX_H = 60, CB_MAX_BLOCKS = 12000;
const cbDefault = () => ({ shape: 'hollow', w: 5, l: 5, h: 30, mat: 'stone', x: 0, z: 0, up: 0, thick: 1, windows: 4, floors: 0, crenels: false, roof: true, tnt: false });

function parseCmd(line) {
  const t = ' ' + line.toLowerCase().replace(/[×*]/g, 'x') + ' ', c = cbDefault();
  c.windows = 0; c.roof = false;
  for (const [w, s] of Object.entries(CB_SHAPE_WORDS)) if (new RegExp('\\b' + w + '\\b').test(t)) { c.shape = s; break; }
  if (c.shape === 'wall') { c.w = 15; c.l = 1; c.h = 6; }
  // dimensions: 5x5x30, 5wx5lx30h, 30h x 5w x 5l, 12x6 (length x height for walls) ...
  const U = '\\s*(?:([wlh])(?![a-z]))?'; const dm = t.match(new RegExp('(\\d+)' + U + '\\s*x\\s*(\\d+)' + U + '(?:\\s*x\\s*(\\d+)' + U + ')?'));
  if (dm) {
    const nums = [[+dm[1], dm[2]], [+dm[3], dm[4]]]; if (dm[5]) nums.push([+dm[5], dm[6]]);
    const order = nums.length === 3 ? ['w', 'l', 'h'] : (c.shape === 'pyramid' ? ['w', 'l'] : ['w', 'h']);
    const used = new Set(nums.filter(n => n[1]).map(n => n[1]));
    const free = order.filter(k => !used.has(k)).concat(['w', 'l', 'h'].filter(k => !used.has(k) && !order.includes(k)));
    for (const [n, k] of nums) c[k || free.shift()] = n;
  }
  for (const k of ['w', 'l', 'h']) { const m = t.match(new RegExp('\\b' + k + '(?:idth|ength|eight)?\\s*=?\\s*(\\d+)\\b')); if (m) c[k] = +m[1]; }
  for (const m of CB_MATS) if (new RegExp('\\b' + m + '\\b').test(t.replace(/\btnt core\b/, ''))) { c.mat = m; break; }
  const at = t.match(/(?:\bat\b|@)\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/); if (at) { c.x = +at[1]; c.z = +at[2]; }
  const upm = t.match(/\b(?:up|raise|raised|elevation)\s*=?\s*(\d+)/); if (upm) c.up = clamp(+upm[1], 0, 80);
  const num = (re, dflt) => { const m = t.match(re); return m ? (m[1] ? +m[1] : dflt) : null; };
  const win = num(/\bwindows?\s*=?\s*(\d+)?/, 3); if (win != null) c.windows = win;
  const fl = num(/\bfloors?\s*=?\s*(\d+)?/, 4); if (fl != null) c.floors = fl;
  const th = num(/\b(?:thick|thickness|walls?)\s*=?\s*(\d+)/); if (th != null && th > 0) c.thick = th;
  c.crenels = /\b(battlements?|crenels?|crenellations?)\b/.test(t);
  c.roof = /\b(roof|spire|cone)\b/.test(t);
  c.tnt = /\btnt\s*core\b|\bcore\b/.test(t);
  c.w = clamp(Math.round(c.w), 1, CB_MAX_DIM); c.l = clamp(Math.round(c.l), 1, CB_MAX_DIM); c.h = clamp(Math.round(c.h), 1, CB_MAX_H);
  c.thick = clamp(c.thick, 1, Math.max(1, Math.floor(Math.min(c.w, c.l) / 2)));
  return c;
}
function cfgToCmd(c) {
  const parts = [c.shape === 'hollow' ? 'tower' : c.shape, c.shape === 'pyramid' ? `${c.w}x${c.l}` : `${c.w}w x ${c.l}l x ${c.h}h`, c.mat];
  if (c.thick > 1 && (c.shape === 'hollow' || c.shape === 'round')) parts.push('thick ' + c.thick);
  if (c.windows) parts.push('windows ' + c.windows);
  if (c.floors && (c.shape === 'hollow' || c.shape === 'round')) parts.push('floors ' + c.floors);
  if (c.crenels) parts.push('battlements');
  if (c.roof) parts.push('roof');
  if (c.tnt) parts.push('tnt core');
  if (c.x || c.z) parts.push(`at ${c.x},${c.z}`);
  if (c.up) parts.push('up ' + c.up);
  return parts.join(' ');
}

// returns [{spec, x, y, z, rot}] — y is the bottom of the piece
function genStructure(c) {
  const res = genStructure0(c), dy = (c.up || 0) * LAY;
  if (dy) for (const p of res) p.y += dy;
  return res;
}
function genStructure0(c) {
  const out = [], R = rng(c.w * 73 + c.l * 31 + c.h * 7 + Math.round(c.x * 13 + c.z * 17) + c.shape.length);
  const matAt = (i, j, L) => {
    if (c.mat === 'striped') return L % 2 ? 'wood' : 'stone';
    if (c.mat === 'checker') return (i + j + L) % 2 ? 'marble' : 'stone';
    if (c.mat === 'random') return ['stone', 'wood', 'glass', 'concrete', 'stone'][Math.floor(R() * 5)];
    return c.mat;
  };
  const W = c.w, Lz = c.shape === 'round' || c.shape === 'pyramid' ? c.l : c.l, H = c.h;
  const X = i => c.x + (i - (W - 1) / 2) * G, Z = j => c.z + (j - (Lz - 1) / 2) * G;
  const cube = (m, i, j, y) => out.push({ spec: CUBE(m), x: X(i), y, z: Z(j) });
  // which cells form the footprint of this shape, and which of those are "outer" (for windows)
  let cells = [], interior = [];
  if (c.shape === 'round') {
    const a = W / 2, b = Lz / 2, t = c.thick;
    for (let i = 0; i < W; i++) for (let j = 0; j < Lz; j++) {
      const u = (i + .5 - a) / a, v = (j + .5 - b) / b, d = Math.hypot(u, v);
      const inner = Math.hypot((i + .5 - a) / Math.max(.5, a - t), (j + .5 - b) / Math.max(.5, b - t));
      if (d <= 1.0 && (inner >= 1 || a <= t || b <= t)) cells.push([i, j, d > 1 - 1.2 / Math.min(a, b)]); else if (d <= 1) interior.push([i, j]);
    }
  } else {
    const t = c.shape === 'hollow' ? c.thick : 99;
    for (let i = 0; i < W; i++) for (let j = 0; j < Lz; j++) {
      const edge = i === 0 || j === 0 || i === W - 1 || j === Lz - 1;
      if (i < t || j < t || i >= W - t || j >= Lz - t) cells.push([i, j, edge]); else interior.push([i, j]);
    }
  }
  const isWin = (i, j, L, outer) => c.windows && outer && L % c.windows === c.windows - 1 && L < H - 1 && (i + j) % 2 === 1;
  let y = 0;
  if (c.shape === 'pyramid') {
    for (let L = 0; ; L++) {
      const w = W - 2 * L, l = Lz - 2 * L; if (w <= 0 || l <= 0 || (c.h && L >= Math.max(c.h, 1) && c.h < Math.min(W, Lz))) break;
      for (let i = 0; i < w; i++) for (let j = 0; j < l; j++) {
        const core = c.tnt && L <= 1 && Math.abs(i - (w - 1) / 2) <= 1 && Math.abs(j - (l - 1) / 2) <= 1 && w > 4;
        cube(core ? 'tnt' : (isWin(i, j, L, i === 0 || j === 0 || i === w - 1 || j === l - 1) ? 'glass' : matAt(i, j, L)), i + L, j + L, L * LAY);
      }
    }
    return out;
  }
  if (c.shape === 'stairs') {
    for (let i = 0; i < W; i++) { const hh = Math.max(1, Math.ceil((i + 1) * H / W));
      for (let L = 0; L < hh; L++) for (let j = 0; j < Lz; j++) cube(matAt(i, j, L), i, j, L * LAY); }
    return out;
  }
  // solid / hollow / round / wall: stack layers, with optional timber floors spanning the interior
  if (c.tnt) {
    const core = interior.length ? interior.filter(([i, j]) => Math.abs(i - (W - 1) / 2) <= 1.5 && Math.abs(j - (Lz - 1) / 2) <= 1.5) : [];
    for (const [i, j] of core) cube('tnt', i, j, 0);
  }
  const solidCore = c.tnt && !interior.length ? new Set(cells.filter(([i, j]) => Math.abs(i - (W - 1) / 2) <= 1 && Math.abs(j - (Lz - 1) / 2) <= 1).map(([i, j]) => i + ',' + j)) : null;
  for (let L = 0; L < H; L++) {
    for (const [i, j, outer] of cells) {
      const m = solidCore && L < 2 && solidCore.has(i + ',' + j) ? 'tnt' : isWin(i, j, L, outer) ? 'glass' : matAt(i, j, L);
      cube(m, i, j, y);
    }
    y += LAY;
    if (c.floors && interior.length && (L + 1) % c.floors === 0 && L < H - 1) {
      // one timber beam per row, resting on the walls at both ends
      const rows = new Map();
      for (const [i, j] of cells.concat(interior.map(([i, j]) => [i, j]))) { const r = rows.get(j) || [i, i]; rows.set(j, [Math.min(r[0], i), Math.max(r[1], i)]); }
      for (const [j, [i0, i1]] of rows) { const len = (i1 - i0 + 1) * G - .01; out.push({ spec: Bx('wood', len, .4, 1), x: (X(i0) + X(i1)) / 2, y, z: Z(j) }); }
      y += .404;
    }
  }
  if (c.crenels && !c.roof) for (const [i, j, outer] of cells) if (outer && (i + j) % 2 === 0) cube(c.mat === 'glass' ? 'stone' : matAt(i, j, H), i, j, y);
  if (c.roof) {
    if (c.shape === 'round' || (W <= 7 && Lz <= 7 && Math.abs(W - Lz) <= 1)) {
      const r = Math.max(W, Lz) / 2 + .35; out.push({ spec: Co('roof', r, Math.max(1.4, r * 1.7)), x: c.x, y, z: c.z });
    } else if (W >= Lz) out.push({ spec: We('roof', W * G + .2, Math.max(1, Lz * .45), Lz * G + .4), x: c.x, y, z: c.z });
    else out.push({ spec: We('roof', Lz * G + .2, Math.max(1, W * .45), W * G + .4), x: c.x, y, z: c.z, rot: Math.PI / 2 });
  }
  return out;
}
function pieceAABB(p) {
  const s = p.spec, h = specHeight(s);
  let hx, hz;
  if (s.shape === 'box' || s.shape === 'wedge') { hx = s.d[0] / 2; hz = s.d[2] / 2; if (p.rot) [hx, hz] = [hz, hx]; } else hx = hz = s.shape === 'cone' ? s.d[0] : Math.max(s.d[0], s.d[1]);
  return { lowerBound: { x: p.x - hx, y: p.y, z: p.z - hz }, upperBound: { x: p.x + hx, y: p.y + h, z: p.z + hz } };
}
function spaceTaken(pieces) {
  const live = [...P.bodies()].filter(pb => pb.userData && pb.userData.type === 'block').map(pb => pb.getAABB());
  for (const p of pieces) {
    const a = pieceAABB(p), pad = -.06;
    let hit = false;
    forCells(a, 0, k => { if (hit) return; const st = dormant.get(k); if (st) for (const o of st) if (overlap(a, o.aabb, pad)) { hit = true; return; } });
    if (hit) return true;
    for (const b of live) if (overlap(a, b, pad)) return true;
  }
  return false;
}
// build a list of command lines; returns false if it didn't build
function runBlueprint(lines, { replace = false } = {}) {
  const cfgs = []; let doClear = replace;
  for (const raw of lines) { const l = raw.trim(); if (!l || l.startsWith('#') || l.startsWith('//')) continue; if (/^clear\b/i.test(l)) { doClear = true; continue; } cfgs.push(parseCmd(l)); }
  if (!cfgs.length) { if (doClear) { clearAll(); snapshot = null; dirty = true; updateHud(); toast('Cleared'); } return false; }
  const all = cfgs.map(genStructure), total = all.reduce((n, a) => n + a.length, 0);
  if (total + (doClear ? 0 : objs.filter(o => !o.gone && o.type === 'block').length) > CB_MAX_BLOCKS) { toast(`Too big: ${total.toLocaleString()} blocks (max ${CB_MAX_BLOCKS.toLocaleString()})`); return false; }
  if (doClear) { clearAll(); snapshot = null; }
  const flat = all.flat();
  { // structures in one blueprint must not overlap each other
    const hm = new Map();
    for (let k = 0; k < all.length; k++) {
      let clash = -1;
      for (const p of all[k]) { const a = pieceAABB(p); forCells(a, 0, key => { const l = hm.get(key); if (l) for (const [b, kk] of l) if (kk !== k && clash < 0 && overlap(a, b, -.06)) clash = kk; }); if (clash >= 0) break; }
      if (clash >= 0) { toast(`Structures ${clash + 1} and ${k + 1} overlap — change “at” or “up”`); return false; }
      for (const p of all[k]) { const a = pieceAABB(p); forCells(a, 0, key => { let l = hm.get(key); if (!l) hm.set(key, l = []); l.push([a, k]); }); }
    }
  }
  if (!doClear && spaceTaken(flat)) { toast('That spot is taken — move it, or turn on “Clear first”'); return false; }
  let need = buildR, top = 0, ext = 6;
  for (const c of cfgs) { need = Math.max(need, Math.ceil(Math.max(Math.abs(c.x) + c.w / 2, Math.abs(c.z) + c.l / 2) + 1)); }
  for (const p of flat) { top = Math.max(top, p.y + specHeight(p.spec)); ext = Math.max(ext, Math.abs(p.x) + 1, Math.abs(p.z) + 1); }
  if (need > buildR) setArena(Math.min(need, 34));
  const group = flat.map(p => put(p.spec, p.x, p.y, p.z, p.rot));
  placed.push(group); dirty = true; curPreset = null;
  cam.tR = clamp(Math.max(ext * 2.7, top * 1.9, 18), 14, 95); cam.target.y = clamp(top * .3, 1.5, 12); cam.tEl = Math.max(cam.tEl, .35);
  updateHud(); hideHint('build');
  toast(`Built ${total.toLocaleString()} blocks`);
  return true;
}

// ---- the Custom build sheet ----
let cbCfg = cbDefault(), cbPlacing = null, cbClearFirst = false;
const CB_EXAMPLES = [
  ['Twin towers', 'clear\ntower 6x6x34 glass windows 2 floors 6 roof at -6,0\ntower 6x6x34 glass windows 2 floors 6 roof at 6,0\nwall 5x1x2 concrete at 0,0'],
  ['Castle kit', 'clear\nwall 15x1x7 stone battlements at 0,-10\nwall 15x1x7 stone battlements at 0,10\nwall 1x15x7 stone battlements at -10,0\nwall 1x15x7 stone battlements at 10,0\nround 5x5x12 stone windows 4 roof at -10.5,-10.5\nround 5x5x12 stone windows 4 roof at 10.5,-10.5\nround 5x5x12 stone windows 4 roof at -10.5,10.5\nround 5x5x12 stone windows 4 roof at 10.5,10.5\ntower 7x7x16 checker windows 3 floors 4 roof tnt core'],
  ['Mega pyramid', 'clear\npyramid 27x27 sand tnt core'],
  ['Silo farm', 'clear\nround 6x6x18 concrete thick 1 roof at -8,-8\nround 6x6x18 concrete roof at 0,-8\nround 6x6x18 concrete roof at 8,-8\nsolid 20x3x3 wood at 0,0\nstairs 8x3x8 stone at 0,6'],
  ['Skyscraper', 'clear\nsolid 12x12x1 concrete\ntower 8x8x50 glass windows 1 floors 5 up 1 roof']
];
function cbChips(parent, items, cur, on) {
  const row = document.createElement('div'); row.className = 'chips';
  for (const [k, label] of items) { const b = document.createElement('button'); b.className = 'chip' + (k === cur ? ' on' : ''); b.textContent = label; b.onclick = () => on(k); row.appendChild(b); }
  parent.appendChild(row); return row;
}
function cbStepper(parent, label, val, min, max, on, step = 1) {
  const w = document.createElement('div'); w.className = 'stp';
  w.innerHTML = `<span>${label}</span><button aria-label="less">−</button><input inputmode="numeric" value="${val}"><button aria-label="more">+</button>`;
  const [minus, plus] = w.querySelectorAll('button'), inp = w.querySelector('input');
  const set = v => { v = clamp(Math.round(+v || 0), min, max); inp.value = v; on(v); };
  minus.onclick = () => set(+inp.value - step); plus.onclick = () => set(+inp.value + step);
  inp.onchange = () => set(inp.value);
  let tmo, iv; const stop = () => { clearTimeout(tmo); clearInterval(iv); };
  for (const [b, d] of [[minus, -step], [plus, step]]) {
    b.onpointerdown = () => { stop(); tmo = setTimeout(() => { iv = setInterval(() => set(+inp.value + d), 80); }, 380); };
    b.onpointerup = b.onpointerleave = b.onpointercancel = stop;
  }
  parent.appendChild(w);
}
function cbLabel(parent, txt) { const h = document.createElement('div'); h.className = 'lab'; h.textContent = txt; parent.appendChild(h); }
function renderCustom() {
  const f = $('cform'), c = cbCfg; f.innerHTML = '';
  cbLabel(f, 'Shape');
  cbChips(f, Object.entries(CB_SHAPES), c.shape, k => {
    c.shape = k;
    if (k === 'wall') { c.l = 1; c.h = Math.min(c.h, 8); c.crenels = true; c.roof = false; }
    if (k === 'pyramid') { c.roof = false; c.l = c.w; c.h = 60; c.floors = 0; c.crenels = false; }
    if (k !== 'pyramid' && c.h > 40 && cbCfg._wasPyr) c.h = 20; c._wasPyr = k === 'pyramid';
    renderCustom();
  });
  cbLabel(f, 'Size  (W × L × H) — or type it: ');
  const quick = document.createElement('input'); quick.className = 'quick'; quick.placeholder = 'e.g. 5x5x30';
  quick.onchange = () => { const p = parseCmd(c.shape + ' ' + quick.value); Object.assign(c, { w: p.w, l: p.l, h: p.h }); renderCustom(); };
  f.lastChild.appendChild(quick);
  const dims = document.createElement('div'); dims.className = 'row3'; f.appendChild(dims);
  cbStepper(dims, 'W', c.w, 1, CB_MAX_DIM, v => { c.w = v; cbUpdate(); });
  cbStepper(dims, 'L', c.l, 1, CB_MAX_DIM, v => { c.l = v; cbUpdate(); });
  if (c.shape !== 'pyramid') cbStepper(dims, 'H', c.h, 1, CB_MAX_H, v => { c.h = v; cbUpdate(); });
  cbLabel(f, 'Material');
  cbChips(f, CB_MATS.map(m => [m, m === 'tnt' ? 'TNT' : m[0].toUpperCase() + m.slice(1)]), c.mat, k => { c.mat = k; renderCustom(); });
  cbLabel(f, 'Extras');
  const ex = [['windows', 'Windows'], ['floors', 'Floors'], ['crenels', 'Battlements'], ['roof', 'Roof / spire'], ['tnt', 'TNT core']]
    .filter(([k]) => !(c.shape === 'pyramid' && ['floors', 'crenels', 'roof'].includes(k)) && !(c.shape === 'stairs' && k !== 'windows'))
    .filter(([k]) => !(k === 'floors' && !['hollow', 'round'].includes(c.shape)));
  const exRow = document.createElement('div'); exRow.className = 'chips'; f.appendChild(exRow);
  for (const [k, label] of ex) {
    const on = !!c[k], b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : ''); b.textContent = (on ? '✓ ' : '') + label;
    b.onclick = () => { c[k] = typeof c[k] === 'number' ? (c[k] ? 0 : (k === 'windows' ? 3 : 4)) : !c[k]; if (k === 'roof' && c.roof) c.crenels = false; if (k === 'crenels' && c.crenels) c.roof = false; renderCustom(); };
    exRow.appendChild(b);
  }
  const opts = document.createElement('div'); opts.className = 'row3'; f.appendChild(opts);
  if (c.windows) cbStepper(opts, 'Window every', c.windows, 1, 10, v => { c.windows = v; cbUpdate(); });
  if (c.floors && ['hollow', 'round'].includes(c.shape)) cbStepper(opts, 'Floor every', c.floors, 1, 20, v => { c.floors = v; cbUpdate(); });
  if (['hollow', 'round'].includes(c.shape)) cbStepper(opts, 'Wall thickness', c.thick, 1, 6, v => { c.thick = v; cbUpdate(); });
  cbLabel(f, 'Position (center of the pad is 0,0)');
  const pos = document.createElement('div'); pos.className = 'row3'; f.appendChild(pos);
  cbStepper(pos, 'X', c.x, -30, 30, v => { c.x = v; cbUpdate(); });
  cbStepper(pos, 'Z', c.z, -30, 30, v => { c.z = v; cbUpdate(); });
  cbStepper(pos, 'Raise', c.up, 0, 60, v => { c.up = v; cbUpdate(); });
  const cmd = document.createElement('div'); cmd.className = 'cmd'; cmd.id = 'cbCmd'; f.appendChild(cmd);
  const acts = document.createElement('div'); acts.className = 'acts'; f.appendChild(acts);
  acts.innerHTML = `<label class="chk"><input type="checkbox" id="cbClear"${cbClearFirst ? ' checked' : ''}> Clear first</label>
    <button class="b2" id="cbTap">📍 Tap to place</button><button class="b1" id="cbBuild">Build</button>`;
  $('cbClear').onchange = e => cbClearFirst = e.target.checked;
  $('cbBuild').onclick = () => { if (runBlueprint([cfgToCmd(c)], { replace: $('cbClear').checked })) closeCustom(); };
  $('cbTap').onclick = () => { cbPlacing = { ...c }; closeCustom(); toast('Tap the ground where it should go'); };
  const addLine = document.createElement('button'); addLine.className = 'b2 wide'; addLine.textContent = '＋ Add this to the blueprint below';
  addLine.onclick = () => { const ta = $('cbBp'); ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + cfgToCmd(c); };
  f.appendChild(addLine);
  // blueprint
  cbLabel(f, 'Blueprint — one structure per line, builds them all together');
  const ta = document.createElement('textarea'); ta.id = 'cbBp'; ta.rows = 5; ta.spellcheck = false; ta.value = cbBlueprint;
  ta.placeholder = 'tower 6x6x30 stone windows 3 roof at -8,0\nwall 15x1x6 stone battlements at 0,0\nround 5x5x12 glass roof at 8,0';
  ta.oninput = () => cbBlueprint = ta.value; f.appendChild(ta);
  const exr = document.createElement('div'); exr.className = 'chips'; f.appendChild(exr);
  for (const [n, txt] of CB_EXAMPLES) { const b = document.createElement('button'); b.className = 'chip ex'; b.textContent = '✨ ' + n; b.onclick = () => { ta.value = cbBlueprint = txt; cbUpdate(); }; exr.appendChild(b); }
  const bpActs = document.createElement('div'); bpActs.className = 'acts'; f.appendChild(bpActs);
  bpActs.innerHTML = `<span id="bpCount" class="cnt"></span><button class="b1" id="cbRun">Build blueprint</button>`;
  $('cbRun').onclick = () => { if (runBlueprint($('cbBp').value.split('\n'), { replace: $('cbClear').checked })) closeCustom(); };
  ta.addEventListener('input', cbUpdate);
  const help = document.createElement('details'); help.className = 'help';
  help.innerHTML = `<summary>Command cheat-sheet</summary><p><b>Shapes:</b> solid, tower (hollow), round, pyramid, wall, stairs<br><b>Size:</b> <code>5x5x30</code> or <code>5w x 5l x 30h</code> (max ${CB_MAX_DIM}×${CB_MAX_DIM}×${CB_MAX_H})<br><b>Materials:</b> ${CB_MATS.join(', ')}<br><b>Extras:</b> <code>windows 3</code> · <code>floors 5</code> · <code>thick 2</code> · <code>battlements</code> · <code>roof</code> · <code>tnt core</code><br><b>Where:</b> <code>at -8,4</code> (x,z from the center) · <code>up 3</code> starts it 3 blocks up, to stack on another structure<br><b>clear</b> on its own line empties the pad first.<br>Up to ${CB_MAX_BLOCKS.toLocaleString()} blocks total.</p>`;
  f.appendChild(help);
  cbUpdate();
}
let cbBlueprint = '';
function cbUpdate() {
  const el = $('cbCmd'); if (!el) return;
  const n = genStructure(cbCfg).length;
  el.innerHTML = `<code>${cfgToCmd(cbCfg)}</code><b>${n.toLocaleString()} blocks</b>`;
  const ta = $('cbBp'); if (ta) {
    const lines = ta.value.split('\n').filter(l => l.trim() && !/^\s*(clear|#|\/\/)/i.test(l));
    const tot = lines.reduce((s, l) => s + genStructure(parseCmd(l)).length, 0);
    $('bpCount').textContent = lines.length ? `${lines.length} structure${lines.length > 1 ? 's' : ''} · ${tot.toLocaleString()} blocks` : '';
  }
}
function openCustom() { renderCustom(); $('custom').classList.add('open'); }
function closeCustom() { $('custom').classList.remove('open'); }
$('customX').onclick = closeCustom;
$('custom').addEventListener('click', e => { if (e.target.id === 'custom') closeCustom(); });
// tap-to-place: called from the build-mode tap handler
function cbTryPlace(sx, sy) {
  if (!cbPlacing) return false;
  ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...pickables(), pad, groundMesh], false);
  if (!hits.length) return true;
  const c = cbPlacing; c.x = Math.round(hits[0].point.x); c.z = Math.round(hits[0].point.z);
  if (runBlueprint([cfgToCmd(c)])) { cbPlacing = null; cbCfg.x = c.x; cbCfg.z = c.z; }
  return true;
}

// ================= throwing =================
let held = null, heldKey = null, curSize = 1, aim = null;
const trajGeo = new THREE.BufferGeometry(); const trajPos = new Float32Array(160 * 3);
trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPos, 3));
const traj = new THREE.Points(trajGeo, new THREE.PointsMaterial({ color: 0xffffff, size: .16, transparent: true, opacity: .9, depthWrite: false }));
traj.frustumCulled = false; scene.add(traj);
const marker = new THREE.Mesh(new THREE.RingGeometry(.32, .5, 36), new THREE.MeshBasicMaterial({ color: 0x4cff7a, transparent: true, opacity: .95, depthTest: false, side: THREE.DoubleSide }));
marker.renderOrder = 999; marker.visible = false; scene.add(marker);
const markerDot = new THREE.Mesh(new THREE.CircleGeometry(.1, 16), marker.material); marker.add(markerDot);

const sizeF = () => SIZES[curSize][1];
function launchOrigin() {
  const f = new THREE.Vector3(); camera.getWorldDirection(f);
  const d = 3 + sizeF() * 1.3, half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * d;
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const o = camera.position.clone().addScaledVector(f, d).addScaledVector(up, -half * .5);
  o.y = Math.max(o.y, .8 * sizeF());
  return o;
}
function pickTarget(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...pickables(), pad, groundMesh], false);
  if (!hits.length) return { p: raycaster.ray.at(60, new THREE.Vector3()), n: null };
  const h = hits[0], ho = objFromHit(h); let n = new THREE.Vector3(0, 1, 0);
  if (ho && h.face) { const q = ho.body.quaternion; n = h.face.normal.clone().applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)); }
  return { p: h.point.clone(), n };
}
const chargeOf = a => { const t = clamp((performance.now() - a.t0) / CHARGE_MS, 0, 1); return 1 - (1 - t) * (1 - t); };
// launch velocity that passes through the target at speed v (flatter, faster arc); falls short if v is too low
function solveVelocity(from, to, v) {
  const g = -GRAV, dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y, D = Math.hypot(dx, dz) || .001;
  const v2 = v * v, disc = v2 * v2 - g * (g * D * D + 2 * dy * v2);
  const reach = disc >= 0, th = reach ? Math.atan((v2 - Math.sqrt(disc)) / (g * D)) : Math.PI / 4;
  return { vel: new THREE.Vector3(dx / D * v * Math.cos(th), v * Math.sin(th), dz / D * v * Math.cos(th)), reach };
}
function throwProj(vel, target, pw = 1) {
  if (!useAmmo()) { toast('Out of ammo — tap ↺ to retry'); return; }
  if (PROJ[curProj].special) { throwSpecial(curProj, vel, target, pw); return; }
  const p = PROJ[curProj], f = sizeF(), o0 = launchOrigin();
  let shape;
  if (p.shape === 'sphere') shape = { kind: 'ball', r: p.r * f };
  else if (p.shape === 'box') shape = { kind: 'box', hx: p.size[0] / 2 * f, hy: p.size[1] / 2 * f, hz: p.size[2] / 2 * f };
  else shape = { kind: 'hull', points: new Float32Array(rockData(p.r * f).v.flat()), radius: p.r * f * 1.15, vol: 4 / 3 * Math.PI * (p.r * f) ** 3 * .8 };
  let quat = new Q4();
  if (p.shape === 'box') { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), vel.clone().normalize()); quat = new Q4(q.x, q.y, q.z, q.w); }
  const body = new P.PBody({ shape, mass: p.mass * f * f * f, pos: new V3(o0.x, o0.y, o0.z), quat, fric: .5, rest: p.rest, ccd: true, ld: 0, ad: .1 });
  body.velocity.set(vel.x, vel.y, vel.z); body.angularVelocity.set(rand(-3, 3), rand(-3, 3), rand(-3, 3));
  const o = addObj({ body, mesh: makeProjMesh(curProj, f), type: 'proj', kind: curProj, bomb: !!p.bomb, power: Math.pow(f, .8), launched: true, born: simTime });
  const projs = objs.filter(q => q.type === 'proj' && !q.gone && !q.noCap);
  if (projs.length > 8) removeObj(projs[0]);
  snd.whoosh();
}
function updateAim() {
  const chg = $('charge');
  if (mode !== 'throw') { if (held) held.visible = false; traj.visible = marker.visible = false; chg.style.opacity = 0; return; }
  const key = curProj + curSize;
  if (heldKey !== key) { if (held) scene.remove(held); held = makeProjMesh(curProj, PROJ[curProj].special ? .6 : Math.min(sizeF(), 1.2)); heldKey = key; scene.add(held); }
  held.visible = true;
  const o = launchOrigin();
  { const f = new THREE.Vector3(); camera.getWorldDirection(f); const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 4.2;
    held.position.copy(camera.position).addScaledVector(f, 4.2).addScaledVector(up, -half * .66); }
  held.rotation.y += .01;
  if (!aim) { traj.visible = marker.visible = false; chg.style.opacity = 0; return; }
  const pw = chargeOf(aim), v = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * pw;
  let { vel, reach } = solveVelocity(o, aim.target.p, v);
  const straight = curProj === 'rocket', noArc = curProj === 'meteor';
  if (straight || noArc) reach = true;
  aim.vel = vel;
  held.position.x += rand(-1, 1) * .04 * pw; held.position.y += rand(-1, 1) * .04 * pw;
  // trajectory preview
  let n = 0; const p = o.clone(), vv = vel.clone(), dt = 1 / 40;
  if (straight) { const tp = aim.target.p; for (let i = 2; i <= 40; i++) { const k = i / 40; trajPos[n * 3] = o.x + (tp.x - o.x) * k; trajPos[n * 3 + 1] = o.y + (tp.y - o.y) * k; trajPos[n * 3 + 2] = o.z + (tp.z - o.z) * k; n++; } }
  else if (!noArc) for (let i = 0; i < 320 && n < 160; i++) {
    vv.y += GRAV * dt; p.addScaledVector(vv, dt); if (p.y < 0) break;
    if (i > 1 && i % 2 === 0) { trajPos[n * 3] = p.x; trajPos[n * 3 + 1] = p.y; trajPos[n * 3 + 2] = p.z; n++; }
    if (reach && p.distanceTo(aim.target.p) < .4) break;
  }
  trajGeo.setDrawRange(0, n); trajGeo.attributes.position.needsUpdate = true; traj.visible = true;
  // target marker
  const t = aim.target; marker.visible = true;
  marker.position.copy(t.p).addScaledVector(t.n || new THREE.Vector3(0, 1, 0), .04);
  marker.lookAt(marker.position.clone().add(t.n || camera.position.clone().sub(t.p).normalize()));
  marker.scale.setScalar((.8 + .4 * Math.sin(performance.now() / 120)) * Math.max(1, camera.position.distanceTo(t.p) / 18) * (noArc ? 12 : 1));
  marker.material.color.set(reach ? 0x4cff7a : 0xffa53a);
  // charge ring at the finger
  chg.style.opacity = 1; chg.style.left = aim.x + 'px'; chg.style.top = aim.y + 'px';
  chg.style.setProperty('--p', pw.toFixed(3));
  $('chargeTxt').textContent = noArc ? 'Release to call it in' : reach ? Math.round(pw * 100) + '%' : (pw >= 1 ? 'Too far' : 'Hold…');
}

// ================= CRAZY: special weapons, disasters, challenges, night =================
const UPY = new THREE.Vector3(0, 1, 0);
let fields = [], meteorQueue = [], quake = null, bulletUntil = 0, lastDown = null, chal = null;

// ---- special projectile meshes ----
const radTex = canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#f2c81e'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#111'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10);
  for (const cx of [64, 192]) { const cy = h / 2;
    for (let k = 0; k < 3; k++) { const a0 = k * 2 * Math.PI / 3 - Math.PI / 2 - .5; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 34, a0, a0 + 1); c.closePath(); c.fill(); }
    c.fillStyle = '#f2c81e'; c.beginPath(); c.arc(cx, cy, 9, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(cx, cy, 6, 0, 7); c.fill(); }
});
const SPMATS = {
  rocketBody: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .4, metalness: .3 }),
  rocketRed: new THREE.MeshStandardMaterial({ color: 0xd8312a, roughness: .5 }),
  nuke: new THREE.MeshStandardMaterial({ map: radTex, roughness: .45, metalness: .2 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x050008 }),
  holeRing: new THREE.MeshBasicMaterial({ color: 0xb46bff, transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }),
  meteor: new THREE.MeshStandardMaterial({ color: 0x5a3a28, emissive: 0xff5a10, emissiveIntensity: .9, roughness: 1, flatShading: true }),
  ember: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff7a1a, emissiveIntensity: .7 })
};
function makeSpecialMesh(kind) {
  const p = PROJ[kind], g = new THREE.Group();
  if (kind === 'rocket') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .9, 14), SPMATS.rocketBody);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.16, .38, 14), SPMATS.rocketRed); nose.position.y = .64;
    g.add(body, nose);
    for (let k = 0; k < 3; k++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(.03, .3, .22), SPMATS.rocketRed); const a = k * 2.094; fin.position.set(Math.cos(a) * .2, -.36, Math.sin(a) * .2); fin.rotation.y = -a; g.add(fin); }
  } else if (kind === 'cluster') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(p.r, 20, 14), PMATS.bomb));
    for (const [x, y, z] of [[1, .3, 0], [-1, .3, 0], [0, .3, 1], [0, .3, -1], [0, 1, 0]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(p.r * .38, 10, 8), SPMATS.ember); s.position.set(x * p.r * .85, y * p.r * .85, z * p.r * .85); g.add(s); }
  } else if (kind === 'bomblet') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 10), SPMATS.ember));
  } else if (kind === 'nuke') {
    const s = new THREE.Mesh(new THREE.SphereGeometry(p.r, 24, 16), SPMATS.nuke); s.scale.set(1, .85, 1); g.add(s);
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(p.r * .55, p.r * .3, p.r * .7, 12), PMATS.bomb); fin.position.y = -p.r * .95; g.add(fin);
  } else if (kind === 'hole') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(p.r, 20, 14), SPMATS.hole));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.6, p.r * .18, 8, 32), SPMATS.holeRing); ring.rotation.x = Math.PI / 2.4; g.add(ring);
  } else if (kind === 'meteor') {
    const { v, f } = rockData(p.r), pos = []; for (const fc of f) for (const i of fc) pos.push(...v[i]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, SPMATS.meteor));
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- spawning helpers ----
function spawnProj(kind, pos, vel, extra = {}) {
  const p = PROJ[kind] || { r: .17, mass: .8, rest: .2, shape: 'sphere' };
  const shape = p.shape === 'rock' ? { kind: 'hull', points: new Float32Array(rockData(p.r).v.flat()), radius: p.r * 1.15, vol: 4 / 3 * Math.PI * p.r ** 3 * .8 } : { kind: 'ball', r: p.r };
  const body = new P.PBody({ shape, mass: p.mass, pos: new V3(pos.x, pos.y, pos.z), fric: .5, rest: p.rest, ccd: true, ld: 0, ad: .1, ...(extra.body || {}) });
  body.velocity.set(vel.x, vel.y, vel.z);
  if (!extra.body || !extra.body.lockRot) body.angularVelocity.set(rand(-3, 3), rand(-3, 3), rand(-3, 3));
  delete extra.body;
  return addObj({ body, mesh: makeSpecialMesh(kind), type: 'proj', kind, launched: true, born: simTime, ...extra });
}
function throwSpecial(kind, vel, target, pw) {
  const o0 = launchOrigin();
  if (kind === 'meteor') { startMeteors(target); return; }
  if (kind === 'rocket') {
    const d = new THREE.Vector3().subVectors(target, o0).normalize(), v = 24 + 40 * pw;
    spawnProj('rocket', o0, d.multiplyScalar(v), { rocket: true, bomb: true, power: 1.25, body: { gs: 0, lockRot: true } });
    snd.rocket(); return;
  }
  if (kind === 'cluster') { spawnProj('cluster', o0, vel, { bomb: true, cluster: true, power: 1 }); snd.whoosh(); return; }
  if (kind === 'nuke') { spawnProj('nuke', o0, vel, { bomb: true, nuke: true, power: 3.2 }); snd.whoosh(); return; }
  if (kind === 'hole') { spawnProj('hole', o0, vel, { hole: true }); snd.whoosh(); return; }
}
function splitCluster(o) {
  const p = o.body.position.clone(), v = o.body.velocity.clone(); removeObj(o);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + rand(-.2, .2), s = rand(3.5, 8);
    spawnProj('bomblet', { x: p.x, y: p.y + .2, z: p.z }, { x: v.x * .5 + Math.cos(a) * s, y: v.y * .3 + rand(2, 7), z: v.z * .5 + Math.sin(a) * s }, { bomb: true, power: .6, noCap: true });
  }
  for (let i = 0; i < 30; i++) spawnP(p.x, p.y, p.z, rand(-5, 5), rand(-1, 5), rand(-5, 5), .5, [1, .75, .3], .2, -6, 1);
  snd.pop();
}

// ---- meteor shower ----
function startMeteors(target) {
  const yaw = rand(0, Math.PI * 2);
  for (let i = 0; i < 18; i++) {
    const r = Math.sqrt(Math.random()) * 6.5, a = rand(0, Math.PI * 2);
    meteorQueue.push({ t: simTime + .3 + i * .13 + rand(0, .1), at: new THREE.Vector3(target.x + Math.cos(a) * r, Math.max(0, target.y * .5), target.z + Math.sin(a) * r), yaw });
  }
  toast('☄️ Incoming!'); snd.whoosh();
}
function updateMeteors() {
  if (!meteorQueue.length) return;
  const due = meteorQueue.filter(m => simTime >= m.t); meteorQueue = meteorQueue.filter(m => simTime < m.t);
  for (const m of due) {
    const start = new THREE.Vector3(m.at.x + Math.cos(m.yaw) * 16 + rand(-3, 3), 48, m.at.z + Math.sin(m.yaw) * 16 + rand(-3, 3));
    const vel = new THREE.Vector3().subVectors(m.at, start).normalize().multiplyScalar(50);
    spawnProj('meteor', start, vel, { meteor: true, bomb: true, power: .9, noCap: true });
  }
}

// ---- black hole ----
function spawnHole(o) {
  const c = o.body.position.clone(); removeObj(o); c.y = Math.max(c.y, 2.8);
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), SPMATS.hole); g.add(core);
  const disk = new THREE.Mesh(new THREE.RingGeometry(1.4, 3.6, 64), new THREE.MeshBasicMaterial({ color: 0xc58cff, transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  disk.rotation.x = Math.PI / 2.3; g.add(disk);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), new THREE.MeshBasicMaterial({ color: 0x7a2cff, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(halo);
  g.position.set(c.x, c.y, c.z); g.scale.setScalar(.01); scene.add(g);
  fields.push({ type: 'hole', c, t0: simTime, dur: 3.4, R: 12, mesh: g, disk, eaten: 0 });
  bulletUntil = simTime + .8; snd.hole(); toast('🕳️ Black hole!');
}
function updateHole(f, dt) {
  const t = simTime - f.t0, k = clamp(t / .35, 0, 1), c = f.c;
  f.mesh.scale.setScalar(k * (1 + .08 * Math.sin(t * 20)));
  f.disk.rotation.z += dt * 6;
  if (dormant.size) activateNear({ lowerBound: { x: c.x - f.R, y: 0, z: c.z - f.R }, upperBound: { x: c.x + f.R, y: c.y + f.R, z: c.z + f.R } }, 0);
  const eatR = 1.25 * k;
  for (const pb of [...P.bodies()]) {
    const o = pb.userData; if (!o || o.gone) continue;
    const p = pb.position, dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z, d = Math.hypot(dx, dy, dz) || .01;
    if (d > f.R) continue;
    if (d < eatR + pb.boundingRadius * .5) {
      for (let i = 0; i < 6; i++) spawnP(p.x, p.y, p.z, dx * 2 + rand(-1, 1), dy * 2 + rand(-1, 1), dz * 2 + rand(-1, 1), .4, [.75, .5, 1], .18, 0, -1);
      removeObj(o); f.eaten++; continue;
    }
    const a = Math.min(70, 180 / (d * d + 2)) * k, sw = a * .45;
    pb.applyImpulse(new V3(pb.mass * dt * (dx / d * a - dz / d * sw), pb.mass * dt * (dy / d * a + 8 * k), pb.mass * dt * (dz / d * a + dx / d * sw)));
  }
  for (let i = 0; i < 8; i++) { const a = rand(0, 6.28), r = rand(3, 7), x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, y = c.y + rand(-1, 1);
    spawnP(x, y, z, (c.x - x) * 1.2 - Math.sin(a) * 4, (c.y - y), (c.z - z) * 1.2 + Math.cos(a) * 4, .7, [.7 + rand(0, .3), .4, 1], .12, 0, 0); }
  if (t >= f.dur) {
    scene.remove(f.mesh); f.done = true;
    explodeAt(new V3(c.x, c.y, c.z), 1.7); bulletUntil = simTime + .7;
    if (f.eaten) toast(`🕳️ Swallowed ${f.eaten} blocks`);
  }
}

// ---- tornado ----
function startTornado() {
  const a = rand(0, Math.PI * 2), r = buildR * .9;
  const c = new V3(Math.cos(a) * r, 0, Math.sin(a) * r);
  const funnel = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x8a8578, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false });
  for (let i = 0; i < 3; i++) { const cone = new THREE.Mesh(new THREE.CylinderGeometry(6 - i, .5 + i * .3, 24, 28, 1, true), mat); cone.position.y = 12; cone.scale.setScalar(1 - i * .12); funnel.add(cone); }
  funnel.position.set(c.x, 0, c.z); scene.add(funnel);
  fields.push({ type: 'tornado', c, t0: simTime, dur: 8, R: 6.5, mesh: funnel, vx: -c.x * .12, vz: -c.z * .12, nextWind: 0 });
  toast('🌪️ Tornado!');
}
function updateTornado(f, dt) {
  const t = simTime - f.t0, k = Math.min(1, t / .8, (f.dur - t) / .8);
  f.vx += (-f.c.x * .05 + rand(-1, 1) * 2.2) * dt; f.vz += (-f.c.z * .05 + rand(-1, 1) * 2.2) * dt;
  const sp = Math.hypot(f.vx, f.vz); if (sp > 3.2) { f.vx *= 3.2 / sp; f.vz *= 3.2 / sp; }
  f.c.x += f.vx * dt; f.c.z += f.vz * dt;
  f.mesh.position.set(f.c.x, 0, f.c.z); f.mesh.rotation.y += dt * 4; f.mesh.scale.setScalar(Math.max(.05, k));
  const R = f.R, c = f.c;
  if (dormant.size) activateNear({ lowerBound: { x: c.x - R, y: 0, z: c.z - R }, upperBound: { x: c.x + R, y: 30, z: c.z + R } }, 0);
  for (const pb of P.bodies()) {
    const o = pb.userData; if (!o || o.gone) continue;
    const p = pb.position, dx = p.x - c.x, dz = p.z - c.z, r = Math.hypot(dx, dz) || .01;
    if (r > R || p.y > 26) continue;
    const s = (1 - r / R) * k, up = p.y > 18 ? 6 : 27 + 8 * s;
    pb.applyImpulse(new V3(pb.mass * dt * (-dz / r * 36 * s - dx / r * 16 * s), pb.mass * dt * up * s, pb.mass * dt * (dx / r * 36 * s - dz / r * 16 * s)));
  }
  for (let i = 0; i < 14; i++) { const a = rand(0, 6.28), r = rand(.5, 5), y = rand(0, 18) * k;
    spawnP(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r, -Math.sin(a) * 9, rand(3, 7), Math.cos(a) * 9, rand(.5, 1), [.55, .5, .42], rand(.25, .5), 0, 1, .6); }
  if (simTime > f.nextWind) { f.nextWind = simTime + .9; snd.wind(); }
  shake = Math.max(shake, .05 * k);
  if (t >= f.dur) { scene.remove(f.mesh); f.done = true; }
}

// ---- earthquake: the ground itself becomes a moving (kinematic) slab ----
function startQuake() {
  if (quake) return;
  for (const o of objs) if (o.dormant) activate(o);
  wakeAll();
  const kin = P.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0));
  P.world.createCollider(RAPIER.ColliderDesc.cuboid(300, .5, 300).setTranslation(0, -.5, 0).setFriction(.95), kin);
  P.ground.setEnabled(false);
  quake = { t0: simTime, dur: 5.5, kin, nextWake: 0 };
  snd.quake(); toast('🌍 Earthquake!');
}
function updateQuake() {
  if (!quake) return;
  const t = simTime - quake.t0, env = Math.sin(Math.PI * clamp(t / quake.dur, 0, 1)) ** .6, A = .42 * env;
  const ox = A * Math.sin(t * 2 * Math.PI * 2.3) + A * .5 * Math.sin(t * 2 * Math.PI * 3.9 + 1);
  const oz = A * Math.sin(t * 2 * Math.PI * 1.8 + 2) + A * .4 * Math.sin(t * 2 * Math.PI * 4.4);
  const oy = .07 * env * Math.sin(t * 2 * Math.PI * 6.1);
  quake.kin.setNextKinematicTranslation({ x: ox, y: oy, z: oz });
  groundMesh.position.set(ox, oy, oz); pad.position.set(ox, -.06 + .025 + oy, oz); if (grid) grid.position.set(ox, .005 + oy, oz);
  shake = Math.max(shake, .22 * env);
  if (simTime > quake.nextWake) { quake.nextWake = simTime + .4; wakeAll();
    for (let i = 0; i < 12; i++) spawnP(rand(-buildR, buildR), .1, rand(-buildR, buildR), rand(-1, 1), rand(.5, 2), rand(-1, 1), 1.4, [.6, .52, .4], rand(.6, 1.2), 0, 1.5, .5); }
  if (t >= quake.dur) {
    P.world.removeRigidBody(quake.kin); P.ground.setEnabled(true); quake = null;
    groundMesh.position.set(0, 0, 0); pad.position.set(0, -.06 + .025, 0); if (grid) grid.position.set(0, .005, 0);
  }
}
function updateFields(dt) {
  for (const f of fields) if (!f.done) (f.type === 'hole' ? updateHole : updateTornado)(f, dt);
  fields = fields.filter(f => !f.done);
  updateMeteors(); updateQuake();
}
function clearFields() { for (const f of fields) scene.remove(f.mesh); fields = []; meteorQueue = []; }

// ---- nuke ----
const shockMesh = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 96), new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
shockMesh.rotation.x = -Math.PI / 2; shockMesh.visible = false; scene.add(shockMesh);
let shockT = 0;
function nukeFX(c) {
  const wo = $('whiteout'); wo.style.transition = 'none'; wo.style.opacity = 1;
  requestAnimationFrame(() => requestAnimationFrame(() => { wo.style.transition = 'opacity 1.6s ease-out'; wo.style.opacity = 0; }));
  shockMesh.position.set(c.x, .15, c.z); shockMesh.visible = true; shockT = 1;
  for (let i = 0; i < 150; i++) { const r = rand(0, 1.6), a = rand(0, 6.28);   // stem
    spawnP(c.x + Math.cos(a) * r, rand(0, 2), c.z + Math.sin(a) * r, Math.cos(a) * .6, rand(5, 11), Math.sin(a) * .6, rand(2.2, 3.4), [1, rand(.35, .7), .1].map((v, j) => j ? v : 1), rand(1, 1.8), -.8, 1.6, .9); }
  for (let i = 0; i < 220; i++) { const a = rand(0, 6.28), s = rand(2, 7);   // cap
    spawnP(c.x, rand(13, 17), c.z, Math.cos(a) * s, rand(-.5, 2), Math.sin(a) * s, rand(2.8, 4.2), Math.random() < .5 ? [1, .55, .2] : [.45, .4, .38], rand(1.6, 2.8), .4, 2.2, .85); }
  for (let i = 0; i < 120; i++) { const a = rand(0, 6.28), s = rand(14, 26);  // ground dust ring
    spawnP(c.x, .4, c.z, Math.cos(a) * s, rand(.5, 2), Math.sin(a) * s, rand(1.2, 2), [.75, .68, .55], rand(1, 1.8), 0, 2, .6); }
  flash.distance = 90; flash.intensity = 500; shake = 2.4; bulletUntil = simTime + 1.6; snd.nuke();
}
function updateShock(dt) {
  if (!shockT) return;
  shockT = Math.max(0, shockT - dt / 1.4); const k = 1 - shockT;
  shockMesh.scale.setScalar(1 + k * 45); shockMesh.material.opacity = shockT * .8;
  if (!shockT) { shockMesh.visible = false; flash.distance = 18; }
}

// ---- night mode ----
const dayBg = scene.background;
const nightBg = canvasTex(512, 512, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#02040d'); g.addColorStop(.6, '#0b1636'); g.addColorStop(1, '#22305a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(255,255,255,${rand(.2, .9)})`; c.fillRect(Math.random() * w, Math.random() * h * .7, rand(.6, 1.8), rand(.6, 1.8)); }
});
let night = false;
function setNight(on) {
  night = on;
  scene.background = on ? nightBg : dayBg; scene.fog.color.set(on ? 0x0b1530 : 0xcde8f8);
  hemi.intensity = on ? .25 : 1.1; sun.intensity = on ? .5 : 2.4; sun.color.set(on ? 0x9fb4ff : 0xfff3dc);
  MATS.glass.emissive.set(on ? 0xffc46b : 0x000000); MATS.glass.emissiveIntensity = on ? .6 : 0;
  MATS.tnt.emissive.set(on ? 0x550000 : 0x000000); SPMATS.meteor.emissiveIntensity = on ? 1.6 : .9;
  renderer.toneMappingExposure = on ? 1.2 : 1.05;
  $('nightBtn').textContent = on ? '☀️' : '🌙';
}

// ---- combo popups ----
const SMASH_WORDS = ['MEGA SMASH!', 'DEMOLITION!', 'KABOOM!', 'TOTAL CHAOS!', 'OBLITERATED!', 'WRECKED!'];
function comboCheck(down) {
  if (lastDown == null || down < lastDown) { lastDown = down; return; }
  const d = down - lastDown; lastDown = down;
  if (d < 3) return;
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = '+' + d;
  el.style.left = `calc(50% + ${rand(-60, 60)}px)`; document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
  if (d >= 40) {
    document.querySelectorAll('.bigpop').forEach(e => e.remove());
    const b = document.createElement('div'); b.className = 'bigpop'; b.textContent = d >= 400 ? 'APOCALYPSE!' : SMASH_WORDS[Math.floor(Math.random() * SMASH_WORDS.length)];
    document.body.appendChild(b); setTimeout(() => b.remove(), 1500); snd.ding();
  }
}

// ---- disasters sheet ----
function openDisasters() {
  if (chal) { toast('Disasters are off during challenges'); return; }
  $('disasters').classList.add('open');
}
$('dQuake').onclick = () => { $('disasters').classList.remove('open'); startQuake(); };
$('dTornado').onclick = () => { $('disasters').classList.remove('open'); startTornado(); };
$('dMeteor').onclick = () => { $('disasters').classList.remove('open'); startMeteors(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3))); };
$('dX').onclick = () => $('disasters').classList.remove('open');
$('disasters').addEventListener('click', e => { if (e.target.id === 'disasters') $('disasters').classList.remove('open'); });

// ---- challenge mode ----
const LEVELS = [
  { name: 'Jenga Jolt', preset: 'jenga', ammo: [['ball', 1, 3]], stars: [40, 70, 95] },
  { name: 'Pyramid Pop', preset: 'pyramid', ammo: [['bowling', 1, 2]], stars: [30, 55, 80] },
  { name: 'Temple Topple', preset: 'temple', ammo: [['cannon', 1, 2]], stars: [35, 60, 85] },
  { name: 'Henge Hammer', preset: 'henge', ammo: [['boulder', 2, 1]], stars: [25, 50, 75] },
  { name: 'Domino Dash', preset: 'domino', ammo: [['ball', 0, 1]], stars: [50, 85, 100] },
  { name: 'Castle Siege', preset: 'castle', ammo: [['bomb', 1, 3]], stars: [25, 45, 70] },
  { name: 'Downtown Drop', preset: 'downtown', ammo: [['anvil', 2, 2], ['rocket', 1, 1]], stars: [30, 55, 80] },
  { name: 'Fortress Fall', preset: 'fortress', ammo: [['cluster', 1, 2], ['bomb', 2, 2]], stars: [20, 40, 60] },
  { name: 'Metro Meltdown', preset: 'metropolis', ammo: [['hole', 1, 1], ['meteor', 1, 1]], stars: [20, 40, 60] },
  { name: 'Citadel Doom', preset: 'citadel', ammo: [['nuke', 1, 1]], stars: [40, 65, 85] }
];
const loadStars = () => { try { return JSON.parse(localStorage.getItem('ts_stars') || '{}'); } catch (e) { return {}; } };
const saveStars = s => { try { localStorage.setItem('ts_stars', JSON.stringify(s)); } catch (e) {} };
function openLevels() {
  const st = loadStars(), g = $('lgrid'); g.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const best = st[i] || 0, locked = i > 0 && !(st[i - 1] > 0);
    const b = document.createElement('button'); b.className = 'card lvl' + (locked ? ' locked' : '');
    const ammo = L.ammo.map(([k, s, n]) => `${n}× ${['S', 'M', 'L', 'XL'][s]} ${PROJ[k].label}`).join(' + ');
    b.innerHTML = `<span class="em">${locked ? '🔒' : i + 1}</span><b>${L.name}</b><small>${ammo}</small><i>${'★'.repeat(best)}${'☆'.repeat(3 - best)}</i>`;
    b.onclick = () => { if (locked) { toast('Get ★ on the previous level first'); return; } $('levels').classList.remove('open'); setTimeout(() => startLevel(i), 60); };
    g.appendChild(b);
  });
  $('levels').classList.add('open');
}
$('levelsX').onclick = () => $('levels').classList.remove('open');
$('levels').addEventListener('click', e => { if (e.target.id === 'levels') $('levels').classList.remove('open'); });
function startLevel(i) {
  const L = LEVELS[i]; clearFields(); $('result').classList.remove('open');
  chal = null; setMode('build');
  loadPreset(PRESETS.find(p => p.id === L.preset));
  chal = { lv: i, ammo: L.ammo.map(([kind, size, n]) => ({ kind, size, n })), endAt: null, pct: 0 };
  curProj = chal.ammo[0].kind; curSize = chal.ammo[0].size;
  setMode('throw'); lastDown = null;
  toast(`Level ${i + 1}: ${L.name} — ★ at ${L.stars[0]}%`);
}
const ammoLeft = () => chal ? chal.ammo.reduce((n, a) => n + a.n, 0) : Infinity;
function useAmmo() {
  if (!chal) return true;
  const a = chal.ammo.find(a => a.kind === curProj && a.n > 0); if (!a) return false;
  a.n--;
  if (!a.n) { const nx = chal.ammo.find(q => q.n > 0); if (nx) { curProj = nx.kind; curSize = nx.size; } }
  if (!ammoLeft()) chal.endAt = simTime + 4;
  buildUI(); return true;
}
function checkLevelEnd() {
  if (!chal || chal.endAt == null || chal.shown) return;
  const busy = P.activeCount > 40 || meteorQueue.length || fields.length || objs.some(o => o.type === 'proj' && !o.gone && (o.bomb || o.hole) && !o.fuseDone && simTime - o.born < 4.5);
  if (simTime < chal.endAt || (busy && simTime < chal.endAt + 8)) return;
  chal.shown = true; updateHud();
  const L = LEVELS[chal.lv], pct = chal.pct, stars = L.stars.filter(s => pct >= s).length;
  const st = loadStars(); if (stars > (st[chal.lv] || 0)) { st[chal.lv] = stars; saveStars(st); }
  $('rTitle').textContent = `Level ${chal.lv + 1} · ${L.name}`;
  $('rStars').innerHTML = [0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}" style="animation-delay:${k * .25}s">★</span>`).join('');
  $('rPct').textContent = `${pct}% toppled`;
  $('rMsg').textContent = stars === 3 ? 'Perfect demolition!' : stars ? `Next star at ${L.stars[stars]}%` : `Need ${L.stars[0]}% for a star`;
  $('rNext').style.display = stars && chal.lv < LEVELS.length - 1 ? '' : 'none';
  $('result').classList.add('open'); if (stars) snd.ding();
}
$('rRetry').onclick = () => startLevel(chal.lv);
$('rNext').onclick = () => startLevel(chal.lv + 1);
$('rLevels').onclick = () => { $('result').classList.remove('open'); openLevels(); };
function exitChallenge() { if (!chal) return; chal = null; $('result').classList.remove('open'); toast('Left challenge — free play'); }


// ================= main loop =================
const STEP = 1 / 60;
let awakeCount = 0, lastDeact = 0;
let last = performance.now(), hudT = 0;
function tick(now) {
  const rawDt = Math.min(.05, (now - last) / 1000); last = now;
  const dt = rawDt * (slow ? .3 : 1) * (simTime < bulletUntil ? .35 : 1);
  preActivate(); dominoAssist(); updateFields(dt);
  if (dt > 0) P.step(clamp(dt, 1 / 400, 1 / 40), onHit);
  simTime += dt;
  // events
  if (pendingBreak.size) { const l = [...pendingBreak]; pendingBreak.clear(); l.forEach(o => o.tnt ? explode(o, 1.15) : shatter(o)); }
  for (const o of objs) {
    if (o.gone || o.type !== 'proj') continue;
    const age = simTime - o.born, due = o.fuse && simTime >= o.fuse;
    if (o.cluster && (due || age > .9)) { splitCluster(o); continue; }
    if (o.hole && (due || age > 1.8)) { spawnHole(o); continue; }
    if (o.bomb && (due || age > (o.rocket ? 3.5 : 4.5))) explode(o, o.power || 1);
  }
  if (pendingBoom.length) { const due = pendingBoom.filter(b => simTime >= b.t); pendingBoom = pendingBoom.filter(b => simTime < b.t); due.forEach(b => explode(b.o, 1.15)); }
  for (const o of objs) {
    if (o.gone) continue;
    if (o.type === 'shard' && simTime - o.born > 4) { removeObj(o); continue; }
    if (o.body.position.y < -30) { removeObj(o); continue; }
    syncMesh(o);
    if (o.pop) { o.pop = Math.max(0, o.pop - rawDt * 7); o.mdirty = true; }
    if (o.rocket) { const v = o.body.velocity, l = v.length() || 1, p = o.body.position; if (l > .5) o.mesh.quaternion.setFromUnitVectors(UPY, new THREE.Vector3(v.x / l, v.y / l, v.z / l));
      for (let i = 0; i < 3; i++) spawnP(p.x - v.x / l * .55, p.y - v.y / l * .55, p.z - v.z / l * .55, -v.x * .08 + rand(-1, 1), -v.y * .08 + rand(-1, 1), -v.z * .08 + rand(-1, 1), rand(.25, .5), [1, rand(.5, .9), .2], rand(.2, .35), 0, 1.5); }
    if (o.meteor) { const p = o.body.position; for (let i = 0; i < 4; i++) spawnP(p.x + rand(-.3, .3), p.y + rand(-.3, .3), p.z + rand(-.3, .3), rand(-1, 1), rand(0, 2), rand(-1, 1), rand(.4, .9), i % 2 ? [1, .55, .1] : [.35, .3, .3], rand(.4, .8), 1, 2, .9); }
    if (o.bomb && !o.rocket && !o.meteor && Math.random() < .7) { const p = o.body.position; spawnP(p.x, p.y + .4, p.z, rand(-1, 1), rand(1, 3), rand(-1, 1), .35, [1, .8, .3], .12, -4, 0); }
  }
  objs = objs.filter(o => !o.gone || o.home);
  for (const b of batches.values()) b.sync();
  if (simTime - lastDeact > 1) { lastDeact = simTime; if (!P.activeCount) deactivateResting(); }
  awakeCount = P.activeCount; P.setIterations(awakeCount > 1500 ? 2 : awakeCount > 500 ? 3 : 4);
  if (flashT > 0) { flashT = Math.max(0, flashT - rawDt * 3.2); const s = 1 + (1 - flashT) * 4; flashMesh.scale.setScalar(s); flashMesh.material.opacity = flashT * .75; if (!flashT) flashMesh.visible = false; }
  flash.intensity *= Math.pow(.004, rawDt);
  updateParticles(dt);
  updateShock(rawDt); checkLevelEnd();
  applyCamera(rawDt);
  updateAim();
  grid.visible = mode === 'build';
  renderer.render(scene, camera);
  if (now - hudT > 200) { hudT = now; updateHud(); }
  requestAnimationFrame(tick);
}

// ================= HUD / UI =================
function updateHud() {
  const hud = $('hud'), blocks = objs.filter(o => o.type === 'block');
  if (mode === 'build') { const n = blocks.filter(o => !o.gone).length; hud.textContent = `🧱 ${n} block${n === 1 ? '' : 's'}`; return; }
  const homes = blocks.filter(o => o.home);
  if (!homes.length) { hud.textContent = 'Build a tower first!'; return; }
  let down = 0;
  for (const o of homes) {
    const h = o.home, p = o.body.position, q = o.body.quaternion;
    const dot = Math.abs(q.x * h.q.x + q.y * h.q.y + q.z * h.q.z + q.w * h.q.w);
    if (o.gone || p.distanceTo(h.p) > .6 || 2 * Math.acos(Math.min(1, dot)) > (o.mat === 'domino' ? .22 : .45)) down++;
  }
  const pct = Math.round(down / homes.length * 100);
  comboCheck(down);
  if (chal) { chal.pct = pct; const L = LEVELS[chal.lv]; hud.textContent = `Lv ${chal.lv + 1} · 💥 ${pct}% · ★${L.stars.join(' ★')}`; return; }
  hud.textContent = `💥 ${down}/${homes.length} toppled · ${pct}%` + (pct === 100 ? ' 🏆' : '');
}
let toastT;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 1700); }
function showHint() {
  $('hint').innerHTML = mode === 'build'
    ? 'Tap to stack blocks · drag to spin the view<br><small>Tap 🏰 for castles, temples & more</small>'
    : 'Tap where you want to hit<br><small>Hold longer = faster throw · two fingers or ◀ ▶ to move the camera</small>';
  $('hint').style.opacity = hintDone[mode] ? 0 : 1;
}
function hideHint(m) { hintDone[m] = true; if (mode === m) $('hint').style.opacity = 0; }

// tray icons (2D canvas)
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const ICOL = { wood: ['#c98a4b', '#8a5626'], stone: ['#9aa2aa', '#5d646c'], glass: ['rgba(160,220,255,.6)', '#4696cd'], tnt: ['#d4302a', '#7a1010'], marble: ['#ece7dc', '#9a958c'], roof: ['#b8472e', '#6e2414'], domino: ['#f6f1e3', '#222'] };
function iconFor(key) {
  const c = document.createElement('canvas'); c.width = c.height = 68; const x = c.getContext('2d'); x.translate(34, 34);
  if (mode === 'build') {
    const sp = BLOCKS[key].spec, [f, e] = ICOL[sp.mat]; x.fillStyle = f; x.strokeStyle = e; x.lineWidth = 3;
    if (sp.shape === 'box') {
      const m = Math.max(sp.d[0], sp.d[1]), s = 44 / Math.max(1, m), w = (sp.mat === 'domino' ? sp.d[2] : sp.d[0]) * s, h = sp.d[1] * s;
      rr(x, -w / 2, -h / 2, w, h, 4); x.fill(); x.stroke();
      if (sp.mat === 'tnt') { x.fillStyle = '#f2ead8'; x.fillRect(-w / 2 + 1.5, -7, w - 3, 14); x.fillStyle = '#111'; x.font = 'bold 13px Arial Black,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TNT', 0, 1); }
      if (sp.mat === 'domino') { x.fillStyle = '#111'; x.fillRect(-w / 2 + 3, -1, w - 6, 2); [[0, -12], [0, 12], [-5, 17], [5, 7]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 2.2, 0, 7); x.fill(); }); }
    } else if (sp.shape === 'cyl') { x.fillRect(-9, -20, 18, 40); x.strokeRect(-9, -20, 18, 40); x.fillRect(-13, -24, 26, 6); x.fillRect(-13, 18, 26, 6); }
    else if (sp.shape === 'cone') { x.beginPath(); x.moveTo(0, -22); x.lineTo(18, 18); x.lineTo(-18, 18); x.closePath(); x.fill(); x.stroke(); }
    else { x.beginPath(); x.moveTo(-26, 12); x.lineTo(26, 12); x.lineTo(14, -12); x.lineTo(-14, -12); x.closePath(); x.fill(); x.stroke(); }
  } else {
    const draw = {
      ball: () => { x.fillStyle = '#fbfaf4'; x.beginPath(); x.arc(0, 0, 17, 0, 7); x.fill(); x.strokeStyle = '#d33'; x.lineWidth = 2.5; x.beginPath(); x.arc(-22, 0, 15, -.8, .8); x.stroke(); x.beginPath(); x.arc(22, 0, 15, 2.34, 3.94); x.stroke(); },
      bowling: () => { const g = x.createRadialGradient(-7, -7, 2, 0, 0, 24); g.addColorStop(0, '#5a6ad8'); g.addColorStop(1, '#1b1f4a'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 24, 0, 7); x.fill(); x.fillStyle = '#0b0d22'; [[4, -8], [10, -4], [7, 3]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 2.6, 0, 7); x.fill(); }); },
      brick: () => { rr(x, -26, -13, 52, 26, 3); x.fillStyle = '#b5452e'; x.fill(); x.strokeStyle = '#7d2a1a'; x.lineWidth = 2.5; x.stroke(); },
      anvil: () => { x.fillStyle = '#3d434b'; x.fillRect(-24, -14, 40, 9); x.beginPath(); x.moveTo(16, -14); x.lineTo(28, -12); x.lineTo(16, -5); x.fill(); x.fillRect(-8, -5, 12, 10); x.fillRect(-16, 5, 28, 9); },
      cannon: () => { const g = x.createRadialGradient(-7, -7, 2, 0, 0, 22); g.addColorStop(0, '#777'); g.addColorStop(1, '#1d1f22'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 21, 0, 7); x.fill(); },
      boulder: () => { x.fillStyle = '#8f8576'; x.strokeStyle = '#5e564b'; x.lineWidth = 2.5; x.beginPath(); [[-24, 6], [-16, -14], [2, -20], [20, -10], [25, 8], [10, 19], [-12, 18]].forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(-16, -14); x.lineTo(2, -20); x.lineTo(-2, -4); x.closePath(); x.fill(); },
      cluster: () => { x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(0, 2, 17, 0, 7); x.fill(); x.fillStyle = '#ff7a1a'; [[-12, -8], [12, -8], [0, -15], [-14, 8], [14, 8]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 5, 0, 7); x.fill(); }); },
      rocket: () => { x.rotate(-.8); x.fillStyle = '#f2f2f2'; x.fillRect(-7, -16, 14, 30); x.fillStyle = '#d8312a'; x.beginPath(); x.moveTo(-7, -16); x.lineTo(0, -28); x.lineTo(7, -16); x.fill(); x.fillRect(-12, 8, 6, 9); x.fillRect(6, 8, 6, 9); x.fillStyle = '#ffb02e'; x.beginPath(); x.moveTo(-6, 15); x.lineTo(0, 28); x.lineTo(6, 15); x.fill(); },
      meteor: () => { x.strokeStyle = '#ff9a2e'; x.lineWidth = 4; x.lineCap = 'round'; [[-24, -24, -6, -6], [-14, -28, 2, -12], [-28, -12, -12, 2]].forEach(([a, b, c, d]) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }); x.fillStyle = '#5a3a28'; x.beginPath(); x.arc(8, 8, 15, 0, 7); x.fill(); x.fillStyle = '#ff6a1a'; x.beginPath(); x.arc(4, 4, 6, 0, 7); x.fill(); },
      hole: () => { x.strokeStyle = '#b46bff'; x.lineWidth = 5; x.beginPath(); x.ellipse(0, 0, 26, 9, -.3, 0, 7); x.stroke(); x.fillStyle = '#050008'; x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill(); x.strokeStyle = 'rgba(180,107,255,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 16, 0, 7); x.stroke(); },
      nuke: () => { x.fillStyle = '#f2c81e'; x.beginPath(); x.arc(0, 0, 22, 0, 7); x.fill(); x.fillStyle = '#111'; for (let k = 0; k < 3; k++) { const a0 = k * 2.094 - 1.57 - .5; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 17, a0, a0 + 1); x.closePath(); x.fill(); } x.fillStyle = '#f2c81e'; x.beginPath(); x.arc(0, 0, 5, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(0, 0, 3, 0, 7); x.fill(); },
      bomb: () => { x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(0, 4, 19, 0, 7); x.fill(); x.fillStyle = '#444'; x.fillRect(-5, -18, 10, 6); x.strokeStyle = '#c9a46a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, -18); x.quadraticCurveTo(5, -26, 10, -24); x.stroke(); x.fillStyle = '#ffcf3f'; x.beginPath(); x.arc(11, -25, 4, 0, 7); x.fill(); }
    };
    draw[key]();
  }
  return c;
}
function buildUI() {
  const tray = $('tray'); tray.innerHTML = '';
  const list = mode === 'build' ? BLOCKS : PROJ, cur = mode === 'build' ? curBlock : curProj;
  const keys = mode === 'build' ? Object.keys(BLOCKS) : chal ? chal.ammo.map(a => a.kind) : Object.keys(PROJ);
  for (const key of keys) {
    const am = chal && mode === 'throw' ? chal.ammo.find(a => a.kind === key) : null;
    const b = document.createElement('button'); b.className = 'item' + (key === cur ? ' on' : '') + (am && !am.n ? ' empty' : '') + (mode === 'throw' && PROJ[key].special ? ' sp' : '');
    b.appendChild(iconFor(key)); const l = document.createElement('span'); l.textContent = list[key].label + (am ? ` ×${am.n}` : ''); b.appendChild(l);
    b.onclick = () => { if (mode === 'build') curBlock = key; else { curProj = key; if (am) curSize = am.size; } buildUI(); };
    tray.appendChild(b);
  }
  if (mode === 'throw') { const hideSize = !!chal || PROJ[curProj].special; $('sizebar').style.display = hideSize ? 'none' : 'flex'; [...$('sizebar').children].forEach((c, j) => c.classList.toggle('on', j === curSize)); }
  const icons = $('icons'); icons.innerHTML = '';
  const add = (txt, title, fn, on) => { const b = document.createElement('button'); b.className = 'ib' + (on ? ' on' : ''); b.textContent = txt; b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; icons.appendChild(b); };
  if (mode === 'build') {
    add('🏰', 'Famous builds', openMenu);
    add('↶', 'Undo', () => { const last = placed.pop(); if (!last) return; for (const o of [].concat(last)) if (o && !o.gone) removeObj(o); objs = objs.filter(q => !q.gone || q.home); dirty = true; wakeAll(); updateHud(); });
    add('🗑', 'Clear all', () => { clearAll(); snapshot = null; dirty = true; updateHud(); toast('Cleared'); });
  } else {
    add('🐢', 'Slow motion', () => { slow = !slow; toast(slow ? 'Slow-mo on' : 'Slow-mo off'); buildUI(); }, slow);
    add('↺', 'Rebuild tower', () => chal ? startLevel(chal.lv) : (clearFields(), lastDown = null, rebuild()));
    add('🌪', 'Disasters', openDisasters);
  }
  add(muted ? '🔇' : '🔊', 'Sound', () => { muted = !muted; buildUI(); });
}
function setMode(m) {
  mode = m; drag = null; aim = null; pointers.clear();
  $('mBuild').classList.toggle('on', m === 'build'); $('mThrow').classList.toggle('on', m === 'throw');
  if (m === 'build' && chal) exitChallenge();
  if (m === 'throw') { if (dirty || !snapshot) takeSnapshot(); cam.tEl = clamp(cam.tEl, .14, .6); lastDown = null; }
  $('sizebar').style.display = m === 'throw' ? 'flex' : 'none';
  $('levelsBtn').style.display = m === 'throw' ? 'block' : 'none';
  $('customBtn').style.display = m === 'build' ? 'block' : 'none'; if (m !== 'build') cbPlacing = null;
  buildUI(); updateHud(); showHint();
}
$('mBuild').onclick = () => setMode('build');
$('customBtn').onclick = openCustom;
$('levelsBtn').onclick = openLevels;
$('nightBtn').onclick = () => setNight(!night);
$('mThrow').onclick = () => setMode('throw');
$('rotL').onclick = () => orbit(-Math.PI / 6, 0);
SIZES.forEach(([lab], i) => { const b = document.createElement('button'); b.textContent = lab; b.onclick = () => { curSize = i; [...$('sizebar').children].forEach((c, j) => c.classList.toggle('on', j === i)); }; if (i === curSize) b.classList.add('on'); $('sizebar').appendChild(b); });
$('rotR').onclick = () => orbit(Math.PI / 6, 0);

// ================= input =================
const cv = $('c'), pointers = new Map();
let drag = null, pinch = null;
cv.addEventListener('pointerdown', e => {
  initAudio();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size === 1) {
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, orbit: false };
    if (mode === 'throw') aim = { id: e.pointerId, x: e.clientX, y: e.clientY, t0: performance.now(), target: pickTarget(e.clientX, e.clientY) };
  } else if (pointers.size === 2) { drag = null; aim = null; pinch = pinchState(); }
});
function pinchState() { const [a, b] = [...pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
cv.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinch) {
    const p = pinchState();
    if (p.d > 0 && pinch.d > 0) zoom(pinch.d / p.d);
    orbit(-(p.mx - pinch.mx) * .008, (p.my - pinch.my) * .005);
    pinch = p; return;
  }
  if (aim && e.pointerId === aim.id && Math.hypot(e.clientX - aim.x, e.clientY - aim.y) > 3) {
    aim.x = e.clientX; aim.y = e.clientY; aim.target = pickTarget(e.clientX, e.clientY);
  }
  if (!drag || e.pointerId !== drag.id) return;
  drag.cx = e.clientX; drag.cy = e.clientY;
  if (Math.hypot(drag.cx - drag.sx, drag.cy - drag.sy) > 10) drag.moved = true;
  if (mode === 'build' && drag.moved) {
    drag.orbit = true;
    orbit(-(drag.cx - drag.lx) * .008, (drag.cy - drag.ly) * .005);
  }
  drag.lx = drag.cx; drag.ly = drag.cy;
});
function endPointer(e, cancel) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  const a = aim; aim = null;
  if (cancel) return;
  if (mode === 'build') { if (!d.moved) { if (cbTryPlace(d.sx, d.sy)) return; placeAt(d.sx, d.sy); hideHint('build'); } }
  else if (a && a.id === e.pointerId && a.vel) { throwProj(a.vel, a.target.p, chargeOf(a)); hideHint('throw'); }
}
cv.addEventListener('pointerup', e => endPointer(e, false));
cv.addEventListener('pointercancel', e => endPointer(e, true));
cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : .9); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

// ================= sound =================
let AC = null, NB = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; }
}
function noise(dur, type, freq, vol, q) { if (!AC || muted) return; const t = AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = NB; s.loop = dur > .45; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t, Math.random() * .5); s.stop(t + dur + .02); }
function tone(f0, f1, dur, vol, type) { if (!AC || muted) return; const t = AC.currentTime; const o = AC.createOscillator(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + .02); }
const snd = {
  place() { noise(.07, 'lowpass', 700, .35); },
  thud(v) { noise(.13, 'lowpass', 450, .6 * v); },
  clack(v) { noise(.08, 'bandpass', 1500, .5 * v, 1.5); },
  tink(v) { tone(3000 + Math.random() * 1200, 2400, .12, .06 * v, 'triangle'); },
  glass(v) { noise(.3, 'highpass', 3200, .35 * v); tone(2600 + Math.random() * 1500, 1800, .25, .07, 'triangle'); tone(4200, 3000, .18, .04, 'triangle'); },
  boom() { noise(1.1, 'lowpass', 220, 1.2); tone(110, 28, .9, .8); },
  nuke() { noise(3.5, 'lowpass', 140, 1.6); tone(70, 18, 3, 1); noise(1.2, 'bandpass', 600, .5, .5); },
  hole() { tone(60, 38, 3.4, .45, 'sawtooth'); tone(220, 90, 3.4, .08, 'sine'); noise(3.4, 'lowpass', 90, .4); },
  quake() { noise(5.5, 'lowpass', 70, 1.3); tone(40, 30, 5.5, .5); },
  wind() { noise(1.2, 'bandpass', 380, .35, .4); },
  rocket() { noise(.9, 'bandpass', 1100, .35, .8); },
  pop() { noise(.15, 'bandpass', 1500, .4, 1); tone(500, 200, .15, .1, 'square'); },
  ding() { tone(880, 880, .12, .08, 'triangle'); setTimeout(() => tone(1320, 1320, .25, .08, 'triangle'), 110); },
  whoosh() { noise(.22, 'bandpass', 800, .3, .6); }
};

// ================= start =================
resize(); buildUI(); updateHud(); showHint();
loadPreset(PRESETS.find(p => p.id === 'castle'));
window.__game = { throwAt(kind, x, y, z, pw = 1, size = 1) { curProj = kind; curSize = size; const o = launchOrigin(), tp = new THREE.Vector3(x, y, z); const { vel } = solveVelocity(o, tp, MIN_SPEED + (MAX_SPEED - MIN_SPEED) * pw); throwProj(vel, tp, pw); }, startQuake, startTornado, startLevel, setNight, LEVELS, get chal() { return chal; }, cb: { parseCmd, genStructure, pieceAABB }, kick(o, x, y, z) { activate(o); o.body.wakeUp(); o.body.setAngularVelocity(x, y, z); }, ff(sec) { for (let i = 0; i < sec * 60; i++) { preActivate(); dominoAssist(); P.step(STEP, onHit); simTime += STEP; } for (const o of objs) if (!o.gone) { syncMesh(o); o.mdirty = true; } }, setMode, get objs() { return objs; }, cam, loadPreset, PRESETS, openMenu };
requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });
