// ================= custom builder =================
// Structures are described by a small command language, e.g.
//   hollow 6x6x30 glass windows 3 floors 5 roof at -8,4
// The form below writes these lines for you; the Blueprint box runs many lines at once.
const CB_SHAPES = { solid: 'Solid', hollow: 'Tower', round: 'Round', pyramid: 'Pyramid', wall: 'Wall', stairs: 'Stairs', slab: 'Slab', dome: 'Dome', sphere: 'Sphere', cone: 'Cone', arch: 'Arch', bridge: 'Bridge', spiral: 'Spiral stairs', gate: 'Gate' };
let cbLastErr = '';
const CB_MATS = ['stone', 'wood', 'glass', 'marble', 'concrete', 'sand', 'gold', 'tnt', 'steel', 'brick', 'ice', 'rubber', 'crystal', 'obsidian', 'striped', 'checker', 'random'];
const CB_SHAPE_WORDS = { dome: 'dome', arch: 'arch', archway: 'arch', sphere: 'sphere', ball: 'sphere', orb: 'sphere', cone: 'cone', bridge: 'bridge', spiral: 'spiral', gate: 'gate', gatehouse: 'gate', solid: 'solid', block: 'solid', cube: 'solid', box: 'solid', hollow: 'hollow', tower: 'hollow', building: 'hollow', house: 'hollow', keep: 'hollow',
  round: 'round', cylinder: 'round', circle: 'round', silo: 'round', pyramid: 'pyramid', wall: 'wall', stairs: 'stairs', staircase: 'stairs', steps: 'stairs', slab: 'slab', deck: 'slab', platform: 'slab' };
const CB_MAX_DIM = 40, CB_MAX_H = 60, CB_MAX_BLOCKS = 12000;
const cbDefault = () => ({ shape: 'hollow', w: 5, l: 5, h: 30, mat: 'stone', x: 0, z: 0, up: 0, thick: 1, windows: 4, floors: 0, crenels: false, roof: true, tnt: false });

