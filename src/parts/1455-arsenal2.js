// ================= ARSENAL II: 50 more weapons =================
// Same contract as 1450-arsenal.js: def(key, { label, cat, price, emoji, desc, style, fire(ctx) }).
// Per-frame effects throttle their block searches (every ~0.1 s) so they stay cheap on 2–3k block builds.

// ---- shared helpers ----
const push = (o, x, y, z) => { const m = o.body.mass; o.body.applyImpulse(new V3(x * m, y * m, z * m)); };
const hdist = (o, c) => Math.hypot(o.body.position.x - c.x, o.body.position.z - c.z);
const bpos = o => V(o.body.position.x, o.body.position.y, o.body.position.z);
function crackNear(c, R, chance = 1) { for (const o of nearObjs(c, R, isBlock)) if (Math.random() < chance) { if (o.breakable) pendingBreak.add(o); else if (canFracture(o)) pendingFracture.add(o); } }
function radialPush(c, R, K, up = .3, filter) {
  for (const o of nearObjs(c, R, filter)) { const p = o.body.position, d = V(p.x - c.x, p.y - c.y, p.z - c.z), L = d.length() || .1, f = K * (1 - L / R);
    if (f > 0) push(o, d.x / L * f, d.y / L * f + up * f, d.z / L * f); }
}
// blocks whose centre lies within `w` of the ray o0 + dir*t, 0 < t < len, nearest first
function rayBlocks(o0, dir, len, w, filter = isBlock) {
  const out = [];
  for (const o of nearObjs(o0.clone().addScaledVector(dir, len / 2), len / 2 + 1, filter)) { const rel = bpos(o).sub(o0), t = rel.dot(dir); if (t < 0 || t > len) continue;
    if (rel.addScaledVector(dir, -t).length() < w) out.push([t, o]); }
  return out.sort((a, b) => a[0] - b[0]).map(e => e[1]);
}
function whiteFlash(op, dur = .5) { const w = $('whiteout'); if (!w) return; w.style.transition = 'none'; w.style.opacity = op; requestAnimationFrame(() => { w.style.transition = `opacity ${dur}s`; w.style.opacity = 0; }); }
function moveBlock(o, p, awake = true) {
  const spec = o.spec, q = o.body.quaternion.clone(), home = o.home; o.home = null; removeObj(o);
  const n = createPiece(spec, p.x, p.y, p.z, q, !awake); if (home) n.home = home; n.pop = 1; n.mdirty = true; return n;
}
function toIce(o) { if (o.mat === 'ice' || o.mat === 'tnt') return null; const n = respawnAs(o, { ...o.spec, mat: 'ice' }, false); n.breakable = true; n.body.setVelocity(0, 0, 0); return n; }
// an effect that runs `fn(k, dt)` every frame for `dur` seconds and calls `tick(k)` every `every` seconds
function timed(dur, fn, { every = .1, tick, end, kill } = {}) {
  const t0 = simTime; let next = 0;
  AFX.push({ upd(dt) { const k = simTime - t0; if (fn && fn(k, dt) === false) { if (end) end(); return false; }
    if (tick && simTime >= next) { next = simTime + every; tick(k); }
    if (k > dur) { if (end) end(); return false; } }, kill });
}
const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; return m; };
const cyl = (r1, r2, h, mat, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.castShadow = true; return m; };
const grp = (...ms) => { const g = new THREE.Group(); ms.forEach(m => g.add(m)); return g; };
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const quatTo = (from, dir) => { const q = new THREE.Quaternion().setFromUnitVectors(from, dir); return new Q4(q.x, q.y, q.z, q.w); };
// shared look-ups so volleys of 100+ pieces don't build 100 geometries
const SHARED = {};
const shared = (k, make) => SHARED[k] || (SHARED[k] = make());
function sideDir() { return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(); }
function arcVel(from, to, speed) { return solveVelocity(from, to, speed).vel; }
function hiddenBomb(kind, pos, vel, mesh, power, extra = {}, opts = {}) {
  return spawnBody(kind, { kind: 'ball', r: extra.r || .25 }, extra.mass || 3, pos, vel, mesh, { bomb: true, power, ...extra }, opts);
}

// ===== KINETIC =====
def('golf', { label: 'Golf Barrage', cat: 'kinetic', price: 70, emoji: '⛳', style: 'beam', desc: '30 golf balls fired in a rapid, ricocheting stream',
  mesh: () => sphereMesh(.12, stdMat(0xf4f4f0, { roughness: .3 })),
  fire({ o0, dir }) {
    const g = shared('golfG', () => new THREE.SphereGeometry(.12, 10, 8)), m = shared('golfM', () => stdMat(0xf4f4f0, { roughness: .3 }));
    for (let i = 0; i < 30; i++) later(i * .045, () => { const d = dir.clone().add(V(rand(-.04, .04), rand(-.02, .05), rand(-.04, .04))).normalize(), mesh = new THREE.Mesh(g, m); mesh.castShadow = true;
      spawnBody('golfball', { kind: 'ball', r: .12 }, 2.5, o0, d.multiplyScalar(58), mesh, { expire: simTime + 5 }, { rest: .85, gs: .6 }); if (i % 4 === 0) snd.clack(); });
  } });
def('javelin', { label: 'Javelin', cat: 'kinetic', price: 110, emoji: '🔱', style: 'beam', desc: 'A long steel spear that skewers deep into the tower',
  mesh: () => grp(cyl(.06, .06, 3, stdMat(0x8a6a44)), at(new THREE.Mesh(new THREE.ConeGeometry(.12, .45, 10), stdMat(0xc9d0d8, { metalness: .7, roughness: .25 })), 0, 1.7, 0)),
  fire({ o0, dir, pw }) {
    const mesh = ARSENAL.javelin.mesh(); mesh.children.forEach(c => c.rotation.x = Math.PI / 2); mesh.children[1].position.set(0, 0, 1.7);
    const o = spawnBody('javelin', { kind: 'box', hx: .08, hy: .08, hz: 1.6 }, 60, o0, dir.clone().multiplyScalar(48 + 20 * pw), mesh, { expire: simTime + 7, onHit(j, other) { if (other && other.userData && other.userData.type === 'block') crackNear(bpos(j), 1.6, .8); snd.clang(); } }, { quat: quatTo(V(0, 0, 1), dir), gs: .35 });
    o.body.setAngularVelocity(0, 0, 0); snd.whoosh();
  } });
def('sawblade', { label: 'Saw Blade', cat: 'kinetic', price: 190, emoji: '🪚', style: 'beam', desc: 'A screaming circular saw slices a level cut through the build',
  mesh: () => { const g = new THREE.Group(), mt = stdMat(0xc9d0d8, { metalness: .8, roughness: .2 }); g.add(cyl(1.2, 1.2, .06, mt, 28));
    for (let i = 0; i < 16; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(.12, .3, 4), mt); const a = i / 16 * 6.28; t.position.set(Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3); t.rotation.z = -Math.PI / 2; t.rotation.y = -a; g.add(t); } return g; },
  fire({ o0, target }) {
    const dir = flatDir(V(target.x - o0.x, 0, target.z - o0.z)), m = ARSENAL.sawblade.mesh(), y = Math.max(.6, target.y), p = V(o0.x, y, o0.z); m.position.copy(p); scene.add(m);
    let cut = 0;
    timed(3, (k, dt) => { p.addScaledVector(dir, 16 * dt); m.position.copy(p); m.rotation.y += dt * 40;
      if (Math.random() < .8) spawnP(p.x, p.y, p.z, rand(-4, 4), rand(0, 3), rand(-4, 4), .3, [1, .8, .4], .12, -8, 0); },
    { every: .05, tick() { for (const o of nearObjs(p, 2, isBlock)) { if (Math.abs(o.body.position.y - p.y) > .7) continue; cut++;
        if (canFracture(o)) pendingFracture.add(o); else vaporize(o, MAT_DUST[o.mat] || [.7, .7, .7], 3); push(o, dir.x * 3, .5, dir.z * 3); } if (cut) snd.crack(); },
      end() { scene.remove(m); if (cut) toast(`🪚 Sliced ${cut}`); }, kill() { scene.remove(m); } });
    noise(3, 'bandpass', 2400, .2, 3);
  } });
