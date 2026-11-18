// ================= camera =================
const cam = { theta: -.55, el: .42, r: 27, tTheta: -.55, tEl: .42, tR: 27, target: new THREE.Vector3(0, 2.4, 0) };
function applyCamera(dt) {
  const k = 1 - Math.pow(.0005, dt);
  if (cam.tTarget) { cam.target.lerp(cam.tTarget, k); if (cam.target.distanceTo(cam.tTarget) < .01) cam.tTarget = null; }
  cam.theta += (cam.tTheta - cam.theta) * k; cam.el += (cam.tEl - cam.el) * k; cam.r += (cam.tR - cam.r) * k;
  const c = Math.cos(cam.el);
  camera.position.set(cam.target.x + Math.sin(cam.theta) * c * cam.r, cam.target.y + Math.sin(cam.el) * cam.r, cam.target.z + Math.cos(cam.theta) * c * cam.r);
  camera.lookAt(cam.target);
  if (shake > .01 && SAVE.calm) shake = 0;
  if (shake > .01) { camera.position.x += rand(-1, 1) * shake; camera.position.y += rand(-1, 1) * shake; shake *= Math.pow(.02, dt); }
}
function orbit(dTheta, dEl) {
  cam.tTheta += dTheta;
  cam.tEl = clamp(cam.tEl + dEl, .06, 1.35);
}
// smart framing: fit the whole build in view
function fitView() {
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], n = 0;
  for (const o of objs) { if (o.gone || o.type !== 'block') continue; const a = o.body.getAABB(); n++;
    lo = [Math.min(lo[0], a.lowerBound.x), Math.min(lo[1], a.lowerBound.y), Math.min(lo[2], a.lowerBound.z)]; hi = [Math.max(hi[0], a.upperBound.x), Math.max(hi[1], a.upperBound.y), Math.max(hi[2], a.upperBound.z)]; }
  if (!n) { cam.tTarget = new THREE.Vector3(0, 2.4, 0); cam.tR = 27; return; }
  const size = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  cam.tTarget = new THREE.Vector3((lo[0] + hi[0]) / 2, Math.max(1.5, (hi[1] - lo[1]) * .42), (lo[2] + hi[2]) / 2);
  cam.tR = clamp(size * 1.35 + 6, mode === 'throw' ? 11 : 7, 95);
}
function zoom(f) { cam.tR = clamp(cam.tR * f, mode === 'throw' ? 11 : 7, 95); }

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 68 : 52; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
}
addEventListener('resize', resize);

