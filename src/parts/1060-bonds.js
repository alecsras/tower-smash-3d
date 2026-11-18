// ================= structural bonds: glue, welds and ground anchors =================
// A bond fuses two touching blocks (or a block and the ground) with a fixed physics joint.
// Bonds hold until they're overstressed: pulled apart, hit hard, or caught in a blast.
// Joints only exist while both blocks are in the simulation; dormant blocks keep the bond
// data and get their joint back when they wake up.
const BOND = {
  glue:   { label: 'Glue',   emoji: '🧴', color: 0xf4f1e6, drift: .12, hit: 13, blast: 1,   tip: 'Glue: holds blocks together, but snaps under a solid hit' },
  weld:   { label: 'Weld',   emoji: '🔥', color: 0xff8a2a, drift: .3,  hit: 30, blast: .65,  tip: 'Weld: very strong — only big hits and blasts break it' },
  anchor: { label: 'Anchor', emoji: '⚓', color: 0x3d4652, drift: .35, hit: 34, blast: .4,  tip: 'Anchor: bolts blocks that touch the ground to the ground' },
  cut:    { label: 'Cut',    emoji: '✂️', tip: 'Cut: tap or swipe blocks to remove their bonds' }
};
const BOND_MODES = ['glue', 'weld', 'anchor', 'cut'];
let bondMode = 'weld';
const bonds = new Set();
const groundRB = P.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
const _bv = new THREE.Vector3();
const tq = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const worldAnchor = (pb, local) => _bv.copy(local).applyQuaternion(tq(pb.quaternion)).add(pb.position).clone();

// two blocks share a face (not just an edge or corner)? -> contact box center
function faceContact(a, b) {
  const o = ['x', 'y', 'z'].map(k => Math.min(a.upperBound[k], b.upperBound[k]) - Math.max(a.lowerBound[k], b.lowerBound[k]));
  const wide = o.filter(v => v > .15).length;
  if (wide < 2 || Math.min(...o) < -.08) return null;
  return new THREE.Vector3(...['x', 'y', 'z'].map(k => (Math.max(a.lowerBound[k], b.lowerBound[k]) + Math.min(a.upperBound[k], b.upperBound[k])) / 2));
}
function bondBetween(a, b) { return (a.bonds || []).find(x => x.a === b || x.b === b) || null; }
function addBond(a, b, kind, at) {
  if (a === b || a.gone || (b && b.gone)) return null;
  if (b ? bondBetween(a, b) : (a.bonds || []).find(x => !x.b)) return null;
  const qa = tq(a.body.quaternion), bond = { a, b, kind, joint: null,
    la: at.clone().sub(a.body.position).applyQuaternion(qa.clone().invert()), fa: qa.clone().invert(),
    lb: b ? at.clone().sub(b.body.position).applyQuaternion(tq(b.body.quaternion).invert()) : at.clone(), fb: b ? tq(b.body.quaternion).invert() : new THREE.Quaternion() };
  (a.bonds || (a.bonds = [])).push(bond); if (b) (b.bonds || (b.bonds = [])).push(bond);
  bonds.add(bond); activate(a); if (b) activate(b); ensureJoint(bond); bondsDirty = true;
  return bond;
}
function ensureJoint(bond) {
  if (bond.joint || !bond.a.body.rb || (bond.b && !bond.b.body.rb)) return;
  const v = p => ({ x: p.x, y: p.y, z: p.z }), r = q => ({ x: q.x, y: q.y, z: q.z, w: q.w });
  const data = RAPIER.JointData.fixed(v(bond.la), r(bond.fa), v(bond.lb), r(bond.fb));
  bond.joint = P.world.createImpulseJoint(data, bond.a.body.rb, bond.b ? bond.b.body.rb : groundRB, false);
}
function dropJoint(bond) { if (bond.joint) { try { P.world.removeImpulseJoint(bond.joint, true); } catch (e) {} bond.joint = null; } }
function dropJointsOf(o) { if (o.bonds) for (const b of o.bonds) dropJoint(b); }
function removeBond(bond, fx) {
  if (!bonds.has(bond)) return; dropJoint(bond); bonds.delete(bond); bondsDirty = true;
  for (const o of [bond.a, bond.b]) if (o && o.bonds) o.bonds.splice(o.bonds.indexOf(bond), 1);
  if (fx) { const p = worldAnchor(bond.a.body, bond.la), c = BOND[bond.kind].color; const col = [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];
    for (let i = 0; i < 5; i++) spawnP(p.x, p.y, p.z, rand(-3, 3), rand(0, 4), rand(-3, 3), .4, bond.kind === 'weld' ? [1, .7, .3] : col, .14, -10, 0); }
}
function bondsOfGone(o) { if (o.bonds) for (const b of [...o.bonds]) removeBond(b, false); }