def('bearings', { label: 'Ball Bearings', cat: 'kinetic', price: 130, emoji: '🔩', style: 'strike', aoe: 3, desc: '150 steel bearings pour down and roll into every gap',
  fire({ target }) {
    const g = shared('brgG', () => new THREE.SphereGeometry(.13, 8, 6)), mt = shared('brgM', () => stdMat(0xd0d6dc, { metalness: .9, roughness: .15 }));
    for (let i = 0; i < 150; i++) later(i * .012, () => { const mesh = new THREE.Mesh(g, mt);
      spawnBody('bearing', { kind: 'ball', r: .13 }, 3, V(target.x + rand(-1.2, 1.2), target.y + rand(14, 18), target.z + rand(-1.2, 1.2)), V(0, -10, 0), mesh, { expire: simTime + 10 }, { rest: .35, fric: .1 }); if (i % 25 === 0) snd.tink(1); });
  } });
def('safe', { label: 'Falling Safe', cat: 'kinetic', price: 150, emoji: '🗄️', style: 'strike', aoe: 2, desc: 'A one-tonne steel safe drops straight down',
  mesh: () => grp(box(1.3, 1.5, 1.3, stdMat(0x3c4a3c, { metalness: .6, roughness: .4 })), at(cyl(.22, .22, .08, stdMat(0xc8b060, { metalness: .8 })), 0, .2, .68)),
  fire({ target }) {
    const m = ARSENAL.safe.mesh(); m.children[1].rotation.x = Math.PI / 2;
    spawnBody('safe', { kind: 'box', hx: .65, hy: .75, hz: .65 }, 1000, V(target.x, target.y + 34, target.z), V(0, -14, 0), m, { expire: simTime + 9, onHit() { snd.clang(); shake = .7; } }, { rest: .02 });
    snd.whoosh();
  } });
def('avalanche', { label: 'Boulder Avalanche', cat: 'kinetic', price: 280, emoji: '🏔️', style: 'strike', aoe: 6, desc: 'A dozen boulders thunder in along the ground',
  fire({ target }) {
    const side = sideDir(), mt = shared('rockM', () => stdMat(0x7d746a, { roughness: 1, flatShading: true }));
    for (let i = 0; i < 12; i++) later(i * .12, () => { const r = rand(.6, 1.1), off = rand(-5, 5), m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mt); m.castShadow = true;
      const from = V(target.x - side.x * 26 + side.z * off, r + 2, target.z - side.z * 26 - side.x * off);
      const o = spawnBody('boulder2', { kind: 'ball', r }, 260 * r * r * r, from, V(side.x * 24, 0, side.z * 24), m, { expire: simTime + 9 }, { rest: .1 });
      o.body.setAngularVelocity(side.z * 8, 0, -side.x * 8); });
    snd.quake(); toast('🏔️ Avalanche!');
  } });
def('volley', { label: 'Cannon Volley', cat: 'kinetic', price: 240, emoji: '🏴‍☠️', style: 'strike', aoe: 5, desc: 'Eight cannons fire at once from all around the arena',
  fire({ target }) {
    const mt = shared('cbM', () => stdMat(0x22252a, { metalness: .6 }));
    for (let i = 0; i < 8; i++) later(i * .08, () => { const a = i / 8 * 6.28 + rand(-.2, .2), from = V(target.x + Math.cos(a) * 24, 3, target.z + Math.sin(a) * 24);
      const to = V(target.x + rand(-2, 2), target.y + rand(0, 3), target.z + rand(-2, 2));
      spawnBody('cannonball', { kind: 'ball', r: .42 }, 90, from, arcVel(from, to, 42), sphereMesh(.42, mt), { expire: simTime + 8 });
      for (let j = 0; j < 12; j++) spawnSmoke(from.x, from.y, from.z, rand(-1, 1), rand(.5, 2), rand(-1, 1), rand(1.5, 2.5), rand(1, 1.8), [.75, .73, .7], .6);
      snd.boom(); shake = Math.max(shake, .3); });
  } });
def('girder', { label: 'Steel Girder', cat: 'kinetic', price: 200, emoji: '🏗️', style: 'beam', desc: 'A spinning 5 m steel I-beam, thrown end over end',
  mesh: () => { const mt = stdMat(0xc0522a, { metalness: .5, roughness: .5 }); return grp(box(5, .08, .5, mt), at(box(5, .08, .5, mt), 0, .44, 0), at(box(5, .44, .08, mt), 0, .22, 0)); },
  fire({ o0, dir, pw }) {
    const m = ARSENAL.girder.mesh(); m.children.forEach(c => c.position.y -= .22);
    const o = spawnBody('girder', { kind: 'box', hx: 2.5, hy: .25, hz: .25 }, 400, o0, dir.clone().multiplyScalar(26 + 18 * pw), m, { expire: simTime + 8, onHit() { snd.clang(); } }, { quat: quatTo(V(1, 0, 0), flatDir(dir)), gs: .7 });
    const ax = sideDir(); o.body.setAngularVelocity(ax.x * 9, 0, ax.z * 9); snd.whoosh();
  } });
def('bowlrain', { label: 'Bowling Barrage', cat: 'kinetic', price: 160, emoji: '🎳', style: 'beam', desc: 'Ten bowling balls roll out in a fan along the floor',
  fire({ o0, target }) {
    const dir = flatDir(V(target.x - o0.x, 0, target.z - o0.z)), side = V(-dir.z, 0, dir.x), cols = [0x2a3cff, 0xd4202c, 0x1b1b1b, 0x8a2be2, 0x10a050];
    for (let i = 0; i < 10; i++) later(i * .07, () => { const off = (i - 4.5) * .9, from = V(o0.x + side.x * off, .5, o0.z + side.z * off);
      const o = spawnBody('bowl2', { kind: 'ball', r: .45 }, 70, from, dir.clone().multiplyScalar(26).addScaledVector(side, off * .3), sphereMesh(.45, stdMat(cols[i % 5], { roughness: .15 })), { expire: simTime + 8 }, { rest: .15 });
      o.body.setAngularVelocity(dir.z * -20, 0, dir.x * 20); });
    snd.rumble();
  } });
def('fist', { label: 'Giant Fist', cat: 'kinetic', price: 340, emoji: '👊', style: 'strike', aoe: 4, desc: 'A colossal fist punches down from the clouds',
  mesh: () => { const sk = stdMat(0xe0a47a, { roughness: .7 }), g = new THREE.Group(); g.add(box(3, 2.4, 2.6, sk)); for (let i = 0; i < 4; i++) g.add(at(box(.7, .7, .8, sk), -1.05 + i * .7, -1.4, .7)); g.add(at(box(.8, 1.6, .8, sk), 1.7, -.2, .5)); g.add(at(cyl(1.2, 1.3, 6, stdMat(0x2f5fbf)), 0, 4.2, 0)); return g; },
  fire({ target }) {
    const m = ARSENAL.fist.mesh(), y0 = target.y + 40, hitY = Math.max(target.y, .2) + 1.6; m.position.set(target.x, y0, target.z); scene.add(m);
    let hit = false;
    timed(2.4, (k, dt) => {
      if (!hit) { m.position.y -= dt * 70; if (m.position.y <= hitY) { hit = true; m.position.y = hitY; const c = V(target.x, hitY - 1.5, target.z);
        for (const o of nearObjs(c, 5)) { const d = hdist(o, c); if (d > 4.2) continue; const f = 1 - d / 4.2; push(o, (o.body.position.x - c.x) * 4 * f, -22 * f, (o.body.position.z - c.z) * 4 * f); }
        for (const o of nearObjs(V(target.x, 0, target.z), 40, o => isBlock(o) && hdist(o, c) < 2.5)) if (canFracture(o)) pendingFracture.add(o);
        radialPush(V(target.x, .3, target.z), 9, 9, .6); ringFX(V(target.x, .2, target.z), 1.8); scorch(V(target.x, 0, target.z), 1);
        for (let i = 0; i < 40; i++) { const a = rand(0, 6.28); spawnSmoke(target.x + Math.cos(a) * 2, .4, target.z + Math.sin(a) * 2, Math.cos(a) * rand(4, 8), rand(.2, 1), Math.sin(a) * rand(4, 8), rand(1.2, 2.2), rand(1, 2), [.72, .66, .58], .6); }
        snd.boom(); snd.rumble(); shake = 1.1; bulletUntil = simTime + .25; } }
      else if (k > 1.2) m.position.y += dt * 40;
    }, { end() { scene.remove(m); }, kill() { scene.remove(m); } });
    snd.whoosh();
  } });

