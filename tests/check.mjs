// Smoke-tests the site in headless Chromium and saves screenshots to tests/screenshots/.
//
//   npm run check            landing page + every game in games.json
//   npm run check -- moonshroom   just that game (several slugs allowed)
//
// For each game it checks, with a fresh save, that the ending and upgrades start hidden, then plays
// the opening by dragging and tapping on the canvas. It reloads with a finished save
// (di:<n>:save = { ended: true }) and checks the ending shows and Share opens the share card.
// Every page is also loaded at 390px wide to check nothing scrolls sideways, and any console
// error or uncaught exception fails the run. Games that use the shared kit also get their credits,
// sprite sheet (?sprites) and sound/music toggles checked. Look at the screenshots too; this can't
// judge looks.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const DESKTOP = { width: 1280, height: 900 };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

// Opens a page that records console errors and uncaught exceptions. Google Fonts failing to load
// (offline) is ignored; anything else is the game's fault.
async function open(browser, url, { ctx = { viewport: DESKTOP }, storage = null } = {}) {
  const context = await browser.newContext(ctx);
  if (storage) await context.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  return { page, context, errors };
}

const sideScroll = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const visibleCount = (page, sel) => page.locator(sel).evaluateAll(els => els.filter(e => e.checkVisibility()).length);
const shot = (page, name, fullPage = false) => page.screenshot({ path: path.join(SHOTS, name), fullPage });

