// Bundled on its own (with Rapier) and embedded in the page as text. Started either as a Web Worker
// (physics off the main thread) or as a plain script on the main thread; both speak the same commands.
import RAPIER from '@dimforge/rapier3d-compat';
import { createEngine } from './engine.js';

const start = async () => { await RAPIER.init(); return createEngine(RAPIER); };
const inWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;

if (inWorker) {
  let engine = null;
  self.onmessage = async e => {
    const m = e.data;
    try {
      if (m.t === 'init') { engine = await start(); self.postMessage({ t: 'ready' }); }
      else if (m.t === 'run') { const r = engine.run(m.cmds); r.t = 'res'; r.seq = m.seq; self.postMessage(r, [r.poses.buffer, r.hits.buffer]); }
    } catch (err) { self.postMessage({ t: 'error', message: String(err && err.stack || err) }); }
  };
} else self.TSEngine = { start };
