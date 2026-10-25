// Background music on Strudel (https://strudel.cc), the browser version of TidalCycles.
//
//   import { createMusic } from '/shared/kit/music.mjs';
//   const music = await createMusic(A, {
//     packs: ['vcsl'],          // sample packs from /shared/samples (npm run samples), 'vcsl' / 'piano'
//     soundfonts: true,          // gm_* instruments from /shared/soundfonts
//     volume: 0.5,
//     song: S => [key, pattern], // what to play for the game's state; key changes swap the pattern
//   });
//   music.update();              // call when the game's state might call for different music
//   music.hit({ s: 'marimba', note: 'd5' });  // a one-shot through Strudel (sound effects in the same instruments)
//
// The page needs an import map for '@strudel/web' (and '@strudel/soundfonts' if used); see
// templates/game.html. A is the kit's createAudio(): its sound and music toggles control this.
// Strudel runs its own audio context, unlocked on the same first gesture.
//
// Writing music: one cycle is one bar, so cps = bpm / 60 / 4. Make it a process, not a loop:
// .every(), .sometimesBy(), .degradeBy(), .iter(), .off(), "<a b c>" alternation, and lines at
// slightly different speeds (.fast(1.0125)) keep it changing for minutes. See CLAUDE.md.
import * as strudel from '@strudel/web';

export async function createMusic(A, { packs = [], soundfonts = false, volume = 0.5, song }) {
  const { initStrudel, samples, hush, getAudioContext, superdough } = strudel;
  const ready = initStrudel({
    prebake: async () => {
      await Promise.all(packs.map(p => samples(`/shared/samples/${p}.json`)));
      if (soundfonts) {
        const sf = await import('@strudel/soundfonts');
        sf.setSoundfontUrl('/shared/soundfonts');
        sf.registerSoundfonts();
      }
    },
  });
  const repl = await ready;

  let key = null, playing = false, unlocked = false;
  const wanted = () => unlocked && A.musicOn && !document.hidden;

  function update(force = false) {
    if (!wanted()) { if (playing) { hush(); playing = false; } return; }
    const [k, pattern, cps] = song();
    if (playing && k === key && !force) return;
    key = k;
    if (cps) repl.setCps(cps);
    pattern.postgain(volume).play();
    playing = true;
  }
  async function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { await getAudioContext().resume(); } catch (e) {}
    update(true);
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { once: true, capture: true }));
  document.addEventListener('visibilitychange', () => update());
  A.onChange(() => update());

  // One-shot through Strudel's engine: sound effects in the same instruments as the music.
  function hit(value, delay = 0) {
    if (!unlocked || !A.soundOn) return;
    const ctx = getAudioContext();
    try { superdough({ gain: 0.8, ...value }, ctx.currentTime + 0.02 + delay, value.duration || 0.25); } catch (e) {}
  }

  return { update, hit, get playing() { return playing; }, strudel, repl };
}
