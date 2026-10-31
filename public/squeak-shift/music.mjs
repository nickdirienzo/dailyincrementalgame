// Phase arrangements of The 3am Polka (slopwave r-6ef10f0a499a), a whole-tone polka in
// C whole tone (C D E F# G# A#), the same scale as the game's sound effects. The 32-bar
// composition (66 s at 116 BPM) stays intact in every phase; phases change layers, tempo and
// tone, never key. Written phrase-level gain/filter cycles of 3, 4 and 5 passes run against
// each other, so the combined texture takes about an hour to repeat exactly.
// This module never starts playback or changes global tempo.
import { createParts } from './song.mjs';

export const phases = {
  clipboard: { name: 'Clipboard', bpm: 116 }, // Hoo alone: oom-pah, soft stabs, the lead now and then
  matron:    { name: 'Matron',    bpm: 108 }, // Matron's round: tiptoe, plucked, lower, quieter
  staff:     { name: 'Staff',     bpm: 120 }, // night staff join: fuller, a counter-melody
  dawn:      { name: 'Dawn',      bpm: 120 }, // the dawn polka: brightest, motif doubled an octave up
  finale:    { name: 'Finale',    bpm: 100 }, // ducks go home: slower, warm held chords
};

// The score's chord per bar (see .slopwave/work/squeak-shift/plan.json): C+ home, D+ away.
const PROG = [
  'C', 'D', 'C', 'D', 'C', 'D', 'D', 'C', // A1
  'C', 'D', 'C', 'D', 'C', 'D', 'C', 'D', // A2
  'D', 'D', 'C', 'C', 'D', 'D', 'C', 'D', // B
  'C', 'D', 'C', 'D', 'C', 'D', 'C', 'D', // A3
];
const HELD = { C: '[gs3,c4,e4]', D: '[fs3,as3,d4]' };

// Counter-melody under the lead (D4-C5), one mini-notation bar per score bar. It see-saws on
// long tones while the lead sings and answers with the motif where the lead rests (bars 9-10,
// 31-32), holding under the B section's runs.
const COUNTER = [
  'e4@3 fs4', 'fs4@3 e4', 'e4@3 fs4', 'fs4@3 e4', 'e4@3 fs4', 'fs4@3 e4', 'fs4@2 d4@2', 'e4@2 c4@2',
  'e4 e4 gs4 e4', 'd4 fs4 as4@2', 'e4@3 fs4', 'fs4@3 e4', 'e4@3 fs4', 'fs4@3 e4', 'e4@2 gs4@2', 'fs4@3 ~',
  'as4@4', 'fs4@4', 'gs4@4', 'e4@4', 'as4@4', 'fs4@4', 'gs4@4', 'd4@2 ~@2',
  'e4@3 fs4', 'fs4@3 e4', 'e4@3 fs4', 'fs4@3 e4', 'gs4@4', 'fs4@2 d4@2', '~ e4 gs4 c5', 'as4 fs4 d4 ~',
];
const bars = list => '<' + list.map(bar => `[${bar}]`).join(' ') + '>';

