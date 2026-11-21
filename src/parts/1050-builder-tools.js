// ================= builder 2.0: tools, ghost preview, history =================
// tools: place (tap), line, box (filled), walls (hollow box), erase, paint, pick (eyedropper)
const TOOLS = [
  ['place', 'MousePointerClick', 'Place'], ['line', 'Ruler', 'Line'], ['box', 'Square', 'Box'], ['walls', 'SquareDashed', 'Walls'],
  ['fuse', 'Link', 'Fuse'], ['erase', 'Eraser', 'Erase'], ['paint', 'Paintbrush', 'Paint'], ['pick', 'Pipette', 'Pick']
];
const HEIGHTS = [1, 2, 3, 4, 6, 8, 12];
let tool = 'place', toolH = 0, mirrorX = false, stroke = null, redoStack = [];
const STROKE_CAP = 1500;

// ---- history: every entry is a command {undo(), redo()}; plain objects/arrays are wrapped ----
const poseOf = o => ({ spec: o.spec, p: o.body.position.clone(), q: o.body.quaternion.clone() });
const respawn = r => { const o = createPiece(r.spec, r.p.x, r.p.y, r.p.z, r.q, true); o.mdirty = true; return o; };
function placementCmd(list) {
  let objsNow = [].concat(list).filter(Boolean), saved = null;
  return {
    undo() { saved = objsNow.filter(o => !o.gone).map(poseOf); for (const o of objsNow) if (!o.gone) removeObj(o); },
    redo() { objsNow = (saved || []).map(respawn); }
  };
}
function pushHistory(entry) { placed.push(entry && entry.undo ? entry : placementCmd(entry)); redoStack = []; }
function afterEdit() { objs = objs.filter(q => !q.gone || q.home); dirty = true; wakeAll(); updateHud(); }
function undo() {
  const e = placed.pop(); if (!e) { toast('Nothing to undo'); return; }
  const cmd = e.undo ? e : placementCmd(e); cmd.undo(); redoStack.push(cmd); afterEdit();
}
function redo() { const c = redoStack.pop(); if (!c) { toast('Nothing to redo'); return; } c.redo(); placed.push(c); afterEdit(); }

const mirrorPts = pts => { if (!mirrorX) return pts; const out = [...pts]; for (const [x, z] of pts) if (Math.abs(x) > .01) out.push([-x, z]); return out; };

// ---- ghost preview: translucent copies of what a stroke will place ----
const GHOST_CAP = 2500;
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x4cff7a, transparent: true, opacity: .35, depthWrite: false });
const ghost = new THREE.InstancedMesh(UNIT_BOX, ghostMat, GHOST_CAP); ghost.count = 0; ghost.frustumCulled = false; ghost.renderOrder = 5; scene.add(ghost);
const anchorMark = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 32), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: .95, depthTest: false, side: THREE.DoubleSide }));
anchorMark.rotation.x = -Math.PI / 2; anchorMark.renderOrder = 999; anchorMark.visible = false; scene.add(anchorMark);

// grid cells covered by a stroke from a to b
function strokeCells(a, b, f) {
  const sx = f.fx || 1, sz = f.fz || 1, out = [];
  const nx = Math.round((b.x - a.x) / sx), nz = Math.round((b.z - a.z) / sz);
  if (tool === 'line') {
    const n = Math.max(Math.abs(nx), Math.abs(nz));
    for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; out.push([a.x + Math.round(nx * t) * sx, a.z + Math.round(nz * t) * sz]); }
  } else {
    for (let i = 0; i <= Math.abs(nx); i++) for (let j = 0; j <= Math.abs(nz); j++) {
      if (tool === 'walls' && i > 0 && j > 0 && i < Math.abs(nx) && j < Math.abs(nz)) continue;
      out.push([a.x + Math.sign(nx) * i * sx, a.z + Math.sign(nz) * j * sz]);
    }
  }
  const seen = new Set();
  return mirrorPts(out).filter(([x, z]) => { const k = x.toFixed(2) + ',' + z.toFixed(2); if (seen.has(k)) return false; seen.add(k); return inPad(x, z); });
}
function strokePlan(a, b) {
  const f = a.frame, cells = strokeCells(a, b, f), layers = HEIGHTS[toolH], plan = [];
  const hm = new Map();
  for (const [x, z] of cells) {
    let { top } = topAt(x, z, f.fx, f.fz, stroke.cache);
    for (let L = 0; L < layers && plan.length < STROKE_CAP; L++) { if (top + f.hgt > MAX_H) break; plan.push([x, top, z]); top += f.hgt + .0005; }
  }
  return plan;
}
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3();
function showGhost(plan, f) {
  const n = Math.min(plan.length, GHOST_CAP);
  _gq.setFromAxisAngle(UPY, f.rot);
  const w = f.spec.shape === 'box' || f.spec.shape === 'wedge' ? f.spec.d[0] : f.fx, d = f.spec.shape === 'box' || f.spec.shape === 'wedge' ? f.spec.d[2] : f.fz;
  for (let i = 0; i < n; i++) { const [x, y, z] = plan[i]; _gp.set(x, y + f.hgt / 2, z); _gs.set(w * .98, f.hgt * .98, d * .98); _gm.compose(_gp, _gq, _gs); ghost.setMatrixAt(i, _gm); }
  ghost.count = n; ghost.instanceMatrix.needsUpdate = true;
  ghostMat.color.set(plan.length >= STROKE_CAP ? 0xffa53a : 0x4cff7a);
  $('hud').textContent = `${plan.length >= STROKE_CAP ? '⚠️ max ' : ''}${plan.length} block${plan.length === 1 ? '' : 's'} · release to build`;
}
function clearGhost() { ghost.count = 0; anchorMark.visible = false; stroke = null; }

