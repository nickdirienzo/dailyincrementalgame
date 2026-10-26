// Measures a game's mix in headless Chromium: how loud the music is, how loud each sound effect
// is, and what trims would balance them. Run it after changing music or sound effects.
//
//   npm run mix -- <slug>                         fresh start
//   npm run mix -- <slug> '{"phase":2}' ...       one or more saves to load (music per phase)
//   npm run mix -- <slug> --music-only [save-json...]  recheck music without replaying unchanged effects
//
// The game must expose its audio when loaded with ?debug:
//   window.__game = { A, sfx: { name: () => play it, ... }, long: ['finale'] }   (A from createAudio)
// Measurements are taken after the player's default slider settings and the game's trims, so the
// numbers are what a player hears before touching the Sound panel.
//
// Targets: music around -24 dBFS RMS; sound effects peaking around -10 dBFS (clearly on top of
// the music) and within 4 dB of each other, so none jumps out and none gets lost.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [slug, ...args] = process.argv.slice(2);
const musicOnly = args.includes('--music-only');
const saves = args.filter(arg => arg !== '--music-only');
if (!slug) { console.error('usage: npm run mix -- <slug> [--music-only] [save-json...]'); process.exit(1); }
const n = Number((fs.readFileSync(path.join(ROOT, 'public', slug, 'index.html'), 'utf8').match(/data-day="(\d+)"/) || [])[1]);

const MUSIC_TARGET = -24, SFX_TARGET = -10;
const server = await serve(path.join(ROOT, 'public'));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

async function measure(save) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(([key, s]) => { localStorage.clear(); if (s) localStorage.setItem(key, s); }, [`di:${n}:save`, save || null]);
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/${slug}/?debug`);
  await page.waitForTimeout(800);
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => window.__game && window.__game.A && window.__game.A.ready, null, { timeout: 8000 });
  await page.waitForTimeout(2500); // let the music start and its samples load
  const result = await page.evaluate(async musicOnly => {
    const { A, sfx } = window.__game;
    const tap = node => { const a = A.ctx.createAnalyser(); a.fftSize = 2048; node.connect(a); return a; };
    const listen = async (an, ms) => {
      const buf = new Float32Array(an.fftSize); let peak = 0, sum = 0, count = 0;
      const end = performance.now() + ms;
      while (performance.now() < end) {
        an.getFloatTimeDomainData(buf);
        for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; count++; }
        await new Promise(r => setTimeout(r, 40));
      }
      const db = x => (x > 0 ? 20 * Math.log10(x) : -120);
      return { peak: db(peak), rms: db(Math.sqrt(sum / Math.max(1, count))) };
    };
    const music = await listen(tap(A.music), 8000);
    if (musicOnly) return { music, effects: {} };
    const fxTap = tap(A.sfx), effects = {};
    // Play each effect once to load its samples, then measure three plays and keep the median
    // (sampled effects vary by note; long ones like a finale are measured over their first 1.2s).
    // Effects listed in window.__game.long (a finale, a fanfare) ring for seconds: measure one play
    // over 8 s instead, so takes don't stack.
    const long = new Set(window.__game.long || []);
    for (const [name, fn] of Object.entries(sfx || {})) {
      try { fn(); } catch (e) { effects[name] = { error: String(e) }; continue; }
      await new Promise(r => setTimeout(r, long.has(name) ? 9000 : 1500));
      if (long.has(name)) { fn(); effects[name] = await listen(fxTap, 8000); continue; }
      const takes = [];
      for (let i = 0; i < 3; i++) { fn(); takes.push(await listen(fxTap, 1200)); await new Promise(r => setTimeout(r, 300)); }
      takes.sort((a, b) => a.peak - b.peak);
      effects[name] = takes[1];
    }
    return { music, effects };
  }, musicOnly);
  await ctx.close();
  return result;
}

const runs = saves.length ? saves : [null];
const all = [];
for (const save of runs) {
  const r = await measure(save);
  all.push(r);
  console.log(`\n${save ? 'save ' + save : 'fresh start'}`);
  console.log(`  music     rms ${r.music.rms.toFixed(1).padStart(6)} dBFS   peak ${r.music.peak.toFixed(1).padStart(6)}   (target rms ${MUSIC_TARGET})`);
  for (const [name, e] of Object.entries(r.effects)) {
    if (e.error) { console.log(`  ${name.padEnd(9)} error: ${e.error}`); continue; }
    const off = e.peak - SFX_TARGET;
    console.log(`  ${name.padEnd(9)} peak ${e.peak.toFixed(1).padStart(6)} dBFS   ${Math.abs(off) <= 2 ? 'ok' : (off > 0 ? `${off.toFixed(1)} dB hot` : `${(-off).toFixed(1)} dB quiet`)}`);
  }
}
// Suggested trims, from the average over the runs.
const avg = xs => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const musicRms = avg(all.map(r => r.music.rms).filter(x => x > -100));
const fxPeaks = all.flatMap(r => Object.values(r.effects).filter(e => !e.error && e.peak > -100).map(e => e.peak));
const fxMid = avg(fxPeaks);
const toGain = db => Math.pow(10, db / 20);
console.log(`\nmusic sits ${(musicRms - MUSIC_TARGET).toFixed(1)} dB from target; multiply musicTrim by ${toGain(MUSIC_TARGET - musicRms).toFixed(2)}.`);
if (fxPeaks.length) {
  console.log(`effects average ${(fxMid - SFX_TARGET).toFixed(1)} dB from target, spread ${(Math.max(...fxPeaks) - Math.min(...fxPeaks)).toFixed(1)} dB`);
  console.log(`multiply sfxTrim by ${toGain(SFX_TARGET - fxMid).toFixed(2)}; even out individual effects in the game.`);
}
await browser.close(); server.close();
