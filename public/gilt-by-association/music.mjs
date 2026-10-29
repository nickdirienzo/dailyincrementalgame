// Phase arrangements of The Gilt Lullaby (slopwave r-ba7063d157cb), a music-box lullaby in
// D dorian (D E F G A B C), the same scale as the game's sound effects. The 48-bar 3/4
// composition (144 beats, about 114 s at 76 BPM) stays intact in every phase; phases change
// layers, tempo and tone, never key. Written phrase-level gain/filter cycles of 3, 4 and 5
// passes run against each other, so the combined texture takes many minutes to repeat exactly.
// This module never starts playback or changes global tempo.
import { createParts } from './song.mjs';

export const phases = {
  paperbacks: { name: 'Paperbacks', bpm: 76 }, // foil: solo music box over the tine bass
  reference:  { name: 'Reference',  bpm: 76 }, // real gold: the counter line joins, warmer bass, faint pad
  rarebooks:  { name: 'Rare Books', bpm: 76 }, // fame: fullest, a celesta-like third above the comb
  craze:      { name: 'Craze',      bpm: 82 }, // everyone joins in: a touch faster, an offbeat twinkle
  finale:     { name: 'Finale',     bpm: 66 }, // dawn: slower, the motif an octave up, glowing pads
};

// The score's chord per 3/4 bar (see .slopwave/work/gilt-by-association/plan.json).
const A1 = ['Dm', 'Dm', 'G', 'Dm', 'F', 'C', 'G', 'Am'];
const A2 = ['Dm', 'Dm', 'G', 'Dm', 'F', 'C', 'Am', 'Dm'];
const B1 = ['F', 'C', 'G', 'Dm', 'F', 'C', 'Em', 'Am'];
const B2 = ['F', 'C', 'G', 'Dm', 'G', 'Em', 'Am', 'Am'];
const CODA = ['Dm', 'Dm', 'G', 'Dm', 'F', 'G', 'Dm', 'Dm'];
const PROG = [...A1, ...A2, ...B1, ...B2, ...A1, ...CODA];
// Pad voicings under the counter line (G3-F4), and offbeat twinkle tones (B3-B4), all dorian.
const PAD = { Dm: 'a3,d4,f4', G: 'g3,b3,d4', C: 'g3,c4,e4', F: 'a3,c4,f4', Am: 'a3,c4,e4', Em: 'g3,b3,e4' };
const TWINKLE = { Dm: ['d4', 'f4', 'a4'], G: ['d4', 'g4', 'b4'], C: ['c4', 'e4', 'g4'], F: ['c4', 'f4', 'a4'],
  Am: ['c4', 'e4', 'a4'], Em: ['b3', 'e4', 'g4'] };
// D dorian has C major's pitch classes; a diatonic step walks this list.
const STEPS = [0, 2, 4, 5, 7, 9, 11];
const PASS = 36; // four-beat cycles per 48-bar pass
// One '<...>' step per 3/4 bar: .fast(4/3) makes each step last 3 beats, aligned with the score.
const perBar = cells => `<${cells.join(' ')}>`;
const padLine = perBar(PROG.map(chord => `[${PAD[chord]}]`));
const twinkleLine = perBar(PROG.map((chord, bar) => {
  if (bar === PROG.length - 1) return '~'; // leave the return bar bare
  const [a, b, c] = TWINKLE[chord];
  return bar % 4 === 3 ? `[~ ${c} ~ ${b} ~ ${a}]` : `[~ ${a} ~ ${b} ~ ${c}]`;
}));

