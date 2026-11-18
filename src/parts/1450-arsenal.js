// ================= ARSENAL: 30 data-driven weapons + effects =================
// Each weapon: { label, cat, price, emoji, desc, style:'throw'|'beam'|'strike', fire(ctx) }.
// ctx = { vel, target, pw, o0, dir } — launch velocity, aimed point, charge 0..1, launch point, unit aim direction.
const WCATS = [['all', 'All'], ['classic', 'Classic'], ['power', 'Power'], ['kinetic', 'Kinetic'], ['explosive', 'Explosive'], ['elemental', 'Elemental'], ['exotic', 'Exotic'], ['silly', 'Silly']];
let wcat = 'all';
const ARSENAL = {};
let AFX = [], LATER = [];
const later = (dt, fn) => LATER.push({ t: simTime + dt, fn });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const toV3 = v => new V3(v.x, v.y, v.z);

// ---- shared helpers ----
function nearObjs(c, R, filter) {
  if (dormant.size) activateNear({ lowerBound: { x: c.x - R, y: c.y - R, z: c.z - R }, upperBound: { x: c.x + R, y: c.y + R, z: c.z + R } }, 0);
  const out = [];
  for (const pb of P.bodies()) { const o = pb.userData; if (!o || o.gone) continue; if (pb.position.distanceTo(c) <= R && (!filter || filter(o))) out.push(o); }
  return out;
}
const isBlock = o => o.type === 'block';
function vaporize(o, col = [1, .6, .2], n = 6) {
  if (o.gone) return; const p = o.body.position;
  for (let i = 0; i < n; i++) spawnP(p.x + rand(-.3, .3), p.y + rand(-.3, .3), p.z + rand(-.3, .3), rand(-2, 2), rand(0, 3), rand(-2, 2), rand(.4, .9), col, rand(.2, .45), -2, 1.2, .9);
  removeObj(o);
}
function respawnAs(o, spec, awake) {
  const r = { spec, p: o.body.position.clone(), q: o.body.quaternion.clone() }, v = o.body.velocity.clone();
  const home = o.home; o.home = null; removeObj(o); const n = createPiece(r.spec, r.p.x, r.p.y, r.p.z, r.q, !awake); if (home) n.home = home;
  if (awake) n.body.setVelocity(v.x, v.y, v.z); n.pop = 1; n.mdirty = true; return n;
}
function glowMat(color, opacity = .9) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }); }
const stdMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .5, ...o });
function sphereMesh(r, mat) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat); m.castShadow = true; return m; }
// spawn a projectile with any physics shape
function spawnBody(kind, shape, mass, pos, vel, mesh, extra = {}, bodyOpts = {}) {
  const body = new P.PBody({ shape, mass, pos: toV3(pos), fric: .5, rest: .1, ccd: true, ld: 0, ad: .1, ...bodyOpts });
  body.velocity.set(vel.x, vel.y, vel.z);
  return addObj({ body, mesh, type: 'proj', kind, launched: true, born: simTime, noCap: true, ...extra });
}
const flatDir = d => { const v = V(d.x, 0, d.z); return v.lengthSq() < 1e-4 ? V(0, 0, -1) : v.normalize(); };
const camFlat = () => { const f = new THREE.Vector3(); camera.getWorldDirection(f); return flatDir(f); };

// ---- effects: shockwave rings, scorch marks, beams, bolts ----
const ringPool = [], scorchPool = [];
const scorchTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(10,8,6,.85)'); g.addColorStop(.55, 'rgba(25,18,12,.55)'); g.addColorStop(1, 'rgba(30,20,10,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
function ringFX(c, power = 1, color = 0xfff1c8) {
  let r = ringPool.find(q => !q.live);
  if (!r) { if (ringPool.length > 10) return; r = { mesh: new THREE.Mesh(new THREE.RingGeometry(.86, 1, 64), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false })) }; r.mesh.rotation.x = -Math.PI / 2; scene.add(r.mesh); ringPool.push(r); }
  r.live = true; r.t = 0; r.R = 5 * power + 2; r.mesh.material.color.set(color); r.mesh.position.set(c.x, Math.max(.08, Math.min(c.y, 1.5)), c.z); r.mesh.visible = true;
}
function scorch(c, power = 1) {
  if (c.y > 2.5 || !SAVE || SAVE.quality === 'off') return;
  let s = scorchPool.find(q => !q.live);
  if (!s) { if (scorchPool.length >= 30) s = scorchPool.reduce((a, b) => a.t0 < b.t0 ? a : b); else { s = { mesh: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })) }; s.mesh.rotation.x = -Math.PI / 2; s.mesh.renderOrder = 1; scene.add(s.mesh); scorchPool.push(s); } }
  s.live = true; s.t0 = simTime; const R = 2.2 * power + 1; s.mesh.scale.set(R * 2, R * 2, 1); s.mesh.rotation.z = rand(0, 6.28);
  s.mesh.position.set(c.x, .012 + scorchPool.indexOf(s) * .0004, c.z); s.mesh.material.opacity = 1; s.mesh.visible = true;
}
function beamFX(a, b, color, width = .12, life = .45) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(width, width, L, 8, 1, true), glowMat(color));
  m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(UPY, d.normalize()); scene.add(m);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(width * .35, width * .35, L, 6, 1, true), glowMat(0xffffff)); m.add(core);
  AFX.push({ t0: simTime, upd() { const k = (simTime - this.t0) / life; m.material.opacity = core.material.opacity = Math.max(0, 1 - k); if (k >= 1) { scene.remove(m); return false; } } });
  return m;
}
function boltFX(top, bot, color = 0xbfe4ff) {
  const pts = [], n = 14;
  for (let i = 0; i <= n; i++) { const k = i / n, j = i && i < n ? 1.4 * (1 - k * .6) : 0; pts.push(V(top.x + (bot.x - top.x) * k + rand(-j, j), top.y + (bot.y - top.y) * k, top.z + (bot.z - top.z) * k + rand(-j, j))); }
  for (let i = 0; i < n; i++) beamFX(pts[i], pts[i + 1], color, .11, .3);
}
function updateFX(dt) {
  for (const r of ringPool) if (r.live) { r.t += dt / .55; const k = Math.min(1, r.t), e = 1 - (1 - k) ** 3; r.mesh.scale.setScalar(.3 + e * r.R); r.mesh.material.opacity = (1 - k) * .75; if (k >= 1) { r.live = false; r.mesh.visible = false; } }
  for (const s of scorchPool) if (s.live) { const age = simTime - s.t0; if (age > 25) s.mesh.material.opacity = Math.max(0, 1 - (age - 25) / 5); if (age > 30) { s.live = false; s.mesh.visible = false; } }
}
function clearArsenal() { for (const f of AFX) if (f.kill) f.kill(); AFX = []; LATER = []; stuck.length = 0; updateDetonate(); for (const s of scorchPool) { s.live = false; s.mesh.visible = false; } }
function updateArsenal(dt) {
  if (LATER.length) { const due = LATER.filter(l => simTime >= l.t); LATER = LATER.filter(l => simTime < l.t); due.forEach(l => l.fn()); }
  if (AFX.length) AFX = AFX.filter(f => { const r = f.upd(dt); if (r === false && f.kill) f.kill(); return r !== false; });
  updateFX(dt);
}
// colored burst on top of a normal explosion
function burst(c, n, cols, speed = 8, size = .35) { for (let i = 0; i < n; i++) { const a = rand(0, 6.28), e = rand(-1.2, 1.2), s = rand(.4, 1) * speed; spawnP(c.x, c.y, c.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, Math.sin(a) * Math.cos(e) * s, rand(.6, 1.3), cols[i % cols.length], size, -4, .5); } }

