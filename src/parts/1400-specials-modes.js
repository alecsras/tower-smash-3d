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
const emojiTexCache = {};
function emojiSprite(e, s = .9) {
  const t = emojiTexCache[e] || (emojiTexCache[e] = canvasTex(128, 128, (c, w, h) => { c.font = '96px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 64, 72); }));
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); sp.scale.setScalar(s); return sp;
}
function makeSpecialMesh(kind) {
  const A = typeof ARSENAL !== 'undefined' && ARSENAL[kind];
  if (A) { const m = A.mesh ? A.mesh() : new THREE.Group().add(emojiSprite(A.emoji || '💥')); m.traverse(o => { if (o.isMesh) o.castShadow = true; }); return m; }
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
  } else if (kind === 'firebomb') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(p.r, 18, 12), new THREE.MeshStandardMaterial({ color: 0x9c1d0e, emissive: 0xff4a10, emissiveIntensity: .5, roughness: .4 })));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, .28, 10), new THREE.MeshStandardMaterial({ color: 0x5a3a20 })); neck.position.y = p.r + .08; g.add(neck);
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
  if (ARSENAL[kind] && ARSENAL[kind].fire) {
    const beam = PROJ[kind].style === 'beam', dir = (beam ? new THREE.Vector3().subVectors(target, o0) : vel.clone()).normalize();
    ARSENAL[kind].fire({ vel, target: target.clone(), pw, o0, dir }); return;
  }
  if (kind === 'meteor') { startMeteors(target); return; }
  if (kind === 'rocket') {
    const d = new THREE.Vector3().subVectors(target, o0).normalize(), v = 24 + 40 * pw;
    spawnProj('rocket', o0, d.multiplyScalar(v), { rocket: true, bomb: true, power: 1.25, body: { gs: 0, lockRot: true } });
    snd.rocket(); return;
  }
  if (kind === 'cluster') { spawnProj('cluster', o0, vel, { bomb: true, cluster: true, power: 1 }); snd.whoosh(); return; }
  if (kind === 'firebomb') { spawnProj('firebomb', o0, vel, { bomb: true, fire: true, power: .75 }); snd.whoosh(); return; }
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
  updateMeteors(); updateQuake(); updateArsenal(dt);
}
function clearFields() { for (const f of fields) scene.remove(f.mesh); fields = []; meteorQueue = []; clearArsenal(); }

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
  night = on; shadowDirty = 2;
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
  if (d > 0 && !chal) { SAVE.coinFrac += d / 6; const c = Math.floor(SAVE.coinFrac); if (c) { SAVE.coinFrac -= c; addCoins(c, c >= 5); } }
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
// ---- save data, coins & shop ----
// SAVE and persist() live in 0180-save.js
const PRICES = { firebomb: 120, cluster: 150, rocket: 200, meteor: 300, hole: 450, nuke: 700 };
const isLocked = k => !chal && !SAVE.sandbox && PRICES[k] && !SAVE.unlocked[k];
function addCoins(n, why) {
  if (!n) return; SAVE.coins += n; persist(); updateCoins();
  if (why) { const el = document.createElement('div'); el.className = 'pop coin'; el.innerHTML = `+${n} ${ico('Coins', 's16')}`; el.style.left = 'calc(100% - 60px)'; document.body.appendChild(el); setTimeout(() => el.remove(), 1100); }
}
function updateCoins() { const b = $('coinBtn'); if (b) b.innerHTML = `${ico('Coins', 's16')}<span>${SAVE.coins.toLocaleString()}</span>`; }
function openShop() {
  const g = $('shopList'); g.innerHTML = '';
  const CAT_NAME = { kinetic: 'Kinetic', explosive: 'Explosive', elemental: 'Elemental', exotic: 'Exotic', silly: 'Silly' };
  let lastCat = null;
  for (const [k, price] of Object.entries(PRICES)) {
    const cat = PROJ[k].cat || 'power'; if (cat !== lastCat) { lastCat = cat; const h = document.createElement('div'); h.className = 'shophead'; h.textContent = CAT_NAME[cat] || 'Power'; g.appendChild(h); }
    const own = SAVE.unlocked[k] || SAVE.sandbox, row = document.createElement('div'); row.className = 'shoprow';
    row.appendChild(iconFor(k, 'throw'));
    row.insertAdjacentHTML('beforeend', `<div><b>${PROJ[k].label}</b><small>${PROJ[k].desc || ''}</small></div>`);
    const b = document.createElement('button'); b.className = own ? 'b2' : 'b1'; b.innerHTML = own ? 'Owned' : `${ico('Coins', 's16')} ${price}`; b.disabled = own;
    b.onclick = async () => { if (SAVE.coins < price) { toast(`You need ${price - SAVE.coins} more coins — smash things to earn them`, 'warn'); return; }
      if (price > 300 && !(await confirmDlg(`Buy ${PROJ[k].label}?`, `This spends ${price} of your ${SAVE.coins.toLocaleString()} coins.`, `Buy for ${price}`))) return;
      logAct('buy ' + k); SAVE.coins -= price; SAVE.unlocked[k] = true; persist(); updateCoins(); snd.ding(); openShop(); buildUI(); };
    row.appendChild(b); g.appendChild(row);
  }
  $('shop').classList.add('open');
}
$('shopX').onclick = () => $('shop').classList.remove('open');
$('shop').addEventListener('click', e => { if (e.target.id === 'shop') $('shop').classList.remove('open'); });
$('coinBtn').onclick = openShop;

