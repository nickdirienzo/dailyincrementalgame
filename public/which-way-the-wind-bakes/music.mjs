// Phase arrangements of Wendell Can't Decide (slopwave r-dd2770964dce), after-hours gallery jazz in
// C whole tone (C D E F# G# A#). The 40-bar composition (160 beats, about 92 s at 104 BPM) stays intact in
// every phase; phases change layers, tempo, tone and the whole-tone collection: 'pigeons' and 'finale' are
// transposed up one semitone (C# D# F G A B), so sound effects should follow with `phases[key].shift`.
// Written pass-level gain/filter cycles of 3, 4 and 5 passes run against each other, so the combined
// texture takes many minutes to repeat exactly. This module never starts playback or changes global tempo.
import { createParts } from './song.mjs';

export const phases = {
  morning: { name: 'Morning', bpm: 104, shift: 0 }, // runes and first breezes: bass, brushes, sparse vibes
  pigeons: { name: 'Pigeons', bpm: 108, shift: 1 }, // waves arrive: up a semitone, fuller vibes, the lead joins
  rush:    { name: 'Rush',    bpm: 116, shift: 0 }, // last stretch to 9,999: back in C, fullest, busier ride
  finale:  { name: 'Finale',  bpm: 84,  shift: 1 }, // the plinth crunches: slow, glowing, motif an octave up
};

const PASS = 40; // four-beat cycles per 40-bar pass
const steps = (values, scale = 1) => `<${values.map(v => +(v * scale).toFixed(4)).join(' ')}>/${PASS}`;

export function createSoundtrack(S) {
  const [bass, comp, lead, kick, snare, hat] = createParts(S);
  const cache = new Map();
  const midi = v => (typeof v.note === 'number' ? v.note : S.noteToMidi(v.note));
  // Pitched stems only: the drum stems carry no meaningful pitch and are never shifted.
  const shift = (pattern, semitones) => semitones
    ? pattern.fmap(value => ({ ...value, note: midi(value) + semitones })) : pattern;
  // One step per complete pass: cycles of 3, 4 and 5 passes line up only every 60 passes.
  const leadBreath = (p, g = 1) => p.mul(S.gain(steps([1, 0.85, 0.95, 0.78], g)));
  const compBreath = (p, g = 1) => p.mul(S.gain(steps([1, 0.82, 0.92, 0.72, 0.9], g)));
  const bassTone = (p, f = 1) => p.lpf(steps([700, 620, 780], f));
  const rideBreath = (p, g = 1) => p.mul(S.gain(steps([1, 0.85, 0.95, 0.8, 0.9], g)));
  // A swung echo of the vibes, a triplet-eighth late and an octave up, quiet: fuller comping.
  const compEcho = (p, g) => shift(p, 12).late(1 / 6).s('sine').lpf(2600).decay(0.5).pan(0.66).room(0.5)
    .mul(S.gain(steps([1, 0.7, 0.9], g)));
  // Extra swung ride skips on every beat's '&' (busier ride for the rush).
  const rideSkips = g => S.s('[~ ~ white]*4').hpf(6500).decay(0.022).sustain(0).pan(0.56)
    .mul(S.gain(steps([1, 0.75, 0.9, 0.65], g)));
  // One soft brushed swish per two bars, low-passed, for the finale.
  const swish = g => S.s('<[~ white] ~>').hpf(1200).lpf(3200).attack(0.04).decay(0.3).sustain(0).pan(0.45)
    .mul(S.gain(g));

  return (phaseKey) => {
    const key = phases[phaseKey] ? phaseKey : 'morning';
    if (cache.has(key)) return cache.get(key);
    const { bpm, shift: up } = phases[key];
    let layers;
    if (key === 'morning') {
      // The gallery opens: walking bass and brushes, the vibes thin, the lead mostly out (some passes silent).
      layers = [
        bassTone(bass),
        kick, snare, rideBreath(hat),
        compBreath(comp, 0.7),
        lead.mul(S.gain(steps([0.3, 0, 0.22, 0, 0.35]))),
      ];
    } else if (key === 'pigeons') {
      // Pigeons on every side: the other whole-tone collection, fuller vibes, the wry lead joins.
      layers = [
        bassTone(shift(bass, up), 1.05),
        kick, snare, rideBreath(hat),
        compBreath(shift(comp, up)),
        compEcho(shift(comp, up), 0.32),
        leadBreath(shift(lead, up)),
      ];
    } else if (key === 'rush') {
      // Last stretch toward 9,999: back in C, everything in, the ride busier, lead and vibes forward.
      layers = [
        bassTone(bass, 1.1).mul(S.gain(1.05)),
        kick.mul(S.gain(1.1)), snare.mul(S.gain(1.1)), rideBreath(hat, 1.1),
        rideSkips(0.07),
        compBreath(comp, 1.08),
        compEcho(comp, 0.38),
        leadBreath(lead, 1.08),
      ];
    } else {
      // The diorama crunches, the order arrives: slow, no kit but a swish, glowing vibes, motif an octave up.
      layers = [
        bassTone(shift(bass, up), 0.85).decay(0.9).release(0.6).mul(S.gain(0.85)),
        compBreath(shift(comp, up)).decay(1.6).sustain(0.05).release(1.8).room(0.6),
        shift(comp, up + 12).s('sine').lpf(2600).attack(0.02).decay(1.8).sustain(0.05).release(2).pan(0.62).room(0.65)
          .mul(S.gain(steps([0.3, 0.22, 0.27]))),
        leadBreath(shift(lead, up + 12), 0.55).s('sine').lpf(2600).attack(0.01).decay(1.2).sustain(0.15).release(1.4)
          .room(0.6),
        swish(0.035),
      ];
    }
    const result = [key, S.stack(...layers), bpm / 240];
    cache.set(key, result);
    return result;
  };
}
