// Exercise actual game phase selection, audio controls, and locally served instruments.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await serve(path.join(ROOT, 'public'));
const browser = await chromium.launch();
const origin = `http://127.0.0.1:${server.address().port}`;
const games = [
  { slug: 'the-longest-noon', day: 4, states: [
    [{ phase: 1, ended: false }, 1, 96, [2, 4, 6, 9, 11]],
    [{ phase: 2, ended: false }, 2, 92, [11, 2, 4, 6, 9]],
    [{ phase: 3, ended: false }, 3, 88, [9, 11, 1, 4, 6]],
    [{ ended: true }, 'night', 64, [2, 4, 6, 9, 11]],
  ], instruments: ['marimba', 'balafon_soft', 'vibraphone_soft', 'glockenspiel'] },
  { slug: 'three-lemons', day: 5, states: [
    [{ cellars: 1, unlocked: {}, owned: {}, ended: false }, '1-plain', 72, [7, 9, 11, 2, 4]],
    [{ unlocked: { volts: true } }, '2-plain', 72, [7, 9, 11, 2, 4]],
    [{ owned: { radio: 1 } }, '2-r', 72, [7, 9, 11, 2, 4]],
    [{ unlocked: { volts: true, light: true }, owned: {} }, '3-plain', 74, [9, 11, 1, 4, 6]],
    [{ owned: { radio: 1 } }, '3-r', 74, [9, 11, 1, 4, 6]],
    [{ cellars: 6, owned: {} }, '4-plain', 76, [0, 2, 4, 7, 9]],
    [{ owned: { radio: 1 } }, '4-r', 76, [0, 2, 4, 7, 9]],
    [{ ended: true }, 'up-r', 58, [2, 4, 6, 9, 11]],
  ], instruments: ['gm_electric_guitar_muted', 'gm_pad_warm', 'harmonica_soft'] },
];

try {
  for (const game of games) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com/.test(m.location().url || '')) errors.push(m.text()); });
    page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('request', r => {
      const url = new URL(r.url());
      if (!['127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) errors.push('External request: ' + r.url());
    });
    await page.goto(`${origin}/${game.slug}/?debug`);
    await page.waitForFunction(() => window.__game?.song);
    assert.equal(await page.evaluate(() => __game.music.playing), false, 'No music before a gesture');
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => __game.music.playing && __game.A.ready);
    // Load each new sampled timbre and surface missing local assets in this same runtime.
    await page.evaluate(instruments => {
      instruments.forEach((s, i) => __game.music.hit({ s, note: 'd4', gain: 0.01 }, i * 0.1));
    }, game.instruments);
    const signatures = [];
    for (const [state, key, bpm, pitchClasses] of game.states) {
      const result = await page.evaluate(async ({ state, pitchClasses }) => {
        Object.assign(__game.S(), state);
        __game.music.update();
        const [key, pattern, cps] = __game.song();
        const events = pattern.queryArc(0, 64).filter(h => h.hasOnset());
        const pitched = events.filter(h => h.value.s !== 'white' && h.value.freq !== 65);
        for (const h of pitched) {
          const midi = typeof h.value.note === 'number' ? h.value.note : __game.music.strudel.noteToMidi(h.value.note);
          if (!pitchClasses.includes(((midi % 12) + 12) % 12)) throw new Error('Music left the phase scale: ' + midi);
        }
        if (!pitched.length) throw new Error('Missing pitched voices');
        const again = __game.song();
        if (again[1] !== pattern) throw new Error('Pattern rebuilt despite unchanged phase');
        const analyser = __game.A.ctx.createAnalyser(); analyser.fftSize = 2048;
        __game.A.music.connect(analyser);
        const buffer = new Float32Array(2048); let peak = 0;
        for (let i = 0; i < 90; i++) {
          analyser.getFloatTimeDomainData(buffer);
          for (const value of buffer) peak = Math.max(peak, Math.abs(value));
          await new Promise(resolve => setTimeout(resolve, 40));
        }
        __game.A.music.disconnect(analyser);
        return { key, bpm: cps * 240, peak, playing: __game.music.playing,
          signature: JSON.stringify(events.map(h => [Number(h.whole.begin), h.value])),
          sounds: [...new Set(events.map(h => h.value.s))] };
      }, { state, pitchClasses });
      assert.equal(result.key, key);
      assert.equal(result.bpm, bpm);
      assert(result.playing && result.peak > 0.0001 && result.peak < 1, `Invalid music output: ${game.slug} ${key}`);
      assert(!signatures.includes(result.signature), 'Phase/radio did not change arrangement');
      signatures.push(result.signature);
      if (String(key).startsWith('up')) assert(!result.sounds.includes('white'), 'Sunrise must drop the drums');
      console.log(`${game.slug}: ${key}, ${bpm} BPM, audible, in scale, cached`);
    }
    // Sound panel mute/resume and tab visibility must continue to control the new music.
    await page.evaluate(() => { localStorage.setItem('di:sound-muted', '1'); dispatchEvent(new Event('di:audio')); });
    assert.equal(await page.evaluate(() => __game.music.playing), false);
    await page.evaluate(() => { localStorage.setItem('di:sound-muted', '0'); dispatchEvent(new Event('di:audio')); });
    await page.waitForFunction(() => __game.music.playing);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => !__game.music.playing && __game.A.ctx.state === 'suspended');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => __game.music.playing && __game.A.ready);
    // A reload must select the saved phase/radio/ending, not reset to the opening track.
    const save = await page.evaluate(day => {
      const save = JSON.stringify(__game.S()); localStorage.setItem(`di:${day}:save`, save); return save;
    }, game.day);
    const saved = JSON.parse(save);
    assert(saved.ended);
    await page.reload();
    await page.waitForFunction(() => window.__game?.song);
    assert.equal(await page.evaluate(() => __game.song()[0]), game.states.at(-1)[1]);
    assert.equal(await page.evaluate(() => __game.music.playing), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
