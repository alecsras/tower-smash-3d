// ================= blueprint 2.0: new shapes, names, stacking, arrays, mirrors, rings =================
//   keep: tower 8x8x16 stone              name a structure
//   on keep: round 6x6x8 glass roof       build on top of it (at = offset from its center)
//   array 3x2 spacing 8: tower 3x3x10     a grid of copies
//   around 0,0 radius 12 count 8: tower 3x3x8 roof    a ring of copies facing the middle
//   mirror x: tower 4x4x10 at 8,0         also builds the mirror image (x, z or xz)
//   rot 45                                rotates a structure around its center
const GEN2 = {};
function shapeGrid(c, H, inside) {   // generic voxel shape: inside(u, v, w) with u,w in -1..1 across W/L and v = layer index
  const out = [], W = c.w, L = c.l;
  const X = i => c.x + (i - (W - 1) / 2) * G, Z = j => c.z + (j - (L - 1) / 2) * G;
  for (let k = 0; k < H; k++) for (let i = 0; i < W; i++) for (let j = 0; j < L; j++) {
    const m = inside(i, j, k); if (m) out.push({ spec: CUBE(m === true ? matFor(c, i, j, k) : m), x: X(i), y: k * LAY, z: Z(j) });
  }
  return out;
}
function matFor(c, i, j, k) {
  if (c.mat === 'striped') return k % 2 ? 'wood' : 'stone';
  if (c.mat === 'checker') return (i + j + k) % 2 ? 'marble' : 'stone';
  if (c.mat === 'random') return ['stone', 'wood', 'glass', 'concrete', 'brick'][(i * 7 + j * 13 + k * 5) % 5];
  return c.mat;
}
const ell = (i, j, k, a, b, cc, ci, cj, ck) => Math.hypot((i + .5 - ci) / a, (k + .5 - ck) / b, (j + .5 - cj) / cc);
GEN2.sphere = c => { const a = c.w / 2, b = c.h / 2, cc = c.l / 2, t = c.thick;
  return shapeGrid(c, c.h, (i, j, k) => ell(i, j, k, a, b, cc, a, cc, b) <= 1 && (a <= t + .5 || ell(i, j, k, a - t, b - t, cc - t, a, cc, b) >= 1)); };
GEN2.dome = c => { const a = c.w / 2, cc = c.l / 2, b = c.h, t = c.thick;
  return shapeGrid(c, c.h, (i, j, k) => ell(i, j, k, a, b, cc, a, cc, 0) <= 1 && (a <= t + .5 || ell(i, j, k, a - t, b - t, cc - t, a, cc, 0) >= 1)); };
GEN2.cone = c => { const t = c.thick;
  return shapeGrid(c, c.h, (i, j, k) => { const s = 1 - k / c.h, a = c.w / 2 * s, cc = c.l / 2 * s; if (a < .35) return k === c.h - 1 && Math.abs(i + .5 - c.w / 2) < .6 && Math.abs(j + .5 - c.l / 2) < .6;
    const d = Math.hypot((i + .5 - c.w / 2) / a, (j + .5 - c.l / 2) / cc); return d <= 1 && (a <= t + .5 || Math.hypot((i + .5 - c.w / 2) / (a - t), (j + .5 - c.l / 2) / (cc - t)) >= 1); }); };
GEN2.arch = c => { const t = Math.max(1, c.thick), a = c.w / 2 - t, b = c.h - t;
  return shapeGrid(c, c.h, (i, j, k) => !(a > 0 && b > 0 && Math.hypot((i + .5 - c.w / 2) / a, (k + .5) / b) < 1)); };
GEN2.gate = c => { const ow = Math.max(3, Math.round(c.w / 3) | 1), oh = Math.max(3, Math.round(c.h * .65));
  const out = shapeGrid(c, c.h, (i, j, k) => { const x = Math.abs(i + .5 - c.w / 2), r = ow / 2; return !(x < r && (k + .5 < oh - r || Math.hypot(x / r, (k + .5 - (oh - r)) / r) < 1)); });
  for (let i = 0; i < c.w; i += 2) for (let j of [0, c.l - 1]) out.push({ spec: CUBE(matFor(c, i, j, c.h)), x: c.x + (i - (c.w - 1) / 2) * G, y: c.h * LAY, z: c.z + (j - (c.l - 1) / 2) * G });
  return out; };