// ---- Blorbs: the little jelly targets of the campaign ----
const blorbMat = new THREE.MeshStandardMaterial({ color: 0x5ed14a, roughness: .35, emissive: 0x0a3a05, emissiveIntensity: .4 });
const blorbRimMat = new THREE.MeshBasicMaterial({ color: 0x0b2a06, side: THREE.BackSide });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .2 }), pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
function makeBlorbMesh() {
  const g = new THREE.Group(), r = .34;
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), blorbMat); body.scale.set(1, .9, 1); g.add(body);
  // a dark outline so Blorbs read by shape, not only by their green color
  const rim = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 20, 14), blorbRimMat); rim.scale.set(1, .9, 1); g.add(rim);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), eyeMat); eye.position.set(s * .12, .08, r * .85); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), pupilMat); pupil.position.set(s * .12, .08, r * .85 + .07); g.add(pupil);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.09, .018, 6, 12, Math.PI), pupilMat); smile.position.set(0, -.06, r * .9); smile.rotation.z = Math.PI; g.add(smile);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function spawnBlorb(x, y, z) {
  const body = new P.PBody({ shape: { kind: 'ball', r: .34 }, mass: .5, pos: new V3(x, y + .35, z), quat: Q4.yaw(rand(0, 6.28)), rest: .2, fric: .7 });
  const o = addObj({ body, dormant: true, mesh: makeBlorbMesh(), type: 'blorb' });
  o.bhome = body.position.clone(); syncMesh(o);
  return o;
}
function popBlorb(o) {
  if (o.popped) return; o.popped = true;
  const p = o.body.position;
  for (let i = 0; i < 40; i++) spawnP(p.x, p.y, p.z, rand(-5, 5), rand(0, 7), rand(-5, 5), rand(.4, .9), [.35, .9, .3], rand(.12, .25), -14, 0);
  if (!o.gone) removeObj(o);
  snd.squish(); addCoins(5, true);
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = 'POP!'; el.style.left = `calc(50% + ${rand(-80, 80)}px)`; el.style.color = '#7dff5a';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
  if (chal) updateHud();
}
function checkBlorbs() {
  if (!chal || !chal.blorbs) return;
  for (const b of chal.blorbs) {
    if (b.popped) continue;
    if (b.gone || b.body.position.distanceTo(b.bhome) > 1.1 || b.body.position.y < b.bhome.y - .9 || b.hitHard) popBlorb(b);
  }
}

