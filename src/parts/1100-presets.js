// ================= presets =================
// layers touch exactly: any vertical gap makes a woken stack free-fall layer by layer and slam together
const G = 1.005, LAY = 1.0;
const CUBE = m => Bx(m, 1, 1, 1);
const PRESETS = [
  { id: 'castle', name: 'Grand Castle', emoji: '🏰', desc: 'Spired towers, gatehouse, battlements & a TNT keep', cam: [31, 3, .42], build() {
    const S = CUBE('stone'), LS = Bx('stone', 2, 1, 1), LIN = Bx('stone', 5, 1, 1);
    // corner towers: 2x2, 6 high, with windows and a big spire
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (let L = 0; L < 6; L++) for (const dx of [5, 6]) for (const dz of [5, 6])
        put(L === 3 && dx === 6 && dz === 6 ? CUBE('glass') : S, sx * dx * G, L * LAY, sz * dz * G);
      put(Co('roof', 1.45, 2.6), sx * 5.5 * G, 6 * LAY, sz * 5.5 * G);
    }
    // curtain walls with staggered masonry
    function wall(alongX, fixed, gate) {
      const P = (a, y, sp) => alongX ? put(sp, a * G, y, fixed * G, 0) : put(sp, fixed * G, y, a * G, Math.PI / 2);
      for (let c = 0; c < 3; c++) {
        const y = c * LAY;
        if (gate && c < 2) { for (const a of [-4, -3, -2, 2, 3, 4]) P(a, y, c === 1 && Math.abs(a) === 3 ? CUBE('glass') : S); continue; }
        if (gate && c === 2) { for (const a of [-4, -3, 3, 4]) P(a, y, S); P(0, y, LIN); continue; }
        if (c % 2 === 0) { for (const a of [-3.5, -1.5, .5, 2.5]) P(a, y, LS); P(4, y, S); }
        else { P(-4, y, S); for (const a of [-2.5, -.5, 1.5, 3.5]) P(a, y, LS); }
      }
      for (const a of [-4, -2, 0, 2, 4]) P(a, 3 * LAY, S);
    }
    wall(true, 5, true); wall(true, -5); wall(false, 5); wall(false, -5);
    // gatehouse flags: small spires over the gate
    put(Co('roof', .55, 1.1), -4 * G, 4 * LAY, 5 * G); put(Co('roof', .55, 1.1), 4 * G, 4 * LAY, 5 * G);
    // central keep: hollow 3x3 ring with TNT inside, beam roof, lookout and spire
    put(CUBE('tnt'), 0, 0, 0);
    for (let L = 0; L < 4; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (!i && !j) continue;
      put(L === 2 && (i === 0 || j === 0) ? CUBE('glass') : (L % 2 ? Bx('wood', 1, 1, 1) : S), i * G, L * LAY, j * G);
    }
    for (const j of [-1, 0, 1]) put(Bx('wood', 3, .4, 1), 0, 4 * LAY, j * G);
    const ty = 4 * LAY + .404;
    put(S, 0, ty, 0); put(CUBE('glass'), 0, ty + LAY, 0); put(Co('roof', .75, 1.5), 0, ty + 2 * LAY, 0);
  } },
  { id: 'temple', name: 'Greek Temple', emoji: '🏛️', desc: 'Marble columns, beams & a tiled pediment roof', cam: [20, 2.2, .3], build() {
    for (const x of [-3, -1, 1, 3]) for (const z of [-2, 0, 2]) put(Bx('marble', 2, .4, 2), x * G, 0, z * G);
    put(Bx('marble', 8.3, .2, .6), 0, 0, 3.35);
    const y0 = .404;
    for (const z of [-2.2, 2.2]) for (const x of [-3, -1.5, 0, 1.5, 3]) {
      put(Cy('marble', .3, 1.5, .34), x * G, y0, z); put(Cy('marble', .3, 1.5), x * G, y0 + 1.504, z);
      put(Bx('marble', .8, .25, .8), x * G, y0 + 3.008, z);
    }
    const yb = y0 + 3.008 + .254;
    for (const z of [-2.2, 2.2]) for (const x of [-1.5075, 1.5075]) put(Bx('marble', 3, .4, .8), x, yb, z);
    for (const x of [-2.25, -.75, .75, 2.25]) put(We('roof', 1.49, 1.4, 5.8), x * G, yb + .404, 0);
    put(CUBE('tnt'), 0, y0, 0); put(Bx('glass', .7, 1.6, .7), 0, y0 + LAY, 0);
  } },
  { id: 'henge', name: 'Stonehenge', emoji: '🗿', desc: 'A ring of standing stones with lintels on top', cam: [20, 1.6, .38], build() {
    const n = 12, R = 4.4, up = Bx('stone', .8, 2.6, .5);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; put(up, R * Math.sin(a), 0, R * Math.cos(a), a); }
    for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2, r = R * Math.cos(Math.PI / n);
      put(Bx('stone', 2, .45, .5), r * Math.sin(a), 2.604, r * Math.cos(a), a); }
    const big = Bx('stone', .9, 3.2, .6);
    for (const deg of [180, 125, 235, 70, 290]) {
      const a = deg * Math.PI / 180, r = 2.3, cx = r * Math.sin(a), cz = r * Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
      put(big, cx + tx * .56, 0, cz + tz * .56, a); put(big, cx - tx * .56, 0, cz - tz * .56, a);
      put(Bx('stone', 2.1, .5, .6), cx, 3.204, cz, a);
    }
    put(Bx('stone', 2, .4, .8), 0, 0, 0);
  } },
  { id: 'pagoda', name: 'Pagoda', emoji: '🏯', desc: 'Five tiers of lacquered posts & wide tiled eaves', cam: [21, 3.5, .3], build() {
    put(Bx('stone', 6, .5, 6), 0, 0, 0);
    let y = .504;
    put(CUBE('tnt'), 0, y, 0);
    for (let i = 0; i < 5; i++) {
      const w = 4.6 - i * .85, p = w / 2 - .2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(Bx('lacquer', .35, 1.3, .35), sx * p, y, sz * p);
      if (i < 3) for (const sx of [-1, 1]) put(Bx('glass', .2, 1, w - 1.1), sx * p, y, 0);
      put(Bx('roof', w + 1.3, .28, w + 1.3), 0, y + 1.304, 0);
      y += 1.304 + .284;
    }
    put(Cy('lacquer', .18, 1.2, .25), 0, y, 0); put(Co('lacquer', .3, .8), 0, y + 1.204, 0);
  } },
  { id: 'colosseum', name: 'Colosseum', emoji: '🏟️', desc: 'Three rings of arches around a TNT arena', cam: [24, 1.5, .45], build() {
    const n = 28, R = 5.5;
    for (let L = 0; L < 3; L++) for (let i = 0; i < n; i++) {
      if (L === 2 && i % 2) continue;
      const a = i / n * Math.PI * 2;
      put(L === 1 && i % 2 ? CUBE('glass') : CUBE('stone'), R * Math.sin(a), L * LAY, R * Math.cos(a), a);
    }
    for (const [x, z] of [[0, 0], [1.5, 1], [-1.5, -1]]) put(CUBE('tnt'), x, 0, z);
    for (let i = 0; i < 3; i++) put(CUBE('wood'), -1.5, i * LAY, 1.5);
  } },
  { id: 'downtown', name: 'Downtown', emoji: '🏙️', desc: 'Glass skyscrapers — watch the floors pancake', cam: [26, 4.5, .35], build() {
    const bl = [[-4, -3, 9, 2], [-1, -4, 6, 2], [3, -3, 11, 2], [4, 1.5, 5, 2], [-3.5, 2, 4, 2.4], [.5, .5, 7, 1.6]];
    for (const [x, z, fl, w] of bl) {
      let y = 0;
      for (let f = 0; f < fl; f++) { put(Bx('glass', w, .9, w), x, y, z); y += .904; put(Bx('concrete', w + .3, .22, w + .3), x, y, z); y += .224; }
      if (fl >= 9) put(Bx('concrete', .15, 1.2, .15), x, y, z);
    }
  } },
  { id: 'domino', name: 'Domino Run', emoji: '🎲', desc: 'Dominoes that grow bigger — hit the first one!', cam: [22, 1.5, .55], build() {
    const X = t => -5.2 + 9.8 * t, Z = t => 4.6 - 9 * t + 2.1 * Math.sin(t * 3 * Math.PI);
    let acc = 0, px = X(0), pz = Z(0), last = null; const sOf = t => .9 + 1.6 * t ** 1.4;
    for (let t = 0; t <= 1; t += .0005) {
      const x = X(t), z = Z(t); acc += Math.hypot(x - px, z - pz); px = x; pz = z;
      const s = sOf(t);
      if (last === null || acc >= .5 * s) {
        acc = 0; const tx = X(t + .001) - x, tz = Z(t + .001) - z, l = Math.hypot(tx, tz);
        put(Bx('domino', .16 * s, .95 * s, .42 * s), x, 0, z, Math.atan2(-tz / l, tx / l));
        last = { x, z, tx: tx / l, tz: tz / l, s };
      }
    }
    const d1 = last.s * .95 * .8 + .5, ex = last.x + last.tx * d1, ez = last.z + last.tz * d1;
    put(CUBE('tnt'), ex, 0, ez, Math.atan2(-last.tz, last.tx));
    const gx = ex + last.tx * 1.6, gz = ez + last.tz * 1.6;
    for (let i = 0; i < 4; i++) put(CUBE(i === 3 ? 'stone' : 'glass'), gx, i * LAY, gz, Math.atan2(-last.tz, last.tx));
  } },
  { id: 'jenga', name: 'Jenga Tower', emoji: '🪵', desc: 'Sixteen crisscrossed layers of planks', cam: [18, 3, .32], build() {
    for (let L = 0; L < 16; L++) {
      const y = L * .405;
      for (const s of [-.505, .505]) L % 2 === 0 ? put(Bx('wood', 2, .4, 1), 0, y, s) : put(Bx('wood', 2, .4, 1), s, y, 0, Math.PI / 2);
    }
  } },
  { id: 'pyramid', name: 'Pyramid', emoji: '🔺', desc: 'Stepped stone pyramid with a TNT capstone', cam: [21, 2, .4], build() {
    const kinds = ['stone', 'stone', 'wood', 'glass', 'tnt'];
    for (let L = 0; L < 5; L++) { const n = 5 - L;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) put(CUBE(kinds[L]), (i - (n - 1) / 2) * G, L * LAY, (j - (n - 1) / 2) * G); }
  } }
];
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// local frame helper: place pieces relative to (cx, cz) rotated by a
function frame(cx, cz, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return (spec, lx, y, lz, rot = 0) => put(spec, cx + lx * c + lz * s, y, cz - lx * s + lz * c, a + rot);
}
const MEGA = [
  { id: 'citadel', mega: true, arena: 16, name: 'The Citadel', emoji: '👑', desc: 'Two rings of walls, 18 towers, a 24-story keep, 30 buildings — the ultimate smash', cam: [82, 4, .55], build() {
    const S = CUBE('stone'), GL = CUBE('glass'), W = CUBE('wood'), occ = new Set(), ck = (x, z) => x + ',' + z;
    const P = (sp, x, L, z, rot) => put(sp, x * G, L * LAY, z * G, rot);
    const tower = (cx, cz, h, sr) => {
      for (let L = 0; L < h; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue; P(L % 4 === 3 && (i === 0 || j === 0) ? GL : S, cx + i, L, cz + j);
      }
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P(S, cx + i, h, cz + j);
      put(Co('roof', sr, sr * 1.75), cx * G, (h + 1) * LAY, cz * G);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) occ.add(ck(cx + i, cz + j));
    };
    const wall = (h, courses, gate) => {
      const cells = [];
      for (let a = -h; a <= h; a++) cells.push([a, h], [a, -h]);
      for (let a = -h + 1; a < h; a++) cells.push([h, a], [-h, a]);
      for (let c = 0; c < courses; c++) for (const [x, z] of cells) {
        if (occ.has(ck(x, z))) continue;
        if (gate && z === h && c < 3 && Math.abs(x) <= 1) continue;
        if (gate && z === h && c === 3 && Math.abs(x) <= 2) { if (x === 0) P(Bx('stone', 5, 1, 1), 0, 3, h); continue; }
        P(c === courses - 3 && (x + z) % 4 === 0 ? GL : S, x, c, z);
      }
      for (const [x, z] of cells) if (!occ.has(ck(x, z)) && (x + z) % 2 === 0) P(S, x, courses, z);
    };
    // building: 3x3 hollow, `h` floors (stone below, timber above), tiled roof
    const house = (cx, cz, h, rot) => {
      const F = frame(cx * G, cz * G, rot);
      for (let L = 0; L < h; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue; F((L % 2 === 1 && (i === 0 || j === 0)) ? GL : (L < 2 ? S : W), i * G, L * LAY, j * G);
      }
      F(We('roof', 3.3, 1.3, 3.5), 0, h * LAY, 0);
    };
    // outer ring (half-size 14): corner, mid-wall and gate towers, 11-course walls
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * 14, sz * 14, 15, 2.15);
    for (const s of [-1, 1]) { tower(s * 7, 14, 13, 1.9); tower(s * 7, -14, 13, 1.9); tower(14, s * 7, 13, 1.9); tower(-14, s * 7, 13, 1.9); }
    for (const s of [-1, 1]) tower(s * 3, 14, 10, 1.6);
    wall(14, 11, true);
    // inner ring (half-size 8): tall corner towers, 12-course walls
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * 8, sz * 8, 17, 2.15);
    wall(8, 12, true);
    // the keep: 9x9 ring (12 floors) -> timber floor -> 5x5 ring -> floor -> 3x3 lantern -> spire, 9 TNT in the cellar
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) P(CUBE('tnt'), i, 0, j);
    for (let L = 0; L < 12; L++) for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      if (Math.abs(i) < 4 && Math.abs(j) < 4) continue;
      P(L % 3 === 1 && (Math.abs(i) <= 1 || Math.abs(j) <= 1) ? GL : (L % 2 ? CUBE('marble') : S), i, L, j);
    }
    for (let j = -4; j <= 4; j++) put(Bx('wood', 9, .4, 1), 0, 12 * LAY, j * G);
    let y = 12 * LAY + .404;
    for (let L = 0; L < 5; L++) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      if (Math.abs(i) < 2 && Math.abs(j) < 2) continue; put(L === 2 && (i === 0 || j === 0) ? GL : S, i * G, y + L * LAY, j * G);
    }
    y += 5 * LAY; for (let j = -2; j <= 2; j++) put(Bx('wood', 5, .4, 1), 0, y, j * G);
    y += .404;
    for (let L = 0; L < 4; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { if (!i && !j) continue; put(L === 1 ? GL : CUBE('gold'), i * G, y + L * LAY, j * G); }
    put(Co('roof', 1.6, 3), 0, y + 4 * LAY, 0);
    // inner courtyard: 10 storehouses
    for (const [x, z] of [[6, -3], [6, 0], [6, 3], [-6, -3], [-6, 0], [-6, 3], [3, -6], [0, -6], [-3, -6], [3, 6]]) house(x, z, 3, x === 6 ? Math.PI / 2 : x === -6 ? -Math.PI / 2 : 0);
    house(-3, 6, 3, 0);
    // outer ring of town houses between the walls
    for (const a of [-8, -4, 0, 4, 8]) {
      house(a, -11, 5, 0); house(11, a, 5, Math.PI / 2); house(-11, a, 5, -Math.PI / 2);
      if (a !== 0) house(a, 11, 5, 0);
    }
  } },
  { id: 'fortress', mega: true, name: 'Mega Fortress', emoji: '🏰', desc: '11-story towers, thick walls, gatehouse, keep & courtyard huts', cam: [54, 4, .42], build() {
    const S = CUBE('stone'), GL = CUBE('glass'), W = CUBE('wood');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * 9, cz = sz * 9;
      for (let L = 0; L < 11; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue;
        put(L % 3 === 2 && (i === 0 || j === 0) ? GL : S, (cx + i) * G, L * LAY, (cz + j) * G);
      }
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(S, (cx + i) * G, 11 * LAY, (cz + j) * G);
      put(Co('roof', 2.15, 3.8), cx * G, 12 * LAY, cz * G);
    }
    const wall = (alongX, fixed, gate) => {
      const P = (a, y, sp) => alongX ? put(sp, a * G, y, fixed * G) : put(sp, fixed * G, y, a * G, Math.PI / 2);
      for (let c = 0; c < 6; c++) for (let a = -7; a <= 7; a++) {
        if (gate && c < 3 && Math.abs(a) <= 1) continue;
        if (gate && c === 3 && Math.abs(a) <= 2) { if (a === 0) P(0, c * LAY, Bx('stone', 5, 1, 1)); continue; }
        P(a, c * LAY, c === 3 && a % 4 === 0 ? GL : S);
      }
      for (let a = -6; a <= 6; a += 2) P(a, 6 * LAY, S);
    };
    wall(true, 9, true); wall(true, -9); wall(false, 9); wall(false, -9);
    for (let L = 0; L < 7; L++) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;
      put((L === 2 || L === 5) && (i === 0 || j === 0) ? GL : (L % 2 ? W : S), i * G, L * LAY, j * G);
    }
    for (const i of [-1, 0, 1]) put(CUBE('tnt'), i * G, 0, 0);
    for (let j = -2; j <= 2; j++) put(Bx('wood', 5, .4, 1), 0, 7 * LAY, j * G);
    const y0 = 7 * LAY + .404;
    put(S, 0, y0, 0); put(GL, 0, y0 + LAY, 0); put(S, 0, y0 + 2 * LAY, 0); put(Co('roof', .8, 1.6), 0, y0 + 3 * LAY, 0);
    for (const hx of [-5.5, 5.5]) for (const hz of [-5, 5]) {
      for (let L = 0; L < 2; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) put(W, (hx + dx) * G, L * LAY, (hz + dz) * G);
      put(We('roof', 2.2, 1, 2.4), hx * G, 2 * LAY, hz * G);
    }
  } },
  { id: 'gpyramid', mega: true, name: 'Great Pyramid', emoji: '🏜️', desc: '12-step sandstone pyramid hiding a gold & TNT chamber', cam: [36, 3, .4], build() {
    const N = 12;
    for (let L = 0; L < N; L++) { const n = N - L;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = (i - (n - 1) / 2), z = (j - (n - 1) / 2);
        let m = 'sand';
        if (L === 1 && Math.abs(x) <= 1 && Math.abs(z) <= 1) m = (x === 0 && z === 0) ? 'tnt' : 'gold';
        if (L === N - 1) m = 'gold';
        put(CUBE(m), x * G, L * LAY, z * G);
      } }
  } },
  { id: 'metropolis', mega: true, name: 'Metropolis', emoji: '🌆', desc: 'Sixteen glass & concrete towers up to 16 stories', cam: [48, 6, .4], build() {
    const R = rng(7), lots = [-7.5, -2.5, 2.5, 7.5];
    for (const lx of lots) for (const lz of lots) {
      const big = R() < .45, h = 4 + Math.floor(R() * (big ? 9 : 13));
      if (big) {
        for (let L = 0; L < h; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          if (!i && !j) continue;
          put(CUBE((i && j) || L % 4 === 0 ? 'concrete' : 'glass'), lx + i * G, L * LAY, lz + j * G);
        }
        put(Bx('concrete', 3.1, .3, 3.1), lx, h * LAY, lz);
        if (h >= 11) put(Cy('concrete', .08, 1.8), lx, h * LAY + .304, lz);
      } else {
        for (let L = 0; L < h; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5])
          put(CUBE(L % 3 === 2 ? 'concrete' : 'glass'), lx + dx * G, L * LAY, lz + dz * G);
        if (h >= 14) put(Cy('concrete', .07, 1.6), lx, h * LAY, lz);
      }
    }
  } },
  { id: 'dspiral', mega: true, name: 'Domino Spiral', emoji: '🌀', desc: '500 dominoes spiraling into a TNT-loaded glass tower', cam: [30, 1, .8], build() {
    const rMax = 10.3, rMin = 1.9, gap = 1.3, b = gap / (2 * Math.PI), phi0 = -.55;
    const at = th => { const r = rMax - b * th; return [r * Math.sin(th + phi0), r * Math.cos(th + phi0), r]; };
    let acc = 0, [px, pz] = at(0), last = null;
    for (let th = 0; ; th += .002) {
      const [x, z, r] = at(th); if (r < rMin) break;
      acc += Math.hypot(x - px, z - pz); px = x; pz = z;
      if (last === null || acc >= .5) {
        acc = 0; const [x2, z2] = at(th + .002), tx = x2 - x, tz = z2 - z, l = Math.hypot(tx, tz);
        put(Bx('domino', .18, 1.1, .55), x, 0, z, Math.atan2(-tz / l, tx / l));
        last = { x, z, tx: tx / l, tz: tz / l };
      }
    }
    put(CUBE('tnt'), last.x + last.tx * 1.4, 0, last.z + last.tz * 1.4, Math.atan2(-last.tz, last.tx));
    for (let L = 0; L < 5; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) put(CUBE(L === 4 ? 'gold' : 'glass'), dx * G, L * LAY, dz * G);
  } },
  { id: 'village', mega: true, name: 'Medieval Village', emoji: '🏘️', desc: 'Church & bell tower ringed by stone cottages and huts', cam: [40, 3, .5], build() {
    const S = CUBE('stone'), W = CUBE('wood'), GL = CUBE('glass');
    // church: 3x4 stone nave, tiled roof, 2x2 bell tower with spire
    for (let L = 0; L < 4; L++) for (let i = -1; i <= 1; i++) for (let j = -2; j <= 1; j++) {
      if (i === 0 && j > -2 && j < 1) continue;
      if (j === -2 && ((L < 2 && i === 0) || L === 2)) continue;           // door + lintel row
      put(L === 2 && i !== 0 && (j === -1 || j === 0) ? GL : S, i * G, L * LAY, j * G);
    }
    put(Bx('stone', 3, 1, 1), 0, 2 * LAY, -2 * G);                    // lintel over the door
    for (const z of [-1.5, .5]) put(We('roof', 2, 1.4, 3.4), 0, 4 * LAY, z * G, Math.PI / 2);
    for (let L = 0; L < 9; L++) for (const dx of [-.5, .5]) for (const dz of [2.5, 3.5]) put(L === 6 ? GL : S, dx * G, L * LAY, dz * G);
    put(Co('roof', 1.45, 2.6), 0, 9 * LAY, 3 * G);
    // inner ring: 8 small huts
    for (let k = 1; k < 7; k++) {
      const a = (k + .5) / 8 * Math.PI * 2, P = frame(5.3 * Math.sin(a), 5.3 * Math.cos(a), a);
      for (let L = 0; L < 2; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) P(W, dx * G, L * LAY, dz * G);
      P(We('roof', 2.3, 1, 2.5), 0, 2 * LAY, 0);
    }
    // outer ring: 12 two-story cottages (3x3 hollow, door facing the square, glass windows)
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, P = frame(8.6 * Math.sin(a), 8.6 * Math.cos(a), a);
      for (let L = 0; L < 4; L++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue;
        const win = (L === 1 || L === 3) && (i === 0 || j === 0);
        P(win ? GL : (L < 2 ? S : W), i * G, L * LAY, j * G);
      }
      P(We('roof', 3.3, 1.3, 3.5), 0, 4 * LAY, 0);
    }
  } }
];

