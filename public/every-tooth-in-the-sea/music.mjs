// Phase arrangements of Dr. Worm's Request (slopwave r-32313bde3f4a), a stomp-and-clap sea shanty
// in C blues (C Eb F F# G Bb), the same scale as the game's sound effects (scale('blues', 60)).
// The 32-bar composition (~74 s at 104 BPM) stays intact in every phase; phases change layers,
// tempo and tone, never key. Written phrase-level gain/filter cycles of 3, 4 and 5 passes run
// against each other, so the combined texture takes many minutes to repeat exactly.
// This module never starts playback or changes global tempo.
import { createParts } from './song.mjs';

export const phases = {
  hand:   { name: 'By hand', bpm: 104 }, // crowning by hand: squeezebox and bass, a light stomp
  deck:   { name: 'Deck',    bpm: 104 }, // the belt grid: stomp and clap, a machinery counter-line
  clubs:  { name: 'Clubs',   bpm: 110 }, // everyone joins in: the crew answers every call
  lou:    { name: 'Lou',     bpm: 88  }, // the last tooth: half-time, a held drone, call fragments
  parade: { name: 'Parade',  bpm: 108 }, // the send-off and Lou's request: the full shanty, marching
};

// The score's chord per bar (see .slopwave/work/every-tooth-in-the-sea/plan.json).
const PROG = [
  'Cm', 'Cm', 'Bb', 'Bb', 'Cm', 'Cm', 'G', 'Cm',   // A1
  'Cm', 'Cm', 'Bb', 'Bb', 'Eb', 'F', 'G', 'G',     // A2
  'Eb', 'Bb', 'Eb', 'Bb', 'F', 'Cm', 'G', 'G',     // B (chorus)
  'Cm', 'Cm', 'Bb', 'Bb', 'Cm', 'Cm', 'G', 'G',    // A3
];
const CHORUS = bar => bar >= 16 && bar < 24;
// Three chord tones per bar for the machinery counter-line, kept under the lead (F3-G4).
const TONES = { Cm: ['c4', 'eb4', 'g4'], Bb: ['bb3', 'eb4', 'f4'], G: ['g3', 'bb3', 'f4'], Eb: ['bb3', 'eb4', 'g4'], F: ['f3', 'bb3', 'c4'] };

// One mini-notation step per bar inside '<...>', aligned with the 32-bar pass.
const perBar = fn => '<' + PROG.map((chord, bar) => fn(chord, bar)).join(' ') + '>';
// Belt machinery: a 3-3-2 clockwork tick through the verses, a steadier tick-tock in the chorus.
const machinery = perBar((chord, bar) => {
  const [a, b, c] = TONES[chord];
  return CHORUS(bar) ? `[${a} ~ ${b} ~ ${a} ~ ${c} ~]` : `[${a} ~ ${b} ${a} ~ ${b} ${c} ~]`;
});
// Bars where the crew answers the lead: the responses, the cadences and the chorus close.
const CREW = new Set([3, 4, 7, 8, 11, 12, 22, 23, 27, 28, 31, 32].map(b => b - 1));
const crewMask = perBar((_, bar) => (CREW.has(bar) ? 1 : 0));
// Lou's fragments: only the first two bars of each eight-bar section (the calls, the chorus lift).
const loneMask = perBar((_, bar) => (bar % 8 < 2 ? 1 : 0));
// A crew harmony a third or fourth below, staying on C blues: C->G, Eb->C, F->C, F#->Eb, G->Eb, Bb->G.
const BELOW = { 0: -5, 3: -3, 5: -5, 6: -3, 7: -4, 10: -3 };

