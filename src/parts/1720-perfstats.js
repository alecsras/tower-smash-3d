// ================= performance + usage stats (Phase 2, L1) =================
// Collected on the device and shown in feedback reports. Nothing is sent anywhere until STATS_URL is set,
// which waits on the analytics decision in the Phase 2 plan.
const STATS_URL = '';
const PERF = { hist: new Uint32Array(61), frames: 0, worst: 0, maxAwake: 0, secs: 0, steps0: 0 };
// called once per drawn frame while a game is on screen
function perfFrame(rawDt) {
  if (screen !== 'game' || paused || document.hidden || replay) return;
  if (!PERF.frames) PERF.steps0 = P.stepsTotal;
  PERF.hist[Math.min(60, Math.round(1 / Math.max(rawDt, 1 / 240)))]++; PERF.frames++; PERF.secs += rawDt;
  if (PERF.frames > 30) PERF.worst = Math.max(PERF.worst, rawDt * 1000);   // skip the first frames after loading
  if (P.activeCount > PERF.maxAwake) PERF.maxAwake = P.activeCount;
}
// fps that a share p of frames reached or beat (p = .05 → the slowest 5% of frames)
function fpsAt(p) { const need = PERF.frames * p; let acc = 0; for (let f = 0; f <= 60; f++) { acc += PERF.hist[f]; if (acc >= need) return f; } return 60; }
function perfSummary() {
  if (PERF.frames < 30) return null;
  return { fpsMedian: fpsAt(.5), fpsSlow5: fpsAt(.05), worstMs: Math.round(PERF.worst), maxAwake: PERF.maxAwake, physics: P.mode,
    stepsPerSec: +((P.stepsTotal - PERF.steps0) / Math.max(1, PERF.secs)).toFixed(1), cores: navigator.hardwareConcurrency || 0, memGB: navigator.deviceMemory || 0 };
}
function perfLine() {
  const s = perfSummary(); if (!s) return 'Performance: not enough play yet';
  return `Performance: ${s.fpsMedian} fps typical, ${s.fpsSlow5} fps slowest 5%, worst frame ${s.worstMs} ms · up to ${s.maxAwake} awake · physics ${s.physics} at ${s.stepsPerSec} steps/s · ${s.cores || '?'} cores${s.memGB ? ', ' + s.memGB + ' GB' : ''}`;
}
// key moments, counted on the device (first time + how many), e.g. track('first_throw')
function track(name) {
  const st = SAVE.stats || (SAVE.stats = {}), e = st[name] || (st[name] = { n: 0, first: Date.now() });
  e.n++; e.last = Date.now(); clearTimeout(track.t); track.t = setTimeout(persist, 2000);
  if (STATS_URL && SAVE.shareStats !== false && navigator.sendBeacon) try { navigator.sendBeacon(STATS_URL, JSON.stringify({ e: name, v: VERSION_STR, d: deviceLine(), p: perfSummary() })); } catch (err) {}
}
function statsLine() {
  const st = SAVE.stats || {}, k = Object.keys(st); if (!k.length) return null;
  return 'Counts: ' + k.map(n => `${n} ${st[n].n}`).join(' · ');
}
