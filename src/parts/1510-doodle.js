// ================= Doodle art style: the 3D view as a hand-drawn sketch =================
// One full-screen pass over the normal render: wobbly ink outlines (from depth and colour edges),
// crayon-flat colour, pencil hatching in shadow, paper grain, and notebook paper where the sky was.
// Lines "boil" (re-jitter) a few times a second like hand-drawn animation; Reduce motion holds them still.
// Works for everything in the scene with no per-object changes, so blocks, weapons and effects all match.

let doodleRT = null, doodleQuad = null, doodleScene = null, doodleCam = null;
const DOODLE_FRAG = `
precision highp float;
uniform sampler2D tCol; uniform sampler2D tDep;
uniform vec2 uRes; uniform float uTime, uNear, uFar, uPx, uExp, uNight;
uniform vec3 uPaper, uInk, uRule;
varying vec2 vUv;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float lin(float d) { float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
vec3 aces(vec3 x) { x *= uExp; return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
vec3 shade(vec2 uv) { return pow(aces(texture2D(tCol, uv).rgb * (1. + uNight * 1.6)), vec3(1. / 2.2)); }   // night: lift the dark scene so chalk shading stays selective
float lum(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
void main() {
  vec2 px = 1. / uRes, frag = vUv * uRes;
  float t = floor(uTime * 4.);                                  // boil: lines redraw 4× a second
  vec2 wob = (vec2(vn(frag / (34. * uPx) + t * 3.1), vn(frag / (34. * uPx) + t * 1.7 + 19.)) - .5) * 2.6 * uPx * px;
  vec2 uv = vUv + wob;
  float dC = texture2D(tDep, uv).r;
  // ---- paper (and the sky becomes ruled notebook paper) ----
  float grain = vn(frag * .9) * .5 + vn(frag * .23) * .5;
  vec3 paper = uPaper * (.955 + .06 * grain);
  if (dC > .99995) {
    vec2 g = frag / uPx;
    float e = 15. - abs(mod(g.y + 7., 30.) - 15.);                   // distance to the nearest ruled line
    float rule = (1. - smoothstep(.35, 1.2, e)) * .6;
    float margin = smoothstep(1.4, 0., abs(g.x - 46.)) * .7;
    vec3 sky = mix(paper, uRule, rule);
    sky = mix(sky, vec3(.93, .45, .45), margin * (1. - uNight));
    gl_FragColor = vec4(sky, 1.); return;
  }
  // ---- ink outlines: depth discontinuities (silhouettes) + colour edges (block faces, seams) ----
  vec2 o = px * 1.25 * uPx;
  float zc = lin(dC);
  float zl = lin(texture2D(tDep, uv - vec2(o.x, 0.)).r), zr = lin(texture2D(tDep, uv + vec2(o.x, 0.)).r);
  float zu = lin(texture2D(tDep, uv + vec2(0., o.y)).r), zd = lin(texture2D(tDep, uv - vec2(0., o.y)).r);
  float dz = (abs(zl + zr - 2. * zc) + abs(zu + zd - 2. * zc)) / zc;
  float eD = smoothstep(.018, .06, dz);
  float l0 = lum(shade(uv));
  float gx = lum(shade(uv + vec2(o.x, 0.))) - lum(shade(uv - vec2(o.x, 0.)));
  float gy = lum(shade(uv + vec2(0., o.y))) - lum(shade(uv - vec2(0., o.y)));
  float eC = smoothstep(.07, .2, length(vec2(gx, gy))) * smoothstep(60., 18., zc);   // fade fine detail in the distance
  float pressure = .75 + .25 * vn(frag / (9. * uPx) + t);                            // uneven pen pressure
  float ink = clamp(max(eD, eC * .8) * pressure, 0., 1.);
  // ---- crayon fill: flatter, chalkier colour on the paper ----
  vec3 c = shade(vUv);
  float L = lum(c);
  vec3 crayon = mix(vec3(L), c, 1.12);
  float band = floor(L * 4. + .5) / 4.;                         // posterise brightness into 4 crayon pressures
  crayon *= mix(1., band / max(L, .05), .55);
  float tooth = .86 + .14 * vn(frag * vec2(.55, 1.6) / uPx);    // crayon skips over the paper tooth
  vec3 fill = mix(paper, crayon * paper, .92 * tooth);
  // ---- pencil hatching in shadow: one direction, then cross-hatch in deep shadow ----
  vec2 hp = frag / uPx;
  float h1 = smoothstep(.55, .25, L) * (1. - smoothstep(.45, 1.25, abs(mod(hp.x + hp.y, 7.) - 3.5)));
  float h2 = smoothstep(.32, .12, L) * (1. - smoothstep(.45, 1.15, abs(mod(hp.x - hp.y, 6.) - 3.)));
  float hatch = max(h1 * .5, h2 * .6) * (.7 + .3 * vn(hp * .2 + t));
  fill = mix(fill, uInk, hatch * mix(.55, .3, uNight));
  gl_FragColor = vec4(mix(fill, uInk, ink * .92), 1.);
}`;