// ===== EXPLOSIVE =====
def('mortar', { label: 'Mortar', cat: 'explosive', price: 170, emoji: '🪖', style: 'strike', aoe: 4, desc: 'Three shells lob high and whistle down on the target',
  mesh: () => grp(cyl(.16, .16, .6, stdMat(0x4e5a3a)), at((() => { const c = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 12), stdMat(0x4e5a3a)); c.rotation.x = Math.PI; return c; })(), 0, -.45, 0)),
  fire({ target }) {
    snd.bang(); toast('🪖 Shells away…');
    for (let i = 0; i < 3; i++) later(1.1 + i * .35, () => { const p = V(target.x + rand(-1.5, 1.5), target.y + 26, target.z + rand(-1.5, 1.5));
      hiddenBomb('mortar', p, V(0, -30, 0), ARSENAL.mortar.mesh(), 1.4, { trail: [.8, .8, .8] }); noise(.6, 'bandpass', 1800, .15, 6); });
  } });
def('mirv', { label: 'MIRV', cat: 'explosive', price: 420, emoji: '🌠', style: 'strike', aoe: 7, desc: 'One warhead falls, splits into eight, and blankets the area',
  mesh: () => grp(cyl(.3, .3, 1.4, stdMat(0xe8e8e8)), at(new THREE.Mesh(new THREE.ConeGeometry(.3, .6, 12), stdMat(0xd03030)), 0, -1, 0)),
  fire({ target }) {
    const o = spawnBody('mirv', { kind: 'ball', r: .3 }, 20, V(target.x, target.y + 40, target.z), V(0, -22, 0), ARSENAL.mirv.mesh(), { trail: [1, .7, .3], expire: simTime + 6 }, { gs: .4 });
    AFX.push({ upd() { if (o.gone) return false; const p = o.body.position; if (p.y > target.y + 12) return;
      const c = bpos(o); removeObj(o); ringFX(c, .6, 0xffd090); snd.pop();
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + rand(-.3, .3), s = i ? rand(2.5, 4.5) : 0; hiddenBomb('bomblet', c, V(Math.cos(a) * s, -14, Math.sin(a) * s), sphereMesh(.2, stdMat(0x333333)), 1, { trail: [1, .6, .2] }); }
      return false; } });
    snd.wind(); toast('🌠 Warhead inbound');
  } });
def('mines', { label: 'Landmines', cat: 'explosive', price: 190, emoji: '⚠️', style: 'strike', aoe: 5, desc: 'Scatters 10 mines — anything that moves near one sets it off',
  fire({ target }) {
    const mt = shared('mineM', () => stdMat(0x3a3f32, { metalness: .4 })), lt = shared('mineL', () => glowMat(0xff2020));
    for (let i = 0; i < 10; i++) { const a = rand(0, 6.28), r = rand(1.5, 5.5), p = V(target.x + Math.cos(a) * r, .1, target.z + Math.sin(a) * r);
      const m = grp(cyl(.32, .36, .14, mt, 16), at(sphereMesh(.06, lt), 0, .1, 0)); m.position.copy(p); m.scale.setScalar(.01); scene.add(m);
      const life = rand(9, 12); let armed = false, gone = false;
      const blow = () => { if (gone) return; gone = true; scene.remove(m); explodeAt(V(p.x, .35, p.z), 1.15); };
      timed(life, k => { m.scale.setScalar(Math.min(1, k * 3)); m.children[1].visible = Math.sin(simTime * 10 + i) > .3; if (gone) return false; },
        { every: .1, tick(k) { if (k > 1) armed = true; if (!armed) return; for (const o of nearObjs(V(p.x, .6, p.z), 1.5)) { const v = o.body.velocity; if (Math.hypot(v.x, v.y, v.z) > 1.2) { blow(); break; } } },
          end: blow, kill() { scene.remove(m); } }); }
    snd.tink(.5); toast('⚠️ Minefield laid — knock something into it');
  } });
def('airstrike', { label: 'Airstrike', cat: 'explosive', price: 360, emoji: '🛩️', style: 'strike', aoe: 6, desc: 'Six guided missiles streak in from the sky',
  mesh: () => grp(cyl(.12, .12, 1.1, stdMat(0xcfd4da)), at(new THREE.Mesh(new THREE.ConeGeometry(.12, .3, 10), stdMat(0x444444)), 0, .7, 0)),
  fire({ target }) {
    const side = sideDir();
    for (let i = 0; i < 6; i++) later(.3 + i * .22, () => { const from = V(target.x - side.x * 30 + rand(-4, 4), 32, target.z - side.z * 30 + rand(-4, 4)), to = V(target.x + rand(-3, 3), target.y + rand(-.5, 2), target.z + rand(-3, 3));
      const d = to.clone().sub(from).normalize(), m = ARSENAL.airstrike.mesh(); m.quaternion.setFromUnitVectors(UPY, d);
      spawnBody('missile', { kind: 'ball', r: .2 }, 10, from, d.multiplyScalar(48), m, { bomb: true, rocket: true, power: 1.15, trail: [1, .7, .3] }, { gs: 0, lockRot: true }); snd.rocket(); });
    toast('🛩️ Airstrike called in');
  } });
def('thermo', { label: 'Thermobaric', cat: 'explosive', price: 480, emoji: '🌡️', desc: 'Sprays a fuel cloud, then ignites it in one enormous fireball', r: .35, mass: 6,
  mesh: () => grp(cyl(.3, .3, .9, stdMat(0xd8c040)), at(cyl(.32, .32, .1, stdMat(0x222222)), 0, .2, 0)),
  fire(ctx) { lob('thermo', ctx, { bomb: true, power: 1, onBoom(o) {
    const c = bpos(o); removeObj(o); snd.splash();
    for (let i = 0; i < 70; i++) { const a = rand(0, 6.28), s = rand(2, 7); spawnSmoke(c.x, c.y + .3, c.z, Math.cos(a) * s, rand(0, 1.5), Math.sin(a) * s, 1.1, rand(1.2, 2.2), [.85, .82, .7], .35); }
    later(.9, () => { explodeAt(c, 2.6); igniteNear(c, 9, .9); radialPush(c, 14, 6, .4); whiteFlash(.6, .9); });
  } }); snd.whoosh(); } });
def('crackers', { label: 'Firecrackers', cat: 'explosive', price: 60, emoji: '🧧', desc: 'A long string of crackers that pops 24 times in a row', r: .25, mass: 1,
  mesh: () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(at(cyl(.05, .05, .25, stdMat(0xd81e1e), 8), (i - 2.5) * .1, 0, 0)); return g; },
  fire(ctx) { lob('crackers', ctx, { bomb: true, power: .3, onBoom(o) {
    const c = bpos(o); removeObj(o);
    for (let i = 0; i < 24; i++) later(i * .07, () => { const p = V(c.x + rand(-2, 2), c.y + rand(0, .6), c.z + rand(-2, 2)); explodeAt(p, .28, 'spark'); burst(p, 8, [[1, .2, .2], [1, .9, .3]], 5, .2); snd.bang(); });
  } }); snd.whoosh(); } });
