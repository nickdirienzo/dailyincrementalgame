// Copies the third-party libraries games may use from node_modules into public/shared/lib/, under
// versioned folders (so a game keeps working when another game moves to a newer version), and
// writes public/shared/lib/libs.json with each library's license, home and where to support it.
//
//   npm run vendor
//
// To add a library: npm install -D it, add an entry below, run this. Games load ES modules through
// an import map (see templates/game.html); `classic` ones go in a plain <script> tag instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(ROOT, 'node_modules');
const OUT = path.join(ROOT, 'public', 'shared', 'lib');

// support: where people can give money or time, from each project's FUNDING.yml or package.json.
const LIBS = [
  { pkg: 'pixi.js', files: ['dist/pixi.min.mjs'], main: 'pixi.min.mjs', import: 'pixi.js',
    what: 'WebGL sprites and scenes', home: 'https://pixijs.com', support: 'https://opencollective.com/pixijs' },
  { pkg: 'pixi-filters', files: ['dist/pixi-filters.mjs'], main: 'pixi-filters.mjs', import: 'pixi-filters',
    what: 'CRT, glitch, bloom, pixelate and other filters for PixiJS', home: 'https://github.com/pixijs/filters', support: 'https://opencollective.com/pixijs' },
  { pkg: 'roughjs', files: ['bundled/rough.esm.js'], main: 'rough.esm.js', import: 'roughjs',
    what: 'hand-drawn, sketchy shapes', home: 'https://roughjs.com', support: 'https://github.com/sponsors/pshihn' },
  { pkg: 'perfect-freehand', files: ['dist/esm/index.mjs'], main: 'index.mjs', import: 'perfect-freehand',
    what: 'pressure-sensitive ink strokes', home: 'https://github.com/steveruizok/perfect-freehand', support: 'https://github.com/sponsors/steveruizok' },
  { pkg: 'zzfx', files: ['ZzFX.js'], main: 'ZzFX.js', import: 'zzfx',
    what: 'tiny generated sound effects', home: 'https://github.com/KilledByAPixel/ZzFX', support: 'https://github.com/sponsors/KilledByAPixel' },
  { pkg: 'matter-js', files: ['build/matter.min.js'], main: 'matter.min.js', classic: true,
    what: '2D physics (classic script, sets window.Matter)', home: 'https://brm.io/matter-js/', support: 'https://github.com/liabru/matter-js' },
  { pkg: 'break_infinity.js', files: ['dist/break_infinity.min.js'], main: 'break_infinity.min.js', classic: true,
    what: 'numbers past 1e308 for absurd-scale games (classic script, sets window.Decimal)', home: 'https://github.com/Patashu/break_infinity.js', support: 'https://github.com/Patashu/break_infinity.js' },
];

fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const lib of LIBS) {
  const dir = path.join(NM, lib.pkg);
  const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const folder = `${lib.pkg}@${pj.version}`;
  const dest = path.join(OUT, folder);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of lib.files) {
    const src = path.join(dir, f);
    if (!fs.existsSync(src)) throw new Error(`${lib.pkg}: missing ${f}`);
    fs.copyFileSync(src, path.join(dest, path.basename(f)));
  }
  const license = fs.readdirSync(dir).find(f => /^licen[cs]e/i.test(f));
  if (license) fs.copyFileSync(path.join(dir, license), path.join(dest, 'LICENSE'));
  manifest.push({
    name: lib.pkg, version: pj.version, license: pj.license, what: lib.what,
    path: `/shared/lib/${folder}/${lib.main}`, ...(lib.import ? { import: lib.import } : { classic: true }),
    home: lib.home, support: lib.support,
  });
  console.log(`${folder}  ${pj.license}`);
}
fs.writeFileSync(path.join(OUT, 'libs.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${path.relative(ROOT, path.join(OUT, 'libs.json'))}`);
