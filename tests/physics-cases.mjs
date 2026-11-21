import { test, expect } from '@playwright/test';
import { PAGE } from './helpers.mjs';

// Drive the game's own frame loop with fake 60/120 fps timestamps so many seconds of real gameplay run quickly.
async function openDriven(page) {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { const q = []; window.__rafQ = q; window.requestAnimationFrame = cb => { q.push(cb); return q.length; }; window.__t = 0; });
  await page.goto(PAGE);
  await page.evaluate(async () => { window.__t = performance.now();
    for (let i = 0; i < 600 && !(window.__game && !document.getElementById('boot')); i++) { const q = window.__rafQ.splice(0); window.__t += 16.7; q.forEach(cb => cb(window.__t)); await new Promise(r => setTimeout(r, 10)); } });
  await page.evaluate(() => { const g = window.__game; g.SAVE.quality = 'low'; if (g.PROF) g.PROF.noRender = true;
    window.__run = (frames, ms, hitAt) => { const st = { under: 0, rocket: 0, minY: 9 }, seen = new Set();
      for (let f = 0; f < frames; f++) { const q = window.__rafQ.splice(0); window.__t += ms * (.85 + Math.random() * .3); q.forEach(cb => cb(window.__t));
        if (f === hitAt) g.throwAt('ball', 0, 2, 0, .7);
        // sunk: a block's centre more than 20 cm into the floor. launched: a sunk block later shot upward by the floor.
        for (const o of g.objs) { if (o.gone || o.type !== 'block' || !o.body.rb) continue; const y = o.body.position.y; st.minY = Math.min(st.minY, y);
          if (y < -.2 && !seen.has(o)) { seen.add(o); st.under++; } if (seen.has(o) && o.body.velocity.y > 5) st.rocket++; } }
      st.minY = +st.minY.toFixed(3); return st; }; });
  return errors;
}

export function physicsCases() {
  for (const [id, ms] of [['castle', 16.7], ['temple', 16.7], ['castle', 8.33], ['metropolis', 33.3]]) {
    test(`${id} at ${Math.round(1000 / ms)} fps: blocks never sink into the floor or launch`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = await openDriven(page);
      await page.evaluate(id => { const g = window.__game; g.SAVE.sandbox = true; g.loadPreset(g.PRESETS.find(p => p.id === id)); g.setMode('throw'); }, id);
      const r = await page.evaluate(ms => window.__run(Math.round(6000 / ms), ms, 30), ms);
      expect(r.under, JSON.stringify(r)).toBe(0);
      expect(r.rocket, JSON.stringify(r)).toBe(0);
      expect(errors).toEqual([]);
    });
  }
  // every block awake at once: builds must hold themselves up
  for (const id of ['castle', 'metropolis']) {
    test(`${id} stands on its own with every block awake`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(PAGE); await page.waitForFunction(() => window.__game && !document.getElementById('boot'), null, { timeout: 30_000 });
      const r = await page.evaluate(id => {
        const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === id)); g.setMode('throw');
        const bl = g.objs.filter(o => o.type === 'block'), start = new Map(bl.map(o => [o, { ...o.body.position }]));
        for (const o of bl) g.kick(o, 0, 0, 0);
        let under = 0;
        for (let i = 0; i < 150; i++) { g.ff(1 / 60); for (const o of bl) if (!o.gone && o.body.position.y < -.2) { under++; break; } }
        let fell = 0; for (const o of bl) { const a = start.get(o), p = o.body.position; if (o.gone || Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z) > .5) fell++; }
        return { n: bl.length, under, fell };
      }, id);
      expect(r.under, JSON.stringify(r)).toBe(0);
      expect(r.fell, JSON.stringify(r)).toBeLessThan(r.n * .02);
      expect(errors).toEqual([]);
    });
  }
}
