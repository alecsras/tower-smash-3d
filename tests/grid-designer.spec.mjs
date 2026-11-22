import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';
// the designer slides in; measure the grid only once it has stopped moving
async function gridBox(page) {
  let prev = null;
  for (let k = 0; k < 40; k++) { const b = await page.locator('#gdCanvas').boundingBox(); if (b && prev && b.y === prev.y && b.width === prev.width && b.width > 50) return b; prev = b; await page.waitForTimeout(60); }
  return prev;
}

// drag across grid cells with a real pointer
async function drag(page, cells) {
  const box = await gridBox(page), w = await page.evaluate(() => window.__game.gd.w), cs = box.width / w;
  const at = ([i, j]) => [box.x + i * cs + cs / 2, box.y + j * cs + cs / 2];
  await page.mouse.move(...at(cells[0])); await page.mouse.down();
  for (const c of cells.slice(1)) await page.mouse.move(...at(c), { steps: 5 });
  await page.mouse.up();
}
const tool = (page, label) => page.locator('.gdtool', { hasText: label }).click();
const cell = (page, i, j) => page.evaluate(([i, j]) => { const g = window.__game.gd, c = g.cells[j * g.w + i]; return c && { h: c.h, m: c.m, o: c.o || null }; }, [i, j]);

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 760 }); });

test('grid designer: every drawing tool, mirror, undo/redo and resize', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => { localStorage.removeItem('ts_grid_draft'); window.__game.openLibrary('create'); });
  await page.locator('.gdopen').click();
  await expect(page.locator('#gridd')).toHaveClass(/open/);
  await expect(page.locator('#library')).not.toHaveClass(/open/);

  // paint a line at height 6 stone, fast swipe must not leave gaps
  await drag(page, [[0, 0], [11, 0]]);
  for (let i = 0; i < 12; i++) expect(await cell(page, i, 0)).toEqual({ h: 6, m: 'stone', o: null });
  // brick, height 3, mirrored left/right
  await page.locator('.gdsw[aria-label="Brick"]').click();
  await page.evaluate(() => { window.__game.gd.h = 3; });
  await page.locator('.chip', { hasText: 'Left ↔ right' }).click();
  await drag(page, [[1, 5], [2, 5]]);
  expect(await cell(page, 10, 5)).toEqual({ h: 3, m: 'brick', o: null });
  expect(await cell(page, 9, 5)).toEqual({ h: 3, m: 'brick', o: null });
  await page.locator('.chip', { hasText: 'Off' }).click();
  // raise twice, lower once
  await tool(page, 'Raise'); await drag(page, [[1, 5], [1, 5]]); await drag(page, [[1, 5], [1, 5]]);
  expect((await cell(page, 1, 5)).h).toBe(5);
  await tool(page, 'Lower'); await drag(page, [[1, 5], [1, 5]]);
  expect((await cell(page, 1, 5)).h).toBe(4);
  // layer: glass on layer 2 of the top row
  await tool(page, 'Layer'); await page.locator('.gdsw[aria-label="Glass"]').click();
  await page.evaluate(() => { window.__game.gd.layer = 2; });
  await drag(page, [[0, 0], [3, 0]]);
  expect(await cell(page, 2, 0)).toEqual({ h: 6, m: 'stone', o: { 1: 'glass' } });
  // box outline and filled circle
  await tool(page, 'Box'); await page.locator('.gdsw[aria-label="Wood"]').click();
  await drag(page, [[3, 7], [8, 10]]);
  expect((await cell(page, 3, 7)).m).toBe('wood'); expect(await cell(page, 5, 8)).toBe(null);
  // fill the hole inside the box
  await tool(page, 'Fill'); await page.locator('.gdsw[aria-label="Gold"]').click();
  const box = await gridBox(page), cs = box.width / 12;
  await page.mouse.click(box.x + 5.5 * cs, box.y + 8.5 * cs);
  expect((await cell(page, 5, 8)).m).toBe('gold'); expect((await cell(page, 4, 9)).m).toBe('gold');
  expect(await cell(page, 0, 11)).toBe(null);   // fill stayed inside the box
  // edit a single cell's column
  await tool(page, 'Edit cell'); await page.mouse.click(box.x + 0.5 * cs, box.y + 0.5 * cs);
  await expect(page.locator('.gdcol')).toContainText('6 high');
  await page.locator('.gdcol .gdsw[aria-label="Marble"]').last().click();   // brush material
  await page.locator('.gdblk', { hasText: /^6$/ }).click();                 // top block
  expect((await cell(page, 0, 0)).o).toEqual({ 1: 'glass', 5: 'marble' });   // keeps the glass layer painted earlier
  // undo / redo
  await page.locator('#gdUndo').click(); expect((await cell(page, 0, 0)).o).toEqual({ 1: 'glass' });
  await page.locator('#gdRedo').click(); expect((await cell(page, 0, 0)).o).toEqual({ 1: 'glass', 5: 'marble' });
  // resize keeps the design centred
  const before = await page.evaluate(() => window.__game.gdCount());
  await page.locator('.chip', { hasText: '16×16' }).click();
  expect(await page.evaluate(() => [window.__game.gd.w, window.__game.gd.l, window.__game.gdCount()])).toEqual([16, 16, before]);
  expect((await cell(page, 2, 2)).m).toBe('stone');
  await expect(page.locator('#gdCount')).toHaveText(`${before.toLocaleString('en-US')} blocks`);
  expect(errors).toEqual([]);
});

