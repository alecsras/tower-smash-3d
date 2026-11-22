// ================= sound =================
let AC = null, NB = null, MASTER = null;
function applyVolume() { if (MASTER) MASTER.gain.value = SAVE.volume; }
function initAudio() {
  if (AC) { if (AC.state !== 'running') AC.resume().catch(() => {}); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    MASTER = AC.createGain(); MASTER.gain.value = SAVE.volume; MASTER.connect(AC.destination); } catch (e) { AC = null; }
}
function noise(dur, type, freq, vol, q) { if (!AC || muted || !isFinite(vol) || !isFinite(freq) || !isFinite(dur)) return; const t = AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = NB; s.loop = dur > .45; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(MASTER); s.start(t, Math.random() * .5); s.stop(t + dur + .02); }
function tone(f0, f1, dur, vol, type) { if (!AC || muted || !isFinite(f0) || !isFinite(f1) || !isFinite(vol) || !isFinite(dur)) return; const t = AC.currentTime; const o = AC.createOscillator(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(MASTER); o.start(t); o.stop(t + dur + .02); }
// layered, positional explosion: crack + body + sub + delayed debris, panned and quieter with distance
function boomLayered(power = 1, pos) {
  if (!AC || muted) return; const t = AC.currentTime;
  let vol = 1, pan = 0, delay = 0;
  if (pos && camera) { const d = camera.position.distanceTo(pos); vol = clamp(1.6 / (1 + d / 22), .15, 1.2); delay = Math.min(.25, d / 343);
    const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(camera); pan = clamp(v.x, -1, 1) * .8; }
  const out = AC.createGain(); out.gain.value = vol * Math.min(1.6, .6 + power * .5);
  const pn = AC.createStereoPanner ? AC.createStereoPanner() : null; if (pn) { pn.pan.value = pan; out.connect(pn); pn.connect(MASTER); } else out.connect(MASTER);
  const layer = (dur, type, freq, v, q, at = 0, f1) => { const s = AC.createBufferSource(); s.buffer = NB; s.loop = true; const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t + delay + at); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + delay + at + dur); f.Q.value = q || 1;
    const g = AC.createGain(); g.gain.setValueAtTime(.0001, t + delay + at); g.gain.exponentialRampToValueAtTime(v, t + delay + at + .008); g.gain.exponentialRampToValueAtTime(.001, t + delay + at + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t + delay + at, Math.random() * .5); s.stop(t + delay + at + dur + .05); };
  layer(.09, 'highpass', 2200, .7);                                   // crack
  layer(.9 + power * .5, 'lowpass', 500, 1, 1, 0, 120);              // body
  const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(90, t + delay); o.frequency.exponentialRampToValueAtTime(24, t + delay + 1 + power * .4);
  g.gain.setValueAtTime(.9, t + delay); g.gain.exponentialRampToValueAtTime(.001, t + delay + 1.1 + power * .4); o.connect(g); g.connect(out); o.start(t + delay); o.stop(t + delay + 1.6 + power * .4);   // sub
  for (let i = 0; i < 4; i++) layer(.07, 'bandpass', 900 + Math.random() * 1800, .25, 3, .25 + Math.random() * .7);   // debris rattle
}
const snd = {
  place() { noise(.07, 'lowpass', 700, .35); },
  thud(v = 1) { noise(.13, 'lowpass', 450, .6 * v); },
  rumble() { noise(1.6, 'lowpass', 110, .9); tone(55, 34, 1.4, .35); },
  clack(v = 1) { noise(.08, 'bandpass', 1500, .5 * v, 1.5); },
  tink(v = 1) { tone(3000 + Math.random() * 1200, 2400, .12, .06 * v, 'triangle'); },
  glass(v = 1) { noise(.3, 'highpass', 3200, .35 * v); tone(2600 + Math.random() * 1500, 1800, .25, .07, 'triangle'); tone(4200, 3000, .18, .04, 'triangle'); },
  boom() { noise(1.1, 'lowpass', 220, 1.2); tone(110, 28, .9, .8); },
  nuke() { noise(3.5, 'lowpass', 140, 1.6); tone(70, 18, 3, 1); noise(1.2, 'bandpass', 600, .5, .5); },
  hole() { tone(60, 38, 3.4, .45, 'sawtooth'); tone(220, 90, 3.4, .08, 'sine'); noise(3.4, 'lowpass', 90, .4); },
  quake() { noise(5.5, 'lowpass', 70, 1.3); tone(40, 30, 5.5, .5); },
  wind() { noise(1.2, 'bandpass', 380, .35, .4); },
  rocket() { noise(.9, 'bandpass', 1100, .35, .8); },
  pop() { noise(.15, 'bandpass', 1500, .4, 1); tone(500, 200, .15, .1, 'square'); },
  squish() { tone(320, 90, .2, .18, 'sine'); noise(.12, 'lowpass', 900, .3); },
  crack() { noise(.09, 'highpass', 1800, .35); tone(180, 60, .1, .08, 'square'); },
  crackle(v = 1) { noise(.05, 'highpass', 2500 + Math.random() * 2000, .12 * v); },
  ding() { tone(880, 880, .12, .08, 'triangle'); setTimeout(() => tone(1320, 1320, .25, .08, 'triangle'), 110); },
  clang(v = 1) { tone(900 + Math.random() * 400, 600, .25, .07 * v, 'square'); noise(.06, 'highpass', 3000, .3 * v); },
  boing(v = 1) { tone(180, 520, .18, .12 * v, 'sine'); },
  zap() { noise(.35, 'highpass', 2500, .5); tone(1400, 90, .3, .15, 'sawtooth'); },
  laser() { tone(1800, 300, .5, .1, 'sawtooth'); },
  splash() { noise(1.2, 'lowpass', 900, .7); },
  bang() { noise(.12, 'bandpass', 1200, .5, 1); },
  quack() { tone(700, 450, .12, .12, 'square'); },
  twang() { [220, 277, 330, 415].forEach((f, i) => setTimeout(() => tone(f, f * .99, .9, .07, 'triangle'), i * 25)); noise(.6, 'lowpass', 300, .9); },
  whoosh() { noise(.22, 'bandpass', 800, .3, .6); }
};

