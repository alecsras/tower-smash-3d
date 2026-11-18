import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
export const PAGE = pathToFileURL(resolve('dist/index.html')).href;
// open the game and collect page errors; `shell` starts on the title screen like a real visit
export async function open(page, { shell = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(PAGE + (shell ? '?shell' : ''));
  await page.waitForFunction(() => window.__game && !document.getElementById('boot'), null, { timeout: 30_000 });
  await page.waitForTimeout(400);
  return errors;
}
export const blocks = page => page.evaluate(() => window.__game.objs.filter(o => !o.gone && o.type === 'block').length);
