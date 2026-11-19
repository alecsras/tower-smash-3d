// ================= state =================
let mode = 'build', curBlock = 'wood', curProj = 'ball', slow = false, muted = false;
let objs = [];          // {body, mesh, type, kind, ...}
let placed = [], snapshot = null, dirty = true;
let pendingBreak = new Set(), pendingBoom = [], simTime = 0;
let shake = 0;
const hintDone = { build: false, throw: false };

function addObj(o) { o.createdT = simTime; o.body.userData = o; if (o.dormant) makeDormant(o); else o.body.attach(false); if (o.mesh) scene.add(o.mesh); else batchFor(o.spec).add(o); objs.push(o); return o; }
let objsRemoved = false;
function removeObj(o) {
  if (o.gone) return; o.gone = true; objsRemoved = true; shadowDirty = 2;
  if (o.bonds) bondsOfGone(o);
  recRemove(o); burning.delete(o);
  if (o.dormant) unDormant(o); else o.body.detach(); if (o.mesh) scene.remove(o.mesh); else if (o.batch) o.batch.remove(o);
}
function wakeAll() { for (const pb of P.bodies()) pb.wakeUp(); }


function createPiece(spec, x, y, z, quat, sleep) {
  const body = new P.PBody({ shape: specPhys(spec), density: DENS[spec.mat], pos: new V3(x, y, z), quat: quat ? quat.clone() : new Q4(), ...(MATP[spec.mat] || {}), ad: spec.mat === 'domino' ? .01 : .05 });
  return addObj({ body, dormant: !!sleep, sc: spec.shape === 'box' ? spec.d : [1, 1, 1], type: 'block', spec, mat: spec.mat, breakable: !!BRITTLE[spec.mat], tnt: spec.mat === 'tnt', pop: 0 });
}
const qY = a => a ? Q4.yaw(a) : null;
// place a piece by the height of its BOTTOM
let COUNTING = null;
function put(spec, x, yBase, z, rotY) { if (COUNTING !== null) { COUNTING++; return null; } return createPiece(spec, x, yBase + specHeight(spec) / 2 + .003, z, qY(rotY), true); }
function syncMesh(o) { if (!o.mesh) return; o.mesh.position.copy(o.body.position); o.mesh.quaternion.copy(o.body.quaternion); }