// ---- generic challenge engine (campaign, demolition, daily, duels) ----
// def: {title, setup(), ammo:[[kind,size,n]] | pool:{n, maxSize}, goal:'pct'|'blorb', stars:[..] (pct), onResult(res)->{msg,next,extra}, hud?}
function startChallenge(def) {
  goGame(); closeAllSheets(); paused = false; sceneIsFree = false; logAct('level ' + def.title);
  clearFields(); $('result').classList.remove('open'); $('levels').classList.remove('open');
  chal = null; setMode('build'); clearAll();
  const before = objs.length; def.setup();
  chal = { def, ammo: (def.ammo || []).map(([kind, size, n]) => ({ kind, size, n })), pool: def.pool ? { ...def.pool } : null, endAt: null, pct: 0, shown: false, shots: 0,
    blorbs: objs.filter(o => o.type === 'blorb'), winAt: null };
  if (chal.pool) { curProj = 'bomb'; curSize = 1; } else { curProj = chal.ammo[0].kind; curSize = chal.ammo[0].size; }
  setMode('throw'); document.body.classList.add('inlevel'); lastDown = null; updateHud();
  toast(def.title + (def.goal === 'blorb' ? ` — pop all ${chal.blorbs.length} Blorbs!` : ` — ★ at ${def.stars[0]}%`));
}
const ammoLeft = () => !chal ? Infinity : chal.pool ? chal.pool.n : chal.ammo.reduce((n, a) => n + a.n, 0);
const ammoTotal = () => !chal ? 0 : chal.pool ? chal.def.pool.n : chal.def.ammo.reduce((n, a) => n + a[2], 0);
function useAmmo() {
  if (!chal) { if (isLocked(curProj)) { openShop(); return false; } return true; }
  if (chal.shown || chal.endAt) return null;
  if (chal.pool) { if (chal.pool.n <= 0) return false; chal.pool.n--; }
  else {
    let a = chal.ammo.find(a => a.kind === curProj && a.n > 0);
    if (!a) {   // the selected weapon is empty: switch to what's left instead of failing the throw
      a = chal.ammo.find(q => q.n > 0); if (!a) return false;
      curProj = a.kind; curSize = a.size; buildUI(); toast(`Switched to ${PROJ[a.kind].label}`); return false;
    }
    curSize = a.size; a.n--;
    if (!chal.ammo.some(q => q.kind === curProj && q.n > 0)) {
      const nx = chal.ammo.find(q => q.n > 0);
      if (nx) { const was = PROJ[curProj].label; curProj = nx.kind; curSize = nx.size; setTimeout(() => toast(`Out of ${was.toLowerCase()}s — next up: ${PROJ[nx.kind].label}`), 400); }
    }
    buildUI();
  }
  chal.shots++;
  if (!ammoLeft()) chal.endAt = simTime + 4;
  buildUI(); return true;
}
function checkLevelEnd() {
  if (!chal || chal.shown) return;
  checkBlorbs();
  const goal = chal.def.goal;
  if (goal === 'blorb' && chal.blorbs.every(b => b.popped)) { if (chal.winAt == null) chal.winAt = simTime + 1.4; if (simTime >= chal.winAt) return finishChallenge(); return; }
  if (chal.endAt == null) return;
  const busy = P.activeCount > 40 || meteorQueue.length || fields.length || objs.some(o => o.type === 'proj' && !o.gone && (o.bomb || o.hole) && simTime - o.born < 4.5);
  if (simTime < chal.endAt || (busy && simTime < chal.endAt + 8)) return;
  finishChallenge();
}
function finishChallenge() {
  chal.shown = true; updateHud();
  const d = chal.def, left = ammoLeft(), total = ammoTotal();
  let stars, win, line;
  if (d.goal === 'blorb') {
    const alive = chal.blorbs.filter(b => !b.popped).length; win = !alive;
    stars = win ? (left >= Math.max(2, Math.ceil(total * .4)) ? 3 : left >= 1 ? 2 : 1) : 0;
    line = win ? 'All Blorbs popped!' : `${alive} Blorb${alive > 1 ? 's' : ''} survived`;
  } else {
    stars = d.stars.filter(s => chal.pct >= s).length; win = stars > 0; line = `${chal.pct}% toppled`;
  }
  const res = { stars, win, pct: chal.pct, left, shots: chal.shots };
  const out = d.onResult ? d.onResult(res) || {} : {};
  $('rTitle').textContent = d.title;
  $('rStars').innerHTML = [0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}" style="animation-delay:${k * .25}s">★</span>`).join('');
  $('rPct').textContent = line;
  $('rMsg').textContent = out.msg || (stars === 3 ? 'Perfect!' : win ? 'Nice — go for 3 stars?' : 'So close — try again!');
  $('rNext').style.display = out.next ? '' : 'none'; $('rNext').onclick = () => out.next && startChallenge(out.next);
  $('rRetry').onclick = () => startChallenge(d);
  $('rLevels').textContent = out.back ? 'Home' : 'Levels';
  $('rLevels').onclick = () => { $('result').classList.remove('open'); out.back ? out.back() : openLevels(); };
  $('rHome').onclick = () => { $('result').classList.remove('open'); goHome(); }; $('rHome').style.display = out.back ? 'none' : '';
  $('rReplay').style.display = rec.frames.length > 20 ? '' : 'none'; $('rReplay').onclick = () => { $('result').classList.remove('open'); startReplay(false); };
  logAct(`result ${d.title} ${stars}★ ${win ? 'win' : 'lose'}`);
  const ex = $('rExtra'); ex.style.display = out.extra ? '' : 'none';
  if (out.extra) { ex.textContent = out.extra.label; ex.onclick = out.extra.onclick; }
  $('result').classList.add('open'); if (win) snd.ding();
}
function exitChallenge() { if (!chal) return; chal = null; document.body.classList.remove('inlevel'); $('result').classList.remove('open'); }
function challengeHud() {
  const d = chal.def, shots = ammoLeft();
  if (d.goal === 'blorb') return `${d.short || ''} 🟢 ${chal.blorbs.filter(b => !b.popped).length} left · 🎯 ${shots}`;
  return `${d.short || ''} 💥 ${chal.pct}% · 🎯 ${shots} · ★${d.stars.join(' ★')}`;
}

