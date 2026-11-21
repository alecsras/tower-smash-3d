// ================= fracture, fire, replay, glow =================
// ---- fracture: hard hits split boxes into real physical chunks ----
const FRACT = { wood: 13, stone: 17, concrete: 16, marble: 15, sand: 11, lacquer: 12, roof: 11, gold: 24, brick: 12, obsidian: 30, steel: 60, rubber: 99 };
const MAT_DUST = { wood: [.62, .42, .22], stone: [.6, .62, .65], concrete: [.72, .72, .72], marble: [.9, .88, .84], sand: [.85, .72, .48], lacquer: [.6, .18, .12], roof: [.7, .3, .2], gold: [1, .8, .3], brick: [.7, .32, .22], obsidian: [.2, .12, .28], steel: [.6, .64, .7], rubber: [1, .4, .7], ice: [.85, .95, 1], crystal: [.85, .6, 1] };
let pendingFracture = new Set();
const canFracture = o => o.type === 'block' && !o.gone && o.spec && o.spec.shape === 'box' && FRACT[o.mat] && specVolume(o.spec) > .2;
function splitBox(size, off, depth, maxDepth) {
  if (depth >= maxDepth || size[0] * size[1] * size[2] < .14) return [[size, off]];
  const ax = size.indexOf(Math.max(...size)), r = rand(.38, .62);
  const a = size.slice(), b = size.slice(); a[ax] = size[ax] * r; b[ax] = size[ax] * (1 - r);
  const oa = off.slice(), ob = off.slice(); oa[ax] -= size[ax] / 2 - a[ax] / 2; ob[ax] += size[ax] / 2 - b[ax] / 2;
  return [...splitBox(a, oa, depth + 1, maxDepth), ...splitBox(b, ob, depth + 1, maxDepth)];
}
function fracture(o) {
  if (!canFracture(o) || objs.length > 15000) return;
  // split into fewer, bigger chunks when thousands of bodies are already moving (same look, far less physics)
  const vol = specVolume(o.spec), busy = P.activeCount, depth = busy > 5000 ? 1 : busy > 2500 ? (vol > 1.5 ? 2 : 1) : (vol > 1.5 ? 3 : 2);
  const parts = splitBox(o.spec.d.slice(), [0, 0, 0], 0, depth);
  const p = o.body.position.clone(), q = o.body.quaternion.clone(), v = o.body.velocity.clone(), { tint, charred, mat } = o;
  removeObj(o);
  for (const [sz, off] of parts) {
    const s = sz.map(x => x * .97), wo = q.vmult(new V3(off[0], off[1], off[2])), ol = Math.hypot(wo.x, wo.y, wo.z) || 1, kick = rand(.8, 2.4);
    const body = new P.PBody({ shape: { kind: 'box', hx: s[0] / 2, hy: s[1] / 2, hz: s[2] / 2 }, density: DENS[mat], pos: new V3(p.x + wo.x, p.y + wo.y, p.z + wo.z), quat: q.clone() });
    body.velocity.set(v.x + wo.x / ol * kick, v.y + wo.y / ol * kick + .5, v.z + wo.z / ol * kick);
    body.angularVelocity.set(rand(-3, 3), rand(-3, 3), rand(-3, 3));
    const spec = Bx(mat, s[0], s[1], s[2]);
    addObj({ body, spec, sc: spec.d, type: 'block', mat, chunk: true, tint, charred, cdirty: !!tint });
  }
  const c = MAT_DUST[mat] || [.6, .6, .6];
  for (let i = 0; i < 10; i++) spawnP(p.x, p.y, p.z, rand(-2.5, 2.5), rand(0, 3), rand(-2.5, 2.5), rand(.5, 1.1), c, rand(.2, .45), -3, 1.5, .8);
  if (Math.random() < .5) snd.crack();
}
function processFractures() {
  let n = 0;
  const cap = P.activeCount > 3000 ? 8 : P.activeCount > 1000 ? 14 : 24;   // spread big waves over a few frames
  for (const o of pendingFracture) { pendingFracture.delete(o); fracture(o); if (++n >= cap) break; }
}

