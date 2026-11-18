// ================= building =================
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function camRightIsX() { const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); return Math.abs(r.x) >= Math.abs(r.z); }
function snapAxis(v, size) { const n = Math.round(size); return (n >= 2 && n % 2 === 0) ? Math.round(v - .5) + .5 : Math.round(v); }
function rayHit(sx, sy) {
  ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...pickables(), pad, groundMesh], false);
  return hits.length ? hits[0] : null;
}
// the footprint + rotation the current piece would use
function pieceFrame(key = curBlock) {
  const k = BLOCKS[key], spec = k.spec, hgt = specHeight(spec);
  let fx, fz;
  if (spec.shape === 'box' || spec.shape === 'wedge') { fx = spec.d[0]; fz = spec.d[2]; } else { fx = fz = 2 * Math.max(spec.d[0], spec.d[1] || 0); }
  let rot = 0;
  if (k.align) { const rx = camRightIsX(); if ((k.align === 'x' && !rx) || (k.align === 'z' && rx)) { rot = Math.PI / 2; [fx, fz] = [fz, fx]; } }
  return { spec, hgt, fx, fz, rot };
}
// screen point -> snapped build cell (x, z) for the current piece
function cellAt(sx, sy, onTop = true) {
  const h = rayHit(sx, sy); if (!h) return null;
  const pt = h.point.clone(), ho = objFromHit(h);
  if (onTop && ho && h.face) {
    const q = ho.body.quaternion, n = h.face.normal.clone().applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    if (n.y < .7) pt.add(n.multiplyScalar(.5));
  }
  const f = pieceFrame();
  return { ...f, x: snapAxis(pt.x, f.fx), z: snapAxis(pt.z, f.fz), hitObj: ho };
}
// top of whatever sits under a footprint (uses a cached list of static bounds while dragging)
let topCache = null;
function buildTopCache() {
  const m = new Map();
  for (const o of objs) {
    if (o.gone || o.type === 'proj') continue;
    const a = o.body.getAABB(), calm = o.body.isSleeping();
    for (let i = Math.floor(a.lowerBound.x / 2); i <= Math.floor(a.upperBound.x / 2); i++)
      for (let j = Math.floor(a.lowerBound.z / 2); j <= Math.floor(a.upperBound.z / 2); j++) {
        const k = i + ',' + j; if (!m.has(k)) m.set(k, []); m.get(k).push([a, calm]);
      }
  }
  return m;
}
function topAt(x, z, fx, fz, cache) {
  let top = 0, calm = true; const seen = new Set();
  const look = (a, c) => {
    if (a.upperBound.x > x - fx / 2 + .03 && a.lowerBound.x < x + fx / 2 - .03 && a.upperBound.z > z - fz / 2 + .03 && a.lowerBound.z < z + fz / 2 - .03) {
      if (a.upperBound.y > top) top = a.upperBound.y; if (!c) calm = false;
    }
  };
  if (cache) {
    for (let i = Math.floor((x - fx / 2) / 2); i <= Math.floor((x + fx / 2) / 2); i++)
      for (let j = Math.floor((z - fz / 2) / 2); j <= Math.floor((z + fz / 2) / 2); j++)
        for (const e of cache.get(i + ',' + j) || []) if (!seen.has(e)) { seen.add(e); look(e[0], e[1]); }
  } else for (const o of objs) if (!o.gone && o.type !== 'proj') look(o.body.getAABB(), o.body.isSleeping());
  return { top, calm };
}
const inPad = (x, z) => Math.abs(x) <= buildR + .01 && Math.abs(z) <= buildR + .01;
const pieceCost = spec => spec.mat === 'tnt' ? 5 : 1;
// place one piece on top of whatever is at (x, z); returns the object or null
function placeCell(f, x, z, cache, quiet) {
  if (!inPad(x, z)) { if (!quiet) toast('Build on the sandy pad'); return null; }
  const { top, calm } = topAt(x, z, f.fx, f.fz, cache);
  if (top + f.hgt > MAX_H) { if (!quiet) toast('Too tall — sky limit!'); return null; }
  if (duelBuild && duelUsed() + pieceCost(f.spec) > duelBuild.budget) { if (!quiet) toast('Budget used up — send it, or undo some blocks'); return null; }
  const o = createPiece(f.spec, x, top + f.hgt / 2 + .005, z, qY(f.rot), calm);
  o.pop = 1; o.mdirty = true;
  if (cache) { const a = o.body.getAABB(), k = Math.floor(x / 2) + ',' + Math.floor(z / 2); if (!cache.has(k)) cache.set(k, []); cache.get(k).push([a, true]);
    for (let i = Math.floor(a.lowerBound.x / 2); i <= Math.floor(a.upperBound.x / 2); i++) for (let j = Math.floor(a.lowerBound.z / 2); j <= Math.floor(a.upperBound.z / 2); j++) { const kk = i + ',' + j; if (kk === k) continue; if (!cache.has(kk)) cache.set(kk, []); cache.get(kk).push([a, true]); } }
  return o;
}
function placeAt(sx, sy) {
  const c = cellAt(sx, sy); if (!c) return;
  const out = [];
  for (const [x, z] of mirrorPts([[c.x, c.z]])) { const o = placeCell(c, x, z, null, out.length > 0); if (o) out.push(o); }
  if (!out.length) return;
  pushHistory(out.length === 1 ? out[0] : out); dirty = true; snd.place(); updateHud();
}
