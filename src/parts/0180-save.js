// ================= saving: one versioned record, migrations, export / import =================
// Everything the player earns lives in localStorage under 'ts_*' keys:
//   ts_save   coins, unlocks, campaign stars, settings, onboarding state (this record, versioned)
//   ts_stars  challenge stars · ts_slot_1..3 saved builds · ts_auto the last free-play build
const SAVE_VERSION = 2;
const SAVE_DEFAULTS = () => ({
  v: SAVE_VERSION, coins: 250, coinFrac: 0, unlocked: {}, sandbox: false, camp: {}, daily: {},
  quality: matchMedia('(pointer:coarse)').matches ? 'low' : 'high', qmode: 'auto',
  name: '', onboarded: false, trained: false, hints: {}, tips: {}, matTheme: 'original', physWorker: false, stats: {}, best: {}, shareStats: true, volume: .8, haptics: true, camArrows: false,
  calm: matchMedia('(prefers-reduced-motion: reduce)').matches, follow: false, myPrefabs: []
});
function migrateSave(s) {
  if (!s.v) {   // v1 (before Nov 2026): no version, onboarding flags from the old tutorial
    s.onboarded = !!(s.tut || s.seen3 || s.seen4 || s.coins !== undefined);
    s.trained = !!s.tut; s.v = 2;
  }
  return s;
}
const SAVE = (() => {
  let s = null; try { s = JSON.parse(localStorage.getItem('ts_save') || 'null'); } catch (e) {}
  return Object.assign(SAVE_DEFAULTS(), s ? migrateSave(s) : {});
})();
let saveFailed = false;
const persist = () => {
  try { localStorage.setItem('ts_save', JSON.stringify(SAVE)); saveFailed = false; }
  catch (e) { if (!saveFailed) { saveFailed = true; setTimeout(() => toast('Couldn’t save — your browser’s storage is full. Delete a saved build to make room.', 'warn'), 0); } }
};
// ---- export / import: every ts_* key as one code ----
function exportSave() {
  persist(); const all = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('ts_')) all[k] = localStorage.getItem(k); }
  const json = JSON.stringify({ app: 'tower-smash', v: SAVE_VERSION, at: new Date().toISOString(), data: all });
  return 'TSAVE1.' + btoa(unescape(encodeURIComponent(json)));
}
function importSave(code) {
  try {
    code = (code || '').trim(); const body = code.startsWith('TSAVE1.') ? code.slice(7) : code;
    const obj = JSON.parse(decodeURIComponent(escape(atob(body))));
    if (obj.app !== 'tower-smash' || !obj.data || !obj.data.ts_save) throw new Error('not a save');
    for (const k of Object.keys(localStorage)) if (k.startsWith('ts_')) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(obj.data)) if (k.startsWith('ts_')) localStorage.setItem(k, v);
    return true;
  } catch (e) { return false; }
}
function resetProgress() { for (const k of Object.keys(localStorage)) if (k.startsWith('ts_')) localStorage.removeItem(k); }
