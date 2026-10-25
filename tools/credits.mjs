// Writes public/<slug>/credits.json: every library, art set, font and palette the game uses, with
// licenses and where to support the people who made them. daily.js shows it as the game's
// "Credits" panel. Rerun after changing what the game loads.
//
//   npm run credits -- <slug>
//
// It reads the game's files for /shared/lib/ imports and Google Fonts, public/<slug>/art/sources.json
// (written by `npm run art`) for art, and the game's games.json entry (or --palette <slug>) for the palette.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

// Where to support each art set, beyond the set's own page. Add to this when a set publishes one.
const SET_SUPPORT = {
  'Game Icons': 'https://game-icons.net',
  'Phosphor': 'https://github.com/sponsors/phosphor-icons',
  'Fluent Emoji Flat': 'https://github.com/microsoft/fluentui-emoji',
  'OpenMoji': 'https://openmoji.org',
};

const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
if (!slug) { console.error('usage: npm run credits -- <slug> [--palette <lospec-slug>]'); process.exit(1); }
const dir = path.join(PUBLIC, slug);
const paletteArg = args.includes('--palette') ? args[args.indexOf('--palette') + 1] : null;

const code = fs.readdirSync(dir).filter(f => /\.(html|m?js|css)$/.test(f)).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

// Libraries: any /shared/lib/<name>@<version>/ the game references.
const libs = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'shared', 'lib', 'libs.json'), 'utf8'));
const used = libs.filter(l => code.includes(`/shared/lib/${l.name}@${l.version}/`));
const credits = { libs: used.map(({ name, version, license, what, home, support }) => ({ name, version, license, what, home, support })) };

// Art, grouped by set.
const srcFile = path.join(dir, 'art', 'sources.json');
if (fs.existsSync(srcFile)) {
  const sources = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
  const sets = {};
  for (const [file, s] of Object.entries(sources)) {
    if (!code.includes(file)) continue;
    const set = (sets[s.set] ||= { set: s.set, license: s.license, licenseUrl: s.licenseUrl, home: s.setUrl, support: SET_SUPPORT[s.set] || s.setUrl, icons: [] });
    set.icons.push({ icon: s.icon, author: s.author, source: s.source });
  }
  credits.art = Object.values(sets);
  const unused = Object.keys(sources).filter(f => !code.includes(f));
  if (unused.length) console.log(`not credited (the game doesn't reference them): ${unused.join(', ')}`);
}

// Google Fonts: all are under the SIL Open Font License or Apache 2.0.
const fonts = [...code.matchAll(/fonts\.googleapis\.com\/css2\?([^"']+)/g)]
  .flatMap(m => [...m[1].matchAll(/family=([^:&]+)/g)].map(f => decodeURIComponent(f[1].replace(/\+/g, ' '))));
if (fonts.length) credits.fonts = [...new Set(fonts)].map(name => ({ name, home: `https://fonts.google.com/specimen/${name.replace(/ /g, '+')}` }));

// Palette.
const games = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'games.json'), 'utf8'));
const palSlug = paletteArg || (games.find(g => g.slug === slug) || {}).palette;
if (palSlug) {
  const p = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'shared', 'palettes.json'), 'utf8')).find(p => p.slug === palSlug);
  if (p) credits.palette = { name: p.title, author: p.author, home: p.source };
}

fs.writeFileSync(path.join(dir, 'credits.json'), JSON.stringify(credits, null, 2) + '\n');
console.log(`wrote public/${slug}/credits.json: ${credits.libs.length} libraries, ${(credits.art || []).reduce((n, s) => n + s.icons.length, 0)} art, ${(credits.fonts || []).length} fonts${credits.palette ? ', palette' : ''}`);
