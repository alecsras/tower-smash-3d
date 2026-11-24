// Shared by doodle.spec.mjs (Chrome) and iphone-doodle.spec.mjs (Safari engine).
import { expect } from '@playwright/test';
import { open } from './helpers.mjs';

export async function checkDoodle(page) {
  const shaderErrors = [];
  page.on('console', m => { if (/Shader Error|VALIDATE_STATUS|GL_INVALID|ERROR: 0:|Program Info Log/.test(m.text())) shaderErrors.push(m.text().slice(0, 300)); });   // graphics errors only; Safari logs unrelated file:// notices
  const errors = await open(page);
  // switch through Settings like a player would
  await page.evaluate(() => window.__game.openSettings());
  await page.locator('#settingsBody .segtabs button', { hasText: 'Doodle' }).click();
  expect(await page.evaluate(() => [document.body.classList.contains('doodle'), window.__game.SAVE.art])).toEqual([true, 'doodle']);
  await page.evaluate(() => document.querySelector('#settings').classList.remove('open'));
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => { const g = window.__game, R = g.renderer;
    g.renderFrame();                                              // draw one doodle frame and read it straight back
    const gl = R.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
    gl.readPixels(Math.floor(w * .3), Math.floor(h * .97), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // top of the screen: sky → paper
    const prog = R.info.programs.find(p => p.name === 'ShaderMaterial' && p.cacheKey && p.cacheKey.includes('tCol')) || R.info.programs.find(p => p.name === 'ShaderMaterial');
    return { px: [...px], runnable: prog ? prog.diagnostics === undefined || prog.diagnostics.runnable : null, font: document.fonts.check('20px "Patrick Hand"') };
  });
  expect(r.runnable).not.toBe(false);
  // paper is warm and light (sky would be blue); allow for a ruled line passing under the sample
  expect(r.px[0]).toBeGreaterThan(150); expect(r.px[0]).toBeGreaterThanOrEqual(r.px[2] - 40);
  expect(r.font).toBe(true);
  // smash something in doodle mode, then switch back to classic
  await page.evaluate(() => window.__game.throwAt('bomb', 0, 2, 0, .8));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__game.SAVE.art = 'classic'; window.__game.applyArt(); });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.body.classList.contains('doodle'))).toBe(false);
  expect(errors).toEqual([]);
  expect(shaderErrors.filter(e => !/favicon|net::ERR/.test(e))).toEqual([]);
}
