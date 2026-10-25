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
import { execFileSync } from 'node:child_process';

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
  // Strudel (AGPL-3.0): TidalCycles-style pattern music with built-in synths and sample playback.
  // The bundle loads its scheduler worker from assets/ next to itself.
  { pkg: '@strudel/web', files: ['dist/index.mjs', ['dist/assets', 'assets']], main: 'index.mjs', import: '@strudel/web',
    also: ['@strudel/core', '@strudel/webaudio'],
    what: 'pattern music: synths, samples, Tidal mini-notation', home: 'https://strudel.cc', support: 'https://opencollective.com/tidalcycles' },
  // General MIDI soundfonts for Strudel (gm_* instruments). Bundled with sfumato and soundfont2;
  // @strudel/core and @strudel/webaudio stay external so they resolve to the Strudel bundle above.
  { pkg: '@strudel/soundfonts', build: { entry: 'dist/index.mjs', external: ['@strudel/core', '@strudel/webaudio'] }, main: 'index.mjs', import: '@strudel/soundfonts',
    what: 'General MIDI instruments for Strudel (guitars, strings, brass, winds…)', home: 'https://strudel.cc', support: 'https://opencollective.com/tidalcycles' },
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
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const f of lib.files || []) {
    // A file, or [from, to] to copy a file or folder to a path inside the vendored folder.
    const [from, to] = Array.isArray(f) ? f : [f, path.basename(f)];
    const src = path.join(dir, from);
    if (!fs.existsSync(src)) throw new Error(`${lib.pkg}: missing ${from}`);
    fs.cpSync(src, path.join(dest, to), { recursive: true });
  }
  if (lib.build) {
    const args = [path.join(dir, lib.build.entry), '--bundle', '--format=esm', '--minify', `--outfile=${path.join(dest, lib.main)}`,
      ...lib.build.external.map(e => `--external:${e}`)];
    execFileSync(path.join(ROOT, 'node_modules', '.bin', 'esbuild'), args, { stdio: 'inherit' });
  }
  const license = fs.readdirSync(dir).find(f => /^licen[cs]e/i.test(f));
  if (license) fs.copyFileSync(path.join(dir, license), path.join(dest, 'LICENSE'));
  manifest.push({
    name: lib.pkg, version: pj.version, license: pj.license, what: lib.what,
    path: `/shared/lib/${folder}/${lib.main}`, ...(lib.import ? { import: lib.import } : { classic: true }), ...(lib.also ? { also: lib.also } : {}),
    home: lib.home, support: lib.support,
  });
  console.log(`${folder}  ${pj.license}`);
}
fs.writeFileSync(path.join(OUT, 'libs.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${path.relative(ROOT, path.join(OUT, 'libs.json'))}`);
