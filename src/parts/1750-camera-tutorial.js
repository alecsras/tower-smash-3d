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

// ---- tutorial: a short coached tour, each step waits for the player to do it ----
const TUT = [
  { id: 'place', mode: 'build', text: '👆 Tap the sandy pad to stack a block', setup() { setTool('place'); } },
  { id: 'line', mode: 'build', text: '📏 Now drag across the pad with the Line tool — release to build a whole wall', setup() { setTool('line'); toolH = 2; renderToolbar(); }, glow: '#toolbar .tl.on' },
  { id: 'prefab', mode: 'build', text: '🧩 Open Prefabs and drop something on the pad', glow: '#toolbar .tl:first-child' },
  { id: 'throw', mode: null, text: '🎯 Ready? Switch to Throw at the top', glow: '#mThrow' },
  { id: 'shoot', mode: 'throw', text: '💥 Press and hold where you want to hit — longer = faster. Let go to throw!' },
  { id: 'arsenal', mode: 'throw', text: '🧨 Try a weapon type — tap Explosive, Elemental or Exotic above the tray', glow: '#cats button:nth-child(5)' }
];
let tutStep = -1;
function startTutorial() { tutStep = 0; SAVE.tut = false; persist(); showCoach(); }
function showCoach() {
  document.querySelectorAll('.glowhint').forEach(e => e.classList.remove('glowhint'));
  const s = TUT[tutStep]; if (!s) { $('coach').classList.remove('show'); return; }
  if (s.mode && mode !== s.mode) setMode(s.mode);
  if (s.setup) s.setup();
  hintDone.build = hintDone.throw = true; $('hint').style.opacity = 0;
  $('coachTxt').textContent = `${s.text}  (${tutStep + 1}/${TUT.length})`; $('coach').classList.add('show');
  if (s.glow) { const el = document.querySelector(s.glow); if (el) el.classList.add('glowhint'); }
}
function coach(ev) {
  if (tutStep < 0 || !TUT[tutStep] || TUT[tutStep].id !== ev) return;
  snd.ding(); tutStep++;
  if (tutStep >= TUT.length) { endTutorial(true); return; }
  setTimeout(showCoach, 500);
}
function endTutorial(done) {
  tutStep = -1; SAVE.tut = true; persist(); $('coach').classList.remove('show');
  document.querySelectorAll('.glowhint').forEach(e => e.classList.remove('glowhint'));
  if (done) { toast('🎓 You’re a demolition expert now — have fun!'); addCoins(100, 'tutorial'); }
}
$('coachSkip').onclick = () => endTutorial(false);
$('tutBtn').onclick = () => { $('shop').classList.remove('open'); setMode('build'); startTutorial(); };
