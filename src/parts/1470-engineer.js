// ================= engineer challenges (Phase 2, D4) =================
// Build something at least `height` metres tall with at most `budget` blocks, then a disaster tests it.
// Stars come from how much is still standing afterwards.
const ENG = [
  { name: 'Shaky Ground', em: '🌍', test: 'quake', budget: 30, height: 4, stars: [50, 70, 90], tip: 'A wide base rides out the shaking.' },
  { name: 'Wrecking Day', em: '🪨', test: 'wreck', budget: 40, height: 5, stars: [40, 60, 80], tip: 'Three boulders come at it. Thick walls help.' },
  { name: 'Twister Test', em: '🌪️', test: 'tornado', budget: 50, height: 5, stars: [40, 60, 80], tip: 'Heavy materials and fused blocks resist the wind.' },
  { name: 'Aftershock', em: '🌍', test: 'quake', budget: 60, height: 8, stars: [45, 65, 85], tip: 'Taller is harder. Try fusing blocks together.' },
  { name: 'Meteor Shower', em: '☄️', test: 'meteor', budget: 70, height: 5, stars: [35, 55, 75], tip: 'Spread out, or build a roof to take the hits.' },
  { name: 'The Big One', em: '🌋', test: 'quake', budget: 90, height: 12, stars: [40, 60, 80], tip: 'Twelve metres through a full quake. Good luck.' }
];
let eng = null;   // { i, def, phase: 'build' | 'test', until, firing }
const engBudget = () => eng && eng.phase === 'build' ? eng.def.budget : null;
const buildBudget = () => duelBuild ? duelBuild.budget : engBudget();
const engBlocks = () => objs.filter(o => !o.gone && o.type === 'block');
function engTop() { let t = 0; for (const o of engBlocks()) t = Math.max(t, o.body.getAABB().upperBound.y); return +t.toFixed(1); }
function engLock(i) { return i > 0 && !(SAVE.eng[i - 1] > 0) ? 'Get a star on the previous test first' : ''; }