// ---- tool input (called from the input layer) ----
const isDrawTool = () => tool === 'line' || tool === 'box' || tool === 'walls';
const isBrushTool = () => tool === 'erase' || tool === 'paint';
function toolDown(x, y) {
  if (isDrawTool()) {
    const c = cellAt(x, y, true); if (!c) return false;
    if (stroke && stroke.tapAnchor) { stroke.b = { x: c.x, z: c.z }; return true; }   // second tap of tap-tap
    stroke = { a: { x: c.x, z: c.z, frame: pieceFrame() }, b: { x: c.x, z: c.z }, cache: buildTopCache() };
    anchorMark.position.set(c.x, .06, c.z); anchorMark.visible = true;
    showGhost(strokePlan(stroke.a, stroke.b), stroke.a.frame);
    return true;
  }
  if (tool === 'fuse') { stroke = { fuse: true, hit: new Set(), made: [], cut: [] }; fuseBrushAt(x, y); return true; }
  if (isBrushTool()) { stroke = { brush: [], hit: new Set() }; brushAt(x, y); return true; }
  return false;
}
function toolMove(x, y) {
  if (!stroke) return;
  if (stroke.fuse) { fuseBrushAt(x, y); return; }
  if (stroke.brush) { brushAt(x, y); return; }
  const c = cellAt(x, y, false); if (!c) return;
  if (c.x === stroke.b.x && c.z === stroke.b.z) return;
  stroke.b = { x: c.x, z: c.z }; showGhost(strokePlan(stroke.a, stroke.b), stroke.a.frame);
}
function toolUp(moved) {
  if (!stroke) return;
  if (stroke.fuse) { finishFuse(); return; }
  if (stroke.brush) { finishBrush(); return; }
  // a tap without dragging: first tap = anchor, second tap = build
  if (!moved && !stroke.tapAnchor && stroke.a.x === stroke.b.x && stroke.a.z === stroke.b.z) { stroke.tapAnchor = true; toast('Now tap (or drag to) the end point'); return; }
  const plan = strokePlan(stroke.a, stroke.b), f = stroke.a.frame, out = [];
  for (const [x, top, z] of plan) {
    if (duelBuild && duelUsed() + pieceCost(f.spec) > duelBuild.budget) { toast('Budget used up'); break; }
    out.push(createPiece(f.spec, x, top + f.hgt / 2 + .0005, z, qY(f.rot), true));
  }
  clearGhost();
  if (out.length) { out.forEach(o => { o.pop = 1; o.mdirty = true; }); pushHistory(out); dirty = true; snd.place(); toast(`🧱 +${out.length} blocks`); if (tool === 'line') coach('line'); }
  updateHud();
}
function brushAt(x, y) {
  const h = rayHit(x, y), o = h && objFromHit(h); if (!o || o.type !== 'block' || o.gone || stroke.hit.has(o)) return;
  stroke.hit.add(o);
  if (tool === 'erase') {
    stroke.brush.push(poseOf(o)); removeObj(o); snd.pop();
  } else {
    const mat = BLOCKS[curBlock].spec.mat; if (o.mat === mat) return;
    const before = poseOf(o), spec = { ...o.spec, mat }; removeObj(o);
    const n = respawn({ ...before, spec }); n.pop = 1; stroke.brush.push([before, n]); snd.place();
  }
  objs = objs.filter(q => !q.gone || q.home);
}
function finishBrush() {
  const done = stroke.brush; stroke = null;
  if (!done.length) return;
  if (tool === 'erase') {
    let back = [];
    pushHistory({ undo() { back = done.map(respawn); }, redo() { for (const o of back) if (!o.gone) removeObj(o); } });
    toast(`🧽 Erased ${done.length}`);
  } else {
    let pairs = done;
    pushHistory({
      undo() { pairs = pairs.map(([b, n]) => { const now = n.gone ? null : poseOf(n); if (!n.gone) removeObj(n); return [b, respawn(b), now]; }); },
      redo() { pairs = pairs.map(([b, old, now]) => { if (!old.gone) removeObj(old); return [b, respawn(now || { ...b, spec: { ...b.spec, mat: BLOCKS[curBlock].spec.mat } })]; }); }
    });
  }
  afterEdit();
}
function pickAt(x, y) {
  const h = rayHit(x, y), o = h && objFromHit(h); if (!o || !o.spec) { toast('Tap a block to copy it'); return; }
  const same = (a, b) => a.shape === b.shape && a.mat === b.mat && a.d.length === b.d.length && a.d.every((v, i) => Math.abs(v - b.d[i]) < .02);
  let key = Object.keys(BLOCKS).find(k => same(BLOCKS[k].spec, o.spec));
  if (!key) { key = 'pick'; BLOCKS.pick = { label: 'Copied', spec: { ...o.spec, d: o.spec.d.slice() } }; }
  curBlock = key; setTool('place'); toast(`💧 Picked ${BLOCKS[key].label} (${o.mat})`); buildUI();
}