async function checkLanding(browser, base) {
  console.log('landing page');
  for (const [label, ctx] of [['desktop', { viewport: DESKTOP }], ['390px', PHONE]]) {
    const { page, context, errors } = await open(browser, base + '/', { ctx });
    if (label === '390px') { const over = await sideScroll(page); check('no sideways scroll at 390px', over <= 0, over > 0 ? `${over}px too wide` : ''); }
    await shot(page, `landing-${label}.png`, true);
    check(`no console errors (${label})`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

async function checkGame(browser, base, game) {
  const n = game.n, slug = game.slug, url = `${base}/${slug}/`;
  console.log(`${game.title || slug} (/${slug}/)`);

  // Social card: tags in the page and the image next to it.
  {
    const html = fs.readFileSync(path.join(PUBLIC, slug, 'index.html'), 'utf8');
    const img = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
    check('has a social card (npm run og)', img.includes(`/${slug}/og.png`) && fs.existsSync(path.join(PUBLIC, slug, 'og.png')));
  }

  // Fresh start: nothing finished, no upgrades yet. Then play the opening.
  {
    const { page, context, errors } = await open(browser, url);
    check('ending hidden at start', !(await page.locator('#ending').isVisible()));
    check('no upgrades showing at start', (await visibleCount(page, '#shop button, #side button')) === 0);
    await shot(page, `${slug}-start.png`);

    const box = await page.locator('canvas').first().boundingBox();
    if (!box) check('has a canvas to play on', false);
    else {
      const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
      // Rub/drag back and forth across the middle, then tap around. Covers most interactions well
      // enough to wake the game up; it isn't meant to win.
      for (let r = 0; r < 6; r++) {
        await page.mouse.move(...at(0.15, 0.55)); await page.mouse.down();
        for (let i = 0; i <= 24; i++) await page.mouse.move(...at(0.15 + 0.7 * (i / 24), 0.45 + 0.25 * Math.sin(i / 3)));
        await page.mouse.up();
      }
      for (let i = 0; i < 30; i++) { await page.mouse.click(...at(0.2 + 0.6 * ((i * 7) % 10) / 10, 0.35 + 0.4 * ((i * 3) % 10) / 10)); await page.waitForTimeout(60); }
      await page.waitForTimeout(500);
      await shot(page, `${slug}-opening.png`);
      check('ending still hidden after the opening', !(await page.locator('#ending').isVisible()));
    }
    check('no console errors (opening)', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  const html = fs.readFileSync(path.join(PUBLIC, slug, 'index.html'), 'utf8');

  // Credits: anything built on vendored libraries or fetched art must credit it.
  {
    const usesLibs = /\/shared\/lib\//.test(html), usesArt = /art\/[\w-]+--[\w-]+\.svg/.test(html) || fs.existsSync(path.join(PUBLIC, slug, 'art'));
    if (usesLibs || usesArt || html.includes('data-credits')) {
      const file = path.join(PUBLIC, slug, 'credits.json');
      const credits = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      check('has credits.json (npm run credits)', !!credits);
      check('daily.js tag has data-credits', html.includes('data-credits'));
      if (credits) {
        const missing = [...html.matchAll(/\/shared\/lib\/([\w.-]+)@/g)].map(m => m[1]).filter(name => !(credits.libs || []).some(l => l.name === name));
        check('credits list every library the page loads', missing.length === 0, missing.join(', '));
        const { page, context, errors } = await open(browser, url);
        const link = page.locator('.di-credits-link');
        if (await link.isVisible()) {
          await link.click(); await page.waitForTimeout(300);
          check('Credits panel opens', await page.locator('.di-credits').isVisible());
          await shot(page, `${slug}-credits.png`);
        } else check('Credits link in the top bar', false);
        check('no console errors (credits)', errors.length === 0, errors.join(' | '));
        await context.close();
      }
    }
  }

  // Sprite sheet: games using the sprite kit show every sprite at ?sprites.
  if (html.includes('/shared/kit/sprites.mjs')) {
    const { page, context, errors } = await open(browser, url + '?sprites');
    const ok = await page.locator('#di-sprites[data-ready]').waitFor({ timeout: 8000 }).then(() => true, () => false);
    check('sprite sheet renders at ?sprites', ok);
    if (ok) await shot(page, `${slug}-sprites.png`, true);
    check('no console errors (sprites)', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // Sound and music toggles, for games on the audio kit: both exist, and each flips its shared key.
  if (html.includes('/shared/kit/audio.mjs')) {
    const { page, context, errors } = await open(browser, url);
    for (const [id, key] of [['#soundBtn', 'di:sound-muted'], ['#musicBtn', 'di:music-muted']]) {
      const btn = page.locator(id);
      if (!(await btn.count())) { check(`has ${id}`, false); continue; }
      const before = await page.evaluate(k => localStorage.getItem(k), key);
      await btn.click(); await page.waitForTimeout(100);
      const after = await page.evaluate(k => localStorage.getItem(k), key);
      check(`${id} toggles ${key}`, after != null && after !== before, `${before} -> ${after}`);
      await btn.click();
    }
    check('no console errors (toggles)', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // Phone width, fresh start.
  {
    const { page, context, errors } = await open(browser, url, { ctx: PHONE });
    const over = await sideScroll(page);
    check('no sideways scroll at 390px', over <= 0, over > 0 ? `${over}px too wide` : '');
    await shot(page, `${slug}-390px.png`, true);
    check('no console errors (390px)', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // Finished save: the ending shows on load and Share opens the share card.
  for (const [label, ctx] of [['desktop', { viewport: DESKTOP }], ['390px', PHONE]]) {
    const storage = {
      [`di:${n}:save`]: JSON.stringify({ ended: true }),
      'di:done': JSON.stringify({ [n]: { at: game.date, lines: ['🧪 test run'] } }),
    };
    const { page, context, errors } = await open(browser, url, { ctx, storage });
    await page.waitForTimeout(1500);
    const ending = page.locator('#ending');
    check(`ending shows for a finished save (${label})`, await ending.isVisible());
    if (label === '390px') { const over = await sideScroll(page); check('no sideways scroll at the ending, 390px', over <= 0, over > 0 ? `${over}px too wide` : ''); }
    await ending.scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, `${slug}-ending-${label}.png`);
    const share = page.locator('#shareBtn');
    if (await share.isVisible()) {
      await share.click();
      await page.waitForTimeout(400);
      check(`Share opens the share card (${label})`, await page.locator('.di-overlay').isVisible());
      await shot(page, `${slug}-share-${label}.png`);
    } else check(`Share button visible at the ending (${label})`, false);
    check(`no console errors (ending, ${label})`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

const games = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'games.json'), 'utf8'));
const only = process.argv.slice(2);
const targets = only.length ? games.filter(g => only.includes(g.slug)) : games;
for (const slug of only) {
  if (games.some(g => g.slug === slug)) continue;
  // A game that isn't in games.json yet: read its internal number from the page.
  const file = path.join(PUBLIC, slug, 'index.html');
  if (!fs.existsSync(file)) { console.error(`no game at public/${slug}/`); process.exit(1); }
  const n = Number((fs.readFileSync(file, 'utf8').match(/data-day="(\d+)"/) || [])[1]);
  targets.push({ n, slug, title: `${slug} (not in games.json yet)`, date: new Date().toISOString().slice(0, 10) });
}

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const server = await serve(PUBLIC);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  if (!only.length) await checkLanding(browser, base);
  for (const g of targets) await checkGame(browser, base, g);
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${path.relative(process.cwd(), SHOTS)}/`);
process.exit(failed.length ? 1 : 0);
