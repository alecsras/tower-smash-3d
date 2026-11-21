import { test, expect } from '@playwright/test';
import { PAGE } from './helpers.mjs';

// Physics in a Web Worker: results arrive as messages, so this driver yields between frames and waits for the
// worker's answer before each frame (like a phone whose worker keeps up). Fake timestamps make many seconds quick.
async function openWorker(page) {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { const q = []; window.__rafQ = q; window.requestAnimationFrame = cb => { q.push(cb); return q.length; }; window.__t = 0; });
  await page.goto(PAGE + '?worker=1');
  await page.evaluate(async () => { window.__t = performance.now();
    for (let i = 0; i < 900 && !(window.__game && !document.getElementById('boot')); i++) { const q = window.__rafQ.splice(0); window.__t += 16.7; q.forEach(cb => cb(window.__t)); await new Promise(r => setTimeout(r, 10)); } });
  await page.evaluate(() => { const g = window.__game; g.SAVE.quality = 'low'; g.PROF.noRender = true;
    const tick = () => new Promise(r => setTimeout(r, 0));
    window.__arun = async (frames, ms, act) => { const st = { sunk: 0, launched: 0, minY: 9, steps0: g.P.stepNo }, seen = new Set();
      for (let f = 0; f < frames; f++) {
        for (let w = 0; g.P.busy && w < 2000; w++) await tick();
        const q = window.__rafQ.splice(0); window.__t += ms; q.forEach(cb => cb(window.__t));
        if (f === 30 && act) act(g);
        await tick();
        for (const o of g.objs) { if (o.gone || o.type !== 'block' || !o.body.inWorld) continue; const y = o.body.position.y; st.minY = Math.min(st.minY, y);
          if (y < -.2 && !seen.has(o)) { seen.add(o); st.sunk++; } if (seen.has(o) && o.body.velocity.y > 5) st.launched++; } }
      st.steps = g.P.stepNo - st.steps0; st.minY = +st.minY.toFixed(3); return st; }; });
  return errors;
}

export function workerCases() {
  test('physics runs in a worker: a cannonball topples the castle with nothing sinking', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await openWorker(page);
    expect(await page.evaluate(() => window.__game.P.mode)).toBe('worker');
    const r = await page.evaluate(async () => { const g = window.__game; g.SAVE.sandbox = true; g.loadPreset(g.PRESETS.find(p => p.id === 'castle')); g.setMode('throw');
      const bl = g.objs.filter(o => o.type === 'block'), st = new Map(bl.map(o => [o, { ...o.body.position }]));
      const res = await window.__arun(300, 16.7, g => g.throwAt('ball', 0, 2, 0, .8));
      res.moved = bl.filter(o => o.gone || Math.hypot(o.body.position.x - st.get(o).x, o.body.position.z - st.get(o).z) > .3).length; return res; });
    expect(r.steps, JSON.stringify(r)).toBeGreaterThan(250);
    expect(r.moved, JSON.stringify(r)).toBeGreaterThan(3);
    expect(r.sunk, JSON.stringify(r)).toBe(0);
    expect(r.launched, JSON.stringify(r)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('worker: Metropolis stands with every block awake', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await openWorker(page);
    const r = await page.evaluate(async () => { const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === 'metropolis')); g.setMode('throw');
      const bl = g.objs.filter(o => o.type === 'block'), st = new Map(bl.map(o => [o, { ...o.body.position }]));
      for (const o of bl) g.kick(o, 0, 0, 0);
      const res = await window.__arun(240, 16.7);
      res.n = bl.length; res.side = bl.filter(o => Math.hypot(o.body.position.x - st.get(o).x, o.body.position.z - st.get(o).z) > .3).length; return res; });
    expect(r.sunk, JSON.stringify(r)).toBe(0);
    expect(r.side, JSON.stringify(r)).toBeLessThan(r.n * .02);
    expect(errors).toEqual([]);
  });

  test('worker: earthquake shakes the ground and fused blocks hold', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await openWorker(page);
    const r = await page.evaluate(async () => { const g = window.__game; g.SAVE.sandbox = true;
      g.runBlueprint(['clear', 'tower 3x3x5 brick']); g.fuseAll('weld'); const nb = g.bonds.size; g.setMode('throw');
      const bl = g.objs.filter(o => o.type === 'block'), st = new Map(bl.map(o => [o, { ...o.body.position }]));
      const res = await window.__arun(420, 16.7, g => g.startQuake());
      res.bonds0 = nb; res.bonds = g.bonds.size; res.moved = bl.filter(o => Math.hypot(o.body.position.x - st.get(o).x, o.body.position.z - st.get(o).z) > .05).length; res.n = bl.length; return res; });
    expect(r.bonds0, JSON.stringify(r)).toBeGreaterThan(10);
    expect(r.moved, JSON.stringify(r)).toBeGreaterThan(0);
    expect(r.sunk, JSON.stringify(r)).toBe(0);
    expect(errors).toEqual([]);
  });
}
