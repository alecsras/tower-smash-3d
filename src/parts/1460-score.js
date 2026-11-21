// ================= destruction score (Phase 2, D1) =================
// Each block that topples scores once: its material's value × how high it started × the combo multiplier.
// The combo grows while blocks keep falling close together in time (chain reactions), up to ×5.
const SCORE_MAT = { glass: 8, sand: 8, ice: 10, rubber: 10, wood: 10, brick: 12, stone: 15, concrete: 15, roof: 12, marble: 20,
  crystal: 30, steel: 25, obsidian: 35, gold: 40, tnt: 50, domino: 5 };
const COMBO_GAP = 1.5;            // seconds without a new topple before the combo resets
const SCORE = { pts: 0, chain: 0, mult: 1, lastT: -9, best: 0, key: null, settledAt: 0, announced: false };

function scoreKey() { return chal ? 'level:' + chal.def.title : curPreset ? 'build:' + curPreset.id : null; }
function scoreReset() {
  Object.assign(SCORE, { pts: 0, chain: 0, mult: 1, lastT: -9, settledAt: 0, announced: false, beat: false, key: scoreKey() });
  SCORE.best = SCORE.key && SAVE.best ? SAVE.best[SCORE.key] || 0 : 0;
}
function comboMult(chain) { return Math.min(5, 1 + Math.floor(chain / 8) * .5); }
// a block just counted as toppled for the first time
function scoreTopple(o) {
  if (simTime - SCORE.lastT > COMBO_GAP) SCORE.chain = 0;
  SCORE.chain++; SCORE.lastT = simTime;
  const m = comboMult(SCORE.chain);
  if (m > SCORE.mult && m >= 2) multPop(m);
  if (m >= 3 && !SCORE.beat) {   // the first time a chain reaction really takes off: a beat of slow-motion and a rumble
    SCORE.beat = true; snd.rumble();
    if (!SAVE.calm) { bulletUntil = Math.max(bulletUntil, simTime + .6); shake = Math.max(shake, .35); }
  }
  SCORE.mult = m;
  const h = o.home ? Math.max(0, o.home.p.y) : 0;
  SCORE.pts += Math.round((SCORE_MAT[o.mat] || 10) * (1 + h / 4) * m);
  SCORE.settledAt = 0; SCORE.announced = false;
}
function multPop(m) {
  if (SAVE.calm) return;
  const el = document.createElement('div'); el.className = 'pop mult'; el.textContent = `COMBO ×${m % 1 ? m.toFixed(1) : m}`;
  el.style.left = '50%'; document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
}
// once things go quiet, record a new best for this build or level
function scoreSettle() {
  if (!SCORE.pts || SCORE.announced || simTime - SCORE.lastT < 3) return;
  SCORE.announced = true; SCORE.chain = 0; SCORE.mult = 1;
  if (!SCORE.key || SCORE.pts <= SCORE.best) return;
  const first = !SCORE.best; SCORE.best = SCORE.pts;
  (SAVE.best || (SAVE.best = {}))[SCORE.key] = SCORE.pts; persist();
  if (!first) { toast(`New best: ${fmtPts(SCORE.pts)} points`, 'good'); snd.ding(); track('new_best'); }
}
const fmtPts = n => n.toLocaleString('en-US');
function scoreHud() {
  if (!SCORE.pts) return '';
  return ` · ${fmtPts(SCORE.pts)}${SCORE.mult > 1 && simTime - SCORE.lastT < COMBO_GAP ? ` ×${SCORE.mult % 1 ? SCORE.mult.toFixed(1) : SCORE.mult}` : ''}`;
}