export function createSoundtrack(S) {
  const [bass, chords, lead, kick, , tick] = createParts(S);
  const cache = new Map();
  const octave = (pattern, semitones) => pattern.fmap(value => ({
    ...value, note: (typeof value.note === 'number' ? value.note : S.noteToMidi(value.note)) + semitones,
  }));
  // One step per complete 32-bar pass ('/32'): cycles of 3, 4 and 5 never line up quickly.
  const cyc = (values, f = 1) => `<${values.map(v => +(v * f).toFixed(3)).join(' ')}>/32`;
  const bassBreath = (p, f = 1) => p.lpf(cyc([420, 380, 460], f));                       // 3
  const chordBreath = (p, f = 1) => p.mul(S.gain(cyc([1, 0.86, 0.94])))                   // 3
    .lpf(cyc([1600, 1400, 1750, 1500, 1300], f));                                         // 5
  const leadBreath = (p, g = [1, 0.82, 1, 0.68]) => p.mul(S.gain(cyc(g)));                // 4
  // The tick, band-limited under ~3 kHz so it never competes with the squeaks.
  const softTick = (g = 1) => tick.hpf(1700).lpf(3000).mul(S.gain(cyc([1.6, 1, 1.35, 0.5], g))); // 4
  const counter = (bpm, level) => S.note(bars(COUNTER)).s('triangle')
    .attack(0.03).decay(0.35).sustain(0.55).release(0.3).lpf(1700).pan(0.36).room(0.3)
    .delay(0.18).delaytime(+(60 / bpm * 0.75).toFixed(4)).delayfeedback(0.25)
    .mul(S.gain(cyc([1, 0.8, 0.95, 0.65, 0.9], level)));                                // 5
  const held = (f = 1) => S.note(bars(PROG.map(c => HELD[c]))).s('sawtooth')
    .attack(0.5).decay(1).sustain(0.75).release(1.8).lpf(cyc([760, 680, 840], f)).pan(0.45).room(0.55);

  return (phaseKey) => {
    const key = phases[phaseKey] ? phaseKey : 'clipboard';
    if (cache.has(key)) return cache.get(key);
    const { bpm } = phases[key];
    let layers;
    if (key === 'clipboard') {
      // Hoo alone with her clipboard: oom-pah and the lead drifting in and out by pass.
      layers = [
        bassBreath(bass),
        chordBreath(chords).mul(S.gain(0.85)),
        leadBreath(lead, [0.72, 0.9, 0.5, 0.82]),
        kick.mul(S.gain(0.6)),
      ];
    } else if (key === 'matron') {
      // Matron is on her round: tiptoe. Plucked bass on beats 1 and 3 only, two plucked stabs per
      // bar, the lead an octave down and staccato, a faint tick.
      layers = [
        bassBreath(bass, 0.85).mask('1 0 1 0').decay(0.14).sustain(0).release(0.06).mul(S.gain(1.1)),
        chordBreath(chords, 0.8).mask('0 1 0 0 0 1 0 0').decay(0.07).sustain(0).mul(S.gain(1.15)),
        leadBreath(octave(lead, -12), [1.05, 0.8, 1, 0.7]).decay(0.16).sustain(0).release(0.1).room(0.4),
        softTick(0.55),
      ];
    } else if (key === 'staff') {
      // The night staff have joined: the full oom-pah, kick, tick and a counter-melody.
      layers = [
        bassBreath(bass),
        chordBreath(chords),
        leadBreath(lead),
        kick.mul(S.gain(0.8)),
        softTick(),
        counter(bpm, 0.11),
      ];
    } else if (key === 'dawn') {
      // The dawn polka: brightest filters, the motif doubled an octave up (soft sine), counter on.
      layers = [
        bassBreath(bass, 1.15),
        chordBreath(chords, 1.25),
        leadBreath(lead, [1, 0.9, 1, 0.85]),
        octave(lead, 12).s('sine').lpf(2600).release(0.3).pan(0.62).room(0.4)
          .mul(S.gain(cyc([0.55, 0.45, 0.6]))),
        kick.mul(S.gain(0.9)),
        softTick(1.15),
        counter(bpm, 0.12),
      ];
    } else {
      // The ducks go home: slower, warm held chords, the bass on beats 1 and 3, the stabs barely
      // there, the motif gently with a soft sine an octave up. No percussion.
      layers = [
        bassBreath(bass, 0.85).mask('1 0 1 0').release(0.25).mul(S.gain(0.8)),
        held().mul(S.gain(cyc([0.13, 0.11, 0.12, 0.1]))),
        octave(held(1.3), 12).s('sine').mul(S.gain(cyc([0.05, 0.065, 0.045]))),
        chordBreath(chords, 0.8).mul(S.gain(0.35)),
        lead.mul(S.gain(0.62)).room(0.5).release(0.4),
        octave(lead, 12).s('sine').lpf(2400).attack(0.04).release(0.6).pan(0.64).room(0.55)
          .mul(S.gain(cyc([0.32, 0.22, 0.28, 0.25, 0.18]))),
      ];
    }
    const result = [key, S.stack(...layers), bpm / 240];
    cache.set(key, result);
    return result;
  };
}
