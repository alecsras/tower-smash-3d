import { test } from '@playwright/test';
import { checkDoodle } from './doodle.mjs';
test('iphone: doodle art style compiles and draws on Safari', async ({ page }) => { await checkDoodle(page); });