def('bouncer', { label: 'Bouncing Bomb', cat: 'explosive', price: 150, emoji: '🎱', desc: 'Skips and bounces into the build, then detonates', r: .4, mass: 12, rest: .9,
  mesh: () => grp(sphereMesh(.4, stdMat(0x1c1c1c, { roughness: .2 })), at(sphereMesh(.16, stdMat(0xf0f0f0)), 0, 0, .3)),
  fire(ctx) { lob('bouncer', ctx, { bomb: true, timer: true, life: 3, power: 1.4, fuseFx: true }, { gs: .7, rest: .9 }); snd.whoosh(); } });
def('megabomb', { label: 'Countdown Megabomb', cat: 'explosive', price: 650, emoji: '⏲️', desc: 'Five… four… three… — the biggest non-nuclear blast there is', r: .6, mass: 40, rest: .05,
  mesh: () => grp(sphereMesh(.6, stdMat(0x2a2a30, { metalness: .5, roughness: .3 })), at(box(.5, .25, .08, glowMat(0xff3030)), 0, .2, .58)),
  fire(ctx) { const o = lob('megabomb', ctx, { bomb: true, timer: true, life: 5, power: 3.3, fuseFx: true });
    for (let s = 5; s >= 1; s--) later(5 - s, () => { if (!o.gone) { toast(`⏲️ ${s}…`); snd.ding(); } });
    snd.whoosh(); } });
def('chainbomb', { label: 'Chain Bomb', cat: 'explosive', price: 220, emoji: '🔗', desc: 'Each blast sets off the next — a walking line of seven explosions', r: .3, mass: 4,
  mesh: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) g.add(at(sphereMesh(.18, stdMat(0x5a3a2a)), (i - 1) * .3, 0, 0)); return g; },
  fire(ctx) { const d = flatDir(ctx.dir); lob('chainbomb', ctx, { bomb: true, power: 1, onBoom(o) {
    const c = bpos(o); removeObj(o);
    for (let i = 0; i < 7; i++) later(i * .16, () => explodeAt(V(c.x + d.x * i * 1.8, Math.max(.4, c.y), c.z + d.z * i * 1.8), 1));
  } }); snd.whoosh(); } });
def('barrels', { label: 'Barrel Drop', cat: 'explosive', price: 230, emoji: '🪣', style: 'strike', aoe: 4, desc: 'Six red fuel barrels tumble down and go off on impact',
  mesh: () => grp(cyl(.4, .4, 1.1, stdMat(0xc8241c, { metalness: .3 })), at(cyl(.41, .41, .06, stdMat(0x333333)), 0, .3, 0), at(cyl(.41, .41, .06, stdMat(0x333333)), 0, -.3, 0)),
  fire({ target }) {
    for (let i = 0; i < 6; i++) later(i * .15, () => { const o = spawnBody('barrel', { kind: 'cyl', r: .4, hh: .55 }, 50, V(target.x + rand(-2.5, 2.5), target.y + rand(16, 22), target.z + rand(-2.5, 2.5)), V(0, -6, 0), ARSENAL.barrels.mesh(), { bomb: true, fire: true, power: 1.15 });
      o.body.setAngularVelocity(rand(-3, 3), rand(-3, 3), rand(-3, 3)); });
    snd.whoosh();
  } });
def('sonic', { label: 'Sonic Boom', cat: 'explosive', price: 260, emoji: '🔊', style: 'beam', desc: 'A cone of pure pressure — flattens everything in front of you',
  fire({ o0, dir }) {
    let n = 0;
    for (const o of nearObjs(o0.clone().addScaledVector(dir, 14), 16)) { const rel = bpos(o).sub(o0), L = rel.length() || .1, cos = rel.dot(dir) / L; if (cos < .8 || L > 28) continue;
      const f = 26 * (1 - L / 30) * (cos - .7) * 3.3; push(o, dir.x * f, dir.y * f + f * .25, dir.z * f); if (L < 12 && Math.random() < .4) { if (canFracture(o)) pendingFracture.add(o); } n++; }
    for (let s = 2; s < 26; s += 2) later(s * .012, () => { const p = o0.clone().addScaledVector(dir, s); for (let i = 0; i < 10; i++) { const a = rand(0, 6.28), r = s * .45; spawnP(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .6, p.z + Math.sin(a) * r, dir.x * 10, dir.y * 10, dir.z * 10, .35, [.85, .9, 1], .5, 0, 3, .35); } });
    whiteFlash(.25, .4); snd.boom(); snd.rumble(); shake = .9; if (n) toast(`🔊 Blasted ${n}`);
  } });
def('barrage', { label: 'Rocket Barrage', cat: 'explosive', price: 380, emoji: '🎇', style: 'strike', aoe: 6, desc: 'Sixteen rockets launch from behind you and saturate the target',
  fire({ target, o0 }) {
    for (let i = 0; i < 16; i++) later(i * .09, () => { const from = V(o0.x + rand(-2, 2), Math.max(1.5, o0.y), o0.z + rand(-2, 2)), to = V(target.x + rand(-4, 4), target.y + rand(-.5, 3), target.z + rand(-4, 4));
      const d = to.clone().sub(from).normalize(); d.y += .25; d.normalize();
      spawnProj('rocket', from, d.multiplyScalar(30), { bomb: true, rocket: true, power: .75, noCap: true, trail: [1, .75, .3] }); snd.rocket(); });
  } });

// ===== ELEMENTAL =====
def('blizzard', { label: 'Blizzard', cat: 'elemental', price: 260, emoji: '🌨️', style: 'strike', aoe: 6, desc: 'A howling snowstorm freezes the build solid, block by block',
  fire({ target }) {
    const c = V(target.x, target.y, target.z), wind = sideDir(); let n = 0;
    timed(4.5, () => { for (let i = 0; i < 14; i++) spawnP(c.x + rand(-8, 8) - wind.x * 4, rand(4, 14), c.z + rand(-8, 8) - wind.z * 4, wind.x * 7 + rand(-1, 1), -4, wind.z * 7 + rand(-1, 1), 1.6, [.95, .97, 1], rand(.08, .18), 0, 0, .9); },
      { every: .12, tick() { const list = nearObjs(V(c.x, 5, c.z), 12, o => isBlock(o) && hdist(o, c) < 6 && o.mat !== 'ice');
          for (const o of list.slice(0, 10)) if (Math.random() < .5 && toIce(o)) n++;
          for (const o of nearObjs(V(c.x, 5, c.z), 10)) if (o.mat === 'ice') push(o, wind.x * .25, 0, wind.z * .25); },
        end() { if (n) toast(`🌨️ Froze ${n}`); dirty = true; } });
    noise(4.5, 'bandpass', 900, .35, .6); snd.wind();
  } });
def('inferno', { label: 'Inferno', cat: 'elemental', price: 280, emoji: '🔆', style: 'strike', aoe: 6, desc: 'A ring of fire closes in and sets the whole build ablaze',
  fire({ target }) {
    const c = V(target.x, 0, target.z);
    timed(3.5, k => { const R = Math.max(.5, 7 - k * 1.8); for (let i = 0; i < 16; i++) { const a = rand(0, 6.28); spawnP(c.x + Math.cos(a) * R, .2, c.z + Math.sin(a) * R, 0, rand(3, 7), 0, rand(.5, .9), [1, rand(.3, .65), .05], rand(.4, .8), 1, 1.8, .9); }
      flash.color.setHex(0xff7020); flash.position.set(c.x, 2, c.z); flash.intensity = 30; },
      { every: .2, tick(k) { const R = Math.max(.5, 7 - k * 1.8); for (const o of nearObjs(V(c.x, 4, c.z), 12, isBlock)) if (hdist(o, c) > R - 1.2) ignite(o, .45); } });
    noise(3.5, 'lowpass', 600, .4); snd.crackle(1);
  } });
