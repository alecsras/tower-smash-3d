import { test } from '@playwright/test';
import { checkDoodle } from './doodle.mjs';
test('doodle art style: shader compiles, sky becomes paper, UI switches, back to classic', async ({ page }) => { await checkDoodle(page); });
