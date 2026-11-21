import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

test('destruction score: toppled blocks score, combos multiply, best is kept per build', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await open(page);
  const r = await page.evaluate(async () => {
    const g = window.__game, castle = g.PRESETS.find(p => p.id === 'castle');
    g.SAVE.best = {}; g.loadPreset(castle); g.setMode('throw'); g.updateHud();
    g.boom(0, 1, 0, 2.5); g.ff(4); g.updateHud(); g.ff(.2); g.updateHud();
    const first = { pts: g.SCORE.pts, hud: document.getElementById('hud').textContent };
    for (let i = 0; i < 20 && !g.SCORE.announced; i++) { g.ff(1); g.updateHud(); }
    const first2 = g.SCORE.pts;
    const best = g.SAVE.best['build:castle'];
    g.rebuild2(); g.ff(.1); g.updateHud();
    return { first, first2, best, afterRebuild: g.SCORE.pts, keptBest: g.SCORE.best, dbg: JSON.stringify(g.SCORE), sb: JSON.stringify(g.SAVE.best) };
  });
  expect(r.first.pts).toBeGreaterThan(100);
  expect(r.first.hud).toMatch(/\d[\d,]* ?/);
  expect(r.best, JSON.stringify(r)).toBe(r.first2);
  expect(r.afterRebuild).toBe(0);
  expect(r.keptBest).toBe(r.best);
  expect(errors).toEqual([]);
});

test('combo multiplier grows with a chain and caps at x5', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => { const g = window.__game; return [1, 8, 16, 40, 200].map(n => g.comboMult(n)); });
  expect(r).toEqual([1, 1.5, 2, 3.5, 5]);
});
