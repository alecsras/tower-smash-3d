// ================= HUD / UI =================
function updateHud() {
  const hud = $('hud'), blocks = objs.filter(o => o.type === 'block');
  if (mode === 'build') { const n = blocks.filter(o => !o.gone).length; hud.textContent = duelBuild ? `⚔️ ${duelUsed()} / ${duelBuild.budget} budget` : `🧱 ${n} block${n === 1 ? '' : 's'}`; hud.classList.toggle('over', !!duelBuild && duelUsed() > duelBuild.budget); return; }
  const homes = blocks.filter(o => o.home);
  if (!homes.length) { hud.textContent = chal ? challengeHud() : 'Build a tower first!'; return; }
  let down = 0;
  for (const o of homes) {
    const h = o.home, p = o.body.position, q = o.body.quaternion;
    const dot = Math.abs(q.x * h.q.x + q.y * h.q.y + q.z * h.q.z + q.w * h.q.w);
    if (o.gone || p.distanceTo(h.p) > .6 || 2 * Math.acos(Math.min(1, dot)) > (o.mat === 'domino' ? .22 : .45)) down++;
  }
  const pct = Math.round(down / homes.length * 100);
  comboCheck(down);
  if (chal) { chal.pct = pct; hud.textContent = challengeHud(); return; }
  hud.textContent = `💥 ${down}/${homes.length} toppled · ${pct}%` + (pct === 100 ? ' 🏆' : '');
}
let toastT;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 1700); }
function showHint() {
  $('hint').innerHTML = mode === 'build'
    ? 'Tap to stack blocks · drag to spin the view<br><small>Tap 🏰 for castles, temples & more</small>'
    : 'Tap where you want to hit<br><small>Hold longer = faster throw · two fingers or ◀ ▶ to move the camera</small>';
  $('hint').style.opacity = hintDone[mode] ? 0 : 1;
}
function hideHint(m) { hintDone[m] = true; if (mode === m) $('hint').style.opacity = 0; }

// tray icons (2D canvas)
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const ICOL = { wood: ['#c98a4b', '#8a5626'], stone: ['#9aa2aa', '#5d646c'], glass: ['rgba(160,220,255,.6)', '#4696cd'], tnt: ['#d4302a', '#7a1010'], marble: ['#ece7dc', '#9a958c'], roof: ['#b8472e', '#6e2414'], domino: ['#f6f1e3', '#222'], concrete: ['#b9b9b9', '#7a7a7a'], sand: ['#d9b97c', '#9a7a40'], gold: ['#ffcc4d', '#a07a10'], lacquer: ['#b8342a', '#6a1410'],
  steel: ['#8d97a3', '#3d444c'], brick: ['#b5452e', '#d9cbb4'], ice: ['rgba(190,235,255,.8)', '#5fb4dc'], rubber: ['#ff4fa3', '#a8206a'], crystal: ['#c78bff', '#6a2ab8'], obsidian: ['#2a1d3a', '#0a0510'] };
