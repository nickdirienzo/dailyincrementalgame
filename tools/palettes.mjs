// Fills public/shared/palettes.json with popular palettes from Lospec (https://lospec.com/palette-list),
// which tools/roll.py picks from. Append-only, like roll.py's lists: existing entries keep their
// place so old seeds still roll the same palette, and new ones go on the end.
//
//   node tools/palettes.mjs [count]     add palettes until the list has [count] (default 64)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'public', 'shared', 'palettes.json');
const want = Number(process.argv[2] || 64);

const list = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];
const have = new Set(list.map(p => p.slug));
for (let page = 0; list.length < want && page < 30; page++) {
  const url = `https://lospec.com/palette-list/load?colorNumberFilterType=any&page=${page}&tag=&sortingType=downloads`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const { palettes = [] } = await res.json();
  if (!palettes.length) break;
  for (const p of palettes) {
    // 4–32 colors: enough to build a look from, few enough to stay a look.
    if (have.has(p.slug) || p.colors.length < 4 || p.colors.length > 32) continue;
    list.push({
      slug: p.slug, title: p.title, author: (p.user && p.user.name) || '',
      colors: p.colors.map(c => '#' + c.toLowerCase()),
      source: `https://lospec.com/palette-list/${p.slug}`,
    });
    have.add(p.slug);
    if (list.length >= want) break;
  }
}
fs.writeFileSync(FILE, JSON.stringify(list, null, 1) + '\n');
console.log(`${list.length} palettes in ${path.relative(ROOT, FILE)}`);
