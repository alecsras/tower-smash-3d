import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

// Regression: builds must hold themselves up when every block is awake.
// Rapier 0.21 corrupts a body that is put to sleep while something it touches is still awake:
// it sinks through the floor and knocks the build down. phys.js only naps whole calm groups.
for (const id of ['castle', 'metropolis']) {
  test(`${id} stands on its own with every block awake`, async ({ page }) => {
    const errors = await open(page);
    const r = await page.evaluate(id => {
      const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === id)); g.setMode('throw');
      const bl = g.objs.filter(o => o.type === 'block');
      const start = new Map(bl.map(o => [o, { ...o.body.position }]));
      for (const o of bl) g.kick(o, 0, 0, 0);
      let under = 0;
      for (let i = 0; i < 150; i++) { g.ff(1 / 60); for (const o of bl) if (!o.gone && o.body.getAABB().lowerBound.y < -.1) { under++; break; } }
      let fell = 0;
      for (const o of bl) { const a = start.get(o), p = o.body.position; if (o.gone || Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z) > .5) fell++; }
      return { n: bl.length, under, fell };
    }, id);
    expect(r.under).toBe(0);
    expect(r.fell).toBeLessThan(r.n * .02);
    expect(errors).toEqual([]);
  });
}
