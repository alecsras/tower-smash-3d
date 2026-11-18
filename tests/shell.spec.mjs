import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

test('first run: title, intro cards, name, Training Yard', async ({ page }) => {
  const errors = await open(page, { shell: true });
  await expect(page.locator('#title')).toHaveClass(/on/);
  await page.click('#titlePlay', { force: true });
  await expect(page.locator('#intro')).toHaveClass(/on/);
  for (let i = 0; i < 3; i++) await page.click('#introCard .btn.primary');
  await page.fill('#introName', 'Tester');
  await page.click('#introCard .btn.primary');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__game.screen)).toBe('game');
  await expect(page.locator('#hud')).toContainText('Training');
  await expect(page.locator('#coach')).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__game.SAVE.name)).toBe('Tester');
  expect(errors).toEqual([]);
});

test('home, pause menu, settings, help, feedback, library all open', async ({ page }) => {
  const errors = await open(page, { shell: true });
  await page.evaluate(() => { window.__game.SAVE.onboarded = true; window.__game.SAVE.trained = true; window.__game.showScreen('home'); });
  await expect(page.locator('#homeContinue')).toContainText('Level 1');
  await page.evaluate(() => window.__game.enterFreePlay());
  await page.click('#pauseBtn');
  await expect(page.locator('#pause')).toHaveClass(/open/);
  expect(await page.evaluate(() => window.__game.paused)).toBe(true);
  await page.click('#pauseX');
  for (const [fn, id] of [['openSettings', 'settings'], ['openHelp', 'help'], ['openFeedback', 'feedback'], ['openLibrary', 'library']]) {
    await page.evaluate(f => window.__game[f](), fn);
    await expect(page.locator('#' + id)).toHaveClass(/open/);
    await page.evaluate(i => document.getElementById(i).classList.remove('open'), id);
  }
  const report = await page.evaluate(() => window.__game.buildReport('hello'));
  expect(report).toContain('Tower Smash 3D 0.');
  expect(report).toContain('hello');
  expect(errors).toEqual([]);
});

test('save export and import round trip', async ({ page }) => {
  await open(page);
  const code = await page.evaluate(() => { window.__game.SAVE.coins = 4321; window.__game.SAVE.name = 'Round'; localStorage.setItem('ts_save', JSON.stringify(window.__game.SAVE)); return window.__game.exportSave(); });
  expect(code.startsWith('TSAVE1.')).toBe(true);
  const ok = await page.evaluate(c => { localStorage.clear(); return window.__game.importSave(c); }, code);
  expect(ok).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ts_save')).coins)).toBe(4321);
  expect(await page.evaluate(() => window.__game.importSave('garbage'))).toBe(false);
});
