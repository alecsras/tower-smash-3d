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
  gold: new THREE.MeshStandardMaterial({ color: 0xffcc4d, roughness: .3, metalness: .35, emissive: 0x5a3c00, emissiveIntensity: .6 }),
  steel: new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#8d97a3'); g.addColorStop(1, '#5e6873'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${rand(.02, .08)})`; c.fillRect(0, Math.random() * h, w, 1); }
    c.fillStyle = '#3d444c'; for (const [x, y] of [[12, 12], [116, 12], [12, 116], [116, 116]]) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); } c.strokeStyle = '#424a53'; c.lineWidth = 6; c.strokeRect(0, 0, w, h); }), roughness: .4, metalness: .35, emissive: 0x1a2028, emissiveIntensity: .4 }),
  brick: new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#d9cbb4'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) { const x = k * 64 + (r % 2) * 32; c.fillStyle = `hsl(${rand(6, 16)},${rand(45, 60)}%,${rand(36, 46)}%)`; c.fillRect(x + 3, r * 32 + 3, 58, 26); } }), roughness: .9 }),
  ice: new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: .72, roughness: .12, metalness: .1, emissive: 0x0a3550, emissiveIntensity: .25 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: .65 }),
  crystal: new THREE.MeshStandardMaterial({ color: 0xc78bff, transparent: true, opacity: .78, roughness: .05, metalness: .3, emissive: 0x5a1aa8, emissiveIntensity: .55 }),
  obsidian: new THREE.MeshStandardMaterial({ color: 0x1d1528, roughness: .15, metalness: .4, emissive: 0x2a0a40, emissiveIntensity: .25 })
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
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.castShadow = this.cast; m.receiveShadow = true; m.frustumCulled = false; m.userData.batch = this;
    if (this.mesh) {
      m.instanceMatrix.array.set(this.mesh.instanceMatrix.array.subarray(0, this.items.length * 16)); m.instanceColor.array.set(this.mesh.instanceColor.array.subarray(0, this.items.length * 3));
      scene.remove(this.mesh); batchMeshes[batchMeshes.indexOf(this.mesh)] = m; this.mesh.dispose();
    } else batchMeshes.push(m);
    m.count = this.items.length; this.mesh = m; this.cap = cap; scene.add(m);
  }
  add(o) { if (this.items.length >= this.cap) this.grow(this.cap * 2); o.batch = this; o.bi = this.items.length; this.items.push(o); this.mesh.count = this.items.length; o.mdirty = true; o.cdirty = true; }
  remove(o) {
    const i = o.bi, last = this.items.pop();
    if (last !== o) { this.items[i] = last; last.bi = i; last.mdirty = true; last.cdirty = true; }
    this.mesh.count = this.items.length; o.batch = null;
  }
  sync() {
    let any = false;
    let anyC = false; const ic = this.mesh.instanceColor;
    for (const o of this.items) {
      if (o.mdirty) { writeMatrix(o); any = true; }
      if (o.cdirty) { const t = o.tint || WHITE3; ic.setXYZ(o.bi, t[0], t[1], t[2]); o.cdirty = false; anyC = true; }
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
    if (anyC) ic.needsUpdate = true;
  }
}
const WHITE3 = [1, 1, 1];
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
  if (PROJ[kind] && PROJ[kind].special) { const m = makeSpecialMesh(kind), sz = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()), big = Math.max(sz.x, sz.y, sz.z) || 1; m.scale.setScalar(Math.min(f, 1.2, 1.3 / big)); return m; }
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

