// Smoke-tests the site in headless Chromium and saves screenshots to tests/screenshots/.
//
//   npm run check            landing page + every game in games.json
//   npm run check -- moonshroom   just that game (several slugs allowed)
//
// For each game it checks, with a fresh save, that the ending and upgrades start hidden, then plays
// the opening by dragging and tapping on the canvas. It reloads with a finished save
// (di:<n>:save = { ended: true }) and checks the ending shows and Share opens the share card.
// Every page is also loaded at 390px wide to check nothing scrolls sideways, and any console
// error or uncaught exception fails the run. The game's busy mid-game save (tools/cards.json) checks the
// upgrade column and the play area's buttons fit in the window, and a save code from the Save panel loads in a fresh browser.
// Games that use the shared kit also get their credits,
// sprite sheet (?sprites) checked, and every game's Sound panel. Look at the screenshots too; this can't
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
const CARDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'cards.json'), 'utf8'));
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

// Opens a page that records console errors, uncaught exceptions and requests to other sites.
async function open(browser, url, { ctx = { viewport: DESKTOP }, storage = null } = {}) {
  const context = await browser.newContext(ctx);
  if (storage) await context.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  // Everything is served from our own site, fonts included (npm run fonts).
  const external = [];
  page.on('request', r => { const h = new URL(r.url()).hostname; if (!['127.0.0.1', 'localhost'].includes(h) && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  return { page, context, errors, external };
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
    const { page, context, errors, external } = await open(browser, url);
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
    check('no third-party requests (opening)', external.length === 0, [...new Set(external)].slice(0, 3).join(' | '));
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

  // What?? panel: a why.json explains the rolls, with ending rows behind a spoiler warning.
  if (html.includes('data-why')) {
    const file = path.join(PUBLIC, slug, 'why.json');
    const why = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    check('has why.json (daily.js tag has data-why)', !!why && (why.rolls || []).length > 0);
    if (why) {
      const { page, context, errors } = await open(browser, url);
      const link = page.locator('.di-why-link');
      if (await link.isVisible()) {
        await link.click(); await page.waitForTimeout(300);
        check('What?? panel opens', await page.locator('.di-why').isVisible());
        const spoilers = why.rolls.filter(r => r.spoiler);
        if (spoilers.length) check('What?? hides ending spoilers until asked', !(await page.locator('.di-why').innerText()).includes(spoilers[0].became.slice(0, 40)));
        await shot(page, `${slug}-why.png`);
      } else check('What?? link in the top bar', false);
      check('no console errors (what?!)', errors.length === 0, errors.join(' | '));
      await context.close();
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

  // The site's Sound panel: opens from the top bar, and its sliders and mute save the shared keys.
  {
    const { page, context, errors } = await open(browser, url);
    const btn = page.locator('.di-sound-btn');
    if (!(await btn.count())) check('Sound button in the top bar', false);
    else {
      await btn.click();
      const panel = page.locator('.di-sound');
      check('Sound panel opens', await panel.isVisible());
      await page.locator('#di-music').fill('25');
      await page.locator('#di-sfx').fill('70');
      await page.locator('#di-mute').check();
      const saved = await page.evaluate(() => [localStorage.getItem('di:volume-music'), localStorage.getItem('di:volume-sfx'), localStorage.getItem('di:sound-muted')]);
      check('Sound panel saves volume and mute', saved.join() === '0.25,0.7,1', saved.join());
      await shot(page, `${slug}-sound.png`);
    }
    check('no console errors (sound panel)', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // A busy mid-game save (the social card's, from tools/cards.json): on desktop the upgrade column has
  // to fit in the window, never below the fold. Make it sticky with its own scroll, and keep it short
  // so there's little to scroll: compact rows, one tab per currency (see CLAUDE.md).
  if (CARDS[slug]) {
    const storage = { [`di:${n}:save`]: JSON.stringify(CARDS[slug]) };
    const { page, context, errors } = await open(browser, url, { storage });
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const side = document.querySelector('#side') || document.querySelector('#shop')?.parentElement;
      const main = document.querySelector('main');
      return { side: side ? Math.round(side.getBoundingClientRect().height) : 0, main: main ? Math.round(main.getBoundingClientRect().height) : 0 };
    });
    const budget = DESKTOP.height;
    check('upgrade column fits in the window (mid-game save)', m.side <= budget, `${m.side}px tall, window ${budget}px`);
    // Buttons in the play area (a prestige, a booth, a sail) count too: none may start below the fold.
    const low = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent && !b.closest('#side, #shop, aside, #ending, [class^="di-"], [class*=" di-"]'))
      .filter(b => b.getBoundingClientRect().bottom > innerHeight)
      .map(b => (b.id || b.textContent.trim()).slice(0, 30)));
    check('play-area buttons are above the fold (mid-game save)', low.length === 0, low.join(', '));
    await shot(page, `${slug}-midgame.png`, true);
    check('no console errors (mid-game save)', errors.length === 0, errors.join(' | '));
    await context.close();
  } else console.log('  --   no mid-game save in tools/cards.json, skipped the upgrade column check');

  // The Save panel: copy a finished save's code out of one browser, load it into a fresh one, and
  // the ending shows there.
  {
    const from = await open(browser, url, { storage: { [`di:${n}:save`]: JSON.stringify({ ended: true }) } });
    let code = '';
    if (await from.page.locator('.di-save-link').isVisible()) {
      await from.page.locator('.di-save-link').click();
      code = await from.page.locator('#di-code-out').inputValue();
      await shot(from.page, `${slug}-save.png`);
    }
    check('Save panel gives a save code', /^DI\d+-/.test(code));
    await from.context.close();
    const to = await open(browser, url);
    await to.page.waitForTimeout(400);
    await to.page.locator('.di-save-link').click();
    await to.page.locator('#di-code-in').fill(code);
    for (let i = 0; i < 2 && await to.page.locator('.di-save-load').isVisible(); i++) {
      await Promise.all([to.page.waitForEvent('load', { timeout: 3000 }).catch(() => {}), to.page.locator('.di-save-load').click()]);
    }
    await to.page.waitForTimeout(1500);
    check('a save code loads on another browser', await to.page.locator('#ending').isVisible());
    check('no console errors (save panel)', to.errors.length === 0, to.errors.join(' | '));
    await to.context.close();
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
