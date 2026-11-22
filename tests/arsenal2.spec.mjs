import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

const NEW = ['golf', 'javelin', 'sawblade', 'bearings', 'safe', 'avalanche', 'volley', 'girder', 'bowlrain', 'fist',
  'mortar', 'mirv', 'mines', 'airstrike', 'thermo', 'crackers', 'bouncer', 'megabomb', 'chainbomb', 'barrels', 'sonic', 'barrage',
  'blizzard', 'inferno', 'hurricane', 'quakeshell', 'geyser', 'sandstorm', 'thermite', 'thunder', 'icelance', 'magma',
  'whitehole', 'timebubble', 'teleport', 'disint', 'gwell', 'rod', 'plasma', 'repulsor', 'levitate', 'quantum',
  'melon', 'cow', 'jelly', 'confetti', 'sink', 'snowballs', 'beachball', 'tire'];

test('arsenal II: 50 new weapons, each priced, categorised and listed in the shop', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(keys => { const g = window.__game;
    return keys.map(k => { const p = g.PROJ[k]; return p && !p.hidden && p.cat && p.emoji && p.desc && g.ARSENAL[k].fire ? null : k; }).filter(Boolean); }, NEW);
  expect(NEW.length).toBe(50);
  expect(new Set(NEW).size).toBe(50);
  expect(r).toEqual([]);
});

// fire each weapon at a solid block of a dense build; it must move or destroy something (or set it burning)
for (let part = 0; part < 5; part++) test(`arsenal II: weapons ${part * 10 + 1}–${part * 10 + 10} hit a real build without errors`, async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await open(page);
  await page.evaluate(() => { const g = window.__game; g.SAVE.sandbox = true; g.setMode('throw'); });
  const quiet = [];
  for (const k of NEW.slice(part * 10, part * 10 + 10)) {
    const hit = await page.evaluate(async kind => { const g = window.__game;
      g.clearAll && g.clearAll(); g.loadPreset(g.PRESETS.find(p => p.id === 'pyramid')); g.setMode('throw');
      const bl = g.objs.filter(o => o.type === 'block' && !o.gone);
      const before = new Map(bl.map(o => [o, [o.body.position.x, o.body.position.y, o.body.position.z]]));
      const t = bl.reduce((a, o) => Math.hypot(o.body.position.x, o.body.position.z) + Math.abs(o.body.position.y - 1.5) < Math.hypot(a.body.position.x, a.body.position.z) + Math.abs(a.body.position.y - 1.5) ? o : a);
      g.throwAt(kind, t.body.position.x, t.body.position.y, t.body.position.z, .8);
      for (let i = 0; i < 48; i++) { await new Promise(r => setTimeout(r, 250));   // up to 12 s: the sim runs slow on a loaded CI box
        let n = g.burning.size; for (const [o, p] of before) if (o.gone || Math.hypot(o.body.position.x - p[0], o.body.position.y - p[1], o.body.position.z - p[2]) > .15) n++;
        if (n) return n; }
      return 0;
    }, k);
    if (!hit) quiet.push(k);
  }
  expect(errors).toEqual([]);
  // landmines wait for something to move near them, and the time bubble only slows what is already moving
  expect(quiet.filter(k => k !== 'mines' && k !== 'timebubble')).toEqual([]);
});
