import { test, expect } from '@playwright/test';
import { tapThrough } from './tray-weapons.mjs';
// background physics is the default on most phones: every weapon must work with physics on its own thread too
test('worker: every weapon picks, aims and fires without errors with background physics', async ({ page }) => {
  test.setTimeout(900_000);
  const seen = await tapThrough(page, ['classic', 'power', 'kinetic', 'explosive', 'elemental', 'exotic', 'silly'], { settle: 1200, query: '?worker=1' });
  expect(seen.length).toBeGreaterThanOrEqual(93);
  expect(await page.evaluate(() => window.__game.P.mode)).toBe('worker');
});