// ---- definitions ----
function def(key, w) {
  ARSENAL[key] = w;
  PROJ[key] = { label: w.label, shape: 'sphere', r: w.r || .3, mass: w.mass || 2, rest: w.rest == null ? .2 : w.rest, special: true, desc: w.desc, cat: w.cat, style: w.style || 'throw', emoji: w.emoji, aoe: w.aoe, hidden: w.hidden };
  if (w.price) PRICES[key] = w.price;
}
// thrown helper: a physics projectile using this weapon's mesh
const lob = (key, ctx, extra = {}, body = {}) => spawnProj(key, ctx.o0, ctx.vel, { noCap: true, ...extra, body });
const stuck = [];   // sticky bombs + C4 riding on blocks

// ===== KINETIC =====
def('wreck', { label: 'Wrecking Ball', cat: 'kinetic', price: 180, emoji: '⛓️', style: 'strike', aoe: 3, desc: 'A half-ton steel ball swings in from the side',
  mesh: () => { const g = new THREE.Group(); g.add(sphereMesh(1.3, stdMat(0x3a3f46, { metalness: .5, roughness: .35 }))); return g; },
  fire({ target }) {
    const side = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    const anchor = V(target.x, target.y + 22, target.z), start = V(target.x - side.x * 16, Math.max(target.y + 3, 2.5), target.z - side.z * 16);
    const o = spawnBody('wreck', { kind: 'ball', r: 1.3 }, 500, start, V(side.x * 30, 4, side.z * 30), ARSENAL.wreck.mesh(), { expire: simTime + 6 });
    const chain = new THREE.Line(new THREE.BufferGeometry().setFromPoints([anchor, start]), new THREE.LineBasicMaterial({ color: 0x222222 })); scene.add(chain);
    AFX.push({ upd() { if (o.gone) return false; const p = o.body.position; chain.geometry.setFromPoints([V(anchor.x, anchor.y, anchor.z), V(p.x, p.y, p.z)]); }, kill() { scene.remove(chain); } });
    snd.whoosh();
  } });
def('ram', { label: 'Battering Ram', cat: 'kinetic', price: 120, emoji: '🪵', style: 'beam', desc: 'A heavy iron-capped log, launched dead straight',
  mesh: () => { const g = new THREE.Group(); const log = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, 3.2, 14), MATS.wood); log.rotation.z = Math.PI / 2; g.add(log);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .3, 14), stdMat(0x444a52, { metalness: .5 })); cap.rotation.z = Math.PI / 2; cap.position.x = 1.6; g.add(cap); g.traverse(m => m.castShadow = true); return g; },
  fire({ o0, dir, pw }) {
    const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), dir);
    spawnBody('ram', { kind: 'box', hx: 1.6, hy: .36, hz: .36 }, 160, o0, dir.clone().multiplyScalar(22 + 26 * pw), ARSENAL.ram.mesh(), { expire: simTime + 6 }, { quat: new Q4(q.x, q.y, q.z, q.w), gs: .25 });
    snd.whoosh();
  } });
def('shotgun', { label: 'Shotgun', cat: 'kinetic', price: 90, emoji: '🔫', style: 'beam', desc: 'A wide blast of 14 heavy pellets',
  mesh: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const s = sphereMesh(.12, stdMat(0x2b2b2b, { metalness: .4 })); s.position.set(rand(-.2, .2), rand(-.2, .2), rand(-.2, .2)); g.add(s); } return g; },
  fire({ o0, dir }) {
    for (let i = 0; i < 14; i++) { const d = dir.clone().add(V(rand(-.07, .07), rand(-.05, .07), rand(-.07, .07))).normalize();
      spawnBody('pellet', { kind: 'ball', r: .14 }, 3, o0, d.multiplyScalar(62), sphereMesh(.14, stdMat(0x2b2b2b)), { expire: simTime + 3 }, { gs: .4 }); }
    for (let i = 0; i < 20; i++) spawnP(o0.x, o0.y, o0.z, dir.x * 8 + rand(-2, 2), dir.y * 8 + rand(-2, 2), dir.z * 8 + rand(-2, 2), .3, [1, .8, .4], .3, 0, 1);
    snd.boom(); shake = .25;
  } });
def('minigun', { label: 'Minigun', cat: 'kinetic', price: 220, emoji: '⚙️', style: 'beam', desc: '40 rounds in two seconds — chews through walls',
  mesh: () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1, 6), stdMat(0x333840, { metalness: .6 })); const a = i / 6 * 6.28; b.position.set(Math.cos(a) * .14, 0, Math.sin(a) * .14); g.add(b); } g.rotation.x = Math.PI / 2; return g; },
  fire({ o0, dir }) {
    for (let i = 0; i < 40; i++) later(i * .05, () => { const d = dir.clone().add(V(rand(-.025, .025), rand(-.02, .025), rand(-.025, .025))).normalize();
      spawnBody('bullet', { kind: 'ball', r: .09 }, 2.2, o0, d.multiplyScalar(75), sphereMesh(.09, glowMat(0xffd27a)), { expire: simTime + 2 }, { gs: .1 });
      if (i % 3 === 0) snd.bang(); spawnP(o0.x, o0.y, o0.z, dir.x * 4, dir.y * 4, dir.z * 4, .12, [1, .85, .4], .35, 0, 0); shake = Math.max(shake, .08); });
  } });
