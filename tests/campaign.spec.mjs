import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

test('campaign worlds: five worlds, star gates, and worlds you have played never re-lock', async ({ page }) => {
  const errors = await open(page, { shell: true });
  const r = await page.evaluate(() => {
    const g = window.__game; g.SAVE.camp = {};
    const fresh = { l1: g.campLock(0), l11: g.campLock(10) };
    for (let n = 0; n < 10; n++) g.SAVE.camp[n] = 1;          // 10 stars: world 2 still shut (needs 12)
    const ten = g.campLock(10);
    g.SAVE.camp[0] = 3; g.SAVE.camp[1] = 2;                   // 13 stars
    const thirteen = g.campLock(10);
    g.SAVE.camp = { 9: 1, 10: 1 };                            // an old save that already played world 2
    const legacy = g.campLock(11);
    g.openLevels('camp');
    const worlds = [...document.querySelectorAll('#lgrid .world b')].map(b => b.textContent);
    g.SAVE.camp = {};
    return { fresh, ten, thirteen, legacy, worlds, challenges: g.LEVELS.length };
  });
  expect(r.fresh.l1).toBe('');
  expect(r.fresh.l11).toContain('Stone Valley');
  expect(r.ten).toContain('2 more');
  expect(r.thirteen).toBe('');
  expect(r.legacy).toBe('');
  expect(r.worlds).toEqual(['Timber Town', 'Stone Valley', 'Concrete City', 'Marble Heights', 'Golden Citadel']);
  expect(r.challenges).toBe(15);
  expect(errors).toEqual([]);
});

test('the five new mega challenges load with their builds', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await open(page);
  const r = await page.evaluate(() => { const g = window.__game, out = [];
    for (let i = 10; i < 15; i++) { g.startLevel(i); out.push([g.LEVELS[i].preset, g.objs.filter(o => o.type === 'block').length]); }
    return out; });
  for (const [id, n] of r) expect(n, id).toBeGreaterThan(800);
  expect(errors).toEqual([]);
});

test('material unlocks: premium materials need stars, unlock with a message, and locked themes fall back', async ({ page }) => {
  const errors = await open(page, { shell: true });
  const r = await page.evaluate(() => {
    const g = window.__game; g.SAVE.camp = {}; g.SAVE.eng = {}; localStorage.removeItem('ts_stars'); g.SAVE.matsUnlocked = [];
    const before = { ice: g.themeLocked('ice'), stone: g.themeLocked('stone') };
    g.openLibrary('mega');
    const chip = [...document.querySelectorAll('#mgrid .chips.mats .chip')].find(c => c.textContent.includes('Gold')).textContent;
    g.SAVE.matTheme = 'gold'; g.loadPreset(g.PRESETS.find(p => p.id === 'castle'));
    const fellBack = g.objs.some(o => o.type === 'block' && o.spec.mat !== 'gold');
    for (let n = 0; n < 4; n++) g.SAVE.camp[n] = 3;                  // 12 stars
    g.checkUnlocks();
    const after = { ice: g.themeLocked('ice'), marble: g.themeLocked('marble'), unlocked: [...g.SAVE.matsUnlocked] };
    g.SAVE.camp = {}; g.SAVE.matTheme = 'original';
    return { before, chip, fellBack, after };
  });
  expect(r.before).toEqual({ ice: true, stone: false });
  expect(r.chip).toContain('80★');
  expect(r.fellBack).toBe(true);
  expect(r.after.ice).toBe(false);
  expect(r.after.marble).toBe(true);
  expect(r.after.unlocked).toEqual(['brick', 'ice']);
  expect(errors).toEqual([]);
});
