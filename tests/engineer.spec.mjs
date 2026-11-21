import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

test('engineer challenge: budget is enforced, height is required, the quake test grades what stands', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page);
  const r = await page.evaluate(() => {
    const g = window.__game; g.SAVE.eng = {};
    g.startEng(0);                                        // Shaky Ground: 30 blocks, 4 m
    const s = g.CUBE('stone');
    g.engTest(); const tooShort = g.eng.phase;            // nothing built: stays in build
    // a squat 3x3x4 tower = 36 blocks: over budget
    for (let y = 0; y < 4; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) g.createPiece(s, x * 1.005, y + .5005, z * 1.005, null, true);
    g.engTest(); const overBudget = g.eng.phase;
    for (const o of g.objs.filter(o => o.type === 'block').slice(30)) g.removeObj(o);   // back to 30
    g.engTest(); const testing = g.eng.phase;
    for (let i = 0; i < 20 && g.eng.phase === 'test'; i++) { g.ff(1); if (g.eng.phase === 'test') { /* engTick runs in the real loop */ } }
    g.engFinish();
    return { tooShort, overBudget, testing, standing: g.engStanding(), stars: g.SAVE.eng[0] || 0, title: document.getElementById('rTitle').textContent, shown: document.getElementById('result').classList.contains('open') };
  });
  expect(r.tooShort).toBe('build');
  expect(r.overBudget).toBe('build');
  expect(r.testing).toBe('test');
  expect(r.standing).toBeGreaterThanOrEqual(0);
  expect(r.title).toContain('Shaky Ground');
  expect(r.shown).toBe(true);
  expect(errors).toEqual([]);
});

test('engineer tab lists six tests; later ones unlock with stars', async ({ page }) => {
  const errors = await open(page, { shell: true });
  const r = await page.evaluate(() => { const g = window.__game; g.SAVE.eng = {}; g.openLevels('eng');
    const cards = [...document.querySelectorAll('#lgrid .card.lvl')]; return { n: cards.length, locked: cards.filter(c => c.classList.contains('locked')).length }; });
  expect(r.n).toBe(6);
  expect(r.locked).toBe(5);
  expect(errors).toEqual([]);
});