def('hurricane', { label: 'Hurricane', cat: 'elemental', price: 400, emoji: '🌀', style: 'strike', aoe: 8, desc: 'A spinning vortex sucks the tower up and flings it around',
  fire({ target }) {
    const c = V(target.x, 0, target.z), funnel = new THREE.Mesh(new THREE.ConeGeometry(6, 18, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xa8b0b8, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }));
    funnel.rotation.x = Math.PI; funnel.position.set(c.x, 9, c.z); scene.add(funnel);
    timed(4.5, (k, dt) => { funnel.rotation.y += dt * 6; funnel.material.opacity = .18 * Math.min(1, k * 2, (4.5 - k) * 2);
      for (let i = 0; i < 8; i++) { const a = rand(0, 6.28), r = rand(1, 7), h = rand(0, 16); spawnP(c.x + Math.cos(a) * r, h, c.z + Math.sin(a) * r, -Math.sin(a) * 12, 4, Math.cos(a) * 12, .6, [.7, .72, .7], .3, 0, 1, .5); } },
      { every: .08, tick() { for (const o of nearObjs(V(c.x, 6, c.z), 14)) { const p = o.body.position, dx = p.x - c.x, dz = p.z - c.z, r = Math.hypot(dx, dz) || .1; if (r > 9) continue;
          const f = 1 - r / 9; push(o, (-dz / r * 3.2 - dx / r * 1.1) * f, (p.y < 14 ? 2.6 : -.5) * f, (dx / r * 3.2 - dz / r * 1.1) * f); } },
        end() { scene.remove(funnel); }, kill() { scene.remove(funnel); } });
    snd.wind(); noise(4.5, 'bandpass', 300, .5, .4); toast('🌀 Hurricane!');
  } });
def('quakeshell', { label: 'Quake Shell', cat: 'elemental', price: 300, emoji: '📳', desc: 'Buries itself and shakes the ground apart for three seconds', r: .3, mass: 8,
  mesh: () => grp(cyl(.25, .25, .8, stdMat(0x6a5a40)), at(new THREE.Mesh(new THREE.ConeGeometry(.25, .4, 10), stdMat(0x333333)), 0, -.6, 0)),
  fire(ctx) { lob('quakeshell', ctx, { onHit(o) {
    const c = bpos(o); removeObj(o); scorch(c, .6); snd.quake();
    timed(3, () => { shake = Math.max(shake, .45); if (Math.random() < .5) spawnSmoke(c.x + rand(-5, 5), .2, c.z + rand(-5, 5), 0, rand(.3, 1), 0, 1.4, rand(.8, 1.4), [.65, .58, .5], .45); },
      { every: .09, tick() { for (const o of nearObjs(V(c.x, 2, c.z), 11)) { if (hdist(o, c) > 9) continue; push(o, rand(-1.8, 1.8), rand(.4, 2.4), rand(-1.8, 1.8)); } } });
  } }); snd.whoosh(); } });
def('geyser', { label: 'Geyser', cat: 'elemental', price: 210, emoji: '♨️', style: 'strike', aoe: 2.5, desc: 'Boiling water blasts up from below — three times',
  fire({ target }) {
    const c = V(target.x, 0, target.z);
    for (let b = 0; b < 3; b++) later(b * .9, () => {
      for (const o of nearObjs(V(c.x, 4, c.z), 12)) { const r = hdist(o, c); if (r > 2.6) continue; push(o, (o.body.position.x - c.x) * .8, 16 * (1 - r / 3.2), (o.body.position.z - c.z) * .8); }
      timed(.7, () => { for (let i = 0; i < 18; i++) spawnP(c.x + rand(-1.2, 1.2), .2, c.z + rand(-1.2, 1.2), rand(-1.5, 1.5), rand(14, 22), rand(-1.5, 1.5), rand(.6, 1.1), [.8, .92, 1], rand(.25, .5), -12, 1, .8);
        spawnSmoke(c.x + rand(-1, 1), rand(1, 6), c.z + rand(-1, 1), 0, rand(2, 4), 0, 2, rand(1.2, 2), [.95, .95, .95], .4); });
      snd.splash(); shake = .3; });
  } });
def('sandstorm', { label: 'Sandstorm', cat: 'elemental', price: 230, emoji: '🏜️', style: 'strike', aoe: 10, desc: 'Scouring wind blasts the build and sands away loose blocks',
  fire({ target }) {
    const c = V(target.x, 0, target.z), wind = sideDir(); let ate = 0;
    timed(5, () => { for (let i = 0; i < 14; i++) { const l = rand(-12, 12); spawnSmoke(c.x - wind.x * 16 + wind.z * l, rand(.3, 8), c.z - wind.z * 16 - wind.x * l, wind.x * rand(12, 18), rand(-.5, .5), wind.z * rand(12, 18), 1.8, rand(1, 2), [.82, .68, .45], .35); } },
      { every: .1, tick() { for (const o of nearObjs(V(c.x, 5, c.z), 14)) { const y = o.body.position.y; push(o, wind.x * (.6 + y * .08), .05, wind.z * (.6 + y * .08));
          if (isBlock(o) && Math.random() < .004 * (1 + y * .2)) { vaporize(o, [.85, .7, .45], 5); ate++; } } },
        end() { if (ate) toast(`🏜️ Eroded ${ate}`); } });
    snd.wind(); noise(5, 'bandpass', 700, .4, .3);
  } });
def('thermite', { label: 'Thermite', cat: 'elemental', price: 240, emoji: '🟧', desc: 'Burns white-hot straight down through everything beneath it', r: .22, mass: 2,
  mesh: () => cyl(.18, .18, .4, stdMat(0x9a4a20, { emissive: 0x401000 })),
  fire(ctx) { lob('thermite', ctx, { onHit(o) {
    const c = bpos(o); removeObj(o); let ate = 0, y = c.y + .3;
    timed(4, (k, dt) => { y = Math.max(-.2, y - dt * 2.2);
      for (let i = 0; i < 6; i++) spawnP(c.x + rand(-.3, .3), y + .3, c.z + rand(-.3, .3), rand(-4, 4), rand(1, 5), rand(-4, 4), rand(.3, .6), [1, 1, rand(.6, .9)], rand(.1, .2), -10, 0);
      flash.color.setHex(0xfff0d0); flash.position.set(c.x, y + .5, c.z); flash.intensity = 25; },
      { every: .08, tick() { for (const o of nearObjs(V(c.x, y, c.z), 1.6, isBlock)) if (hdist(o, c) < 1 && o.body.position.y > y - .8) { vaporize(o, [1, .9, .6], 5); ate++; } },
        end() { if (ate) toast(`🟧 Melted ${ate}`); } });
    snd.crackle(1); noise(4, 'highpass', 3000, .2);
  } }); snd.whoosh(); } });
def('thunder', { label: 'Thunderstorm', cat: 'elemental', price: 360, emoji: '⛈️', style: 'strike', aoe: 7, desc: 'A storm cloud rolls in and fires a dozen lightning strikes',
  fire({ target }) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(8, 18, 10), new THREE.MeshBasicMaterial({ color: 0x3a3f48, transparent: true, opacity: 0, depthWrite: false })); cloud.scale.y = .25; cloud.position.set(target.x, 26, target.z); scene.add(cloud);
    timed(5.5, k => { cloud.material.opacity = .6 * Math.min(1, k * 2, (5.5 - k) * 2); }, { end() { scene.remove(cloud); }, kill() { scene.remove(cloud); } });
    for (let i = 0; i < 12; i++) later(.6 + i * .38 + rand(0, .15), () => { const p = V(target.x + rand(-6, 6), 0, target.z + rand(-6, 6));
      const top = nearObjs(V(p.x, 8, p.z), 16, o => isBlock(o) && hdist(o, p) < 1.5).reduce((a, o) => Math.max(a, o.body.position.y + .5), .2); p.y = top;
      boltFX(V(p.x + rand(-3, 3), 25, p.z + rand(-3, 3)), p); flash.color.setHex(0xa8d8ff); flash.position.copy(p); flash.intensity = 110;
      explodeAt(p, .6, 'plasma'); igniteNear(p, 2.5, .7); whiteFlash(.25, .35); snd.zap(); });
    snd.rumble();
  } });
