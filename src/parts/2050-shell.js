// ================= app shell: screens, home, pause, settings, help, feedback, crash =================
const BUILD_INFO = typeof __BUILD__ !== 'undefined' ? __BUILD__ : { version: 'dev', build: '0', commit: 'dev', date: '' };
const VERSION_STR = `${BUILD_INFO.version} (${BUILD_INFO.build})`;
const REPO_URL = 'https://github.com/alecsras/tower-smash-3d';
const DEBUG = /[?&#]debug\b/.test(location.search + location.hash);

// ---- activity log: the last 30 things that happened, attached to feedback reports only ----
const ACT = [];
function logAct(t) { ACT.push(`${new Date().toISOString().slice(11, 19)} ${t}`); if (ACT.length > 30) ACT.shift(); }

// ---- screens: title, home, intro sit over the live 3D scene; 'game' shows the HUD ----
let screen = 'game', paused = false, sceneIsFree = true;
function showScreen(name) {
  screen = name;
  for (const id of ['title', 'home', 'intro']) $(id).classList.toggle('on', id === name);
  document.body.classList.toggle('menu', name !== 'game');
  if (name === 'home') renderHome();
  logAct('screen ' + name);
}
function goGame() { if (screen !== 'game') showScreen('game'); }
function goHome() {
  closeAllSheets(); paused = false; endCoach(); training = false; stopPlacing();
  if (chal) { chal = null; $('result').classList.remove('open'); }
  if (duelBuild) duelBuild = null;
  if (sceneIsFree) autosaveFree();
  if (mode !== 'build') setMode('build');
  showScreen('home');
}
function closeAllSheets() { document.querySelectorAll('.msheet.open,#menu.open,#custom.open,#result.open').forEach(e => e.classList.remove('open')); }

// ---- free play keeps its build between visits ----
function autosaveFree() { const d = snapBuild(false); try { if (d) localStorage.setItem('ts_auto', JSON.stringify(d)); } catch (e) {} }
function enterFreePlay() {
  goGame(); closeAllSheets();
  if (!sceneIsFree) {
    chal = null; let d = null; try { d = JSON.parse(localStorage.getItem('ts_auto') || 'null'); } catch (e) {}
    if (d && d.p && d.p.length) { placePieces(snapPieces(d), { replace: true }); placed = []; fitView(); }
    else loadPreset(PRESETS.find(p => p.id === 'castle'));
    sceneIsFree = true;
  }
  setMode('build'); logAct('free play');
}

// ---- dialogs ----
function confirmDlg(title, text, ok = 'OK', { danger = false, cancel = 'Cancel' } = {}) {
  return new Promise(res => {
    $('dlgT').textContent = title; $('dlgP').textContent = text; const row = $('dlgRow'); row.innerHTML = '';
    const close = v => { $('dialog').classList.remove('open'); res(v); };
    if (cancel) row.appendChild(mkBtn(null, cancel, () => close(false), { cls: 'btn ghost' }));
    row.appendChild(mkBtn(null, ok, () => close(true), { cls: 'btn ' + (danger ? 'danger' : 'primary') }));
    $('dialog').classList.add('open');
  });
}

// ---- home ----
function nextCampaignLevel() { for (let n = 0; n < 50; n++) if (!SAVE.camp[n]) return n; return 49; }
function renderHome() {
  $('homeName').textContent = SAVE.name || 'Player';
  $('homeCoins').innerHTML = ico('Coins') + `<span>${SAVE.coins.toLocaleString()}</span>`;
  const n = nextCampaignLevel(), stars = Object.values(SAVE.camp).reduce((a, b) => a + b, 0);
  const c = $('homeContinue');
  c.innerHTML = `<span><span class="big">${stars ? 'Continue' : 'Start the campaign'}</span><small>Level ${n + 1} · ${stars} of 150 stars</small></span><span class="go">${ico('Play', 's24')}</span>`;
  c.onclick = () => { startChallenge(campaignDef(n)); };
  const t = $('homeTiles'); t.innerHTML = '';
  const tile = (icon, color, name, sub, fn, dot) => { const b = document.createElement('button'); b.className = 'tile';
    b.innerHTML = `<span class="ti" style="background:${color}">${ico(icon)}</span><b>${name}</b><small>${sub}</small>${dot ? '<i class="dot"></i>' : ''}`; b.onclick = fn; t.appendChild(b); };
  const daily = SAVE.daily && SAVE.daily[todayKey()];
  tile('Trophy', 'var(--violet)', 'Levels', '50 levels, challenges', () => openLevels('camp'));
  tile('Hammer', 'var(--orange)', 'Free play', 'Build and smash anything', enterFreePlay);
  tile('CalendarDays', 'var(--success)', 'Daily', daily ? 'Done today — come back tomorrow' : 'A new city every day', () => startChallenge(dailyDef()), !daily);
  tile('Swords', 'var(--danger)', 'Duels', 'Build a fortress for a friend', () => { openDuel(); tipOnce('duels', 'Duels: build a fortress on a budget, send the link, and see if your friend can smash it in 3 shots.'); });
  const l = $('homeLinks'); l.innerHTML = '';
  for (const [icon, label, fn] of [['Store', 'Armory', openShop], ['CircleHelp', 'Help', () => openHelp()], ['Sparkles', 'What’s new', () => $('news').classList.add('open')], ['MessageSquare', 'Feedback', () => openFeedback()]]) l.appendChild(mkBtn(icon, label, fn, { cls: '' }));
}

// ---- pause menu ----
function openPause() {
  paused = true; logAct('pause');
  const L = $('pauseList'); L.innerHTML = '';
  const row = (icon, label, fn, cls = '', note = '') => { const b = mkBtn(icon, label, () => { fn(); }, { cls: 'mrow ' + cls }); if (note) b.insertAdjacentHTML('beforeend', `<small>${note}</small>`); L.appendChild(b); return b; };
  row('Play', 'Resume', closePause, 'primary');
  if (chal) { row('RotateCcw', 'Restart level', () => { closePause(); startChallenge(chal.def); }); row('Trophy', 'All levels', () => { closePause(); openLevels(); }); }
  else if (mode === 'throw') row('RotateCcw', 'Rebuild the tower', () => { closePause(); clearFields(); lastDown = null; rebuild(); });
  if (!chal) {
    row('Blocks', 'Build Library', () => { closePause(); if (mode !== 'build') setMode('build'); openLibrary(); });
    row('Tornado', 'Disasters', () => { closePause(); if (mode !== 'throw') setMode('throw'); openDisasters(); });
  }
  const g = document.createElement('div'); g.className = 'mgrid2'; L.appendChild(g);
  const toggle = (icon, label, on, fn) => { const b = mkBtn(icon, label, fn, { cls: 'mrow' }); b.insertAdjacentHTML('beforeend', `<small>${on ? 'On' : 'Off'}</small>`); g.appendChild(b); };
  toggle('Snail', 'Slow motion', slow, () => { slow = !slow; openPause(); });
  toggle('Moon', 'Night', night, () => { setNight(!night); openPause(); });
  toggle(muted ? 'VolumeX' : 'Volume2', 'Sound', !muted, () => { muted = !muted; openPause(); });
  if (rec.frames.length > 20) { const b = mkBtn('Film', 'Replay', () => { closePause(); startReplay(false); }, { cls: 'mrow' }); g.appendChild(b); }
  else { const b = mkBtn('Film', 'Replay', null, { cls: 'mrow' }); b.disabled = true; b.style.opacity = .45; g.appendChild(b); }
  if (mode === 'build' && !chal) row('Trash2', 'Clear the pad', async () => { if (await confirmDlg('Clear the pad?', 'Every block on the pad will be removed. You can undo this.', 'Clear', { danger: true })) { closePause(); clearAll(); snapshot = null; dirty = true; updateHud(); } }, 'danger');
  row('Settings', 'Settings', () => { closePause(); openSettings(); });
  row('CircleHelp', 'Help', () => { closePause(); openHelp(); });
  row('MessageSquare', 'Send feedback', () => { closePause(); openFeedback(); });
  row('Home', duelBuild ? 'Quit to Home (cancels the duel)' : 'Quit to Home', async () => {
    if (duelBuild && !(await confirmDlg('Leave this duel?', 'Your fortress won’t be sent.', 'Leave', { danger: true }))) return;
    goHome();
  });
  $('pause').classList.add('open');
}
function closePause() { $('pause').classList.remove('open'); paused = false; }
$('pauseX').onclick = closePause;
$('pause').addEventListener('click', e => { if (e.target.id === 'pause') closePause(); });

// ---- settings ----
function openSettings() {
  const B = $('settingsBody'); B.innerHTML = '';
  const lab = t => B.insertAdjacentHTML('beforeend', `<div class="lab">${t}</div>`);
  const tog = (id, title, sub, on, fn) => { const l = document.createElement('label'); l.className = 'tog'; l.innerHTML = `<input type="checkbox" id="${id}"${on ? ' checked' : ''}><span><b>${title}</b><small>${sub}</small></span>`; l.querySelector('input').onchange = e => fn(e.target.checked); B.appendChild(l); };
  lab('Sound & feel');
  { const r = document.createElement('div'); r.className = 'setrow'; r.innerHTML = `<b>Volume</b><input type="range" min="0" max="100" value="${Math.round(SAVE.volume * 100)}" aria-label="Sound volume">`;
    r.querySelector('input').oninput = e => { SAVE.volume = e.target.value / 100; muted = SAVE.volume === 0; applyVolume(); }; r.querySelector('input').onchange = () => { persist(); snd.ding(); }; B.appendChild(r); }
  tog('hapChk', 'Vibration', 'Buzz on big hits and explosions (Android only)', SAVE.haptics, v => { SAVE.haptics = v; persist(); if (v) haptic(40); });
  tog('calmChk', 'Reduce motion', 'No screen shake, flashes or bouncy animations', !!SAVE.calm, v => { SAVE.calm = v; persist(); document.body.classList.toggle('calm', v); });
  lab('Graphics');
  { const s = document.createElement('div'); s.className = 'segtabs';
    for (const [k, t] of [['auto', 'Auto'], ['high', 'High'], ['low', 'Light']]) { const b = document.createElement('button'); b.textContent = t; b.className = SAVE.qmode === k ? 'on' : '';
      b.onclick = () => { SAVE.qmode = k; if (k !== 'auto') SAVE.quality = k; else SAVE.quality = matchMedia('(pointer:coarse)').matches ? 'low' : 'high'; gov.done = k !== 'auto'; persist(); applyQuality(); openSettings(); }; s.appendChild(b); }
    B.appendChild(s); B.insertAdjacentHTML('beforeend', '<div class="sub" style="margin:0 2px">Auto starts light on phones and adjusts if the game slows down. High adds glow to fire, explosions and night windows.</div>'); }
  lab('Controls');
  tog('arrowChk', 'Camera arrows', 'Show ◀ ▶ buttons for turning the camera with one hand', SAVE.camArrows, v => { SAVE.camArrows = v; persist(); document.body.classList.toggle('camarrows', v); });
  lab('You');
  { const r = document.createElement('div'); r.className = 'setrow'; r.innerHTML = `<b>Name</b><input class="field" maxlength="16" placeholder="Player" value="${(SAVE.name || '').replace(/"/g, '&quot;')}" aria-label="Your name">`;
    r.querySelector('input').onchange = e => { SAVE.name = e.target.value.trim().slice(0, 16); persist(); const dn = $('duelName'); if (dn) dn.value = SAVE.name; }; B.appendChild(r); }
  B.appendChild(mkBtn('Hand', 'Replay the training', () => { $('settings').classList.remove('open'); startTraining(); }, { cls: 'mrow' }));
  tog('sandboxChk', 'Unlock everything (test option)', 'Every weapon free. Turn off to go back to earning them.', SAVE.sandbox, v => { SAVE.sandbox = v; persist(); buildUI(); });
  lab('Your save');
  const g = document.createElement('div'); g.className = 'mgrid2'; B.appendChild(g);
  g.appendChild(mkBtn('Download', 'Export', async () => { const code = exportSave(); copyText(code);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' })); a.download = `tower-smash-save-${todayKey()}.txt`; a.click();
    toast('Save code copied and downloaded — keep it somewhere safe', 'good'); }, { cls: 'mrow' }));
  g.appendChild(mkBtn('Upload', 'Import', () => { const box = $('importBox'); box.style.display = box.style.display === 'none' ? 'block' : 'none'; }, { cls: 'mrow' }));
  const imp = document.createElement('div'); imp.id = 'importBox'; imp.style.display = 'none'; imp.style.marginTop = '8px';
  imp.innerHTML = '<textarea class="field" placeholder="Paste a save code (starts with TSAVE1.)"></textarea><div style="display:flex;gap:8px;margin-top:8px"><label class="btn secondary" style="flex:1">Choose file<input type="file" accept=".txt,text/plain" hidden></label><button class="btn primary" style="flex:1">Load save</button></div>';
  imp.querySelector('input[type=file]').onchange = async e => { const f = e.target.files[0]; if (f) imp.querySelector('textarea').value = await f.text(); };
  imp.querySelector('.btn.primary').onclick = async () => { const code = imp.querySelector('textarea').value;
    if (!(await confirmDlg('Replace your progress?', 'Your coins, unlocks, stars and saved builds on this device will be replaced by the imported save.', 'Replace', { danger: true }))) return;
    if (importSave(code)) { toast('Save loaded — restarting', 'good'); setTimeout(() => location.reload(), 700); } else toast('That doesn’t look like a Tower Smash save code', 'warn'); };
  B.appendChild(imp);
  B.appendChild(mkBtn('Trash2', 'Reset all progress', async () => {
    if (!(await confirmDlg('Reset everything?', 'Coins, unlocked weapons, stars, saved builds and settings will be deleted from this device. This can’t be undone.', 'Reset', { danger: true }))) return;
    resetProgress(); location.reload(); }, { cls: 'mrow danger' }));
  lab('About');
  B.appendChild(mkBtn('MessageSquare', 'Send feedback', () => { $('settings').classList.remove('open'); openFeedback(); }, { cls: 'mrow' }));
  B.appendChild(mkBtn('Shield', 'Privacy', () => { $('settings').classList.remove('open'); openHelp('about'); }, { cls: 'mrow' }));
  B.insertAdjacentHTML('beforeend', `<div class="sub" style="margin:14px 2px 0;text-align:center">Tower Smash 3D · version ${VERSION_STR} · ${BUILD_INFO.commit}</div>`);
  $('settings').classList.add('open');
}
$('settingsX').onclick = () => $('settings').classList.remove('open');
$('settings').addEventListener('click', e => { if (e.target.id === 'settings') $('settings').classList.remove('open'); });
function haptic(ms) { if (SAVE.haptics && navigator.vibrate && !SAVE.calm) try { navigator.vibrate(ms); } catch (e) {} }

// ---- help center ----
const HELP_TABS = [['basics', 'Basics'], ['weapons', 'Weapons'], ['building', 'Building'], ['blueprints', 'Blueprints'], ['about', 'About & privacy']];
let helpTab = 'basics';
function openHelp(tab) {
  if (tab) helpTab = tab;
  const T = $('helpTabs'); T.innerHTML = '';
  for (const [k, t] of HELP_TABS) { const b = document.createElement('button'); b.textContent = t; b.className = k === helpTab ? 'on' : ''; b.onclick = () => openHelp(k); T.appendChild(b); }
  const B = $('helpBody'); B.innerHTML = '';
  const card = (h, body) => B.insertAdjacentHTML('beforeend', `<div class="helpcard"><h4>${h}</h4>${body}</div>`);
  if (helpTab === 'basics') {
    card('The idea', 'Build towers out of blocks, then smash them with real physics. Every block falls, tumbles and breaks on its own.');
    card('Build', 'Tap the sand to stack a block. Use the tools above the tray to draw lines, boxes and walls, erase, paint, or fuse blocks together so they hold. Tap <b>+ Add</b> for 64 ready-made prefabs, giant castles, or the AI Architect.');
    card('Smash', 'Switch to <b>Smash</b>, then press where you want to hit. Hold longer for a faster throw. Pick weapons from the tray — categories sit just above it. Locked weapons can be bought in the Armory with coins you earn by smashing.');
    card('Levels & Blorbs', 'In levels, green jelly <b>Blorbs</b> hide in each build. Pop them all with the shots you have. Fewer shots used = more stars. Stars and wins pay out coins.');
    card('Duels', 'Build a fortress on a block budget and send the link to a friend. They get 3 shots to smash it, and their score comes back to you in the link they send.');
    card('Controls', '<b>Tap</b> place or throw · <b>Hold</b> charge a throw · <b>Drag</b> turn the camera (Build) · <b>Two fingers</b> turn and zoom · <b>Pinch</b> zoom · the camera button (top right) frames your build or follows your shots.');
  } else if (helpTab === 'weapons') {
    const CAT = { undefined: 'Classic', power: 'Power', kinetic: 'Kinetic', explosive: 'Explosive', elemental: 'Elemental', exotic: 'Exotic', silly: 'Silly' };
    let last = null;
    for (const [k, p] of Object.entries(PROJ)) { if (p.hidden) continue; const cat = p.special ? (p.cat || 'power') : undefined;
      if (CAT[cat] !== last) { last = CAT[cat]; B.insertAdjacentHTML('beforeend', `<div class="lab">${last}</div>`); }
      const r = document.createElement('div'); r.className = 'wrow'; r.appendChild(iconFor(k, 'throw'));
      r.insertAdjacentHTML('beforeend', `<div><b>${p.label}${PRICES[k] ? ` <span class="badge ${SAVE.unlocked[k] || SAVE.sandbox ? 'owned' : 'locked'}">${SAVE.unlocked[k] || SAVE.sandbox ? 'OWNED' : PRICES[k] + ' coins'}</span>` : ''}</b><small>${p.desc || (p.special ? '' : 'Thrown by hand — pick S, M, L or XL for size.')}</small></div>`); B.appendChild(r); }
  } else if (helpTab === 'building') {
    card('Tools', '<b>Place</b> one piece · <b>Line</b>, <b>Box</b>, <b>Walls</b> drag to build many at once, up to 12 layers high (More › Height) · <b>Erase</b> and <b>Paint</b> swipe over blocks · <b>Pick</b> copies a block · <b>Mirror</b> builds both halves at once. Undo and redo cover everything.');
    card('Fuse: making builds hold', 'Choose <b>Fuse</b>, then swipe across blocks. Each one bonds to every block it shares a face with. <b>Glue</b> snaps under a solid hit, <b>Weld</b> is very strong, <b>Anchor</b> bolts ground-level blocks to the ground, and <b>Cut</b> removes bonds. Bonds break when pulled apart, hit hard or caught in a blast.');
    card('Materials', 'Wood burns. Glass, ice and crystal shatter. Steel is heavy and tough. Rubber bounces. Ice slides. TNT explodes when hit or caught in a blast.');
    card('Checking a build', '<b>Test</b> (in More) runs gravity for a few seconds — undo puts everything back. <b>Support</b> adds pillars under anything hanging in the air.');
  } else if (helpTab === 'blueprints') {
    B.insertAdjacentHTML('beforeend', '<div class="sub" style="margin:0 2px 6px">Type one structure per line in Build Library › Create. Tap an example to try it.</div>');
    const ex = [['Basic shapes', 'tower 6x6x20 stone windows 3 roof', 'solid, tower, round, pyramid, wall, stairs, slab'],
      ['Round things', 'dome 11x11x6 marble', 'dome, sphere, cone, arch, gate, bridge, spiral'],
      ['Position and height', 'round 4x4x12 glass at 8,0 up 2', '“at x,z” moves it, “up N” raises it'],
      ['Name and stack', 'keep: tower 8x8x14 stone battlements\non keep: dome 8x8x4 gold', 'name a structure, then build “on” it'],
      ['Copies', 'around 0,0 radius 10 count 6: round 3x3x8 brick roof', 'also: array 3x2 spacing 8: … and mirror x: …'],
      ['Extras', 'tower 8x8x16 concrete floors 4 windows 2 tnt core rot 30', 'windows, floors, thick, battlements, roof, tnt core, rot']];
    for (const [h, code, note] of ex) { const c = document.createElement('div'); c.className = 'helpcard'; c.innerHTML = `<h4>${h}</h4><div style="margin-bottom:8px">${note}</div><code style="display:block;white-space:pre-wrap;padding:8px 10px">${code}</code>`;
      const b = mkBtn('Play', 'Try it', () => { $('help').classList.remove('open'); goGame(); if (chal) { chal = null; } if (mode !== 'build') setMode('build'); runBlueprint(['clear', ...code.split('\n')]); sceneIsFree = true; }, { cls: 'btn secondary' }); b.style.marginTop = '8px'; c.appendChild(b); B.appendChild(c); }
    card('Materials', 'stone wood glass marble concrete sand gold tnt steel brick ice rubber crystal obsidian — or striped, checker, random');
  } else {
    card('Tower Smash 3D', `Version ${VERSION_STR} · ${BUILD_INFO.commit}${BUILD_INFO.date ? ' · built ' + BUILD_INFO.date : ''}<br>This is a test build. Thanks for playing it!`);
    card('Privacy', '<b>Your saves stay on this device.</b> Coins, stars, unlocks and builds are stored in your browser and never uploaded.<br><br><b>AI Architect</b> sends the words you type (or the photo you pick) to Claude to design the build.<br><br><b>Feedback</b> sends only what you choose to send: your note, plus the version, device type and the last few things you did in the game.<br><br>No accounts, no ads, no tracking, no analytics.');
    card('Made with', 'three.js (3D), Rapier (physics), Lucide (icons), Nunito (font). Built with Claude.');
    const b = mkBtn('Github', 'Project on GitHub', () => window.open(REPO_URL, '_blank'), { cls: 'mrow' }); b.style.marginTop = '8px'; B.appendChild(b);
  }
  $('help').classList.add('open'); logAct('help ' + helpTab);
}
$('helpX').onclick = () => $('help').classList.remove('open');
$('help').addEventListener('click', e => { if (e.target.id === 'help') $('help').classList.remove('open'); });

// ---- feedback: builds a report and lets the tester send it however suits them ----
let fbType = 'Bug', lastError = null;
function deviceLine() {
  const ua = navigator.userAgent, os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Win/.test(ua) ? 'Windows' : 'Other';
  const br = /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Other';
  return `${os} · ${br} · ${innerWidth}×${innerHeight} @${devicePixelRatio}x · ${matchMedia('(pointer:coarse)').matches ? 'touch' : 'mouse'}`;
}
function buildReport(note) {
  const ctx = chal ? `level: ${chal.def.title}` : screen !== 'game' ? `screen: ${screen}` : `free play, ${mode === 'build' ? 'Build' : 'Smash'} mode`;
  return [`**${fbType}** — Tower Smash 3D ${VERSION_STR} (${BUILD_INFO.commit})`, '', note || '(no note)', '', '---',
    `Device: ${deviceLine()}`, `Graphics: ${SAVE.quality} (${SAVE.qmode}) · ~${fpsAvg ? Math.round(fpsAvg) : '?'} fps · ${objs.filter(o => !o.gone).length} objects`,
    `Where: ${ctx}`, lastError ? `Error: ${lastError}` : null, '', 'Recent activity:', ...ACT.slice(-20).map(a => '  ' + a)].filter(x => x !== null).join('\n');
}
function openFeedback(prefill) {
  const B = $('fbBody'); B.innerHTML = '';
  B.insertAdjacentHTML('beforeend', '<div class="sub">Found a bug, have an idea, or something felt off? Tell us — the version and your device are added automatically.</div>');
  const chips = document.createElement('div'); chips.className = 'chips';
  for (const t of ['Bug', 'Idea', 'Felt off']) { const c = document.createElement('button'); c.className = 'chip' + (t === fbType ? ' on' : ''); c.textContent = t; c.onclick = () => { fbType = t; [...chips.children].forEach(x => x.classList.toggle('on', x === c)); }; chips.appendChild(c); }
  B.appendChild(chips);
  const ta = document.createElement('textarea'); ta.className = 'field'; ta.style.marginTop = '12px'; ta.placeholder = 'What happened? What did you expect?'; ta.value = prefill || ''; B.appendChild(ta);
  const det = document.createElement('details'); det.style.margin = '10px 2px'; det.innerHTML = '<summary style="font:800 13px var(--font);color:var(--muted);cursor:pointer">What gets sent</summary><pre style="white-space:pre-wrap;font:600 11.5px/1.4 ui-monospace,monospace;color:var(--ink-2);background:#fff;border-radius:12px;padding:10px;max-height:160px;overflow:auto"></pre>';
  det.ontoggle = () => det.querySelector('pre').textContent = buildReport(ta.value); B.appendChild(det);
  const acts = document.createElement('div'); acts.className = 'menulist'; B.appendChild(acts);
  const title = () => `[${fbType}] ${(ta.value.split('\n')[0] || 'Feedback').slice(0, 70)}`;
  acts.appendChild(mkBtn('Github', 'Send on GitHub', () => { const body = buildReport(ta.value).slice(0, 6000);
    window.open(`${REPO_URL}/issues/new?title=${encodeURIComponent(title())}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(fbType === 'Bug' ? 'bug' : 'feedback')}`, '_blank'); logAct('feedback github'); }, { cls: 'mrow primary' }));
  if (navigator.share) acts.appendChild(mkBtn('Share2', 'Send by text or email', () => navigator.share({ title: 'Tower Smash feedback', text: buildReport(ta.value) }).catch(() => {}), { cls: 'mrow' }));
  acts.appendChild(mkBtn('Copy', 'Copy the report', () => copyText(buildReport(ta.value)), { cls: 'mrow' }));
  acts.appendChild(mkBtn('Camera', 'Save a screenshot to attach', () => { renderFrame(); const a = document.createElement('a'); a.href = $('c').toDataURL('image/jpeg', .85); a.download = `tower-smash-${Date.now()}.jpg`; a.click(); }, { cls: 'mrow' }));
  $('feedback').classList.add('open'); logAct('feedback open');
}
$('fbX').onclick = () => $('feedback').classList.remove('open');
$('feedback').addEventListener('click', e => { if (e.target.id === 'feedback') $('feedback').classList.remove('open'); });

// ---- crash screen ----
let crashed = false;
function onCrash(msg) {
  lastError = String(msg).slice(0, 400); logAct('ERROR ' + lastError.slice(0, 80));
  if (crashed || navigator.webdriver) return; crashed = true;
  $('crash').classList.add('on');
}
window.addEventListener('error', e => { if (e.error || e.message) onCrash((e.error && e.error.stack) || e.message); });
window.addEventListener('unhandledrejection', e => { const r = e.reason; if (r && /Abort|NotAllowed/.test(r.name || '')) return; if (r && (r.code === 'rate_limited' || r.code === 'not_granted')) return; onCrash((r && r.stack) || r); });
$('crashReload').onclick = () => location.reload();
$('crashSend').onclick = () => { $('crash').classList.remove('on'); fbType = 'Bug'; openFeedback('The game crashed while I was '); };

// ---- build library: prefabs, mega builds, my builds and create in one sheet ----
const LIB_TABS = [['prefabs', 'Prefabs'], ['mega', 'Mega builds'], ['my', 'My builds'], ['create', 'Create']];
let libTab = 'prefabs';
const libPanels = {};
(function mountLibrary() {
  const body = $('libBody');
  for (const [k] of LIB_TABS) { const d = document.createElement('div'); d.dataset.tab = k; body.appendChild(d); libPanels[k] = d; }
  libPanels.prefabs.append($('pfTabs'), $('pfNameRow'), $('pfGrid'));
  libPanels.mega.append($('mgrid'));
  libPanels.create.append($('cform'));
})();
function openLibrary(tab) {
  if (tab) libTab = tab;
  if (sceneIsFree === false && !chal) sceneIsFree = true;
  const T = $('libTabs'); T.innerHTML = '';
  for (const [k, t] of LIB_TABS) { const b = document.createElement('button'); b.textContent = t; b.className = k === libTab ? 'on' : ''; b.onclick = () => openLibrary(k); T.appendChild(b); }
  for (const [k, d] of Object.entries(libPanels)) d.style.display = (k === libTab || (k === 'prefabs' && libTab === 'my')) ? '' : 'none';
  if (libTab === 'prefabs') { if (pfTab === 'mine' || pfTab === 'slots' || pfTab === 'my') pfTab = 'tower'; renderPrefabs(); $('pfTabs').style.display = ''; }
  else if (libTab === 'my') { pfTab = 'my'; renderPrefabs(); $('pfTabs').style.display = 'none'; }
  else if (libTab === 'mega') renderMega();
  else if (libTab === 'create') { renderCustom(); tipOnce('ai', 'Describe any building — “a lighthouse on a cliff” — and the AI Architect designs it. Or use the shape form and blueprint below.'); }
  $('library').classList.add('open'); tipOnce('library', 'The Build Library: drop in prefabs, load giant builds, keep your own, or create something new.');
  logAct('library ' + libTab);
}
function closeLibrary() { $('library').classList.remove('open'); }
$('libX').onclick = closeLibrary;
$('library').addEventListener('click', e => { if (e.target.id === 'library') closeLibrary(); });

// ---- more build tools (height, mirror, test, support) ----
function openMore() {
  const L = $('moreList'); L.innerHTML = '';
  const add = (icon, label, note, fn, cls = '') => { const b = mkBtn(icon, label, fn, { cls: 'mrow ' + cls }); if (note) b.insertAdjacentHTML('beforeend', `<small>${note}</small>`); L.appendChild(b); };
  add('ArrowUpDown', 'Layer height', `${HEIGHTS[toolH]} high`, () => { toolH = (toolH + 1) % HEIGHTS.length; renderToolbar(); openMore(); });
  add('FlipHorizontal2', 'Mirror', mirrorX ? 'On' : 'Off', () => { mirrorX = !mirrorX; renderToolbar(); openMore(); });
  add('Scale', 'Test gravity', 'Undo puts it back', () => { $('more').classList.remove('open'); testGravity(); });
  add('Construction', 'Add supports', 'Pillars under overhangs', () => { $('more').classList.remove('open'); autoSupport(); });
  add('Trash2', 'Clear the pad', '', async () => { $('more').classList.remove('open'); if (await confirmDlg('Clear the pad?', 'Every block on the pad will be removed. You can undo this.', 'Clear', { danger: true })) { clearAll(); snapshot = null; dirty = true; updateHud(); } }, 'danger');
  $('more').classList.add('open');
}
$('moreX').onclick = () => $('more').classList.remove('open');
$('more').addEventListener('click', e => { if (e.target.id === 'more') $('more').classList.remove('open'); });

// ---- one-time feature tips ----
let tipTimer = null;
function tipOnce(key, text) {
  if (SAVE.tips[key] || tutStep >= 0 || !SAVE.trained || navigator.webdriver) return;
  SAVE.tips[key] = 1; persist();
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { if (tutStep >= 0) return; $('coachTxt').textContent = text; $('coachSkip').textContent = 'Got it'; $('coach').classList.add('show', 'tip'); }, 450);
}

