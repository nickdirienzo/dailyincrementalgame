// Exercise a slopwave module against this site's actual Strudel and audio adapters.
// No game files are changed. This verifies execution, not musical quality.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = process.argv[2];
if (!modulePath) throw new Error('usage: npm run music:check -- <revision/song.mjs>');
const source = await fs.readFile(modulePath, 'utf8');
const server = await serve(path.join(ROOT, 'public'));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', async route => {
    if (!route.request().url().startsWith(origin + '/')) {
      errors.push(`External request: ${route.request().url()}`);
      return route.abort();
    }
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/__music-test/song.mjs') {
      return route.fulfill({ contentType: 'text/javascript', body: source });
    }
    if (pathname === '/__music-test/') {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html>
        <link rel="icon" href="data:,">
        <script type="importmap">{"imports":{"@strudel/web":"/shared/lib/@strudel/web@1.3.0/index.mjs"}}</script>
        <button>Start music</button>
        <script type="module">
          import { createAudio } from '/shared/kit/audio.mjs';
          import { createMusic } from '/shared/kit/music.mjs';
          import { createPattern, cps, bpm, beats } from './song.mjs';
          const A = createAudio({ musicTrim: 1 });
          let music = null;
          music = await createMusic(A, { song: () => ['main', createPattern(music.strudel), cps] });
          music.update();
          window.fixture = { A, music, cps, bpm, beats };
        </script>` });
    }
    return route.continue();
  });
  await page.goto(origin + '/__music-test/');
  await page.waitForFunction(() => window.fixture);
  assert.deepEqual(await page.evaluate(() => [fixture.A.unlocked, fixture.music.playing]), [false, false]);
  await page.click('button');
  await page.waitForFunction(() => fixture.A.ready && fixture.music.playing);
  const measurement = await page.evaluate(async () => {
    const { A, cps, bpm, beats } = fixture;
    if (!(cps > 0 && Number.isFinite(cps) && beats > 0 && Number.isFinite(beats) && Math.abs(cps - bpm / 240) < 1e-9)) {
      throw new Error('Invalid composition tempo metadata');
    }
    const analyser = A.ctx.createAnalyser();
    analyser.fftSize = 2048;
    A.music.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const rms = [];
    let peak = 0;
    const secondsPerRepeat = beats * 60 / bpm;
    // Measure two complete compositions independently, not just two Strudel bars.
    for (let cycle = 0; cycle < 2; cycle++) {
      let sum = 0, count = 0;
      const until = performance.now() + 1000 * secondsPerRepeat;
      while (performance.now() < until) {
        analyser.getFloatTimeDomainData(buffer);
        for (const value of buffer) { sum += value * value; peak = Math.max(peak, Math.abs(value)); count++; }
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      rms.push(Math.sqrt(sum / count));
    }
    A.music.disconnect(analyser);
    return { cps, secondsPerRepeat, rms, peak };
  });
  assert(measurement.rms.every(rms => Number.isFinite(rms) && rms > 0.0001), 'Both repeats must reach the music bus');
  assert(measurement.peak < 1, 'Music bus must not clip');
  // Match the Sound panel's storage/event contract, without changing site UI.
  await page.evaluate(() => { localStorage.setItem('di:volume-music', '0'); window.dispatchEvent(new Event('di:audio')); });
  await page.waitForFunction(() => !fixture.music.playing);
  await page.evaluate(() => { localStorage.setItem('di:volume-music', '0.6'); window.dispatchEvent(new Event('di:audio')); });
  await page.waitForFunction(() => fixture.music.playing);
  // A background tab must keep the music playing.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.evaluate(() => fixture.music.playing), true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => fixture.music.playing);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', module: modulePath, ...measurement,
    checks: ['gesture gate', 'two audible cycles on music bus', 'volume stop/resume', 'simulated visibility pause/resume', 'no external requests or browser errors'] }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
