import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';
// Runs in WebKit (Safari's engine) with an iPhone 13 screen and touch input.
test('iPhone: boots, first-run screens, level tray taps select the right weapon', async ({ page }) => {
  const errors = await open(page, { shell: true });
  await expect(page.locator('#title')).toHaveClass(/on/);
  await page.evaluate(() => { const g = window.__game; g.SAVE.onboarded = g.SAVE.trained = true; g.startChallenge(g.campaignDef(0)); });
  await page.waitForTimeout(600);
  const items = page.locator('#tray .item');
  await items.nth(1).tap();
  await expect(items.nth(1)).toHaveClass(/on/);
  await items.nth(0).tap();
  await expect(items.nth(0)).toHaveClass(/on/);
  expect(await page.evaluate(() => window.__game.chal.ammo[0].kind)).toBe('ball');
  expect(errors).toEqual([]);
});