def('railgun', { label: 'Railgun', cat: 'kinetic', price: 300, emoji: '⚡', style: 'beam', desc: 'An instant slug that punches clean through everything',
  mesh: () => sphereMesh(.2, glowMat(0x6ff3ff)),
  fire({ o0, dir }) {
    const end = o0.clone().addScaledVector(dir, 60); let hits = 0;
    const mid = o0.clone().addScaledVector(dir, 30);
    for (const o of nearObjs(mid, 31)) {
      const p = o.body.position, rel = V(p.x - o0.x, p.y - o0.y, p.z - o0.z), t = rel.dot(dir); if (t < 0) continue;
      const off = rel.clone().addScaledVector(dir, -t).length(); if (off > .9 + o.body.boundingRadius * .3) continue;
      const J = o.body.mass * 22; o.body.applyImpulse(new V3(dir.x * J, dir.y * J + J * .1, dir.z * J));
      if (o.breakable) pendingBreak.add(o); else if (canFracture(o)) pendingFracture.add(o); hits++;
    }
    beamFX(o0, end, 0x6ff3ff, .16, .6);
    for (let i = 0; i < 40; i++) { const p = o0.clone().addScaledVector(dir, rand(0, 40)); spawnP(p.x, p.y, p.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(.3, .7), [.5, .95, 1], .2, 0, 1); }
    snd.zap(); shake = .5; bulletUntil = simTime + .3; if (hits) toast(`⚡ Pierced ${hits}`);
  } });
def('drill', { label: 'Drill', cat: 'kinetic', price: 200, emoji: '🪛', style: 'beam', desc: 'Bores a tunnel straight through your tower',
  mesh: () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(.4, 1.3, 12), stdMat(0xb8bec6, { metalness: .6, roughness: .3 })); c.rotation.x = -Math.PI / 2; g.add(c);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .8, 12), stdMat(0xffb02e)); b.rotation.x = Math.PI / 2; b.position.z = .9; g.add(b); return g; },
  fire({ o0, dir }) {
    const m = ARSENAL.drill.mesh(); m.position.copy(o0); m.quaternion.setFromUnitVectors(V(0, 0, -1), dir); scene.add(m);
    const t0 = simTime; let eaten = 0;
    AFX.push({ upd(dt) {
      const k = simTime - t0; m.position.addScaledVector(dir, 15 * dt); m.rotateZ(dt * 30);
      if (k > .1) for (const o of nearObjs(m.position, 1.9, isBlock)) {
        if (o.body.position.distanceTo(m.position) < 1.3) { vaporize(o, MAT_DUST[o.mat] || [.6, .6, .6], 4); eaten++; if (eaten % 4 === 0) snd.crack(); }
        else { const p = o.body.position, d = V(p.x - m.position.x, p.y - m.position.y, p.z - m.position.z).normalize(); o.body.applyImpulse(new V3(d.x * o.body.mass * .6, .3 * o.body.mass, d.z * o.body.mass * .6)); }
      }
      if (Math.random() < .6) spawnP(m.position.x, m.position.y, m.position.z, rand(-3, 3), rand(0, 3), rand(-3, 3), .5, [.7, .65, .55], .3, -6, 1);
      if (k > 2.4 || m.position.y < -1) { scene.remove(m); if (eaten) toast(`🪛 Drilled ${eaten} blocks`); return false; }
    }, kill() { scene.remove(m); } });
    snd.rocket();
  } });
def('spike', { label: 'Spike Ball', cat: 'kinetic', price: 140, emoji: '🌵', desc: 'Every block it touches cracks apart', r: .5, mass: 45, rest: .2,
  mesh: () => { const g = new THREE.Group(), mt = stdMat(0x4a4f56, { metalness: .5 }); g.add(sphereMesh(.5, mt));
    for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.12, .45, 6), mt); const v = V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); c.position.copy(v).multiplyScalar(.6); c.quaternion.setFromUnitVectors(UPY, v); g.add(c); } return g; },
  fire(ctx) { lob('spike', ctx, { spike: true, expire: simTime + 8 }); snd.whoosh(); } });
def('hook', { label: 'Grapple Hook', cat: 'kinetic', price: 110, emoji: '🪝', style: 'beam', desc: 'Hooks a block and yanks it out of the tower',
  mesh: () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(.25, .06, 6, 12, Math.PI * 1.4), stdMat(0x9aa2aa, { metalness: .6 })); g.add(t); return g; },
  fire({ o0, dir }) {
    let best = null, bt = 1e9;
    for (const o of nearObjs(o0.clone().addScaledVector(dir, 25), 26, isBlock)) {
      const p = o.body.position, rel = V(p.x - o0.x, p.y - o0.y, p.z - o0.z), t = rel.dot(dir); if (t < 0) continue;
      if (rel.addScaledVector(dir, -t).length() < .7 + o.body.boundingRadius * .4 && t < bt) { bt = t; best = o; }
    }
    if (!best) { toast('🪝 Missed — aim at a block'); return; }
    const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([o0, o0]), new THREE.LineBasicMaterial({ color: 0x8a6a3a })); scene.add(rope);
    const t0 = simTime, from = o0.clone(), bp = best.body.position;
    const grab = nearObjs(bp, 1.6, isBlock).sort((a, b) => a.body.position.distanceTo(bp) - b.body.position.distanceTo(bp)).slice(0, 5);
    AFX.push({ upd(dt) {
      if (best.gone) return false; const p = best.body.position;
      if (simTime - t0 > .15) for (const g of grab) { if (g.gone) continue; const q = g.body.position, d = V(from.x - q.x, 0, from.z - q.z).normalize(), m = g.body.mass, s = g === best ? 70 : 40;
        g.body.applyImpulse(new V3(d.x * m * dt * s, m * dt * 16, d.z * m * dt * s)); }
      rope.geometry.setFromPoints([from, V(p.x, p.y, p.z)]); if (simTime - t0 > 1.1) return false;
    }, kill() { scene.remove(rope); } });
    snd.whoosh();
  } });

