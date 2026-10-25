// Fetches open-licensed SVG art for a game from Iconify (https://iconify.design), which indexes
// ~200 icon and emoji sets and records each set's license. The SVGs are source shapes: games
// recolor and restyle them (see public/shared/kit/sprites.mjs) rather than showing them as shipped.
//
//   npm run art -- search acorn                     find icons, with each set's license
//   npm run art -- <slug> game-icons:acorn ph:sun   save into public/<slug>/art/
//
// Only sets whose license we can follow are allowed: permissive or attribution licenses, nothing
// non-commercial or no-derivatives. Each file's author and license go into
// public/<slug>/art/sources.json, which `npm run credits -- <slug>` turns into the credits panel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.iconify.design';
const ALLOWED = new Set(['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'Unlicense',
  'CC-BY-3.0', 'CC-BY-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-4.0', 'OFL-1.1']);

const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };

async function collections(prefixes) {
  return get(`${API}/collections?prefixes=${prefixes.join(',')}`);
}

// game-icons.net credits a different artist per icon; Iconify only says "GameIcons". The icons
// repo keeps each SVG under its author's folder, so look the author up there.
let gameIconsTree = null;
async function gameIconsAuthor(name) {
  if (!gameIconsTree) {
    const t = await get('https://api.github.com/repos/game-icons/icons/git/trees/master?recursive=1');
    gameIconsTree = t.tree.map(e => e.path).filter(p => p.endsWith('.svg'));
  }
  const hit = gameIconsTree.find(p => p.endsWith(`/${name}.svg`));
  if (!hit) return null;
  const dir = hit.split('/')[0];
  return {
    author: dir.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    source: `https://game-icons.net/1x1/${dir}/${name}.html`,
  };
}

async function search(query) {
  const r = await get(`${API}/search?query=${encodeURIComponent(query)}&limit=96`);
  for (const id of r.icons) {
    const c = r.collections[id.split(':')[0]] || {};
    const spdx = (c.license && c.license.spdx) || '?';
    console.log(`${ALLOWED.has(spdx) ? '  ' : '✗ '}${id.padEnd(44)} ${spdx.padEnd(13)} ${c.name || ''}`);
  }
  console.log('\n✗ = license not allowed. Preview any icon at https://icon-sets.iconify.design/<set>/<name>/');
}

async function fetchArt(slug, ids) {
  const dir = path.join(ROOT, 'public', slug, 'art');
  fs.mkdirSync(dir, { recursive: true });
  const srcFile = path.join(dir, 'sources.json');
  const sources = fs.existsSync(srcFile) ? JSON.parse(fs.readFileSync(srcFile, 'utf8')) : {};
  const byPrefix = {};
  for (const id of ids) { const [p, n] = id.split(':'); if (!n) throw new Error(`"${id}" should look like set:name`); (byPrefix[p] ||= []).push(n); }
  const info = await collections(Object.keys(byPrefix));
  for (const [prefix, names] of Object.entries(byPrefix)) {
    const c = info[prefix];
    if (!c) throw new Error(`unknown icon set "${prefix}"`);
    const spdx = c.license && c.license.spdx;
    if (!ALLOWED.has(spdx)) { console.error(`✗ ${prefix}: license ${spdx || c.license?.title} isn't allowed, skipping ${names.join(', ')}`); continue; }
    const data = await get(`${API}/${prefix}.json?icons=${names.join(',')}`);
    for (const name of names) {
      const real = data.icons[name] ? name : (data.aliases && data.aliases[name] && data.aliases[name].parent);
      const icon = data.icons[real];
      if (!icon) { console.error(`✗ ${prefix}:${name} not found`); continue; }
      const w = icon.width || data.width || 16, h = icon.height || data.height || 16;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.left || 0} ${icon.top || 0} ${w} ${h}" width="${w}" height="${h}">${icon.body}</svg>\n`;
      const file = `${prefix}--${name}.svg`;
      fs.writeFileSync(path.join(dir, file), svg);
      const per = prefix === 'game-icons' ? await gameIconsAuthor(real) : null;
      sources[file] = {
        icon: `${prefix}:${name}`, set: c.name, setUrl: c.author && c.author.url,
        author: (per && per.author) || (c.author && c.author.name) || '',
        license: spdx, licenseUrl: c.license.url,
        source: (per && per.source) || `https://icon-sets.iconify.design/${prefix}/${name}/`,
      };
      console.log(`  ${file}  ${spdx}  ${sources[file].author}`);
    }
  }
  fs.writeFileSync(srcFile, JSON.stringify(sources, null, 2) + '\n');
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) { console.error('usage: npm run art -- search <query> | npm run art -- <slug> <set:name>...'); process.exit(1); }
if (cmd === 'search') await search(rest.join(' '));
else await fetchArt(cmd, rest);