def('icelance', { label: 'Ice Lance', cat: 'elemental', price: 190, emoji: '🧊', style: 'beam', desc: 'A spear of ice freezes a line straight through the build',
  fire({ o0, dir }) {
    const list = rayBlocks(o0, dir, 45, 1.1); let n = 0;
    for (const o of list.slice(0, 60)) { const p = bpos(o), ice = toIce(o); if (ice) { n++; push(ice, dir.x * 4, .5, dir.z * 4); } spawnP(p.x, p.y, p.z, rand(-1, 1), rand(0, 2), rand(-1, 1), 1, [.85, .95, 1], .3, -2, .5); }
    beamFX(o0, o0.clone().addScaledVector(dir, 45), 0xbff0ff, .2, .8); snd.glass(.5); snd.tink(1); if (n) toast(`🧊 Froze ${n}`); dirty = true;
  } });
def('magma', { label: 'Magma Flood', cat: 'elemental', price: 330, emoji: '🫗', style: 'strike', aoe: 7, desc: 'Molten rock wells up and floods outward, eating the foundations',
  fire({ target }) {
    const c = V(target.x, 0, target.z), pool = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xff5010, transparent: true, opacity: .95 })); pool.rotation.x = -Math.PI / 2; pool.position.set(c.x, .03, c.z); scene.add(pool);
    let R = .5;
    timed(6, k => { R = Math.min(7.5, .5 + k * 2.2); pool.scale.setScalar(R); pool.material.color.setHSL(.03 + .02 * Math.sin(k * 5), 1, .5); pool.material.opacity = .95 * Math.min(1, (6 - k) / 1.2);
      for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), r = rand(0, R); spawnP(c.x + Math.cos(a) * r, .15, c.z + Math.sin(a) * r, 0, rand(1, 3), 0, .7, [1, .45, .1], .3, -2, 1, .9); }
      flash.color.setHex(0xff5010); flash.position.set(c.x, 1, c.z); flash.intensity = 20; },
      { every: .15, tick() { for (const o of nearObjs(V(c.x, 1, c.z), R + 1.5, o => isBlock(o) && hdist(o, c) < R && o.body.getAABB().lowerBound.y < .6)) {
          ignite(o, .5); push(o, 0, .8, 0); if (o.mat === 'ice' || Math.random() < .08) vaporize(o, [1, .45, .1], 5); } },
        end() { scene.remove(pool); }, kill() { scene.remove(pool); } });
    snd.quake(); toast('🫗 Magma rising');
  } });

// ===== EXOTIC =====
def('whitehole', { label: 'White Hole', cat: 'exotic', price: 420, emoji: '🤍', style: 'strike', aoe: 7, desc: 'The opposite of a black hole — pushes everything out of existence around it',
  fire({ target }) {
    const c = V(target.x, Math.max(1, target.y), target.z), orb = grp(sphereMesh(.6, glowMat(0xffffff, 1)), sphereMesh(1.2, glowMat(0xd8e8ff, .35))); orb.position.copy(c); scene.add(orb);
    timed(3, (k, dt) => { const s = 1 + .2 * Math.sin(k * 20); orb.scale.setScalar(s * Math.min(1, k * 4, (3 - k) * 4)); flash.color.setHex(0xe8f0ff); flash.position.copy(c); flash.intensity = 50;
      for (let i = 0; i < 6; i++) { const v = V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); spawnP(c.x, c.y, c.z, v.x * 14, v.y * 14, v.z * 14, .5, [.9, .95, 1], .2, 0, 0); } },
      { every: .08, tick() { radialPush(c, 11, 3.2, .15); }, end() { scene.remove(orb); ringFX(c, 2, 0xe8f0ff); }, kill() { scene.remove(orb); } });
    snd.hole(); whiteFlash(.3, .6);
  } });
def('timebubble', { label: 'Time Bubble', cat: 'exotic', price: 300, emoji: '⏳', style: 'strike', aoe: 5, desc: 'Freezes time inside a bubble — smash it, then watch it all fall at once',
  fire({ target }) {
    const c = V(target.x, Math.max(2.5, target.y), target.z), R = 5.5, bub = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 18), new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: .12, depthWrite: false }));
    bub.position.copy(c); scene.add(bub);
    timed(5, k => { bub.material.opacity = .12 * Math.min(1, k * 4, (5 - k) * 3); },
      { every: .016, tick() { for (const o of nearObjs(c, R)) { const v = o.body.velocity, w = o.body.angularVelocity; if (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) < .02) continue;
          o.body.setVelocity(v.x * .1, v.y * .1 + .33, v.z * .1); o.body.setAngularVelocity(w.x * .1, w.y * .1, w.z * .1); } },
        end() { scene.remove(bub); snd.whoosh(); }, kill() { scene.remove(bub); } });
    snd.ding(); toast('⏳ Time stopped — keep smashing');
  } });
def('teleport', { label: 'Teleporter', cat: 'exotic', price: 280, emoji: '🚪', style: 'beam', desc: 'Beams a chunk of the tower 15 m up — then gravity takes over',
  fire({ o0, target }) {
    beamFX(o0, target, 0xb070ff, .1, .5); let n = 0;
    for (const o of nearObjs(target, 2.8, isBlock)) { if (n >= 80) break; const p = bpos(o); for (let i = 0; i < 3; i++) spawnP(p.x, p.y, p.z, 0, rand(2, 5), 0, .6, [.75, .5, 1], .3, 0, -.6);
      const n2 = moveBlock(o, V(p.x, p.y + 15, p.z)); push(n2, rand(-.5, .5), 0, rand(-.5, .5)); n++; }
    for (let i = 0; i < 60; i++) spawnP(target.x + rand(-3, 3), target.y + 15 + rand(-3, 3), target.z + rand(-3, 3), 0, 0, 0, .8, [.8, .6, 1], .3, 0, -.5);
    snd.laser(); if (n) toast(`🚪 Teleported ${n}`); dirty = true;
  } });
def('disint', { label: 'Disintegrator', cat: 'exotic', price: 380, emoji: '🫥', style: 'beam', desc: 'A green beam that erases a clean tunnel — no push, no mess',
  fire({ o0, dir }) {
    const list = rayBlocks(o0, dir, 50, 1.2).slice(0, 140);
    list.forEach((o, i) => later(i * .006, () => vaporize(o, [.4, 1, .5], 4)));
    beamFX(o0, o0.clone().addScaledVector(dir, 50), 0x50ff80, .3, .9); snd.laser(); noise(.8, 'bandpass', 2600, .3, 2); if (list.length) toast(`🫥 Erased ${list.length}`);
  } });
def('gwell', { label: 'Gravity Well', cat: 'exotic', price: 360, emoji: '🪐', desc: 'Lands, crushes everything into a ball — then lets go with a bang', r: .35, mass: 4,
  mesh: () => grp(sphereMesh(.3, stdMat(0x101018, { emissive: 0x3020a0 })), (() => { const r = new THREE.Mesh(new THREE.TorusGeometry(.55, .04, 6, 32), glowMat(0x8a70ff)); r.rotation.x = 1.3; return r; })()),
  fire(ctx) { lob('gwell', ctx, { onHit(o) {
    const c = bpos(o).add(V(0, 2.5, 0)); removeObj(o);
    const core = sphereMesh(.4, glowMat(0x8a70ff, .9)); core.position.copy(c); scene.add(core);
    timed(3, k => { core.scale.setScalar(1 + k * .6); const a = rand(0, 6.28), r = rand(3, 7); spawnP(c.x + Math.cos(a) * r, c.y + rand(-2, 2), c.z + Math.sin(a) * r, -Math.cos(a) * 8, 0, -Math.sin(a) * 8, .7, [.7, .55, 1], .2, 0, -.5); },
      { every: .06, tick() { for (const o of nearObjs(c, 9)) { const p = o.body.position, d = V(c.x - p.x, c.y - p.y, c.z - p.z), L = d.length() || .1;
          const v = o.body.velocity, f = Math.min(6, 30 / (1 + L)); o.body.setVelocity(v.x * .85 + d.x / L * f, v.y * .85 + d.y / L * f + .2, v.z * .85 + d.z / L * f); } },
        end() { scene.remove(core); explodeAt(c, 1.7, 'plasma'); }, kill() { scene.remove(core); } });
    snd.hole();
  } }); snd.whoosh(); } });
