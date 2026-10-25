// Plays Three Lemons for real: rubbing, buying, the machine, a dig, offline resume, and the live ending.
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import path from 'node:path';
const SP = process.argv[2] || 'tests/screenshots';
const server = await serve(path.resolve('public'));
const url = `http://127.0.0.1:${server.address().port}/three-lemons/?debug`;
const browser = await chromium.launch();
const errs = [];
async function open(save, vp = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(([s]) => { localStorage.clear(); if (s) localStorage.setItem('di:5:save', s); }, [save]);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(url); await page.waitForTimeout(1200);
  return page;
}
const S = page => page.evaluate(() => window.__game.S());
async function rub(page, n) {
  const b = await page.locator('#stage').boundingBox();
  const cx = b.x + b.width * 0.47, cy = b.y + b.height * 0.725;
  await page.mouse.move(cx - 30, cy); await page.mouse.down();
  for (let k = 0; k < n; k++) { await page.mouse.move(cx + 30, cy, { steps: 2 }); await page.mouse.move(cx - 30, cy, { steps: 2 }); }
  await page.mouse.up();
}
// 1. Fresh: audio waits for a gesture, rubbing sorts, the first upgrade appears and buys.
let p = await open(null);
console.log('audio before gesture running:', await p.evaluate(() => window.__game.A.ready));
await rub(p, 60);
let s = await S(p);
console.log('after rubbing: lemons', s.lemons.toFixed(1), 'duds', s.duds.toFixed(2), 'rubs', s.rubs, '| audio running:', await p.evaluate(() => window.__game.A.ready));
await p.locator('#shop .up[data-id="gloves"]').click();
console.log('gloves owned:', (await S(p)).owned.gloves);
await p.evaluate(() => { const S = window.__game.S(); S.duds = 30; });
await p.locator('#pullBtn').click(); await p.waitForTimeout(1600);
console.log('pulls:', (await S(p)).pulls, '| log:', await p.locator('#log').textContent());
await p.screenshot({ path: `${SP}/three-lemons-play-opening.png` });
// 2. A scrap in hand: dig the first tunnel.
p = await open(JSON.stringify({ lemons: 3000, shipped: 3000, scraps: 1, rubs: 200 }));
await p.locator('#shop .up[data-id="dig"]').click(); await p.waitForTimeout(500);
console.log('cellars after dig:', (await S(p)).cellars, '| log:', await p.locator('#log').textContent());
await p.screenshot({ path: `${SP}/three-lemons-play-dig.png` });
// 3. Mid-game after a break: offline progress is credited and told.
const mid = { lemons: 1e5, duds: 3e4, volts: 3000, light: 500, shipped: 2e6, cellars: 4, scraps: 3, eyes: 3, unlocked: { volts: true, light: true },
  owned: { beetle: 40, vole: 25, shrew: 15, badger: 3, cell: 30, stack: 15, penlight: 20, desk: 10, nails: 1, socket: 1, lever: 1, radio: 1 }, pulls: 300, time: 4000, lastSeen: Date.now() - 3 * 3600e3 };
p = await open(JSON.stringify(mid));
s = await S(p);
console.log('resumed mid: cellars', s.cellars, 'eyes', s.eyes, 'shipped', Math.round(s.shipped), '| log:', await p.locator('#log').textContent());
await rub(p, 10);
await p.screenshot({ path: `${SP}/three-lemons-play-mid.png` });
// 4. The live ending: the last lemons ship, the game runs the dawn by itself, finish() fires once.
const late = { ...mid, cellars: 7, scraps: 7, eyes: 10, shipped: 1e9 - 2e4, lemons: 1e6, lastSeen: 0, owned: { ...mid.owned, nose: 5, belt: 5, starnose: 10, fedora: 1, scarf: 1 } };
p = await open(JSON.stringify(late));
await p.evaluate(() => { window.__finish = 0; const f = DailyGame.finish; DailyGame.finish = o => { window.__finish++; window.__lines = o.lines; return f(o); }; });
await rub(p, 30); await p.waitForTimeout(4000);
console.log('ended:', (await S(p)).ended, '| log:', await p.locator('#log').textContent());
await p.screenshot({ path: `${SP}/three-lemons-play-predawn.png` });
await p.waitForTimeout(16000);
await p.screenshot({ path: `${SP}/three-lemons-play-dawn.png` });
await p.waitForTimeout(18000);
console.log('ending visible:', await p.locator('#ending').isVisible(), '| finish calls:', await p.evaluate(() => window.__finish), await p.evaluate(() => window.__lines));
await p.screenshot({ path: `${SP}/three-lemons-play-ending.png`, fullPage: true });
const saved = await p.evaluate(() => localStorage.getItem('di:5:save'));
// Reload the finished save: no second finish.
await p.reload(); await p.waitForTimeout(1500);
console.log('reloaded ending visible:', await p.locator('#ending').isVisible(), 'finishPending:', JSON.parse(saved).finishPending);
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await browser.close(); server.close();