function doodleSetup() {
  if (doodleQuad) return;
  doodleRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: true });
  doodleRT.depthTexture = new THREE.DepthTexture(2, 2); doodleRT.depthTexture.type = THREE.UnsignedIntType;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tCol: { value: doodleRT.texture }, tDep: { value: doodleRT.depthTexture }, uRes: { value: new THREE.Vector2(2, 2) }, uTime: { value: 0 },
      uNear: { value: camera.near }, uFar: { value: camera.far }, uPx: { value: 1 }, uExp: { value: 1.05 }, uNight: { value: 0 },
      uPaper: { value: new THREE.Vector3() }, uInk: { value: new THREE.Vector3() }, uRule: { value: new THREE.Vector3() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: DOODLE_FRAG, depthTest: false, depthWrite: false, toneMapped: false
  });
  doodleQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); doodleQuad.frustumCulled = false;
  doodleScene = new THREE.Scene(); doodleScene.add(doodleQuad); doodleCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}
const DOODLE_DAY = { paper: [.985, .965, .918], ink: [.16, .17, .22], rule: [.62, .78, .93], fog: 0xf6efe0 };
const DOODLE_NIGHT = { paper: [.13, .19, .25], ink: [.92, .94, .9], rule: [.3, .42, .5], fog: 0x203040 };
function doodleRender() {
  doodleSetup();
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2()), w = sz.x | 0, h = sz.y | 0;
  if (doodleRT.width !== w || doodleRT.height !== h) doodleRT.setSize(w, h);
  const u = doodleQuad.material.uniforms, P = night ? DOODLE_NIGHT : DOODLE_DAY;
  u.uRes.value.set(w, h); u.uPx.value = renderer.getPixelRatio(); u.uNear.value = camera.near; u.uFar.value = camera.far;
  u.uTime.value = SAVE.calm ? 0 : performance.now() / 1000; u.uExp.value = renderer.toneMappingExposure; u.uNight.value = night ? 1 : 0;
  u.uPaper.value.set(...P.paper); u.uInk.value.set(...P.ink); u.uRule.value.set(...P.rule);
  const fog = scene.fog.color.getHex(); scene.fog.color.setHex(P.fog);   // distance fades into paper, not sky blue
  renderer.setRenderTarget(doodleRT); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(doodleScene, doodleCam);
  scene.fog.color.setHex(fog);
}
// art style switch: 'classic' (default) or 'doodle'; drives both the 3D pass and the UI skin
function applyArt() {
  const d = SAVE.art === 'doodle';
  document.body.classList.toggle('doodle', d);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) { if (!m.dataset.orig) m.dataset.orig = m.content; m.content = d ? '#f7f1e3' : m.dataset.orig; }
}
