// ================= Grid designer: draw a build from above, then build it in 3D =================
// Each grid cell is a column of 1×1 cubes. A cell is null (empty) or { h, m, o } where h is the column
// height, m its material and o an optional { layerIndex: material } map that recolours single blocks.
// The bottom edge of the grid is the side that faces you on the pad.

const GD_MATS = ['stone', 'wood', 'brick', 'concrete', 'marble', 'glass', 'steel', 'ice', 'sand', 'gold', 'crystal', 'obsidian', 'rubber', 'tnt'];
const GD_LABEL = { stone: 'Stone', wood: 'Wood', brick: 'Brick', concrete: 'Concrete', marble: 'Marble', glass: 'Glass', steel: 'Steel', ice: 'Ice', sand: 'Sand', gold: 'Gold', crystal: 'Crystal', obsidian: 'Obsidian', rubber: 'Rubber', tnt: 'TNT' };
const GD_COL = { stone: '#9a9ea6', wood: '#a8743c', brick: '#b5523a', concrete: '#b9b9b6', marble: '#ece8e0', glass: '#a9dcf2', steel: '#7f8b99', ice: '#cfeefe', sand: '#d9bb7c', gold: '#f2c23a', crystal: '#c79bff', obsidian: '#3a2950', rubber: '#ff6fb1', tnt: '#d8312a' };
const GD_MAXH = 40, GD_MAXN = 48, GD_CAP = 8000, GD_WARN = 5000;
const GD_TOOLS = [
  ['paint', 'Paintbrush', 'Paint'], ['erase', 'Eraser', 'Erase'], ['rect', 'Square', 'Box'], ['circle', 'Circle', 'Circle'], ['fill', 'PaintBucket', 'Fill'],
  ['raise', 'ArrowBigUp', 'Raise'], ['lower', 'ArrowBigDown', 'Lower'], ['layer', 'Layers', 'Layer'], ['pick', 'Pipette', 'Edit cell']
];
const GD_TIPS = {
  paint: 'Drag to paint columns at the height and material below.', erase: 'Drag to clear cells.',
  rect: 'Drag from corner to corner.', circle: 'Drag from the centre outwards.', fill: 'Tap an area to fill everything connected to it.',
  raise: 'Drag over cells to add one block to each.', lower: 'Drag over cells to take one block off each.',
  layer: 'Recolour one layer: drag to paint the chosen layer with the chosen material — great for stripes and windows.',
  pick: 'Tap a cell to edit its column block by block. Its height and material become your brush too.'
};

const gd = {
  w: 12, l: 12, cells: [], tool: 'paint', h: 6, m: 'stone', layer: 1, mirror: '', filled: false, sel: -1,
  undo: [], redo: [], stroke: null, el: null, cv: null, ctx: null, cs: 1, preview: null
};
const gdIdx = (i, j) => j * gd.w + i;
const gdBlank = (w, l) => Array(w * l).fill(null);
const gdClone = c => c && { h: c.h, m: c.m, o: c.o ? { ...c.o } : undefined };
const gdCount = () => gd.cells.reduce((a, c) => a + (c ? c.h : 0), 0);
const gdMatAt = (c, k) => (c.o && c.o[k]) || c.m;

