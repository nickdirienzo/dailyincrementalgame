// Phase arrangements of Fitch's Night Shift, reviewed loop-return revision 2.
// Keep the composed bass, one-drop rhythm, echoes, and final-bar pickup together.
import { createParts } from './song.mjs';

export const phases = {
  1: { name: 'Cellar work', transpose: 0, bpm: 72 },
  2: { name: 'Batteries', transpose: 0, bpm: 72 },
  3: { name: 'Light', transpose: 2, bpm: 74 },
  4: { name: 'Deep cellars', transpose: 5, bpm: 76 },
  up: { name: 'Sunup', transpose: 7, bpm: 58 },
};

export function createSoundtrack(S) {
  const parts = createParts(S);
  const cache = new Map();
  const transpose = (pattern, semitones) => pattern.fmap(value => ({
    ...value, note: (typeof value.note === 'number' ? value.note : S.noteToMidi(value.note)) + semitones,
  }));
  // Written phrase-level changes over four complete passes, never random note deletion.
  const breathe = pattern => pattern.mul(S.gain('<1 0.88 1 0.76>/16'));
  return (phaseKey, radio = false) => {
    const phase = phases[phaseKey] || phases[1];
    const key = `${phaseKey}-${radio ? 'r' : 'plain'}`;
    if (cache.has(key)) return cache.get(key);
    const [bass, chords, lead] = parts.slice(0, 3).map(p => transpose(p, phase.transpose));
    const [kick, snare, hat] = parts.slice(3); // Never transpose percussion pitches/frequencies.
    let layers;
    if (phaseKey === 'up') {
      layers = [
        bass.mul(S.gain(0.85)).release(0.3),
        breathe(chords.s('gm_pad_warm').attack(0.1).release(1.2).mul(S.gain(0.9))),
        lead.s('harmonica_soft').mul(S.gain(0.8)).room(0.35),
      ];
    } else {
      layers = [bass, breathe(chords), lead, kick, snare, hat];
      if (phaseKey >= 2) layers[1] = breathe(chords.lpf(2100).mul(S.gain(1.1)).room(0.18));
      if (phaseKey >= 3) layers.push(
        lead.s('gm_electric_guitar_muted').mul(S.gain(0.45)).pan(0.3),
      );
      if (phaseKey >= 4) layers.push(
        chords.s('gm_pad_warm').attack(0.12).release(0.8).mul(S.gain(0.35)).room(0.3),
      );
      if (radio) layers.push(
        lead.s('harmonica_soft').late(0.1875).mul(S.gain(0.65)).pan(0.7).room(0.3),
      );
    }
    const result = [key, S.stack(...layers), phase.bpm / 240];
    cache.set(key, result);
    return result;
  };
}
