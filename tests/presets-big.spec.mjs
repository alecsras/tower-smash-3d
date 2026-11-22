import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

// the 2,000–3,000-block builds (overlaps are covered by presets.spec for every mega build)
const BIG = ['royal', 'skyline', 'sunpyramid', 'grandcolosseum', 'labyrinth', 'cathedral', 'dam', 'dominocarpet', 'stoneforest', 'officegrid'];

test('the ten big builds are 2,000–3,000 blocks', async ({ page }) => {
  const errors = await open(page);
  const r = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, window.__game.countOf(window.__game.PRESETS.find(p => p.id === id))])), BIG);
  for (const id of BIG) { expect(r[id], id).toBeGreaterThanOrEqual(2000); expect(r[id], id).toBeLessThanOrEqual(3000); }
  expect(errors).toEqual([]);
});

for (const id of BIG) {
  test(`${id} holds itself up with every block awake`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors = await open(page);
    const r = await page.evaluate(id => {
      const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === id)); g.setMode('throw');
      const bl = g.objs.filter(o => o.type === 'block'), st = new Map(bl.map(o => [o, { ...o.body.position }]));
      for (const o of bl) g.kick(o, 0, 0, 0);
      g.ff(3);
      let side = 0, drop = 0, sunk = 0;
      for (const o of bl) { const a = st.get(o), p = o.body.position; if (Math.hypot(p.x - a.x, p.z - a.z) > .3) side++; if (a.y - p.y > .5) drop++; if (p.y < -.2) sunk++; }
      return { n: bl.length, side, drop, sunk };
    }, id);
    expect(r.sunk, JSON.stringify(r)).toBe(0);
    expect(r.side + r.drop, JSON.stringify(r)).toBeLessThan(r.n * .01);
    expect(errors).toEqual([]);
  });
}

test('Domino Carpet: tipping the first row topples all 2,200', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = await open(page);
  const r = await page.evaluate(() => {
    const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === 'dominocarpet')); g.setMode('throw');
    const d = g.objs.filter(o => o.type === 'block'), z0 = Math.min(...d.map(o => o.body.position.z));
    for (const o of d) if (Math.abs(o.body.position.z - z0) < .01) g.kick(o, 6, 0, 0);
    g.ff(5);
    return { n: d.length, down: d.filter(o => { const q = o.body.quaternion; return Math.abs(q.x) + Math.abs(q.z) > .3; }).length };
  });
  expect(r.down).toBeGreaterThan(r.n * .95);
  expect(errors).toEqual([]);
});