test('grid designer: builds exactly what was drawn, and it stands still', async ({ page }) => {
  const errors = await open(page);
  // a 16×16 design: a 24-high tower ring, mixed-height interior, striped layers
  await page.evaluate(() => { const g = window.__game, gd = g.gd;
    g.openGrid(); gd.w = gd.l = 16; gd.cells = Array(256).fill(null);
    for (const [i, j] of g.gdShapeCells([7.5, 7.5], [7.5, 1], 'circle')) if (i >= 0 && j >= 0 && i < 16 && j < 16) gd.cells[j * 16 + i] = { h: 24, m: 'stone', o: { 5: 'glass', 11: 'glass', 17: 'glass' } };
    for (let i = 5; i <= 10; i++) for (let j = 5; j <= 10; j++) gd.cells[j * 16 + i] = { h: 1 + ((i * 3 + j) % 9), m: (i + j) % 2 ? 'wood' : 'brick' };
    g.gdChanged(true);
    window.__exp = [g.gdCount(), gd.cells.reduce((a, c) => a + (c && c.o ? Object.keys(c.o).length : 0), 0)];
    g.gdBuild();   // the pad already has a build, so this asks first
  });
  await page.locator('#dialog.open #dlgRow button', { hasText: 'Build it' }).click();
  await page.waitForFunction(() => !document.querySelector('#gridd').classList.contains('open'));
  const placed2 = await page.evaluate(() => { const g = window.__game, [expected, glass] = window.__exp;
    const bl = g.objs.filter(o => o.type === 'block' && !o.gone);
    return { expected, n: bl.length, glass: bl.filter(o => o.spec.mat === 'glass').length, glassExp: glass, front: Math.max(...bl.map(o => o.body.position.z)), mode: g.screen, open: document.querySelector('#gridd').classList.contains('open') };
  });
  const placed = placed2; expect(placed.n).toBe(placed.expected);
  expect(placed.glass).toBe(placed.glassExp);
  expect(placed.open).toBe(false);
  // settle and confirm nothing drifted
  const drift = await page.evaluate(() => { const g = window.__game, bl = g.objs.filter(o => o.type === 'block' && !o.gone);
    const p0 = bl.map(o => [o.body.position.x, o.body.position.y, o.body.position.z]); g.ff(6);
    return Math.max(...bl.map((o, k) => Math.hypot(o.body.position.x - p0[k][0], o.body.position.y - p0[k][1], o.body.position.z - p0[k][2]))); });
  expect(drift).toBeLessThan(.05);
  expect(errors).toEqual([]);
});

test('grid designer: drafts and saved designs survive a reload; the block limit is enforced', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => { localStorage.removeItem('ts_grid_designs'); const g = window.__game; g.openGrid(); g.gd.cells = Array(g.gd.w * g.gd.l).fill(null); g.gdApply(3, 3, 'paint'); g.gdChanged(true); });
  await page.locator('.gdname').fill('My keep');
  await page.locator('#gdPanel button', { hasText: 'Save' }).click();
  await expect(page.locator('.gditem')).toContainText('My keep');
  await page.waitForTimeout(500);   // draft autosave is debounced
  await page.reload(); await page.waitForFunction(() => window.__game);
  const r = await page.evaluate(() => { const g = window.__game; g.openGrid(); return [g.gdCount(), document.querySelectorAll('.gditem').length]; });
  expect(r).toEqual([6, 1]);
  // over the limit: refuses and the pad is untouched
  const cap = await page.evaluate(async () => { const g = window.__game, gd = g.gd; gd.w = gd.l = 48; gd.cells = Array(48 * 48).fill(null).map(() => ({ h: 4, m: 'stone' })); g.gdChanged(true);
    const before = g.objs.filter(o => o.type === 'block' && !o.gone).length; await g.gdBuild();
    return [g.gdCount(), before, g.objs.filter(o => o.type === 'block' && !o.gone).length, document.querySelector('#gdCount').className]; });
  expect(cap[0]).toBe(9216); expect(cap[2]).toBe(cap[1]); expect(cap[3]).toBe('bad');
  expect(errors).toEqual([]);
});
