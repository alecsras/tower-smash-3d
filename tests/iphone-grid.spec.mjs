import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';
// Safari engine: finger-drag paints the grid and Build it puts the design on the pad
test('iphone: grid designer drag-paints and builds', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => { localStorage.removeItem('ts_grid_draft'); window.__game.clearAll(); window.__game.openLibrary('create'); });
  await page.locator('.gdopen').click();
  const box = await page.locator('#gdCanvas').boundingBox(), cs = box.width / 12;
  await page.mouse.move(box.x + cs / 2, box.y + cs * 5.5); await page.mouse.down();
  await page.mouse.move(box.x + cs * 11.5, box.y + cs * 5.5, { steps: 8 }); await page.mouse.up();
  expect(await page.evaluate(() => window.__game.gdCount())).toBe(72);
  await page.locator('#gdBuild').click();
  await page.waitForFunction(() => window.__game.objs.filter(o => o.type === 'block' && !o.gone).length === 72);
  expect(errors).toEqual([]);
});