// ---- persistence: the open draft and up to 24 named designs (ts_* keys travel with save export) ----
const GD_DRAFT = 'ts_grid_draft', GD_LIST = 'ts_grid_designs';
const gdPack = () => ({ w: gd.w, l: gd.l, c: gd.cells.map(c => c ? [c.h, GD_MATS.indexOf(c.m), c.o ? Object.entries(c.o).map(([k, m]) => [+k, GD_MATS.indexOf(m)]) : 0] : 0) });
function gdUnpack(d) {
  if (!d || !d.w || !d.l || !Array.isArray(d.c)) return false;
  gd.w = clamp(d.w | 0, 4, GD_MAXN); gd.l = clamp(d.l | 0, 4, GD_MAXN);
  gd.cells = gdBlank(gd.w, gd.l).map((_, n) => { const e = d.c[n]; if (!e) return null;
    const o = e[2] ? Object.fromEntries(e[2].map(([k, m]) => [k, GD_MATS[m] || 'stone'])) : undefined;
    return { h: clamp(e[0] | 0, 1, GD_MAXH), m: GD_MATS[e[1]] || 'stone', o }; });
  return true;
}
let gdSaveT = 0;
function gdSaveDraft() { clearTimeout(gdSaveT); gdSaveT = setTimeout(() => { try { localStorage.setItem(GD_DRAFT, JSON.stringify(gdPack())); } catch (e) { /* storage full: the draft is a convenience */ } }, 300); }
function gdDesigns() { try { return JSON.parse(localStorage.getItem(GD_LIST) || '[]'); } catch (e) { return []; } }
function gdStoreDesigns(list) { try { localStorage.setItem(GD_LIST, JSON.stringify(list.slice(0, 24))); return true; } catch (e) { toast('Couldn’t save — storage is full. Delete a design to make room.', 'warn'); return false; } }

// ---- editing ----
function gdPush() { gd.undo.push(gdPack()); if (gd.undo.length > 60) gd.undo.shift(); gd.redo.length = 0; }
function gdUndo() { if (!gd.undo.length) return; gd.redo.push(gdPack()); gdUnpack(gd.undo.pop()); gd.sel = -1; gdChanged(true); }
function gdRedo() { if (!gd.redo.length) return; gd.undo.push(gdPack()); gdUnpack(gd.redo.pop()); gd.sel = -1; gdChanged(true); }
function gdMirrors(i, j) {
  const out = [[i, j]], mi = gd.w - 1 - i, mj = gd.l - 1 - j;
  if (gd.mirror.includes('x')) out.push([mi, j]);
  if (gd.mirror.includes('z')) out.push([i, mj]);
  if (gd.mirror === 'xz') out.push([mi, mj]);
  return out;
}
function gdApply(i, j, tool = gd.tool) {
  for (const [a, b] of gdMirrors(i, j)) {
    if (a < 0 || b < 0 || a >= gd.w || b >= gd.l) continue;
    const n = gdIdx(a, b), c = gd.cells[n];
    if (gd.stroke && gd.stroke.seen.has(n)) continue;
    if (gd.stroke) gd.stroke.seen.add(n);
    if (tool === 'paint') gd.cells[n] = { h: gd.h, m: gd.m };
    else if (tool === 'erase') gd.cells[n] = null;
    else if (tool === 'raise') gd.cells[n] = c ? { ...gdClone(c), h: Math.min(GD_MAXH, c.h + 1) } : { h: 1, m: gd.m };
    else if (tool === 'lower') gd.cells[n] = c && c.h > 1 ? { ...gdClone(c), h: c.h - 1 } : null;
    else if (tool === 'layer') { if (c && c.h >= gd.layer) { const d = gdClone(c); d.o = d.o || {}; if (gd.m === d.m) delete d.o[gd.layer - 1]; else d.o[gd.layer - 1] = gd.m; if (!Object.keys(d.o).length) delete d.o; gd.cells[n] = d; } }
  }
}
function gdFill(i, j) {
  const n0 = gdIdx(i, j), c0 = gd.cells[n0], same = c => c0 ? c && c.h === c0.h && c.m === c0.m : !c;
  if (c0 && c0.h === gd.h && c0.m === gd.m) return;
  const st = [[i, j]], seen = new Set();
  while (st.length) { const [a, b] = st.pop(); if (a < 0 || b < 0 || a >= gd.w || b >= gd.l) continue; const n = gdIdx(a, b); if (seen.has(n) || !same(gd.cells[n])) continue; seen.add(n);
    gd.cells[n] = { h: gd.h, m: gd.m }; st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
}
function gdShapeCells(a, b, tool) {   // cells of a box or circle from a to b (inclusive), outline unless "filled"
  const out = [];
  if (tool === 'rect') { const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) if (gd.filled || i === x0 || i === x1 || j === z0 || j === z1) out.push([i, j]); }
  else { const r = Math.hypot(b[0] - a[0], b[1] - a[1]) + .35;
    for (let i = Math.floor(a[0] - r); i <= Math.ceil(a[0] + r); i++) for (let j = Math.floor(a[1] - r); j <= Math.ceil(a[1] + r); j++) {
      const d = Math.hypot(i - a[0], j - a[1]); if (d <= r && (gd.filled || d > r - 1.05 || r < 1.2)) out.push([i, j]); } }
  return out;
}
function gdResize(w, l) {
  w = clamp(w, 4, GD_MAXN); l = clamp(l, 4, GD_MAXN); if (w === gd.w && l === gd.l) return;
  gdPush(); const old = gd.cells, ow = gd.w, ol = gd.l, dx = Math.floor((w - ow) / 2), dz = Math.floor((l - ol) / 2);
  gd.w = w; gd.l = l; gd.cells = gdBlank(w, l);
  for (let i = 0; i < ow; i++) for (let j = 0; j < ol; j++) { const c = old[j * ow + i], a = i + dx, b = j + dz; if (c && a >= 0 && b >= 0 && a < w && b < l) gd.cells[gdIdx(a, b)] = c; }
  gd.sel = -1; gdChanged(true);
}