GEN2.bridge = c => { const out = [], H = Math.max(2, c.h), X = i => c.x + (i - (c.w - 1) / 2) * G, Z = j => c.z + (j - (c.l - 1) / 2) * G;
  const posts = new Set([0, c.w - 1]); for (let i = 6; i < c.w - 3; i += 6) posts.add(i);
  for (const i of posts) for (const j of new Set([0, c.l - 1])) for (let k = 0; k < H - 1; k++) out.push({ spec: CUBE(c.mat === 'wood' ? 'stone' : matFor(c, i, j, k)), x: X(i), y: k * LAY, z: Z(j) });
  const dy = (H - 1) * LAY; out.push({ spec: Bx(c.mat === 'glass' ? 'concrete' : (DENS[c.mat] ? c.mat : 'wood'), c.w * G - .01, 1, c.l * G - .01), x: c.x, y: dy, z: c.z });
  for (let i = 0; i < c.w; i += 2) for (const j of new Set([0, c.l - 1])) out.push({ spec: Bx('wood', .3, .8, .3), x: X(i), y: dy + 1, z: Z(j) });
  return out; };
GEN2.spiral = c => { const out = [], R = Math.max(1.5, c.w / 2), m = DENS[c.mat] ? c.mat : 'stone';
  for (let k = 0; k < c.h; k++) out.push({ spec: CUBE(m), x: c.x, y: k * LAY, z: c.z });
  for (let k = 0; k < c.h; k++) { const a = k * Math.PI / 6, len = R - .5, rr = .55 + len / 2;
    out.push({ spec: Bx(c.mat === 'stone' ? 'wood' : m, len, .3, 1), x: c.x + Math.cos(a) * rr, y: k * LAY + .7, z: c.z - Math.sin(a) * rr, rot: a }); }
  return out; };