// ---- demolition levels (the original 10) ----
const loadStars = () => { try { return JSON.parse(localStorage.getItem('ts_stars') || '{}'); } catch (e) { return {}; } };
const saveStars = s => { try { localStorage.setItem('ts_stars', JSON.stringify(s)); } catch (e) {} };
function demoDef(i) {
  const L = LEVELS[i];
  return { title: `Challenge ${i + 1} · ${L.name}`, short: `D${i + 1}`, goal: 'pct', stars: L.stars, ammo: L.ammo,
    setup: () => loadPreset(PRESETS.find(p => p.id === L.preset)),
    onResult: r => { const st = loadStars(), prev = st[i] || 0; if (r.stars > prev) { st[i] = r.stars; saveStars(st); addCoins((r.stars - prev) * 30, true); }
      return { next: r.stars && i < LEVELS.length - 1 ? demoDef(i + 1) : null, msg: r.stars < 3 ? (r.stars ? `Next star at ${L.stars[r.stars]}%` : `Need ${L.stars[0]}% for a star`) : 'Perfect demolition!' }; } };
}
const startLevel = i => startChallenge(demoDef(i));

// ---- campaign: 50 generated levels ----
const TIER_MATS = [['wood', 'glass'], ['wood', 'stone', 'striped'], ['stone', 'concrete', 'checker'], ['concrete', 'marble', 'stone', 'checker'], ['stone', 'concrete', 'marble', 'gold']];
const TIER_AMMO = [[['ball', 1, 2], ['bowling', 1, 1]], [['bowling', 1, 2], ['cannon', 1, 1]], [['cannon', 1, 2], ['bomb', 1, 1]], [['bomb', 1, 2], ['anvil', 2, 1], ['rocket', 1, 1]], [['bomb', 2, 2], ['cluster', 1, 1], ['rocket', 1, 1]]];
function cfg(o) { return Object.assign(cbDefault(), { windows: 0, roof: false, floors: 0 }, o); }
function campaignLayout(n) {
  const R = rng(n * 977 + 13), T = Math.min(4, Math.floor(n / 10)), pick = a => a[Math.floor(R() * a.length)], mat = () => pick(TIER_MATS[T]);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const cfgs = [], raw = [];
  const type = n % 10 === 9 ? 'boss' : ['hut', 'tower', 'twins', 'pyramid', 'fort', 'columns', 'glass', 'bunker'][n % 8];
  if (type === 'hut') cfgs.push(cfg({ shape: 'hollow', w: ri(3, 5), l: ri(3, 5), h: ri(3, 4) + T, mat: mat(), floors: 2, roof: R() < .6, windows: 3 }));
  if (type === 'tower') cfgs.push(cfg({ shape: R() < .5 ? 'hollow' : 'round', w: ri(4, 5), l: ri(4, 5), h: 6 + 2 * T + ri(0, 4), mat: mat(), floors: 3, roof: true, windows: 3 }));
  if (type === 'twins') { const h = 5 + 2 * T + ri(0, 2); for (const s of [-3, 3]) cfgs.push(cfg({ shape: 'hollow', w: 3, l: 3, h, mat: mat(), floors: 3, x: s })); raw.push({ spec: Bx('wood', 9, .4, 3), x: 0, y: h * LAY, z: 0 }); }
  if (type === 'pyramid') cfgs.push(cfg({ shape: 'pyramid', w: 5 + 2 * T, l: 5 + 2 * T, h: 60, mat: T > 1 ? 'sand' : mat() }));
  if (type === 'fort') { const s = 3 + T, h = 2 + Math.ceil(T / 2) + 1;
    cfgs.push(cfg({ shape: 'wall', w: 2 * s - 1, l: 1, h, mat: mat(), z: -s, crenels: true }), cfg({ shape: 'wall', w: 2 * s - 1, l: 1, h, mat: mat(), z: s, crenels: true }),
      cfg({ shape: 'wall', w: 1, l: 2 * s - 3, h, mat: mat(), x: -s + 1 }), cfg({ shape: 'wall', w: 1, l: 2 * s - 3, h, mat: mat(), x: s - 1 })); }
  if (type === 'columns') { const k = 3 + Math.min(2, T), h = 3 + T + ri(0, 2), m = mat();
    for (let i = 0; i < k; i++) { const x = (i - (k - 1) / 2) * 3; for (const dz of [-1, 1]) cfgs.push(cfg({ shape: 'solid', w: 1, l: 1, h, mat: m, x, z: dz }));
      raw.push({ spec: Bx('wood', 1.6, .4, 3.2), x, y: h * LAY, z: 0 }); } }
  if (type === 'glass') cfgs.push(cfg({ shape: 'hollow', w: 4, l: 4, h: 8 + 2 * T, mat: 'glass', floors: 2, roof: true }));
  if (type === 'bunker') { const w = 6, h = 3 + T; cfgs.push(cfg({ shape: 'hollow', w, l: w, h, thick: 2, mat: T > 1 ? 'concrete' : 'stone' })); raw.push({ spec: Bx('concrete', w + .2, .4, w + .2), x: 0, y: h * LAY, z: 0 }); }
  if (type === 'boss') { const s = 6 + T;
    for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) cfgs.push(cfg({ shape: 'round', w: 4, l: 4, h: 7 + 2 * T, mat: mat(), x, z, floors: 3, roof: true, windows: 3 }));
    cfgs.push(cfg({ shape: 'hollow', w: 6, l: 6, h: 9 + 2 * T, mat: mat(), floors: 3, roof: true, windows: 3, tnt: true }));
    for (const z of [-s, s]) cfgs.push(cfg({ shape: 'wall', w: 2 * s - 5, l: 1, h: 3 + T, mat: mat(), z, crenels: true })); }
  const nBlorbs = Math.min(6, 1 + Math.floor(n / 9) + (type === 'boss' ? 2 : 0));
  let ammo = TIER_AMMO[T].map(a => a.slice());
  if (type === 'boss') ammo.push(n === 49 ? ['nuke', 1, 1] : n >= 29 ? ['hole', 1, 1] : ['cluster', 1, 1]);
  return { cfgs, raw, nBlorbs, ammo, type, R };
}
function blorbSpots(pieces, k, R) {
  const boxes = pieces.map(p => pieceAABB(p)), cands = [];
  const free = (x, y, z) => !boxes.some(b => b.lowerBound.x < x + .32 && b.upperBound.x > x - .32 && b.lowerBound.z < z + .32 && b.upperBound.z > z - .32 && b.upperBound.y > y + .02 && b.lowerBound.y < y + .75);
  const cover = (x, y, z) => boxes.filter(b => b.lowerBound.x < x + .3 && b.upperBound.x > x - .3 && b.lowerBound.z < z + .3 && b.upperBound.z > z - .3 && b.lowerBound.y >= y + .7).length;
  pieces.forEach((p, i) => {
    if (p.spec.shape !== 'box') return; const b = boxes[i], top = b.upperBound.y;
    const wx = b.upperBound.x - b.lowerBound.x, wz = b.upperBound.z - b.lowerBound.z; if (wx < .8 || wz < .8) return;
    for (let x = b.lowerBound.x + .5; x <= b.upperBound.x - .45; x += 1) for (let z = b.lowerBound.z + .5; z <= b.upperBound.z - .45; z += 1) if (free(x, top, z)) cands.push([x, top, z]);
  });
  if (boxes.length) {   // ground spots inside the structure's footprint
    const x0 = Math.min(...boxes.map(b => b.lowerBound.x)), x1 = Math.max(...boxes.map(b => b.upperBound.x)), z0 = Math.min(...boxes.map(b => b.lowerBound.z)), z1 = Math.max(...boxes.map(b => b.upperBound.z));
    for (let x = Math.ceil(x0) + .5; x < x1 - .4; x += 1) for (let z = Math.ceil(z0) + .5; z < z1 - .4; z += 1) if (free(x, 0, z)) cands.push([x, 0, z]);
  }
  const scored = cands.map(c => ({ c, s: cover(...c) * 1.5 + c[1] * .15 + R() * 2 })).sort((a, b) => b.s - a.s), out = [];
  for (const { c } of scored) { if (out.length >= k) break; if (out.every(o => Math.hypot(o[0] - c[0], o[2] - c[2]) > 1.3 || Math.abs(o[1] - c[1]) > 1.5)) out.push(c); }
  return out;
}
function placeLayout(L) {
  const pieces = L.cfgs.flatMap(genStructure).concat(L.raw);
  let ext = 6, top = 0;
  for (const p of pieces) { ext = Math.max(ext, Math.abs(p.x) + 1.5, Math.abs(p.z) + 1.5); top = Math.max(top, p.y + specHeight(p.spec)); }
  setArena(clamp(Math.ceil(ext + 1), 10, 34));
  for (const p of pieces) put(p.spec, p.x, p.y, p.z, p.rot);
  for (const s of blorbSpots(pieces, L.nBlorbs, L.R)) spawnBlorb(...s);
  cam.tR = clamp(Math.max(ext * 2.6, top * 2, 18), 14, 70); cam.target.y = clamp(top * .3, 1.5, 9); cam.tEl = .4;
}
function campaignDef(n) {
  const L = campaignLayout(n);
  return { title: `Level ${n + 1}${L.type === 'boss' ? ' · BOSS' : ''}`, short: `L${n + 1}`, goal: 'blorb', ammo: L.ammo, setup: () => placeLayout(campaignLayout(n)),
    onResult: r => { const prev = SAVE.camp[n] || 0; if (r.stars > prev) { SAVE.camp[n] = r.stars; persist(); addCoins((r.stars - prev) * 20 + (prev ? 0 : 15), true); }
      return { next: r.win && n < 49 ? campaignDef(n + 1) : null, msg: r.win ? (r.stars < 3 ? 'Win with more shots left for 3 ★' : 'Flawless!') : 'Blorbs survived — try another angle' }; } };
}

