// ================= definitions =================
// piece specs: {mat, shape:'box'|'cyl'|'cone'|'wedge', d:[...]}
const Bx = (mat, x, y, z) => ({ mat, shape: 'box', d: [x, y, z] });
const Cy = (mat, r, h, rb) => ({ mat, shape: 'cyl', d: [r, rb || r, h] });
const Co = (mat, r, h) => ({ mat, shape: 'cone', d: [r, h] });
const We = (mat, L, h, W) => ({ mat, shape: 'wedge', d: [L, h, W] });
const DENS = { wood: .9, stone: 2.2, glass: 1.4, tnt: 1, roof: 1.6, marble: 2.4, lacquer: .9, concrete: 2, domino: .9, sand: 1.9, gold: 3,
  steel: 4, brick: 1.8, ice: .9, rubber: 1.1, crystal: 1.6, obsidian: 2.8 };
// material feel: friction / bounciness (anything missing uses the defaults)
const MATP = { ice: { fric: .04, rest: .05 }, rubber: { fric: .9, rest: .75 }, steel: { fric: .45, rest: .1 }, glass: { fric: .3 }, crystal: { fric: .25 } };
const BRITTLE = { glass: 7, crystal: 9, ice: 6 };   // impact speed that shatters these
// align: which local axis should line up with the camera's left-right
const BLOCKS = {
  wood:   { label: 'Wood',   spec: Bx('wood', 1, 1, 1) },
  stone:  { label: 'Stone',  spec: Bx('stone', 1, 1, 1) },
  glass:  { label: 'Glass',  spec: Bx('glass', 1, 1, 1) },
  tnt:    { label: 'TNT',    spec: Bx('tnt', 1, 1, 1) },
  plank:  { label: 'Plank',  spec: Bx('wood', 2, .4, 1), align: 'x' },
  long:   { label: 'Long',   spec: Bx('stone', 2, 1, 1), align: 'x' },
  pillar: { label: 'Pillar', spec: Bx('stone', .5, 2, .5) },
  column: { label: 'Column', spec: Cy('marble', .32, 1.5, .36) },
  roof:   { label: 'Roof',   spec: We('roof', 2, .8, 1.2), align: 'x' },
  spire:  { label: 'Spire',  spec: Co('roof', .7, 1.4) },
  domino: { label: 'Domino', spec: Bx('domino', .18, 1.1, .55), align: 'z' },
  brick:  { label: 'Brick',  spec: Bx('brick', 1, .5, .5), align: 'x', cat: 'new' },
  steel:  { label: 'Steel',  spec: Bx('steel', 1, 1, 1), cat: 'new' },
  girder: { label: 'Girder', spec: Bx('steel', 4, .3, .3), align: 'x', cat: 'new' },
  ice:    { label: 'Ice',    spec: Bx('ice', 1, 1, 1), cat: 'new' },
  rubber: { label: 'Rubber', spec: Bx('rubber', 1, 1, 1), cat: 'new' },
  crystal:{ label: 'Crystal',spec: Bx('crystal', 1, 1, 1), cat: 'new' },
  obsid:  { label: 'Obsidian', spec: Bx('obsidian', 1, 1, 1), cat: 'new' },
  half:   { label: 'Half',   spec: Bx('stone', 1, .5, 1), cat: 'new' },
  slab:   { label: 'Slab',   spec: Bx('concrete', 3, .3, 3), cat: 'new' },
  beam:   { label: 'Beam',   spec: Bx('wood', 4, .4, .4), align: 'x', cat: 'new' },
  slope:  { label: 'Ridge',  spec: We('stone', 1, 1, 1), cat: 'new' },
  tube:   { label: 'Drum',   spec: Cy('steel', .45, 1), cat: 'new' }
};
const PROJ = {
  ball:    { label: 'Baseball',   shape: 'sphere', r: .25, mass: .6, rest: .5 },
  bowling: { label: 'Bowling',    shape: 'sphere', r: .42, mass: 7,  rest: .1 },
  cannon:  { label: 'Cannonball', shape: 'sphere', r: .34, mass: 14, rest: .05 },
  brick:   { label: 'Brick',      shape: 'box', size: [.9, .45, .45], mass: 3, rest: .05 },
  anvil:   { label: 'Anvil',      shape: 'box', size: [1.1, .7, .6],  mass: 25, rest: 0 },
  boulder: { label: 'Boulder',    shape: 'rock', r: .6, mass: 30, rest: .05 },
  bomb:    { label: 'Bomb',       shape: 'sphere', r: .36, mass: 2,  rest: .3, bomb: true },
  firebomb:{ label: 'Firebomb',   shape: 'sphere', r: .32, mass: 2,  rest: .2, special: true, desc: 'Sets wood ablaze — fire spreads, burns and crumbles' },
  cluster: { label: 'Cluster',    shape: 'sphere', r: .34, mass: 2.5, rest: .2, special: true, desc: 'Splits into 9 bomblets mid-air' },
  rocket:  { label: 'Rocket',     shape: 'sphere', r: .22, mass: 4,  rest: 0, special: true, desc: 'Flies dead straight — hold longer for more speed' },
  meteor:  { label: 'Meteors',    shape: 'rock', r: .55, mass: 60, rest: 0, special: true, desc: '18 flaming meteors rain down on your target' },
  hole:    { label: 'Black hole', shape: 'sphere', r: .4, mass: 3,  rest: .1, special: true, desc: 'Swallows everything nearby, then bursts' },
  nuke:    { label: 'Nuke',       shape: 'sphere', r: .55, mass: 30, rest: .1, special: true, desc: 'Mushroom cloud, shockwave, total destruction' }
};
const SIZES = [['S', .6], ['M', 1], ['L', 1.6], ['XL', 2.5]];
let buildR = 10; const MAX_H = 22, MIN_SPEED = 9, MAX_SPEED = 55, CHARGE_MS = 1300;