// ===== EXPLOSIVE =====
def('grenade', { label: 'Grenade', cat: 'explosive', price: 80, emoji: '🍍', desc: 'Bounces around, then blows after 2 seconds', r: .22, mass: 1.5, rest: .55,
  mesh: () => { const g = new THREE.Group(); const b = sphereMesh(.22, stdMat(0x4c6b2f)); b.scale.set(1, 1.2, 1); g.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(.1, .14, .1), stdMat(0x777777)); t.position.y = .28; g.add(t); return g; },
  fire(ctx) { lob('grenade', ctx, { bomb: true, timer: true, life: 2.2, power: .95 }); snd.whoosh(); } });
def('sticky', { label: 'Sticky Bomb', cat: 'explosive', price: 120, emoji: '🟢', desc: 'Sticks to the first block it hits, then pops', r: .2, mass: .8,
  mesh: () => { const g = new THREE.Group(); g.add(sphereMesh(.2, stdMat(0x2fbf4a, { emissive: 0x0a4a10 }))); const l = sphereMesh(.06, glowMat(0xff3030)); l.position.y = .2; g.add(l); return g; },
  fire(ctx) { lob('sticky', ctx, { stick: 1.6 }); snd.whoosh(); } });
def('c4', { label: 'Remote C4', cat: 'explosive', price: 160, emoji: '📟', desc: 'Throw several — they stick to blocks. Tap 💥 Detonate when ready', r: .22, mass: 1,
  mesh: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.42, .2, .3), stdMat(0xd9cfb0)); b.castShadow = true; g.add(b); const l = sphereMesh(.05, glowMat(0xff2020)); l.position.y = .12; g.add(l); return g; },
  fire(ctx) { lob('c4', ctx, { stick: Infinity, c4: true }); snd.whoosh(); toast(`📟 C4 armed (${stuck.filter(s => s.c4).length + 1}) — hit 💥 to detonate`); updateDetonate(); } });
def('shaped', { label: 'Shaped Charge', cat: 'explosive', price: 150, emoji: '🎯', desc: 'Focuses its whole blast in the direction you threw', r: .25, mass: 2,
  mesh: () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(.25, .5, 12), stdMat(0xe0a020, { metalness: .4 })); c.rotation.x = Math.PI / 2; g.add(c); return g; },
  fire(ctx) { const d = ctx.dir.clone(); lob('shaped', ctx, { bomb: true, power: .5, onBoom(o) {
      const c = o.body.position.clone(); removeObj(o); explodeAt(c, .5);
      for (const q of nearObjs(c, 10)) { const p = q.body.position, rel = V(p.x - c.x, p.y - c.y, p.z - c.z), L = rel.length() || .1; if (rel.dot(d) / L < .55) continue;
        const J = q.body.mass * 30 * (1 - L / 10); q.body.applyImpulse(new V3(d.x * J, d.y * J + J * .15, d.z * J)); if (L < 5 && canFracture(q)) pendingFracture.add(q); }
      for (let i = 0; i < 60; i++) { const s = rand(10, 28); spawnP(c.x, c.y, c.z, d.x * s + rand(-2, 2), d.y * s + rand(-2, 2), d.z * s + rand(-2, 2), rand(.3, .6), [1, rand(.6, .9), .3], rand(.3, .5), 0, 1); }
    } }); snd.whoosh(); } });
def('buster', { label: 'Bunker Buster', cat: 'explosive', price: 260, emoji: '🛢️', style: 'beam', desc: 'Punches deep inside before it detonates',
  mesh: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 1.4, 12), stdMat(0x4d5a3a)); const n = new THREE.Mesh(new THREE.ConeGeometry(.22, .5, 12), stdMat(0x333333)); n.position.y = .95; b.add(n); b.rotation.x = -Math.PI / 2; g.add(b); return g; },
  fire({ o0, target, dir }) {
    const m = ARSENAL.buster.mesh(); m.position.copy(o0); m.quaternion.setFromUnitVectors(V(0, 0, -1), dir); scene.add(m);
    const dist = o0.distanceTo(target); let s = 0, deep = 0;
    AFX.push({ upd(dt) {
      const step = 40 * dt; s += step; m.position.addScaledVector(dir, step);
      spawnP(m.position.x, m.position.y, m.position.z, rand(-.5, .5), rand(-.5, .5), rand(-.5, .5), .4, [.6, .6, .6], .3, 0, 1.5, .6);
      if (s > dist - 1) { deep += step; for (const o of nearObjs(m.position, 1.2, isBlock)) vaporize(o, MAT_DUST[o.mat] || [.6, .6, .6], 3); }
      if (deep > 3.5 || m.position.y < .2 || s > 80) { scene.remove(m); explodeAt(m.position.clone(), 1.9); return false; }
    }, kill() { scene.remove(m); } });
    snd.rocket();
  } });
def('carpet', { label: 'Carpet Bomber', cat: 'explosive', price: 380, emoji: '✈️', style: 'strike', aoe: 8, desc: 'A bomber flies over and drops a line of 12 bombs',
  mesh: () => { const g = new THREE.Group(), mt = stdMat(0x6a7480, { metalness: .3 }); const f = new THREE.Mesh(new THREE.CylinderGeometry(.5, .35, 6, 10), mt); f.rotation.x = Math.PI / 2; g.add(f);
    const w = new THREE.Mesh(new THREE.BoxGeometry(9, .15, 1.6), mt); g.add(w); const t = new THREE.Mesh(new THREE.BoxGeometry(3, .12, .9), mt); t.position.z = 2.6; g.add(t); const fin = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.2, .9), mt); fin.position.set(0, .6, 2.6); g.add(fin); return g; },
  fire({ target }) {
    const dir = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(), m = ARSENAL.carpet.mesh();
    const start = V(target.x - dir.x * 45, 24, target.z - dir.z * 45); m.position.copy(start); m.quaternion.setFromUnitVectors(V(0, 0, -1), dir); scene.add(m);
    const t0 = simTime, sp = 26; let dropped = 0;
    AFX.push({ upd() {
      const s = (simTime - t0) * sp; m.position.copy(start).addScaledVector(dir, s);
      const rel = s - 45; if (rel > -16 + dropped * 1.6 && dropped < 12) { dropped++; spawnProj('bomblet', m.position.clone().setY(22), V(dir.x * sp * .25, -2, dir.z * sp * .25), { bomb: true, power: .85, noCap: true }); }
      if (s > 95) { scene.remove(m); return false; }
    }, kill() { scene.remove(m); } });
    toast('✈️ Bomber inbound!'); snd.wind();
  } });