// ---- the 3D result ----
function gdPieces() {
  const ps = [];
  for (let j = 0; j < gd.l; j++) for (let i = 0; i < gd.w; i++) { const c = gd.cells[gdIdx(i, j)]; if (!c) continue;
    const x = (i - (gd.w - 1) / 2) * G, z = (j - (gd.l - 1) / 2) * G;
    for (let k = 0; k < c.h; k++) ps.push({ spec: CUBE(gdMatAt(c, k)), x, y: k * LAY, z, rot: 0 }); }
  return ps;
}
async function gdBuild() {
  const n = gdCount();
  if (!n) { toast('Paint some cells first'); return; }
  if (n > GD_CAP) { toast(`That’s ${n.toLocaleString()} blocks — the limit is ${GD_CAP.toLocaleString()}. Lower some columns.`, 'warn'); return; }
  const onPad = objs.some(o => !o.gone && o.type === 'block');
  if (onPad && !await confirmDlg('Build your design?', 'It replaces what’s on the pad. You can undo it afterwards.', 'Build it')) return;
  if (chal) exitChallenge();
  closeGrid(false); closeLibrary(); goGame(); sceneIsFree = true; if (mode !== 'build') setMode('build');
  placePieces(gdPieces(), { replace: true });
  const R = Math.max(gd.w, gd.l) * .5 * G, top = gd.cells.reduce((a, c) => Math.max(a, c ? c.h : 0), 0);
  if (cam) { cam.target.set(0, Math.min(top, 20) * .4, 0); cam.r = clamp(R * 2.4 + top * .8, 12, 70); }
  snd.place(); logAct('grid build ' + n); toast(`🧱 Built ${n.toLocaleString()} blocks — tap Smash when you’re ready`);
}

