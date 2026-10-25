// Copies instruments for Strudel music onto our own site, so games never load sounds from GitHub at
// runtime. Fetch only what a game uses; the shared folders grow as games need more.
//
//   npm run samples -- list                         every instrument available, by pack
//   npm run samples -- vcsl marimba vibraphone      recorded instruments (VCSL, CC0)
//   npm run samples -- piano                        Salamander grand piano (CC-BY 3.0)
//   npm run samples -- gm gm_acoustic_guitar_nylon  General MIDI soundfonts (WebAudioFont data, MIT)
//
// VCSL and piano go to public/shared/samples/<pack>/ with a Strudel sample map at
// public/shared/samples/<pack>.json. Soundfonts go to public/shared/soundfonts/. Games load them
// through public/shared/kit/music.mjs, which points Strudel at these folders.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import ffmpeg from '@ffmpeg-installer/ffmpeg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES = path.join(ROOT, 'public', 'shared', 'samples');
const FONTS = path.join(ROOT, 'public', 'shared', 'soundfonts');
const DOUGH = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';
const FONT_SRC = 'https://felixroos.github.io/webaudiofontdata/sound';

export const PACKS = {
  vcsl: { name: 'Versilian Community Sample Library', license: 'CC0-1.0', home: 'https://github.com/sgossner/VCSL', author: 'Versilian Studios' },
  piano: { name: 'Salamander Grand Piano', license: 'CC-BY-3.0', home: 'https://archive.org/details/SalamanderGrandPianoV3', author: 'Alexander Holm' },
  gm: { name: 'WebAudioFont (General MIDI soundfonts)', license: 'MIT', home: 'https://github.com/surikov/webaudiofontdata', author: 'Sergey Surikov, from free SoundFont collections' },
};

async function get(url, as = 'json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return as === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
}

async function gmList() {
  // The gm_* names and their font files, from @strudel/soundfonts.
  const { default: gm } = await import(path.join(ROOT, 'node_modules', '@strudel', 'soundfonts', 'gm.mjs'));
  return gm;
}

async function sampleMap(pack, names) {
  const map = await get(`${DOUGH}/${pack}.json`);
  const outDir = path.join(SAMPLES, pack);
  const mapFile = path.join(SAMPLES, `${pack}.json`);
  const local = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : {};
  local._base = `/shared/samples/${pack}/`;
  const want = names.length ? names : Object.keys(map).filter(k => !k.startsWith('_'));
  for (const name of want) {
    const entry = map[name];
    if (!entry) { console.error(`✗ ${pack}: no instrument "${name}" (npm run samples -- list)`); continue; }
    // Uncompressed recordings are transcoded to MP3 (VBR ~160 kbps): about a tenth of the size,
    // and every browser decodes it.
    const toMp3 = f => f.replace(/\.(wav|aif|aiff|flac)$/i, '.mp3');
    const files = Array.isArray(entry) ? entry : Object.values(entry).flat();
    let bytes = 0;
    for (const f of files) {
      const dest = path.join(outDir, decodeURIComponent(toMp3(f)));
      if (!fs.existsSync(dest)) {
        // Map paths are already URL-encoded.
        const buf = await get(map._base + f, 'buf');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (toMp3(f) === f) fs.writeFileSync(dest, buf);
        else {
          const tmp = path.join(os.tmpdir(), `di-sample-${process.pid}${path.extname(f)}`);
          fs.writeFileSync(tmp, buf);
          execFileSync(ffmpeg.path, ['-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-q:a', '4', dest]);
          fs.rmSync(tmp);
        }
      }
      bytes += fs.statSync(dest).size;
    }
    const remap = e => (Array.isArray(e) ? e.map(toMp3) : typeof e === 'string' ? toMp3(e) : Object.fromEntries(Object.entries(e).map(([k, v]) => [k, remap(v)])));
    local[name] = remap(entry);
    console.log(`  ${pack}:${name}  ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB`);
  }
  fs.mkdirSync(SAMPLES, { recursive: true });
  fs.writeFileSync(mapFile, JSON.stringify(local, null, 1) + '\n');
}

async function soundfonts(names) {
  const gm = await gmList();
  fs.mkdirSync(FONTS, { recursive: true });
  for (const name of names) {
    const fonts = gm[name];
    if (!fonts) { console.error(`✗ gm: no instrument "${name}" (npm run samples -- list)`); continue; }
    // Strudel plays the first font for a name unless a pattern picks another with .n(), so games
    // should leave .n() alone on gm_* sounds; only the first font is fetched.
    const font = fonts[0];
    const dest = path.join(FONTS, `${font}.js`);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, await get(`${FONT_SRC}/${font}.js`, 'buf'));
    console.log(`  ${name}  ${font}  ${(fs.statSync(dest).size / 1e6).toFixed(1)} MB`);
  }
}

const [pack, ...names] = import.meta.url.endsWith('?list') ? [] : process.argv.slice(2);
if (!pack && import.meta.url.endsWith('?list')) { /* imported for PACKS */ }
else if (pack === 'list') {
  for (const p of ['vcsl', 'piano']) {
    const map = await get(`${DOUGH}/${p}.json`);
    console.log(`\n${p} (${PACKS[p].license}):\n  ${Object.keys(map).filter(k => !k.startsWith('_')).join(' ')}`);
  }
  console.log(`\ngm (${PACKS.gm.license}):\n  ${Object.keys(await gmList()).join(' ')}`);
  console.log('\nBuilt into Strudel, no download: sine sawtooth square triangle supersaw pulse white pink brown crackle, and z_* (ZzFX).');
} else if (pack === 'vcsl' || pack === 'piano') await sampleMap(pack, pack === 'piano' ? ['piano'] : names);
else if (pack === 'gm') await soundfonts(names);
else { console.error('usage: npm run samples -- list | vcsl <names...> | piano | gm <gm_names...>'); process.exit(1); }
