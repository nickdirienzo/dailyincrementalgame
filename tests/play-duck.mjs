// Plays A Duck of Unreasonable Size for real: dragging ducklets, squishing, stamping a form, the
// booth, a Flotilla, each phase from a save, a mid-game resume, the phone layout and the live ending.
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import path from 'node:path';
import fs from 'node:fs';
const STUB = !fs.existsSync(`public/a-duck-of-unreasonable-size/music.mjs`);
const SP = process.argv[2] || 'tests/screenshots';
const SLUG = 'a-duck-of-unreasonable-size', KEY = 'di:6:save';
const server = await serve(path.resolve('public'));
const url = `http://127.0.0.1:${server.address().port}/${SLUG}/?debug`;
const browser = await chromium.launch();
const errs = [];
async function open(save, vp = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); if (s) localStorage.setItem(k, s); }, [KEY, save]);
  if (STUB) await ctx.route('**/a-duck-of-unreasonable-size/music.mjs', r => r.fulfill({ contentType: 'text/javascript', body: 'export const createSoundtrack = S => () => ["x", S.silence, 0.3];' }));
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(url); await page.waitForFunction(() => window.__game && window.__game.at);
  await page.waitForTimeout(600);
  return page;
}
const S = page => page.evaluate(() => window.__game.S());
async function px(page, lx, ly) {
  const b = await page.locator('#stage').boundingBox(); const k = b.width / 640;
  return [b.x + lx * k, b.y + ly * k];
}
async function dragL(page, [ax, ay], [bx, by]) {
  await page.mouse.move(...await px(page, ax, ay)); await page.mouse.down();
  await page.mouse.move(...await px(page, (ax + bx) / 2, (ay + by) / 2), { steps: 4 });
  await page.mouse.move(...await px(page, bx, by), { steps: 4 }); await page.mouse.up();
}
const cell = (page, i) => page.evaluate(i => window.__game.at(i), i);
const potC = page => page.evaluate(() => { const p = window.__game.POT; return [p.x + p.w / 2, p.y + p.h / 2]; });
const stampC = page => page.evaluate(() => { const p = window.__game.STAMP; return [p.x + p.w / 2, p.y + p.h / 2]; });
const grid = (...cells) => { const g = Array(30).fill(null); for (const [i, c] of cells) g[i] = c; return g; };
const duck = t => ({ k: 'duck', t, wet: 0, seq: t });

// 1. Fresh start: no sound before a gesture; drag four ducklets in, squish them up.
let p = await open(null);
console.log('audio before gesture:', await p.evaluate(() => window.__game.A.ready));
for (const i of [0, 1, 6, 7]) await dragL(p, await potC(p), await cell(p, i));
console.log('audio after gesture:', await p.evaluate(() => window.__game.A.ready));
await dragL(p, await cell(p, 1), await cell(p, 0));
await dragL(p, await cell(p, 7), await cell(p, 6));
await p.waitForTimeout(2800);
await dragL(p, await cell(p, 6), await cell(p, 0));
let s = await S(p);
console.log('fresh: ducks', s.grid.filter(Boolean).map(c => c.k + (c.t || c.code)).join(','), '| merged', s.everMerged, '| log:', await p.locator('#log').textContent());
await p.screenshot({ path: `${SP}/${SLUG}-play-opening.png` });

// 2. Phase 1 mid-run: a form waits; stamp it by dragging the stamp; buy something.
p = await open(JSON.stringify({ coins: 60, earned: 60, time: 200, best: 3, everMerged: 8, reg: { 1: true, 2: true, 3: true }, grid: grid([0, duck(3)], [1, duck(2)], [2, duck(2)], [6, duck(1)]) }));
await p.waitForTimeout(400);
s = await S(p);
const fi = s.grid.findIndex(c => c && c.k === 'form');
console.log('phase1: form filed at', fi, s.grid[fi]?.code, 'left', s.grid[fi]?.left);
for (let k = 0; k < 5; k++) await dragL(p, await stampC(p), await cell(p, fi));
s = await S(p); console.log('phase1: registered 4?', !!s.reg[4], '| formsStamped', s.formsStamped);
const first = p.locator('#shop button.up:not([disabled])').first();
if (await first.count()) { const id = await first.getAttribute('data-id'); await first.click(); console.log('bought', id, '→', JSON.stringify((await S(p)).up)); }
await p.screenshot({ path: `${SP}/${SLUG}-play-phase1.png` });

// 3. Phase 2: after a Flotilla, booth open, a Galleon in the pond: hook a duck, launch.
p = await open(JSON.stringify({ coins: 200, earned: 900, time: 600, flotillas: 1, legend: 12, postcards: 2, flotillaOpen: true, booth: true,
  reg: { 1: true, 2: true, 3: true, 4: true, 5: true }, filed: { 3: true, 4: true, 5: true }, best: 5, everMerged: 40, formsStamped: 4,
  up: { sign: 1, arms: 2, crab: 1 }, grid: grid([0, duck(5)], [1, duck(4)], [2, duck(4)], [3, duck(3)], [6, duck(2)], [7, duck(1)]) }));