// ---- drawing ----
function gdShade(hex, f) { const v = parseInt(hex.slice(1), 16); let r = v >> 16, g = v >> 8 & 255, b = v & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`; }
function gdDraw() {
  const { cv, ctx } = gd; if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), box = cv.parentElement.clientWidth - 24, maxH = Math.max(200, innerHeight * .46);
  const cs = Math.max(4, Math.min(box / gd.w, maxH / gd.l)), W = cs * gd.w, H = cs * gd.l;   // fit both ways so deep grids stay on screen
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  gd.cs = cs; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#efe9dd'; ctx.fillRect(0, 0, W, H);
  const prev = gd.preview ? new Set(gd.preview.map(([i, j]) => gdIdx(i, j))) : null, layerMode = gd.tool === 'layer';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.max(8, Math.min(14, cs * .42))}px Nunito, system-ui, sans-serif`;
  for (let j = 0; j < gd.l; j++) for (let i = 0; i < gd.w; i++) {
    const n = gdIdx(i, j), c = gd.cells[n], x = i * cs, y = j * cs;
    if (c) {
      const m = layerMode ? (c.h >= gd.layer ? gdMatAt(c, gd.layer - 1) : null) : gdMatAt(c, c.h - 1);
      ctx.fillStyle = m ? gdShade(GD_COL[m], layerMode ? 0 : Math.min(.45, c.h / GD_MAXH * .9) - .12) : '#d8d1c3';
      ctx.fillRect(x + .5, y + .5, cs - 1, cs - 1);
      if (c.o && !layerMode) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x + cs - 4, y + 4, Math.min(2.5, cs * .1), 0, 6.3); ctx.fill(); }
      if (cs >= 13) { const dark = ['marble', 'ice', 'glass', 'sand', 'gold', 'concrete'].includes(m); ctx.fillStyle = dark ? 'rgba(24,38,63,.8)' : 'rgba(255,255,255,.92)'; ctx.fillText(c.h, x + cs / 2, y + cs / 2 + .5); }
    }
    if (prev && prev.has(n)) { ctx.fillStyle = gd.tool === 'erase' ? 'rgba(216,49,42,.35)' : 'rgba(255,122,26,.45)'; ctx.fillRect(x, y, cs, cs); }
  }
  ctx.strokeStyle = 'rgba(24,38,63,.12)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= gd.w; i++) { ctx.moveTo(i * cs + .5, 0); ctx.lineTo(i * cs + .5, H); }
  for (let j = 0; j <= gd.l; j++) { ctx.moveTo(0, j * cs + .5); ctx.lineTo(W, j * cs + .5); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(24,38,63,.3)'; ctx.setLineDash([4, 4]); ctx.beginPath();
  if (gd.mirror.includes('x')) { ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); }
  if (gd.mirror.includes('z')) { ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); }
  ctx.stroke(); ctx.setLineDash([]);
  if (gd.sel >= 0) { const i = gd.sel % gd.w, j = (gd.sel / gd.w) | 0; ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 3; ctx.strokeRect(i * cs + 1.5, j * cs + 1.5, cs - 3, cs - 3); }
}
function gdStats() {
  const n = gdCount(), el = $('gdCount'); if (!el) return;
  el.textContent = `${n.toLocaleString()} blocks`; el.className = n > GD_CAP ? 'bad' : n > GD_WARN ? 'warn' : '';
  el.title = n > GD_CAP ? `Limit is ${GD_CAP.toLocaleString()}` : n > GD_WARN ? 'Big build — smashing may be slow on older phones' : '';
  $('gdUndo').disabled = !gd.undo.length; $('gdRedo').disabled = !gd.redo.length;
}
function gdChanged(full) { gdDraw(); gdStats(); gdSaveDraft(); if (full) gdRenderPanel(); }

