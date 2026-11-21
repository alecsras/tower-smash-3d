// ================= main loop =================
// physics always advances in fixed 1/60 s steps; drawing blends between the last two steps (physAlpha)
const STEP = 1 / 60, MAX_STEPS = 3;
let physAcc = 0, physAlpha = 1;
let awakeCount = 0, lastDeact = 0;
let last = performance.now(), hudT = 0;
const gov = { acc: 0, n: 0, slow: 0, done: !!(navigator.webdriver) || SAVE.qmode !== 'auto' };
let idleT = 0, skipFrame = false, fpsT = 0;
// ?debug profiler: ms spent per section, averaged (window.__game.PROF)
const PROF = { on: false, t: 0, sec: {}, frames: 0, worst: 0 };
function prof(name) { if (!PROF.on) return; const n = performance.now(); if (name !== 'frame') PROF.sec[name] = (PROF.sec[name] || 0) + n - PROF.t; else PROF.t0 = n; PROF.t = n; }
function profEnd() { if (!PROF.on) return; PROF.frames++; PROF.worst = Math.max(PROF.worst, performance.now() - PROF.t0); }
function profReport() { const r = {}; for (const [k, v] of Object.entries(PROF.sec)) r[k] = +(v / Math.max(1, PROF.frames)).toFixed(2); r.frames = PROF.frames; r.worst = +PROF.worst.toFixed(1); return r; }
function profReset() { PROF.sec = {}; PROF.frames = 0; PROF.worst = 0; }
document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });
function tick(now) {
  if (document.hidden) { requestAnimationFrame(tick); return; }
  const rawDt = Math.min(.05, (now - last) / 1000); last = now;
  fpsAvg = fpsAvg ? fpsAvg * .95 + (1 / Math.max(rawDt, .001)) * .05 : 60; perfFrame(rawDt);
  if (DEBUG && (fpsT = (fpsT || 0) + rawDt) > .5) { fpsT = 0; $('fps').textContent = `${Math.round(fpsAvg)} fps · ${P.activeCount} awake · ${objs.length} obj · ${P.mode} physics · ${bonds.size} bonds`; }
  if (screen !== 'game') cam.tTheta += rawDt * .07;
  if (replay) {
    physAlpha = 1;   // replays place bodies directly: draw exactly what they set
    updateReplay(rawDt); updateParticles(rawDt * .55);
    if (flashT > 0) { flashT = Math.max(0, flashT - rawDt * 1.8); const s = 1 + (1 - flashT) * 4; flashMesh.scale.setScalar(s); flashMesh.material.opacity = flashT * .75; if (!flashT) flashMesh.visible = false; }
    flash.intensity *= Math.pow(.02, rawDt); applyCamera(rawDt); renderFrame(); requestAnimationFrame(tick); return;
  }
  const dt = paused ? 0 : rawDt * (slow ? .3 : 1) * (simTime < bulletUntil ? .35 : 1);
  prof('frame'); preActivate(); dominoAssist(); dustBudget = SAVE.quality === 'high' ? 14 : SAVE.quality === 'lite' ? 3 : 6;
  let n = 0, applied = 0;
  if (dt > 0) {
    physAcc += dt;
    while (physAcc >= STEP - 1e-7 && n < MAX_STEPS) { physAcc -= STEP; n++; }
    if (physAcc > STEP) physAcc = STEP * .999;   // overloaded: let the simulation fall behind rather than spiral
  }
  updateFields(n * STEP); prof('pre');
  if (dt > 0) {
    applied = P.advance(n, STEP, onHit);
    physAlpha = physAcc / STEP;
    if (!applied) for (const pb of P.awake()) if (pb.userData) pb.userData.mdirty = true;   // no new poses this frame: still re-blend
  }
  // game time follows the physics actually simulated, so fuses, debris lifetimes and breakage stay in step with
  // the blocks even when physics (in a worker, or on a busy phone) falls behind the screen
  simTime += applied * STEP; prof('physics');
  if (applied) processFractures();
  updateFire(); engTick(); prof('fx-logic');
  // events
  if (pendingBreak.size) { const l = [...pendingBreak]; pendingBreak.clear(); l.forEach(o => o.tnt ? explode(o, 1.15) : shatter(o)); }
  for (const o of objs) {
    if (o.gone || o.type !== 'proj') continue;
    if (arsenalTick(o)) continue;
    const age = simTime - o.born, due = o.fuse && simTime >= o.fuse;
    if (o.cluster && (due || age > .9)) { splitCluster(o); continue; }
    if (o.hole && (due || age > 1.8)) { spawnHole(o); continue; }
    if (o.bomb && (due || age > (o.life || (o.rocket ? 3.5 : 4.5)))) explode(o, o.power || 1);
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
  prof('objects'); recordFrame(); prof('replay-rec');
  if (objsRemoved) { objsRemoved = false; objs = objs.filter(o => !o.gone || o.home); }
  let moved = false; for (const b of batches.values()) if (b.sync()) moved = true;
  if (moved || P.activeCount || AFX.length || fields.length) shadowDirty = 2; prof('instances');
  if (simTime - lastDeact > 1) { lastDeact = simTime; if (!P.activeCount) deactivateResting(); else deactivateCalm(); }
  awakeCount = P.activeCount; P.setIterations(bonds.size ? (awakeCount > 2500 ? 3 : awakeCount > 800 ? 4 : 6) : awakeCount > 1500 ? 2 : awakeCount > 500 ? 3 : 4);
  if (flashT > 0) { flashT = Math.max(0, flashT - rawDt * 3.2); const s = 1 + (1 - flashT) * 4; flashMesh.scale.setScalar(s); flashMesh.material.opacity = flashT * .75; if (!flashT) flashMesh.visible = false; }
  flash.intensity *= Math.pow(.004, rawDt);
  prof('deact'); updateParticles(dt); prof('particles');
  updateShock(rawDt); checkLevelEnd(); prof('level');
  updateBonds(rawDt); prof('bonds'); updateFollow(); applyCamera(rawDt);
  updateAim(); prof('camera');
  grid.visible = mode === 'build';
  // nothing moving for a while: draw every other frame to save battery and heat
  const moving = P.activeCount || parts.length || smokes.length || aim || drag || pinch || AFX.length || screen !== 'game' || cam.tTarget ||
    Math.abs(cam.theta - cam.tTheta) > .001 || Math.abs(cam.r - cam.tR) > .01 || Math.abs(cam.el - cam.tEl) > .001;
  idleT = moving ? 0 : idleT + rawDt;
  if (idleT > 1.5 && (skipFrame = !skipFrame)) { if (now - hudT > 200) { hudT = now; updateHud(); } requestAnimationFrame(tick); return; }
  if (!PROF.noRender) renderFrame(); prof('render');
  if (now - hudT > 200) { hudT = now; updateHud(); prof('hud'); }
  profEnd();
  // performance governor (Auto only): if frames stay under ~30 fps, step down one tier (High → Balanced → Light), never up
  gov.acc += rawDt; gov.n++;
  if (gov.acc > 3) { const avg = gov.acc / gov.n; gov.acc = 0; gov.n = 0;
    if (avg > .034 && SAVE.quality !== 'lite' && !gov.done && !replay && screen === 'game') {
      gov.slow++;
      if (gov.slow >= (SAVE.quality === 'high' ? 2 : 3)) {
        gov.slow = 0; SAVE.quality = SAVE.quality === 'high' ? 'low' : 'lite'; persist(); applyQuality();
        toast(SAVE.quality === 'lite' ? '⚡ Switched to Light graphics to keep things smooth' : '⚡ Switched to Balanced graphics to keep things smooth');
      }
    } else gov.slow = 0; }
  requestAnimationFrame(tick);
}

