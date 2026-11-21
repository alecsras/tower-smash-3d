import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

// F3: still rubble freezes into fixed scenery so big piles stop costing physics time. These check it stays honest.
test('settled rubble goes quiet, and still reacts when hit', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page);
  const r = await page.evaluate(() => {
    const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === 'castle')); g.setMode('throw');
    g.boom(0, 1, 0, 2.5); g.ff(8);
    const inWorld = [...g.P.bodies()].length, awake = g.P.activeCount;
    const bl = g.objs.filter(o => o.type === 'block' && !o.gone && o.body.inWorld), st = new Map(bl.map(o => [o, { ...o.body.position }]));
    g.boom(0, .5, 0, 1.5); g.ff(1.5);
    const moved = bl.filter(o => o.gone || Math.hypot(o.body.position.x - st.get(o).x, o.body.position.y - st.get(o).y, o.body.position.z - st.get(o).z) > .2).length;
    return { inWorld, awake, moved };
  });
  expect(r.awake, JSON.stringify(r)).toBeLessThan(r.inWorld * .5);
  expect(r.moved, JSON.stringify(r)).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('blocks resting on frozen blocks fall when their support disappears', async ({ page }) => {
  const errors = await open(page);
  const r = await page.evaluate(() => {
    const g = window.__game; g.clearAll(); g.setMode('throw');
    const s = g.CUBE('stone'), a = g.createPiece(s, 0, .5005, 0, null, false), b = g.createPiece(s, 0, 1.501, 0, null, false), c = g.createPiece(s, 0, 2.5015, 0, null, false);
    g.ff(3);
    const asleep = [a, b, c].every(o => o.body.isSleeping());
    g.removeObj(a); g.ff(1.5);
    return { asleep, b: +b.body.position.y.toFixed(2), c: +c.body.position.y.toFixed(2) };
  });
  expect(r.asleep, JSON.stringify(r)).toBe(true);
  expect(r.b, JSON.stringify(r)).toBeLessThan(.6);
  expect(r.c, JSON.stringify(r)).toBeLessThan(1.6);
  expect(errors).toEqual([]);
});
