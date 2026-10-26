// Phase arrangements of the reviewed Forty-One Noons composition.
// The game and shared music adapter own tempo, transport, and visibility.
import { createParts } from './song.mjs';

export const phases = {
  1: { name: 'Acorns', root: 62, scale: [0, 2, 4, 7, 9], bpm: 96 },
  2: { name: 'Grove', root: 59, scale: [0, 3, 5, 7, 10], bpm: 92 },
  3: { name: 'Great Oak', root: 57, scale: [0, 2, 4, 7, 9], bpm: 88 },
  night: { name: 'Night', root: 50, scale: [0, 2, 4, 7, 9], bpm: 64 },
};

export function createSoundtrack(S) {
  const [bass, answer, melody] = createParts(S);
  const cache = new Map();
  const major = [0, 2, 4, 7, 9];
  const inKey = (pattern, phase) => pattern.fmap(value => {
    const midi = typeof value.note === 'number' ? value.note : S.noteToMidi(value.note);
    const offset = midi - 62, octave = Math.floor(offset / 12);
    const degree = major.indexOf(((offset % 12) + 12) % 12);
    if (degree < 0) throw new Error('The Longest Noon score must stay in D major pentatonic');
    return { ...value, note: phase.root + octave * 12 + phase.scale[degree] };
  });
  // Four complete 16-bar passes breathe differently; the first is the reviewed mix.
  const breathe = pattern => pattern.mul(S.gain('<1 0.82 1 0.92>/16'));
  return phaseKey => {
    const key = Object.hasOwn(phases, phaseKey) ? phaseKey : 1;
    if (cache.has(key)) return cache.get(key);
    const phase = phases[key];
    const low = inKey(bass, phase), mid = inKey(answer, phase), high = inKey(melody, phase);
    let layers;
    if (key === 1) layers = [low, breathe(mid), high];
    else if (key === 2) layers = [
      low.s('balafon_soft'),
      breathe(mid.s('vibraphone_soft').mul(S.gain(0.7)).room(0.3)),
      high,
    ];
    else if (key === 3) layers = [
      low.s('balafon_soft'), breathe(mid.s('vibraphone_soft').mul(S.gain(0.65))), high,
      high.fmap(v => ({ ...v, note: v.note + 12 })).s('glockenspiel')
        .late(0.125).mul(S.gain('<0.12 0 0.16 0>/16')).room(0.3),
    ];
    else layers = [
      low.s('sine').attack(0.08).release(0.45).lpf(900).mul(S.gain(0.8)),
      breathe(mid.mul(S.gain(0.65))),
      high.room(0.35).mul(S.gain(0.8)),
    ];
    // Phase trims measured through the game's audio bus; night settles a little quieter.
    const trim = key === 2 ? 1.25 : key === 'night' ? 0.8 : 1;
    const result = [key, S.stack(...layers).mul(S.gain(trim)), phase.bpm / 240];
    cache.set(key, result);
    return result;
  };
}