// block-to-block and block-to-ground bonds for one block, using a hash of nearby bounds
function bondHash() {
  const m = new Map();
  for (const o of objs) { if (o.gone || o.type !== 'block') continue; const a = o.body.getAABB(); forCells(a, .1, k => { let l = m.get(k); if (!l) m.set(k, l = []); l.push(o); }); }
  return m;
}
function fuseBlock(o, kind, hash, made) {
  const a = o.body.getAABB();
  if (kind === 'anchor') { if (a.lowerBound.y < .08) { const at = new THREE.Vector3(o.body.position.x, Math.max(0, a.lowerBound.y), o.body.position.z), b = addBond(o, null, 'anchor', at); if (b) made.push(b); } return; }
  const seen = new Set();
  forCells(a, .1, k => { for (const q of hash.get(k) || []) {
    if (q === o || seen.has(q) || q.gone) continue; seen.add(q);
    const at = faceContact(a, q.body.getAABB()); if (!at) continue;
    const b = addBond(o, q, kind, at); if (b) made.push(b);
  } });
}
function fuseAll(kind = bondMode === 'cut' ? 'weld' : bondMode) {
  const hash = bondHash(), made = [];
  for (const o of objs) if (!o.gone && o.type === 'block') fuseBlock(o, kind, hash, made);
  if (!made.length) { toast('Nothing new to fuse — blocks need to touch face to face'); return; }
  pushBondHistory(made, []); toast(`${BOND[kind].emoji} ${made.length.toLocaleString()} ${BOND[kind].label.toLowerCase()} bonds added`); snd.place();
}
function unfuseAll() {
  const cut = [...bonds]; if (!cut.length) { toast('No bonds to remove'); return; }
  for (const b of cut) removeBond(b); pushBondHistory([], cut); toast(`✂️ Removed ${cut.length.toLocaleString()} bonds`);
}
function pushBondHistory(made, cut) {
  let mk = made, ct = cut;
  pushHistory({
    undo() { for (const b of mk) removeBond(b); ct = ct.map(b => (b.a.gone || (b.b && b.b.gone)) ? null : addBond(b.a, b.b, b.kind, worldAnchor(b.a.body, b.la))).filter(Boolean); },
    redo() { mk = mk.map(b => (b.a.gone || (b.b && b.b.gone)) ? null : addBond(b.a, b.b, b.kind, worldAnchor(b.a.body, b.la))).filter(Boolean); for (const b of ct) removeBond(b); }
  });
}
// brush (called by the Fuse tool while swiping)
function fuseBrushAt(x, y) {
  const h = rayHit(x, y), o = h && objFromHit(h); if (!o || o.type !== 'block' || o.gone || stroke.hit.has(o)) return;
  stroke.hit.add(o);
  if (bondMode === 'cut') { for (const b of [...(o.bonds || [])]) { removeBond(b, true); stroke.cut.push(b); } return; }
  const n = stroke.made.length; fuseBlock(o, bondMode, stroke.hash || (stroke.hash = bondHash()), stroke.made);
  if (stroke.made.length > n) snd.place();
}
function finishFuse() {
  const s = stroke; stroke = null; if (!s.made.length && !s.cut.length) { toast(bondMode === 'anchor' ? 'Anchor only works on blocks touching the ground' : 'No touching blocks there'); return; }
  pushBondHistory(s.made, s.cut);
  toast(s.cut.length ? `✂️ Cut ${s.cut.length} bonds` : `${BOND[bondMode].emoji} +${s.made.length} ${BOND[bondMode].label.toLowerCase()} bonds`);
}