// ---- ~1,000-block builds: stacked grid pieces only (no overlaps), so nothing pops apart when it wakes ----
const MEGA2 = [
  { id: 'skytower', mega: true, arena: 11, name: 'Sky Tower', emoji: '🏙️', desc: 'A 24-story glass & steel office tower with corner pinnacles', cam: [50, 8, .3], build() {
    // equal-sized cubes only (heavy floor plates make the columns buckle), and no taller than ~24 floors:
    // taller hollow stacks slowly drift apart if the whole tower is ever awake at once
    const n = 11;
    for (let L = 0; L < 24; L++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i > 0 && i < n - 1 && j > 0 && j < n - 1) continue;
      const corner = (i === 0 || i === n - 1) && (j === 0 || j === n - 1), band = L % 5 === 4 || L < 2;
      put(CUBE(corner ? 'steel' : band ? 'concrete' : 'glass'), (i - (n - 1) / 2) * G, L * LAY, (j - (n - 1) / 2) * G);
    }
    for (const sx of [-5, 5]) for (const sz of [-5, 5]) for (let L = 24; L < 27; L++) put(CUBE(L === 26 ? 'gold' : 'steel'), sx * G, L * LAY, sz * G);
  } },
  { id: 'greatwall', mega: true, arena: 22, name: 'Great Wall', emoji: '🧱', desc: 'A zigzag stone wall guarded by eight watchtowers', cam: [66, 2, .55], build() {
    const pts = [[-20, -12], [-10, -12], [-10, -2], [0, -2], [0, 8], [10, 8], [10, -2], [20, -2]], used = new Set(), k = (x, z) => x + ',' + z;
    const at = (sp, x, L, z) => put(sp, (x + .5) * G, L * LAY, (z + .5) * G);
    for (const [cx, cz] of pts) {                       // 4x4 hollow towers centred on each corner
      for (let L = 0; L < 6; L++) for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) {
        if (i > -2 && i < 1 && j > -2 && j < 1) continue;
        at(CUBE(L === 3 && (i === -2 || i === 1) && (j === -1 || j === 0) ? 'glass' : 'stone'), cx + i, L, cz + j); }
      for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) used.add(k(cx + i, cz + j));
      for (const [i, j] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) at(CUBE('stone'), cx + i, 6, cz + j);
    }
    for (let s = 0; s < pts.length - 1; s++) {          // 2-thick, 3-high wall with crenels between them
      const [ax, az] = pts[s], [bx, bz] = pts[s + 1], dx = Math.sign(bx - ax), dz = Math.sign(bz - az), n = Math.abs(bx - ax) + Math.abs(bz - az);
      for (let t = 0; t <= n; t++) for (const w of [-1, 0]) {
        const x = ax + dx * t + (dz ? w : 0), z = az + dz * t + (dx ? w : 0);
        if (used.has(k(x, z))) continue; used.add(k(x, z));
        for (let L = 0; L < 3; L++) at(CUBE(L === 0 ? 'concrete' : 'stone'), x, L, z);
        if (w === -1 && t % 2 === 0) at(CUBE('stone'), x, 3, z);
      }
    }
    at(CUBE('tnt'), 0, 0, 8); at(CUBE('tnt'), -10, 0, -12);
  } },
  { id: 'stadium', mega: true, arena: 13, name: 'Grand Arena', emoji: '🏟️', desc: 'Five tiers of seats, four gates and floodlight towers', cam: [44, 2, .62], build() {
    const seat = ['concrete', 'marble', 'concrete', 'marble', 'glass'];
    for (let d = 6; d <= 10; d++) for (let x = -d; x <= d; x++) for (let z = -d; z <= d; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) !== d || Math.min(Math.abs(x), Math.abs(z)) <= 1) continue;
      for (let L = 0; L < d - 5; L++) put(CUBE(L === d - 6 ? seat[d - 6] : 'concrete'), x * G, L * LAY, z * G);
    }
    for (const sx of [-11, 11]) for (const sz of [-11, 11]) { for (let L = 0; L < 9; L++) put(CUBE('steel'), sx * G, L * LAY, sz * G); put(CUBE('glass'), sx * G, 9 * LAY, sz * G); }
    for (let L = 0; L < 2; L++) for (const dx of [-.5, .5]) for (const dz of [-.5, .5]) put(CUBE(L ? 'gold' : 'tnt'), dx * G, L * LAY, dz * G);
  } },
  { id: 'ziggurat', mega: true, arena: 10, name: 'Desert Ziggurat', emoji: '🏜️', desc: 'Six sandstone steps with a TNT chamber hidden inside', cam: [40, 4, .42], build() {
    let L = 0;
    for (const n of [13, 11, 9, 7, 5, 3]) for (let h = 0; h < 2; h++, L++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i - (n - 1) / 2, z = j - (n - 1) / 2, edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
      const m = L === 1 && Math.abs(x) <= 1 && Math.abs(z) <= 1 ? 'tnt' : h === 1 && edge ? 'stone' : 'sand';
      put(CUBE(m), x * G, L * LAY, z * G);
    }
    put(CUBE('gold'), 0, L * LAY, 0); put(Co('gold', .5, 1), 0, (L + 1) * LAY, 0);
  } },
  { id: 'viaduct', mega: true, arena: 17, name: 'Stone Viaduct', emoji: '🌉', desc: 'A two-tier aqueduct between two gate towers', cam: [48, 5, .32], build() {
    // 4 deep and 13 high: thinner, taller walls sway along their narrow side and tip over once fully awake
    const zs = [-1.5, -.5, .5, 1.5], D = zs.length, beam = n => Bx('stone', n * G - .005, 1, D * G - .005);
    const cube = (m, x, L) => { for (const z of zs) put(CUBE(m), x * G, L * LAY, z * G); };
    const pil = [-12, -6, 0, 6, 12], N = 26, X = c => -12.5 + c;
    for (const p of pil) for (let L = 0; L < 6; L++) for (const dx of [-.5, .5]) cube('stone', p + dx, L);
    for (let g = 0; g < pil.length - 1; g++) put(beam(6), (pil[g] + 3) * G, 6 * LAY, 0);
    cube('stone', X(0), 6); cube('stone', X(N - 1), 6);
    for (let c = 0; c < N; c++) cube('concrete', X(c), 7);
    // upper arcade: 2-wide piers with 1-wide windows; 3-long lintels each rest on two piers, so no course has holes
    for (let c = 0; c < N; c++) if (c % 3 !== 2) for (let L = 8; L < 11; L++) cube('stone', X(c), L);
    for (let c = 1; c + 2 < N; c += 3) put(beam(3), X(c + 1) * G, 11 * LAY, 0);
    cube('stone', X(0), 11); cube('stone', X(N - 1), 11);
    for (let c = 0; c < N; c++) cube('concrete', X(c), 12);
    for (let c = 0; c < N; c++) for (const z of zs) put(CUBE(Math.abs(z) > 1 ? 'stone' : 'glass'), X(c) * G, 13 * LAY, z * G);
    for (const sx of [-1, 1]) for (let L = 0; L < 10; L++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i > 0 && i < 3 && j > 0 && j < 3) continue;
      put(CUBE(L % 5 === 4 ? 'wood' : 'stone'), sx * (13.5 + i) * G, L * LAY, (j - 1.5) * G);
    }
  } }
];
MEGA.push(...MEGA2);
PRESETS.unshift(...MEGA);

