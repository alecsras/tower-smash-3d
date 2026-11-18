// ================= camera modes (follow, free) + guided tutorial =================
let followOn = !!SAVE.follow, freeCam = false, follow = null, homeTarget = null;
function setFollow(on) { followOn = on; SAVE.follow = on; persist(); $('camFollow').classList.toggle('on', on); toast(on ? '🎥 Follow cam on — the camera chases your shots' : 'Follow cam off'); }
function setFree(on) { freeCam = on; $('camFree').classList.toggle('on', on); toast(on ? '🕹️ Free camera — drag to slide around, pinch to zoom, two fingers to turn' : 'Free camera off'); }
$('camFit').onclick = () => { follow = null; homeTarget = null; fitView(); };
$('camFollow').onclick = () => setFollow(!followOn); $('camFollow').classList.toggle('on', followOn);
$('camFree').onclick = () => setFree(!freeCam);
// called after anything is launched / blows up
function followShot(o) { if (!followOn || mode !== 'throw' || replay) return; if (!homeTarget) homeTarget = cam.target.clone(); follow = { o, t0: simTime, until: simTime + 3.2 }; }
function followBoom(c) { if (!followOn || mode !== 'throw' || replay || !homeTarget) return; follow = { p: new THREE.Vector3(c.x, Math.max(1.5, c.y), c.z), t0: simTime, until: simTime + 1.6 }; }
function updateFollow() {
  if (!follow) { if (homeTarget && !cam.tTarget) { cam.tTarget = homeTarget; homeTarget = null; } return; }
  if (simTime > follow.until || (follow.o && follow.o.gone && !follow.p)) { follow = null; return; }
  const p = follow.o && !follow.o.gone ? follow.o.body.position : follow.p; if (!p) { follow = null; return; }
  const want = new THREE.Vector3(p.x, clamp(p.y, 1.5, 30), p.z), h = homeTarget || cam.target;
  cam.tTarget = h.clone().lerp(want, .65);
}
// slide the camera across the ground (free cam drag)
function panCam(dx, dy) {
  const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(), f = new THREE.Vector3(); camera.getWorldDirection(f); f.setY(0).normalize();
  const k = cam.r / 420; cam.target.addScaledVector(r, -dx * k).addScaledVector(f, dy * k);
  cam.target.x = clamp(cam.target.x, -40, 40); cam.target.z = clamp(cam.target.z, -40, 40); cam.tTarget = null; homeTarget = null;
}

// ---- coach marks: a guided list of steps, each waiting for the player to do it ----
// steps: [{id, text, mode?, setup?, glow?}] ; coach(id) advances when the matching action happens
let TUT = [], tutStep = -1, tutDone = null;
function runCoach(steps, onDone) { TUT = steps; tutStep = 0; tutDone = onDone; showCoach(); }
function showCoach() {
  document.querySelectorAll('.glowhint').forEach(e => e.classList.remove('glowhint'));
  const s = TUT[tutStep]; if (!s) { $('coach').classList.remove('show'); return; }
  if (s.mode && mode !== s.mode) setMode(s.mode);
  if (s.setup) s.setup();
  hintDone.build = hintDone.throw = true; $('hint').style.opacity = 0;
  $('coachTxt').textContent = `${s.text}  (${tutStep + 1}/${TUT.length})`; $('coachSkip').textContent = 'Skip';
  $('coach').classList.remove('tip'); $('coach').classList.add('show');
  if (s.glow) setTimeout(() => { const el = document.querySelector(s.glow); if (el) el.classList.add('glowhint'); }, 60);
}
function coach(ev) {
  if (tutStep < 0 || !TUT[tutStep] || TUT[tutStep].id !== ev) return;
  snd.ding(); tutStep++; logAct('coach ' + ev);
  if (tutStep >= TUT.length) { const d = tutDone; endCoach(); if (d) d(); return; }
  setTimeout(showCoach, 450);
}
function endCoach() {
  tutStep = -1; TUT = []; tutDone = null; $('coach').classList.remove('show', 'tip');
  document.querySelectorAll('.glowhint').forEach(e => e.classList.remove('glowhint'));
}
$('coachSkip').onclick = () => {
  if ($('coach').classList.contains('tip')) { $('coach').classList.remove('show', 'tip'); return; }
  const skipTraining = training; endCoach(); if (skipTraining) finishTraining(true);
};