// ---- daily challenge ----
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function dailyDef() {
  const key = todayKey(), seed = [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  return { title: `Daily · ${key}`, short: '📅', goal: 'pct', stars: [30, 55, 80], ammo: [['bomb', 1, 1], ['cannon', 2, 1], ['rocket', 1, 1]],
    setup: () => { const R = rng(seed), lay = { cfgs: [], raw: [], nBlorbs: 0, R }, spots = [[-6, -6], [0, -6], [6, -6], [-6, 0], [6, 0], [-6, 6], [0, 6], [6, 6], [0, 0]];
      for (const [x, z] of spots) { const t = Math.floor(R() * 4), m = ['stone', 'wood', 'glass', 'concrete', 'striped', 'checker'][Math.floor(R() * 6)];
        if (t === 0) lay.cfgs.push(cfg({ shape: 'hollow', w: 3, l: 3, h: 4 + Math.floor(R() * 10), mat: m, floors: 3, roof: R() < .5, x, z }));
        if (t === 1) lay.cfgs.push(cfg({ shape: 'round', w: 4, l: 4, h: 4 + Math.floor(R() * 8), mat: m, x, z, roof: true }));
        if (t === 2) lay.cfgs.push(cfg({ shape: 'pyramid', w: 4, l: 4, h: 60, mat: m, x, z }));
        if (t === 3) lay.cfgs.push(cfg({ shape: 'solid', w: 2, l: 2, h: 3 + Math.floor(R() * 9), mat: m, x, z, windows: 2 })); }
      placeLayout(lay); },
    onResult: r => {
      const d = SAVE.daily, first = d.date !== key;
      if (first) { const y = new Date(); y.setDate(y.getDate() - 1); const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
        d.streak = d.date === yk ? (d.streak || 0) + 1 : 1; d.date = key; d.best = 0; addCoins(40 + 10 * Math.min(d.streak, 7), true); }
      const better = r.pct > (d.best || 0); if (better) d.best = r.pct; persist();
      return { msg: `${better ? 'New best!' : `Today's best: ${d.best}%`} · 🔥 ${d.streak}-day streak`,
        extra: { label: '📋 Copy score', onclick: () => copyText(`💥 Tower Smash daily ${key}: I toppled ${r.pct}% in 3 shots (🔥${d.streak} day streak). ${PAGES_URL}`) } };
    } };
}

// ---- levels sheet with tabs ----
let levelsTab = 'camp';
function openLevels(tab) {
  if (tab) levelsTab = tab;
  for (const t of ['camp', 'demo', 'daily']) $('tab_' + t).classList.toggle('on', t === levelsTab);
  const g = $('lgrid'); g.innerHTML = ''; g.className = levelsTab === 'camp' ? 'camp' : '';
  if (levelsTab === 'camp') {
    const tot = Object.values(SAVE.camp).reduce((a, b) => a + b, 0);
    g.insertAdjacentHTML('beforeend', `<div class="sect">Pop every Blorb 🟢 · ${tot} / 150 ★</div>`);
    for (let n = 0; n < 50; n++) {
      const st = SAVE.camp[n] || 0, locked = n > 0 && !(SAVE.camp[n - 1] > 0), boss = n % 10 === 9;
      const b = document.createElement('button'); b.className = 'lvlc' + (locked ? ' locked' : '') + (boss ? ' boss' : '') + (st ? ' done' : '');
      b.innerHTML = `<b>${locked ? '🔒' : boss ? '👑' : n + 1}</b><i>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</i>`;
      b.onclick = () => locked ? toast('Beat the previous level first') : startChallenge(campaignDef(n));
      g.appendChild(b);
    }
  } else if (levelsTab === 'demo') {
    const st = loadStars();
    LEVELS.forEach((L, i) => {
      const best = st[i] || 0, locked = i > 0 && !(st[i - 1] > 0);
      const b = document.createElement('button'); b.className = 'card lvl' + (locked ? ' locked' : '');
      const ammo = L.ammo.map(([k, s, n]) => `${n}× ${['S', 'M', 'L', 'XL'][s]} ${PROJ[k].label}`).join(' + ');
      b.innerHTML = `<span class="em">${locked ? '🔒' : i + 1}</span><b>${L.name}</b><small>${ammo}</small><i>${'★'.repeat(best)}${'☆'.repeat(3 - best)}</i>`;
      b.onclick = () => locked ? toast('Get ★ on the previous level first') : startLevel(i);
      g.appendChild(b);
    });
  } else {
    const d = SAVE.daily, done = d.date === todayKey();
    g.insertAdjacentHTML('beforeend', `<div class="daily"><div class="em">📅</div><b>Daily challenge</b><p>A new city every day. 3 shots — topple as much as you can.</p>
      <p>🔥 Streak: <b>${d.streak || 0}</b> day${d.streak === 1 ? '' : 's'} · Today's best: <b>${done ? d.best + '%' : '—'}</b></p><p class="small">First play each day: +40 🪙 plus a streak bonus</p></div>`);
    const b = document.createElement('button'); b.className = 'b1 wide'; b.textContent = done ? 'Play again' : 'Play today\'s challenge'; b.onclick = () => startChallenge(dailyDef()); g.appendChild(b);
  }
  $('levels').classList.add('open');
}
for (const t of ['camp', 'demo', 'daily']) $('tab_' + t).onclick = () => openLevels(t);
$('levelsX').onclick = () => $('levels').classList.remove('open');
$('levels').addEventListener('click', e => { if (e.target.id === 'levels') $('levels').classList.remove('open'); });

// ---- Build vs Smash duels: the fortress travels inside a share code / link ----
const PAGES_URL = 'https://alecsras.github.io/tower-smash-3d/';
let duelBuild = null;   // {budget, name} while you're building a fortress for a friend
const duelCost = o => o.mat === 'tnt' ? 5 : 1;
const duelUsed = () => objs.filter(o => !o.gone && o.type === 'block').reduce((n, o) => n + duelCost(o), 0);
function b64u(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function packJSON(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) { const c = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return 'TS1z' + b64u(new Uint8Array(c)); }
  return 'TS1j' + b64u(raw);
}
async function unpackJSON(code) {
  code = code.trim(); const m = code.match(/TS1[zj][A-Za-z0-9_-]+/); if (!m) throw new Error('No challenge code found');
  const body = unb64u(m[0].slice(4));
  const bytes = m[0][3] === 'z' ? new Uint8Array(await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : body;
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function encodeFortress(extra = {}) {
  const pal = [], key = s => { const k = s.mat + '|' + s.shape + '|' + s.d.map(v => +v.toFixed(3)).join(','); let i = pal.findIndex(p => p.k === k); if (i < 0) { pal.push({ k, s }); i = pal.length - 1; } return i; };
  const pieces = [];
  for (const o of objs) {
    if (o.gone || o.type !== 'block') continue;
    const p = o.body.position, q = o.body.quaternion, yaw = Math.round(2 * Math.atan2(q.y, q.w) * 180 / Math.PI) % 360;
    pieces.push([key(o.spec), Math.round(p.x * 100), Math.round((p.y - specHeight(o.spec) / 2) * 100), Math.round(p.z * 100), yaw]);
  }
  return packJSON({ v: 1, n: (duelBuild && duelBuild.name) || 'A friend', pal: pal.map(p => [p.s.mat, p.s.shape, p.s.d]), p: pieces, ...extra });
}
function duelDef(F) {
  const pal = F.pal.map(([mat, shape, d]) => ({ mat, shape, d }));
  const beat = F.best ? ` (${F.bestBy || 'someone'} got ${F.best}%)` : '';
  return { title: `⚔️ ${F.n}'s fortress${beat}`, short: '⚔️', goal: 'pct', stars: [25, 50, 75], pool: { n: F.s || 3 },
    setup: () => {
      let ext = 6, top = 0;
      for (const [i, x, y, z] of F.p) { ext = Math.max(ext, Math.abs(x / 100) + 1.5, Math.abs(z / 100) + 1.5); top = Math.max(top, y / 100 + specHeight(pal[i])); }
      setArena(clamp(Math.ceil(ext + 1), 10, 34));
      for (const [i, x, y, z, yaw] of F.p) put(pal[i], x / 100, y / 100, z / 100, yaw * Math.PI / 180);
      cam.tR = clamp(Math.max(ext * 2.6, top * 2, 18), 14, 70); cam.target.y = clamp(top * .3, 1.5, 9); cam.tEl = .4;
    },
    onResult: r => ({ msg: F.best ? (r.pct > F.best ? `You beat ${F.bestBy || 'them'}! 🏆` : `${F.bestBy || 'They'} still lead with ${F.best}%`) : 'Send it back and dare them to build better!',
      extra: { label: '📤 Send result', onclick: async () => {
        const who = (SAVE.name || 'Someone').slice(0, 16);
        const code = await packJSON({ ...F, best: Math.max(r.pct, F.best || 0), bestBy: r.pct >= (F.best || 0) ? who : F.bestBy });
        showShare(`💥 I smashed ${r.pct}% of ${F.n}'s fortress in ${F.s || 3} shots! Think you can beat it?`, code);
      } } })
  };
}
function copyText(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copied!'), () => { $('shareCode').value = t; $('shareCode').select(); toast('Select & copy the text'); }); }
function showShare(text, code) {
  const link = PAGES_URL + '#duel=' + code;
  $('shareText').textContent = text; $('shareCode').value = code; $('shareLink').value = link;
  $('shareCopyAll').onclick = () => copyText(`${text}\n${link}`);
  $('shareCopyCode').onclick = () => copyText(code);
  $('shareNative').style.display = navigator.share && !inFrame ? '' : 'none';
  $('shareNative').onclick = () => navigator.share({ title: 'Tower Smash', text, url: link }).catch(() => {});
  $('result').classList.remove('open'); $('duel').classList.add('open'); $('duelPanes').dataset.pane = 'share';
}
const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
function openDuel() {
  $('duelPanes').dataset.pane = duelBuild ? 'building' : 'home';
  if (duelBuild) $('duelBudgetTxt').textContent = `${duelUsed()} / ${duelBuild.budget} blocks used`;
  $('duel').classList.add('open');
}
let duelBudget = 400;
$('duelName').value = SAVE.name || ''; $('duelName').onchange = e => { SAVE.name = e.target.value.trim().slice(0, 16); persist(); };
document.querySelectorAll('#duelBudgets button').forEach(b => b.onclick = () => { duelBudget = +b.dataset.v; document.querySelectorAll('#duelBudgets button').forEach(c => c.classList.toggle('on', c === b)); });
$('duelFresh').onclick = () => { goGame(); sceneIsFree = false; logAct('duel build'); duelBuild = { budget: duelBudget, name: ($('duelName').value || 'A friend').trim().slice(0, 16) }; clearAll(); snapshot = null; dirty = true; setArena(10); $('duel').classList.remove('open'); setMode('build'); toast(`⚔️ Build your fortress — ${duelBudget} block budget`); updateHud(); };
$('duelUse').onclick = () => { goGame(); sceneIsFree = false; logAct('duel build'); duelBuild = { budget: duelBudget, name: ($('duelName').value || 'A friend').trim().slice(0, 16) }; $('duel').classList.remove('open'); setMode('build'); updateHud(); toast('⚔️ Fortress mode on — tap ⚔️ when ready to send'); };
$('duelSend').onclick = async () => {
  const used = duelUsed();
  if (!used) { toast('Build something first!'); return; }
  if (used > duelBuild.budget) { toast(`Over budget by ${used - duelBuild.budget} — remove some blocks (TNT costs 5)`); return; }
  const code = await encodeFortress({ s: 3 });
  showShare(`⚔️ ${duelBuild.name} built a ${used}-block fortress. Can you smash it in 3 shots?`, code);
};
$('duelCancel').onclick = () => { duelBuild = null; $('duel').classList.remove('open'); updateHud(); toast('Fortress mode off'); };
$('duelPlay').onclick = async () => {
  try { const F = await unpackJSON($('duelPaste').value); $('duel').classList.remove('open'); duelBuild = null; startChallenge(duelDef(F)); }
  catch (e) { toast('That code didn’t work — paste the whole message'); }
};
$('duelX').onclick = () => $('duel').classList.remove('open');
$('duel').addEventListener('click', e => { if (e.target.id === 'duel') $('duel').classList.remove('open'); });
$('duelBtn').onclick = openDuel;
async function checkIncomingDuel() {
  const h = location.hash + location.search, m = h.match(/duel=(TS1[zj][A-Za-z0-9_-]+)/);
  if (!m) return;
  try { const F = await unpackJSON(m[1]); history.replaceState(null, '', location.pathname); startChallenge(duelDef(F)); } catch (e) { toast('Could not open that challenge link'); }
}