// ---- fire: wood ignites, burns, spreads, chars, crumbles ----
const IGNITE = { wood: 1, lacquer: 1, roof: .25, domino: .6 };
let burning = new Set(), nextSpread = 0, nextCrackle = 0;
function ignite(o, chance = 1) {
  if (o.gone || o.burn || o.charred || !IGNITE[o.mat] || o.type !== 'block' || burning.size > 280 || Math.random() > chance * IGNITE[o.mat]) return;
  o.burn = { t0: simTime, dur: rand(6, 9.5) }; burning.add(o);
}
function igniteNear(c, R, chance) {
  const a = { lowerBound: { x: c.x - R, y: c.y - R, z: c.z - R }, upperBound: { x: c.x + R, y: c.y + R, z: c.z + R } };
  const near = new Set();
  forCells(a, 0, k => { const st = dormant.get(k); if (st) for (const o of st) near.add(o); });
  for (const pb of P.bodies()) if (pb.userData) near.add(pb.userData);
  for (const o of near) if (o.body.position.distanceTo(c) < R) ignite(o, chance);
}
function updateFire() {
  if (!burning.size) return;
  const stride = Math.max(1, Math.ceil(burning.size / 45)); let i = 0;
  for (const o of burning) {
    if (o.gone) { burning.delete(o); continue; }
    const k = (simTime - o.burn.t0) / o.burn.dur, glow = .5 + .5 * Math.sin(simTime * 13 + (o.bi || 0));
    o.tint = [1, Math.max(.2, .5 + .22 * glow - .35 * k), Math.max(.05, .22 * (1 - k))]; o.cdirty = true;
    if (i++ % stride === 0) {
      const p = o.body.position, h = specHeight(o.spec) / 2;
      spawnP(p.x + rand(-.35, .35), p.y + h, p.z + rand(-.35, .35), rand(-.3, .3), rand(1.6, 3.2), rand(-.3, .3), rand(.35, .7), [1, rand(.35, .7), .08], rand(.28, .5), 1.5, -.4, .95);
      if (Math.random() < .3) spawnSmoke(p.x, p.y + h + .4, p.z, rand(-.3, .3), rand(.8, 1.6), rand(-.3, .3), rand(2, 3.5), rand(.9, 1.5), [.16, .15, .15], .5);
    }
    if (k >= 1) {
      burning.delete(o); o.burn = null; o.charred = true; o.tint = [.22, .19, .17]; o.cdirty = true;
      if (Math.random() < .5) { activate(o); pendingFracture.add(o); }
    }
  }
  if (simTime > nextSpread) {
    nextSpread = simTime + .6;
    for (const o of [...burning]) { const k = (simTime - o.burn.t0) / o.burn.dur; if (k > .15 && k < .9) igniteNear(o.body.position, 1.35, .3); }
  }
  if (simTime > nextCrackle) { nextCrackle = simTime + rand(.15, .45); snd.crackle(Math.min(1, burning.size / 40)); }
}

// ---- instant replay: records the last ~7 s of motion and plays it back cinematically ----
const REC_WIN = 7;
const rec = { frames: [], starts: [], removes: [], fx: [], fno: 0, on: true };
function recordFrame() {
  if (!rec.on || replay) return;
  rec.fno++;
  if (rec.fno % 2) return;                                       // ~30 fps
  const list = [];
  for (const o of objs) if (!o.gone && (o.mdirty || (o.mesh && !o.body.isSleeping()))) list.push(o);
  if (list.length) {
    const data = new Float32Array(list.length * 7);
    list.forEach((o, i) => {
      if (o.lastRecF !== rec.fno - 2) rec.starts.push({ t: simTime, o, pose: o.lastPose || null });
      const p = o.body.position, q = o.body.quaternion, j = i * 7;
      data[j] = p.x; data[j + 1] = p.y; data[j + 2] = p.z; data[j + 3] = q.x; data[j + 4] = q.y; data[j + 5] = q.z; data[j + 6] = q.w;
      o.lastRecF = rec.fno; o.lastPose = data.subarray(j, j + 7);
    });
    rec.frames.push({ t: simTime, list, data });
  }
  const cut = simTime - REC_WIN;
  while (rec.frames.length && rec.frames[0].t < cut) rec.frames.shift();
  for (const k of ['starts', 'removes', 'fx']) while (rec[k].length && rec[k][0].t < cut) rec[k].shift();
  $('replayBtn').classList.toggle('show', mode === 'throw' && rec.frames.length > 20 && !replay);
}
const recRemove = o => { if (rec.on && !replay) rec.removes.push({ t: simTime, o }); };
const recFx = (c, power) => { if (rec.on && !replay) rec.fx.push({ t: simTime, c: c.clone(), power }); };