def('rod', { label: 'Rod from God', cat: 'exotic', price: 620, emoji: '🥢', style: 'strike', aoe: 3, desc: 'A tungsten rod dropped from orbit. No explosive needed.',
  fire({ target }) {
    const c = V(target.x, 0, target.z), rod = cyl(.18, .18, 6, glowMat(0xfff0c0, 1), 10); rod.position.set(c.x, 90, c.z); scene.add(rod);
    snd.wind(); toast('🥢 Incoming from orbit…');
    timed(1.2, (k, dt) => { rod.position.y = Math.max(0, 90 - k * k * 62); for (let i = 0; i < 4; i++) spawnP(c.x + rand(-.2, .2), rod.position.y + 3 + rand(0, 6), c.z + rand(-.2, .2), 0, 6, 0, .5, [1, .8, .5], .3, 0, 1, .8); },
      { end() { scene.remove(rod); let n = 0;
          for (const o of nearObjs(V(c.x, 10, c.z), 40, o => isBlock(o) && hdist(o, c) < 1.4)) { vaporize(o, [1, .8, .5], 3); n++; }
          explodeAt(V(c.x, .5, c.z), 2.4); crackNear(V(c.x, 2, c.z), 4.5, .8); whiteFlash(.8, 1.2); bulletUntil = simTime + .6; snd.nuke(); if (n) toast(`🥢 Punched through ${n}`); },
        kill() { scene.remove(rod); } });
  } });
def('plasma', { label: 'Plasma Cannon', cat: 'exotic', price: 340, emoji: '🔵', style: 'beam', desc: 'A slow ball of plasma that burns through everything, then bursts',
  fire({ o0, dir }) {
    const orb = grp(sphereMesh(.45, glowMat(0xffffff, 1)), sphereMesh(.9, glowMat(0x3a8aff, .55))), p = o0.clone(); orb.position.copy(p); scene.add(orb); let ate = 0;
    timed(2.6, (k, dt) => { p.addScaledVector(dir, 17 * dt); orb.position.copy(p); orb.rotation.y += dt * 8; flash.color.setHex(0x4a9aff); flash.position.copy(p); flash.intensity = 35;
      spawnP(p.x, p.y, p.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), .4, [.4, .7, 1], .5, 0, -1, .8); if (p.y < .3) return false; },
      { every: .05, tick() { for (const o of nearObjs(p, 1.4, isBlock)) { vaporize(o, [.5, .8, 1], 4); ate++; } },
        end() { scene.remove(orb); explodeAt(p.clone(), 1.6, 'plasma'); if (ate) toast(`🔵 Burned ${ate}`); }, kill() { scene.remove(orb); } });
    snd.laser();
  } });
def('repulsor', { label: 'Repulsor Beam', cat: 'exotic', price: 240, emoji: '🖐️', style: 'beam', desc: 'A steady push beam — shoves whatever you aim at for two seconds',
  fire({ o0, target }) {
    const dir = V(target.x - o0.x, target.y - o0.y, target.z - o0.z).normalize(); let beam = null;
    timed(2, () => { if (beam) scene.remove(beam); beam = beamFX(o0, target, 0xffe070, .18, .05); },
      { every: .05, tick() { for (const o of rayBlocks(o0, dir, o0.distanceTo(target) + 6, 2.4, null).slice(0, 80)) push(o, dir.x * .9, dir.y * .9 + .15, dir.z * .9); } });
    noise(2, 'bandpass', 900, .25, 4); snd.zap();
  } });
def('levitate', { label: 'Levitation Field', cat: 'exotic', price: 260, emoji: '🫧', style: 'strike', aoe: 6, desc: 'Everything gently floats up… and then it all comes crashing down',
  fire({ target }) {
    const c = V(target.x, 0, target.z);
    timed(3.2, () => { for (let i = 0; i < 5; i++) spawnP(c.x + rand(-6, 6), rand(0, 1), c.z + rand(-6, 6), 0, rand(2, 4), 0, 1.4, [.7, .9, 1], rand(.15, .3), 0, 0, .7); },
      { every: .05, tick() { for (const o of nearObjs(V(c.x, 5, c.z), 12)) if (hdist(o, c) < 6.5) { const v = o.body.velocity; o.body.setVelocity(v.x * .96 + rand(-.1, .1), Math.min(2.2, v.y + 2.2), v.z * .96 + rand(-.1, .1)); o.body.setAngularVelocity(rand(-.3, .3), rand(-.3, .3), rand(-.3, .3)); } },
        end() { snd.whoosh(); } });
    snd.hole(); toast('🫧 Up, up…');
  } });
def('quantum', { label: 'Quantum Scatter', cat: 'exotic', price: 320, emoji: '🎲', style: 'strike', aoe: 4.5, desc: 'Every block in range swaps places with another. Pure chaos.',
  fire({ target }) {
    const list = nearObjs(target, 4.5, isBlock).slice(0, 160); if (list.length < 2) { toast('🎲 Nothing to scramble'); return; }
    const spots = list.map(bpos); for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    list.forEach((o, i) => { const p = spots[i].add(V(0, .05, 0)); moveBlock(o, p); spawnP(p.x, p.y, p.z, 0, 0, 0, .5, [rand(.5, 1), rand(.5, 1), 1], .35, 0, -1); });
    ringFX(target, 1, 0xc0a0ff); snd.laser(); whiteFlash(.2, .3); toast(`🎲 Scrambled ${list.length}`); dirty = true;
  } });

// ===== SILLY =====
def('melon', { label: 'Watermelon', cat: 'silly', price: 50, emoji: '🍉', desc: 'Heavy, juicy, and very messy on impact', r: .45, mass: 14, rest: .05,
  mesh: () => { const m = sphereMesh(.45, stdMat(0x2f8f2f, { roughness: .4 })); m.scale.set(1.25, 1, 1); return m; },
  fire(ctx) { lob('melon', ctx, { onHit(o) { const p = bpos(o); removeObj(o);
    for (let i = 0; i < 60; i++) { const a = rand(0, 6.28), s = rand(2, 7); spawnP(p.x, p.y, p.z, Math.cos(a) * s, rand(1, 6), Math.sin(a) * s, rand(.6, 1.2), i % 5 ? [.95, .2, .25] : [.2, .6, .2], rand(.15, .35), -14, 0); }
    radialPush(p, 2.5, 5, .3); snd.squish(); snd.splash(); } }); snd.whoosh(); } });
