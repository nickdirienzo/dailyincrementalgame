// Renders social cards (the preview image in iMessage, Slack, X...) and writes the matching meta tags.
//
//   npm run og                 the landing page card + any game that doesn't have a card yet
//   npm run og -- moonshroom   (re)render that game's card (several slugs allowed)
//
// A game's card is its own canvas art and styled title, captured from a finished save so the scene
// is at its fullest, saved as public/<slug>/og.png. Game art can be random, so existing cards are
// left alone unless named. The landing card (public/og.png) lines up the emoji of every game in
// games.json, so rerun this after adding a game. Each page's og:/twitter: tags are replaced with a fresh set; the
// image URL carries a content hash so chat apps refetch it when the card changes.
import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SITE = 'https://dailyincrementalgame.com';
const W = 1200, H = 630;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const dataUrl = buf => 'data:image/png;base64,' + buf.toString('base64');
const hash = file => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);

// Swap a page's og:/twitter: tags for a fresh set, placed right after its meta description.
function writeMeta(htmlFile, { title, description, url, image, alt }) {
  let html = fs.readFileSync(htmlFile, 'utf8');
  html = html.replace(/^<meta (property="og:|name="twitter:)[^>]*>\n/gm, '');
  const tags = [
    `<meta property="og:site_name" content="Daily Incremental">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="${W}">`,
    `<meta property="og:image:height" content="${H}">`,
    `<meta property="og:image:alt" content="${esc(alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n');
  const desc = html.match(/^<meta name="description"[^>]*>\n/m);
  if (!desc) throw new Error(`${path.relative(ROOT, htmlFile)} needs a <meta name="description"> line to put the tags after`);
  html = html.replace(desc[0], desc[0] + tags + '\n');
  fs.writeFileSync(htmlFile, html);
}

async function renderCard(browser, html, out) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  await page.close();
}

async function gameCard(browser, base, game) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await context.addInitScript(n => localStorage.setItem(`di:${n}:save`, JSON.stringify({ ended: true })), game.n);
  const page = await context.newPage();
  await page.goto(`${base}/${game.slug}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(4000); // let the finale animation settle
  const art = await page.locator('canvas').first().screenshot();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Hide everything but the title so it's captured on its own, ready to lay over the art. Pad the
  // capture so descenders and display-font overhangs aren't clipped by the heading's box.
  await page.addStyleTag({ content: 'html, body { background: transparent !important; } body * { visibility: hidden !important; } h1, h1 * { visibility: visible !important; }' });
  const b = await page.locator('h1').first().boundingBox();
  const pad = 0.3 * b.height;
  const title = await page.screenshot({ omitBackground: true, clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: b.height + 2 * pad } });
  await context.close();

  const out = path.join(PUBLIC, game.slug, 'og.png');
  await renderCard(browser, `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&display=swap">
<style>
  body { margin: 0; width: ${W}px; height: ${H}px; position: relative; overflow: hidden; background: ${bg}; }
  .art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 75%; }
  .fade { position: absolute; inset: 0; background: linear-gradient(${bg} 0%, transparent 42%); }
  .title { position: absolute; left: 26px; top: 10px; height: 180px; max-width: 1100px; object-fit: contain; object-position: left top; }
  .tag { position: absolute; left: 56px; bottom: 40px; display: flex; align-items: center; gap: 12px;
         padding: 12px 22px; border-radius: 999px; background: rgba(255,255,255,.92); color: #1b1d33;
         font: 700 26px "Bricolage Grotesque", system-ui, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.25); }
  .tag span { font-size: 30px; }
</style></head><body>
  <img class="art" src="${dataUrl(art)}">
  <div class="fade"></div>
  <img class="title" src="${dataUrl(title)}">
  <div class="tag"><span>${esc(game.emoji || '')}</span>dailyincrementalgame.com</div>
</body></html>`, out);

  writeMeta(path.join(PUBLIC, game.slug, 'index.html'), {
    title: game.title,
    description: game.tagline,
    url: `${SITE}/${game.slug}/`,
    image: `${SITE}/${game.slug}/og.png?v=${hash(out)}`,
    alt: `${game.title}: ${game.tagline}`,
  });
  console.log(`  ${path.relative(ROOT, out)}`);
}

async function siteCard(browser, games) {
  const emoji = games.map(g => g.emoji).filter(Boolean);
  const out = path.join(PUBLIC, 'og.png');
  await renderCard(browser, `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,800&display=swap">
<style>
  body { margin: 0; width: ${W}px; height: ${H}px; background: #eef0fb; color: #1b1d33; font-family: "Bricolage Grotesque", system-ui, sans-serif;
         display: flex; flex-direction: column; justify-content: center; padding: 0 84px; box-sizing: border-box; gap: 10px; }
  h1 { margin: 0; font-size: 124px; font-weight: 800; letter-spacing: -.04em; line-height: 1; }
  p { margin: 0; font-size: 40px; color: #5c6080; }
  .e { margin-top: 44px; font-size: 76px; display: flex; gap: 36px; flex-wrap: nowrap; overflow: hidden; }
</style></head><body>
  <h1>Daily Incremental</h1>
  <p>Tiny incremental games.</p>
  <div class="e">${emoji.slice(-8).map(e => `<span>${esc(e)}</span>`).join('')}</div>
</body></html>`, out);
  writeMeta(path.join(PUBLIC, 'index.html'), {
    title: 'Daily Incremental',
    description: 'Tiny incremental games.',
    url: `${SITE}/`,
    image: `${SITE}/og.png?v=${hash(out)}`,
    alt: 'Daily Incremental: tiny incremental games.',
  });
  console.log(`  ${path.relative(ROOT, out)}`);
}

const games = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'games.json'), 'utf8'));
const only = process.argv.slice(2);
const targets = only.length ? games.filter(g => only.includes(g.slug)) : games.filter(g => !fs.existsSync(path.join(PUBLIC, g.slug, 'og.png')));
for (const s of only) if (!games.some(g => g.slug === s)) { console.error(`${s} isn't in games.json yet; add its entry first`); process.exit(1); }

const server = await serve(PUBLIC);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  console.log('social cards');
  if (!only.length) await siteCard(browser, games);
  for (const g of targets) await gameCard(browser, base, g);
} finally {
  await browser.close();
  server.close();
}