let replay = null;
function startReplay(withClip) {
  if (!rec.frames.length || replay) return;
  const T0 = rec.frames[0].t, T1 = rec.frames[rec.frames.length - 1].t;
  const tl = new Map();                                           // o -> {t:[], p:[]}
  for (const f of rec.frames) f.list.forEach((o, i) => { let e = tl.get(o); if (!e) tl.set(o, e = { t: [], p: [], init: null, rem: Infinity, born: -Infinity }); e.t.push(f.t); e.p.push(f.data.subarray(i * 7, i * 7 + 7)); });
  for (const s of rec.starts) { const e = tl.get(s.o); if (e && e.init == null && s.pose) e.init = s.pose; }
  for (const r of rec.removes) { const e = tl.get(r.o); if (e) e.rem = r.t; }
  for (const [o, e] of tl) if (o.createdT != null && o.createdT > T0) e.born = o.createdT;
  // ghosts: removed batch objects get a temporary instanced mesh so they reappear during the replay
  const ghosts = new Map();
  for (const [o, e] of tl) if (o.gone && !o.mesh && o.spec) {
    const b = batchFor(o.spec); let g = ghosts.get(b);
    if (!g) ghosts.set(b, g = { b, items: [] }); g.items.push(o);
  }
  for (const g of ghosts.values()) {
    g.mesh = new THREE.InstancedMesh(g.b.geo, g.b.mat, g.items.length); g.mesh.frustumCulled = false; g.mesh.castShadow = g.b.cast;
    g.items.forEach((o, i) => o.gi = i); scene.add(g.mesh);
  }
  for (const [o] of tl) if (o.mesh && o.gone) scene.add(o.mesh);
  // camera: orbit the action
  let cx = 0, cy = 0, cz = 0, n = 0;
  for (const f of rec.fx) { cx += f.c.x * 5; cy += f.c.y * 5; cz += f.c.z * 5; n += 5; }
  for (const [, e] of tl) { const p = e.p[Math.floor(e.p.length / 2)]; cx += p[0]; cy += p[1]; cz += p[2]; n++; }
  cx /= n; cy /= n; cz /= n;
  let spread = 0; for (const [, e] of tl) { const p = e.p[e.p.length - 1]; spread = Math.max(spread, Math.hypot(p[0] - cx, p[2] - cz)); }
  replay = { T0, T1, t: T0, tl, ghosts, fxi: 0, fx: rec.fx.slice(), saved: { th: cam.theta, el: cam.el, r: cam.r, tgt: cam.target.clone(), tTh: cam.tTheta, tEl: cam.tEl, tR: cam.tR },
    center: new THREE.Vector3(cx, Math.max(1.5, cy * .6), cz), R: clamp(spread * 1.6 + 10, 12, 55), th0: cam.theta };
  document.body.classList.add('replaying'); $('replayBtn').classList.remove('show');
  parts = [];
  if (withClip) startClip();
}
const _rm = new THREE.Matrix4(), _rp = new THREE.Vector3(), _rq = new THREE.Quaternion(), _rs = new THREE.Vector3();
function poseAt(e, t) {
  if (t < e.born || t >= e.rem) return null;
  let lo = 0, hi = e.t.length - 1;
  if (t < e.t[0]) return e.init || e.p[0];
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (e.t[m] <= t) lo = m; else hi = m - 1; }
  return e.p[lo];
}
function updateReplay(rawDt) {
  const R = replay; R.t += rawDt * .55;
  while (R.fxi < R.fx.length && R.fx[R.fxi].t <= R.t) { const f = R.fx[R.fxi++]; explosionFX(f.c, f.power); }
  for (const [o, e] of R.tl) {
    const p = poseAt(e, R.t);
    if (o.mesh) { o.mesh.visible = !!p; if (p) { o.mesh.position.set(p[0], p[1], p[2]); if (!o.rocket) o.mesh.quaternion.set(p[3], p[4], p[5], p[6]); } continue; }
    const k = p ? 1 : 0;
    if (p) { _rp.set(p[0], p[1], p[2]); _rq.set(p[3], p[4], p[5], p[6]); } else _rp.set(0, -999, 0);
    _rs.set(o.sc[0] * k || 1e-4, o.sc[1] * k || 1e-4, o.sc[2] * k || 1e-4);
    _rm.compose(_rp, _rq, _rs);
    if (o.gone) { const g = R.ghosts.get(batchFor(o.spec)); g.mesh.setMatrixAt(o.gi, _rm); g.mesh.instanceMatrix.needsUpdate = true; }
    else if (o.batch) { o.batch.mesh.setMatrixAt(o.bi, _rm); o.batch.mesh.instanceMatrix.needsUpdate = true; }
  }
  const prog = (R.t - R.T0) / Math.max(.1, R.T1 - R.T0);
  cam.target.copy(R.center); cam.theta = cam.tTheta = R.th0 + .9 + prog * 1.4; cam.el = cam.tEl = .28 + .12 * Math.sin(prog * 3); cam.r = cam.tR = R.R * (1.05 - .25 * prog);
  $('replayBar').style.width = (prog * 100).toFixed(1) + '%';
  if (R.t >= R.T1 + .3) stopReplay();
}
function stopReplay() {
  const R = replay; if (!R) return; replay = null;
  for (const g of R.ghosts.values()) { scene.remove(g.mesh); g.mesh.dispose(); }
  for (const [o] of R.tl) { if (o.mesh) { if (o.gone) scene.remove(o.mesh); else { o.mesh.visible = true; syncMesh(o); } } else if (!o.gone) o.mdirty = true; }
  const s = R.saved; cam.theta = s.th; cam.el = s.el; cam.r = s.r; cam.target.copy(s.tgt); cam.tTheta = s.tTh; cam.tEl = s.tEl; cam.tR = s.tR;
  document.body.classList.remove('replaying'); parts = [];
  stopClip();
}
$('replayBtn').onclick = () => $('replayMenu').classList.toggle('open');
$('replayPlay').onclick = () => { $('replayMenu').classList.remove('open'); startReplay(false); };
$('replayClip').onclick = () => { $('replayMenu').classList.remove('open'); startReplay(true); };
$('replayStop').onclick = e => { e.stopPropagation(); stopReplay(); };