// ---- pointer input on the grid ----
function gdCell(e) { const r = gd.cv.getBoundingClientRect(), i = Math.floor((e.clientX - r.left) / gd.cs), j = Math.floor((e.clientY - r.top) / gd.cs); return [clamp(i, 0, gd.w - 1), clamp(j, 0, gd.l - 1), i >= 0 && j >= 0 && i < gd.w && j < gd.l]; }
function gdDown(e) {
  e.preventDefault(); gd.cv.setPointerCapture(e.pointerId);
  const [i, j, inside] = gdCell(e); if (!inside) return;
  if (gd.tool === 'pick') { const n = gdIdx(i, j), c = gd.cells[n]; gd.sel = n; if (c) { gd.h = c.h; gd.m = c.m; } gdDraw(); gdRenderPanel(); return; }
  gdPush();
  if (gd.tool === 'fill') { gdFill(i, j); gdChanged(); gd.stroke = null; return; }
  gd.stroke = { seen: new Set(), last: [i, j], start: [i, j], pid: e.pointerId };
  if (gd.tool === 'rect' || gd.tool === 'circle') { gd.preview = gdShapeCells([i, j], [i, j], gd.tool); gdDraw(); return; }
  gdApply(i, j); gdChanged();
}
function gdMove(e) {
  const s = gd.stroke; if (!s || e.pointerId !== s.pid) return; e.preventDefault();
  const [i, j] = gdCell(e);
  if (gd.tool === 'rect' || gd.tool === 'circle') { gd.preview = gdShapeCells(s.start, [i, j], gd.tool); gdDraw(); return; }
  const [a, b] = s.last, steps = Math.max(Math.abs(i - a), Math.abs(j - b));   // fill the gaps of a fast swipe
  for (let t = 1; t <= steps; t++) gdApply(Math.round(a + (i - a) * t / steps), Math.round(b + (j - b) * t / steps));
  s.last = [i, j]; if (steps) gdChanged();
}
function gdUp(e) {
  const s = gd.stroke; if (!s || e.pointerId !== s.pid) return;
  if (gd.preview) { const cells = gd.preview; gd.preview = null; s.seen = new Set(); for (const [i, j] of cells) gdApply(i, j, 'paint'); gdChanged(); }
  gd.stroke = null;
}