def('firework', { label: 'Fireworks', cat: 'explosive', price: 140, emoji: '🎆', style: 'strike', aoe: 5, desc: '14 rockets arc in and burst in color',
  mesh: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .6, 8), stdMat(0xff3a8a)); g.add(b); const n = new THREE.Mesh(new THREE.ConeGeometry(.12, .25, 8), stdMat(0xffd23a)); n.position.y = .42; g.add(n); return g; },
  fire({ target }) {
    const pals = [[[1, .2, .4], [1, .8, .9]], [[.3, .6, 1], [.8, .95, 1]], [[.3, 1, .4], [1, 1, .6]], [[1, .7, .1], [1, .3, .1]], [[.8, .3, 1], [1, .7, 1]]];
    for (let i = 0; i < 14; i++) later(i * .14, () => {
      const a = rand(0, 6.28), from = V(target.x + Math.cos(a) * 11, .6, target.z + Math.sin(a) * 11), to = V(target.x + rand(-3.5, 3.5), target.y + rand(0, 2), target.z + rand(-3.5, 3.5));
      const { vel } = solveVelocity(from, to, 28), pal = pals[i % pals.length];
      spawnProj('firework', from, vel, { bomb: true, power: .55, noCap: true, trail: pal[0], onBoom(o) { const c = o.body.position.clone(); removeObj(o); explodeAt(c, .55, 'spark'); burst(c, 70, pal, 11, .32); } });
    });
    snd.whoosh();
  } });
def('dynamite', { label: 'Dynamite', cat: 'explosive', price: 170, emoji: '🧨', desc: 'A big bundle — fuse burns 2.5 seconds, then BOOM', r: .35, mass: 4, rest: .1,
  mesh: () => { const g = new THREE.Group(); for (const [x, z] of [[-.15, 0], [.15, 0], [0, .22]]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .8, 10), stdMat(0xc0281e)); s.position.set(x, 0, z - .07); s.castShadow = true; g.add(s); } return g; },
  fire(ctx) { lob('dynamite', ctx, { bomb: true, timer: true, life: 2.5, power: 2, fuseFx: true }); snd.whoosh(); } });

// ===== ELEMENTAL =====
def('lightning', { label: 'Lightning', cat: 'elemental', price: 160, emoji: '🌩️', style: 'strike', aoe: 3, desc: 'Three bolts from the sky — steel conducts, wood catches fire',
  fire({ target }) {
    for (let i = 0; i < 3; i++) later(i * .28, () => {
      const p = V(target.x + rand(-1.4, 1.4), target.y, target.z + rand(-1.4, 1.4));
      boltFX(V(p.x + rand(-4, 4), 45, p.z + rand(-4, 4)), p); flash.color.setHex(0xa8d8ff); flash.position.copy(p); flash.intensity = 120;
      explodeAt(p, .65, 'plasma'); igniteNear(p, 3, .9);
      for (const o of nearObjs(p, 7)) if (o.mat === 'steel' || o.mat === 'gold') { o.body.applyImpulse(new V3(rand(-1, 1) * o.body.mass * 6, o.body.mass * 9, rand(-1, 1) * o.body.mass * 6)); beamFX(p, V(o.body.position.x, o.body.position.y, o.body.position.z), 0xbfe4ff, .05, .25); }
      snd.zap(); $('whiteout').style.transition = 'none'; $('whiteout').style.opacity = .35; requestAnimationFrame(() => { $('whiteout').style.transition = 'opacity .4s'; $('whiteout').style.opacity = 0; });
    });
  } });
def('freeze', { label: 'Freeze Ray', cat: 'elemental', price: 150, emoji: '❄️', style: 'beam', desc: 'Turns everything it hits into brittle ice — then smash it',
  fire({ o0, target }) {
    beamFX(o0, target, 0x9fe8ff, .14, .7); let n = 0;
    for (const o of nearObjs(target, 4.5, isBlock)) { if (o.mat === 'ice' || o.mat === 'tnt' || n > 300) continue; n++;
      const ice = respawnAs(o, { ...o.spec, mat: 'ice' }, false); ice.breakable = true; ice.body.setVelocity(0, 0, 0); }
    for (let i = 0; i < 80; i++) spawnP(target.x + rand(-4, 4), target.y + rand(-1, 4), target.z + rand(-4, 4), rand(-.5, .5), rand(-.2, .6), rand(-.5, .5), rand(.8, 1.6), [.85, .95, 1], rand(.15, .35), -.5, .5, .9);
    snd.tink(1); snd.glass(.4); toast(`❄️ Froze ${n} blocks`); dirty = true;
  } });
def('acid', { label: 'Acid Rain', cat: 'elemental', price: 240, emoji: '🧪', style: 'strike', aoe: 5, desc: 'A toxic cloud dissolves whatever is under it',
  fire({ target }) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(5, 18, 10), new THREE.MeshBasicMaterial({ color: 0x6fe04a, transparent: true, opacity: .35, depthWrite: false })); cloud.scale.y = .3; cloud.position.set(target.x, 15, target.z); scene.add(cloud);
    const t0 = simTime; let next = 0, ate = 0;
    AFX.push({ upd(dt) {
      const k = simTime - t0; cloud.material.opacity = .35 * Math.min(1, k * 3, (4.2 - k) * 2);
      for (let i = 0; i < 6; i++) spawnP(target.x + rand(-4.5, 4.5), 14, target.z + rand(-4.5, 4.5), 0, -16, 0, 1, [.55, 1, .3], .12, -6, 0, .8);
      if (simTime > next) { next = simTime + .1;
        const list = nearObjs(V(target.x, Math.max(2, target.y), target.z), 7, o => isBlock(o) && Math.hypot(o.body.position.x - target.x, o.body.position.z - target.z) < 4.5).sort((a, b) => b.body.position.y - a.body.position.y);
        for (const o of list.slice(0, 2)) { vaporize(o, [.5, 1, .3], 8); ate++; } if (list.length) snd.crackle(.8); }
      if (k > 4.2) { scene.remove(cloud); if (ate) toast(`🧪 Dissolved ${ate}`); return false; }
    }, kill() { scene.remove(cloud); } });
    snd.splash();
  } });