function parseCmd(line) {
  const t = ' ' + line.toLowerCase().replace(/[×*]/g, 'x') + ' ', c = cbDefault();
  c.windows = 0; c.roof = false;
  for (const [w, s] of Object.entries(CB_SHAPE_WORDS)) if (new RegExp('\\b' + w + '\\b').test(t)) { c.shape = s; break; }
  if (c.shape === 'wall') { c.w = 15; c.l = 1; c.h = 6; }
  if (c.shape === 'slab') { c.w = 6; c.l = 6; c.h = 1; }
  const D2 = { sphere: [9, 9, 9], dome: [11, 11, 6], cone: [9, 9, 9], arch: [9, 2, 7], bridge: [20, 3, 5], spiral: [7, 7, 20], gate: [15, 2, 9] }[c.shape];
  if (D2) [c.w, c.l, c.h] = D2;
  const one = t.match(/^\s*\w+\s+(\d+)\b(?!\s*[x×w])/) || t.match(/\bsize\s*=?\s*(\d+)/);
  // dimensions: 5x5x30, 5wx5lx30h, 30h x 5w x 5l, 12x6 (length x height for walls) ...
  const U = '\\s*(?:([wlh])(?![a-z]))?'; const dm = t.match(new RegExp('(\\d+)' + U + '\\s*x\\s*(\\d+)' + U + '(?:\\s*x\\s*(\\d+)' + U + ')?'));
  if (dm) {
    const nums = [[+dm[1], dm[2]], [+dm[3], dm[4]]]; if (dm[5]) nums.push([+dm[5], dm[6]]);
    const order = nums.length === 3 ? ['w', 'l', 'h'] : (c.shape === 'pyramid' || c.shape === 'slab' ? ['w', 'l'] : ['w', 'h']);
    const used = new Set(nums.filter(n => n[1]).map(n => n[1]));
    const free = order.filter(k => !used.has(k)).concat(['w', 'l', 'h'].filter(k => !used.has(k) && !order.includes(k)));
    for (const [n, k] of nums) c[k || free.shift()] = n;
    if (nums.length === 2 && ['sphere', 'dome', 'cone', 'spiral'].includes(c.shape)) c.l = c.w;
  } else if (one && ['sphere', 'dome', 'cone', 'spiral'].includes(c.shape)) { c.w = c.l = +one[1]; if (c.shape !== 'dome' && c.shape !== 'spiral') c.h = +one[1]; }
  for (const k of ['w', 'l', 'h']) { const m = t.match(new RegExp('\\b' + k + '(?:idth|ength|eight)?\\s*=?\\s*(\\d+)\\b')); if (m) c[k] = +m[1]; }
  for (const m of CB_MATS) if (new RegExp('\\b' + m + '\\b').test(t.replace(/\btnt core\b/, ''))) { c.mat = m; break; }
  const at = t.match(/(?:\bat\b|@)\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/); if (at) { c.x = +at[1]; c.z = +at[2]; }
  const upm = t.match(/\b(?:up|raise|raised|elevation)\s*=?\s*(\d+)/); if (upm) c.up = clamp(+upm[1], 0, 80);
  const num = (re, dflt) => { const m = t.match(re); return m ? (m[1] ? +m[1] : dflt) : null; };
  const win = num(/\bwindows?\s*=?\s*(\d+)?/, 3); if (win != null) c.windows = win;
  const fl = num(/\bfloors?\s*=?\s*(\d+)?/, 4); if (fl != null) c.floors = fl;
  const th = num(/\b(?:thick|thickness|walls?)\s*=?\s*(\d+)/); if (th != null && th > 0) c.thick = th;
  c.crenels = /\b(battlements?|crenels?|crenellations?)\b/.test(t);
  c.roof = /\b(roof|spire|cone)\b/.test(t) && c.shape !== 'cone';
  const rm = t.match(/\brot(?:ate|ation)?\s*=?\s*(-?\d+)/); if (rm) c.rot = +rm[1];
  c.tnt = /\btnt\s*core\b|\bcore\b/.test(t);
  c.w = clamp(Math.round(c.w), 1, CB_MAX_DIM); c.l = clamp(Math.round(c.l), 1, CB_MAX_DIM); c.h = clamp(Math.round(c.h), 1, CB_MAX_H);
  if (c.shape === 'slab') c.h = clamp(c.h, 1, 3);
  c.thick = clamp(c.thick, 1, Math.max(1, Math.floor(Math.min(c.w, c.l) / 2)));
  return c;
}
function cfgToCmd(c) {
  const parts = [c.shape === 'hollow' ? 'tower' : c.shape, c.shape === 'pyramid' ? `${c.w}x${c.l}` : `${c.w}w x ${c.l}l x ${c.h}h`, c.mat];
  if (c.shape === 'slab') parts[1] = `${c.w}x${c.l}x${c.h}`;
  if (c.thick > 1 && (c.shape === 'hollow' || c.shape === 'round')) parts.push('thick ' + c.thick);
  if (c.windows) parts.push('windows ' + c.windows);
  if (c.floors && (c.shape === 'hollow' || c.shape === 'round')) parts.push('floors ' + c.floors);
  if (c.crenels) parts.push('battlements');
  if (c.roof) parts.push('roof');
  if (c.tnt) parts.push('tnt core');
  if (c.x || c.z) parts.push(`at ${c.x},${c.z}`);
  if (c.up) parts.push('up ' + c.up);
  if (c.rot) parts.push('rot ' + c.rot);
  return parts.join(' ');
}

