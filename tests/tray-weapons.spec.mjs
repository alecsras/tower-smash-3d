import { test, expect } from '@playwright/test';
import { tapThrough } from './tray-weapons.mjs';
// every weapon, picked from the tray and fired with a real press, one category per test
for (const cat of ['classic', 'power', 'kinetic', 'explosive', 'elemental', 'exotic', 'silly'])
  test(`tray: every ${cat} weapon picks, aims and fires without errors`, async ({ page }) => {
    test.setTimeout(300_000);
    const seen = await tapThrough(page, [cat], { settle: 1800 });
    expect(seen.length).toBeGreaterThan(3);
  });