def('flame', { label: 'Flamethrower', cat: 'elemental', price: 130, emoji: '🔥', style: 'beam', desc: 'Two seconds of fire — wood, rubber and roofs go up',
  fire({ o0, target }) {
    const t0 = simTime, dir = V(target.x - o0.x, target.y - o0.y, target.z - o0.z).normalize();
    AFX.push({ upd(dt) {
      for (let i = 0; i < 9; i++) { const s = rand(14, 22); spawnP(o0.x, o0.y, o0.z, dir.x * s + rand(-1.5, 1.5), dir.y * s + rand(-1, 2), dir.z * s + rand(-1.5, 1.5), rand(.5, .9), [1, rand(.3, .7), .05], rand(.3, .55), 2, 2.4, .9); }
      if (Math.random() < .25) { for (const o of nearObjs(target, 2.8, isBlock)) { ignite(o, .5); o.body.applyImpulse(new V3(dir.x * o.body.mass * .4, 0, dir.z * o.body.mass * .4)); if (o.mat === 'ice') vaporize(o, [.8, .9, 1], 4); } snd.crackle(1); }
      if (simTime - t0 > 2.2) return false;
    } });
    noise(2.2, 'bandpass', 500, .4, .5);
  } });
def('lava', { label: 'Lava Bomb', cat: 'elemental', price: 200, emoji: '🫠', desc: 'Splashes a pool of lava that melts the base of your tower', r: .32, mass: 3,
  mesh: () => sphereMesh(.32, stdMat(0x3a1a10, { emissive: 0xff4a10, emissiveIntensity: 1.2 })),
  fire(ctx) { lob('lava', ctx, { bomb: true, power: .5, onBoom(o) {
    const c = o.body.position.clone(); removeObj(o); explodeAt(c, .5); const y = Math.max(.03, Math.min(c.y, 2) - .4);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: .9 })); pool.rotation.x = -Math.PI / 2; pool.position.set(c.x, y + .02, c.z); scene.add(pool);
    const t0 = simTime; let next = 0;
    AFX.push({ upd() {
      const k = simTime - t0; pool.material.color.setHSL(.04 + .02 * Math.sin(k * 6), 1, .5); pool.material.opacity = Math.min(.9, (6 - k) / 2); pool.scale.setScalar(Math.min(1, k * 4));
      if (Math.random() < .5) spawnP(c.x + rand(-2.8, 2.8), y + .1, c.z + rand(-2.8, 2.8), 0, rand(1, 3), 0, .7, [1, .5, .1], .25, -2, 1, .9);
      if (simTime > next) { next = simTime + .18;
        for (const o of nearObjs(V(c.x, y + 1, c.z), 4, o => isBlock(o) && Math.hypot(o.body.position.x - c.x, o.body.position.z - c.z) < 3.2 && o.body.getAABB().lowerBound.y < y + .5)) {
          ignite(o, .6); if (o.mat === 'ice' || Math.random() < .12) vaporize(o, [1, .45, .1], 6); } }
      if (k > 6) { scene.remove(pool); return false; }
    }, kill() { scene.remove(pool); } });
  } }); snd.whoosh(); } });
def('wave', { label: 'Tidal Wave', cat: 'elemental', price: 320, emoji: '🌊', style: 'strike', aoe: 10, desc: 'A wall of water sweeps across the whole arena',
  fire({ target }) {
    const dir = camFlat(), side = V(-dir.z, 0, dir.x), wall = new THREE.Mesh(new THREE.BoxGeometry(34, 6, 2.2), new THREE.MeshStandardMaterial({ color: 0x2f8fd8, transparent: true, opacity: .6, roughness: .1, metalness: .1 }));
    const start = V(target.x - dir.x * 22, 3, target.z - dir.z * 22); wall.position.copy(start); wall.quaternion.setFromUnitVectors(V(0, 0, 1), dir); scene.add(wall);
    const t0 = simTime;
    AFX.push({ upd(dt) {
      const s = (simTime - t0) * 16; wall.position.copy(start).addScaledVector(dir, s); const h = 6 * Math.min(1, (60 - s) / 15); wall.scale.y = Math.max(.05, h / 6); wall.position.y = 3 * wall.scale.y;
      const front = wall.position;
      for (const o of nearObjs(V(front.x, 3, front.z), 18)) { const p = o.body.position, rel = V(p.x - front.x, 0, p.z - front.z), a = rel.dot(dir), b = Math.abs(rel.dot(side));
        if (a > -2.5 && a < 1.8 && b < 17 && p.y < h + 1) { const m = o.body.mass; o.body.applyImpulse(new V3(dir.x * m * dt * 70, m * dt * 14, dir.z * m * dt * 70)); } }
      for (let i = 0; i < 10; i++) { const l = rand(-16, 16); spawnP(front.x + side.x * l, h * rand(.6, 1), front.z + side.z * l, dir.x * 8 + rand(-1, 1), rand(1, 4), dir.z * 8 + rand(-1, 1), .7, [.75, .9, 1], rand(.3, .6), -10, 1, .8); }
      if (s > 60) { scene.remove(wall); return false; }
    }, kill() { scene.remove(wall); } });
    snd.splash(); noise(3.5, 'lowpass', 400, .6); toast('🌊 Here it comes!');
  } });
def('volcano', { label: 'Volcano', cat: 'elemental', price: 420, emoji: '🌋', style: 'strike', aoe: 4, desc: 'The ground erupts and rains lava bombs for 4 seconds',
  fire({ target }) {
    const c = V(target.x, 0, target.z), cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3, 24, 1, true), stdMat(0x4a3428, { roughness: 1, side: THREE.DoubleSide }));
    cone.position.set(c.x, -1.5, c.z); scene.add(cone); explodeAt(V(c.x, .5, c.z), 1.3);
    const t0 = simTime; let next = 0;
    AFX.push({ upd() {
      const k = simTime - t0; cone.position.y = -1.5 + Math.min(1, k * 2) * 1.5 - Math.max(0, k - 4.5) * 2;
      for (let i = 0; i < 5; i++) spawnP(c.x + rand(-.6, .6), 3, c.z + rand(-.6, .6), rand(-1, 1), rand(4, 9), rand(-1, 1), rand(.6, 1.2), i % 2 ? [1, .5, .1] : [.3, .27, .26], rand(.4, .9), -3, 2, .9);
      if (k < 4 && simTime > next) { next = simTime + .16; const a = rand(0, 6.28), s = rand(2, 6);
        spawnProj('lavablob', V(c.x, 3.2, c.z), V(Math.cos(a) * s, rand(14, 20), Math.sin(a) * s), { bomb: true, fire: true, power: .45, noCap: true, meteor: true }); shake = Math.max(shake, .15); }
      if (k > 5.4) { scene.remove(cone); return false; }
    }, kill() { scene.remove(cone); } });
    snd.quake(); toast('🌋 Eruption!');
  } });
