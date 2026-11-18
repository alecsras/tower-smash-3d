import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';
// Regression: in levels the tray could keep a used-up weapon selected (or let you pick it), so the next
// throw silently launched a different weapon or failed with "out of ammo" while ammo was left.
const tray = page => page.evaluate(() => [...document.querySelectorAll('#tray .item')].map(i => (i.classList.contains('on') ? '*' : '') + i.textContent));
async function throwOnce(page, y = 400) { await page.mouse.move(195, y); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(600); }

test('level ammo: counts update, empty weapons cannot be picked, switching is announced', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => { const g = window.__game; g.startChallenge(g.campaignDef(0)); });
  await page.waitForTimeout(500);
  expect(await tray(page)).toEqual(['*Baseball ×2', 'Bowling ×1']);
  await throwOnce(page); await throwOnce(page, 380);
  expect(await tray(page)).toEqual(['Baseball ×0', '*Bowling ×1']);
  await page.click('#tray .item:first-child');
  expect(await tray(page)).toEqual(['Baseball ×0', '*Bowling ×1']);
  await throwOnce(page, 370);
  expect(await page.evaluate(() => window.__game.chal.ammo.map(a => a.n))).toEqual([0, 0]);
  expect(errors).toEqual([]);
});

test('free play: picking a weapon keeps the tray where it was scrolled', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__game.setMode('throw'));
  await page.evaluate(() => { document.getElementById('tray').scrollLeft = 200; });
  const before = await page.evaluate(() => document.getElementById('tray').scrollLeft);
  await page.evaluate(() => { const items = [...document.querySelectorAll('#tray .item')]; items[5].click(); });
  expect(await page.evaluate(() => document.getElementById('tray').scrollLeft)).toBe(before);
});
