// Phase arrangements of Sallow's Night Shift (slopwave r-38ae1cb837d8), synthwave in
// C major pentatonic (C D E G A), the same scale as the game's sound effects. The 32-bar
// composition (80 s at 96 BPM) stays intact in every phase; phases change layers, tempo and
// tone, never key. Written phrase-level gain/filter cycles of 3, 4 and 5 passes run against
// each other, so the combined texture takes many minutes to repeat exactly.
// This module never starts playback or changes global tempo.
import { createParts } from './song.mjs';

export const phases = {
  net:      { name: 'Net',      bpm: 96  }, // hand catching: pads, pulse bass, light hats, soft lead
  rota:     { name: 'Rota',     bpm: 96  }, // crews: kick and snare join, an offbeat counter-arp
  knit:     { name: 'Knit',     bpm: 100 }, // automation: fullest, a touch faster, running arp
  surveyor: { name: 'Surveyor', bpm: 92  }, // five stars: half-time, no snare, a held lantern tone
  finale:   { name: 'Finale',   bpm: 84  }, // the Great Thaw: glowing pads, motif an octave up
};

// The score's chord per bar (see .slopwave/work/very-bright-actually/plan.json).
const A = ['C', 'Am', 'Em', 'G', 'C', 'Am', 'D', 'G'];
const PROG = [...A, ...A, 'Am', 'Am', 'Em', 'Em', 'D', 'D', 'G', 'G', ...A];
// Three chord tones per bar for the counter-arp, kept under the lead (C4-A4).
const TONES = { C: ['c4', 'e4', 'g4'], Am: ['c4', 'e4', 'a4'], Em: ['d4', 'e4', 'g4'], G: ['d4', 'g4', 'a4'], D: ['c4', 'd4', 'a4'] };
const up = n => n.replace(/\d$/, d => +d + 1);

// One mini-notation step per bar inside '<...>', aligned with the 32-bar pass.
const counterLine = dense => '<' + PROG.map((chord, bar) => {
  const [a, b, c] = TONES[chord];
  if (bar === 16 || bar === 17) return dense ? `[~ ${a} ~ ${b} ~ ${c} ~ ${b}]` : '~'; // B breakdown
  return dense ? `[${a} ${b} ${c} ${a} ${b} ${c} ${up(a)} ${c}]` // 3-against-8 running arp
    : (bar % 4 === 3 ? `[~ ${a} ~ ${b} ~ ${c} ${up(a)} ${c}]` : `[~ ${a} ~ ${b} ~ ${c} ~ ${b}]`);
}).join(' ') + '>';

