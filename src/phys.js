// ================= physics: the game's side =================
// PBody is a thin proxy: game code reads cached position/rotation/velocity, and every change is queued as a
// command for the engine (engine.js), which runs either in a Web Worker or on the main thread. Resting blocks
// can live OUTSIDE the simulation ("dormant") until something moving comes near them.
export const GRAV = -20;
const POSE = 14;
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

// src: the engine bundle (engine-entry.js) as text. worker: try to run it off the main thread.
export async function makePhysics({ src, worker: wantWorker }) {
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  let engine = null, wk = null;
  if (wantWorker) {
    try { wk = await startWorker(url); }
    catch (e) { console.warn('Physics worker unavailable; running physics on the main thread.', e); wk = null; }
  }
  if (!wk) { await loadScript(url); engine = await self.TSEngine.start(); }

  let cmds = [], nextId = 1, nextJoint = 1, activeCount = 0, stepNo = 0, stepsTotal = 0, iters = 4;
  let inFlight = false, owed = 0, pending = null, seq = 0;
  const byId = new Map();
  if (wk) wk.onmessage = e => {
    const m = e.data;
    if (m.t === 'res') { pending = m; inFlight = false; }
    else if (m.t === 'error') setTimeout(() => { throw new Error('Physics worker: ' + m.message); });
  };

  class PBody {
    // opts: {shape:{kind:'box'|'ball'|'cyl'|'cone'|'hull', ...}, mass?, density?, pos, quat, fric, rest, ccd, ld, ad, events, gs, lockRot}
    constructor(o) {
      Object.assign(this, { fric: .55, rest: .05, ld: .01, ad: .05, ccd: false, events: true }, o);
      this.position = o.pos || new V3(); this.quaternion = o.quat || new Q4();
      this.velocity = new V3(); this.angularVelocity = new V3();
      this.id = 0; this.inWorld = false; this.userData = null; this._sleep = true;
      this.prevP = new V3(); this.prevQ = new Q4(); this._step = -1;   // pose one fixed step ago, for smoothed drawing
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
    get rb() { return this.inWorld ? this : null; }   // truthy while in the simulation (older code checks body.rb)
    attach(sleeping) {
      if (this.inWorld) return;
      const s = this.shape, p = this.position, q = this.quaternion, v = this.velocity, w = this.angularVelocity;
      this.id = nextId++; this.inWorld = true; this._sleep = !!sleeping; byId.set(this.id, this);
      cmds.push(['add', this.id, { kind: s.kind, hx: s.hx, hy: s.hy, hz: s.hz, r: s.r, hh: s.hh, points: s.points, mass: this.mass, fric: this.fric, rest: this.rest,
        ld: this.ld, ad: this.ad, ccd: this.ccd, gs: this.gs, lockRot: this.lockRot, events: this.events, sleeping: !!sleeping,
        p: [p.x, p.y, p.z], q: [q.x, q.y, q.z, q.w], v: [v.x, v.y, v.z], w: [w.x, w.y, w.z] }]);
    }
    detach() {
      if (!this.inWorld) return;
      cmds.push(['rm', this.id]); byId.delete(this.id); this.inWorld = false; this._sleep = true;
    }
    pull() {}   // poses arrive with every step result
    isSleeping() { return !this.inWorld || this._sleep; }
    wakeUp() { if (this.inWorld) { cmds.push(['wake', this.id]); this._sleep = false; } }
    sleep() { if (this.inWorld) cmds.push(['sleep', this.id]); this._sleep = true; this.velocity.set(0, 0, 0); this.angularVelocity.set(0, 0, 0); }
    setVelocity(x, y, z) { this.velocity.set(x, y, z); if (this.inWorld) cmds.push(['lv', this.id, x, y, z]); }
    setAngularVelocity(x, y, z) { this.angularVelocity.set(x, y, z); if (this.inWorld) cmds.push(['av', this.id, x, y, z]); }
    applyImpulse(imp, rel) {
      if (!this.inWorld) return;
      if (rel) { const r = this.quaternion.vmult(rel), p = this.position; cmds.push(['impAt', this.id, imp.x, imp.y, imp.z, p.x + r.x, p.y + r.y, p.z + r.z]); }
      else cmds.push(['imp', this.id, imp.x, imp.y, imp.z]);
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

  // take in one engine result: new poses for everything awake, then the collisions (onHit(a, b, impactSpeed))
  function apply(r, onHit) {
    stepNo++; stepsTotal += r.steps;
    for (const pb of byId.values()) pb._sleep = true;
    const a = r.poses;
    for (let k = 0; k < a.length; k += POSE) {
      const pb = byId.get(a[k]); if (!pb) continue;
      pb.prevP.copy(pb.position); pb.prevQ.copy(pb.quaternion); pb._step = stepNo;
      pb.position.set(a[k + 1], a[k + 2], a[k + 3]); pb.quaternion.set(a[k + 4], a[k + 5], a[k + 6], a[k + 7]);
      pb.velocity.set(a[k + 8], a[k + 9], a[k + 10]); pb.angularVelocity.set(a[k + 11], a[k + 12], a[k + 13]);
      pb._sleep = false; if (pb.userData) pb.userData.mdirty = true;
    }
    if (r.active >= 0) activeCount = r.active;
    const h = r.hits;
    for (let k = 0; k < h.length; k += 3) onHit(h[k] >= 0 ? byId.get(h[k]) : undefined, h[k + 1] >= 0 ? byId.get(h[k + 1]) : undefined, h[k + 2]);
  }
  // advance the simulation n fixed steps. On the main thread this happens now; with a worker the steps are sent
  // off and their result is taken in on a later frame (the game draws the latest pose it has).
  function advance(n, dt, onHit) {
    if (!wk) {
      for (let i = 0; i < n; i++) { cmds.push(['step', 1, dt]); const r = engine.run(cmds); cmds = []; apply(r, onHit); }
      return n;
    }
    let got = 0;
    if (pending) { const r = pending; pending = null; apply(r, onHit); got = r.steps; }
    owed = Math.min(owed + n, 4);
    if (!inFlight && owed) { cmds.push(['step', owed, dt]); wk.postMessage({ t: 'run', cmds, seq: ++seq }); cmds = []; owed = 0; inFlight = true; }
    return got;   // steps whose results arrived this frame
  }

  // the pose to draw: blended between the last two steps (alpha 0 = previous step, 1 = latest)
  function renderPose(pb, alpha, outP, outQ) {
    const p = pb.position, q = pb.quaternion;
    if (pb._step !== stepNo || alpha >= 1) { outP.set(p.x, p.y, p.z); outQ.set(q.x, q.y, q.z, q.w); return; }
    const a = pb.prevP, b = pb.prevQ, k = 1 - alpha;
    outP.set(a.x * k + p.x * alpha, a.y * k + p.y * alpha, a.z * k + p.z * alpha);
    const d = b.x * q.x + b.y * q.y + b.z * q.z + b.w * q.w, sg = d < 0 ? -alpha : alpha;   // nlerp along the short way
    const x = b.x * k + q.x * sg, y = b.y * k + q.y * sg, z = b.z * k + q.z * sg, w = b.w * k + q.w * sg, l = Math.hypot(x, y, z, w) || 1;
    outQ.set(x / l, y / l, z / l, w / l);
  }
  function* awake() { for (const pb of byId.values()) if (!pb._sleep) yield pb; }

  return {
    PBody, advance, step: (dt, onHit) => advance(1, dt, onHit), renderPose, awake,
    mode: wk ? 'worker' : 'main',
    get stepNo() { return stepNo; }, get stepsTotal() { return stepsTotal; }, get activeCount() { return activeCount; }, get busy() { return inFlight; },
    bodies: () => byId.values(),
    setIterations(n) { if (n !== iters) { iters = n; cmds.push(['iters', n]); } },
    // fixed joint between two bodies in the simulation (b null = the ground); returns a joint id
    addJoint(a, b, la, fa, lb, fb) { const jid = nextJoint++; cmds.push(['joint', jid, a.id, b ? b.id : -1, la, fa, lb, fb]); return jid; },
    removeJoint(jid) { cmds.push(['unjoint', jid]); },
    // earthquake: the ground becomes a moving slab
    quake(what, x = 0, y = 0, z = 0) { cmds.push(['quake', what, x, y, z]); }
  };
}

function loadScript(url) {
  if (self.TSEngine) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => rej(new Error('Physics engine failed to load')); document.head.appendChild(s); });
}
function startWorker(url) {
  return new Promise((res, rej) => {
    let w;
    try { w = new Worker(url); } catch (e) { rej(e); return; }
    const t = setTimeout(() => { w.terminate(); rej(new Error('Physics worker timed out')); }, 20000);
    w.onmessage = e => { if (e.data.t === 'ready') { clearTimeout(t); w.onmessage = null; res(w); } else if (e.data.t === 'error') { clearTimeout(t); w.terminate(); rej(new Error(e.data.message)); } };
    w.onerror = e => { clearTimeout(t); w.terminate(); rej(e.message ? new Error(e.message) : e); };
    w.postMessage({ t: 'init' });
  });
}
