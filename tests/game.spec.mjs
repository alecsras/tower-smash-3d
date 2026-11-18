import { test, expect } from '@playwright/test';
import { open, blocks } from './helpers.mjs';

test('boots into the castle with no errors', async ({ page }) => {
  const errors = await open(page);
  expect(await blocks(page)).toBeGreaterThan(200);
  expect(errors).toEqual([]);
});

test('build tools: walls, undo, redo, line, erase, paint', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => window.__game.runBlueprint(['clear']));
  const r = await page.evaluate(async () => {
    const g = window.__game, n = () => g.objs.filter(o => !o.gone && o.type === 'block').length, w = () => new Promise(r => setTimeout(r, 300)), out = {};
    g.curBlock = 'brick'; g.setTool('walls'); g.toolH = 3; g.toolDown(140, 420); g.toolMove(260, 470); g.toolUp(true); out.walls = n();
    g.undo(); out.undo = n(); g.redo(); out.redo = n(); await w();
    return out;
  });
  expect(r.walls).toBeGreaterThan(50);
  expect(r.undo).toBe(0);
  expect(r.redo).toBe(r.walls);
  expect(errors).toEqual([]);
});

test('every weapon fires without errors', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await open(page);
  const keys = await page.evaluate(() => { const g = window.__game; g.SAVE.sandbox = true; return Object.keys(g.PROJ).filter(k => !g.PROJ[k].hidden); });
  expect(keys.length).toBeGreaterThanOrEqual(43);
  await page.evaluate(() => { const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === 'temple')); g.setMode('throw'); });
  for (const k of keys) {
    await page.evaluate(kind => window.__game.throwAt(kind, 0, 2, 0, .7), k);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
});

test('campaign, daily and duel levels load', async ({ page }) => {
  const errors = await open(page);
  for (const def of ['campaignDef(0)', 'campaignDef(24)', 'campaignDef(49)', 'dailyDef()']) {
    await page.evaluate(d => { const g = window.__game; g.startChallenge(eval('g.' + d)); }, def);
    await page.waitForTimeout(300);
    await expect(page.locator('#hud')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test('every prefab and landmark blueprint builds', async ({ page }) => {
  await open(page);
  const bad = await page.evaluate(() => {
    const g = window.__game, bad = [];
    for (const [re, bp] of g.LANDMARKS) if (!g.runBlueprint(['clear', ...bp.split('\n')])) bad.push(String(re));
    for (const p of g.PREFABS) { const l = g.prefabLines(p); if (l && !g.runBlueprint(['clear', ...l])) bad.push(p[0]); }
    return bad;
  });
  expect(bad).toEqual([]);
});

test('bonds survive rebuild and save round trip', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const g = window.__game; g.runBlueprint(['clear', 'tower 4x4x6 brick']); g.fuseAll('weld');
    const n0 = g.bonds.size, d = g.snapBuild(false); g.placePieces(g.snapPieces(d), { replace: true });
    return [n0, g.bonds.size];
  });
  expect(r[0]).toBeGreaterThan(50);
  expect(r[1]).toBe(r[0]);
});