def('lavablob', { label: 'Lava blob', cat: 'elemental', hidden: true, r: .3, mass: 4, mesh: () => sphereMesh(.3, stdMat(0x3a1a10, { emissive: 0xff5a10, emissiveIntensity: 1.3 })) });

// ===== EXOTIC =====
def('gflip', { label: 'Gravity Flip', cat: 'exotic', price: 260, emoji: '🙃', style: 'strike', aoe: 8, desc: 'Turns gravity upside-down for 2.5 seconds',
  fire({ target }) {
    const c = V(target.x, target.y, target.z), t0 = simTime;
    AFX.push({ upd(dt) {
      for (const o of nearObjs(V(c.x, 6, c.z), 12)) if (Math.hypot(o.body.position.x - c.x, o.body.position.z - c.z) < 9) { const m = o.body.mass; o.body.applyImpulse(new V3(0, m * dt * -GRAV * 1.9, 0)); }
      for (let i = 0; i < 6; i++) spawnP(c.x + rand(-8, 8), rand(0, 2), c.z + rand(-8, 8), 0, rand(5, 9), 0, 1.2, [.7, .5, 1], .2, 0, 0, .8);
      if (simTime - t0 > 2.5) return false;
    } });
    snd.hole(); toast('🙃 Up we go!');
  } });
def('shrink', { label: 'Shrink Ray', cat: 'exotic', price: 180, emoji: '🔬', style: 'beam', desc: 'Everything it hits shrinks to half size — and loses its grip',
  fire({ o0, target }) {
    beamFX(o0, target, 0xff6ff0, .12, .6); let n = 0;
    for (const o of nearObjs(target, 3.5, isBlock)) { if (n > 250 || Math.max(...o.spec.d) < .2) continue; n++; respawnAs(o, { ...o.spec, d: o.spec.d.map(v => v * .5) }, true); }
    for (let i = 0; i < 50; i++) spawnP(target.x + rand(-3, 3), target.y + rand(-1, 3), target.z + rand(-3, 3), 0, rand(0, 1), 0, .8, [1, .5, 1], .2, 0, -.5);
    snd.laser(); toast(`🔬 Shrunk ${n}`); dirty = true;
  } });
def('magnet', { label: 'Magnet', cat: 'exotic', price: 200, emoji: '🧲', desc: 'Lands, then drags steel (and everything else) toward it', r: .35, mass: 8,
  mesh: () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(.3, .11, 8, 16, Math.PI), stdMat(0xd8312a)); t.rotation.z = Math.PI; g.add(t);
    for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(.22, .18, .22), stdMat(0xd0d4d8, { metalness: .6 })); tip.position.set(s * .3, .05, 0); g.add(tip); } return g; },
  fire(ctx) { lob('magnet', ctx, { onHit(o) {
    const t0 = simTime;
    AFX.push({ upd(dt) {
      if (o.gone) return false; const c = o.body.position;
      for (const q of nearObjs(c, 11)) { if (q === o) continue; const p = q.body.position, d = V(c.x - p.x, c.y + 1 - p.y, c.z - p.z), L = d.length() || .1; const s = (q.mat === 'steel' || q.mat === 'gold' ? 34 : 7) / (1 + L * .25);
        q.body.applyImpulse(new V3(d.x / L * q.body.mass * dt * s, d.y / L * q.body.mass * dt * s, d.z / L * q.body.mass * dt * s)); }
      if (Math.random() < .5) { const a = rand(0, 6.28); spawnP(c.x + Math.cos(a) * 3, c.y + rand(0, 2), c.z + Math.sin(a) * 3, -Math.cos(a) * 4, 0, -Math.sin(a) * 4, .7, [.6, .7, 1], .15, 0, 0); }
      if (simTime - t0 > 3.5) { removeObj(o); return false; }
    } }); snd.hole(); } }); snd.whoosh(); } });
def('laser', { label: 'Laser Satellite', cat: 'exotic', price: 450, emoji: '🛰️', style: 'strike', aoe: 3, desc: 'An orbital beam carves a circle through your build',
  fire({ target }) {
    const t0 = simTime, beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 80, 10, 1, true), glowMat(0xff3050, .8)), core = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 80, 6, 1, true), glowMat(0xffffff)); beam.add(core); scene.add(beam);
    let ate = 0;
    AFX.push({ upd() {
      const k = simTime - t0, a = k * 2.6, x = target.x + Math.cos(a) * 2.6 * Math.min(1, k), z = target.z + Math.sin(a) * 2.6 * Math.min(1, k);
      beam.position.set(x, 40, z); beam.material.opacity = .8 * Math.min(1, k * 4, (2.8 - k) * 3);
      flash.color.setHex(0xff4060); flash.position.set(x, 1, z); flash.intensity = 40;
      let n = 0; for (const o of nearObjs(V(x, 6, z), 14, isBlock).sort((p, q) => q.body.position.y - p.body.position.y)) { if (Math.hypot(o.body.position.x - x, o.body.position.z - z) > 1) continue; if (n++ > 2) break; ignite(o, 1); vaporize(o, [1, .3, .4], 6); ate++; }
      for (let i = 0; i < 4; i++) spawnP(x, .2, z, rand(-4, 4), rand(1, 5), rand(-4, 4), .5, [1, .5, .5], .2, -8, 0);
      if (Math.random() < .3) scorch(V(x, 0, z), .1);
      if (k > 2.8) { scene.remove(beam); if (ate) toast(`🛰️ Vaporized ${ate}`); return false; }
    }, kill() { scene.remove(beam); } });
    snd.laser(); noise(2.8, 'bandpass', 1800, .25, 2);
  } });