// ---- material themes: load a preset (or repaint what's on the pad) in one material ----
const MAT_THEMES = [['original', 'Original'], ['mixed', 'Mixed'], ['stone', 'Stone'], ['wood', 'Wood'], ['glass', 'Glass'], ['ice', 'Ice'], ['steel', 'Steel'], ['gold', 'Gold'],
  ['marble', 'Marble'], ['brick', 'Brick'], ['concrete', 'Concrete'], ['sand', 'Sand'], ['rubber', 'Rubber'], ['crystal', 'Crystal'], ['obsidian', 'Obsidian']];
const THEME_KEEP = new Set(['tnt', 'domino']);   // these keep their job: TNT still explodes, dominoes still topple
const THEME_MIX = ['stone', 'wood', 'glass', 'marble', 'brick', 'steel', 'gold', 'crystal', 'ice', 'rubber', 'obsidian', 'concrete', 'sand'];
let buildTheme = null;
// premium materials unlock with total stars (campaign + challenges + engineer); the rest are free
const THEME_COST = { brick: 5, ice: 10, marble: 20, rubber: 30, steel: 45, crystal: 60, gold: 80, obsidian: 100 };
function totalStars() {
  const sum = o => Object.values(o || {}).reduce((a, b) => a + (+b || 0), 0);
  let ch = {}; try { ch = JSON.parse(localStorage.getItem('ts_stars') || '{}'); } catch (e) {}
  return sum(SAVE.camp) + sum(ch) + sum(SAVE.eng);
}
const themeLocked = k => (THEME_COST[k] || 0) > totalStars();
// call after stars change: announce materials that just unlocked
function checkUnlocks() {
  const have = SAVE.matsUnlocked || (SAVE.matsUnlocked = []);
  const fresh = Object.keys(THEME_COST).filter(k => !themeLocked(k) && !have.includes(k));
  if (!fresh.length) return;
  have.push(...fresh); persist(); track('unlock');
  setTimeout(() => { toast(`🎨 New material unlocked: ${fresh.map(themeName).join(', ')}. Find it in the Build Library.`, 'good'); snd.ding(); }, 1200);
}
const themeName = t => (MAT_THEMES.find(m => m[0] === t) || MAT_THEMES[0])[1];
// spec.base remembers the material the piece was designed with, so 'original' always restores it
function themeSpec(spec, theme) {
  const base = spec.base || spec.mat;
  if (THEME_KEEP.has(base)) return spec;
  const mat = theme === 'original' ? base : theme === 'mixed' ? THEME_MIX[Math.floor(Math.random() * THEME_MIX.length)] : theme;
  if (mat === spec.mat) return spec;
  const out = { ...spec, mat }; if (mat !== base) out.base = base; else delete out.base; return out;
}
function repaintPad(theme) {
  const blocks = objs.filter(o => !o.gone && o.type === 'block');
  if (!blocks.length) { toast('Nothing on the pad to repaint yet'); return; }
  const data = blocks.map(o => ({ spec: themeSpec(o.spec, theme), p: o.body.position.clone(), q: o.body.quaternion.clone(), home: o.home })), saved = bondsFor(blocks);
  const keep = snapshot;
  clearAll();
  const made = data.map(d => { const o = createPiece(d.spec, d.p.x, d.p.y, d.p.z, d.q, true); if (d.home) o.home = d.home; return o; });
  restoreBonds(made, saved);
  if (keep) { snapshot = keep; for (const s of snapshot) s.spec = themeSpec(s.spec, theme); }   // Rebuild comes back in the new material
  else dirty = true;
  shadowDirty = 2; updateHud(); toast(theme === 'original' ? 'Back to the original materials' : 'Repainted in ' + themeName(theme).toLowerCase());
  logAct('repaint ' + theme);
}
function themeChips(cur, onPick) {
  const row = document.createElement('div'); row.className = 'chips mats';
  for (const [k, label] of MAT_THEMES) {
    const b = document.createElement('button'), lock = themeLocked(k);
    b.className = 'chip' + (k === cur ? ' on' : '') + (lock ? ' locked' : '');
    b.textContent = lock ? `🔒 ${label} ${THEME_COST[k]}★` : label;
    b.onclick = () => lock ? toast(`Earn ${THEME_COST[k] - totalStars()} more ★ to unlock ${label}`) : onPick(k);
    row.appendChild(b);
  }
  return row;
}
function countOf(p) { if (p.count == null) { COUNTING = 0; p.build(); p.count = COUNTING; COUNTING = null; } return p.count; }
function clearAll() { clearFields(); for (const o of objs) removeObj(o); dormant.clear(); objs = []; placed = []; redoStack = []; clearGhost(); pendingBreak.clear(); pendingBoom = []; parts = []; }
function loadPreset(p) {
  clearAll(); setArena(p.arena || 10);
  buildTheme = SAVE.matTheme && SAVE.matTheme !== 'original' && !themeLocked(SAVE.matTheme) ? SAVE.matTheme : null;
  try { p.build(); } finally { buildTheme = null; }
  dirty = true; snapshot = null; curPreset = p;
  const [r, y, el] = p.cam; cam.tR = r; cam.target.y = y; cam.tEl = el;
  if (mode === 'throw') takeSnapshot();
  updateHud(); hideHint('build'); toast(p.emoji + ' ' + p.name + ' · ' + countOf(p) + ' blocks' + (SAVE.matTheme && SAVE.matTheme !== 'original' ? ' · ' + themeName(SAVE.matTheme) : ''));
}
let curPreset = null;
function takeSnapshot() {
  objs = objs.filter(o => !o.gone);
  const blocks = objs.filter(o => o.type === 'block');
  snapshot = blocks.map(o => ({ spec: o.spec, p: o.body.position.clone(), q: o.body.quaternion.clone() }));
  blocks.forEach(o => o.home = { p: o.body.position.clone(), q: o.body.quaternion.clone() });
  snapshot.bonds = bondsFor(blocks);
  dirty = false;
}
function rebuild() {
  if (!snapshot || !snapshot.length) { toast('Nothing to rebuild yet'); return; }
  clearAll();
  const made = snapshot.map(s => { const o = createPiece(s.spec, s.p.x, s.p.y, s.p.z, s.q, true); o.home = { p: s.p.clone(), q: s.q.clone() }; return o; });
  restoreBonds(made, snapshot.bonds);
  dirty = false; updateHud(); toast('Rebuilt');
}
// preset menu
function openMenu() { openLibrary('mega'); }
function renderMega() {
  const g = $('mgrid'); g.innerHTML = '';
  const mh = document.createElement('div'); mh.className = 'sect'; mh.textContent = 'Material · builds load in this'; g.appendChild(mh);
  g.appendChild(themeChips(SAVE.matTheme || 'original', k => { SAVE.matTheme = k; persist(); renderMega(); }));
  g.insertAdjacentHTML('beforeend', `<div class="hint">⭐ ${totalStars()} stars · earn stars in Levels to unlock more materials</div>`);
  for (const [title, list] of [['Mega builds · 500–5,000 blocks', PRESETS.filter(p => p.mega).sort((a, b) => countOf(a) - countOf(b))], ['Classic builds', PRESETS.filter(p => !p.mega)]]) {
    const h = document.createElement('div'); h.className = 'sect'; h.textContent = title; g.appendChild(h);
    for (const p of list) {
      const b = document.createElement('button'); b.className = 'card' + (p.mega ? ' mega' : '');
      b.innerHTML = `<span class="em">${p.emoji}</span><b>${p.name}</b><small>${p.desc}</small><i>${countOf(p)} blocks</i>`;
      b.onclick = async () => { if (objs.some(o => !o.gone && o.type === 'block') && !(await confirmDlg(`Load ${p.name}?`, 'This replaces what’s on the pad. You can’t undo it.', 'Load'))) return; closeLibrary(); goGame(); chal = null; sceneIsFree = true; setTimeout(() => { loadPreset(p); if (mode !== 'build') setMode('build'); }, 30); };
      g.appendChild(b);
    }
  }
}
function closeMenu() { closeLibrary(); }
$('menuX').onclick = closeMenu;
$('menu').addEventListener('click', e => { if (e.target.id === 'menu') closeMenu(); });

