// Background music on Strudel (https://strudel.cc), the browser version of TidalCycles.
//
//   import { createMusic } from '/shared/kit/music.mjs';
//   const music = await createMusic(A, {
//     packs: ['vcsl'],          // sample packs from /shared/samples (npm run samples), 'vcsl' / 'piano'
//     soundfonts: true,          // gm_* instruments from /shared/soundfonts
//     song: S => [key, pattern], // what to play for the game's state; key changes swap the pattern
//   });
//   music.update();              // call when the game's state might call for different music
//   music.hit({ s: 'marimba', note: 'd5' });  // a one-shot through Strudel (sound effects in the same instruments)
//
// The page needs an import map for '@strudel/web' (and '@strudel/soundfonts' if used); see
// templates/game.html. A is the kit's createAudio(). Strudel shares its audio context: the music
// plays into A.music and hit() into A.sfx, so the player's Sound panel and the game's trims
// control both. Balance the song with .gain() inside the pattern.
//
// Writing music: one cycle is one bar, so cps = bpm / 60 / 4. Make it a process, not a loop:
// .every(), .sometimesBy(), .degradeBy(), .iter(), .off(), "<a b c>" alternation, and lines at
// slightly different speeds (.fast(1.0125)) keep it changing for minutes. See CLAUDE.md.
import * as strudel from '@strudel/web';

// Strudel's orbit for sound effects; everything else is music.
const SFX_ORBIT = 15;

export async function createMusic(A, { packs = [], soundfonts = false, song }) {
  const { initStrudel, samples, hush, superdough, setAudioContext, getSuperdoughAudioController } = strudel;
  setAudioContext(A.ensure());
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

  // Route Strudel's output into the kit's buses. Strudel rebuilds its output after some resets,
  // so check every time we play.
  function route() {
    const ctl = getSuperdoughAudioController();
    const out = ctl.output.destinationGain;
    if (out && !out.__di) { out.disconnect(); out.connect(A.music); out.__di = true; }
    const fx = ctl.getOrbit(SFX_ORBIT).output;
    if (!fx.__di) { fx.disconnect(); fx.connect(A.sfx); fx.__di = true; }
  }

  let key = null, playing = false;
  const wanted = () => A.unlocked && A.musicOn;

  function update(force = false) {
    if (!wanted()) { if (playing) { hush(); playing = false; } return; }
    const [k, pattern, cps] = song();
    if (playing && k === key && !force) return;
    key = k;
    route();
    if (cps) repl.setCps(cps);
    pattern.play();
    playing = true;
  }
  A.onChange(() => update());

  // One-shot through Strudel's engine on the effects bus: sound effects in the music's instruments.
  function hit(value, delay = 0) {
    if (!A.unlocked || !A.soundOn) return;
    route();
    try { superdough({ gain: 0.8, ...value, orbit: SFX_ORBIT }, A.now + 0.02 + delay, value.duration || 0.25); } catch (e) {}
  }

  return { update, hit, get playing() { return playing; }, strudel, repl };
}