// ---- toolbar ----
function setTool(t) { tool = t; clearGhost(); stopPlacing(); renderToolbar(); if (mode === 'build' && tutStep < 0) toast(t === 'fuse' ? BOND[bondMode].tip : TOOL_TIPS[t]); if (t === 'fuse') tipOnce('fuse', 'Fusing bonds blocks to their neighbours so builds hold. Glue is weak, weld is strong, anchor bolts to the ground.'); }
const TOOL_TIPS = {
  place: 'Tap to stack one piece', line: 'Drag (or tap two points) to build a line',
  box: 'Drag a rectangle to fill it', walls: 'Drag a rectangle to build hollow walls',
  erase: 'Tap or swipe blocks to remove them', paint: 'Tap or swipe blocks to repaint with the selected material',
  pick: 'Tap a block to copy its piece and material',
  fuse: 'Tap or swipe blocks to fuse them to the blocks they touch'
};
// the build dock: + Add, tools (fuse options open beside Fuse), undo, redo, more
function tlBtn(bar, icon, label, fn, { on, cls = '', aria, html } = {}) {
  const b = document.createElement('button'); b.className = 'tl' + (on ? ' on' : '') + (cls ? ' ' + cls : '');
  b.innerHTML = (html || ico(icon)) + `<small>${label}</small>`; b.setAttribute('aria-label', aria || label); b.onclick = fn; bar.appendChild(b); return b;
}
function fuseButtons(bar) {
  bar.appendChild(document.createElement('i'));
  for (const k of BOND_MODES) tlBtn(bar, null, BOND[k].label, () => { bondMode = k; renderToolbar(); toast(BOND[k].tip); }, { on: bondMode === k, html: `<span style="font-size:17px;line-height:19px">${BOND[k].emoji}</span>` });
  tlBtn(bar, 'Link', 'Fuse all', () => fuseAll(), { aria: 'Fuse the whole build' });
  tlBtn(bar, 'X', 'Unfuse', unfuseAll, { aria: 'Remove every bond' });
  tlBtn(bar, showBonds ? 'EyeOff' : 'Eye', showBonds ? 'Hide' : 'Show', () => { showBonds = !showBonds; bondsDirty = true; renderToolbar(); }, { aria: 'Show or hide bonds' });
  bar.appendChild(document.createElement('i'));
}
function renderToolbar() {
  const bar = $('toolbar'); if (!bar) return; bar.innerHTML = '';
  bar.style.display = mode === 'build' ? 'flex' : 'none';
  tlBtn(bar, 'Plus', 'Add', () => openLibrary(), { aria: 'Build Library: prefabs, big builds, create', cls: 'add' });
  for (const [k, icon, lab] of TOOLS) {
    tlBtn(bar, icon, lab, () => setTool(k), { on: tool === k });
    if (k === 'fuse' && tool === 'fuse') fuseButtons(bar);
  }
  bar.appendChild(document.createElement('i'));
  tlBtn(bar, 'Undo2', 'Undo', undo); tlBtn(bar, 'Redo2', 'Redo', redo);
  tlBtn(bar, 'Ellipsis', 'More', openMore, { on: mirrorX || toolH > 0, aria: 'More build tools' });
  if (tool === 'fuse') requestAnimationFrame(() => { const f = bar.querySelector('[aria-label="Fuse"]'); if (f) bar.scrollTo({ left: f.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft - 8 }); });
}