// rotate pieces around a pivot (same convention as Q4.yaw)
function rotPieces(ps, a, px, pz) {
  if (!a) return ps; const co = Math.cos(a), si = Math.sin(a);
  return ps.map(p => { const dx = p.x - px, dz = p.z - pz; return { ...p, x: px + dx * co + dz * si, z: pz - dx * si + dz * co, rot: (p.rot || 0) + a }; });
}
const NUM = '(-?\\d+(?:\\.\\d+)?)';
const BP_OPS = [
  [new RegExp('^on\\s+([a-z][\\w-]*)\\s*:\\s*', 'i'), m => ({ on: m[1].toLowerCase() })],
  [new RegExp('^array\\s+(\\d+)\\s*[x×]\\s*(\\d+)(?:\\s+spacing\\s+' + NUM + ')?\\s*:\\s*', 'i'), m => ({ array: [+m[1], +m[2], m[3] ? +m[3] : null] })],
  [new RegExp('^around\\s+' + NUM + '\\s*,\\s*' + NUM + '\\s+radius\\s+' + NUM + '\\s+count\\s+(\\d+)\\s*:\\s*', 'i'), m => ({ around: [+m[1], +m[2], +m[3], +m[4]] })],
  [/^mirror\s+(xz|zx|x|z)\s*:\s*/i, m => ({ mirror: m[1].toLowerCase() })],
  [/^([a-z][\w-]*)\s*:\s*/i, m => ({ name: m[1].toLowerCase() })]
];
// lines -> { structs: [[piece...]...], clear, err, lines: [{n, err}] }
function compileBlueprint(lines, { ox = 0, oz = 0 } = {}) {
  const names = {}, structs = [], info = []; let clear = false, err = '';
  lines.forEach((raw, idx) => {
    let l = raw.trim(); if (!l || l.startsWith('#') || l.startsWith('//')) return;
    if (/^clear\b/i.test(l)) { clear = true; return; }
    const ops = {}; let hit = true;
    while (hit) { hit = false; for (const [re, fn] of BP_OPS) { const m = l.match(re); if (m) { Object.assign(ops, fn(m)); l = l.slice(m[0].length); hit = true; break; } } }
    const c = parseCmd(l); let baseY = 0;
    if (ops.on) { const b = names[ops.on]; if (!b) { const e = `Line ${idx + 1}: no structure named “${ops.on}” above it`; err = err || e; info.push({ line: idx, err: e }); return; } c.x += b.cx; c.z += b.cz; baseY = b.top; }
    else { c.x += ox; c.z += oz; }
    let base = genStructure(c).map(p => ({ ...p, y: p.y + baseY }));
    base = rotPieces(base, (c.rot || 0) * Math.PI / 180, c.x, c.z);
    let copies = [base];
    if (ops.array) { const [nx, nz, sp0] = ops.array, sx = sp0 || c.w + 2, sz = sp0 || c.l + 2; copies = [];
      for (let i = 0; i < Math.min(nx, 12); i++) for (let j = 0; j < Math.min(nz, 12); j++) { const dx = (i - (nx - 1) / 2) * sx, dz = (j - (nz - 1) / 2) * sz; copies.push(base.map(p => ({ ...p, x: p.x + dx, z: p.z + dz }))); } }
    if (ops.around) { const [cx0, cz0, R, n] = ops.around, cx = cx0 + ox, cz = cz0 + oz; copies = [];
      for (let k = 0; k < Math.min(n, 24); k++) { const a = k / n * Math.PI * 2, tx = cx + Math.cos(a) * R, tz = cz + Math.sin(a) * R;
        copies.push(rotPieces(base.map(p => ({ ...p, x: p.x - c.x + tx, z: p.z - c.z + tz })), Math.PI / 2 - a, tx, tz)); } }
    if (ops.mirror) { const mx = ops.mirror.includes('x'), mz = ops.mirror.includes('z'), more = [];
      for (const cp of copies) { if (mx) more.push(cp.map(p => ({ ...p, x: 2 * ox - p.x, rot: -(p.rot || 0) })));
        if (mz) more.push(cp.map(p => ({ ...p, z: 2 * oz - p.z, rot: Math.PI - (p.rot || 0) })));
        if (mx && mz) more.push(cp.map(p => ({ ...p, x: 2 * ox - p.x, z: 2 * oz - p.z, rot: Math.PI + (p.rot || 0) }))); }
      // drop mirror copies that land on the original (structure on the mirror line)
      const key = cp => cp.map(p => p.x.toFixed(2) + ',' + p.z.toFixed(2)).sort().join('|'); const seen = new Set(copies.map(key));
      for (const m of more) { const k = key(m); if (!seen.has(k)) { seen.add(k); copies.push(m); } } }
    let n = 0, lo = [1e9, 1e9], hi = [-1e9, -1e9], top = 0;
    for (const cp of copies) { structs.push(cp); n += cp.length; for (const p of cp) { lo = [Math.min(lo[0], p.x), Math.min(lo[1], p.z)]; hi = [Math.max(hi[0], p.x), Math.max(hi[1], p.z)]; top = Math.max(top, p.y + specHeight(p.spec)); } }
    if (ops.name) { const t = base.reduce((m, p) => Math.max(m, p.y + specHeight(p.spec)), 0); names[ops.name] = { cx: c.x, cz: c.z, top: t }; }
    info.push({ line: idx, n });
  });
  return { structs, clear, err, info };
}
// build a list of command lines; returns false if it didn't build
function runBlueprint(lines, { replace = false, ox = 0, oz = 0, quiet = false } = {}) {
  const C = compileBlueprint(lines, { ox, oz }); let doClear = replace || C.clear;
  if (C.err) { cbLastErr = C.err; toast(C.err); return false; }
  if (!C.structs.length) { if (doClear) { clearAll(); snapshot = null; dirty = true; updateHud(); toast('Cleared'); } return false; }
  const all = C.structs, total = all.reduce((n, a) => n + a.length, 0);
  if (total + (doClear ? 0 : objs.filter(o => !o.gone && o.type === 'block').length) > CB_MAX_BLOCKS) { cbLastErr = `Too big: ${total.toLocaleString()} blocks (max ${CB_MAX_BLOCKS.toLocaleString()})`; toast(cbLastErr); return false; }
  { const hm = new Map();
    for (let k = 0; k < all.length; k++) {
      let clash = -1;
      for (const p of all[k]) { const a = pieceAABB(p); forCells(a, 0, key => { const l = hm.get(key); if (l) for (const [b, kk] of l) if (kk !== k && clash < 0 && overlap(a, b, -.06)) clash = kk; }); if (clash >= 0) break; }
      if (clash >= 0) { cbLastErr = `Structures ${clash + 1} and ${k + 1} overlap — change “at” or “up”`; toast(cbLastErr); return false; }
      for (const p of all[k]) { const a = pieceAABB(p); forCells(a, 0, key => { let l = hm.get(key); if (!l) hm.set(key, l = []); l.push([a, k]); }); }
    } }
  const flat = all.flat();
  if (!doClear && spaceTaken(flat)) { cbLastErr = 'That spot is taken — move it, or turn on “Clear first”'; toast(cbLastErr); return false; }
  if (doClear) { clearAll(); snapshot = null; }
  let top = 0, ext = 6;
  for (const p of flat) { const a = pieceAABB(p); top = Math.max(top, a.upperBound.y); ext = Math.max(ext, Math.abs(a.lowerBound.x), Math.abs(a.upperBound.x), Math.abs(a.lowerBound.z), Math.abs(a.upperBound.z)); }
  if (Math.ceil(ext + 1) > buildR) setArena(Math.min(Math.ceil(ext + 1), 34));
  const group = flat.map(p => put(p.spec, p.x, p.y, p.z, p.rot));
  pushHistory(group); dirty = true; curPreset = null;
  if (!quiet) { cam.tR = clamp(Math.max(ext * 2.7, top * 1.9, 18), 14, 95); cam.target.y = clamp(top * .3, 1.5, 12); cam.tEl = Math.max(cam.tEl, .35); }
  updateHud(); hideHint('build');
  if (!quiet) toast(`Built ${total.toLocaleString()} blocks`);
  return true;
}
