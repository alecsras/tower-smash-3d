// ================= first run: intro cards, name, the Training Yard =================
const INTRO = [
  { art: '🏗️', title: 'Build anything', text: 'Stack blocks, draw whole walls, drop in castles — or describe a building and let the AI make it.' },
  { art: '💥', title: 'Smash it to bits', text: '43 weapons with real physics, from a baseball to a black hole. Every block falls on its own.' },
  { art: '🏆', title: 'Beat the levels', text: 'Pop the green Blorbs hiding in each build, earn stars and coins, and challenge your friends.' }
];
let introI = 0;
function startIntro() { introI = 0; showScreen('intro'); renderIntro(); }
function renderIntro() {
  const C = $('introCard');
  if (introI < INTRO.length) {
    const c = INTRO[introI];
    C.innerHTML = `<div class="art">${c.art}</div><h2>${c.title}</h2><p>${c.text}</p><div class="dots">${INTRO.map((_, i) => `<i class="${i === introI ? 'on' : ''}"></i>`).join('')}<i></i></div><div class="row"></div>`;
    const row = C.querySelector('.row');
    row.appendChild(mkBtn(null, 'Skip', () => { introI = INTRO.length; renderIntro(); }, { cls: 'btn ghost' }));
    row.appendChild(mkBtn(null, 'Next', () => { introI++; renderIntro(); }, { cls: 'btn primary' }));
  } else {
    C.innerHTML = `<div class="art">🙂</div><h2>What should we call you?</h2><p>Your name shows up on duels you send to friends.</p><input class="field" id="introName" maxlength="16" placeholder="Your name" value="${(SAVE.name || '').replace(/"/g, '&quot;')}" style="margin-bottom:16px"><div class="row"></div>`;
    const row = C.querySelector('.row'), go = () => { SAVE.name = ($('introName').value || '').trim().slice(0, 16); SAVE.onboarded = true; persist(); startTraining(); };
    row.appendChild(mkBtn(null, 'Skip', () => { $('introName').value = ''; go(); }, { cls: 'btn ghost' }));
    row.appendChild(mkBtn(null, 'Let’s go', go, { cls: 'btn primary' }));
    C.querySelector('input').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  // swipe between cards
  C.ontouchstart = e => { C._x = e.touches[0].clientX; };
  C.ontouchend = e => { const dx = e.changedTouches[0].clientX - (C._x || 0); if (Math.abs(dx) < 50 || introI >= INTRO.length) return; introI = clamp(introI + (dx < 0 ? 1 : -1), 0, INTRO.length); renderIntro(); };
}

// ---- Training Yard: part 1 smash (a real level), part 2 build, fuse and smash your own wall ----
let training = false;
function trainingDef() {
  return { title: 'Training Yard', short: 'Training', goal: 'blorb', ammo: [['ball', 1, 4], ['bomb', 1, 2]], training: true,
    setup: () => {
      setArena(10);
      for (const p of genStructure(cfg({ shape: 'solid', w: 3, l: 3, h: 4, mat: 'wood' }))) put(p.spec, p.x, p.y, p.z, p.rot);
      for (const p of genStructure(cfg({ shape: 'solid', w: 1, l: 1, h: 3, mat: 'glass', x: 4, z: 1 }))) put(p.spec, p.x, p.y, p.z, p.rot);
      spawnBlorb(0, 4 * LAY, 0); spawnBlorb(4, 3 * LAY, 1);
      cam.tR = 17; cam.target.set(1, 2, 0); cam.tEl = .32;
    },
    onResult: r => r.win
      ? { msg: 'You popped them all! Now build something of your own.', extra: { label: 'Next: build your own ›', onclick: () => { $('result').classList.remove('open'); startTrainingBuild(); } }, back: () => goHome() }
      : { msg: 'Close! Aim right at the green Blorbs.', back: () => goHome() } };
}
function startTraining() {
  training = true; logAct('training start');
  startChallenge(trainingDef());
  setTimeout(() => runCoach([
    { id: 'shoot', text: 'Press on the wooden tower and let go to throw a baseball. Hold longer for a faster throw.' },
    { id: 'pick:bomb', text: 'Great shot! Now tap the Bomb in the tray at the bottom.', glow: '#tray .item:last-child' },
    { id: 'shoot', text: 'Throw the bomb at any Blorb that’s still standing.' }
  ], null), 700);
}
function startTrainingBuild() {
  training = true; chal = null; sceneIsFree = false; document.body.classList.remove('inlevel');
  clearFields(); clearAll(); setArena(10); setMode('build'); snapshot = null; dirty = true;
  cam.tR = 20; cam.target.set(0, 1.5, 0); cam.tEl = .45;
  runCoach([
    { id: 'place', mode: 'build', text: 'Tap the sand to place a block.', setup() { setTool('place'); } },
    { id: 'line', mode: 'build', text: 'Now drag across the sand — the Line tool builds a whole wall when you let go.', setup() { setTool('line'); toolH = 3; renderToolbar(); } },
    { id: 'fuse', mode: 'build', text: 'Welds make walls strong. Swipe across your wall to fuse the blocks together.', setup() { bondMode = 'weld'; setTool('fuse'); }, glow: '#toolbar [aria-label="Weld"]' },
    { id: 'throw', text: 'Time to test it. Switch to Smash.', glow: '#mThrow' },
    { id: 'shoot', mode: 'throw', text: 'Smash your wall!', setup() { curProj = 'cannon'; curSize = 2; buildUI(); } }
  ], () => setTimeout(() => finishTraining(false), 2600));
}
function finishTraining(skipped) {
  training = false; endCoach();
  const first = !SAVE.trained; SAVE.trained = true; SAVE.onboarded = true; persist();
  if (first && !skipped) addCoins(100, 'training');
  track(skipped ? 'training_skipped' : 'training_done'); logAct('training ' + (skipped ? 'skipped' : 'done'));
  $('result').classList.remove('open'); chal = null; document.body.classList.remove('inlevel');
  const C = $('introCard'); showScreen('intro');
  C.innerHTML = `<div class="art" style="background:linear-gradient(135deg,#ffe4b8,#ffc56b)">🎓</div><h2>${skipped ? 'Training skipped' : 'Training complete!'}</h2><p>${skipped ? 'You can replay it any time from Settings.' : 'You earned 100 coins. Spend them on new weapons in the Armory.'}</p><div class="row" style="flex-direction:column"></div>`;
  const row = C.querySelector('.row');
  row.appendChild(mkBtn('Trophy', 'Start the campaign', () => { showScreen('game'); startChallenge(campaignDef(0)); }, { cls: 'btn primary big wide' }));
  row.appendChild(mkBtn('Hammer', 'Free play', () => { sceneIsFree = false; enterFreePlay(); }, { cls: 'btn secondary wide' }));
  row.appendChild(mkBtn('Home', 'Home', () => { sceneIsFree = false; showScreen('home'); }, { cls: 'btn ghost wide' }));
}

// ---- What's new: returning players only, once per update ----
const NEWS_ID = 'v0.14.0';
function maybeNews() { if (SAVE.trained && SAVE.seenNews !== NEWS_ID) setTimeout(() => $('news').classList.add('open'), 500); }