// ---- stress: drift between the two halves of a joint, hits and blasts ----
function bondHitCheck(o, eff) {
  if (!o.bonds || !o.bonds.length) return;
  for (const b of [...o.bonds]) if (eff > BOND[b.kind].hit * rand(.8, 1.2)) removeBond(b, true);
}
function bondBlast(c, R) {
  if (!bonds.size) return;
  for (const b of [...bonds]) { const p = worldAnchor(b.a.body, b.la), d = p.distanceTo(c); if (d < R * BOND[b.kind].blast * rand(.8, 1.2)) removeBond(b, true); }
}
let bondCheckT = 0;
function updateBonds(dt) {
  if (!bonds.size) { bondMarks.count = 0; return; }
  bondCheckT += dt;
  if (bondCheckT > .05) { bondCheckT = 0;
    for (const b of [...bonds]) {
      if (!b.joint) { if (b.a.body.rb && (!b.b || b.b.body.rb)) ensureJoint(b); continue; }
      if (b.a.body.isSleeping() && (!b.b || b.b.body.isSleeping())) continue;
      const pa = worldAnchor(b.a.body, b.la), pb = b.b ? worldAnchor(b.b.body, b.lb) : b.lb;
      if (pa.distanceTo(pb) > BOND[b.kind].drift) removeBond(b, true);
    } }
  drawBondMarks();
}
// a dormant block whose partner is moving must rejoin the simulation (with its joint)
function wakeBonded(o) { if (o.bonds) for (const b of o.bonds) { const q = b.a === o ? b.b : b.a; if (q && q.dormant) activate(q); ensureJoint(b); } }

// ---- markers: a small bead at every bond ----
const BOND_MARK_CAP = 6000;
let bondsDirty = true, showBonds = true;
const bondMarks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.11), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: .9 }), BOND_MARK_CAP);
bondMarks.count = 0; bondMarks.frustumCulled = false; bondMarks.renderOrder = 4; scene.add(bondMarks);
const _bm4 = new THREE.Matrix4(), _bc = new THREE.Color();
function drawBondMarks() {
  if (!showBonds || replay || mode !== 'build') { bondMarks.count = 0; bondsDirty = true; return; }
  let n = 0; const s = .75;
  for (const b of bonds) { if (n >= BOND_MARK_CAP) break;
    if (!bondsDirty && b.a.body.isSleeping() && (!b.b || b.b.body.isSleeping()) && b.mi === n) { n++; continue; }
    const p = worldAnchor(b.a.body, b.la); _bm4.makeScale(s, s, s).setPosition(p); bondMarks.setMatrixAt(n, _bm4);
    bondMarks.setColorAt(n, _bc.setHex(BOND[b.kind].color)); b.mi = n; n++; }
  bondMarks.count = n; bondMarks.instanceMatrix.needsUpdate = true; if (bondMarks.instanceColor) bondMarks.instanceColor.needsUpdate = true; bondsDirty = false;
}

// ---- saving: bonds as [indexA, indexB(-1 = ground), kind] over a list of blocks ----
const BOND_KINDS = ['glue', 'weld', 'anchor'];
function bondsFor(list) {
  const idx = new Map(list.map((o, i) => [o, i])), out = [];
  for (const b of bonds) { const i = idx.get(b.a), j = b.b ? idx.get(b.b) : -1; if (i == null || j == null) continue; out.push([i, j, BOND_KINDS.indexOf(b.kind)]); }
  return out;
}
function restoreBonds(list, saved) {
  if (!saved || !saved.length) return;
  const hash = new Map();
  for (const [i, j, k] of saved) { const a = list[i], b = j >= 0 ? list[j] : null; if (!a || (j >= 0 && !b)) continue;
    const kind = BOND_KINDS[k] || 'weld', A = a.body.getAABB();
    const at = b ? faceContact(A, b.body.getAABB()) : new THREE.Vector3(a.body.position.x, Math.max(0, A.lowerBound.y), a.body.position.z);
    if (at) addBond(a, b, kind, at); }
}
