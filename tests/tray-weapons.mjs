// Shared by tray-weapons.spec.mjs (Chrome) and iphone-weapons.spec.mjs (Safari engine).
// Picks every weapon the way a player does — category chip, tray button, press-and-release on the
// screen — so sound, the held preview, aiming and every delayed effect run for real.
import { expect } from '@playwright/test';
import { open } from './helpers.mjs';

export async function tapThrough(page, cats, { settle = 2500, query = '' } = {}) {
  const errors = await open(page, { query });
  await page.evaluate(() => { const g = window.__game; g.SAVE.sandbox = true; g.setMode('throw'); });
  const bad = [], seen = [];
  for (const cat of cats) {
    await page.evaluate(c => window.__game.setCat(c), cat);
    const n = await page.locator('#tray .item').count();
    for (let i = 0; i < n; i++) {
      await page.evaluate(c => { const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === 'pyramid')); g.setMode('throw'); g.setCat(c); }, cat);
      const btn = page.locator('#tray .item').nth(i), label = (await btn.locator('span').textContent()).trim();
      if (label.startsWith('🔒')) { bad.push(`${cat}/${label}: locked in sandbox`); continue; }
      const before = errors.length;
      await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(250);
      const vp = page.viewportSize(), x = vp.width / 2, y = vp.height * .42;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 2, y + 4, { steps: 4 }); await page.waitForTimeout(200); await page.mouse.up();
      await page.waitForTimeout(settle);
      seen.push(label);
      if (errors.length > before) bad.push(`${cat}/${label}: ${errors.slice(before).join(' | ').slice(0, 300)}`);
    }
  }
  // let long effects (storms, megabomb countdown, mines) finish before the final check
  const lateFrom = errors.length; await page.waitForTimeout(6000);
  if (errors.length > lateFrom) bad.push(`late: ${errors.slice(lateFrom).join(' | ').slice(0, 400)}`);
  expect(bad).toEqual([]);
  return seen;
}