// ---- clip recording (canvas -> video file) ----
let clipRec = null, clipChunks = [], clipBlob = null, downloadsP = null;
const clipSupported = () => !!(window.MediaRecorder && renderer.domElement.captureStream);
function startClip() {
  if (!clipSupported()) { toast('Clip recording isn’t supported in this browser'); return; }
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'], type = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  try {
    clipChunks = []; clipRec = new MediaRecorder(renderer.domElement.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 6e6 } : undefined);
    clipRec.ondataavailable = e => e.data.size && clipChunks.push(e.data);
    clipRec.onstop = () => { clipBlob = new Blob(clipChunks, { type: clipRec.mimeType || 'video/webm' }); $('clipBar').classList.add('open'); };
    clipRec.start(250);
  } catch (e) { clipRec = null; toast('Could not start recording'); }
}
function stopClip() { if (clipRec && clipRec.state !== 'inactive') clipRec.stop(); }
$('clipSave').onclick = async () => {
  if (!clipBlob) return;
  track('share_clip');
  const ext = clipBlob.type.includes('mp4') ? 'mp4' : 'webm', name = `tower-smash-${Date.now()}.${ext}`;
  const dl = await (downloadsP || (downloadsP = useCap('downloads')));
  try {
    if (dl) { await dl.save({ filename: name, data: clipBlob }); toast('Clip saved'); }
    else if (navigator.canShare && navigator.canShare({ files: [new File([clipBlob], name, { type: clipBlob.type })] })) await navigator.share({ files: [new File([clipBlob], name, { type: clipBlob.type })], title: 'Tower Smash' });
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(clipBlob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  } catch (e) { toast('Clip not saved'); }
  $('clipBar').classList.remove('open');
};
$('clipX').onclick = () => $('clipBar').classList.remove('open');

// ---- platform capabilities (artifact viewer) ----
async function useCap(name) {
  for (let i = 0; i < 40 && !(window.claude && window.claude.use); i++) await new Promise(r => setTimeout(r, 150));
  try { return window.claude && window.claude.use ? await window.claude.use(name) : null; } catch (e) { return null; }
}

// ---- glow (bloom) for high quality ----
let composer = null, bloomPass = null;
function applyQuality() {
  const high = SAVE.quality === 'high';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, high ? 2 : 1.5));
  sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  if (high && !composer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .5, .45, .86); composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }
  resize();
}
function renderFrame() {
  if (replay || shadowDirty > 0 || ++shadowSafety > 90) { renderer.shadowMap.needsUpdate = true; if (shadowDirty > 0) shadowDirty--; shadowSafety = 0; }
  if (composer && SAVE.quality === 'high') { bloomPass.strength = night ? .95 : .5; bloomPass.threshold = night ? .6 : .86; composer.render(); }
  else renderer.render(scene, camera);
}

