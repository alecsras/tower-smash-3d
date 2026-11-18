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
  if (canFracture(o) && eff > (o.charred ? 5 : FRACT[o.mat])) pendingFracture.add(o);
  if (o.type === 'proj' && impact > 9 && performance.now() - lastBuzz > 120) { lastBuzz = performance.now(); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
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
    if (dist < R * .4 && canFracture(q) && Math.random() < .8) pendingFracture.add(q);
    if (dist < R * .75) ignite(q, power > 2 ? .9 : .35);
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
function explosionFX(c, power, style = 'fire') {
  const S = BOOM_STYLE[style] || BOOM_STYLE.fire;
  flashMesh.position.copy(c); flashMesh.visible = true; flashT = 1; flashMesh.material.color.setHex(S.flash);
  flash.color.setHex(S.flash); flash.position.copy(c); flash.intensity = 60 * power;
  ringFX(c, power, S.ring); scorch(c, power);
  for (let i = 0; i < 70; i++) { const a = rand(0, 6.28), e = rand(-.3, 1.3), s = rand(3, 11) * power;
    spawnP(c.x, c.y, c.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, rand(.35, .8), S.ball(), rand(.35, .7), -3, 1.5); }
  for (let i = 0; i < 14 + 8 * power; i++) { const a = rand(0, 6.28), s = rand(.5, 3.5) * Math.sqrt(power); spawnSmoke(c.x + rand(-.6, .6) * power, c.y + rand(0, .8), c.z + rand(-.6, .6) * power, Math.cos(a) * s, rand(1, 3.5), Math.sin(a) * s, rand(2.5, 4.5) * Math.sqrt(power), rand(1.6, 2.8) * Math.sqrt(power), [.3, .29, .28].map(x => x + rand(0, .12)), .75); }
  for (let i = 0; i < 6; i++) spawnSmoke(c.x, c.y + .3, c.z, rand(-1, 1), rand(2, 4), rand(-1, 1), rand(.5, .9), rand(1.5, 2.2) * Math.sqrt(power), [1, .55, .2], .8);
  for (let i = 0; i < 26; i++) spawnP(c.x, c.y, c.z, rand(-9, 9), rand(3, 13), rand(-9, 9), rand(.8, 1.6), [.25, .18, .1], .14, -20, 0);
  shake = .55 * power; boomLayered(power, c);
  try { navigator.vibrate && navigator.vibrate(70); } catch (e) {}
}

