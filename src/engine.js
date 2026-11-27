// ================= physics engine core (Rapier) =================
// Owns the Rapier world and nothing else. It is driven by a list of commands and answers with
// packed poses for awake bodies plus the collisions that started. The same code runs inside a
// Web Worker (physics off the main thread) or directly on the main thread; see phys.js.
//
// Commands (arrays):            ['add', id, desc]   ['rm', id]   ['wake', id]   ['sleep', id]
//   ['lv', id, x, y, z]  linear velocity       ['av', id, x, y, z]  angular velocity
//   ['imp', id, x, y, z]  ['impAt', id, x, y, z, px, py, pz]        ['iters', n]
//   ['joint', jid, idA, idB|-1, la, fa, lb, fb]  (fixed joint; -1 = the ground)   ['unjoint', jid]
//   ['quake', 'start'|'move'|'end', x, y, z]    ['step', n, dt]
// Result of run(): { poses: Float32Array [id, px,py,pz, qx,qy,qz,qw, vx,vy,vz, wx,wy,wz] per awake body,
//                    hits: Float32Array [idA, idB, speed] per new contact (-1 = ground or unknown),
//                    active, steps }
export const GRAV = -20;
export const POSE = 14;

export function createEngine(RAPIER) {
  const world = new RAPIER.World({ x: 0, y: GRAV, z: 0 });
  world.numSolverIterations = 4;
  // notice contacts up to 6 mm away, so a block resting a hair above another never free-falls onto it
  world.integrationParameters.normalizedPredictionDistance = .006;
  const queue = new RAPIER.EventQueue(true);
  const ground = world.createCollider(RAPIER.ColliderDesc.cuboid(600, .5, 600).setTranslation(0, -.5, 0).setFriction(.6));
  const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());   // the ground end of anchor bonds
  const bodies = new Map(), byRb = new Map(), byCol = new Map(), vel = new Map();
  // ---- settling (F3): still rubble freezes into fixed scenery ----
  // One jittering block keeps a whole touching pile awake, because Rapier sleeps only whole islands. A block that has
  // been still for a second, touching only the ground, frozen blocks or other still blocks, becomes a FIXED body: it
  // still holds up what rests on it, costs nothing, and no longer joins the pile into one island, so the rest can sleep.
  // It turns back into a normal body when hit, pushed or blasted, when something it rests on moves or disappears, or
  // when an earthquake starts. Nothing ever leaves the simulation and nothing is forced to sleep.
  const STILL_V2 = .08 * .08, STILL_W2 = .2 * .2, STILL_T = .8, HIT_V = .6, MOVED_V2 = .3 * .3, CHECK = 20;
  // in a big collapse (600+ moving), rubble that has nearly stopped settles sooner: the pile gets cheaper as it lands
  const BUSY = 600, BUSY_V2 = .14 * .14, BUSY_W2 = .35 * .35, BUSY_T = .45;
  let sV2 = STILL_V2, sW2 = STILL_W2, sT = STILL_T;
  const still = new Map(), frozen = new Set(), dependents = new Map();   // dependents: id -> frozen ids resting on it
  let stepCount = 0;
  function unfreeze(id) {
    const stack = [id];
    while (stack.length) {
      const k = stack.pop();
      if (frozen.delete(k)) { const rb = bodies.get(k); if (rb) rb.setBodyType(RAPIER.RigidBodyType.Dynamic, true); still.set(k, 0); }
      const deps = dependents.get(k);
      if (deps) { dependents.delete(k); for (const d of deps) if (frozen.has(d)) stack.push(d); }
    }
  }
  const joints = new Map(), jointsOf = new Map();
  let quake = null, active = 0;

  function collider(d) {
    let c;
    if (d.kind === 'box') c = RAPIER.ColliderDesc.cuboid(d.hx, d.hy, d.hz);
    else if (d.kind === 'ball') c = RAPIER.ColliderDesc.ball(d.r);
    else if (d.kind === 'cyl') c = RAPIER.ColliderDesc.cylinder(d.hh, d.r);
    else if (d.kind === 'cone') c = RAPIER.ColliderDesc.cone(d.hh, d.r);
    else c = RAPIER.ColliderDesc.convexHull(d.points);
    c.setFriction(d.fric).setRestitution(d.rest).setMass(d.mass);
    if (d.events) c.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    return c;
  }
  const dropJoint = jid => {
    const j = joints.get(jid); if (!j) return;
    joints.delete(jid);
    for (const id of j.ids) { const s = jointsOf.get(id); if (s) s.delete(jid); }
    try { world.removeImpulseJoint(j.joint, true); } catch (e) {}
  };

  const ops = {
    add(id, d) {
      if (bodies.has(id)) return;
      const b = RAPIER.RigidBodyDesc.dynamic().setTranslation(d.p[0], d.p[1], d.p[2]).setRotation({ x: d.q[0], y: d.q[1], z: d.q[2], w: d.q[3] })
        .setLinvel(d.v[0], d.v[1], d.v[2]).setAngvel({ x: d.w[0], y: d.w[1], z: d.w[2] }).setLinearDamping(d.ld).setAngularDamping(d.ad).setCcdEnabled(!!d.ccd).setCanSleep(true);
      if (d.sleeping) b.setSleeping(true);
      if (d.gs != null) b.setGravityScale(d.gs);
      if (d.lockRot) b.lockRotations();
      const rb = world.createRigidBody(b), col = world.createCollider(collider(d), rb);
      bodies.set(id, rb); byRb.set(rb.handle, id); byCol.set(col.handle, id); vel.set(id, [d.v[0], d.v[1], d.v[2]]);
      if (d.creep !== false) still.set(id, 0);
    },
    rm(id) {
      const rb = bodies.get(id); if (!rb) return;
      const s = jointsOf.get(id); if (s) { for (const jid of [...s]) dropJoint(jid); jointsOf.delete(id); }
      byRb.delete(rb.handle); for (let i = 0; i < rb.numColliders(); i++) byCol.delete(rb.collider(i).handle);
      unfreeze(id);   // whatever rested on it must be free to fall
      world.removeRigidBody(rb); bodies.delete(id); vel.delete(id); still.delete(id);
    },
    wake(id) { const rb = bodies.get(id); if (rb) { unfreeze(id); rb.wakeUp(); } },
    sleep(id) { const rb = bodies.get(id); if (rb) rb.sleep(); },
    lv(id, x, y, z) { const rb = bodies.get(id); if (rb) { unfreeze(id); rb.setLinvel({ x, y, z }, true); } },
    av(id, x, y, z) { const rb = bodies.get(id); if (rb) { unfreeze(id); rb.setAngvel({ x, y, z }, true); } },
    imp(id, x, y, z) { const rb = bodies.get(id); if (rb) { unfreeze(id); rb.applyImpulse({ x, y, z }, true); } },
    impAt(id, x, y, z, px, py, pz) { const rb = bodies.get(id); if (rb) { unfreeze(id); rb.applyImpulseAtPoint({ x, y, z }, { x: px, y: py, z: pz }, true); } },
    iters(n) { world.numSolverIterations = n; },
    joint(jid, a, b, la, fa, lb, fb) {
      const ra = bodies.get(a), rbB = b < 0 ? anchor : bodies.get(b);
      if (!ra || !rbB || joints.has(jid)) return;
      unfreeze(a); if (b >= 0) unfreeze(b);
      const v = p => ({ x: p[0], y: p[1], z: p[2] }), r = q => ({ x: q[0], y: q[1], z: q[2], w: q[3] });
      const joint = world.createImpulseJoint(RAPIER.JointData.fixed(v(la), r(fa), v(lb), r(fb)), ra, rbB, false);
      const ids = b < 0 ? [a] : [a, b]; joints.set(jid, { joint, ids });
      for (const id of ids) { let s = jointsOf.get(id); if (!s) jointsOf.set(id, s = new Set()); s.add(jid); }
    },
    unjoint(jid) { dropJoint(jid); },
    quake(what, x, y, z) {
      if (what === 'start' && !quake) {
        for (const id of [...frozen]) unfreeze(id);
        const kin = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0));
        world.createCollider(RAPIER.ColliderDesc.cuboid(300, .5, 300).setTranslation(0, -.5, 0).setFriction(.95), kin);
        ground.setEnabled(false); quake = kin;
      } else if (what === 'move' && quake) quake.setNextKinematicTranslation({ x, y, z });
      else if (what === 'end' && quake) { world.removeRigidBody(quake); ground.setEnabled(true); quake = null; }
    }
  };

  function freezeStill() {
    const ok = [];
    for (const [id, t] of still) {
      if (t < sT || frozen.has(id) || jointsOf.has(id)) continue;
      const rb = bodies.get(id); if (!rb || rb.isSleeping()) continue;
      let calmNbrs = true; const below = [], y = rb.translation().y;
      world.contactPairsWith(rb.collider(0), c => {
        if (!calmNbrs) return;
        const n = byCol.get(c.handle);
        if (n === undefined) return;                      // the ground
        const nb = bodies.get(n);
        if (!frozen.has(n) && !(nb && nb.isSleeping()) && !(still.get(n) >= sT)) { calmNbrs = false; return; }
        if (nb && nb.translation().y < y - .05) below.push(n);
      });
      if (calmNbrs) ok.push([id, rb, below]);
    }
    for (const [id, rb, below] of ok) {
      rb.setBodyType(RAPIER.RigidBodyType.Fixed, false); frozen.add(id);
      const c = vel.get(id); c[0] = c[1] = c[2] = 0;
      for (const n of below) { let s = dependents.get(n); if (!s) dependents.set(n, s = new Set()); s.add(id); }
    }
  }
  function stepOnce(dt, hits) {
    world.timestep = dt;
    world.step(queue);
    // impact speed uses velocities from before this step (the speed at which they met)
    queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const a = byCol.has(h1) ? byCol.get(h1) : -1, b = byCol.has(h2) ? byCol.get(h2) : -1;
      const va = a >= 0 ? vel.get(a) : null, vb = b >= 0 ? vel.get(b) : null;
      const sp = Math.hypot((va ? va[0] : 0) - (vb ? vb[0] : 0), (va ? va[1] : 0) - (vb ? vb[1] : 0), (va ? va[2] : 0) - (vb ? vb[2] : 0));
      if (sp > HIT_V) { if (frozen.has(a)) unfreeze(a); if (frozen.has(b)) unfreeze(b); }
      hits.push(a, b, sp);
    });
    active = 0;
    world.forEachActiveRigidBody(rb => {
      const id = byRb.get(rb.handle); if (id === undefined) return;
      const v = rb.linvel(), c = vel.get(id); c[0] = v.x; c[1] = v.y; c[2] = v.z; active++;
      const v2 = v.x * v.x + v.y * v.y + v.z * v.z;
      if (v2 > MOVED_V2 && dependents.has(id)) unfreeze(id);   // it moved: free whatever froze on top of it
      if (!still.has(id)) return;
      const w = rb.angvel();
      still.set(id, v2 < sV2 && w.x * w.x + w.y * w.y + w.z * w.z < sW2 ? still.get(id) + dt : 0);
    });
    const busy = active > BUSY; sV2 = busy ? BUSY_V2 : STILL_V2; sW2 = busy ? BUSY_W2 : STILL_W2; sT = busy ? BUSY_T : STILL_T;
    if (++stepCount % CHECK === 0 && !quake) freezeStill();
  }

  function run(cmds) {
    const hits = []; let steps = 0;
    for (const c of cmds) {
      if (c[0] === 'step') { for (let i = 0; i < c[1]; i++) { stepOnce(c[2], hits); steps++; } }
      else { const f = ops[c[0]]; if (f) f(c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8]); }
    }
    const poses = new Float32Array(active * POSE); let k = 0;
    if (steps) world.forEachActiveRigidBody(rb => {
      const id = byRb.get(rb.handle); if (id === undefined || k >= poses.length) return;
      const t = rb.translation(), r = rb.rotation(), v = rb.linvel(), w = rb.angvel();
      poses[k++] = id; poses[k++] = t.x; poses[k++] = t.y; poses[k++] = t.z; poses[k++] = r.x; poses[k++] = r.y; poses[k++] = r.z; poses[k++] = r.w;
      poses[k++] = v.x; poses[k++] = v.y; poses[k++] = v.z; poses[k++] = w.x; poses[k++] = w.y; poses[k++] = w.z;
    });
    return { poses: k === poses.length ? poses : poses.slice(0, k), hits: new Float32Array(hits), active: steps ? active : -1, steps };
  }
  return { run };
}
