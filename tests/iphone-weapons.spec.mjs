import { test, expect } from '@playwright/test';
import { tapThrough } from './tray-weapons.mjs';
// Safari engine: all 93 weapons through the tray, shorter settle to fit the CI budget
test('iphone: every weapon picks, aims and fires without errors', async ({ page }) => {
  test.setTimeout(900_000);
  const seen = await tapThrough(page, ['classic', 'power', 'kinetic', 'explosive', 'elemental', 'exotic', 'silly'], { settle: 1200 });
  expect(seen.length).toBeGreaterThanOrEqual(93);
});