def('cow', { label: 'Flying Cow', cat: 'silly', price: 120, emoji: '🐄', style: 'strike', aoe: 2, desc: 'A full-grown cow, launched from the side. Moo.',
  mesh: () => { const w = stdMat(0xf4f4f0), b = stdMat(0x1a1a1a), p = stdMat(0xf0a0a8), g = grp(box(1.8, 1, .9, w), at(box(.6, .6, .6, w), 1.1, .3, 0), at(box(.3, .25, .5, p), 1.45, .15, 0), at(box(.6, .5, .92, b), -.3, .2, 0));
    for (const [x, z] of [[-.7, -.3], [-.7, .3], [.6, -.3], [.6, .3]]) g.add(at(box(.18, .6, .18, w), x, -.75, z)); return g; },
  fire({ target }) {
    const side = sideDir(), from = V(target.x - side.x * 22, target.y + 6, target.z - side.z * 22), m = ARSENAL.cow.mesh();
    const o = spawnBody('cow', { kind: 'box', hx: .9, hy: .65, hz: .45 }, 600, from, arcVel(from, V(target.x, target.y + 1, target.z), 30), m, { expire: simTime + 9, onHit() { snd.boing(); shake = .5; } }, { quat: quatTo(V(1, 0, 0), side) });
    o.body.setAngularVelocity(rand(-2, 2), rand(-2, 2), rand(-2, 2)); tone(180, 120, .7, .25); toast('🐄 Moooo!');
  } });
def('jelly', { label: 'Jelly Cube', cat: 'silly', price: 90, emoji: '🟩', style: 'strike', aoe: 3, desc: 'A giant wobbly jelly drops in and bounces all over your build',
  mesh: () => box(2.4, 2.4, 2.4, new THREE.MeshStandardMaterial({ color: 0x40e070, transparent: true, opacity: .7, roughness: .1 })),
  fire({ target }) {
    const o = spawnBody('jelly', { kind: 'box', hx: 1.2, hy: 1.2, hz: 1.2 }, 160, V(target.x, target.y + 20, target.z), V(0, -5, 0), ARSENAL.jelly.mesh(), { expire: simTime + 10 }, { rest: .95, fric: .3 });
    o.body.setAngularVelocity(rand(-2, 2), rand(-1, 1), rand(-2, 2));
    AFX.push({ upd() { if (o.gone) return false; const v = o.body.velocity, s = Math.min(.25, Math.hypot(v.x, v.y, v.z) * .01); o.mesh.scale.set(1 + s * Math.sin(simTime * 25), 1 - s * Math.sin(simTime * 25), 1 + s * Math.sin(simTime * 25)); } });
    snd.boing();
  } });
def('confetti', { label: 'Confetti Cannon', cat: 'silly', price: 80, emoji: '🎉', style: 'beam', desc: 'A blast of party paper — and 30 surprisingly heavy party favours',
  fire({ o0, dir }) {
    const cols = [0xff4a6a, 0xffd23a, 0x4ad0ff, 0x7aff6a, 0xc07aff];
    for (let i = 0; i < 30; i++) { const d = dir.clone().add(V(rand(-.12, .12), rand(-.05, .15), rand(-.12, .12))).normalize();
      const o = spawnBody('favour', { kind: 'box', hx: .18, hy: .18, hz: .18 }, 6, o0, d.multiplyScalar(rand(34, 46)), box(.36, .36, .36, stdMat(cols[i % 5])), { expire: simTime + 6 }); o.body.setAngularVelocity(rand(-9, 9), rand(-9, 9), rand(-9, 9)); }
    for (let i = 0; i < 200; i++) { const d = dir.clone().add(V(rand(-.3, .3), rand(-.1, .4), rand(-.3, .3))), s = rand(8, 22), c = new THREE.Color(cols[i % 5]); spawnP(o0.x, o0.y, o0.z, d.x * s, d.y * s, d.z * s, rand(1.2, 2.4), [c.r, c.g, c.b], rand(.1, .2), -3, 0); }
    snd.pop(); snd.bang();
  } });
def('sink', { label: 'Kitchen Sink', cat: 'silly', price: 140, emoji: '🚰', desc: 'Literally everything but — the sink brings plates, pans and a kettle with it', r: .5, mass: 80, rest: .05,
  mesh: () => grp(box(1.2, .5, .8, stdMat(0xd0d6dc, { metalness: .8, roughness: .2 })), at(cyl(.05, .05, .5, stdMat(0xb0b6bc, { metalness: .8 }), 8), 0, .45, -.3)),
  fire(ctx) {
    lob('sink', ctx); const mats = [stdMat(0xf8f8f0), stdMat(0x2a2a2a, { metalness: .5 }), stdMat(0xd04030)];
    for (let i = 0; i < 12; i++) later(.05 + i * .03, () => { const v = ctx.vel.clone().add(V(rand(-2, 2), rand(-1, 2), rand(-2, 2))), r = rand(.15, .3);
      const o = spawnBody('junk', i % 3 ? { kind: 'cyl', r, hh: .05 } : { kind: 'ball', r }, 6, ctx.o0, v, i % 3 ? cyl(r, r, .1, mats[i % 3], 12) : sphereMesh(r, mats[2]), { expire: simTime + 7, onHit() { if (Math.random() < .3) snd.clang(); } });
      o.body.setAngularVelocity(rand(-8, 8), rand(-8, 8), rand(-8, 8)); });
    snd.whoosh();
  } });
def('snowballs', { label: 'Snowball Volley', cat: 'silly', price: 60, emoji: '⛄', style: 'beam', desc: '20 packed snowballs that burst into powder on impact',
  fire({ o0, dir }) {
    const g = shared('snowG', () => new THREE.IcosahedronGeometry(.25, 1)), m = shared('snowM', () => stdMat(0xf4f8ff, { roughness: .9 }));
    for (let i = 0; i < 20; i++) later(i * .08, () => { const d = dir.clone().add(V(rand(-.05, .05), rand(0, .07), rand(-.05, .05))).normalize(), mesh = new THREE.Mesh(g, m); mesh.castShadow = true;
      spawnBody('snowball', { kind: 'ball', r: .25 }, 8, o0, d.multiplyScalar(40), mesh, { expire: simTime + 5, onHit(o) { const p = bpos(o); removeObj(o); for (let j = 0; j < 14; j++) spawnP(p.x, p.y, p.z, rand(-3, 3), rand(0, 3), rand(-3, 3), rand(.5, 1), [.95, .97, 1], rand(.1, .25), -6, .5, .9); snd.squish(); } }, { gs: .6 }); });
  } });
def('beachball', { label: 'Beach Ball', cat: 'silly', price: 70, emoji: '🏖️', desc: 'A huge, floaty, bouncy beach ball. Weirdly effective.', r: 1.5, mass: 40, rest: .85,
  mesh: () => { const g = new THREE.Group(), cols = [0xff3a3a, 0xffffff, 0x3a7aff, 0xffd23a, 0xffffff, 0x3ac06a];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 14, i / 6 * 6.28, 6.28 / 6), stdMat(cols[i], { roughness: .3 })); m.castShadow = true; g.add(m); } return g; },
  fire(ctx) { lob('beachball', ctx, {}, { gs: .45, rest: .85, ld: .3 }); snd.boing(); } });
def('tire', { label: 'Monster Tire', cat: 'silly', price: 210, emoji: '🛞', style: 'beam', desc: 'A 3 m monster-truck tyre comes rolling at your build',
  mesh: () => { const t = new THREE.Mesh(new THREE.TorusGeometry(1.05, .5, 12, 28), stdMat(0x1c1c1c, { roughness: .9 })), hub = cyl(.6, .6, .7, stdMat(0xb8bec6, { metalness: .7 }), 16); hub.rotation.x = Math.PI / 2; t.castShadow = true; return grp(t, hub); },
  fire({ o0, target }) {
    const dir = flatDir(V(target.x - o0.x, 0, target.z - o0.z)), side = V(-dir.z, 0, dir.x), m = ARSENAL.tire.mesh();
    const o = spawnBody('tire', { kind: 'cyl', r: 1.5, hh: .5 }, 350, V(o0.x, 1.6, o0.z), dir.clone().multiplyScalar(22), m, { expire: simTime + 9 }, { quat: quatTo(UPY, side), rest: .3 });
    m.children[0].rotation.set(Math.PI / 2, 0, 0); m.children[1].rotation.set(0, 0, 0);   // torus axis → the cylinder's local Y
    o.body.setAngularVelocity(side.x * -14, 0, side.z * -14); snd.rumble();
  } });
