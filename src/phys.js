// ================= physics (Rapier) =================
// A thin body wrapper so game code reads cached position/rotation/velocity without
// crossing into WASM, and so resting blocks can live OUTSIDE the simulation ("dormant")
// until something moving comes near them.
export const GRAV = -20;
export class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  vsub(v) { return new V3(this.x - v.x, this.y - v.y, this.z - v.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
}
export class Q4 {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(q) { return this.set(q.x, q.y, q.z, q.w); }
  clone() { return new Q4(this.x, this.y, this.z, this.w); }
  static yaw(a) { return new Q4(0, Math.sin(a / 2), 0, Math.cos(a / 2)); }
  vmult(v) { // rotate vector v by this quaternion
    const { x, y, z, w } = this, ix = w * v.x + y * v.z - z * v.y, iy = w * v.y + z * v.x - x * v.z, iz = w * v.z + x * v.y - y * v.x, iw = -x * v.x - y * v.y - z * v.z;
    return new V3(ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x);
  }
}

export function makePhysics(RAPIER) {
  const world = new RAPIER.World({ x: 0, y: GRAV, z: 0 });
  world.numSolverIterations = 4;
  const queue = new RAPIER.EventQueue(true);
  const rbMap = new Map(), colMap = new Map();
  const ground = world.createCollider(RAPIER.ColliderDesc.cuboid(600, .5, 600).setTranslation(0, -.5, 0).setFriction(.6));
  let activeCount = 0;

  class PBody {
    // opts: {shape:{kind:'box'|'ball'|'cyl'|'cone'|'hull', ...}, mass?, density?, pos, quat, fric, rest, ccd, ld, ad, events}
    constructor(o) {
      Object.assign(this, { fric: .55, rest: .05, ld: .01, ad: .05, ccd: false, events: true }, o);
      this.position = o.pos || new V3(); this.quaternion = o.quat || new Q4();
      this.velocity = new V3(); this.angularVelocity = new V3();
      this.rb = null; this.userData = null; this._sleep = true; 
      const s = this.shape;
      this.boundingRadius = s.kind === 'box' ? Math.hypot(s.hx, s.hy, s.hz) : s.kind === 'ball' ? s.r : s.kind === 'hull' ? s.radius : Math.hypot(s.r, s.hh);
      if (this.mass == null) this.mass = this.density * this.volume();
    }
    volume() {
      const s = this.shape;
      if (s.kind === 'box') return 8 * s.hx * s.hy * s.hz;
      if (s.kind === 'ball') return 4 / 3 * Math.PI * s.r ** 3;
      if (s.kind === 'cyl') return Math.PI * s.r * s.r * 2 * s.hh;
      if (s.kind === 'cone') return Math.PI * s.r * s.r * 2 * s.hh / 3;
      return s.vol;
    }
    colliderDesc() {
      const s = this.shape; let d;
      if (s.kind === 'box') d = RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz);
      else if (s.kind === 'ball') d = RAPIER.ColliderDesc.ball(s.r);
      else if (s.kind === 'cyl') d = RAPIER.ColliderDesc.cylinder(s.hh, s.r);
      else if (s.kind === 'cone') d = RAPIER.ColliderDesc.cone(s.hh, s.r);
      else d = RAPIER.ColliderDesc.convexHull(s.points);
      d.setFriction(this.fric).setRestitution(this.rest).setMass(this.mass);
      if (this.events) d.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      return d;
    }
    get inWorld() { return !!this.rb; }
    attach(sleeping) {
      if (this.rb) return;
      const p = this.position, q = this.quaternion, v = this.velocity, w = this.angularVelocity;
      const d = RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinvel(v.x, v.y, v.z).setAngvel({ x: w.x, y: w.y, z: w.z }).setLinearDamping(this.ld).setAngularDamping(this.ad).setCcdEnabled(this.ccd).setCanSleep(true);
      if (sleeping) d.setSleeping(true);
      if (this.gs != null) d.setGravityScale(this.gs);
      if (this.lockRot) d.lockRotations();
      this.rb = world.createRigidBody(d);
      const col = world.createCollider(this.colliderDesc(), this.rb);
      this.colHandle = col.handle; rbMap.set(this.rb.handle, this); colMap.set(col.handle, this);
      this._sleep = !!sleeping;
    }
    detach() {
      if (!this.rb) return;
      this.pull(); rbMap.delete(this.rb.handle); colMap.delete(this.colHandle);
      world.removeRigidBody(this.rb); this.rb = null; this._sleep = true;
    }
    pull() { // copy state out of the simulation
      const rb = this.rb, t = rb.translation(), r = rb.rotation(), v = rb.linvel(), w = rb.angvel();
      this.position.set(t.x, t.y, t.z); this.quaternion.set(r.x, r.y, r.z, r.w); this.velocity.set(v.x, v.y, v.z); this.angularVelocity.set(w.x, w.y, w.z);
    }
    isSleeping() { return !this.rb || this._sleep; }
    wakeUp() { if (this.rb) { this.rb.wakeUp(); this._sleep = false; } }
    sleep() { if (this.rb) this.rb.sleep(); this._sleep = true; this.velocity.set(0, 0, 0); this.angularVelocity.set(0, 0, 0); }
    setVelocity(x, y, z) { this.velocity.set(x, y, z); if (this.rb) this.rb.setLinvel({ x, y, z }, true); }
    setAngularVelocity(x, y, z) { this.angularVelocity.set(x, y, z); if (this.rb) this.rb.setAngvel({ x, y, z }, true); }
    applyImpulse(imp, rel) {
      if (!this.rb) return;
      if (rel) { const r = this.quaternion.vmult(rel), p = this.position; this.rb.applyImpulseAtPoint({ x: imp.x, y: imp.y, z: imp.z }, { x: p.x + r.x, y: p.y + r.y, z: p.z + r.z }, true); }
      else this.rb.applyImpulse({ x: imp.x, y: imp.y, z: imp.z }, true);
      this._sleep = false;
    }
    getAABB() { // world-space bounds from cached pose
      const s = this.shape, p = this.position;
      let ex, ey, ez;
      if (s.kind === 'box') {
        const q = this.quaternion, a = q.vmult(new V3(s.hx, 0, 0)), b = q.vmult(new V3(0, s.hy, 0)), c = q.vmult(new V3(0, 0, s.hz));
        ex = Math.abs(a.x) + Math.abs(b.x) + Math.abs(c.x); ey = Math.abs(a.y) + Math.abs(b.y) + Math.abs(c.y); ez = Math.abs(a.z) + Math.abs(b.z) + Math.abs(c.z);
      } else if (s.kind === 'cyl' || s.kind === 'cone') {
        const up = this.quaternion.vmult(new V3(0, 1, 0)), tilt = Math.min(1, Math.hypot(up.x, up.z));
        ex = ez = s.r + s.hh * tilt; ey = s.hh * Math.abs(up.y) + s.r * tilt;
      } else ex = ey = ez = this.boundingRadius;
      return { lowerBound: { x: p.x - ex, y: p.y - ey, z: p.z - ez }, upperBound: { x: p.x + ex, y: p.y + ey, z: p.z + ez } };
    }
  }

  // advance the simulation; onHit(a, b, impactSpeed) fires for new contacts using pre-step velocities
  function step(dt, onHit) {
    world.timestep = dt;
    world.step(queue);
    queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const a = colMap.get(h1), b = colMap.get(h2);
      const va = a ? a.velocity : null, vb = b ? b.velocity : null;
      const ax = va ? va.x : 0, ay = va ? va.y : 0, az = va ? va.z : 0, bx = vb ? vb.x : 0, by = vb ? vb.y : 0, bz = vb ? vb.z : 0;
      onHit(a, b, Math.hypot(ax - bx, ay - by, az - bz));
    });
    // refresh cached poses of everything that moved; anything not reported is asleep
    for (const pb of rbMap.values()) pb._sleep = true;
    activeCount = 0;
    world.forEachActiveRigidBody(rb => {
      const pb = rbMap.get(rb.handle); if (!pb) return; pb.pull(); pb._sleep = false; activeCount++; if (pb.userData) pb.userData.mdirty = true;
    });
  }
  return { world, ground, PBody, step, get activeCount() { return activeCount; }, bodies: () => rbMap.values(), setIterations(n) { world.numSolverIterations = n; } };
}
