// ================= particles =================
const MAXP = 2600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 500 } }, transparent: true, depthWrite: false,
  vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
    void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*uScale/-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vC, vA*smoothstep(.5,.15,d)); }`
});
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; scene.add(pPoints);
let parts = [];
// ---- smoke: big soft textured puffs that billow, drift and fade ----
const SMOKE_MAX = 900;
const smokeTex = canvasTex(128, 128, (c, w, h) => {
  for (let i = 0; i < 26; i++) { const x = 64 + rand(-26, 26), y = 64 + rand(-26, 26), r = rand(16, 34), g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${rand(.25, .45)})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
});
const sGeo = new THREE.BufferGeometry(), sPos = new Float32Array(SMOKE_MAX * 3), sCol = new Float32Array(SMOKE_MAX * 3), sSize = new Float32Array(SMOKE_MAX), sAlpha = new Float32Array(SMOKE_MAX), sRot = new Float32Array(SMOKE_MAX);
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
sGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1)); sGeo.setAttribute('alpha', new THREE.BufferAttribute(sAlpha, 1)); sGeo.setAttribute('rot', new THREE.BufferAttribute(sRot, 1));
const sMat = new THREE.ShaderMaterial({ uniforms: { uScale: pMat.uniforms.uScale, map: { value: smokeTex } }, transparent: true, depthWrite: false,
  vertexShader: `attribute float size; attribute float alpha; attribute float rot; attribute vec3 color; varying vec3 vC; varying float vA; varying float vR; uniform float uScale;
    void main(){ vC=color; vA=alpha; vR=rot; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*uScale/-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; varying float vR;
    void main(){ vec2 p=gl_PointCoord-.5; float c=cos(vR), s=sin(vR); p=vec2(c*p.x-s*p.y, s*p.x+c*p.y)+.5; vec4 t=texture2D(map,p);
      float shade=.75+.35*(1.-gl_PointCoord.y); gl_FragColor=vec4(vC*shade, t.a*vA); }` });
const sPoints = new THREE.Points(sGeo, sMat); sPoints.frustumCulled = false; sPoints.renderOrder = 2; scene.add(sPoints);
let smokes = [];
function spawnSmoke(x, y, z, vx, vy, vz, life, size, col = [.35, .34, .33], alpha = .7) {
  const cap = !SAVE || SAVE.quality === 'high' ? SMOKE_MAX : SAVE.quality === 'lite' ? SMOKE_MAX / 4 : SMOKE_MAX / 2; if (smokes.length >= cap) smokes.shift();
  smokes.push({ x, y, z, vx, vy, vz, t: 0, life, size, col, alpha, r: rand(0, 6.28), w: rand(-.6, .6) });
}
function updateSmoke(dt) {
  let n = 0; smokes = smokes.filter(p => (p.t += dt) < p.life);
  for (const p of smokes) {
    const drag = Math.pow(.35, dt); p.vx *= drag; p.vz *= drag; p.vy = p.vy * drag + .9 * dt; p.x += (p.vx + .35) * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += p.w * dt;
    const k = p.t / p.life; sPos[n * 3] = p.x; sPos[n * 3 + 1] = p.y; sPos[n * 3 + 2] = p.z;
    sCol[n * 3] = p.col[0]; sCol[n * 3 + 1] = p.col[1]; sCol[n * 3 + 2] = p.col[2];
    sSize[n] = p.size * (.5 + 1.6 * Math.sqrt(k)); sAlpha[n] = p.alpha * Math.min(1, k * 6) * (1 - k) * (1 - k); sRot[n] = p.r; n++;
  }
  sGeo.setDrawRange(0, n); for (const a of ['position', 'color', 'size', 'alpha', 'rot']) sGeo.attributes[a].needsUpdate = true;
}
function spawnP(x, y, z, vx, vy, vz, life, col, size, grav, grow, alpha = 1) {
  if (parts.length >= (SAVE && SAVE.quality === 'lite' ? MAXP / 2 : MAXP)) parts.shift();
  parts.push({ x, y, z, vx, vy, vz, t: 0, life, col, size, grav, grow, alpha });
}
function updateParticles(dt) {
  updateSmoke(dt);
  let n = 0;
  parts = parts.filter(p => (p.t += dt) < p.life);
  for (const p of parts) {
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < .05) { p.y = .05; p.vy *= -.3; p.vx *= .7; p.vz *= .7; }
    const k = p.t / p.life;
    pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z;
    pCol[n * 3] = p.col[0]; pCol[n * 3 + 1] = p.col[1]; pCol[n * 3 + 2] = p.col[2];
    pSize[n] = p.size * (1 + p.grow * k); pAlpha[n] = p.alpha * (1 - k * k);
    n++;
  }
  pGeo.setDrawRange(0, n);
  for (const a of ['position', 'color', 'size', 'alpha']) pGeo.attributes[a].needsUpdate = true;
}