export function createSoundtrack(S) {
  const [bass, counter, comb] = createParts(S);
  const cache = new Map();
  const midi = v => (typeof v.note === 'number' ? v.note : S.noteToMidi(v.note));
  const octave = (pattern, semitones) => pattern.fmap(value => ({ ...value, note: midi(value) + semitones }));
  const thirdAbove = pattern => pattern.fmap(value => {
    const n = midi(value), i = STEPS.indexOf(((n % 12) + 12) % 12);
    if (i < 0) return { ...value, note: n }; // never happens: every comb note is dorian
    const j = i + 2;
    return { ...value, note: Math.floor(n / 12) * 12 + Math.floor(j / 7) * 12 + STEPS[j % 7] };
  });
  // One step per complete pass ('/36'): cycles of 3, 4 and 5 passes never line up quickly.
  const combBreath = (p, g = 1) => p.mul(S.gain(`<${[1, 0.88, 0.95, 0.82].map(v => +(v * g).toFixed(3)).join(' ')}>/${PASS}`));
  const counterBreath = (p, g = 1) => p.mul(S.gain(`<${[1, 0.8, 0.92, 0.7, 0.95].map(v => +(v * g).toFixed(3)).join(' ')}>/${PASS}`));
  const bassBreath = (p, f = 1) => p.lpf(`<${[600, 540, 660].map(v => Math.round(v * f)).join(' ')}>/${PASS}`);
  const warmBass = g => bass.s('triangle').lpf(380).mul(S.gain(g)); // adds audible harmonics on small speakers
  const pad = (g, f = 1) => S.note(padLine).fast(4 / 3).s('triangle')
    .attack(0.7).decay(1.2).sustain(0.8).release(1.6).pan(0.45).room(0.5)
    .lpf(`<${[900, 780, 1000, 840, 720].map(v => Math.round(v * f)).join(' ')}>/${PASS}`)
    .mul(S.gain(`<${[1, 0.8, 0.9].map(v => +(v * g).toFixed(4)).join(' ')}>/${PASS}`));
  const celesta = g => thirdAbove(comb).s('sine').attack(0.003).decay(1.3).sustain(0).release(1.1)
    .lpf(3000).pan(0.7).room(0.55)
    .mul(S.gain(`<${[1, 0.7, 0.95, 0.5, 0.85].map(v => +(v * g).toFixed(3)).join(' ')}>/${PASS}`));
  const twinkle = g => S.note(twinkleLine).fast(4 / 3).s('triangle')
    .attack(0.003).decay(0.35).sustain(0).release(0.3).lpf(2200).pan(0.32).room(0.4)
    .mul(S.gain(`<${[1, 0.75, 0.9, 0.65].map(v => +(v * g).toFixed(3)).join(' ')}>/${PASS}`));

  return (phaseKey) => {
    const key = phases[phaseKey] ? phaseKey : 'paperbacks';
    if (cache.has(key)) return cache.get(key);
    const { bpm } = phases[key];
    let layers;
    if (key === 'paperbacks') {
      // Bottom shelf, foil only: the music box alone over its tine bass.
      layers = [
        bassBreath(bass, 0.9),
        combBreath(comb),
      ];
    } else if (key === 'reference') {
      layers = [
        bassBreath(bass, 1.15).mul(S.gain(1.05)),
        warmBass(0.22),
        counterBreath(counter),
        combBreath(comb),
        pad(0.035),
      ];
    } else if (key === 'rarebooks') {
      // Under the glass: everything, with a soft celesta a diatonic third above the comb.
      layers = [
        bassBreath(bass, 1.15),
        warmBass(0.25),
        counterBreath(counter),
        combBreath(comb, 0.95),
        pad(0.05, 1.1),
        celesta(0.3),
      ];
    } else if (key === 'craze') {
      // Every worm wants a gold grin: a touch faster, an offbeat twinkle rocking under the tune.
      layers = [
        bassBreath(bass, 1.2),
        warmBass(0.25),
        counterBreath(counter, 0.95),
        combBreath(comb, 0.95),
        pad(0.045, 1.15),
        celesta(0.26),
        twinkle(0.1),
      ];
    } else {
      // Dawn, the last gilt letter eaten: slower; the motif rings an octave up over a hushed comb.
      layers = [
        bassBreath(bass, 0.85).release(1.6).mul(S.gain(0.75)),
        counterBreath(counter, 0.6).room(0.55),
        comb.mul(S.gain(0.45)).room(0.55),
        octave(comb, 12).s('sine').attack(0.006).decay(1.8).sustain(0.1).release(2).lpf(3000).pan(0.64).room(0.65)
          .mul(S.gain(`<0.55 0.45 0.6 0.5>/${PASS}`)),
        pad(0.07, 1.25).release(2.6),
        octave(pad(0.04, 1.4), 12).s('sine').attack(1.2).release(2.8).pan(0.58)
          .mul(S.gain(`<1 0.8 0.9>/${PASS}`)),
      ];
    }
    const result = [key, S.stack(...layers), bpm / 240];
    cache.set(key, result);
    return result;
  };
}
