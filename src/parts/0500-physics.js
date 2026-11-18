// ================= physics =================
const P = makePhysics(RAPIER);

// ---- Dormant blocks: resting pieces far from any action are drawn but NOT simulated. ----
// They sit in a spatial hash and join the physics world (still asleep) the moment anything
// moving comes near, so a 5,000-block castle costs almost nothing until you hit it.
const HC = 2, dormant = new Map();
const hkey = (x, y, z) => ((x + 300) * 700 + (y + 300)) * 700 + (z + 300);
const overlap = (a, b, pad) => b.lowerBound.x <= a.upperBound.x + pad && b.upperBound.x >= a.lowerBound.x - pad &&
  b.lowerBound.y <= a.upperBound.y + pad && b.upperBound.y >= a.lowerBound.y - pad && b.lowerBound.z <= a.upperBound.z + pad && b.upperBound.z >= a.lowerBound.z - pad;
function forCells(a, pad, fn) {
  for (let x = Math.floor((a.lowerBound.x - pad) / HC); x <= Math.floor((a.upperBound.x + pad) / HC); x++)
    for (let y = Math.floor((a.lowerBound.y - pad) / HC); y <= Math.floor((a.upperBound.y + pad) / HC); y++)
      for (let z = Math.floor((a.lowerBound.z - pad) / HC); z <= Math.floor((a.upperBound.z + pad) / HC); z++) fn(hkey(x, y, z));
}
function makeDormant(o) {
  o.dormant = true; o.aabb = o.body.getAABB(); o.cells = [];
  forCells(o.aabb, 0, k => { let st = dormant.get(k); if (!st) dormant.set(k, st = new Set()); st.add(o); o.cells.push(k); });
}
function unDormant(o) {
  for (const k of o.cells) { const st = dormant.get(k); if (st) { st.delete(o); if (!st.size) dormant.delete(k); } }
  o.cells = null; o.dormant = false;
}
function activate(o) { if (!o.dormant || o.gone) return; unDormant(o); o.body.attach(true); if (o.bonds) wakeBonded(o); }   // joins asleep
function activateNear(aabb, pad) {
  const found = new Set();
  forCells(aabb, pad, k => { const st = dormant.get(k); if (st) for (const o of st) if (overlap(aabb, o.aabb, pad)) found.add(o); });
  for (const o of found) activate(o);
}
function preActivate() {   // anything awake pulls nearby dormant blocks into the simulation
  if (!dormant.size) return;
  for (const pb of [...P.bodies()]) {
    if (pb.isSleeping()) continue;
    if (pb.userData && pb.userData.bonds) wakeBonded(pb.userData);
    const sp = pb.velocity.length() + pb.angularVelocity.length() * pb.boundingRadius;
    activateNear(pb.getAABB(), .25 + sp / 60 * 3);
  }
}
// while a collapse is still going, sleeping blocks far from anything awake leave the world too
// (sleeping bodies still cost broadphase time and per-frame bookkeeping in very large builds)
function deactivateCalm() {
  const hot = new Set(); let n = 0;
  for (const pb of P.bodies()) { n++; if (!pb.isSleeping()) forCells(pb.getAABB(), 1.5, k => hot.add(k)); }
  if (n < 1500) return;
  for (const pb of [...P.bodies()]) { const o = pb.userData;
    if (!o || o.type !== 'block' || o.gone || !pb.isSleeping() || o.bonds) continue;
    let near = false; forCells(pb.getAABB(), .3, k => { if (hot.has(k)) near = true; }); if (near) continue;
    pb.detach(); makeDormant(o); }
}
function deactivateResting() {      // once everything has settled, send sleeping blocks back to dormancy
  for (const pb of [...P.bodies()]) { const o = pb.userData; if (o && o.type === 'block' && !o.gone && pb.isSleeping()) {
    if (o.bonds && o.bonds.some(b => { const q = b.a === o ? b.b : b.a; return q && !q.gone && !q.dormant && !q.body.isSleeping(); })) continue;
    if (o.bonds) dropJointsOf(o); pb.detach(); makeDormant(o); } }
}

