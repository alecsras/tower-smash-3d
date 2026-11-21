import { test, expect } from '@playwright/test';
import { open } from './helpers.mjs';

const NEW = ['skytower', 'greatwall', 'stadium', 'ziggurat', 'viaduct'];

test('mega builds: no overlapping blocks, and the new ~1,000-block builds are that size', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page);
  const r = await page.evaluate(NEW => {
    const g = window.__game, out = {};
    for (const p of g.PRESETS.filter(p => p.mega && p.id !== 'citadel')) {
      g.loadPreset(p);
      // axis-aligned boxes only (rotated pieces, like the domino spiral, have loose bounding boxes)
      const square = q => [0, Math.SQRT1_2, 1].some(v => Math.abs(Math.abs(q.y) - v) < 1e-3) && Math.abs(q.x) + Math.abs(q.z) < 1e-3;
      const b = g.objs.filter(o => o.type === 'block' && o.body.shape.kind === 'box' && square(o.body.quaternion)).map(o => o.body.getAABB());
      const H = new Map(); b.forEach((a, i) => { const k = Math.round((a.lowerBound.x + a.upperBound.x) / 4) + ',' + Math.round((a.lowerBound.z + a.upperBound.z) / 4); (H.get(k) || H.set(k, []).get(k)).push(i); });
      let ov = 0;
      for (const [k, list] of H) { const [cx, cz] = k.split(',').map(Number);
        const near = []; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) near.push(...(H.get((cx + dx) + ',' + (cz + dz)) || []));
        for (const i of list) for (const j of near) { if (j <= i) continue; const a = b[i], c = b[j];
          if (Math.min(a.upperBound.x, c.upperBound.x) - Math.max(a.lowerBound.x, c.lowerBound.x) > .01 && Math.min(a.upperBound.y, c.upperBound.y) - Math.max(a.lowerBound.y, c.lowerBound.y) > .01 && Math.min(a.upperBound.z, c.upperBound.z) - Math.max(a.lowerBound.z, c.lowerBound.z) > .01) ov++; } }
      out[p.id] = { n: g.countOf(p), ov, isNew: NEW.includes(p.id) };
    }
    return out;
  }, NEW);
  for (const [id, v] of Object.entries(r)) {
    expect(v.ov, id + ' overlaps').toBe(0);
    if (v.isNew) { expect(v.n, id).toBeGreaterThan(850); expect(v.n, id).toBeLessThan(1100); }
  }
  for (const id of NEW) expect(r[id], id).toBeTruthy();
  expect(errors).toEqual([]);
});

for (const id of NEW) {
  test(`${id} holds itself up with every block awake`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await open(page);
    const r = await page.evaluate(id => {
      const g = window.__game; g.loadPreset(g.PRESETS.find(p => p.id === id)); g.setMode('throw');
      const bl = g.objs.filter(o => o.type === 'block'), st = new Map(bl.map(o => [o, { ...o.body.position }]));
      for (const o of bl) g.kick(o, 0, 0, 0);
      g.ff(4);
      let side = 0, sunk = 0; for (const o of bl) { const a = st.get(o), p = o.body.position; if (Math.hypot(p.x - a.x, p.z - a.z) > .3) side++; if (p.y < -.2) sunk++; }
      return { n: bl.length, side, sunk };
    }, id);
    expect(r.sunk, JSON.stringify(r)).toBe(0);
    expect(r.side, JSON.stringify(r)).toBeLessThan(r.n * .02);
    expect(errors).toEqual([]);
  });
}

test('material themes: presets load in the chosen material; the pad can be repainted and restored', async ({ page }) => {
  const errors = await open(page);
  const r = await page.evaluate(() => {
    const g = window.__game, castle = g.PRESETS.find(p => p.id === 'castle');
    const mats = () => { const m = {}; for (const o of g.objs) if (!o.gone && o.type === 'block') m[o.spec.mat] = (m[o.spec.mat] || 0) + 1; return m; };
    g.SAVE.matTheme = 'original'; g.loadPreset(castle); const orig = mats();
    g.SAVE.matTheme = 'ice'; g.loadPreset(castle); const ice = mats();
    g.repaintPad('original'); const back = mats();
    g.setMode('throw'); g.repaintPad('gold'); const gold = mats();
    g.boom(0, 1, 0, 2); g.ff(.5); g.rebuild2(); const rebuilt = mats();
    g.SAVE.matTheme = 'original';
    return { orig, ice, back, gold, rebuilt };
  });
  expect(r.back).toEqual(r.orig);
  expect(Object.keys(r.ice).sort()).toEqual(['ice', 'tnt']);
  expect(r.ice.tnt).toBe(r.orig.tnt);
  expect(Object.keys(r.gold).sort()).toEqual(['gold', 'tnt']);
  expect(Object.keys(r.rebuilt).sort()).toEqual(['gold', 'tnt']);
  expect(errors).toEqual([]);
});

test('material picker in the Build Library sets the material for builds', async ({ page }) => {
  const errors = await open(page, { shell: true });
  await page.evaluate(() => window.__game.openLibrary('mega'));
  const chip = page.locator('#mgrid .chips.mats .chip', { hasText: 'Steel' });
  await expect(chip).toBeVisible();
  await chip.click({ force: true });
  await expect(page.locator('#mgrid .chips.mats .chip.on')).toHaveText('Steel');
  expect(await page.evaluate(() => window.__game.SAVE.matTheme)).toBe('steel');
  expect(errors).toEqual([]);
});
