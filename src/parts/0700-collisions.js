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
let lastBuzz = 0;
let dustBudget = 0;   // dust puffs left this frame (refilled by the loop)
function dustPuff(o, impact) {
  const p = o.body.position, n = Math.min(4, 1 + Math.floor(impact / 6)), r = Math.min(1.2, o.body.boundingRadius);
  for (let i = 0; i < n && dustBudget > 0; i++, dustBudget--) {
    const a = Math.random() * 6.283, sp = rand(.6, 1.6) + impact * .05;
    spawnSmoke(p.x + Math.cos(a) * r * .6, .15, p.z + Math.sin(a) * r * .6, Math.cos(a) * sp, rand(.3, .8), Math.sin(a) * sp, rand(.9, 1.5), rand(.9, 1.6) * Math.max(.6, r), [.6, .55, .46], .55);
  }
}
function onHit(a, b, impact) { if (a && a.userData) handleHit(a.userData, b, impact); if (b && b.userData) handleHit(b.userData, a, impact); }
function handleHit(o, other, impact) {
  if (o.gone) return;
  const om = other ? other.mass : o.body.mass * 2;
  const eff = impact * clamp(Math.sqrt(om / o.body.mass), .5, 3);
  if (o.type === 'proj') arsenalHit(o, other);
  if ((o.bomb || o.hole) && !o.fuse && !o.timer && o.launched) o.fuse = simTime + (o.rocket || o.meteor ? .01 : o.hole ? .05 : .18);
  if (other && other.userData && other.userData.spike && canFracture(o)) pendingFracture.add(o);
  if ((o.breakable && eff > (BRITTLE[o.mat] || 7)) || (o.tnt && eff > 6)) pendingBreak.add(o);
  if (o.type === 'blorb' && eff > 4.5) o.hitHard = true;
  if (o.bonds) bondHitCheck(o, eff);
  if (canFracture(o) && eff > (o.charred ? 5 : FRACT[o.mat])) pendingFracture.add(o);
  if (o.type === 'proj' && impact > 9 && performance.now() - lastBuzz > 120) { lastBuzz = performance.now(); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
  // F5 impact feel: dust where heavy blocks hit the ground; a camera kick for big direct hits
  if (!other && o.type === 'block' && impact > 5 && dustBudget > 0) dustPuff(o, impact);
  if (o.type === 'proj' && other && impact > 12) shake = Math.max(shake, Math.min(.45, impact / 70));
  if (impact > 2.5 && o.type !== 'shard') {
    const t = performance.now();
    if (t - lastSnd > 40) {
      lastSnd = t; const v = clamp(impact / 14, .12, 1);
      const m = [o.mat, other && other.userData && other.userData.mat];
      (m.includes('stone') || m.includes('marble') || m.includes('concrete') || m.includes('sand')) ? snd.clack(v) : m.includes('steel') ? snd.clang(v) : m.includes('rubber') ? snd.boing(v) : (m.includes('glass') || m.includes('ice') || m.includes('crystal')) ? snd.tink(v) : snd.thud(v);
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
    addObj({ body, spec: Bx(o.mat || 'glass', s, s / 4, s), sc: [s, s / 4, s], mat: o.mat || 'glass', type: 'shard', born: simTime });
  }
  for (let i = 0; i < 24; i++) spawnP(p.x, p.y, p.z, rand(-4, 4), rand(-1, 5), rand(-4, 4), .7, o.mat === 'crystal' ? [.85, .6, 1] : [.85, .95, 1], .12, -12, 0);
  wakeAll(); snd.glass(1);
}

const flashMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false }));
flashMesh.visible = false; scene.add(flashMesh);
let flashT = 0;
function explode(o, power = 1) {
  if (o.gone) return;
  if (o.onBoom) { o.onBoom(o); return; }
  const c = o.body.position.clone(); removeObj(o);
  explodeAt(c, power);
  if (o.nuke) { nukeFX(c); igniteNear(c, 14, .8); }
  if (o.fire) { igniteNear(c, 5.5, 1); for (let i = 0; i < 60; i++) spawnP(c.x + rand(-2, 2), c.y + rand(0, 1), c.z + rand(-2, 2), rand(-3, 3), rand(2, 6), rand(-3, 3), rand(.6, 1.2), [1, rand(.3, .6), .05], rand(.4, .8), 1, 1, .9); }
}
function explodeAt(c, power = 1, style) {
  // bigger, more physical blast: reach grows with power, the push falls off smoothly with distance (much harder near
  // the centre), close blocks shatter, and the outer edge rattles and wakes things rather than hurling them
  const R = 6.5 * power, K = 30 * power;
  bondBlast(c, R);
  for (const q of objs) {
    if (q.gone) continue;
    const qp = q.body.position, dist = Math.hypot(qp.x - c.x, qp.y - c.y, qp.z - c.z) || .01;
    if (dist > R) continue;
    activate(q); const f = 1 - dist / R, imp = K * Math.pow(f, 1.4) * Math.sqrt(q.body.mass);
    q.body.applyImpulse(new V3((qp.x - c.x) / dist * imp, ((qp.y - c.y) / dist + .45) * imp, (qp.z - c.z) / dist * imp));
    const w = q.body.angularVelocity, sp = 7 * f; q.body.setAngularVelocity(w.x + rand(-sp, sp), w.y + rand(-sp, sp), w.z + rand(-sp, sp));
    if (q.breakable && dist < R * .6) pendingBreak.add(q);
    if (q.tnt && dist < R * .7 && !q.chain) { q.chain = true; pendingBoom.push({ o: q, t: simTime + rand(.08, .2) }); }
    if (dist < R * .45 && canFracture(q) && Math.random() < .85) pendingFracture.add(q);
    if (dist < R * .7) ignite(q, power > 2 ? .9 : .35);
    if (q.type === 'blorb' && dist < R * .8) q.hitHard = true;
  }
  recFx(c, power); explosionFX(c, power, style); followBoom(c);
}
const BOOM_STYLE = {
  fire: { flash: 0xffaa44, ball: () => [1, rand(.45, .85), rand(.05, .25)], ring: 0xfff1c8 },
  plasma: { flash: 0x9ad0ff, ball: () => [rand(.5, .8), rand(.8, 1), 1], ring: 0xbfe4ff },
  spark: { flash: 0xffe0f0, ball: () => [rand(.6, 1), rand(.3, 1), rand(.3, 1)], ring: 0xffffff },
  toxic: { flash: 0x9aff6a, ball: () => [rand(.4, .7), 1, rand(.2, .4)], ring: 0xb0ff8a }
};
// a staged explosion: flash, white-hot fireball, billowing fire, a shockwave shell, a dust ring racing along the
// ground, debris and embers, then a dark smoke column that lingers. Counts scale with the graphics level.
function explosionFX(c, power, style = 'fire') {
  const S = BOOM_STYLE[style] || BOOM_STYLE.fire, q = SAVE.quality === 'high' ? 1 : SAVE.quality === 'lite' ? .35 : .65, sp = Math.sqrt(power), N = n => Math.max(1, Math.round(n * q));
  flashMesh.position.copy(c); flashMesh.visible = true; flashT = 1; flashMesh.material.color.setHex(S.flash);
  flash.color.setHex(S.flash); flash.position.copy(c); flash.intensity = 80 * power;
  if (power >= 1.5 && !SAVE.calm) { const w = $('whiteout'); w.style.transition = 'none'; w.style.opacity = Math.min(.45, .12 * power); requestAnimationFrame(() => { w.style.transition = 'opacity .5s'; w.style.opacity = 0; }); }
  ringFX(c, power, S.ring); scorch(c, power);
  fireball(c, power, S, style);
  // billowing fire, then the fast spray of burning fragments
  for (let i = 0; i < N(10 + 10 * power); i++) { const a = rand(0, 6.28), e = rand(0, 1.2), v = rand(1, 3.5) * sp;
    spawnSmoke(c.x + rand(-.4, .4) * sp, c.y + rand(0, .6), c.z + rand(-.4, .4) * sp, Math.cos(a) * Math.cos(e) * v, rand(1.5, 4) + Math.sin(e) * v, Math.sin(a) * Math.cos(e) * v, rand(.5, 1), rand(1.4, 2.4) * sp, S.ball(), .85); }
  for (let i = 0; i < N(70 + 20 * power); i++) { const a = rand(0, 6.28), e = rand(-.3, 1.3), v = rand(3, 12) * power;
    spawnP(c.x, c.y, c.z, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v + 2, Math.sin(a) * Math.cos(e) * v, rand(.35, .8), S.ball(), rand(.35, .7), -3, 1.5); }
  // a dark smoke column that rises, spreads and hangs around
  for (let i = 0; i < N(16 + 16 * power); i++) { const a = rand(0, 6.28), h = rand(0, 1), r = rand(0, 1.2) * sp * (1 - h * .4);
    const dark = rand(.1, .2);
    spawnSmoke(c.x + Math.cos(a) * r, c.y + (.3 + h * 4) * sp, c.z + Math.sin(a) * r, Math.cos(a) * rand(.3, 1.2), rand(1, 2.6) * sp, Math.sin(a) * rand(.3, 1.2), rand(3.5, 7), rand(2.4, 4.2) * sp, [dark, dark * .95, dark * .9], .8); }
  // a dust ring racing out along the ground
  if (c.y < 2.5) for (let i = 0; i < N(18 + 8 * power); i++) { const a = i / (18 + 8 * power) * 6.28 + rand(-.1, .1), v = rand(6, 12) * sp;
    spawnSmoke(c.x + Math.cos(a) * .8, .25, c.z + Math.sin(a) * .8, Math.cos(a) * v, rand(.2, .8), Math.sin(a) * v, rand(1, 1.8), rand(1, 1.8) * sp, [.62, .56, .46], .6); }
  // dirt clods, then embers that drift down for a while
  for (let i = 0; i < N(26 + 14 * power); i++) spawnP(c.x, c.y, c.z, rand(-9, 9) * sp, rand(3, 14) * sp, rand(-9, 9) * sp, rand(.8, 1.6), [.25, .18, .1], rand(.12, .2), -20, 0);
  for (let i = 0; i < N(14 + 8 * power); i++) spawnP(c.x + rand(-1, 1), c.y + rand(0, 2), c.z + rand(-1, 1), rand(-3, 3) * sp, rand(2, 7) * sp, rand(-3, 3) * sp, rand(1.8, 3.2), [1, rand(.45, .7), .15], rand(.08, .14), -2.5, 0);
  shake = Math.max(shake, Math.min(1.2, .55 * power)); boomLayered(power, c); haptic(Math.min(90, 25 + power * 30));
  if (power >= 1.2) setTimeout(() => snd.rumble(), 280);
  try { navigator.vibrate && navigator.vibrate(70); } catch (e) {}
}
// the fireball: a white-hot core inside an orange shell that swells fast and fades, plus a faint shockwave shell
const fbPool = [], _smokeCol = new THREE.Color(0x3a2a20);
function fireball(c, power, S, style) {
  let f = fbPool.find(x => !x.live);
  if (!f) {
    if (fbPool.length >= 8) return;
    const mk = (col, op) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; scene.add(m); return m; };
    f = { core: mk(0xfff2c0, 1), shell: mk(0xff6a10, .95), wave: mk(0xffffff, .22) };
    f.shell.material.blending = THREE.NormalBlending; f.wave.material.blending = THREE.NormalBlending; f.shell.renderOrder = 1; f.core.renderOrder = 2; fbPool.push(f);
  }
  f.live = true; const t0 = simTime, sp = Math.sqrt(power), R = 6.5 * power;
  for (const m of [f.core, f.shell, f.wave]) { m.position.copy(c); m.visible = true; }
  f.shell.material.color.setHex(style === 'plasma' ? 0x5aa8ff : style === 'toxic' ? 0x6fe04a : style === 'spark' ? 0xff7ad0 : 0xff6a10);
  AFX.push({ upd() {
    const k = (simTime - t0) / .55;   // 0..1 over ~0.55 s of game time
    if (k >= 1) { this.kill(); return false; }
    const e = 1 - Math.pow(1 - k, 3);
    f.core.scale.setScalar(.4 + 1.2 * sp * e); f.core.material.opacity = Math.max(0, 1 - k * 2);
    f.shell.scale.setScalar(.6 + 2.8 * sp * e); f.shell.material.opacity = .95 * Math.pow(1 - k, 1.5);
    f.shell.material.color.lerp(_smokeCol, .06);   // cools from orange towards smoke as it grows
    f.shell.position.y = c.y + e * .8 * sp;
    const kw = Math.min(1, k * 2.4); f.wave.scale.setScalar(.5 + R * kw); f.wave.material.opacity = .22 * (1 - kw);
  }, kill() { f.live = false; f.core.visible = f.shell.visible = f.wave.visible = false; } });
}