function iconFor(key, forMode) {
  const c = document.createElement('canvas'); c.width = c.height = 68; const x = c.getContext('2d'); x.translate(34, 34);
  if ((forMode || mode) === 'build') {
    const sp = BLOCKS[key].spec, [f, e] = ICOL[sp.mat]; x.fillStyle = f; x.strokeStyle = e; x.lineWidth = 3;
    if (sp.shape === 'box') {
      const m = Math.max(sp.d[0], sp.d[1]), s = 44 / Math.max(1, m), w = (sp.mat === 'domino' ? sp.d[2] : sp.d[0]) * s, h = sp.d[1] * s;
      rr(x, -w / 2, -h / 2, w, h, 4); x.fill(); x.stroke();
      if (sp.mat === 'tnt') { x.fillStyle = '#f2ead8'; x.fillRect(-w / 2 + 1.5, -7, w - 3, 14); x.fillStyle = '#111'; x.font = 'bold 13px Arial Black,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TNT', 0, 1); }
      if (sp.mat === 'domino') { x.fillStyle = '#111'; x.fillRect(-w / 2 + 3, -1, w - 6, 2); [[0, -12], [0, 12], [-5, 17], [5, 7]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 2.2, 0, 7); x.fill(); }); }
    } else if (sp.shape === 'cyl') { x.fillRect(-9, -20, 18, 40); x.strokeRect(-9, -20, 18, 40); x.fillRect(-13, -24, 26, 6); x.fillRect(-13, 18, 26, 6); }
    else if (sp.shape === 'cone') { x.beginPath(); x.moveTo(0, -22); x.lineTo(18, 18); x.lineTo(-18, 18); x.closePath(); x.fill(); x.stroke(); }
    else { x.beginPath(); x.moveTo(-26, 12); x.lineTo(26, 12); x.lineTo(14, -12); x.lineTo(-14, -12); x.closePath(); x.fill(); x.stroke(); }
  } else {
    const draw = {
      ball: () => { x.fillStyle = '#fbfaf4'; x.beginPath(); x.arc(0, 0, 17, 0, 7); x.fill(); x.strokeStyle = '#d33'; x.lineWidth = 2.5; x.beginPath(); x.arc(-22, 0, 15, -.8, .8); x.stroke(); x.beginPath(); x.arc(22, 0, 15, 2.34, 3.94); x.stroke(); },
      bowling: () => { const g = x.createRadialGradient(-7, -7, 2, 0, 0, 24); g.addColorStop(0, '#5a6ad8'); g.addColorStop(1, '#1b1f4a'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 24, 0, 7); x.fill(); x.fillStyle = '#0b0d22'; [[4, -8], [10, -4], [7, 3]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 2.6, 0, 7); x.fill(); }); },
      brick: () => { rr(x, -26, -13, 52, 26, 3); x.fillStyle = '#b5452e'; x.fill(); x.strokeStyle = '#7d2a1a'; x.lineWidth = 2.5; x.stroke(); },
      anvil: () => { x.fillStyle = '#3d434b'; x.fillRect(-24, -14, 40, 9); x.beginPath(); x.moveTo(16, -14); x.lineTo(28, -12); x.lineTo(16, -5); x.fill(); x.fillRect(-8, -5, 12, 10); x.fillRect(-16, 5, 28, 9); },
      cannon: () => { const g = x.createRadialGradient(-7, -7, 2, 0, 0, 22); g.addColorStop(0, '#777'); g.addColorStop(1, '#1d1f22'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 21, 0, 7); x.fill(); },
      boulder: () => { x.fillStyle = '#8f8576'; x.strokeStyle = '#5e564b'; x.lineWidth = 2.5; x.beginPath(); [[-24, 6], [-16, -14], [2, -20], [20, -10], [25, 8], [10, 19], [-12, 18]].forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(-16, -14); x.lineTo(2, -20); x.lineTo(-2, -4); x.closePath(); x.fill(); },
      firebomb: () => { x.fillStyle = '#9c1d0e'; x.beginPath(); x.arc(0, 6, 17, 0, 7); x.fill(); x.fillStyle = '#5a3a20'; x.fillRect(-4, -18, 8, 10); x.fillStyle = '#ff9a2e'; x.beginPath(); x.moveTo(-6, -18); x.quadraticCurveTo(0, -34, 6, -18); x.fill(); x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(-6, 0, 4, 0, 7); x.fill(); },
      cluster: () => { x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(0, 2, 17, 0, 7); x.fill(); x.fillStyle = '#ff7a1a'; [[-12, -8], [12, -8], [0, -15], [-14, 8], [14, 8]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 5, 0, 7); x.fill(); }); },
      rocket: () => { x.rotate(-.8); x.fillStyle = '#f2f2f2'; x.fillRect(-7, -16, 14, 30); x.fillStyle = '#d8312a'; x.beginPath(); x.moveTo(-7, -16); x.lineTo(0, -28); x.lineTo(7, -16); x.fill(); x.fillRect(-12, 8, 6, 9); x.fillRect(6, 8, 6, 9); x.fillStyle = '#ffb02e'; x.beginPath(); x.moveTo(-6, 15); x.lineTo(0, 28); x.lineTo(6, 15); x.fill(); },
      meteor: () => { x.strokeStyle = '#ff9a2e'; x.lineWidth = 4; x.lineCap = 'round'; [[-24, -24, -6, -6], [-14, -28, 2, -12], [-28, -12, -12, 2]].forEach(([a, b, c, d]) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }); x.fillStyle = '#5a3a28'; x.beginPath(); x.arc(8, 8, 15, 0, 7); x.fill(); x.fillStyle = '#ff6a1a'; x.beginPath(); x.arc(4, 4, 6, 0, 7); x.fill(); },
      hole: () => { x.strokeStyle = '#b46bff'; x.lineWidth = 5; x.beginPath(); x.ellipse(0, 0, 26, 9, -.3, 0, 7); x.stroke(); x.fillStyle = '#050008'; x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill(); x.strokeStyle = 'rgba(180,107,255,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 16, 0, 7); x.stroke(); },
      nuke: () => { x.fillStyle = '#f2c81e'; x.beginPath(); x.arc(0, 0, 22, 0, 7); x.fill(); x.fillStyle = '#111'; for (let k = 0; k < 3; k++) { const a0 = k * 2.094 - 1.57 - .5; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 17, a0, a0 + 1); x.closePath(); x.fill(); } x.fillStyle = '#f2c81e'; x.beginPath(); x.arc(0, 0, 5, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(0, 0, 3, 0, 7); x.fill(); },
      bomb: () => { x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(0, 4, 19, 0, 7); x.fill(); x.fillStyle = '#444'; x.fillRect(-5, -18, 10, 6); x.strokeStyle = '#c9a46a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, -18); x.quadraticCurveTo(5, -26, 10, -24); x.stroke(); x.fillStyle = '#ffcf3f'; x.beginPath(); x.arc(11, -25, 4, 0, 7); x.fill(); }
    };
    if (draw[key]) draw[key](); else { x.font = '40px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(PROJ[key].emoji || '💥', 0, 3); }
  }
  return c;
}
function buildUI() {
  const tray = $('tray'); tray.innerHTML = '';
  const list = mode === 'build' ? BLOCKS : PROJ, cur = mode === 'build' ? curBlock : curProj;
  const inCat = k => wcat === 'all' || (wcat === 'classic' ? !PROJ[k].special : wcat === 'power' ? PROJ[k].special && !PROJ[k].cat : PROJ[k].cat === wcat);
  const keys = mode === 'build' ? Object.keys(BLOCKS) : chal ? (chal.pool ? Object.keys(PROJ).filter(k => !PROJ[k].special) : chal.ammo.map(a => a.kind)) : Object.keys(PROJ).filter(k => !PROJ[k].hidden && inCat(k));
  const cats = $('cats'); cats.innerHTML = ''; cats.style.display = mode === 'throw' && !chal ? 'flex' : 'none';
  if (mode === 'throw' && !chal) for (const [k, lab] of WCATS) { const b = document.createElement('button'); b.textContent = lab; b.className = k === wcat ? 'on' : ''; b.onclick = () => { wcat = k; const first = Object.keys(PROJ).find(q => !PROJ[q].hidden && inCat(q)); if (first && !inCat(curProj)) curProj = first; buildUI(); $('tray').scrollLeft = 0; }; cats.appendChild(b); }
  for (const key of keys) {
    const am = chal && mode === 'throw' ? chal.ammo.find(a => a.kind === key) : null;
    const locked = mode === 'throw' && isLocked(key), pooled = mode === 'throw' && chal && chal.pool;
    const b = document.createElement('button'); b.className = 'item' + (key === cur ? ' on' : '') + ((am && !am.n) || (pooled && !chal.pool.n) ? ' empty' : '') + (mode === 'throw' && PROJ[key].special ? ' sp' : '') + (locked ? ' locked' : '');
    b.appendChild(iconFor(key)); const l = document.createElement('span'); l.textContent = locked ? `🔒 ${PRICES[key]}` : list[key].label + (am ? ` ×${am.n}` : ''); b.appendChild(l);
    b.onclick = () => { if (locked) { openShop(); return; } if (mode === 'build') curBlock = key; else { curProj = key; if (am) curSize = am.size; } buildUI(); };
    tray.appendChild(b);
  }
  if (mode === 'throw') { const hideSize = (!!chal && !chal.pool) || PROJ[curProj].special; $('sizebar').style.display = hideSize ? 'none' : 'flex'; [...$('sizebar').children].forEach((c, j) => c.classList.toggle('on', j === curSize)); }
  const icons = $('icons'); icons.innerHTML = '';
  const add = (txt, title, fn, on) => { const b = document.createElement('button'); b.className = 'ib' + (on ? ' on' : ''); b.textContent = txt; b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; icons.appendChild(b); };
  if (mode === 'build') {
    add('🏰', 'Famous builds', openMenu);
    add('🎯', 'Frame the build', fitView);
    add('↶', 'Undo', undo);
    add('🗑', 'Clear all', () => { clearAll(); snapshot = null; dirty = true; updateHud(); toast('Cleared'); });
  } else {
    add('🐢', 'Slow motion', () => { slow = !slow; toast(slow ? 'Slow-mo on' : 'Slow-mo off'); buildUI(); }, slow);
    add('↺', 'Rebuild tower', () => chal ? startChallenge(chal.def) : (clearFields(), lastDown = null, rebuild()));
    add('🎯', 'Frame the build', fitView);
    add('🌪', 'Disasters', openDisasters);
  }
  add(muted ? '🔇' : '🔊', 'Sound', () => { muted = !muted; buildUI(); });
}
function setMode(m) {
  mode = m; drag = null; aim = null; pointers.clear();
  $('mBuild').classList.toggle('on', m === 'build'); $('mThrow').classList.toggle('on', m === 'throw');
  if (replay) stopReplay();
  if (m === 'build' && chal) exitChallenge();
  $('duelBtn').style.display = m === 'build' ? 'block' : 'none'; $('replayBtn').classList.remove('show'); $('replayMenu').classList.remove('open');
  if (m === 'throw') { if (dirty || !snapshot) takeSnapshot(); cam.tEl = clamp(cam.tEl, .14, .6); lastDown = null; }
  $('sizebar').style.display = m === 'throw' ? 'flex' : 'none';
  $('levelsBtn').style.display = m === 'throw' ? 'block' : 'none';
  $('customBtn').style.display = m === 'build' ? 'block' : 'none'; if (m !== 'build') cbPlacing = null;
  clearGhost(); renderToolbar(); buildUI(); updateDetonate(); updateHud(); showHint();
}
$('mBuild').onclick = () => setMode('build');
$('customBtn').onclick = openCustom;
$('levelsBtn').onclick = () => openLevels();
$('nightBtn').onclick = () => setNight(!night);
$('mThrow').onclick = () => setMode('throw');
$('rotL').onclick = () => orbit(-Math.PI / 6, 0);
SIZES.forEach(([lab], i) => { const b = document.createElement('button'); b.textContent = lab; b.onclick = () => { curSize = i; [...$('sizebar').children].forEach((c, j) => c.classList.toggle('on', j === i)); }; if (i === curSize) b.classList.add('on'); $('sizebar').appendChild(b); });
$('rotR').onclick = () => orbit(Math.PI / 6, 0);