export function createSoundtrack(S) {
  const [bass, box, lead, stomp, clap] = createParts(S); // the hat stem is empty in this score
  const cache = new Map();
  const midi = value => (typeof value.note === 'number' ? value.note : S.noteToMidi(value.note));
  const shift = (pattern, semitones) => pattern.fmap(value => ({ ...value, note: midi(value) + semitones }));
  const below = pattern => pattern.fmap(value => {
    const n = midi(value);
    return { ...value, note: n + (BELOW[((n % 12) + 12) % 12] ?? -12) };
  });
  // One step per complete 32-bar pass ('/32'): cycles of 3, 4 and 5 never line up quickly.
  const boxBreath = (p, f = 1) => p.mul(S.gain('<1 0.88 0.95>/32'))
    .lpf(`<${[1300, 1150, 1400, 1220, 1080].map(v => Math.round(v * f)).join(' ')}>/32`);
  const leadBreath = (p, g = '<1 0.82 0.95 0.7>/32') => p.mul(S.gain(g));
  const bassBreath = (p, f = 1) => p.lpf(`<${[520, 470, 580].map(v => Math.round(v * f)).join(' ')}>/32`);
  const echo = (bpm, amount = 0.25) => p => p.delay(amount).delaytime(+(60 / bpm * 0.75).toFixed(4)).delayfeedback(0.3);
  // Hand claps kept soft and under ~2.5 kHz, with a little room.
  const claps = clap.hpf(700).lpf(2300).room(0.25);
  const counter = level => S.note(machinery).s('triangle')
    .attack(0.003).decay(0.09).sustain(0).release(0.08).lpf(1600).pan(0.32).room(0.2)
    .mul(S.gain(`<${level} ${level * 0.8} ${level * 0.92} ${level * 0.7} ${level * 0.88}>/32`));
  const crew = (level, f = 1) => S.stack(
    shift(lead, -12).s('triangle').lpf(Math.round(1400 * f)).attack(0.04).release(0.3).pan(0.36).room(0.45),
    below(lead).s('sawtooth').lpf(Math.round(1000 * f)).vib(5).vibmod(0.08).attack(0.05).release(0.3).pan(0.7).room(0.45)
      .mul(S.gain(0.55)),
  ).mask(crewMask).mul(S.gain(`<${level} ${level * 0.85} ${level * 0.95}>/32`));

  return (phaseKey) => {
    const key = phases[phaseKey] ? phaseKey : 'hand';
    if (cache.has(key)) return cache.get(key);
    const { bpm } = phases[key];
    let layers;
    if (key === 'hand') {
      // Dewey alone with a pen: squeezebox and bass, a stomp on the one, the lead drifting by pass.
      layers = [
        bassBreath(bass, 0.95),
        boxBreath(box).mul(S.gain(0.9)),
        leadBreath(lead, '<0.8 0.95 0.62 0.88>/32'),
        stomp.mask('1 0').mul(S.gain(0.65)),
      ];
    } else if (key === 'deck') {
      // The belt grid keeps time: full stomp, claps on two and four, a clockwork counter-line.
      layers = [
        bassBreath(bass),
        boxBreath(box),
        leadBreath(lead),
        stomp.mul(S.gain(0.9)),
        claps.mul(S.gain(0.85)),
        echo(bpm, 0.18)(counter(0.13)),
      ];
    } else if (key === 'clubs') {
      // Everyone joins in: a touch faster and brighter, and the crew answers every call.
      layers = [
        bassBreath(bass, 1.12),
        boxBreath(box, 1.12),
        leadBreath(lead, '<1 0.9 1 0.8>/32'),
        crew(0.8),
        stomp,
        claps,
        counter(0.09),
      ];
    } else if (key === 'lou') {
      // The last tooth: half-time stomp on the one, no claps, a held C drone under darker bellows,
      // and only the calls left, echoing, like a request line nobody has answered yet.
      layers = [
        bassBreath(bass, 0.75).release(0.4).mul(S.gain(0.8)),
        boxBreath(box, 0.7).release(0.9).mul(S.gain(0.75)),
        echo(bpm, 0.3)(lead.mask(loneMask)).mul(S.gain('<0.85 0.7 0.9 0.6>/32')),
        stomp.mask('1 0').mul(S.gain(0.7)),
        S.note('[c2,g2]').slow(4).s('sawtooth').lpf(300).attack(2.5).decay(1).sustain(0.9).release(3)
          .mul(S.gain('<0.2 0.17 0.19>/32')),
        S.note('<[g4,c5] [g4,bb4]>').slow(8).s('triangle').vib(0.3).vibmod(0.2)
          .attack(3).decay(1).sustain(0.8).release(3).lpf(1800).pan(0.62).room(0.6)
          .mul(S.gain('<0.06 0.045 0.055 0.05 0.04>/32')),
      ];
    } else {
      // The send-off parade and Lou's request: the full shanty marching on every beat, the crew in,
      // and a soft fife an octave over the squeezebox.
      layers = [
        bassBreath(bass, 1.05),
        boxBreath(box, 1.05),
        lead.mul(S.gain(0.9)),
        shift(lead, 12).s('triangle').lpf(2400).attack(0.03).release(0.4).pan(0.66).room(0.5)
          .mul(S.gain('<0.26 0.2 0.3>/32')),
        crew(0.85, 1.05),
        stomp,
        S.s('~ sine ~ sine').freq(65).penv(18).pdecay(0.045).decay(0.12).sustain(0).mul(S.gain(0.16)),
        claps,
      ];
    }
    const result = [key, S.stack(...layers), bpm / 240];
    cache.set(key, result);
    return result;
  };
}