// returns [{spec, x, y, z, rot}] — y is the bottom of the piece
function genStructure(c) {
  const res = genStructure0(c), dy = (c.up || 0) * LAY;
  if (dy) for (const p of res) p.y += dy;
  return res;
}
function genStructure0(c) {
  if (GEN2[c.shape]) return GEN2[c.shape](c);
  if (c.shape === 'slab') return [{ spec: Bx(DENS[c.mat] ? c.mat : 'stone', c.w * G - .01, c.h, c.l * G - .01), x: c.x, y: 0, z: c.z }];
  const out = [], R = rng(c.w * 73 + c.l * 31 + c.h * 7 + Math.round(c.x * 13 + c.z * 17) + c.shape.length);
  const matAt = (i, j, L) => {
    if (c.mat === 'striped') return L % 2 ? 'wood' : 'stone';
    if (c.mat === 'checker') return (i + j + L) % 2 ? 'marble' : 'stone';
    if (c.mat === 'random') return ['stone', 'wood', 'glass', 'concrete', 'stone'][Math.floor(R() * 5)];
    return c.mat;
  };
  const W = c.w, Lz = c.shape === 'round' || c.shape === 'pyramid' ? c.l : c.l, H = c.h;
  const X = i => c.x + (i - (W - 1) / 2) * G, Z = j => c.z + (j - (Lz - 1) / 2) * G;
  const cube = (m, i, j, y) => out.push({ spec: CUBE(m), x: X(i), y, z: Z(j) });
  // which cells form the footprint of this shape, and which of those are "outer" (for windows)
  let cells = [], interior = [];
  if (c.shape === 'round') {
    const a = W / 2, b = Lz / 2, t = c.thick;
    for (let i = 0; i < W; i++) for (let j = 0; j < Lz; j++) {
      const u = (i + .5 - a) / a, v = (j + .5 - b) / b, d = Math.hypot(u, v);
      const inner = Math.hypot((i + .5 - a) / Math.max(.5, a - t), (j + .5 - b) / Math.max(.5, b - t));
      if (d <= 1.0 && (inner >= 1 || a <= t || b <= t)) cells.push([i, j, d > 1 - 1.2 / Math.min(a, b)]); else if (d <= 1) interior.push([i, j]);
    }
  } else {
    const t = c.shape === 'hollow' ? c.thick : 99;
    for (let i = 0; i < W; i++) for (let j = 0; j < Lz; j++) {
      const edge = i === 0 || j === 0 || i === W - 1 || j === Lz - 1;
      if (i < t || j < t || i >= W - t || j >= Lz - t) cells.push([i, j, edge]); else interior.push([i, j]);
    }
  }
  const isWin = (i, j, L, outer) => c.windows && outer && L % c.windows === c.windows - 1 && L < H - 1 && (i + j) % 2 === 1;
  let y = 0;
  if (c.shape === 'pyramid') {
    for (let L = 0; ; L++) {
      const w = W - 2 * L, l = Lz - 2 * L; if (w <= 0 || l <= 0 || (c.h && L >= Math.max(c.h, 1) && c.h < Math.min(W, Lz))) break;
      for (let i = 0; i < w; i++) for (let j = 0; j < l; j++) {
        const core = c.tnt && L <= 1 && Math.abs(i - (w - 1) / 2) <= 1 && Math.abs(j - (l - 1) / 2) <= 1 && w > 4;
        cube(core ? 'tnt' : (isWin(i, j, L, i === 0 || j === 0 || i === w - 1 || j === l - 1) ? 'glass' : matAt(i, j, L)), i + L, j + L, L * LAY);
      }
    }
    return out;
  }
  if (c.shape === 'stairs') {
    for (let i = 0; i < W; i++) { const hh = Math.max(1, Math.ceil((i + 1) * H / W));
      for (let L = 0; L < hh; L++) for (let j = 0; j < Lz; j++) cube(matAt(i, j, L), i, j, L * LAY); }
    return out;
  }
  // solid / hollow / round / wall: stack layers, with optional timber floors spanning the interior
  if (c.tnt) {
    const core = interior.length ? interior.filter(([i, j]) => Math.abs(i - (W - 1) / 2) <= 1.5 && Math.abs(j - (Lz - 1) / 2) <= 1.5) : [];
    for (const [i, j] of core) cube('tnt', i, j, 0);
  }
  const solidCore = c.tnt && !interior.length ? new Set(cells.filter(([i, j]) => Math.abs(i - (W - 1) / 2) <= 1 && Math.abs(j - (Lz - 1) / 2) <= 1).map(([i, j]) => i + ',' + j)) : null;
  for (let L = 0; L < H; L++) {
    for (const [i, j, outer] of cells) {
      const m = solidCore && L < 2 && solidCore.has(i + ',' + j) ? 'tnt' : isWin(i, j, L, outer) ? 'glass' : matAt(i, j, L);
      cube(m, i, j, y);
    }
    y += LAY;
    if (c.floors && interior.length && (L + 1) % c.floors === 0 && L < H - 1) {
      // one timber beam per row, resting on the walls at both ends
      const rows = new Map();
      for (const [i, j] of cells.concat(interior.map(([i, j]) => [i, j]))) { const r = rows.get(j) || [i, i]; rows.set(j, [Math.min(r[0], i), Math.max(r[1], i)]); }
      for (const [j, [i0, i1]] of rows) { const len = (i1 - i0 + 1) * G - .01; out.push({ spec: Bx('wood', len, .4, 1), x: (X(i0) + X(i1)) / 2, y, z: Z(j) }); }
      y += .404;
    }
  }
  if (c.crenels && !c.roof) for (const [i, j, outer] of cells) if (outer && (i + j) % 2 === 0) cube(c.mat === 'glass' ? 'stone' : matAt(i, j, H), i, j, y);
  if (c.roof) {
    if (c.shape === 'round' || (W <= 7 && Lz <= 7 && Math.abs(W - Lz) <= 1)) {
      const r = Math.max(W, Lz) / 2 + .35; out.push({ spec: Co('roof', r, Math.max(1.4, r * 1.7)), x: c.x, y, z: c.z });
    } else if (W >= Lz) out.push({ spec: We('roof', W * G + .2, Math.max(1, Lz * .45), Lz * G + .4), x: c.x, y, z: c.z });
    else out.push({ spec: We('roof', Lz * G + .2, Math.max(1, W * .45), W * G + .4), x: c.x, y, z: c.z, rot: Math.PI / 2 });
  }
  return out;
}
function pieceAABB(p) {
  const s = p.spec, h = specHeight(s);
  let hx, hz;
  if (s.shape === 'box' || s.shape === 'wedge') { const a = s.d[0] / 2, b = s.d[2] / 2, co = Math.abs(Math.cos(p.rot || 0)), si = Math.abs(Math.sin(p.rot || 0)); hx = a * co + b * si; hz = a * si + b * co; } else hx = hz = s.shape === 'cone' ? s.d[0] : Math.max(s.d[0], s.d[1]);
  return { lowerBound: { x: p.x - hx, y: p.y, z: p.z - hz }, upperBound: { x: p.x + hx, y: p.y + h, z: p.z + hz } };
}
function spaceTaken(pieces) {
  const live = [...P.bodies()].filter(pb => pb.userData && pb.userData.type === 'block').map(pb => pb.getAABB());
  for (const p of pieces) {
    const a = pieceAABB(p), pad = -.06;
    let hit = false;
    forCells(a, 0, k => { if (hit) return; const st = dormant.get(k); if (st) for (const o of st) if (overlap(a, o.aabb, pad)) { hit = true; return; } });
    if (hit) return true;
    for (const b of live) if (overlap(a, b, pad)) return true;
  }
  return false;
}
// ---- the Custom build sheet ----
let cbCfg = cbDefault(), cbPlacing = null, cbClearFirst = false;
const CB_EXAMPLES = [
  ['Twin towers', 'clear\ntower 6x6x34 glass windows 2 floors 6 roof at -6,0\ntower 6x6x34 glass windows 2 floors 6 roof at 6,0\nwall 5x1x2 concrete at 0,0'],
  ['Castle kit', 'clear\nwall 15x1x7 stone battlements at 0,-10\nwall 15x1x7 stone battlements at 0,10\nwall 1x15x7 stone battlements at -10,0\nwall 1x15x7 stone battlements at 10,0\nround 5x5x12 stone windows 4 roof at -10.5,-10.5\nround 5x5x12 stone windows 4 roof at 10.5,-10.5\nround 5x5x12 stone windows 4 roof at -10.5,10.5\nround 5x5x12 stone windows 4 roof at 10.5,10.5\ntower 7x7x16 checker windows 3 floors 4 roof tnt core'],
  ['Mega pyramid', 'clear\npyramid 27x27 sand tnt core'],
  ['Silo farm', 'clear\nround 6x6x18 concrete thick 1 roof at -8,-8\nround 6x6x18 concrete roof at 0,-8\nround 6x6x18 concrete roof at 8,-8\nsolid 20x3x3 wood at 0,0\nstairs 8x3x8 stone at 0,6'],
  ['Ring fortress', 'clear\nkeep: tower 8x8x14 stone windows 3 floors 4 battlements\non keep: dome 8x8x4 marble\naround 0,0 radius 14 count 8: round 4x4x9 brick roof\nmirror x: gate 7x2x6 stone at 7,-14\narray 2x1 spacing 10: arch 5x2x5 marble at 0,14'],
  ['Domes & spheres', 'clear\nsphere 9 glass at -9,0\ndome 11x11x6 marble at 6,0\ncone 7x7x9 brick at 6,10\nspiral 7x7x18 stone at -9,11\nbridge 18x3x6 wood at 0,-12'],
  ['Skyscraper', 'clear\nsolid 12x12x1 concrete\ntower 8x8x50 glass windows 1 floors 5 up 1 roof']
];
function cbChips(parent, items, cur, on) {
  const row = document.createElement('div'); row.className = 'chips';
  for (const [k, label] of items) { const b = document.createElement('button'); b.className = 'chip' + (k === cur ? ' on' : ''); b.textContent = label; b.onclick = () => on(k); row.appendChild(b); }
  parent.appendChild(row); return row;
}
function cbStepper(parent, label, val, min, max, on, step = 1) {
  const w = document.createElement('div'); w.className = 'stp';
  w.innerHTML = `<span>${label}</span><button aria-label="less">−</button><input inputmode="numeric" value="${val}"><button aria-label="more">+</button>`;
  const [minus, plus] = w.querySelectorAll('button'), inp = w.querySelector('input');
  const set = v => { v = clamp(Math.round(+v || 0), min, max); inp.value = v; on(v); };
  minus.onclick = () => set(+inp.value - step); plus.onclick = () => set(+inp.value + step);
  inp.onchange = () => set(inp.value);
  let tmo, iv; const stop = () => { clearTimeout(tmo); clearInterval(iv); };
  for (const [b, d] of [[minus, -step], [plus, step]]) {
    b.onpointerdown = () => { stop(); tmo = setTimeout(() => { iv = setInterval(() => set(+inp.value + d), 80); }, 380); };
    b.onpointerup = b.onpointerleave = b.onpointercancel = stop;
  }
  parent.appendChild(w);
}
function cbLabel(parent, txt) { const h = document.createElement('div'); h.className = 'lab'; h.textContent = txt; parent.appendChild(h); }
function renderCustom() {
  const f = $('cform'), c = cbCfg; f.innerHTML = '';
  const gbtn = mkBtn('Grid3x3', 'Grid designer', openGrid, { cls: 'btn primary gdopen' }); gbtn.insertAdjacentHTML('beforeend', '<small>Draw it from above, set every block’s height and material</small>'); f.appendChild(gbtn);
  renderAI(f);
  cbLabel(f, 'Shape');
  cbChips(f, Object.entries(CB_SHAPES), c.shape, k => {
    c.shape = k;
    if (k === 'wall') { c.l = 1; c.h = Math.min(c.h, 8); c.crenels = true; c.roof = false; }
    if (k === 'pyramid') { c.roof = false; c.l = c.w; c.h = 60; c.floors = 0; c.crenels = false; }
    if (k !== 'pyramid' && c.h > 40 && cbCfg._wasPyr) c.h = 20; c._wasPyr = k === 'pyramid';
    renderCustom();
  });
  cbLabel(f, 'Size  (W × L × H) — or type it: ');
  const quick = document.createElement('input'); quick.className = 'quick'; quick.placeholder = 'e.g. 5x5x30';
  quick.onchange = () => { const p = parseCmd(c.shape + ' ' + quick.value); Object.assign(c, { w: p.w, l: p.l, h: p.h }); renderCustom(); };
  f.lastChild.appendChild(quick);
  const dims = document.createElement('div'); dims.className = 'row3'; f.appendChild(dims);
  cbStepper(dims, 'W', c.w, 1, CB_MAX_DIM, v => { c.w = v; cbUpdate(); });
  cbStepper(dims, 'L', c.l, 1, CB_MAX_DIM, v => { c.l = v; cbUpdate(); });
  if (c.shape !== 'pyramid') cbStepper(dims, 'H', c.h, 1, CB_MAX_H, v => { c.h = v; cbUpdate(); });
  cbLabel(f, 'Material');
  cbChips(f, CB_MATS.map(m => [m, m === 'tnt' ? 'TNT' : m[0].toUpperCase() + m.slice(1)]), c.mat, k => { c.mat = k; renderCustom(); });
  cbLabel(f, 'Extras');
  const ex = [['windows', 'Windows'], ['floors', 'Floors'], ['crenels', 'Battlements'], ['roof', 'Roof / spire'], ['tnt', 'TNT core']]
    .filter(([k]) => !(c.shape === 'pyramid' && ['floors', 'crenels', 'roof'].includes(k)) && !(c.shape === 'stairs' && k !== 'windows'))
    .filter(([k]) => !(k === 'floors' && !['hollow', 'round'].includes(c.shape)));
  const exRow = document.createElement('div'); exRow.className = 'chips'; f.appendChild(exRow);
  for (const [k, label] of ex) {
    const on = !!c[k], b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : ''); b.textContent = (on ? '✓ ' : '') + label;
    b.onclick = () => { c[k] = typeof c[k] === 'number' ? (c[k] ? 0 : (k === 'windows' ? 3 : 4)) : !c[k]; if (k === 'roof' && c.roof) c.crenels = false; if (k === 'crenels' && c.crenels) c.roof = false; renderCustom(); };
    exRow.appendChild(b);
  }
  const opts = document.createElement('div'); opts.className = 'row3'; f.appendChild(opts);
  if (c.windows) cbStepper(opts, 'Window every', c.windows, 1, 10, v => { c.windows = v; cbUpdate(); });
  if (c.floors && ['hollow', 'round'].includes(c.shape)) cbStepper(opts, 'Floor every', c.floors, 1, 20, v => { c.floors = v; cbUpdate(); });
  if (['hollow', 'round'].includes(c.shape)) cbStepper(opts, 'Wall thickness', c.thick, 1, 6, v => { c.thick = v; cbUpdate(); });
  cbLabel(f, 'Position (center of the pad is 0,0)');
  const pos = document.createElement('div'); pos.className = 'row3'; f.appendChild(pos);
  cbStepper(pos, 'X', c.x, -30, 30, v => { c.x = v; cbUpdate(); });
  cbStepper(pos, 'Z', c.z, -30, 30, v => { c.z = v; cbUpdate(); });
  cbStepper(pos, 'Raise', c.up, 0, 60, v => { c.up = v; cbUpdate(); });
  const cmd = document.createElement('div'); cmd.className = 'cmd'; cmd.id = 'cbCmd'; f.appendChild(cmd);
  const acts = document.createElement('div'); acts.className = 'acts'; f.appendChild(acts);
  acts.innerHTML = `<label class="chk"><input type="checkbox" id="cbClear"${cbClearFirst ? ' checked' : ''}> Clear first</label>
    <button class="b2" id="cbTap">📍 Tap to place</button><button class="b1" id="cbBuild">Build</button>`;
  $('cbClear').onchange = e => cbClearFirst = e.target.checked;
  $('cbBuild').onclick = () => { if (runBlueprint([cfgToCmd(c)], { replace: $('cbClear').checked })) closeCustom(); };
  $('cbTap').onclick = () => { cbPlacing = { ...c }; closeCustom(); toast('Tap the ground where it should go'); };
  const addLine = document.createElement('button'); addLine.className = 'b2 wide'; addLine.textContent = '＋ Add this to the blueprint below';
  addLine.onclick = () => { const ta = $('cbBp'); ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + cfgToCmd(c); };
  f.appendChild(addLine);
  // blueprint
  cbLabel(f, 'Blueprint — one structure per line, builds them all together');
  const ta = document.createElement('textarea'); ta.id = 'cbBp'; ta.rows = 5; ta.spellcheck = false; ta.value = cbBlueprint;
  ta.placeholder = 'tower 6x6x30 stone windows 3 roof at -8,0\nwall 15x1x6 stone battlements at 0,0\nround 5x5x12 glass roof at 8,0';
  ta.oninput = () => cbBlueprint = ta.value; f.appendChild(ta);
  const exr = document.createElement('div'); exr.className = 'chips'; f.appendChild(exr);
  for (const [n, txt] of CB_EXAMPLES) { const b = document.createElement('button'); b.className = 'chip ex'; b.textContent = '✨ ' + n; b.onclick = () => { ta.value = cbBlueprint = txt; cbUpdate(); }; exr.appendChild(b); }
  const bpActs = document.createElement('div'); bpActs.className = 'acts'; f.appendChild(bpActs);
  bpActs.innerHTML = `<span id="bpCount" class="cnt"></span><button class="b1" id="cbRun">Build blueprint</button>`;
  $('cbRun').onclick = () => { if (runBlueprint($('cbBp').value.split('\n'), { replace: $('cbClear').checked })) closeCustom(); };
  ta.addEventListener('input', cbUpdate);
  const help = document.createElement('details'); help.className = 'help';
  help.innerHTML = `<summary>Command cheat-sheet</summary><p><b>Shapes:</b> solid, tower (hollow), round, pyramid, wall, stairs<br><b>Size:</b> <code>5x5x30</code> or <code>5w x 5l x 30h</code> (max ${CB_MAX_DIM}×${CB_MAX_DIM}×${CB_MAX_H})<br><b>Materials:</b> ${CB_MATS.join(', ')}<br><b>Extras:</b> <code>windows 3</code> · <code>floors 5</code> · <code>thick 2</code> · <code>battlements</code> · <code>roof</code> · <code>tnt core</code><br><b>Where:</b> <code>at -8,4</code> (x,z from the center) · <code>up 3</code> starts it 3 blocks up, to stack on another structure<br><b>More shapes:</b> dome, sphere, cone, arch, gate, bridge, spiral (stairs) · <code>rot 45</code> turns a structure<br><b>Names &amp; stacking:</b> <code>keep: tower 8x8x14 stone</code> then <code>on keep: dome 8x8x4 marble</code><br><b>Copies:</b> <code>array 3x2 spacing 8: …</code> · <code>around 0,0 radius 12 count 8: …</code> · <code>mirror x: …</code> (x, z or xz)<br><b>clear</b> on its own line empties the pad first.<br>Up to ${CB_MAX_BLOCKS.toLocaleString()} blocks total.</p>`;
  f.appendChild(help);
  cbUpdate();
}
let cbBlueprint = '';
function cbUpdate() {
  const el = $('cbCmd'); if (!el) return;
  const n = genStructure(cbCfg).length;
  el.innerHTML = `<code>${cfgToCmd(cbCfg)}</code><b>${n.toLocaleString()} blocks</b>`;
  const ta = $('cbBp'); if (ta) {
    const C = compileBlueprint(ta.value.split('\n')), tot = C.structs.reduce((n, a) => n + a.length, 0), el2 = $('bpCount');
    el2.classList.toggle('bad', !!C.err || tot > CB_MAX_BLOCKS);
    el2.textContent = C.err ? '⚠️ ' + C.err : C.structs.length ? `${C.structs.length} structure${C.structs.length > 1 ? 's' : ''} · ${tot.toLocaleString()} blocks${tot > CB_MAX_BLOCKS ? ' — too many' : ''}` : '';
  }
}
function openCustom() { openLibrary('create'); }
function closeCustom() { closeLibrary(); }
$('customX').onclick = closeCustom;
$('custom').addEventListener('click', e => { if (e.target.id === 'custom') closeCustom(); });
// tap-to-place: called from the build-mode tap handler
function cbTryPlace(sx, sy) {
  if (!cbPlacing) return false;
  ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...pickables(), pad, groundMesh], false);
  if (!hits.length) return true;
  const c = cbPlacing; c.x = Math.round(hits[0].point.x); c.z = Math.round(hits[0].point.z);
  if (runBlueprint([cfgToCmd(c)])) { cbPlacing = null; cbCfg.x = c.x; cbCfg.z = c.z; }
  return true;
}

