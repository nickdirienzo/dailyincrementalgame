// Plays Gilt by Association for real: nibbling, whispering by day, placing pieces on teeth, each
// shelf from a save (and its music), a mid-game resume, the phone layout and the live ending.
//   node tests/play-gilt.mjs [screenshot dir]
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import path from 'node:path';
const SP = process.argv[2] || 'tests/screenshots';
const SLUG = 'gilt-by-association', KEY = 'di:8:save';
const server = await serve(path.resolve('public'));
const url = `http://127.0.0.1:${server.address().port}/${SLUG}/?debug`;
const browser = await chromium.launch();
const errs = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok  ' : '  FAIL'} ${name}${detail ? ` (${detail})` : ''}`); if (!cond) process.exitCode = 1; };
async function open(save, vp = { width: 1280, height: 900 }, extra = {}) {
  const ctx = await browser.newContext({ viewport: vp, ...extra });
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); if (s) localStorage.setItem(k, s); }, [KEY, save]);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(url); await page.waitForFunction(() => window.__game && window.__game.S);
  await page.waitForTimeout(700);
  return page;
}
const S = page => page.evaluate(() => window.__game.S());
async function at(page, lx, ly) {
  const b = await page.locator('#stage').boundingBox(); const k = b.width / 640;
  return [b.x + lx * k, b.y + ly * k];
}
async function tap(page, lx, ly) { await page.mouse.click(...await at(page, lx, ly)); await page.waitForTimeout(140); }
const tooth = (page, i) => page.evaluate(i => { const r = window.__game.rects()[i]; return [r.x + r.w / 2, r.y + r.h / 2]; }, i);
const base = (o = {}) => JSON.stringify({ lastSeen: Date.now(), t: 100, ...o });

// 1. The opening: nibble, buy a cap, put it on a tooth.
{
  const page = await open(null);
  for (let i = 0; i < 14; i++) await tap(page, 150, 220);
  let s = await S(page);
  ok('nibbling the spine earns foil', s.foil > 1e13, `${s.foil}`);
  await page.waitForTimeout(500);
  const cap = page.locator('#shop .up[data-id="foil"]');
  ok('the foil cap turns up', await cap.count() === 1);
  await cap.click(); await page.waitForTimeout(200);
  s = await S(page);
  ok('buying a cap puts it in your hand', s.held === 'foil');
  await page.screenshot({ path: `${SP}/gilt-holding.png` });
  await tap(page, ...await tooth(page, 3));
  s = await S(page);
  ok('tapping a tooth places it', s.mouth[3] === 'foil' && !s.held);
  await tap(page, ...await tooth(page, 0));
  ok('locked teeth stay empty', (await S(page)).mouth[0] === null);
  await page.screenshot({ path: `${SP}/gilt-opening.png` });
  await page.close();
}
// 2. Daytime: the same tap whispers.
{
  const page = await open(base({ clock: 85, foil: 1e14, mouth: [null, null, 'foil', 'foil', null, null, null, null, null, null, null, null, null, null, null, null], seen: ['foil', 'jaw'] }));
  const g0 = (await S(page)).gossip;
  for (let i = 0; i < 6; i++) await tap(page, 150, 220);
  const s = await S(page);
  ok('a daytime tap whispers', s.gossip > g0 + 4, `${g0} -> ${s.gossip}`);
  await page.screenshot({ path: `${SP}/gilt-day.png` });
  await page.close();
}
// 3. Each shelf from a save, playing its action, with its music key.
const P2 = { phase: 2, beat: 1, revealed: true, cousins: 18, gold: 3e16, foil: 2e15, lv: { jaw: 5, silver: 24, shine: 2, whisper: 3, crumbs: 2, vol: 2, beetle: 9, glasses: 1 }, bought: { foil: 6, fstar: 4, gold: 5 }, odd: { lend: 1, mirror: 1 }, night: 14, spine: 2, letters: 30, shopTab: 'gold',
  mouth: ['foil', 'gold', 'gold', 'gold', 'gold', 'gold', 'fstar', null, null, null, null, null, null, null, null, null] };
const P3 = { ...P2, phase: 3, beat: 2, cousins: 34, fans: 60, pig: 3e19, gold: 2e18, lv: { ...P2.lv, vol: 5, glasses: 4, gloss: 3, beetle: 30, practice: 1, rope: 1, headshot: 5 }, bought: { foil: 6, fstar: 4, gold: 9, mono: 1, verd: 3 }, shopTab: 'pig',
  mouth: ['gold', 'gold', 'gold', 'mono', 'gold', 'gold', 'gold', 'gold', 'verd', 'verd', null, 'verd', null, null, null, null] };
for (const [name, save, key, action] of [['paperbacks', { foil: 5e14, lv: { jaw: 2, silver: 6 }, cousins: 3, bought: { foil: 3, fstar: 1 }, mouth: [null, null, 'foil', 'foil', 'fstar', 'foil', null, null, null, null, null, null, null, null, null, null] }, 'paperbacks', 'foil'],
  ['reference', P2, 'reference', 'gold'], ['rarebooks', P3, 'rarebooks', 'pig']]) {
  const page = await open(base(save));
  const before = (await S(page))[action];
  for (let i = 0; i < 8; i++) await tap(page, 150, 220);
  const s = await S(page);
  ok(`${name}: the tap earns ${action}`, s[action] > before, `${before} -> ${s[action]}`);
  const k = await page.evaluate(() => window.__game.song()[0]);
  ok(`${name}: music key`, k === key, k);
  await page.screenshot({ path: `${SP}/gilt-${name}.png` });
  await page.close();
}
// 4. Resume after a reset of shelves and time away: offline progress and a note in the log.
{
  const page = await open(JSON.stringify({ ...P2, t: 1500, lastSeen: Date.now() - 2 * 3600e3 }));
  const s = await S(page), log = await page.locator('#log').textContent();
  ok('resumes on the encyclopedia shelf', s.phase === 2 && s.mouth[1] === 'gold');
  ok('offline progress is credited', s.gold > P2.gold && /away/.test(log), log.slice(0, 80));
  await page.close();
}
// 5. Phone layout.
{
  const page = await open(base(P2), { width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.screenshot({ path: `${SP}/gilt-phone.png`, fullPage: true });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('no sideways scroll on a phone', over <= 0, `${over}`);
  await page.close();
}
// 6. The live ending: beat Isadora, then watch the craze eat the library on its own.
{
  const page = await open(base({ ...P3, pig: 1e30 }));
  await page.evaluate(() => { const s = window.__game.S(); s.mouth = window.__game.E.finishedMouth(); s.lv.pose = 5; s.lv.gloss = 5; s.lv.shine = 3; s.odd.sign = 1; s.odd.floss = 1; s.clock = 2; s.pool = 2e20; });
  await page.waitForFunction(() => window.__game.S().craze, null, { timeout: 5000 });
  ok('beating the last rival starts the craze', true);
  await page.evaluate(() => { window.__game.S().fans = 5e4; });
  await page.waitForFunction(() => window.__game.S().ended, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  ok('the game ends itself', await page.locator('#ending').isVisible());
  await page.screenshot({ path: `${SP}/gilt-ending.png`, fullPage: true });
  await page.close();
}
ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close(); server.close();