// ---- dock height drives where floating controls sit ----
new ResizeObserver(() => document.documentElement.style.setProperty('--dockH', ($('dock').offsetHeight || 150) + 'px')).observe($('dock'));

// ---- fixed chrome: icons and handlers ----
$('pauseBtn').innerHTML = ico('Menu'); $('pauseBtn').onclick = openPause;
$('homeSettings').innerHTML = ico('Settings'); $('homeSettings').onclick = openSettings;
$('homeCoins').onclick = openShop;
$('mBuild').innerHTML = ico('Hammer') + '<span>Build</span>'; $('mThrow').innerHTML = ico('Bomb') + '<span>Smash</span>';
$('camBtn').innerHTML = ico('Camera');
$('camFit').innerHTML = ico('Focus') + 'Frame the build'; $('camFollow').innerHTML = ico('Video') + 'Follow shots'; $('camFree').innerHTML = ico('Move') + 'Free camera';
$('camBtn').onclick = () => { const o = !$('camBox').classList.contains('open'); $('camBox').classList.toggle('open', o); $('camBtn').setAttribute('aria-expanded', o); };
$('titlePlay').onclick = () => { initAudio(); if (!SAVE.onboarded) startIntro(); else { showScreen('home'); maybeNews(); } };
$('titleVer').textContent = 'Test build ' + VERSION_STR;
document.body.classList.toggle('camarrows', !!SAVE.camArrows);
if (DEBUG) document.body.classList.add('debug');
// Escape / back closes the top-most sheet
addEventListener('keydown', e => { if (e.key !== 'Escape') return; const open = [...document.querySelectorAll('.msheet.open,.dialog.open')].pop(); if (open) { open.classList.remove('open'); if (open.id === 'pause') paused = false; } else if (screen === 'game') openPause(); });
let fpsAvg = 0;
