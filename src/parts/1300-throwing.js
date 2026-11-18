// ================= throwing =================
let held = null, heldKey = null, curSize = 1, aim = null;
const trajGeo = new THREE.BufferGeometry(); const trajPos = new Float32Array(160 * 3);
trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPos, 3));
const traj = new THREE.Points(trajGeo, new THREE.PointsMaterial({ color: 0xffffff, size: .16, transparent: true, opacity: .9, depthWrite: false }));
traj.frustumCulled = false; scene.add(traj);
const marker = new THREE.Mesh(new THREE.RingGeometry(.32, .5, 36), new THREE.MeshBasicMaterial({ color: 0x4cff7a, transparent: true, opacity: .95, depthTest: false, side: THREE.DoubleSide }));
marker.renderOrder = 999; marker.visible = false; scene.add(marker);
const markerDot = new THREE.Mesh(new THREE.CircleGeometry(.1, 16), marker.material); marker.add(markerDot);

const sizeF = () => SIZES[curSize][1];
function launchOrigin() {
  const f = new THREE.Vector3(); camera.getWorldDirection(f);
  const d = 3 + sizeF() * 1.3, half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * d;
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const o = camera.position.clone().addScaledVector(f, d).addScaledVector(up, -half * .5);
  o.y = Math.max(o.y, .8 * sizeF());
  return o;
}
function pickTarget(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...pickables(), pad, groundMesh], false);
  if (!hits.length) return { p: raycaster.ray.at(60, new THREE.Vector3()), n: null };
  const h = hits[0], ho = objFromHit(h); let n = new THREE.Vector3(0, 1, 0);
  if (ho && h.face) { const q = ho.body.quaternion; n = h.face.normal.clone().applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)); }
  return { p: h.point.clone(), n };
}
const chargeOf = a => { const t = clamp((performance.now() - a.t0) / CHARGE_MS, 0, 1); return 1 - (1 - t) * (1 - t); };
// launch velocity that passes through the target at speed v (flatter, faster arc); falls short if v is too low
function solveVelocity(from, to, v) {
  const g = -GRAV, dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y, D = Math.hypot(dx, dz) || .001;
  const v2 = v * v, disc = v2 * v2 - g * (g * D * D + 2 * dy * v2);
  const reach = disc >= 0, th = reach ? Math.atan((v2 - Math.sqrt(disc)) / (g * D)) : Math.PI / 4;
  return { vel: new THREE.Vector3(dx / D * v * Math.cos(th), v * Math.sin(th), dz / D * v * Math.cos(th)), reach };
}
function throwProj(vel, target, pw = 1) {
  const ok = useAmmo();
  if (ok === false && chal && !chal.ammo.some(q => q.n > 0) && !(chal.pool && chal.pool.n > 0)) toast('Out of shots — tap Restart to try again', 'warn');
  if (!ok) return;
  coach('shoot'); const nBefore = objs.length;
  throwProj0(vel, target, pw);
  const o = objs.slice(nBefore).find(q => q.type === 'proj'); if (o) followShot(o); else { if (followOn && !homeTarget && mode === 'throw') homeTarget = cam.target.clone(); followBoom(target); }
}
function throwProj0(vel, target, pw) {
  if (PROJ[curProj].special) { throwSpecial(curProj, vel, target, pw); return; }
  const p = PROJ[curProj], f = sizeF(), o0 = launchOrigin();
  let shape;
  if (p.shape === 'sphere') shape = { kind: 'ball', r: p.r * f };
  else if (p.shape === 'box') shape = { kind: 'box', hx: p.size[0] / 2 * f, hy: p.size[1] / 2 * f, hz: p.size[2] / 2 * f };
  else shape = { kind: 'hull', points: new Float32Array(rockData(p.r * f).v.flat()), radius: p.r * f * 1.15, vol: 4 / 3 * Math.PI * (p.r * f) ** 3 * .8 };
  let quat = new Q4();
  if (p.shape === 'box') { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), vel.clone().normalize()); quat = new Q4(q.x, q.y, q.z, q.w); }
  const body = new P.PBody({ shape, mass: p.mass * f * f * f, pos: new V3(o0.x, o0.y, o0.z), quat, fric: .5, rest: p.rest, ccd: true, ld: 0, ad: .1 });
  body.velocity.set(vel.x, vel.y, vel.z); body.angularVelocity.set(rand(-3, 3), rand(-3, 3), rand(-3, 3));
  const o = addObj({ body, mesh: makeProjMesh(curProj, f), type: 'proj', kind: curProj, bomb: !!p.bomb, power: Math.pow(f, .8), launched: true, born: simTime });
  const projs = objs.filter(q => q.type === 'proj' && !q.gone && !q.noCap);
  if (projs.length > 8) removeObj(projs[0]);
  snd.whoosh();
}
function updateAim() {
  const chg = $('charge');
  if (mode !== 'throw') { if (held) held.visible = false; traj.visible = marker.visible = false; chg.style.opacity = 0; return; }
  const key = curProj + curSize;
  if (heldKey !== key) { if (held) scene.remove(held); held = makeProjMesh(curProj, PROJ[curProj].special ? .6 : Math.min(sizeF(), 1.2)); held.traverse(m => m.castShadow = false); heldKey = key; scene.add(held); }
  held.visible = true;
  const o = launchOrigin();
  { const f = new THREE.Vector3(); camera.getWorldDirection(f); const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 4.2;
    held.position.copy(camera.position).addScaledVector(f, 4.2).addScaledVector(up, -half * .66); }
  held.rotation.y += .01;
  if (!aim) { traj.visible = marker.visible = false; chg.style.opacity = 0; return; }
  const pw = chargeOf(aim), v = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * pw;
  let { vel, reach } = solveVelocity(o, aim.target.p, v);
  const st = PROJ[curProj].style, straight = curProj === 'rocket' || st === 'beam', noArc = curProj === 'meteor' || st === 'strike';
  if (straight || noArc) reach = true;
  aim.vel = vel;
  held.position.x += rand(-1, 1) * .04 * pw; held.position.y += rand(-1, 1) * .04 * pw;
  // trajectory preview
  let n = 0; const p = o.clone(), vv = vel.clone(), dt = 1 / 40;
  if (straight) { const tp = aim.target.p; for (let i = 2; i <= 40; i++) { const k = i / 40; trajPos[n * 3] = o.x + (tp.x - o.x) * k; trajPos[n * 3 + 1] = o.y + (tp.y - o.y) * k; trajPos[n * 3 + 2] = o.z + (tp.z - o.z) * k; n++; } }
  else if (!noArc) for (let i = 0; i < 320 && n < 160; i++) {
    vv.y += GRAV * dt; p.addScaledVector(vv, dt); if (p.y < 0) break;
    if (i > 1 && i % 2 === 0) { trajPos[n * 3] = p.x; trajPos[n * 3 + 1] = p.y; trajPos[n * 3 + 2] = p.z; n++; }
    if (reach && p.distanceTo(aim.target.p) < .4) break;
  }
  trajGeo.setDrawRange(0, n); trajGeo.attributes.position.needsUpdate = true; traj.visible = true;
  // target marker
  const t = aim.target; marker.visible = true;
  marker.position.copy(t.p).addScaledVector(t.n || new THREE.Vector3(0, 1, 0), .04);
  marker.lookAt(marker.position.clone().add(t.n || camera.position.clone().sub(t.p).normalize()));
  marker.scale.setScalar((.8 + .4 * Math.sin(performance.now() / 120)) * Math.max(1, camera.position.distanceTo(t.p) / 18) * (noArc ? (PROJ[curProj].aoe || 12) : 1));
  marker.material.color.set(reach ? 0x4cff7a : 0xffa53a);
  // charge ring at the finger
  chg.style.opacity = 1; chg.style.left = aim.x + 'px'; chg.style.top = aim.y + 'px';
  chg.style.setProperty('--p', pw.toFixed(3));
  $('chargeTxt').textContent = noArc ? 'Release to call it in' : st === 'beam' ? 'Release to fire' : reach ? Math.round(pw * 100) + '%' : (pw >= 1 ? 'Too far' : 'Hold…');
}

