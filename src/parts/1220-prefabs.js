// ================= prefab library, my prefabs, save slots, stability helper =================
// Every prefab is a small blueprint centered on 0,0; tapping the ground drops it there.
const PREFAB_CATS = [['tower', '🗼 Towers'], ['wall', '🧱 Walls & gates'], ['home', '🏠 Homes'], ['land', '🗽 Landmarks'], ['bridge', '🌉 Bridges & arches'], ['dome', '🕌 Domes & orbs'], ['trap', '💣 Traps'], ['fun', '🎪 Fun'], ['mine', '⭐ Mine'], ['slots', '💾 Saves']];
const PREFABS = [
  // towers
  ['watch', 'Watchtower', '🗼', 'tower', 'tower 4x4x10 stone windows 3 floors 3 battlements'],
  ['spire', 'Wizard spire', '🧙', 'tower', 'round 5x5x14 marble windows 3 floors 4 roof'],
  ['glassT', 'Glass tower', '🏙️', 'tower', 'tower 5x5x24 glass windows 1 floors 4 roof'],
  ['brickT', 'Brick chimney', '🏭', 'tower', 'round 4x4x18 brick thick 1'],
  ['steelT', 'Steel mast', '📡', 'tower', 'tower 3x3x20 steel floors 5\ntower 1x1x3 gold up 20'],
  ['twinT', 'Twin towers', '🏢', 'tower', 'tw: mirror x: tower 4x4x16 concrete windows 2 floors 4 at 4,0\non tw: slab 12x4x1 concrete at -4,0'],
  ['stackT', 'Wedding cake', '🎂', 'tower', 'base: solid 7x7x3 marble\non base: solid 5x5x3 checker\ntop: solid 3x3x3 marble up 6\non top: cone 3x3x3 gold'],
  ['lean', 'Leaning tower', '🍕', 'tower', 'round 4x4x16 marble windows 2 rot 8'],
  ['silo', 'Grain silo', '🌾', 'tower', 'round 6x6x14 concrete roof'],
  ['minaret', 'Minaret', '🕌', 'tower', 'round 3x3x18 sand windows 4\ndome 5x5x3 gold up 18'],
  ['icicle', 'Ice spike', '🧊', 'tower', 'cone 5x5x14 ice'],
  ['crystalT', 'Crystal shard', '💎', 'tower', 'cone 4x4x10 crystal\ncone 2x2x6 crystal at 3,2'],
  // walls & gates
  ['wallS', 'Castle wall', '🧱', 'wall', 'wall 15x1x6 stone battlements'],
  ['gateS', 'Castle gate', '🚪', 'wall', 'gate 13x3x9 stone\nmirror x: round 4x4x11 stone roof at 8.5,0'],
  ['palisade', 'Palisade', '🪵', 'wall', 'wall 16x1x4 wood battlements'],
  ['brickW', 'Brick wall', '🧱', 'wall', 'wall 14x1x5 brick'],
  ['steelW', 'Blast wall', '🛡️', 'wall', 'wall 12x2x4 steel'],
  ['glassW', 'Glass curtain', '🪟', 'wall', 'wall 12x1x8 glass'],
  ['zig', 'Zig-zag wall', '〰️', 'wall', 'wall 6x1x4 stone at -5,-2 rot 30\nwall 6x1x4 stone at 0,0 rot -30\nwall 6x1x4 stone at 5,-2 rot 30'],
  ['bastion', 'Bastion', '🏯', 'wall', 'tower 9x9x6 stone thick 2 battlements'],
  // homes
  ['cottage', 'Cottage', '🏡', 'home', 'tower 6x5x4 wood windows 2 floors 3 roof'],
  ['brickH', 'Brick house', '🏠', 'home', 'tower 7x6x6 brick windows 2 floors 3 roof'],
  ['villa', 'Villa', '🏛️', 'home', 'tower 10x7x5 marble windows 2 floors 5 roof\ntower 4x4x3 marble at 7.6,0 roof'],
  ['barn', 'Barn', '🐄', 'home', 'tower 9x6x5 wood windows 2 roof'],
  ['igloo', 'Igloo', '🧊', 'home', 'dome 9x9x5 ice'],
  ['hut', 'Hut', '🛖', 'home', 'round 5x5x3 sand roof'],
  ['apart', 'Apartments', '🏢', 'home', 'tower 8x6x16 concrete windows 1 floors 3 roof'],
  ['tower2', 'Tree house', '🌳', 'home', 'solid 1x1x8 wood\nslab 5x5x1 wood up 8\ntower 4x4x3 wood windows 2 up 9 roof'],
  // landmarks
  ['eiffel', 'Eiffel Tower', '🗼', 'land', 'LM:eiffel'],
  ['light', 'Lighthouse', '🚨', 'land', 'LM:lighthouse'],
  ['parth', 'Parthenon', '🏛️', 'land', 'LM:temple'],
  ['needle', 'Space Needle', '🛸', 'land', 'LM:needle'],
  ['giza', 'Great Pyramid', '🔺', 'land', 'pyramid 17x17 sand tnt core'],
  ['colos', 'Colosseum', '🏟️', 'land', 'round 22x22x5 stone thick 2 windows 2 battlements'],
  ['taj', 'Taj Mahal', '🕌', 'land', 'solid 12x12x1 marble\ntower 8x8x6 marble windows 2 up 1\ndome 8x8x5 marble up 7\naround 0,0 radius 8 count 4: round 2x2x10 marble roof'],
  ['pisa', 'Tower of Pisa', '🍕', 'land', 'round 5x5x18 marble windows 2 floors 4 rot 10'],
  ['bigben', 'Clock tower', '🕰️', 'land', 'clock: tower 5x5x18 brick windows 4 floors 4\non clock: tower 5x5x3 gold windows 1 roof'],
  ['liberty', 'Statue base', '🗽', 'land', 'pyramid 9x9 concrete\nsolid 3x3x8 marble up 5\ncone 3x3x3 gold up 13'],
  ['stonehenge', 'Stonehenge', '🗿', 'land', 'around 0,0 radius 7 count 10: arch 3x1x4 stone'],
  ['pagoda', 'Pagoda', '⛩️', 'land', 'p1: tower 7x7x4 wood windows 2\non p1: slab 9x9x1 concrete\np2: tower 5x5x4 wood windows 2 up 5\non p2: slab 7x7x1 concrete\ntower 3x3x3 wood up 10 roof'],
  // bridges & arches
  ['bridgeW', 'Wooden bridge', '🌉', 'bridge', 'bridge 18x3x5 wood'],
  ['bridgeS', 'Stone bridge', '🌁', 'bridge', 'bridge 20x4x7 stone'],
  ['arch1', 'Triumphal arch', '🏛️', 'bridge', 'arch 9x3x9 marble thick 2'],
  ['aqueduct', 'Aqueduct', '🚰', 'bridge', 'array 4x1 spacing 5: arch 5x2x6 sand'],
  ['moon', 'Moon gate', '🌕', 'bridge', 'arch 7x1x7 brick'],
  ['spiralS', 'Spiral stairs', '🌀', 'bridge', 'spiral 7x7x16 stone'],
  ['stairsS', 'Grand stairs', '🪜', 'bridge', 'stairs 10x6x6 marble'],
  // domes & orbs
  ['domeM', 'Marble dome', '🕌', 'dome', 'tower 9x9x4 marble windows 2\ndome 9x9x5 marble up 4'],
  ['orbG', 'Glass orb', '🔮', 'dome', 'sphere 9 glass'],
  ['orbC', 'Crystal orb', '💠', 'dome', 'sphere 7 crystal'],
  ['planet', 'Planet', '🪐', 'dome', 'sphere 11 random'],
  ['observ', 'Observatory', '🔭', 'dome', 'round 8x8x6 concrete windows 3\ndome 8x8x4 steel up 6'],
  ['volcanoP', 'Volcano', '🌋', 'dome', 'cone 13x13x8 obsidian thick 2'],
  // traps
  ['tntTower', 'TNT tower', '🧨', 'trap', 'tower 5x5x12 stone windows 3 tnt core'],
  ['tntPyr', 'Booby-trapped pyramid', '⚠️', 'trap', 'pyramid 13x13 sand tnt core'],
  ['domino', 'Domino run', '🁢', 'trap', 'wall 1x1x1 tnt at 8,0'],
  ['tntRing', 'TNT ring', '💥', 'trap', 'around 0,0 radius 6 count 8: solid 1x1x2 tnt\ntower 4x4x10 glass windows 1'],
  ['glassHouse', 'Glass house', '🏚️', 'trap', 'tower 8x8x8 glass floors 3 tnt core'],
  // fun
  ['jengaP', 'Jenga stack', '🧱', 'fun', 'tower 3x3x18 wood floors 2'],
  ['rubberT', 'Bouncy castle', '🎈', 'fun', 'tower 8x8x4 rubber battlements\naround 0,0 radius 5.5 count 4: round 3x3x6 rubber roof'],
  ['goldVault', 'Gold vault', '💰', 'fun', 'tower 7x7x5 steel thick 1\nsolid 3x3x2 gold up 0'],
  ['iceCastle', 'Ice castle', '❄️', 'fun', 'tower 8x8x8 ice battlements\naround 0,0 radius 6 count 4: round 3x3x10 ice roof'],
  ['obsidian', 'Dark fortress', '🖤', 'fun', 'tower 9x9x10 obsidian windows 3 battlements'],
  ['rainbow', 'Rainbow stack', '🌈', 'fun', 'a: solid 6x6x1 brick\non a: b: solid 6x6x1 gold\non b: c: solid 6x6x1 glass\non c: d: solid 6x6x1 crystal\non d: solid 6x6x1 rubber']
];
function LANDMARKS_BP(word) { const lm = LANDMARKS.find(([re]) => re.test(word)); return lm ? lm[1] : 'tower 4x4x8 stone'; }
// domino run is special: a real domino line
PREFABS.find(p => p[0] === 'domino')[4] = null;
const pfCount = {};
function prefabLines(p) { return p[4] ? (p[4].startsWith('LM:') ? LANDMARKS_BP(p[4].slice(3)) : p[4]).split('\n') : null; }
function prefabBlocks(p) {
  if (pfCount[p[0]] != null) return pfCount[p[0]];
  const l = prefabLines(p); return pfCount[p[0]] = l ? compileBlueprint(l).structs.reduce((n, a) => n + a.length, 0) : 24;
}