function startEng(i) {
  const d = ENG[i];
  goGame(); closeAllSheets(); paused = false; sceneIsFree = false; exitChallenge(); clearFields();
  setMode('build'); clearAll(); setArena(10);
  eng = { i, def: d, phase: 'build', until: 0, firing: false };
  document.body.classList.add('engbuild'); engButton(); updateHud();
  toast(`${d.em} ${d.name}: build at least ${d.height} m tall with up to ${d.budget} blocks, then tap Test it. ${d.tip}`);
  logAct('engineer ' + d.name); track('engineer_start');
}
function endEng() { eng = null; document.body.classList.remove('engbuild'); const b = $('engTest'); if (b) b.remove(); }
function engButton() {
  let b = $('engTest');
  if (!b) { b = mkBtn('Hammer', 'Test it', engTest, { cls: 'btn primary' }); b.id = 'engTest'; document.body.appendChild(b); }
  b.style.display = eng && eng.phase === 'build' ? '' : 'none';
}
function engTest() {
  if (!eng || eng.phase !== 'build') return;
  const d = eng.def, used = duelUsed(), top = engTop();
  if (used > d.budget) { toast(`Over budget by ${used - d.budget} blocks: remove some first`); return; }
  if (top < d.height) { toast(`Build at least ${d.height} m tall first (now ${top} m)`); return; }
  setMode('throw');   // snapshots the build: every block gets its home position
  eng.phase = 'test'; engButton(); lastDown = null; updateHud();
  if (d.test === 'quake') { startQuake(); eng.until = simTime + 8.5; }
  else if (d.test === 'tornado') { startTornado(); eng.until = simTime + 9; }
  else if (d.test === 'meteor') { startMeteors(new THREE.Vector3(0, 0, 0)); eng.until = simTime + 7; }
  else {   // three boulders from the launch spot at the middle of the build
    eng.until = simTime + 8;
    [.4, 1.9, 3.4].forEach(t => setTimeout(() => {
      if (!eng || eng.phase !== 'test') return;
      eng.firing = true; curProj = 'boulder'; curSize = 2;
      const o = launchOrigin(), tp = new THREE.Vector3(rand(-.6, .6), d.height * .45, 0), { vel } = solveVelocity(o, tp, MIN_SPEED + (MAX_SPEED - MIN_SPEED) * .85);
      throwProj(vel, tp, .85); eng.firing = false;
    }, t * 1000));
  }
  snd.rumble(); logAct('engineer test'); track('engineer_test');
}
// share of the build still standing: a block counts as standing if it hasn't moved or tipped over
function engStanding() {
  const homes = engBlocks().filter(o => o.home), all = objs.filter(o => o.type === 'block' && o.home);
  if (!all.length) return 0;
  let up = 0;
  for (const o of homes) { const p = o.body.position, h = o.home, dot = Math.abs(o.body.quaternion.x * h.q.x + o.body.quaternion.y * h.q.y + o.body.quaternion.z * h.q.z + o.body.quaternion.w * h.q.w);
    if (p.distanceTo(h.p) <= .6 && 2 * Math.acos(Math.min(1, dot)) <= .45) up++; }
  return Math.round(up / all.length * 100);
}
// called every frame from the loop
function engTick() {
  if (!eng || eng.phase !== 'test' || simTime < eng.until) return;
  if ((P.activeCount > 30 || quake || fields.length || meteorQueue.length) && simTime < eng.until + 6) return;
  engFinish();
}
function engFinish() {
  const d = eng.def, i = eng.i, standing = engStanding(), stars = d.stars.filter(s => standing >= s).length;
  eng.phase = 'done';
  const prev = SAVE.eng[i] || 0;
  if (stars > prev) { SAVE.eng[i] = stars; persist(); addCoins((stars - prev) * 25, true); }
  checkUnlocks();
  $('rTitle').textContent = `${d.em} ${d.name}`;
  $('rStars').innerHTML = [0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}" style="animation-delay:${k * .25}s">★</span>`).join('');
  $('rPct').textContent = `${standing}% still standing`;
  $('rMsg').textContent = stars === 3 ? 'Rock solid!' : stars ? `Next star at ${d.stars[stars]}% standing` : `Keep ${d.stars[0]}% standing for a star. ${d.tip}`;
  const next = i < ENG.length - 1 && stars ? i + 1 : null;
  $('rNext').style.display = next != null ? '' : 'none'; $('rNext').onclick = () => startEng(next);
  $('rRetry').onclick = () => {   // back to your build, as it was before the test
    $('result').classList.remove('open'); clearFields(); rebuild(); setMode('build'); eng.phase = 'build'; engButton(); updateHud();
  };
  $('rLevels').textContent = 'Levels'; $('rLevels').onclick = () => { $('result').classList.remove('open'); endEng(); openLevels('eng'); };
  $('rHome').style.display = ''; $('rHome').onclick = () => { $('result').classList.remove('open'); endEng(); goHome(); };
  $('rReplay').style.display = rec.frames.length > 20 ? '' : 'none'; $('rReplay').onclick = () => { $('result').classList.remove('open'); startReplay(false); };
  $('rExtra').style.display = 'none';
  $('result').classList.add('open'); if (stars) snd.ding();
  track(stars ? 'engineer_win' : 'engineer_lose'); logAct(`engineer result ${d.name} ${standing}% ${stars}★`);
}
function engHud() {
  if (!eng) return null;
  if (eng.phase === 'build') return `🛠 ${duelUsed()}/${eng.def.budget} blocks · ${engTop()}/${eng.def.height} m`;
  return `🛠 ${engStanding()}% standing`;
}
function renderEngTab(g) {
  const tot = Object.values(SAVE.eng).reduce((a, b) => a + b, 0);
  g.insertAdjacentHTML('beforeend', `<div class="sect">Build it to survive · ${tot} / ${ENG.length * 3} ★</div>`);
  ENG.forEach((d, i) => {
    const best = SAVE.eng[i] || 0, why = engLock(i);
    const b = document.createElement('button'); b.className = 'card lvl' + (why ? ' locked' : '');
    b.innerHTML = `<span class="em">${why ? '🔒' : d.em}</span><b>${d.name}</b><small>${d.budget} blocks · at least ${d.height} m tall</small><i>${'★'.repeat(best)}${'☆'.repeat(3 - best)}</i>`;
    b.onclick = () => why ? toast(why) : startEng(i);
    g.appendChild(b);
  });
}