def('antimatter', { label: 'Antimatter', cat: 'exotic', price: 600, emoji: '⚛️', desc: 'Floats slowly… then erases everything near it', r: .4, mass: 2,
  mesh: () => { const g = new THREE.Group(); g.add(sphereMesh(.32, glowMat(0xffffff, 1))); const h = sphereMesh(.5, glowMat(0x6aa8ff, .5)); g.add(h); const r = new THREE.Mesh(new THREE.TorusGeometry(.6, .03, 6, 32), glowMat(0x9ad0ff)); r.rotation.x = 1.2; g.add(r); return g; },
  fire(ctx) { lob('antimatter', ctx, { bomb: true, power: 1.6, onBoom(o) {
    const c = o.body.position.clone(); removeObj(o); let n = 0;
    for (const q of nearObjs(c, 3.4)) { vaporize(q, [.8, .9, 1], 5); n++; }
    $('whiteout').style.transition = 'none'; $('whiteout').style.opacity = .7; requestAnimationFrame(() => { $('whiteout').style.transition = 'opacity 1s'; $('whiteout').style.opacity = 0; });
    ringFX(c, 2.2, 0x9ad0ff); bulletUntil = simTime + .8; snd.hole();
    later(.35, () => { explodeAt(c, 1.7, 'plasma'); toast(`⚛️ Annihilated ${n}`); });
  } }, { gs: .3 }); snd.whoosh(); } });

// ===== SILLY =====
def('piano', { label: 'Piano Drop', cat: 'silly', price: 100, emoji: '🎹', style: 'strike', aoe: 2, desc: 'A grand piano falls from the sky. Plink.',
  mesh: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.1), stdMat(0x111111, { roughness: .2 })); b.castShadow = true; g.add(b);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(2, .08, .3), stdMat(0xf8f8f0)); keys.position.set(0, .2, .65); g.add(keys); return g; },
  fire({ target }) { spawnBody('piano', { kind: 'box', hx: 1.1, hy: .6, hz: .55 }, 300, V(target.x, target.y + 30, target.z), V(0, -12, 0), ARSENAL.piano.mesh(), { expire: simTime + 9, onHit() { snd.twang(); shake = .6; } }); snd.whoosh(); } });
def('ducks', { label: 'Duck Swarm', cat: 'silly', price: 60, emoji: '🦆', style: 'strike', aoe: 5, desc: '40 rubber ducks. Bouncy, heavy, unstoppable.',
  mesh: () => { const g = new THREE.Group(), y = stdMat(0xffd21f); const b = sphereMesh(.3, y); b.scale.set(1.2, .9, 1); g.add(b); const h = sphereMesh(.18, y); h.position.set(.25, .3, 0); g.add(h);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(.07, .18, 6), stdMat(0xff7a1a)); bk.rotation.z = -Math.PI / 2; bk.position.set(.45, .28, 0); g.add(bk); return g; },
  fire({ target }) {
    for (let i = 0; i < 40; i++) later(i * .04, () => { spawnBody('ducks', { kind: 'ball', r: .32 }, 3, V(target.x + rand(-4, 4), target.y + rand(16, 24), target.z + rand(-4, 4)), V(rand(-1, 1), -6, rand(-1, 1)), ARSENAL.ducks.mesh(), { expire: simTime + 12 }, { rest: .7 }); if (i % 6 === 0) snd.quack(); });
  } });

// C4 detonator button
function updateDetonate() {
  const n = stuck.filter(s => s.c4).length + objs.filter(o => o.c4 && !o.gone).length, b = $('detBtn'); if (!b) return;
  b.style.display = n && mode === 'throw' ? 'block' : 'none'; b.textContent = `💥 Detonate ${n}`;
}
function detonateC4() {
  const list = stuck.filter(s => s.c4); list.forEach((s, i) => later(i * .09, () => { s.kill(); explodeAt(s.pos(), 1.3); }));
  for (const s of list) stuck.splice(stuck.indexOf(s), 1);
  objs.filter(o => o.c4 && !o.gone).forEach((o, i) => later(.05 + i * .09, () => { if (!o.gone) { const c = o.body.position.clone(); removeObj(o); explodeAt(c, 1.3); } }));
  later(.1, updateDetonate); updateDetonate();
}
// sticky bombs: on first touch they become a mesh riding on the block they hit
function makeStick(o, block) {
  const p = o.body.position, bq = block.body.quaternion, inv = new THREE.Quaternion(bq.x, bq.y, bq.z, bq.w).invert();
  const local = V(p.x - block.body.position.x, p.y - block.body.position.y, p.z - block.body.position.z).applyQuaternion(inv);
  const mesh = makeSpecialMesh(o.kind), t0 = simTime, delay = o.stick, c4 = !!o.c4; removeObj(o); scene.add(mesh);
  const s = { c4, pos() { const b = block.body, q = new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); return local.clone().applyQuaternion(q).add(V(b.position.x, b.position.y, b.position.z)); }, kill() { scene.remove(mesh); } };
  stuck.push(s);
  AFX.push({ upd() {
    if (!stuck.includes(s)) return false;
    mesh.position.copy(block.gone ? mesh.position : s.pos());
    if (Math.sin(simTime * 18) > .6) spawnP(mesh.position.x, mesh.position.y + .15, mesh.position.z, 0, .5, 0, .15, [1, .2, .2], .14, 0, 0);
    if (simTime - t0 > delay) { stuck.splice(stuck.indexOf(s), 1); s.kill(); explodeAt(mesh.position.clone(), 1.15); return false; }
  }, kill() { s.kill(); } });
  snd.squish(); updateDetonate();
}
// per-projectile hooks called from the main loop / collisions
function arsenalTick(o) {
  if (o.expire && simTime > o.expire) { removeObj(o); return true; }
  if (o.trail) { const p = o.body.position; spawnP(p.x, p.y, p.z, rand(-.5, .5), rand(-.5, .5), rand(-.5, .5), .4, o.trail, .25, 0, 0); }
  if (o.fuseFx) { const p = o.body.position; spawnP(p.x, p.y + .45, p.z, rand(-1.5, 1.5), rand(1, 3), rand(-1.5, 1.5), .3, [1, .85, .3], .14, -4, 0); }
  return false;
}
function arsenalHit(o, other) {
  if (o.stick && !o.stuck) {
    if (other && other.userData && other.userData.type === 'block' && !other.userData.gone) { o.stuck = true; makeStick(o, other.userData); return; }
    if (!o.c4 && !o.bomb) { o.bomb = true; o.fuse = simTime + 1.2; }   // hit the ground: just a timed bomb
  }
  if (o.onHit && !o.hitDone) { o.hitDone = true; o.onHit(o, other); }
}