// ---- snapshots of the current build (for my prefabs + save slots) ----
function snapBuild(center) {
  const pal = [], keyOf = s => { const k = s.mat + '|' + s.shape + '|' + s.d.map(v => +v.toFixed(3)).join(','); let i = pal.findIndex(p => p.k === k); if (i < 0) { pal.push({ k, s }); i = pal.length - 1; } return i; };
  const bl = objs.filter(o => !o.gone && o.type === 'block'); if (!bl.length) return null;
  let cx = 0, cz = 0; if (center) { for (const o of bl) { cx += o.body.position.x; cz += o.body.position.z; } cx = Math.round(cx / bl.length); cz = Math.round(cz / bl.length); }
  const p = bl.map(o => { const q = o.body.quaternion, pp = o.body.position; return [keyOf(o.spec), Math.round((pp.x - cx) * 100), Math.round((pp.y - specHeight(o.spec) / 2) * 100), Math.round((pp.z - cz) * 100), Math.round(2 * Math.atan2(q.y, q.w) * 1800 / Math.PI) / 10]; });
  return { pal: pal.map(q => [q.s.mat, q.s.shape, q.s.d]), p, b: bondsFor(bl) };
}
const snapPieces = (d, ox = 0, oz = 0) => Object.assign(d.p.map(([i, x, y, z, yaw]) => ({ spec: { mat: d.pal[i][0], shape: d.pal[i][1], d: d.pal[i][2].slice() }, x: x / 100 + ox, y: Math.max(0, y / 100), z: z / 100 + oz, rot: yaw * Math.PI / 180 })), { bonds: d.b });
function placePieces(ps, { replace = false } = {}) {
  if (!replace && spaceTaken(ps)) { toast('That spot is taken — try somewhere else'); return false; }
  if (replace) { clearAll(); snapshot = null; }
  let ext = 0; for (const p of ps) ext = Math.max(ext, Math.abs(p.x) + 1, Math.abs(p.z) + 1);
  if (Math.ceil(ext) > buildR) setArena(Math.min(Math.ceil(ext), 34));
  const made = ps.map(p => put(p.spec, p.x, p.y, p.z, p.rot)); restoreBonds(made, ps.bonds); pushHistory(made); dirty = true; updateHud(); return true;
}
const slotKey = i => 'ts_slot_' + i;
function readSlot(i) { try { return JSON.parse(localStorage.getItem(slotKey(i)) || 'null'); } catch (e) { return null; } }

