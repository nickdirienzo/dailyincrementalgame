// Self-hosts Google Fonts, so pages never ask Google for anything.
//
//   npm run fonts -- moonshroom               a game: download its fonts, point the page at our copies
//   npm run fonts -- public/privacy/index.html   any page, by path
//   npm run fonts -- "Courier Prime:wght@400;700"   just download a family (Google Fonts css2 syntax)
//
// Write the page's fonts as a normal Google Fonts <link> (css2 URL), then run this: it downloads every
// family into public/shared/fonts/<family>/ (woff2 files for the latin and latin-ext subsets, a
// font.css of @font-face rules, the license, and font.json for the credits), swaps the link for one
// <link> per family, and drops the Google preconnects. Families are shared between games: new weights
// or styles are merged into the existing font.css.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const FONTS = path.join(PUBLIC, 'shared', 'fonts');
const SUBSETS = ['latin', 'latin-ext'];
// Google serves woff2 only to browsers it recognizes.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export const familySlug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const get = async (url, as = 'text') => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  return as === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
};

// The license lives next to the font's sources in github.com/google/fonts, under its license's folder.
async function license(name, dir) {
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [folder, file, spdx] of [['ofl', 'OFL.txt', 'OFL-1.1'], ['apache', 'LICENSE.txt', 'Apache-2.0'], ['ufl', 'UFL.txt', 'UFL-1.0']]) {
    const r = await fetch(`https://raw.githubusercontent.com/google/fonts/main/${folder}/${id}/${file}`);
    if (!r.ok) continue;
    fs.writeFileSync(path.join(dir, 'LICENSE.txt'), await r.text());
    return spdx;
  }
  throw new Error(`couldn't find a license for ${name} in github.com/google/fonts`);
}

// @font-face blocks keyed by style, weight and subset, so reruns and other weights merge cleanly.
const faceKey = f => `${f.style} ${f.weight} ${f.subset}`;
function readFaces(file) {
  if (!fs.existsSync(file)) return [];
  return [...fs.readFileSync(file, 'utf8').matchAll(/\/\* (\S+) \*\/\n(@font-face \{[^}]+\})/g)].map(m => ({ subset: m[1], css: m[2], ...props(m[2]) }));
}
function props(css) {
  const p = k => (css.match(new RegExp(`${k}:\\s*([^;]+);`)) || [])[1];
  return { style: p('font-style'), weight: p('font-weight') };
}

// Downloads one css2 family spec ("Gaegu:wght@400;700") and returns its family name.
export async function addFamily(spec) {
  const css = await get(`https://fonts.googleapis.com/css2?family=${spec.replace(/ /g, '+')}&display=swap`);
  const name = css.match(/font-family:\s*'([^']+)'/)[1];
  const slug = familySlug(name);
  const dir = path.join(FONTS, slug);
  fs.mkdirSync(dir, { recursive: true });
  const cssFile = path.join(dir, 'font.css');
  const faces = new Map(readFaces(cssFile).map(f => [faceKey(f), f]));
  for (const m of css.matchAll(/\/\* (\S+) \*\/\n(@font-face \{[^}]+\})/g)) {
    const [, subset, block] = m;
    if (!SUBSETS.includes(subset)) continue;
    const { style, weight } = props(block);
    const file = `${slug}-${style}-${weight.replace(/ /g, '-')}-${subset}.woff2`;
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)[1];
    fs.writeFileSync(path.join(dir, file), await get(url, 'buffer'));
    const local = block.replace(/url\(https:[^)]+\) format\('woff2'\)/, `url(${file}) format('woff2')`);
    faces.set(faceKey({ style, weight, subset }), { subset, style, weight, css: local });
  }
  const sorted = [...faces.values()].sort((a, b) => faceKey(a).localeCompare(faceKey(b)));
  fs.writeFileSync(cssFile, `/* ${name}, self-hosted from Google Fonts by npm run fonts. License: LICENSE.txt */\n` + sorted.map(f => `/* ${f.subset} */\n${f.css}`).join('\n') + '\n');
  const meta = path.join(dir, 'font.json');
  if (!fs.existsSync(meta)) {
    const spdx = await license(name, dir);
    fs.writeFileSync(meta, JSON.stringify({ name, license: spdx, home: `https://fonts.google.com/specimen/${name.replace(/ /g, '+')}` }, null, 2) + '\n');
  }
  console.log(`  ${name}: ${sorted.length} faces in public/shared/fonts/${slug}/`);
  return name;
}

// Splits a css2 query string into one spec per family.
const specs = query => [...query.replace(/&amp;/g, '&').matchAll(/family=([^&]+)/g)].map(m => decodeURIComponent(m[1]).replace(/\+/g, ' '));

async function selfHostPage(file) {
  let html = fs.readFileSync(file, 'utf8');
  const links = [...html.matchAll(/^.*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?([^"]+)">\n/gm)];
  if (!links.length) { console.log(`${path.relative(ROOT, file)}: no Google Fonts link`); return; }
  console.log(path.relative(ROOT, file));
  for (const [line, query] of links) {
    const names = [];
    for (const spec of specs(query)) names.push(await addFamily(spec));
    html = html.replace(line, names.map(n => `<link rel="stylesheet" href="/shared/fonts/${familySlug(n)}/font.css">\n`).join(''));
  }
  html = html.replace(/^<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\n/gm, '');
  fs.writeFileSync(file, html);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (!args.length) { console.error('usage: npm run fonts -- <slug | page.html | "Family:spec">...'); process.exit(1); }
  for (const a of args) {
    const page = [path.join(PUBLIC, a, 'index.html'), path.resolve(a)].find(f => /\.html$/.test(f) && fs.existsSync(f));
    if (page) await selfHostPage(page);
    else await addFamily(a);
  }
}