export function createSoundtrack(S) {
  const [bass, pad, lead, kick, snare, hat] = createParts(S);
  const cache = new Map();
  const octave = (pattern, semitones) => pattern.fmap(value => ({
    ...value, note: (typeof value.note === 'number' ? value.note : S.noteToMidi(value.note)) + semitones,
  }));
  // One step per complete 32-bar pass ('/32'): cycles of 3, 4 and 5 never line up quickly.
  const padBreath = (p, f = 1) => p.mul(S.gain('<1 0.86 0.94>/32'))
    .lpf(`<${[1000, 860, 1150, 940, 800].map(v => Math.round(v * f)).join(' ')}>/32`);
  const leadBreath = (p, g = '<1 0.8 1 0.62>/32') => p.mul(S.gain(g));
  const bassBreath = (p, f = 1) => p.lpf(`<${[480, 430, 540].map(v => Math.round(v * f)).join(' ')}>/32`);
  const echo = bpm => p => p.delay(0.28).delaytime(+(60 / bpm * 0.75).toFixed(4)).delayfeedback(0.3);
  const counter = (dense, bpm, level) => echo(bpm)(S.note(counterLine(dense)).s('triangle')
    .attack(0.004).decay(0.16).sustain(0).release(0.12).lpf(2200).pan(0.3).room(0.3))
    .mul(S.gain(dense ? `<${level} ${level * 0.8} ${level * 0.9} ${level * 0.7} ${level}>/32` : `<${level} ${level * 0.75} ${level * 0.9} ${level * 0.6}>/32`));
  const softSnare = snare.room(0.35); // a little reverb tail, kept quiet

  return (phaseKey) => {
    const key = phases[phaseKey] ? phaseKey : 'net';
    if (cache.has(key)) return cache.get(key);
    const { bpm } = phases[key];
    let layers;
    if (key === 'net') {
      // Night shift alone: pads, pulse bass, offbeat hats; the lead drifts in and out by pass.
      layers = [
        bassBreath(bass, 0.92),
        padBreath(pad),
        leadBreath(lead, '<0.62 0.85 0.4 0.75>/32'),
        hat.mask('0 1 0 1 0 1 0 1').mul(S.gain(0.8)),
      ];
    } else if (key === 'rota') {
      layers = [
        bassBreath(bass),
        padBreath(pad).mul(S.gain(0.92)),
        leadBreath(lead),
        kick.mul(S.gain(0.85)),
        softSnare,
        hat,
        counter(false, bpm, 0.16),
      ];
    } else if (key === 'knit') {
      layers = [
        bassBreath(bass, 1.15),
        padBreath(pad, 1.15).mul(S.gain(0.9)),
        leadBreath(lead, '<1 0.85 1 0.75>/32'),
        kick,
        softSnare,
        hat.mul(S.gain(1.15)),
        counter(true, bpm, 0.13),
      ];
    } else if (key === 'surveyor') {
      // Five stars, not six. Half-time kick, no snare, darker pad, a held lantern tone with a slow
      // wobble and the odd far-off glint: cozy, slightly wrong.
      layers = [
        bassBreath(bass, 0.8).mul(S.gain(0.9)),
        padBreath(pad, 0.75),
        leadBreath(lead, '<0.85 0.7 0.9 0.6>/32'),
        kick.mask('1 0').mul(S.gain(0.8)),
        hat.mask('0 1 0 1 0 1 0 1').mul(S.gain(0.7)),
        S.note('<[g5,d6] [g5,c6] [a5,d6] [g5,e6]>').slow(4).s('triangle').vib(0.35).vibmod(0.22)
          .attack(2.2).decay(1).sustain(0.8).release(3).lpf(2400).pan(0.62).room(0.6)
          .mul(S.gain('<0.07 0.055 0.065>/32')),
        echo(bpm)(S.note('<[~ ~ ~ e6] ~ [~ ~ a6 ~] ~ ~ [~ ~ ~ g6] ~ [~ d6 ~ ~]>').s('sine')
          .attack(0.01).decay(0.7).sustain(0).release(0.6).pan(0.75).room(0.7)).mul(S.gain(0.05)),
      ];
    } else {
      // The Great Thaw: slower and warm. Glowing pads, the motif an octave up over the lead,
      // soft kick on one and offbeat hats only.
      layers = [
        bassBreath(bass, 0.85).release(0.2).mul(S.gain(0.85)),
        padBreath(pad, 1.3).release(2.4),
        octave(pad, 12).s('sine').attack(0.9).decay(1.5).sustain(0.8).release(2.4).pan(0.58).room(0.6)
          .mul(S.gain('<0.42 0.5 0.36 0.46>/32')),
        lead.mul(S.gain(0.5)).room(0.5),
        octave(lead, 12).s('triangle').lpf(3200).attack(0.03).release(0.6).pan(0.66).room(0.55)
          .mul(S.gain('<0.75 0.65 0.8>/32')),
        kick.mask('1 0').mul(S.gain(0.5)),
        hat.mask('0 1 0 1 0 1 0 1').mul(S.gain(0.45)),
      ];
    }
    const result = [key, S.stack(...layers), bpm / 240];
    cache.set(key, result);
    return result;
  };
}