// ---- placing ----
let pfPlacing = null;
function startPlacing(p) { pfPlacing = p; closePrefabs(); goGame(); if (chal) exitChallenge(); sceneIsFree = true; if (mode !== 'build') setMode('build'); toast(`${p.emoji || '📍'} Tap the ground to drop “${p.name}”`); }
function prefabTryPlace(sx, sy) {
  if (!pfPlacing) return false;
  const h = rayHit(sx, sy); if (!h) return true;
  const ox = Math.round(h.point.x), oz = Math.round(h.point.z), p = pfPlacing;
  let ok;
  if (p.lines) ok = runBlueprint(p.lines, { ox, oz, quiet: true });
  else if (p.domino) ok = placePieces(Array.from({ length: 24 }, (_, i) => ({ spec: BLOCKS.domino.spec, x: ox - 8 + i * .7, y: 0, z: oz, rot: 0 })));
  else ok = placePieces(snapPieces(p.data, ox, oz));
  if (ok) { snd.place(); coach('prefab'); toast(`${p.emoji || '✅'} ${p.name} placed — tap again for another, or pick a tool`); }
  return true;
}
function stopPlacing() { pfPlacing = null; }

// ---- the sheet ----
let pfTab = 'tower';
function openPrefabs() { openLibrary('prefabs'); }
function closePrefabs() { closeLibrary(); }
function renderPrefabs() {
  const tabs = $('pfTabs'), grid = $('pfGrid'); tabs.innerHTML = ''; grid.innerHTML = '';
  if (pfTab === 'my') grid.insertAdjacentHTML('beforeend', '<div class="lab" style="grid-column:1/-1;margin-top:4px!important">My prefabs</div>');
  for (const [k, lab] of PREFAB_CATS.filter(c => c[0] !== 'mine' && c[0] !== 'slots')) { const b = document.createElement('button'); b.textContent = lab; b.className = 'chip' + (k === pfTab ? ' on' : ''); b.onclick = () => { pfTab = k; renderPrefabs(); }; tabs.appendChild(b); }
  const card = (emoji, name, sub, on, extra) => { const c = document.createElement('button'); c.className = 'pfcard'; c.innerHTML = `<span>${emoji}</span><b>${name}</b><small>${sub}</small>`; c.onclick = on; if (extra) c.appendChild(extra); grid.appendChild(c); return c; };
  if (pfTab === 'mine' || pfTab === 'my') {
    const mine = SAVE.myPrefabs || [];
    card('➕', 'Save my build', 'Keep what’s on the pad as a prefab', () => {
      const d = snapBuild(true); if (!d) { toast('Build something first'); return; } if (d.p.length > 4000) { toast('Too big for a prefab (max 4,000 blocks)'); return; }
      const name = ($('pfName').value || '').trim() || `My build ${mine.length + 1}`;
      SAVE.myPrefabs = [{ name, data: d, n: d.p.length }, ...mine].slice(0, 12); persist(); $('pfName').value = ''; toast(`⭐ Saved “${name}”`); renderPrefabs();
    });
    mine.forEach((m, i) => { const del = document.createElement('i'); del.textContent = '✕'; del.className = 'pfdel'; del.onclick = e => { e.stopPropagation(); SAVE.myPrefabs.splice(i, 1); persist(); renderPrefabs(); };
      card('⭐', m.name, `${m.n.toLocaleString()} blocks`, () => startPlacing({ name: m.name, emoji: '⭐', data: m.data }), del); });
    $('pfNameRow').style.display = 'flex'; if (pfTab === 'mine') return;
    grid.insertAdjacentHTML('beforeend', '<div class="lab" style="grid-column:1/-1">Save slots</div>');
  }
  if (pfTab !== 'my') $('pfNameRow').style.display = pfTab === 'slots' ? 'flex' : 'none';
  if (pfTab === 'slots' || pfTab === 'my') {
    for (let i = 1; i <= 3; i++) {
      const s = readSlot(i), row = document.createElement('div'); row.className = 'slotrow';
      row.innerHTML = `<div><b>Slot ${i}${s ? ' · ' + s.name : ''}</b><small>${s ? `${s.n.toLocaleString()} blocks · ${new Date(s.t).toLocaleDateString()}` : 'Empty'}</small></div>`;
      const sv = document.createElement('button'); sv.className = 'b2'; sv.textContent = 'Save'; sv.onclick = () => {
        const d = snapBuild(false); if (!d) { toast('Build something first'); return; }
        try { localStorage.setItem(slotKey(i), JSON.stringify({ name: ($('pfName').value || '').trim() || `Build ${i}`, t: Date.now(), n: d.p.length, data: d })); toast(`💾 Saved to slot ${i}`); } catch (e) { toast('Not enough space to save that build'); } renderPrefabs(); };
      const ld = document.createElement('button'); ld.className = 'b1'; ld.textContent = 'Load'; ld.disabled = !s; ld.onclick = () => { if (placePieces(snapPieces(s.data), { replace: true })) { closePrefabs(); goGame(); chal = null; sceneIsFree = true; fitView(); toast(`💾 Loaded ${s.name}`); } };
      row.append(sv, ld); grid.appendChild(row);
    }
    return;
  }
  for (const p of PREFABS.filter(p => p[3] === pfTab)) {
    card(p[1] ? p[2] : '', p[1], `${prefabBlocks(p).toLocaleString()} blocks`, () => startPlacing(p[4] ? { name: p[1], emoji: p[2], lines: prefabLines(p) } : { name: p[1], emoji: p[2], domino: true }));
  }
}