// ---- panel under the grid: tools, brush and the selected-cell editor ----
function gdChip(parent, label, on, fn, cls = '') { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip ' + cls + (on ? ' on' : ''); b.innerHTML = label; b.onclick = fn; parent.appendChild(b); return b; }
function gdSwatches(parent, cur, on) {
  const row = document.createElement('div'); row.className = 'gdmats';
  for (const m of GD_MATS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'gdsw' + (m === cur ? ' on' : ''); b.style.setProperty('--c', GD_COL[m]); b.innerHTML = `<i></i><span>${GD_LABEL[m]}</span>`; b.setAttribute('aria-label', GD_LABEL[m]); b.onclick = () => on(m); row.appendChild(b); }
  parent.appendChild(row);
}
function gdLab(parent, t) { const d = document.createElement('div'); d.className = 'lab'; d.textContent = t; parent.appendChild(d); }
function gdRenderPanel() {
  const P = $('gdPanel'); if (!P) return; P.innerHTML = '';
  const tools = document.createElement('div'); tools.className = 'gdtools';
  for (const [k, ic, label] of GD_TOOLS) { const b = mkBtn(ic, label, () => { gd.tool = k; if (k !== 'pick') gd.sel = -1; gdDraw(); gdRenderPanel(); }, { cls: 'gdtool' + (gd.tool === k ? ' on' : '') }); tools.appendChild(b); }
  P.appendChild(tools);
  const tip = document.createElement('div'); tip.className = 'gdtip'; tip.textContent = GD_TIPS[gd.tool]; P.appendChild(tip);

  const c = gd.sel >= 0 ? gd.cells[gd.sel] : null;
  if (gd.tool === 'pick' && gd.sel >= 0) {   // ----- selected column editor -----
    const box = document.createElement('div'); box.className = 'gdcol'; P.appendChild(box);
    const i = gd.sel % gd.w, j = (gd.sel / gd.w) | 0;
    gdLab(box, `Cell ${i + 1}, ${j + 1}` + (c ? ` — ${c.h} high` : ' — empty'));
    const edit = fn => { gdPush(); const d = gd.cells[gd.sel] ? gdClone(gd.cells[gd.sel]) : { h: 1, m: gd.m }; fn(d); gd.cells[gd.sel] = d && d.h > 0 ? d : null; gdChanged(true); };
    const row = document.createElement('div'); row.className = 'gdrow'; box.appendChild(row);
    cbStepper(row, 'Height', c ? c.h : 0, 0, GD_MAXH, v => edit(d => { d.h = v; if (d.o) for (const k in d.o) if (+k >= v) delete d.o[k]; }));
    if (c) row.appendChild(mkBtn('Trash2', 'Clear', () => edit(d => { d.h = 0; }), { cls: 'chip' }));
    if (c) {
      gdLab(box, 'Whole column');
      gdSwatches(box, c.o ? null : c.m, m => edit(d => { d.m = m; delete d.o; }));
      gdLab(box, 'Single blocks — pick a material above, then tap a block (top is highest)');
      const stack = document.createElement('div'); stack.className = 'gdstack'; box.appendChild(stack);
      for (let k = c.h - 1; k >= 0; k--) { const m = gdMatAt(c, k), b = document.createElement('button'); b.type = 'button'; b.className = 'gdblk'; b.style.background = GD_COL[m]; b.textContent = k + 1; b.title = `${GD_LABEL[m]} — layer ${k + 1}`;
        b.onclick = () => edit(d => { d.o = d.o || {}; if (gd.m === d.m) delete d.o[k]; else d.o[k] = gd.m; if (!Object.keys(d.o).length) delete d.o; }); stack.appendChild(b); }
      gdLab(box, 'Brush material for single blocks'); gdSwatches(box, gd.m, m => { gd.m = m; gdRenderPanel(); });
    } else { gdLab(box, 'Material'); gdSwatches(box, gd.m, m => { gd.m = m; gdRenderPanel(); }); }
  } else {   // ----- brush -----
    const row = document.createElement('div'); row.className = 'gdrow'; P.appendChild(row);
    if (gd.tool === 'layer') cbStepper(row, 'Layer', gd.layer, 1, GD_MAXH, v => { gd.layer = v; gdDraw(); });
    else if (!['erase', 'raise', 'lower'].includes(gd.tool)) cbStepper(row, 'Height', gd.h, 1, GD_MAXH, v => { gd.h = v; });
    if (gd.tool === 'rect' || gd.tool === 'circle') gdChip(row, gd.filled ? 'Filled' : 'Outline', true, () => { gd.filled = !gd.filled; gdRenderPanel(); });
    if (gd.tool !== 'erase' && gd.tool !== 'lower') { gdLab(P, 'Material'); gdSwatches(P, gd.m, m => { gd.m = m; gdRenderPanel(); }); }
  }

  gdLab(P, 'Mirror');
  const mir = document.createElement('div'); mir.className = 'chips'; P.appendChild(mir);
  for (const [k, t] of [['', 'Off'], ['x', 'Left ↔ right'], ['z', 'Front ↔ back'], ['xz', 'Both']]) gdChip(mir, t, gd.mirror === k, () => { gd.mirror = k; gdChanged(true); });

  gdLab(P, 'Grid size');
  const sz = document.createElement('div'); sz.className = 'gdrow'; P.appendChild(sz);
  cbStepper(sz, 'Wide', gd.w, 4, GD_MAXN, v => gdResize(v, gd.l));
  cbStepper(sz, 'Deep', gd.l, 4, GD_MAXN, v => gdResize(gd.w, v));
  const sizes = document.createElement('div'); sizes.className = 'chips'; P.appendChild(sizes);
  for (const n of [8, 12, 16, 24, 32, 48]) gdChip(sizes, `${n}×${n}`, gd.w === n && gd.l === n, () => gdResize(n, n));

  gdLab(P, 'Designs');
  const ds = document.createElement('div'); ds.className = 'gdrow wrap'; P.appendChild(ds);
  const name = document.createElement('input'); name.className = 'gdname'; name.placeholder = 'Name this design'; name.maxLength = 32; ds.appendChild(name);
  ds.appendChild(mkBtn('Save', 'Save', () => { const nm = name.value.trim() || `Design ${gdDesigns().length + 1}`, list = gdDesigns().filter(d => d.name !== nm);
    list.unshift({ name: nm, t: Date.now(), d: gdPack() }); if (gdStoreDesigns(list)) { toast(`💾 Saved “${nm}”`); gdRenderPanel(); } }, { cls: 'chip' }));
  ds.appendChild(mkBtn('Trash2', 'New', async () => { if (gdCount() && !await confirmDlg('Start a new design?', 'This clears the grid. Save first if you want to keep it.', 'Clear', { danger: true })) return; gdPush(); gd.cells = gdBlank(gd.w, gd.l); gd.sel = -1; gdChanged(true); }, { cls: 'chip' }));
  const list = gdDesigns();
  if (list.length) { const L = document.createElement('div'); L.className = 'gdlist'; P.appendChild(L);
    for (const d of list) { const r = document.createElement('div'); r.className = 'gditem';
      const n = (d.d.c || []).reduce((a, e) => a + (e ? e[0] : 0), 0);
      r.innerHTML = `<b></b><small>${d.d.w}×${d.d.l} · ${n.toLocaleString()} blocks</small>`; r.querySelector('b').textContent = d.name;
      r.appendChild(mkBtn('FolderOpen', 'Open', () => { gdPush(); gdUnpack(d.d); gd.sel = -1; gdChanged(true); toast(`Opened “${d.name}”`); }, { cls: 'chip' }));
      r.appendChild(mkBtn('X', '', async () => { if (!await confirmDlg(`Delete “${d.name}”?`, 'This can’t be undone.', 'Delete', { danger: true })) return; gdStoreDesigns(gdDesigns().filter(x => x.name !== d.name)); gdRenderPanel(); }, { cls: 'chip', aria: `Delete ${d.name}` }));
      L.appendChild(r); } }
}

// ---- the screen ----
function gdMount() {
  if (gd.el) return;
  const el = document.createElement('div'); el.id = 'gridd'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Grid designer');
  el.innerHTML = `<div class="gdhead"><button id="gdX" class="gdicon" aria-label="Close">${ico('X')}</button><b>Grid designer</b><span id="gdCount"></span>
    <button id="gdUndo" class="gdicon" aria-label="Undo">${ico('Undo2')}</button><button id="gdRedo" class="gdicon" aria-label="Redo">${ico('Redo2')}</button></div>
    <div class="gdbody"><div class="gdwrap"><div class="gdedge">Back</div><canvas id="gdCanvas"></canvas><div class="gdedge">Front — faces you</div></div><div id="gdPanel"></div></div>
    <div class="gdfoot"><button id="gdBuild" class="btn primary">${ico('Hammer')}<span>Build it</span></button></div>`;
  document.body.appendChild(el); gd.el = el;
  gd.cv = $('gdCanvas'); gd.ctx = gd.cv.getContext('2d');
  gd.cv.addEventListener('pointerdown', gdDown); gd.cv.addEventListener('pointermove', gdMove);
  gd.cv.addEventListener('pointerup', gdUp); gd.cv.addEventListener('pointercancel', gdUp);
  $('gdX').onclick = () => closeGrid(); $('gdUndo').onclick = gdUndo; $('gdRedo').onclick = gdRedo; $('gdBuild').onclick = gdBuild;
  window.addEventListener('resize', () => { if (el.classList.contains('open')) gdDraw(); });
}
function openGrid() {
  gdMount();
  gd.fromLib = $('library').classList.contains('open'); closeLibrary(); $('more').classList.remove('open');
  if (!gd.cells.length) { let d = null; try { d = JSON.parse(localStorage.getItem(GD_DRAFT) || 'null'); } catch (e) { d = null; } if (!gdUnpack(d)) gd.cells = gdBlank(gd.w, gd.l); }
  gd.el.classList.add('open'); document.body.classList.add('gridopen');
  requestAnimationFrame(() => { gdDraw(); gdStats(); });
  gdRenderPanel(); gdStats(); logAct('grid open');
  tipOnce('grid', 'Draw your build from above: drag to paint columns, set the height and material, then tap Build it.');
}
function closeGrid(back = true) { if (!gd.el) return; const was = gd.el.classList.contains('open'); gd.el.classList.remove('open'); if (back && was && gd.fromLib) openLibrary('create'); document.body.classList.remove('gridopen'); gd.stroke = null; gd.preview = null; }