await p.locator('#hookBtn').click(); await p.waitForTimeout(300);
console.log('phase2 hook:', await p.locator('#log').textContent());
await p.screenshot({ path: `${SP}/${SLUG}-play-phase2.png` });
const before = await S(p);
await p.locator('#launchBtn').click(); await p.waitForTimeout(1500);
s = await S(p);
console.log('launch: legend', before.legend, '→', s.legend, '| flotillas', s.flotillas, '| coins', s.coins, '| ducks left', s.grid.filter(c => c && c.k === 'duck').length);
await p.screenshot({ path: `${SP}/${SLUG}-play-launch.png` });
// Reload resumes mid-game after the reset.
await p.reload(); await p.waitForFunction(() => window.__game && window.__game.at); await p.waitForTimeout(400);
const r = await S(p); console.log('resume after reset: flotillas', r.flotillas, 'legend', r.legend, 'phase', await p.evaluate(() => window.__game.E.phase(window.__game.S())));

// 4. Phase 3: two Colossal Ducks, Form Ω stamped. Squish, let the paint dry, win, be talked out of it, sail.
p = await open(JSON.stringify({ coins: 300, earned: 5000, time: 1500, flotillas: 5, legend: 152, postcards: 4, flotillaOpen: true, booth: true,
  reg: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true }, filed: { 3: true, 4: true, 5: true, 6: true, 7: true, 8: true }, best: 7,
  everMerged: 400, formsStamped: 40, ren: { pond: 2, brushes: 1 }, up: { dredge: 2, arms: 4 }, odd: { sail: true, hat: true },
  grid: grid([0, duck(7)], [1, duck(7)], [2, duck(6)], [3, duck(5)], [8, duck(5)], [13, duck(4)], [14, duck(6)]) }));
console.log('phase3 phase:', await p.evaluate(() => window.__game.E.phase(window.__game.S())));
await p.locator('#stage').screenshot({ path: `${SP}/${SLUG}-play-phase3.png` });
await dragL(p, await cell(p, 1), await cell(p, 0));
s = await S(p); console.log('squished:', s.grid[0] && s.grid[0].t, 'wet', s.grid[0] && s.grid[0].wet);
await p.evaluate(() => { window.__game.S().grid[0].wet = 0.5; });
await p.waitForTimeout(1500);
console.log('jubilee:', (await S(p)).jubilee, '| sail button visible:', await p.locator('#sailBtn').isVisible(), '| phase', await p.evaluate(() => window.__game.E.phase(window.__game.S())));
await p.screenshot({ path: `${SP}/${SLUG}-play-jubilee.png` });
await p.locator('#sailBtn').click();
console.log('plea 1:', await p.locator('#pleaWho').textContent());
await p.locator('#stayBtn').click();
console.log('stayed; sail visible again:', await p.locator('#sailBtn').isVisible(), '| ended', (await S(p)).ended);
await p.locator('#sailBtn').click(); await p.locator('#goBtn').click();
console.log('plea 2:', await p.locator('#pleaWho').textContent());
await p.screenshot({ path: `${SP}/${SLUG}-play-plea.png` });
await p.locator('#goBtn').click();
console.log('plea 3:', await p.locator('#pleaWho').textContent());
await p.locator('#goBtn').click(); await p.waitForTimeout(1800);
console.log('ended:', (await S(p)).ended, '| ending visible', await p.locator('#ending').isVisible(), '| share card', await p.locator('.di-share').isVisible().catch(() => false));
console.log('share text:', await p.locator('.di-share').textContent().catch(() => ''));
await p.screenshot({ path: `${SP}/${SLUG}-play-ending.png`, fullPage: true });
await p.locator('#stage').screenshot({ path: `${SP}/${SLUG}-play-ending-stage.png` });

// 5. Phone width, mid-game.
p = await open(JSON.stringify({ coins: 80, earned: 300, time: 400, flotillas: 1, legend: 12, postcards: 5, flotillaOpen: true, booth: true, best: 5,
  reg: { 1: true, 2: true, 3: true, 4: true, 5: true }, grid: grid([0, duck(5)], [1, duck(3)], [2, duck(2)], [3, duck(1)], [6, duck(4)], [7, duck(2)], [8, { k: 'form', code: '12-Q', title: 'Duck Is Technically a Lighthouse', left: 2, total: 2 }]) }), { width: 390, height: 844 });
console.log('phone sideways scroll:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
await p.screenshot({ path: `${SP}/${SLUG}-play-phone.png`, fullPage: true });

console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