// ---- stability helper ----
function testGravity() {
  const bl = objs.filter(o => !o.gone && o.type === 'block'); if (!bl.length) { toast('Build something first'); return; }
  if (bl.length > 4000) { toast('Too many blocks to test at once (max 4,000)'); return; }
  const saved = bl.map(poseOf), start = bl.map(o => o.body.position.clone());
  for (const o of bl) activate(o); wakeAll(); toast('⚖️ Testing gravity…');
  later(2.5, () => {
    const moved = bl.filter((o, i) => o.gone || o.body.position.distanceTo(start[i]) > .3).length;
    if (!moved) { toast('✅ Rock solid — nothing moved'); return; }
    let now = bl;
    pushHistory({ undo() { const back = now.filter(o => !o.gone).map(poseOf); for (const o of now) if (!o.gone) removeObj(o); now = saved.map(respawn); this.after = back; },
      redo() { for (const o of now) if (!o.gone) removeObj(o); now = (this.after || []).map(respawn); } });
    toast(`⚠️ ${moved} block${moved > 1 ? 's' : ''} moved — tap ↶ to put everything back`);
  });
}
// fill the gap under overhanging pieces with stone pillars
function autoSupport() {
  const cache = buildTopCache(), adds = [];
  const below = (x, z, y0) => { let top = 0; for (let i = Math.floor((x - .45) / 2); i <= Math.floor((x + .45) / 2); i++) for (let j = Math.floor((z - .45) / 2); j <= Math.floor((z + .45) / 2); j++)
    for (const [a] of cache.get(i + ',' + j) || []) if (a.upperBound.x > x - .45 && a.lowerBound.x < x + .45 && a.upperBound.z > z - .45 && a.lowerBound.z < z + .45 && a.upperBound.y <= y0 + .03 && a.upperBound.y > top) top = a.upperBound.y; return top; };
  const seen = new Set();
  for (const o of objs) {
    if (o.gone || o.type !== 'block' || adds.length > 1500) continue;
    const a = o.body.getAABB(), y0 = a.lowerBound.y; if (y0 < .3) continue;
    for (let x = Math.ceil(a.lowerBound.x + .05); x <= Math.floor(a.upperBound.x - .05) || x === Math.ceil(a.lowerBound.x + .05); x += 2) {
      const z = Math.round((a.lowerBound.z + a.upperBound.z) / 2), k = x + ',' + z; if (seen.has(k + ',' + y0.toFixed(1))) continue; seen.add(k + ',' + y0.toFixed(1));
      if (!inPad(x, z)) continue;
      let y = below(x, z, y0); const gap = y0 - y; if (gap < .5) continue;
      while (y0 - y > .05) { const h = Math.min(1, y0 - y - .005); if (h < .2) break; adds.push(createPiece(Bx('stone', .9, h, .9), x, y + h / 2 + .002, z, null, true)); y += h + .002; }
    }
  }
  if (!adds.length) { toast('Nothing is hanging in the air'); return; }
  adds.forEach(o => { o.pop = 1; o.mdirty = true; }); pushHistory(adds); dirty = true; updateHud(); toast(`🏗️ Added ${adds.length} support blocks`);
}

